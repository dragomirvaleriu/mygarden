import { db, collection, doc, writeBatch, serverTimestamp, query, where, getDocs } from './firebase';
import { Client, Property, Invoice, PaymentAllocation } from '../src/types';

export const processPayment = async (
  amount: number,
  client: Client,
  properties: Property[],
  organizationId: string,
  details: string = 'Încasare rapidă'
) => {
  console.log(`[PAYMENT] Starting process for client ${client.id}, amount: ${amount}, org: ${organizationId}`);
  
  if (!organizationId) {
    throw new Error("ID Organizație lipsește. Reîncărcați pagina.");
  }

  if (isNaN(amount) || amount <= 0) {
    throw new Error("Suma invalidă. Introduceți o valoare pozitivă.");
  }

  const clientProps = properties.filter(p => p.clientId === client.id);
  console.log(`[PAYMENT] Found ${clientProps.length} properties for client.`);

  const batch = writeBatch(db);

  // 1. Fetch unpaid/partially paid invoices for this client
  const invoicesQuery = query(
    collection(db, 'invoices'),
    where('organizationId', '==', organizationId),
    where('clientId', '==', client.id),
    where('status', 'in', ['unpaid', 'partially_paid'])
  );
  const invoicesSnap = await getDocs(invoicesQuery);
  const unpaidInvoices = invoicesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Invoice));

  // Group existing unpaid invoices by propertyId
  const invoicesByProp: Record<string, Invoice[]> = {};
  unpaidInvoices.forEach(inv => {
    if (!invoicesByProp[inv.propertyId]) {
      invoicesByProp[inv.propertyId] = [];
    }
    invoicesByProp[inv.propertyId].push(inv);
  });

  const allInvoicesToPay: Invoice[] = [];

  // Check for any legacy debt gaps (property.sold > sum of unpaid invoices)
  for (const prop of clientProps) {
    const propSold = prop.sold || 0;
    if (propSold <= 0) continue;

    const propInvoices = invoicesByProp[prop.id] || [];
    const invoicesSum = propInvoices.reduce((sum, inv) => sum + (inv.remainingAmount || 0), 0);

    if (propSold > invoicesSum) {
      const gapAmount = Number((propSold - invoicesSum).toFixed(2));
      // Generate a unique invoice ID to avoid collision or overwriting paid historical invoices
      const legacyInvoiceRef = doc(collection(db, 'invoices'));
      const legacyInvoiceId = legacyInvoiceRef.id;

      // Create legacy invoice document in batch
      batch.set(legacyInvoiceRef, {
        id: legacyInvoiceId,
        clientId: client.id,
        propertyId: prop.id,
        organizationId: organizationId,
        billingMonth: 'Istoric',
        amount: gapAmount,
        remainingAmount: gapAmount,
        status: 'unpaid',
        createdAt: serverTimestamp()
      });

      const legacyInvoice: Invoice = {
        id: legacyInvoiceId,
        clientId: client.id,
        propertyId: prop.id,
        organizationId: organizationId,
        billingMonth: 'Istoric',
        amount: gapAmount,
        remainingAmount: gapAmount,
        status: 'unpaid',
        createdAt: new Date()
      };

      allInvoicesToPay.push(legacyInvoice);
    } else if (propSold < invoicesSum) {
      // Invoices exceed the sold. This means the sold was manually reduced or overpaid outside the system.
      // We create a "Discount Corecție" invoice with a negative remaining amount that will offset the first invoices.
      const excessAmount = Number((invoicesSum - propSold).toFixed(2));
      
      const correctionInvoiceRef = doc(collection(db, 'invoices'));
      const correctionInvoiceId = correctionInvoiceRef.id;

      batch.set(correctionInvoiceRef, {
        id: correctionInvoiceId,
        clientId: client.id,
        propertyId: prop.id,
        organizationId: organizationId,
        billingMonth: 'Corecție Sold',
        amount: -excessAmount,
        remainingAmount: -excessAmount,
        status: 'unpaid', // Treated as unpaid so it gets picked up by FIFO
        createdAt: serverTimestamp()
      });

      const correctionInvoice: Invoice = {
        id: correctionInvoiceId,
        clientId: client.id,
        propertyId: prop.id,
        organizationId: organizationId,
        billingMonth: 'Corecție Sold',
        amount: -excessAmount,
        remainingAmount: -excessAmount,
        status: 'unpaid',
        createdAt: new Date(0) // Set to epoch 0 so it gets processed FIRST in FIFO
      };

      allInvoicesToPay.push(correctionInvoice);
    }

    // Add existing invoices
    allInvoicesToPay.push(...propInvoices);
  }

  // Sort all invoices FIFO: oldest first ("Istoric" comes first, then chronological)
  allInvoicesToPay.sort((a, b) => {
    if (a.billingMonth === 'Istoric' && b.billingMonth !== 'Istoric') return -1;
    if (b.billingMonth === 'Istoric' && a.billingMonth !== 'Istoric') return 1;
    
    // Sort chronologically using createdAt if available
    const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt ? new Date(a.createdAt as any).getTime() : 0);
    const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt ? new Date(b.createdAt as any).getTime() : 0);
    
    if (dateA !== dateB) {
      return dateA - dateB;
    }
    return a.billingMonth.localeCompare(b.billingMonth);
  });

  // 2. Distribute payment across invoices (FIFO)
  let paymentLeft = amount;
  const allocations: PaymentAllocation[] = [];
  const propertyPayments: Record<string, number> = {};

  for (const inv of allInvoicesToPay) {
    // If it's a correction invoice (negative), it adds to our payment pool
    const invRemaining = inv.remainingAmount || 0;
    
    if (invRemaining < 0) {
      paymentLeft = Number((paymentLeft + Math.abs(invRemaining)).toFixed(2));
      batch.update(doc(db, 'invoices', inv.id), {
        remainingAmount: 0,
        status: 'paid'
      });
      // We don't record a negative allocation, but we track property payments so the sold remains balanced
      // Wait, if we add to propertyPayments, the final sold will be reduced by this amount too!
      // But the sold is already correct (it was lower than invoices). The invoices were too high.
      // So the correction invoice just pays off the extra invoice amount. 
      // If we track it in propertyPayments, the newSold calculation will reduce the sold again!
      // So we do NOT add it to propertyPayments!
      continue;
    }

    if (paymentLeft <= 0) break;
    if (invRemaining === 0) continue;

    let allocatedAmount = 0;
    let newStatus: 'unpaid' | 'partially_paid' | 'paid' = 'unpaid';

    if (paymentLeft >= invRemaining) {
      allocatedAmount = invRemaining;
      paymentLeft = Number((paymentLeft - invRemaining).toFixed(2));
      newStatus = 'paid';
    } else {
      allocatedAmount = paymentLeft;
      paymentLeft = 0;
      newStatus = 'partially_paid';
    }

    const newInvRemaining = Number((invRemaining - allocatedAmount).toFixed(2));

    // Update invoice document
    batch.update(doc(db, 'invoices', inv.id), {
      remainingAmount: newInvRemaining,
      status: newStatus
    });

    // Record allocation
    allocations.push({
      invoiceId: inv.id,
      billingMonth: inv.billingMonth,
      amount: Number(allocatedAmount.toFixed(2))
    });

    // Track total paid per property
    propertyPayments[inv.propertyId] = Number(((propertyPayments[inv.propertyId] || 0) + allocatedAmount).toFixed(2));
  }

  // 3. Update property sold fields based on allocated amounts
  for (const prop of clientProps) {
    const paidAmount = propertyPayments[prop.id] || 0;
    if (paidAmount > 0) {
      const newSold = Number(((prop.sold || 0) - paidAmount).toFixed(2));
      batch.update(doc(db, 'properties', prop.id), { sold: newSold });
    }
  }

  // 4. Handle overpayments/credits: apply the remainder to the Client's Credit Balance
  if (paymentLeft > 0) {
    const newCreditBalance = Number(((client.creditBalance || 0) + paymentLeft).toFixed(2));
    console.log(`[PAYMENT] Applying credit/remaining payment to client wallet: ${newCreditBalance} RON`);
    batch.update(doc(db, 'clients', client.id), { creditBalance: newCreditBalance });
  }

  // 5. Log payment in history (with allocations metadata)
  const historyRef = doc(collection(db, 'client_history'));
  batch.set(historyRef, {
    clientId: client.id,
    organizationId: organizationId,
    type: 'payment',
    amount: amount,
    date: serverTimestamp(),
    details: details,
    hidden: true,
    allocations: allocations
  });

  console.log(`[PAYMENT] Committing batch...`);
  await batch.commit();
  console.log(`[PAYMENT] Success!`);
};
