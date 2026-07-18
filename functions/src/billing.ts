import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

/**
 * Cloud Function to run automated billing daily at 01:00 AM (server time / usually UTC)
 * Timezone can be configured via schedule options if needed, but UTC 01:00 is fine.
 */
export const scheduledAutomatedBilling = functions.pubsub
  .schedule('0 1 * * *')
  .timeZone('Europe/Bucharest') // Ensures it runs at 01:00 AM Romanian time
  .onRun(async (context) => {
    const dbAdmin = admin.firestore();
    console.log("[CRON] Running automated billing from Firebase Cloud Functions...");
    
    try {
      const now = new Date();
      
      const currentMonthNumber = now.getMonth() + 1; // 1-12
      const currentYear = now.getFullYear();
      const currentDay = now.getDate();
      const billingMonthStr = `${currentYear}-${currentMonthNumber.toString().padStart(2, '0')}`;

      console.log(`[CRON] Billing check for day=${currentDay}, month=${currentMonthNumber}, year=${currentYear}, billingMonth=${billingMonthStr}`);

      const propertiesSnap = await dbAdmin.collection('properties').get();
      if (propertiesSnap.empty) {
        console.log("[CRON] No properties found for billing.");
        return null;
      }

      console.log(`[CRON] Found ${propertiesSnap.size} properties to check.`);

      // Pre-fetch all clients to check their status
      const clientsSnap = await dbAdmin.collection('clients').get();
      const clientStatusMap = new Map();
      clientsSnap.docs.forEach(doc => {
        clientStatusMap.set(doc.id, doc.data().status);
      });

      let billedCount = 0;
      let batch = dbAdmin.batch();
      let operationsInBatch = 0;

      for (const doc of propertiesSnap.docs) {
        const property = doc.data();
        const tarifLunar = property.tarifLunar || 0;

        // Condition 0: Skip if client is inactive
        if (clientStatusMap.get(property.clientId) === 'Inactiv') {
          console.log(`[CRON] Skipping property ${doc.id} because client ${property.clientId} is Inactiv.`);
          continue;
        }

        // Condition 1: Must have a tarifLunar > 0
        if (tarifLunar <= 0) continue;

        // Condition 2: contractType shouldn't be one-time or project
        if (property.contractType === 'one-time' || property.contractType === 'project') continue;

        // Condition 3: Not already billed this month
        if (property.lastBilledMonth === billingMonthStr) continue;

        // Condition 4: Target day is reached (or passed, if we missed a day)
        const ziEmitere = Number(property.ziEmitereFactura) || 1;
        if (currentDay < ziEmitere) continue;

        // Condition 5: Is this month billable?
        if (property.billableMonths && Array.isArray(property.billableMonths) && property.billableMonths.length > 0) {
          const numericMonths = property.billableMonths.map(Number);
          const includes1Based = numericMonths.includes(currentMonthNumber);
          const includes0Based = numericMonths.includes(currentMonthNumber - 1);
          if (!includes1Based && !includes0Based) continue;
        }

        console.log(`[CRON] Billing property ${doc.id} (${property.name || 'unnamed'}) for client ${property.clientId}, amount=${tarifLunar}`);

        // --- All conditions met, bill this property! ---

        // 1. Create Invoice
        const invoiceRef = dbAdmin.collection('invoices').doc();
        batch.set(invoiceRef, {
          clientId: property.clientId,
          propertyId: doc.id,
          organizationId: property.organizationId,
          billingMonth: billingMonthStr,
          amount: tarifLunar,
          remainingAmount: tarifLunar,
          status: 'unpaid',
          createdAt: new Date()
        });
        operationsInBatch++;

        // 2. Update Property Sold and lastBilledMonth
        const newSold = (property.sold || 0) + tarifLunar;
        batch.update(doc.ref, {
          sold: newSold,
          lastBilledMonth: billingMonthStr
        });
        operationsInBatch++;

        // 3. Add to Client History
        const historyRef = dbAdmin.collection('client_history').doc();
        batch.set(historyRef, {
          clientId: property.clientId,
          organizationId: property.organizationId,
          propertyId: doc.id,
          propertyName: property.name || '',
          type: 'billing',
          date: new Date(),
          details: `Facturare recurentă automată (${tarifLunar} RON) pentru luna ${billingMonthStr}`,
          amount: tarifLunar,
          performedByName: 'Sistem (Auto-Facturare)'
        });
        operationsInBatch++;

        billedCount++;

        // Commit batch if it gets too large, then create a new batch
        if (operationsInBatch >= 450) {
          await batch.commit();
          batch = dbAdmin.batch(); // Create a NEW batch after commit!
          operationsInBatch = 0;
        }
      }

      if (operationsInBatch > 0) {
        await batch.commit();
      }

      console.log(`[CRON] Automated billing completed. Billed ${billedCount} properties.`);
      return null;

    } catch (err: any) {
      console.error("[CRON] Automated billing error:", err);
      return null;
    }
  });
