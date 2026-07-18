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
exports.scheduledAutomatedBilling = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
exports.scheduledAutomatedBilling = functions.pubsub
    .schedule('0 1 * * *')
    .timeZone('Europe/Bucharest')
    .onRun(async (context) => {
    const dbAdmin = admin.firestore();
    console.log("[CRON] Running automated billing from Firebase Cloud Functions...");
    try {
        const now = new Date();
        const currentMonthNumber = now.getMonth() + 1;
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
            if (clientStatusMap.get(property.clientId) === 'Inactiv') {
                console.log(`[CRON] Skipping property ${doc.id} because client ${property.clientId} is Inactiv.`);
                continue;
            }
            if (tarifLunar <= 0)
                continue;
            if (property.contractType === 'one-time' || property.contractType === 'project')
                continue;
            if (property.lastBilledMonth === billingMonthStr)
                continue;
            const ziEmitere = Number(property.ziEmitereFactura) || 1;
            if (currentDay < ziEmitere)
                continue;
            if (property.billableMonths && Array.isArray(property.billableMonths) && property.billableMonths.length > 0) {
                const numericMonths = property.billableMonths.map(Number);
                const includes1Based = numericMonths.includes(currentMonthNumber);
                const includes0Based = numericMonths.includes(currentMonthNumber - 1);
                if (!includes1Based && !includes0Based)
                    continue;
            }
            console.log(`[CRON] Billing property ${doc.id} (${property.name || 'unnamed'}) for client ${property.clientId}, amount=${tarifLunar}`);
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
            const newSold = (property.sold || 0) + tarifLunar;
            batch.update(doc.ref, {
                sold: newSold,
                lastBilledMonth: billingMonthStr
            });
            operationsInBatch++;
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
            if (operationsInBatch >= 450) {
                await batch.commit();
                batch = dbAdmin.batch();
                operationsInBatch = 0;
            }
        }
        if (operationsInBatch > 0) {
            await batch.commit();
        }
        console.log(`[CRON] Automated billing completed. Billed ${billedCount} properties.`);
        return null;
    }
    catch (err) {
        console.error("[CRON] Automated billing error:", err);
        return null;
    }
});
//# sourceMappingURL=billing.js.map