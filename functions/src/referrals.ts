import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

/**
 * Get or create the caller's shareable referral code. Deterministic from
 * uid (no uniqueness-check transaction needed) so repeated calls are cheap
 * and idempotent.
 */
export const generateReferralCode = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    }

    const db = admin.firestore();
    const userRef = db.collection('users').doc(context.auth.uid);
    const snap = await userRef.get();
    const existing = snap.data()?.referralCode;
    if (existing) {
        return { code: existing };
    }

    const code = context.auth.uid.substring(0, 8).toUpperCase();
    await userRef.update({ referralCode: code });
    return { code };
});

/**
 * Called from stripeWebhook right after a purchase grants the buyer's org
 * its subscriptionProduct. Grants +7 days to both the referrer and the
 * buyer's organizations, once per buyer (guarded by referralBonusApplied),
 * so a repeat purchase never double-grants. Never throws — a referral
 * hiccup must not break the purchase flow that calls it.
 */
export async function applyReferralBonus(buyerUid: string, buyerOrgId: string): Promise<void> {
    const db = admin.firestore();
    try {
        const buyerUserRef = db.collection('users').doc(buyerUid);
        const buyerSnap = await buyerUserRef.get();
        const buyerData = buyerSnap.data();
        const referredByCode = buyerData?.referredBy;

        if (!referredByCode || buyerData?.referralBonusApplied) {
            return;
        }

        const referrerQuery = await db.collection('users')
            .where('referralCode', '==', referredByCode)
            .limit(1)
            .get();

        if (referrerQuery.empty) {
            return; // Unknown/garbage referral code — no bonus, no error.
        }

        const referrerDoc = referrerQuery.docs[0];
        const referrerOrgId = referrerDoc.data()?.organizationId;
        if (!referrerOrgId || referrerOrgId === buyerOrgId) {
            return; // Self-referral or referrer has no org — skip silently.
        }

        const BONUS_MS = 7 * 24 * 60 * 60 * 1000;

        await db.runTransaction(async (tx) => {
            const referrerOrgRef = db.collection('organizations').doc(referrerOrgId);
            const buyerOrgRef = db.collection('organizations').doc(buyerOrgId);
            const [referrerOrgSnap, buyerOrgSnap] = await Promise.all([tx.get(referrerOrgRef), tx.get(buyerOrgRef)]);

            const extendExpiry = (currentExpiry: any) => {
                const base = currentExpiry?.toDate ? currentExpiry.toDate() : new Date();
                const from = base.getTime() > Date.now() ? base.getTime() : Date.now();
                return admin.firestore.Timestamp.fromMillis(from + BONUS_MS);
            };

            tx.update(referrerOrgRef, {
                planExpires: extendExpiry(referrerOrgSnap.data()?.planExpires),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            tx.update(buyerOrgRef, {
                planExpires: extendExpiry(buyerOrgSnap.data()?.planExpires),
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
    } catch (err) {
        console.error('applyReferralBonus failed (non-fatal):', err);
    }
}
