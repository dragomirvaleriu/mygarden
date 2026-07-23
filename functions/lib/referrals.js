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
exports.applyReferralBonus = exports.generateReferralCode = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
exports.generateReferralCode = functions.https.onCall(async (data, context) => {
    var _a;
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    }
    const db = admin.firestore();
    const userRef = db.collection('users').doc(context.auth.uid);
    const snap = await userRef.get();
    const existing = (_a = snap.data()) === null || _a === void 0 ? void 0 : _a.referralCode;
    if (existing) {
        return { code: existing };
    }
    const code = context.auth.uid.substring(0, 8).toUpperCase();
    await userRef.update({ referralCode: code });
    return { code };
});
async function applyReferralBonus(buyerUid, buyerOrgId) {
    var _a;
    const db = admin.firestore();
    try {
        const buyerUserRef = db.collection('users').doc(buyerUid);
        const buyerSnap = await buyerUserRef.get();
        const buyerData = buyerSnap.data();
        const referredByCode = buyerData === null || buyerData === void 0 ? void 0 : buyerData.referredBy;
        if (!referredByCode || (buyerData === null || buyerData === void 0 ? void 0 : buyerData.referralBonusApplied)) {
            return;
        }
        const referrerQuery = await db.collection('users')
            .where('referralCode', '==', referredByCode)
            .limit(1)
            .get();
        if (referrerQuery.empty) {
            return;
        }
        const referrerDoc = referrerQuery.docs[0];
        const referrerOrgId = (_a = referrerDoc.data()) === null || _a === void 0 ? void 0 : _a.organizationId;
        if (!referrerOrgId || referrerOrgId === buyerOrgId) {
            return;
        }
        const BONUS_MS = 7 * 24 * 60 * 60 * 1000;
        await db.runTransaction(async (tx) => {
            var _a, _b;
            const referrerOrgRef = db.collection('organizations').doc(referrerOrgId);
            const buyerOrgRef = db.collection('organizations').doc(buyerOrgId);
            const [referrerOrgSnap, buyerOrgSnap] = await Promise.all([tx.get(referrerOrgRef), tx.get(buyerOrgRef)]);
            const extendExpiry = (currentExpiry) => {
                const base = (currentExpiry === null || currentExpiry === void 0 ? void 0 : currentExpiry.toDate) ? currentExpiry.toDate() : new Date();
                const from = base.getTime() > Date.now() ? base.getTime() : Date.now();
                return admin.firestore.Timestamp.fromMillis(from + BONUS_MS);
            };
            tx.update(referrerOrgRef, {
                planExpires: extendExpiry((_a = referrerOrgSnap.data()) === null || _a === void 0 ? void 0 : _a.planExpires),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            tx.update(buyerOrgRef, {
                planExpires: extendExpiry((_b = buyerOrgSnap.data()) === null || _b === void 0 ? void 0 : _b.planExpires),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            tx.update(referrerDoc.ref, {
                referralCount: admin.firestore.FieldValue.increment(1),
            });
            tx.update(buyerUserRef, {
                referralBonusApplied: true,
            });
        });
        await db.collection('users').doc(referrerDoc.id).collection('notifications').add({
            type: 'referral',
            title: 'Cineva s-a alăturat prin linkul tău!',
            message: '+7 zile PRO adăugate contului tău. Mulțumim că recomanzi My Garden!',
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
    catch (err) {
        console.error('applyReferralBonus failed (non-fatal):', err);
    }
}
exports.applyReferralBonus = applyReferralBonus;
//# sourceMappingURL=referrals.js.map