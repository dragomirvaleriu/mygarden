"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runMonthlyInvoicingCron = exports.backfillClientFinancials = exports.aggregateClientFinancials = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
exports.aggregateClientFinancials = functions.firestore
    .document('properties/{propertyId}')
    .onWrite(async (change, context) => {
    const db = admin.firestore();
    const propertyData = change.after.exists ? change.after.data() : change.before.data();
    const clientId = propertyData === null || propertyData === void 0 ? void 0 : propertyData.clientId;
    if (!clientId) {
        console.log('No clientId found on property, skipping aggregation.');
        return null;
    }
    try {
        const propertiesSnap = await db.collection('properties').where('clientId', '==', clientId).get();
        let totalSold = 0;
        let totalTarif = 0;
        let totalSuprafata = 0;
        let ziScadenta = null;
        let dataScadenta = null;
        let contractType = null;
        let maintenanceFrequency = null;
        const clientProps = propertiesSnap.docs.map(doc => doc.data());
        const hasMaintenance = clientProps.some(p => p.contractType === 'maintenance');
        if (hasMaintenance) {
            contractType = 'maintenance';
        }
        else if (clientProps.length > 0 && clientProps[0].contractType) {
            contractType = clientProps[0].contractType;
        }
        const maintProp = clientProps.find(p => p.contractType === 'maintenance' && p.maintenanceFrequency);
        if (maintProp) {
            maintenanceFrequency = maintProp.maintenanceFrequency;
        }
        else if (clientProps.length > 0 && clientProps[0].maintenanceFrequency) {
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
        const updatePayload = {
            sold: totalSold,
            tarifLunar: totalTarif,
            suprafataMp: totalSuprafata,
            propertyCount: clientProps.length,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };
        if (contractType)
            updatePayload.contractType = contractType;
        if (maintenanceFrequency)
            updatePayload.maintenanceFrequency = maintenanceFrequency;
        if (ziScadenta)
            updatePayload.ziScadenta = ziScadenta;
        if (dataScadenta)
            updatePayload.dataScadenta = dataScadenta;
        await db.collection('clients').doc(clientId).update(updatePayload);
        console.log(`Successfully aggregated financials for client ${clientId}: Sold=${totalSold}, Tarif=${totalTarif}`);
        return null;
    }
    catch (error) {
        console.error(`Error aggregating financials for client ${clientId}:`, error);
        return null;
    }
});
exports.backfillClientFinancials = functions.https.onCall(async (data, context) => {
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
            let ziScadenta = null;
            let dataScadenta = null;
            let contractType = null;
            let maintenanceFrequency = null;
            const clientProps = propertiesSnap.docs.map(doc => doc.data());
            const hasMaintenance = clientProps.some(p => p.contractType === 'maintenance');
            if (hasMaintenance) {
                contractType = 'maintenance';
            }
            else if (clientProps.length > 0 && clientProps[0].contractType) {
                contractType = clientProps[0].contractType;
            }
            const maintProp = clientProps.find(p => p.contractType === 'maintenance' && p.maintenanceFrequency);
            if (maintProp) {
                maintenanceFrequency = maintProp.maintenanceFrequency;
            }
            else if (clientProps.length > 0 && clientProps[0].maintenanceFrequency) {
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
            const updatePayload = {
                sold: totalSold,
                tarifLunar: totalTarif,
                suprafataMp: totalSuprafata,
                propertyCount: clientProps.length,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };
            if (contractType)
                updatePayload.contractType = contractType;
            if (maintenanceFrequency)
                updatePayload.maintenanceFrequency = maintenanceFrequency;
            if (ziScadenta)
                updatePayload.ziScadenta = ziScadenta;
            if (dataScadenta)
                updatePayload.dataScadenta = dataScadenta;
            batch.update(clientDoc.ref, updatePayload);
            updatedCount++;
            if (updatedCount % 450 === 0) {
                await batch.commit();
            }
        }
        if (updatedCount % 450 !== 0) {
            await batch.commit();
        }
        return { success: true, processed: updatedCount };
    }
    catch (error) {
        console.error('Error during backfill:', error);
        throw new functions.https.HttpsError('internal', 'Error backfilling clients');
    }
});
exports.runMonthlyInvoicingCron = functions.pubsub.schedule('1 0 * * *')
    .timeZone('Europe/Bucharest')
    .onRun(async (context) => {
    var _a;
    const db = admin.firestore();
    const today = new Date();
    const currentDay = today.getDate();
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const currentMonthIndex = today.getMonth();
    try {
        console.log(`[CRON INVOICING] Started for ${currentMonth}, day ${currentDay}`);
        const orgsSnap = await db.collection('organizations').get();
        const orgSettings = {};
        orgsSnap.forEach(doc => {
            orgSettings[doc.id] = doc.data();
        });
        const clientsSnap = await db.collection('clients').where('status', '==', 'Activ').get();
        const activeClientIds = new Set(clientsSnap.docs.map(d => d.id));
        const propsSnap = await db.collection('properties').get();
        const batch = db.batch();
        let hasUpdates = false;
        let operationsCount = 0;
        const checkBatch = async () => {
            if (operationsCount >= 450) {
                await batch.commit();
                operationsCount = 0;
            }
        };
        for (const docSnap of propsSnap.docs) {
            const property = Object.assign({ id: docSnap.id }, docSnap.data());
            if (property.contractType === 'maintenance' && property.maintenanceFrequency !== 'occasional') {
                if (!activeClientIds.has(property.clientId))
                    continue;
                const orgId = property.organizationId;
                const defaultDay = ((_a = orgSettings[orgId]) === null || _a === void 0 ? void 0 : _a.defaultInvoiceDay) || 1;
                const billingDay = property.ziEmitereFactura || defaultDay;
                if (property.lastBilledMonth === currentMonth) {
                    continue;
                }
                if (currentDay >= billingDay) {
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
                        }
                        else {
                            remainingAmount = tarif - credit;
                            status = 'partially_paid';
                        }
                    }
                    batch.update(docSnap.ref, {
                        sold: Number(newSold.toFixed(2)),
                        lastBilledMonth: currentMonth
                    });
                    operationsCount++;
                    await checkBatch();
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
    }
    catch (error) {
        console.error("[CRON INVOICING] Error during cron execution:", error);
        return null;
    }
});
//# sourceMappingURL=financials.js.map