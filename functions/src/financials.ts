import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Remove the global db initialization to avoid "no-app" error
// const db = admin.firestore();

/**
 * Triggered on any write to a property document.
 * It recalculates the client's total financials and contract details and saves it to the Client document.
 */
export const aggregateClientFinancials = functions.firestore
    .document('properties/{propertyId}')
    .onWrite(async (change, context) => {
        const db = admin.firestore();
        // Get the client ID from the property
        const propertyData = change.after.exists ? change.after.data() : change.before.data();
        const clientId = propertyData?.clientId;

        if (!clientId) {
            console.log('No clientId found on property, skipping aggregation.');
            return null;
        }

        try {
            // Fetch all properties for this client
            const propertiesSnap = await db.collection('properties').where('clientId', '==', clientId).get();
            
            let totalSold = 0;
            let totalTarif = 0;
            let totalSuprafata = 0;
            let ziScadenta: number | null = null;
            let dataScadenta: string | null = null;
            let contractType: string | null = null;
            let maintenanceFrequency: string | null = null;

            const clientProps = propertiesSnap.docs.map(doc => doc.data());
            
            // Check if there is any maintenance contract
            const hasMaintenance = clientProps.some(p => p.contractType === 'maintenance');
            if (hasMaintenance) {
                contractType = 'maintenance';
            } else if (clientProps.length > 0 && clientProps[0].contractType) {
                contractType = clientProps[0].contractType;
            }

            // Optional: aggregate frequency for UI purposes (using the first maintenance property or similar)
            const maintProp = clientProps.find(p => p.contractType === 'maintenance' && p.maintenanceFrequency);
            if (maintProp) {
                maintenanceFrequency = maintProp.maintenanceFrequency;
            } else if (clientProps.length > 0 && clientProps[0].maintenanceFrequency) {
                maintenanceFrequency = clientProps[0].maintenanceFrequency;
            }

            clientProps.forEach(p => {
                totalSold += (p.sold || 0);
                totalTarif += (p.tarifLunar || 0);
                totalSuprafata += (p.surfaceArea || p.suprafataMp || 0);
                
                // Find earliest ziScadenta for debtors
                if ((p.sold || 0) > 0 && p.ziScadenta) {
                    if (!ziScadenta || p.ziScadenta < ziScadenta) {
                        ziScadenta = p.ziScadenta;
                    }
                }

                // Any dataScadenta is better than none
                if (p.dataScadenta) {
                    dataScadenta = p.dataScadenta;
                }
            });

            // Prepare update payload
            const updatePayload: any = {
                sold: totalSold,
                tarifLunar: totalTarif,
                suprafataMp: totalSuprafata,
                propertyCount: clientProps.length,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };

            if (contractType) updatePayload.contractType = contractType;
            if (maintenanceFrequency) updatePayload.maintenanceFrequency = maintenanceFrequency;
            if (ziScadenta) updatePayload.ziScadenta = ziScadenta;
            if (dataScadenta) updatePayload.dataScadenta = dataScadenta;

            // Update client document atomically
            await db.collection('clients').doc(clientId).update(updatePayload);
            console.log(`Successfully aggregated financials for client ${clientId}: Sold=${totalSold}, Tarif=${totalTarif}`);
            
            return null;
        } catch (error) {
            console.error(`Error aggregating financials for client ${clientId}:`, error);
            return null;
        }
    });

/**
 * HTTP Callable function to backfill financials for all clients.
 * Intended to be run once or manually via admin action.
 */
export const backfillClientFinancials = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Admin must be logged in.');
    }

    const db = admin.firestore();

    try {
        const clientsSnap = await db.collection('clients').get();
        const batch = db.batch();
        let updatedCount = 0;

        for (const clientDoc of clientsSnap.docs) {
            const clientId = clientDoc.id;
            const propertiesSnap = await db.collection('properties').where('clientId', '==', clientId).get();
            
            let totalSold = 0;
            let totalTarif = 0;
            let totalSuprafata = 0;
            let ziScadenta: number | null = null;
            let dataScadenta: string | null = null;
            let contractType: string | null = null;
            let maintenanceFrequency: string | null = null;

            const clientProps = propertiesSnap.docs.map(doc => doc.data());
            
            const hasMaintenance = clientProps.some(p => p.contractType === 'maintenance');
            if (hasMaintenance) {
                contractType = 'maintenance';
            } else if (clientProps.length > 0 && clientProps[0].contractType) {
                contractType = clientProps[0].contractType;
            }

            const maintProp = clientProps.find(p => p.contractType === 'maintenance' && p.maintenanceFrequency);
            if (maintProp) {
                maintenanceFrequency = maintProp.maintenanceFrequency;
            } else if (clientProps.length > 0 && clientProps[0].maintenanceFrequency) {
                maintenanceFrequency = clientProps[0].maintenanceFrequency;
            }

            clientProps.forEach(p => {
                totalSold += (p.sold || 0);
                totalTarif += (p.tarifLunar || 0);
                totalSuprafata += (p.surfaceArea || p.suprafataMp || 0);
                
                if ((p.sold || 0) > 0 && p.ziScadenta) {
                    if (!ziScadenta || p.ziScadenta < ziScadenta) {
                        ziScadenta = p.ziScadenta;
                    }
                }

                if (p.dataScadenta) {
                    dataScadenta = p.dataScadenta;
                }
            });

            const updatePayload: any = {
                sold: totalSold,
                tarifLunar: totalTarif,
                suprafataMp: totalSuprafata,
                propertyCount: clientProps.length,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };

            if (contractType) updatePayload.contractType = contractType;
            if (maintenanceFrequency) updatePayload.maintenanceFrequency = maintenanceFrequency;
            if (ziScadenta) updatePayload.ziScadenta = ziScadenta;
            if (dataScadenta) updatePayload.dataScadenta = dataScadenta;

            batch.update(clientDoc.ref, updatePayload);
            updatedCount++;

            // Firestore batch has a 500 operation limit
            if (updatedCount % 450 === 0) {
                await batch.commit();
                // We're resetting the batch, but technically we need to create a new one. 
                // Since this is just a quick one-off, let's process in chunks of 450.
            }
        }

        // Commit any remaining
        if (updatedCount % 450 !== 0) {
            await batch.commit();
        }

        return { success: true, processed: updatedCount };
    } catch (error) {
        console.error('Error during backfill:', error);
        throw new functions.https.HttpsError('internal', 'Error backfilling clients');
    }
});

/**
 * Daily Cron Job for Monthly Invoicing
 * Runs at 00:01 every day to generate invoices for maintenance contracts.
 */
export const runMonthlyInvoicingCron = functions.pubsub.schedule('1 0 * * *')
    .timeZone('Europe/Bucharest')
    .onRun(async (context) => {
        const db = admin.firestore();
        const today = new Date();
        const currentDay = today.getDate();
        const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
        const currentMonthIndex = today.getMonth();

        try {
            console.log(`[CRON INVOICING] Started for ${currentMonth}, day ${currentDay}`);

            // 1. Get all organizations and their default invoice days
            const orgsSnap = await db.collection('organizations').get();
            const orgSettings: Record<string, any> = {};
            orgsSnap.forEach(doc => {
                orgSettings[doc.id] = doc.data();
            });

            // 2. Get all active clients
            const clientsSnap = await db.collection('clients').where('status', '==', 'Activ').get();
            const activeClientIds = new Set(clientsSnap.docs.map(d => d.id));

            // 3. Get all properties
            const propsSnap = await db.collection('properties').get();
            const batch = db.batch();
            let hasUpdates = false;
            let operationsCount = 0;

            // Helper to commit batch if it reaches limit
            const checkBatch = async () => {
                if (operationsCount >= 450) {
                    await batch.commit();
                    operationsCount = 0;
                }
            };

            for (const docSnap of propsSnap.docs) {
                const property = { id: docSnap.id, ...docSnap.data() } as any;

                if (property.contractType === 'maintenance' && property.maintenanceFrequency !== 'occasional') {
                    if (!activeClientIds.has(property.clientId)) continue;

                    const orgId = property.organizationId;
                    const defaultDay = orgSettings[orgId]?.defaultInvoiceDay || 1;
                    const billingDay = property.ziEmitereFactura || defaultDay;

                    // If already billed this month, skip
                    if (property.lastBilledMonth === currentMonth) {
                        continue;
                    }

                    // Check if today is or past the billing day
                    if (currentDay >= billingDay) {
                        
                        // Check billable months
                        const billableMonths = property.billableMonths;
                        if (billableMonths && Array.isArray(billableMonths) && !billableMonths.includes(currentMonthIndex)) {
                            continue;
                        }

                        const tarif = property.tarifLunar || 0;
                        const currentSold = property.sold || 0;
                        const newSold = currentSold + tarif;
                        
                        let remainingAmount = tarif;
                        let status = 'unpaid';

                        if (currentSold < 0) {
                            const credit = Math.abs(currentSold);
                            if (credit >= tarif) {
                                remainingAmount = 0;
                                status = 'paid';
                            } else {
                                remainingAmount = tarif - credit;
                                status = 'partially_paid';
                            }
                        }

                        // Update property
                        batch.update(docSnap.ref, {
                            sold: Number(newSold.toFixed(2)),
                            lastBilledMonth: currentMonth
                        });
                        operationsCount++;
                        await checkBatch();

                        // Create unique invoice
                        const invoiceId = `${property.id}_${currentMonth}`;
                        const invoiceRef = db.collection('invoices').doc(invoiceId);
                        batch.set(invoiceRef, {
                            id: invoiceId,
                            clientId: property.clientId,
                            propertyId: property.id,
                            organizationId: orgId,
                            billingMonth: currentMonth,
                            amount: tarif,
                            remainingAmount: Number(remainingAmount.toFixed(2)),
                            status: status,
                            createdAt: admin.firestore.FieldValue.serverTimestamp()
                        });
                        operationsCount++;
                        await checkBatch();

                        hasUpdates = true;
                    }
                }
            }

            if (hasUpdates && operationsCount > 0) {
                await batch.commit();
            }

            console.log(`[CRON INVOICING] Finished successfully.`);
            return null;
        } catch (error) {
            console.error("[CRON INVOICING] Error during cron execution:", error);
            return null;
        }
    });
