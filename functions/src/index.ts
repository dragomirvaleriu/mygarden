import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';

export * from './financials';
export * from './billing';
export { generateReferralCode } from './referrals';
import { applyReferralBonus } from './referrals';

admin.initializeApp();
const db = admin.firestore();

/**
 * Write a notification doc to a user's feed. Called only from server-side
 * flows (webhook, gift redemption) — clients can never create their own
 * (see firestore.rules), so this is the sole path notifications take.
 */
async function createNotification(
    uid: string,
    type: 'purchase' | 'giftcode' | 'referral',
    title: string,
    message: string
): Promise<void> {
    try {
        await db.collection('users').doc(uid).collection('notifications').add({
            type,
            title,
            message,
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    } catch (err) {
        console.error('createNotification failed (non-fatal):', err);
    }
}

// Stripe is constructed on first use, not at module load.
//
// Every function in this file shares one bundle, so anything done at module
// scope is paid for on the cold start of *every* callable — including the
// admin panel's, which never touch Stripe. Only createCheckoutSession and
// stripeWebhook need it, so they pay for it and nobody else does.
// Set the secret with: firebase functions:config:set stripe.secret=sk_live_...
let stripeClient: Stripe | null = null;
function getStripe(): Stripe {
    if (!stripeClient) {
        stripeClient = new Stripe(functions.config().stripe?.secret || 'sk_test_placeholder', {
            apiVersion: '2022-11-15',
        });
    }
    return stripeClient;
}

// usePlan() — the only thing the app actually reads to decide if someone is
// PRO — resolves entirely from organizations/{orgId}, never from
// users/{uid}. Every entitlement write (gift code redemption, Stripe
// webhook) has to land on the caller's organization or it's invisible to
// the rest of the app, no matter how "successful" the write looks.
async function getCallerOrgId(uid: string): Promise<string> {
    const userSnap = await db.collection('users').doc(uid).get();
    const orgId = userSnap.data()?.organizationId;
    if (!orgId) {
        throw new functions.https.HttpsError('failed-precondition', 'No organization found for this account.');
    }
    return orgId;
}

// The one account that owns this product. Superadmin is deliberately a
// constant and not a database flag: every privileged callable below trusts
// this check, so whatever it reads must be something a client cannot write.
export const SUPERADMIN_EMAIL = 'dragomirvaleriu@gmail.com';

/**
 * Verify the caller is the product owner.
 *
 * This reads `context.auth.token` — the decoded Firebase ID token, signed by
 * Firebase Auth and verified by the Functions SDK before our code runs. It is
 * the only superadmin signal in this codebase a client cannot forge.
 *
 * It used to read `users/{uid}.isSuperAdmin`, which was a privilege-escalation
 * hole: firestore.rules lets a user write their own `users/{uid}` document, so
 * any account could set `isSuperAdmin: true` on itself and then list every
 * user, mint gift codes, and delete accounts. Never re-introduce a superadmin
 * check that reads a client-writable field.
 *
 * A `superadmin` custom claim is also accepted so access can later be granted
 * to another account without a redeploy — claims are set server-side via the
 * Admin SDK and are likewise not client-writable.
 *
 * Deliberately NOT gated on `email_verified`. The owner's account signs in
 * with the password provider and has never verified its address, so requiring
 * it locked the only superadmin out of the panel. It buys nothing here either:
 * Firebase Auth enforces one account per email per project, so the owner's
 * address is already taken and cannot be claimed by an attacker. This also
 * keeps the check consistent with isSuperAdmin() in firestore.rules, which
 * matches on the token email alone — a stricter rule here just produces a
 * half-working panel where reads succeed and every write is denied.
 */
function isSuperAdminContext(context: functions.https.CallableContext): boolean {
    const token: any = context.auth?.token;
    if (!token) return false;
    if (token.superadmin === true) return true;
    return typeof token.email === 'string'
        && token.email.toLowerCase() === SUPERADMIN_EMAIL;
}

/**
 * Throw the standard permission error unless the caller is the product owner.
 * Every superadmin-only callable starts with this.
 */
function assertSuperAdmin(context: functions.https.CallableContext, action: string): void {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
    }
    if (!isSuperAdminContext(context)) {
        throw new functions.https.HttpsError('permission-denied', `Only the product owner can ${action}.`);
    }
}

/**
 * Record a privileged action to the admin audit trail.
 *
 * Lives at superadmin/data/audit_log/{autoId} — already covered by the
 * `match /superadmin/{document=**}` catch-all in firestore.rules (superadmin
 * read/write only), so no rules change was needed to expose it.
 *
 * Fire-and-forget on purpose: a logging failure must never fail the action
 * it's describing (a successful deletion that throws afterward would read to
 * the caller as a failed deletion, which it wasn't).
 */
async function logAudit(
    context: functions.https.CallableContext,
    action: string,
    details: Record<string, unknown>
): Promise<void> {
    try {
        await db.collection('superadmin').doc('data').collection('audit_log').add({
            action,
            actorUid: context.auth?.uid ?? null,
            actorEmail: context.auth?.token?.email ?? null,
            details,
            at: admin.firestore.FieldValue.serverTimestamp(),
        });
    } catch (err) {
        console.error(`logAudit failed for action=${action} (non-fatal):`, err);
    }
}

/**
 * Redeem a gift code to upgrade the caller's organization to Pro.
 */
export const redeemGiftCode = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    }

    const { code } = data;
    if (!code) {
        throw new functions.https.HttpsError('invalid-argument', 'Code is required.');
    }

    const giftCodeRef = db.collection('gift_codes').doc(code.toUpperCase());
    const orgId = await getCallerOrgId(context.auth.uid);

    // Transaction: the used-check and the used-write must be atomic, or two
    // concurrent redemptions of the same code could both read used=false
    // and both succeed.
    const expiresAt = await db.runTransaction(async (tx) => {
        const snap = await tx.get(giftCodeRef);
        if (!snap.exists) {
            throw new functions.https.HttpsError('not-found', 'Invalid gift code.');
        }
        const giftData = snap.data();
        if (giftData?.used) {
            throw new functions.https.HttpsError('failed-precondition', 'Code already used.');
        }

        const durationDays = giftData?.days || 30;
        const expires = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
        const product = giftData?.product as string | undefined;

        // Product-specific codes (adFree/academyPro/bundle) set subscriptionProduct,
        // same as a real Stripe purchase. Legacy codes with no product keep the
        // original blanket subscriptionTier='pro' grant for backward compatibility.
        const orgUpdate: Record<string, any> = {
            planExpires: admin.firestore.Timestamp.fromDate(expires),
            // Redeemed codes are given away, not sold — keep them out of the
            // revenue figure. See subscriptionSource in grantSubscription.
            subscriptionSource: 'gift',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        if (product) {
            orgUpdate.subscriptionProduct = product;
            if (product === 'academyPro' || product === 'bundle') {
                orgUpdate.subscriptionTier = 'pro';
            }
        } else {
            orgUpdate.subscriptionTier = 'pro';
        }

        tx.update(db.collection('organizations').doc(orgId), orgUpdate);
        tx.update(giftCodeRef, {
            used: true,
            usedBy: context.auth!.uid,
            usedByOrg: orgId,
            usedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return expires;
    });

    await createNotification(
        context.auth.uid,
        'giftcode',
        '🎁 Cod cadou activat!',
        'Codul tău cadou a fost activat cu succes. Bucură-te de acces PRO!'
    );

    return { success: true, expiresAt };
});

/**
 * Generate a gift code — restricted to the product owner (matches
 * isSuperAdmin() in firestore.rules). This is a manual-sale tool (e.g.
 * selling access over Instagram/WhatsApp before Stripe is live), not a
 * customer-facing referral feature, so there's no legitimate case for a
 * regular Pro user to mint codes for others.
 *
 * Universal by design — a code is not tied to any specific user at creation
 * time. redeemGiftCode grants it to whoever redeems it, first-come-first-served.
 * Optional `product` ('adFree' | 'academyPro' | 'bundle') makes the code grant
 * that specific product on redemption instead of the legacy blanket 'pro'.
 */
export const createGiftCode = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
    }
    assertSuperAdmin(context, 'generate gift codes');

    const days = data.days || 30;
    const product = data.product as string | undefined;
    const code = Math.random().toString(36).substring(2, 10).toUpperCase();

    await db.collection('gift_codes').doc(code).set({
        code,
        days,
        used: false,
        ...(product ? { product } : {}),
        createdBy: context.auth.uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await logAudit(context, 'create_gift_code', { code, product: product ?? null, days });
    return { success: true, code };
});

/**
 * SuperAdmin: list previously issued gift codes, newest first.
 *
 * gift_codes is readable by any signed-in user (redemption needs the lookup),
 * but listing the whole collection would hand every user a pile of unredeemed
 * codes — hence a superadmin-gated callable rather than a client-side query.
 */
export const listGiftCodes = functions.https.onCall(async (data, context) => {
    assertSuperAdmin(context, 'list gift codes');

    const limit = Math.min(Number(data?.limit) || 50, 200);
    const snap = await db.collection('gift_codes')
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();

    return {
        success: true,
        codes: snap.docs.map(d => {
            const c = d.data();
            return {
                code: d.id,
                product: c.product ?? null,
                days: c.days ?? null,
                used: c.used === true,
                usedBy: c.usedBy ?? null,
                createdAt: c.createdAt?.toDate ? c.createdAt.toDate().toISOString() : null,
                usedAt: c.usedAt?.toDate ? c.usedAt.toDate().toISOString() : null,
            };
        }),
    };
});

/**
 * SuperAdmin: recent entries from the admin audit trail (see logAudit above).
 */
export const listAuditLog = functions.https.onCall(async (data, context) => {
    assertSuperAdmin(context, 'view the audit log');

    const limit = Math.min(Number(data?.limit) || 50, 200);
    const snap = await db.collection('superadmin').doc('data').collection('audit_log')
        .orderBy('at', 'desc')
        .limit(limit)
        .get();

    return {
        success: true,
        entries: snap.docs.map(d => {
            const e = d.data();
            return {
                id: d.id,
                action: e.action,
                actorEmail: e.actorEmail ?? null,
                details: e.details ?? {},
                at: e.at?.toDate ? e.at.toDate().toISOString() : null,
            };
        }),
    };
});

/**
 * SuperAdmin: delete a gift code that has not been redeemed yet.
 */
export const deleteGiftCode = functions.https.onCall(async (data, context) => {
    assertSuperAdmin(context, 'delete gift codes');

    const { code } = data as { code?: string };
    if (!code || typeof code !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'code is required.');
    }

    const ref = db.collection('gift_codes').doc(code.toUpperCase());
    const snap = await ref.get();
    if (!snap.exists) {
        throw new functions.https.HttpsError('not-found', 'That code does not exist.');
    }
    if (snap.data()?.used) {
        throw new functions.https.HttpsError(
            'failed-precondition',
            'That code has already been redeemed and cannot be deleted.'
        );
    }

    await ref.delete();
    await logAudit(context, 'delete_gift_code', { code: code.toUpperCase() });
    return { success: true };
});

/**
 * Create a Stripe Checkout session for the caller's organization to
 * purchase one of 3 products. One-time payment (not a recurring subscription —
 * matches the "no hidden auto-renewal, pay once, 365 days" copy).
 *
 * Requires Stripe price IDs to be set via:
 *   firebase functions:config:set \
 *     stripe.secret="sk_live_..." \
 *     stripe.price_id_adfree="price_..." \
 *     stripe.price_id_academypro="price_..." \
 *     stripe.price_id_bundle="price_..." \
 *     stripe.webhook_secret="whsec_..."
 */
export const createCheckoutSession = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    }

    const { successUrl, cancelUrl, product } = data;
    if (!successUrl || !cancelUrl || !product) {
        throw new functions.https.HttpsError('invalid-argument', 'successUrl, cancelUrl, and product are required.');
    }

    const priceIdMap: Record<string, string | undefined> = {
        adFree: functions.config().stripe?.price_id_adfree,
        academyPro: functions.config().stripe?.price_id_academypro,
        bundle: functions.config().stripe?.price_id_bundle,
    };

    const priceId = priceIdMap[product];
    if (!priceId || !functions.config().stripe?.secret) {
        throw new functions.https.HttpsError('failed-precondition', 'Payments are not configured yet.');
    }

    const orgId = await getCallerOrgId(context.auth.uid);

    const session = await getStripe().checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        client_reference_id: orgId,
        customer_email: context.auth.token.email,
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: { product, uid: context.auth.uid },
    });

    return { url: session.url };
});

/**
 * Stripe Webhook to handle successful payments
 */
export const stripeWebhook = functions.https.onRequest(async (req, res) => {
    const sig = req.headers['stripe-signature'] as string;
    const endpointSecret = functions.config().stripe?.webhook_secret;

    let event;

    try {
        event = getStripe().webhooks.constructEvent(req.rawBody, sig, endpointSecret);
    } catch (err: any) {
        res.status(400).send(`Webhook Error: ${err.message}`);
        return;
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object as any;
        const orgId = session.client_reference_id;
        const product = session.metadata?.product || 'bundle';
        const buyerUid = session.metadata?.uid;

        if (orgId) {
            const expiresAt = new Date();
            expiresAt.setFullYear(expiresAt.getFullYear() + 1);

            const updateData: Record<string, any> = {
                subscriptionProduct: product,
                // The only source that counts as revenue in getAdminAnalytics:
                // real money, confirmed by a verified Stripe webhook.
                subscriptionSource: 'purchase',
                planExpires: admin.firestore.Timestamp.fromDate(expiresAt),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            };

            // Also set subscriptionTier='pro' for backwards compatibility with usePlan()
            if (product === 'academyPro' || product === 'bundle') {
                updateData.subscriptionTier = 'pro';
            }

            await db.collection('organizations').doc(orgId).update(updateData);

            if (buyerUid) {
                const productLabel = product === 'adFree' ? 'Fără Reclame' : product === 'academyPro' ? 'Academy PRO' : 'Acces Complet';
                await createNotification(
                    buyerUid,
                    'purchase',
                    '🎉 Achiziție reușită!',
                    `Acces "${productLabel}" activat pe contul tău. Mulțumim!`
                );
                await applyReferralBonus(buyerUid, orgId);
            }
        }
    }

    res.json({ received: true });
});

/**
 * Daily Weather Checker for Malu Mare / Craiova
 * Runs daily at 05:00 AM (Europe/Bucharest time)
 * Checks OpenWeather 5-day / 3-hour forecast API
 * If rain probability >= 50% and volume >= 5mm in next 24 hours, set wateringStatus to 'delayed_by_rain'
 */
export const weatherAlert = functions.pubsub.schedule('0 */3 * * *')
    .timeZone('Europe/Bucharest')
    .onRun(async (context) => {
        const apiKey = functions.config().openweather?.key;
        if (!apiKey) {
            console.error('openweather.key is not defined in functions config.');
            return null;
        }

        const lat = '44.2536';
        const lon = '23.8642';
        const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;

        try {
            const response = await (global as any).fetch(url);
            if (!response.ok) {
                throw new Error(`OpenWeather API responded with status ${response.status}`);
            }

            const data = (await response.json()) as any;
            const forecasts = data.list || [];

            // Examine the next 8 elements (24 hours) for rain alerts
            let maxPop = 0;
            let totalRain = 0;

            const next24h = forecasts.slice(0, 8);
            next24h.forEach((item: any) => {
                if (item.pop !== undefined && item.pop > maxPop) {
                    maxPop = item.pop;
                }
                if (item.rain && item.rain['3h'] !== undefined) {
                    totalRain += item.rain['3h'];
                }
            });

            const delayedByRain = maxPop >= 0.50 && totalRain >= 5;

            // Save the entire forecast data to the central document to optimize Firestore reads
            await db.collection('system').doc('craiova_weather').set({
                forecasts,
                maxPop,
                totalRain,
                delayedByRain,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            console.log(`Successfully cached Craiova weather to system doc. Rain delay: ${delayedByRain}`);

            // Perform a batch update on properties within Malu Mare/Craiova to synchronize statuses
            const propertiesSnap = await db.collection('properties').get();
            const batch = db.batch();
            let updatedCount = 0;

            propertiesSnap.docs.forEach((doc) => {
                const propData = doc.data();
                const address = (propData.address || '').toLowerCase();
                
                if (address.includes('malu mare') || address.includes('craiova')) {
                    const currentStatus = propData.wateringStatus;
                    const targetStatus = delayedByRain ? 'delayed_by_rain' : 'normal';

                    if (currentStatus !== targetStatus) {
                        batch.update(doc.ref, {
                            wateringStatus: targetStatus,
                            lastWeatherAlert: delayedByRain ? `Amânat de ploaie în Craiova: ${totalRain.toFixed(1)}mm` : null,
                            updatedAt: admin.firestore.FieldValue.serverTimestamp()
                        });
                        updatedCount++;
                    }
                }
            });

            if (updatedCount > 0) {
                await batch.commit();
                console.log(`Successfully updated ${updatedCount} properties' wateringStatus due to weather forecast change.`);
            }
        } catch (error) {
            console.error('Error running weatherAlert cron:', error);
        }

        return null;
    });

/**
 * Receive Telemetry HTTP Callable Function
 * Acts as a buffer for IoT smart controllers (2-Wire decoders & soil sensors)
 * Avoids unnecessary Firestore write operations to prevent exceeding free limits.
 * Only writes to DB if:
 * 1. A state change is detected (e.g. watering started/stopped or decoder status changed).
 * 2. Critical threshold crossed (e.g. humidity goes below 30% or above 70%).
 * 3. Heartbeat / Time-buffer (last save was more than 4 hours ago).
 */
export const receiveTelemetry = functions.https.onCall(async (data, context) => {
    const { propertyId, humidity, wateringActive, solenoidCurrentMa, decoderStatus } = data;

    if (!propertyId) {
        throw new functions.https.HttpsError('invalid-argument', 'propertyId is required.');
    }

    const propertyRef = db.collection('properties').doc(propertyId);
    const snap = await propertyRef.get();

    if (!snap.exists) {
        throw new functions.https.HttpsError('not-found', 'Property not found.');
    }

    const propData = snap.data() || {};
    const lastTelemetry = propData.lastTelemetry || {};

    const now = Date.now();
    const lastSavedTime = lastTelemetry.savedAt ? lastTelemetry.savedAt.toMillis() : 0;
    const hoursSinceLastSave = (now - lastSavedTime) / (1000 * 60 * 60);

    // Condition 1: State Change (watering active state toggled or decoder status changed)
    const stateChanged = 
        lastTelemetry.wateringActive !== wateringActive || 
        lastTelemetry.decoderStatus !== decoderStatus;

    // Condition 2: Critical Threshold Crossing (humidity crossed 30% or 70% threshold)
    const wasDry = lastTelemetry.humidity !== undefined && lastTelemetry.humidity < 30;
    const isDry = humidity !== undefined && humidity < 30;
    const wasWet = lastTelemetry.humidity !== undefined && lastTelemetry.humidity > 70;
    const isWet = humidity !== undefined && humidity > 70;
    const thresholdCrossed = (wasDry !== isDry) || (wasWet !== isWet);

    // Condition 3: Time-buffer (more than 4 hours since last telemetry write)
    const timeLimitExceeded = hoursSinceLastSave >= 4.0;

    const shouldWrite = stateChanged || thresholdCrossed || timeLimitExceeded || !lastTelemetry.savedAt;

    if (shouldWrite) {
        const telemetryPayload = {
            humidity: humidity !== undefined ? humidity : (lastTelemetry.humidity || null),
            wateringActive: wateringActive !== undefined ? wateringActive : (lastTelemetry.wateringActive || false),
            solenoidCurrentMa: solenoidCurrentMa !== undefined ? solenoidCurrentMa : (lastTelemetry.solenoidCurrentMa || 0),
            decoderStatus: decoderStatus || lastTelemetry.decoderStatus || 'OK',
            savedAt: admin.firestore.Timestamp.fromMillis(now)
        };

        // Update the main property document
        await propertyRef.update({
            lastTelemetry: telemetryPayload,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Add to historical subcollection for charting/analytics
        await propertyRef.collection('telemetry_history').add({
            ...telemetryPayload,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        return { success: true, status: 'written', stateChanged, thresholdCrossed, timeLimitExceeded };
    }

    return { success: true, status: 'buffered', reason: 'No state change or threshold crossed, within 4 hour heartbeat buffer.' };
});

/**
 * SuperAdmin: List all users (paginated)
 */
export const listAllUsers = functions.https.onCall(async (data, context) => {
    // Verify superadmin
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
    }
    assertSuperAdmin(context, 'list users');

    try {
        const usersSnap = await db.collection('users').get();
        const users = usersSnap.docs.map(doc => ({
            uid: doc.id,
            ...doc.data()
        }));

        return { success: true, users, count: users.length };
    } catch (err: any) {
        throw new functions.https.HttpsError('internal', 'Failed to list users: ' + err.message);
    }
});

/**
 * SuperAdmin: Create/update an advertisement
 */
export const createAd = functions.https.onCall(async (data, context) => {
    // Verify superadmin
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
    }
    assertSuperAdmin(context, 'create ads');

    const { title, imageUrl, link, company, discountPercent } = data;
    if (!title || !imageUrl || !link || !company) {
        throw new functions.https.HttpsError('invalid-argument', 'title, imageUrl, link, and company are required.');
    }

    try {
        const docRef = await db.collection('superadmin').doc('data').collection('ads').add({
            title,
            imageUrl,
            link,
            company,
            discountPercent: discountPercent || 0,
            isActive: true,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            createdBy: context.auth.uid,
        });

        return { success: true, adId: docRef.id };
    } catch (err: any) {
        throw new functions.https.HttpsError('internal', 'Failed to create ad: ' + err.message);
    }
});

/**
 * SuperAdmin: Update an existing advertisement (edit fields, toggle active state)
 */
export const updateAd = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
    }
    assertSuperAdmin(context, 'update ads');

    const { adId, title, imageUrl, link, company, discountPercent, isActive } = data;
    if (!adId) {
        throw new functions.https.HttpsError('invalid-argument', 'adId is required.');
    }

    const updateFields: Record<string, any> = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    if (title !== undefined) updateFields.title = title;
    if (imageUrl !== undefined) updateFields.imageUrl = imageUrl;
    if (link !== undefined) updateFields.link = link;
    if (company !== undefined) updateFields.company = company;
    if (discountPercent !== undefined) updateFields.discountPercent = discountPercent;
    if (isActive !== undefined) updateFields.isActive = isActive;

    try {
        await db.collection('superadmin').doc('data').collection('ads').doc(adId).update(updateFields);
        return { success: true };
    } catch (err: any) {
        throw new functions.https.HttpsError('internal', 'Failed to update ad: ' + err.message);
    }
});

/**
 * SuperAdmin: Update user subscription
 */
export const updateUserSubscription = functions.https.onCall(async (data, context) => {
    // Verify superadmin
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
    }
    assertSuperAdmin(context, 'update subscriptions');

    const { userId, product, expiresAt } = data;
    if (!userId || !product) {
        throw new functions.https.HttpsError('invalid-argument', 'userId and product are required.');
    }

    try {
        const expirationDate = expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        await db.collection('users').doc(userId).update({
            subscriptionProduct: product,
            subscriptionExpiresAt: admin.firestore.Timestamp.fromDate(new Date(expirationDate)),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return { success: true };
    } catch (err: any) {
        throw new functions.https.HttpsError('internal', 'Failed to update subscription: ' + err.message);
    }
});

/** The three sellable products. Anything else is rejected. */
const GRANTABLE_PRODUCTS = ['adFree', 'academyPro', 'bundle'] as const;
type GrantableProduct = typeof GRANTABLE_PRODUCTS[number];

/**
 * SuperAdmin: grant a product to a user for a fixed term (or for life).
 *
 * This replaces the old `/api/admin/grant-subscription` Express route, which
 * could never work: the dev server has no service-account credentials, so it
 * fell back to an *unauthenticated* client SDK write and every call died with
 * PERMISSION_DENIED.
 *
 * The write has to land on `organizations/{orgId}` — usePlan() resolves the
 * app-wide tier from the org document and never looks at users/{uid}, so a
 * grant written only to the user profile is invisible to every feature gate
 * in the app no matter how successful the write looks. We write both: the org
 * for entitlement, the user profile so the admin table can display it.
 */
export const grantSubscription = functions.https.onCall(async (data, context) => {
    assertSuperAdmin(context, 'grant subscriptions');

    const { userId, product, durationMonths } = data as {
        userId?: string;
        product?: GrantableProduct;
        durationMonths?: number | null;
    };

    if (!userId || typeof userId !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'userId is required.');
    }
    if (!product || !GRANTABLE_PRODUCTS.includes(product)) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            `product must be one of: ${GRANTABLE_PRODUCTS.join(', ')}.`
        );
    }
    // null means lifetime.
    if (durationMonths !== null && ![1, 3, 12].includes(durationMonths as number)) {
        throw new functions.https.HttpsError('invalid-argument', 'durationMonths must be 1, 3, 12, or null for lifetime.');
    }

    const userSnap = await db.collection('users').doc(userId).get();
    if (!userSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'That user no longer exists.');
    }
    const orgId: string | undefined = userSnap.data()?.organizationId;
    if (!orgId) {
        throw new functions.https.HttpsError(
            'failed-precondition',
            'That account has no organization, so there is nothing to attach the plan to.'
        );
    }

    const isLifetime = durationMonths === null;
    let expires: Date | null = null;
    if (!isLifetime) {
        expires = new Date();
        expires.setMonth(expires.getMonth() + (durationMonths as number));
    }

    // academyPro and bundle unlock the Pro feature set; adFree only removes
    // ads and deliberately leaves the tier alone. Lifetime uses the tier
    // usePlan() treats as never-expiring rather than a far-future date.
    const orgUpdate: Record<string, any> = {
        subscriptionProduct: product,
        // How this entitlement was obtained. Analytics counts revenue from
        // 'purchase' only — a plan the owner handed out for free is not money
        // in the bank, and counting it inflated the revenue figure.
        subscriptionSource: 'admin_grant',
        planExpires: expires ? admin.firestore.Timestamp.fromDate(expires) : null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (product === 'academyPro' || product === 'bundle') {
        orgUpdate.subscriptionTier = isLifetime ? 'lifetime' : 'pro';
    }

    const batch = db.batch();
    batch.set(db.collection('organizations').doc(orgId), orgUpdate, { merge: true });
    batch.update(db.collection('users').doc(userId), {
        subscriptionProduct: product,
        subscriptionExpiresAt: expires ? admin.firestore.Timestamp.fromDate(expires) : null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await batch.commit();

    const label = product === 'adFree' ? 'Fără reclame' : product === 'academyPro' ? 'Academy Pro' : 'Pachet complet';
    await createNotification(
        userId,
        'giftcode',
        '🎉 Abonament activat!',
        isLifetime
            ? `Ai primit ${label} pe viață. Bucură-te de acces complet!`
            : `Ai primit ${label} până la ${expires!.toLocaleDateString('ro-RO')}.`
    );

    console.log(`✓ Granted ${product} (${isLifetime ? 'lifetime' : durationMonths + 'mo'}) to ${userId} / org ${orgId}`);
    await logAudit(context, 'grant_subscription', {
        targetUid: userId,
        targetEmail: userSnap.data()?.email ?? null,
        product,
        durationMonths,
    });
    return {
        success: true,
        product,
        orgId,
        expiresAt: expires ? expires.toISOString() : null,
    };
});

/**
 * SuperAdmin: revoke whatever plan a user has, returning them to free.
 * Clears both the org entitlement and the mirrored user-profile fields.
 */
export const revokeSubscription = functions.https.onCall(async (data, context) => {
    assertSuperAdmin(context, 'revoke subscriptions');

    const { userId } = data as { userId?: string };
    if (!userId || typeof userId !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'userId is required.');
    }

    const userSnap = await db.collection('users').doc(userId).get();
    if (!userSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'That user no longer exists.');
    }
    const orgId: string | undefined = userSnap.data()?.organizationId;

    const batch = db.batch();
    if (orgId) {
        batch.set(db.collection('organizations').doc(orgId), {
            subscriptionTier: 'free',
            subscriptionProduct: admin.firestore.FieldValue.delete(),
            planExpires: null,
            isLifetime: false,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
    }
    batch.update(db.collection('users').doc(userId), {
        subscriptionProduct: admin.firestore.FieldValue.delete(),
        subscriptionExpiresAt: null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await batch.commit();

    console.log(`✓ Revoked subscription for ${userId} / org ${orgId ?? 'none'}`);
    await logAudit(context, 'revoke_subscription', {
        targetUid: userId,
        targetEmail: userSnap.data()?.email ?? null,
    });
    return { success: true, orgId: orgId ?? null };
});

/**
 * SuperAdmin: aggregate counts for the Analytics tab, computed server-side
 * over the org documents that actually hold entitlements. Doing this on the
 * client meant reading every organization doc just to render six numbers.
 */
export const getAdminAnalytics = functions.https.onCall(async (_data, context) => {
    assertSuperAdmin(context, 'view analytics');

    const [usersSnap, orgsSnap, codesSnap] = await Promise.all([
        db.collection('users').get(),
        db.collection('organizations').get(),
        db.collection('gift_codes').get(),
    ]);

    const orgById = new Map(orgsSnap.docs.map(d => [d.id, d.data()]));
    const now = Date.now();

    const counts: Record<string, number> = { adFree: 0, academyPro: 0, bundle: 0, legacyPaid: 0, free: 0 };
    // Same product split again, but only for entitlements that were actually
    // paid for. Everything the owner gave away (gift codes, manual grants)
    // is a real active user but zero revenue.
    const purchased: Record<string, number> = { adFree: 0, academyPro: 0, bundle: 0 };
    const bySource: Record<string, number> = { purchase: 0, gift: 0, admin_grant: 0 };
    // Signups over the last 12 months, oldest bucket first.
    const signupBuckets: { month: string; count: number }[] = [];
    for (let i = 11; i >= 0; i--) {
        const d = new Date();
        d.setDate(1);
        d.setMonth(d.getMonth() - i);
        signupBuckets.push({ month: d.toISOString().slice(0, 7), count: 0 });
    }
    const bucketIndex = new Map(signupBuckets.map((b, i) => [b.month, i]));

    for (const doc of usersSnap.docs) {
        const u = doc.data();
        const org = u.organizationId ? orgById.get(u.organizationId) : undefined;

        const createdAt = u.createdAt?.toDate ? u.createdAt.toDate() : (u.createdAt ? new Date(u.createdAt) : null);
        if (createdAt && !isNaN(createdAt.getTime())) {
            const idx = bucketIndex.get(createdAt.toISOString().slice(0, 7));
            if (idx !== undefined) signupBuckets[idx].count++;
        }

        if (u.email?.toLowerCase() === SUPERADMIN_EMAIL) continue;

        const expires = org?.planExpires?.toDate ? org.planExpires.toDate().getTime() : Infinity;
        const tier = org?.subscriptionTier;
        const expired = tier !== 'lifetime' && tier !== 'enterprise' && now > expires;
        const product = !expired ? (org?.subscriptionProduct ?? u.subscriptionProduct) : undefined;

        if (product && counts[product] !== undefined) {
            counts[product]++;
            // Anything predating subscriptionSource has no recorded origin.
            // Treat it as unpaid rather than inventing revenue for it.
            const source = org?.subscriptionSource ?? u.subscriptionSource;
            if (source && bySource[source] !== undefined) bySource[source]++;
            if (source === 'purchase') purchased[product]++;
        } else if (!expired && (tier === 'pro' || tier === 'enterprise' || tier === 'lifetime')) {
            counts.legacyPaid++;
        } else {
            counts.free++;
        }
    }

    // One-time prices, matching the pricing copy shown to customers.
    const PRICES: Record<string, number> = { adFree: 2, academyPro: 2, bundle: 3 };
    const revenue = Object.entries(purchased).reduce((sum, [k, n]) => sum + n * PRICES[k], 0);
    const paidCount = purchased.adFree + purchased.academyPro + purchased.bundle;
    // Active paid-tier accounts, however they got there — the audience number,
    // as opposed to the money number.
    const activePlans = counts.adFree + counts.academyPro + counts.bundle;

    return {
        success: true,
        totalUsers: usersSnap.size,
        ...counts,
        // Money actually collected, from verified Stripe purchases only.
        totalRevenue: revenue,
        paidCount,
        arpu: paidCount > 0 ? Number((revenue / paidCount).toFixed(2)) : 0,
        conversionRate: usersSnap.size > 0 ? Number(((paidCount / usersSnap.size) * 100).toFixed(1)) : 0,
        // Given away, not sold.
        activePlans,
        giftedCount: bySource.gift,
        grantedCount: bySource.admin_grant,
        purchasedByProduct: purchased,
        giftCodesTotal: codesSnap.size,
        giftCodesRedeemed: codesSnap.docs.filter(d => d.data().used).length,
        signups: signupBuckets,
    };
});

// Every collection a My Garden account can write into, and the field that
// scopes a document to it. Organization-scoped ones only get swept when the
// user is the org's sole owner (see isSoleOwner below) — a shared org's
// content must survive for whoever else is still a member. uid-scoped ones
// (the services/pf/* tools: zones, equipment, inventory, treatment log,
// maintenance tasks, marketplace listings, marketplace chat) belong to this
// person alone regardless of org membership, so they're always swept.
const ORG_SCOPED_COLLECTIONS = [
    'clients', 'visits', 'properties', 'service_types', 'products',
    'garden_tasks', 'garden_journal', 'client_history', 'user_plants',
    'expertValidations', 'invitations', 'invoices', 'audit_logs', 'leads',
];
const UID_SCOPED_COLLECTIONS: Array<{ name: string; field: string }> = [
    { name: 'pf_zones', field: 'uid' },
    { name: 'pf_equipment', field: 'uid' },
    { name: 'pf_products', field: 'uid' },
    { name: 'pf_treatments', field: 'uid' },
    { name: 'pf_tasks', field: 'uid' },
    { name: 'marketplace_items', field: 'sellerId' },
    { name: 'messages', field: 'senderId' },
];

async function deleteWhere(collectionName: string, field: string, value: string): Promise<number> {
    const snap = await db.collection(collectionName).where(field, '==', value).get();
    if (snap.empty) return 0;
    // Firestore batches cap at 500 writes; chunk defensively even though no
    // single My Garden account is likely to ever hit that.
    const chunks: FirebaseFirestore.QueryDocumentSnapshot[][] = [];
    for (let i = 0; i < snap.docs.length; i += 400) chunks.push(snap.docs.slice(i, i + 400));
    for (const chunk of chunks) {
        const batch = db.batch();
        chunk.forEach(d => batch.delete(d.ref));
        await batch.commit();
    }
    return snap.size;
}

/**
 * SuperAdmin: Permanently delete a user — every collection their My Garden
 * account could have written to (journal, calendar, garden setup, tool
 * logs, uploaded photos), their personal garden (if they're its sole
 * owner), their profile, and their Auth account.
 *
 * Every step is try/caught individually and logged rather than left to
 * bubble up, so one missing/already-gone document can't turn the whole
 * operation into an opaque "internal" error for the caller — the client
 * only ever sees a real HttpsError with a message that says what failed.
 */
export const deleteUserAccount = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
    }

    // This used to look for a doc in a `superadmins` collection that was never
    // created, so deletion failed for everyone, superadmin included.
    assertSuperAdmin(context, 'delete users');

    const { userId } = data;
    if (!userId || typeof userId !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'userId is required.');
    }
    if (userId === context.auth.uid) {
        throw new functions.https.HttpsError('failed-precondition', 'You cannot delete your own superadmin account.');
    }

    const deletedCounts: Record<string, number> = {};

    try {
        const userSnap = await db.collection('users').doc(userId).get();
        const orgId: string | undefined = userSnap.data()?.organizationId;
        let isSoleOwner = false;

        if (orgId) {
            try {
                const orgSnap = await db.collection('organizations').doc(orgId).get();
                isSoleOwner = orgSnap.exists && orgSnap.data()?.adminUid === userId;
            } catch (err) {
                console.error(`deleteUserAccount: failed to read organization ${orgId} for ${userId} (continuing):`, err);
            }
        }

        if (orgId && isSoleOwner) {
            // Fan out rather than awaiting 14 sweeps in series — each is an
            // independent query + batch round-trip, and sequentially they were
            // the bulk of a 15s deletion. Failures stay isolated per
            // collection: one missing index must not abort the rest.
            await Promise.all(ORG_SCOPED_COLLECTIONS.map(async collectionName => {
                try {
                    deletedCounts[collectionName] = await deleteWhere(collectionName, 'organizationId', orgId);
                } catch (err) {
                    console.error(`deleteUserAccount: failed to sweep ${collectionName} for org ${orgId} (continuing):`, err);
                }
            }));

            try {
                await db.collection('organizations').doc(orgId).delete();
            } catch (err) {
                console.error(`deleteUserAccount: failed to remove organization ${orgId} for ${userId} (continuing):`, err);
            }
        }

        await Promise.all(UID_SCOPED_COLLECTIONS.map(async ({ name, field }) => {
            try {
                deletedCounts[name] = await deleteWhere(name, field, userId);
            } catch (err) {
                console.error(`deleteUserAccount: failed to sweep ${name} for ${userId} (continuing):`, err);
            }
        }));

        try {
            const notifsSnap = await db.collection('users').doc(userId).collection('notifications').get();
            await Promise.all(notifsSnap.docs.map(d => d.ref.delete()));
            deletedCounts['notifications'] = notifsSnap.size;
        } catch (err) {
            console.error(`deleteUserAccount: failed to clear notifications for ${userId} (continuing):`, err);
        }

        // Uploaded photos live under uploads/{organizationId}/{uid}/... — the
        // entire prefix is this user's, whether or not they own the org.
        if (orgId) {
            try {
                const bucket = admin.storage().bucket();
                await bucket.deleteFiles({ prefix: `uploads/${orgId}/${userId}/` });
            } catch (err) {
                console.error(`deleteUserAccount: failed to remove storage files for ${userId} (continuing):`, err);
            }
        }

        try {
            await db.collection('user_settings').doc(userId).delete();
        } catch (err) {
            console.error(`deleteUserAccount: failed to remove user_settings for ${userId} (continuing):`, err);
        }

        try {
            await db.collection('users').doc(userId).delete();
        } catch (err) {
            console.error(`deleteUserAccount: failed to remove users/${userId} (continuing):`, err);
        }

        try {
            await admin.auth().deleteUser(userId);
        } catch (err: any) {
            // A missing Auth record (already deleted, or a Firestore-only test
            // profile) shouldn't fail the whole cleanup — the profile is gone either way.
            if (err?.code !== 'auth/user-not-found') {
                throw err;
            }
        }

        await logAudit(context, 'delete_user', {
            targetUid: userId,
            targetEmail: userSnap.data()?.email ?? null,
            deletedOrganization: !!(orgId && isSoleOwner),
        });
        return { success: true, deletedOrganization: !!(orgId && isSoleOwner), deletedCounts };
    } catch (err: any) {
        throw new functions.https.HttpsError('internal', 'Failed to delete user: ' + (err?.message || String(err)));
    }
});

/**
 * SuperAdmin: Seed default Romanian ads (one-time setup)
 */
export const seedDefaultAds = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
    }
    assertSuperAdmin(context, 'seed ads');

    const defaultAds = [
        {
            title: 'Semințe Premium pentru Gazon',
            company: 'GradinaPerfecta.ro',
            link: 'https://gradinaperfecta.ro?utm_source=mygarden&promo=GARDEN20',
            imageUrl: 'https://images.unsplash.com/photo-1464207687429-7505649dae38?w=400&q=80',
            discountPercent: 20,
            category: 'seeds'
        },
        {
            title: 'Îngrășământ Organic - 30% OFF',
            company: 'BioDelta.ro',
            link: 'https://biodelta.ro?utm_campaign=mygarden30',
            imageUrl: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400&q=80',
            discountPercent: 30,
            category: 'fertilizer'
        },
        {
            title: 'Unelte de Grădină Professional',
            company: 'ProTools.ro',
            link: 'https://amazon.ro/s?k=gardening+tools&tag=mygarden-20',
            imageUrl: 'https://images.unsplash.com/photo-1578654881325-8f95ea3cffe7?w=400&q=80',
            discountPercent: 15,
            category: 'tools',
            isAmazonAffiliate: true
        },
        {
            title: 'Sistem Irigare Inteligent',
            company: 'AquaSmart.ro',
            link: 'https://aquasmart.ro/sisteme-irigare?ref=mygarden',
            imageUrl: 'https://images.unsplash.com/photo-1584622281867-8fc18f4be5f4?w=400&q=80',
            discountPercent: 25,
            category: 'irrigation'
        },
        {
            title: 'Tratamente Ecologice - Fără Chimicale',
            company: 'NaturalCare.ro',
            link: 'https://naturalcare.ro/tratamente?promo=mygarden10',
            imageUrl: 'https://images.unsplash.com/photo-1574482620811-1aa16ffe3c82?w=400&q=80',
            discountPercent: 10,
            category: 'treatments'
        }
    ];

    try {
        const adsRef = db.collection('superadmin').doc('data').collection('ads');
        const batch = db.batch();

        for (const ad of defaultAds) {
            const docRef = adsRef.doc();
            batch.set(docRef, {
                ...ad,
                isActive: true,
                impressions: 0,
                clicks: 0,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                createdBy: context.auth.uid,
            });
        }

        await batch.commit();
        return { success: true, count: defaultAds.length };
    } catch (err: any) {
        throw new functions.https.HttpsError('internal', 'Failed to seed ads: ' + err.message);
    }
});

/**
 * Track ad impression (when ad is displayed)
 */
export const trackAdImpression = functions.https.onCall(async (data, context) => {
    const { adId } = data;
    if (!adId) {
        throw new functions.https.HttpsError('invalid-argument', 'adId is required.');
    }

    try {
        const adRef = db.collection('superadmin').doc('data').collection('ads').doc(adId);
        await adRef.update({
            impressions: admin.firestore.FieldValue.increment(1),
            lastImpressionAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { success: true };
    } catch (err: any) {
        console.error('Failed to track ad impression:', err);
        return { success: false }; // Don't throw, ad display shouldn't fail
    }
});

/**
 * Track ad click (when user clicks ad link)
 */
export const trackAdClick = functions.https.onCall(async (data, context) => {
    const { adId } = data;
    if (!adId) {
        throw new functions.https.HttpsError('invalid-argument', 'adId is required.');
    }

    try {
        const adRef = db.collection('superadmin').doc('data').collection('ads').doc(adId);
        await adRef.update({
            clicks: admin.firestore.FieldValue.increment(1),
            lastClickAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { success: true };
    } catch (err: any) {
        console.error('Failed to track ad click:', err);
        return { success: false };
    }
});

/**
 * Re-sync the owner account's `role: 'superadmin'` field.
 *
 * Authorization no longer depends on this field — every privileged callable
 * checks the signed token email via assertSuperAdmin — but firestore.rules
 * still accepts `role == 'superadmin'` as one way to satisfy isSuperAdmin(),
 * and a password reset can recreate the profile without it. Keeping the two
 * in sync avoids a confusing half-working panel.
 */
export const restoreSuperAdminRole = functions.https.onCall(async (data, context) => {
    assertSuperAdmin(context, 'restore the superadmin role');
    const uid = context.auth!.uid;

    try {
        await db.collection('users').doc(uid).update({
            role: 'superadmin',
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`✓ Superadmin role restored for ${context.auth!.token.email} (uid: ${uid})`);
        return { success: true, message: 'Superadmin role restored' };
    } catch (err: any) {
        console.error('Failed to restore superadmin role:', err);
        throw new functions.https.HttpsError('internal', 'Failed to restore superadmin role: ' + err.message);
    }
});
