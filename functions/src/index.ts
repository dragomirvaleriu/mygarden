import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';

export * from './financials';
export * from './billing';

admin.initializeApp();
const db = admin.firestore();

// Initialize Stripe (User will need to set this config via firebase functions:config:set stripe.secret=...)
const stripeSecret = functions.config().stripe?.secret || 'sk_test_placeholder';
const stripe = new Stripe(stripeSecret, {
    apiVersion: '2022-11-15',
});

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

        tx.update(db.collection('organizations').doc(orgId), {
            subscriptionTier: 'pro',
            planExpires: admin.firestore.Timestamp.fromDate(expires),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        tx.update(giftCodeRef, {
            used: true,
            usedBy: context.auth!.uid,
            usedByOrg: orgId,
            usedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return expires;
    });

    return { success: true, expiresAt };
});

/**
 * Generate a gift code — restricted to the product owner (matches
 * isSuperAdmin() in firestore.rules). This is a manual-sale tool (e.g.
 * selling access over Instagram/WhatsApp before Stripe is live), not a
 * customer-facing referral feature, so there's no legitimate case for a
 * regular Pro user to mint codes for others.
 */
export const createGiftCode = functions.https.onCall(async (data, context) => {
    if (!context.auth || context.auth.token.email !== 'dragomirvaleriu@gmail.com') {
        throw new functions.https.HttpsError('permission-denied', 'Only the product owner can generate gift codes.');
    }

    const days = data.days || 30;
    const code = Math.random().toString(36).substring(2, 10).toUpperCase();

    await db.collection('gift_codes').doc(code).set({
        code,
        days,
        used: false,
        createdBy: context.auth.uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true, code };
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

    const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        client_reference_id: orgId,
        customer_email: context.auth.token.email,
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: { product },
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
        event = stripe.webhooks.constructEvent(req.rawBody, sig, endpointSecret);
    } catch (err: any) {
        res.status(400).send(`Webhook Error: ${err.message}`);
        return;
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object as any;
        const orgId = session.client_reference_id;
        const product = session.metadata?.product || 'bundle';

        if (orgId) {
            const expiresAt = new Date();
            expiresAt.setFullYear(expiresAt.getFullYear() + 1);

            const updateData: Record<string, any> = {
                subscriptionProduct: product,
                planExpires: admin.firestore.Timestamp.fromDate(expiresAt),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            };

            // Also set subscriptionTier='pro' for backwards compatibility with usePlan()
            if (product === 'academyPro' || product === 'bundle') {
                updateData.subscriptionTier = 'pro';
            }

            await db.collection('organizations').doc(orgId).update(updateData);
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
 * SuperAdmin: Create a gift code for a specific product
 */
export const createGiftCodeForProduct = functions.https.onCall(async (data, context) => {
    // Verify superadmin
    if (!context.auth || context.auth.token.email !== 'dragomirvaleriu@gmail.com') {
        throw new functions.https.HttpsError('permission-denied', 'Only superadmin can create gift codes.');
    }

    const { userId, product, days = 30 } = data;
    if (!userId || !product) {
        throw new functions.https.HttpsError('invalid-argument', 'userId and product are required.');
    }

    const code = Math.random().toString(36).substring(2, 10).toUpperCase();

    try {
        await db.collection('gift_codes').doc(code).set({
            code,
            product,
            days,
            used: false,
            createdBy: context.auth.uid,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return { success: true, code };
    } catch (err: any) {
        throw new functions.https.HttpsError('internal', 'Failed to create gift code: ' + err.message);
    }
});

/**
 * SuperAdmin: List all users (paginated)
 */
export const listAllUsers = functions.https.onCall(async (data, context) => {
    // Verify superadmin
    if (!context.auth || context.auth.token.email !== 'dragomirvaleriu@gmail.com') {
        throw new functions.https.HttpsError('permission-denied', 'Only superadmin can list users.');
    }

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
    if (!context.auth || context.auth.token.email !== 'dragomirvaleriu@gmail.com') {
        throw new functions.https.HttpsError('permission-denied', 'Only superadmin can create ads.');
    }

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
 * SuperAdmin: Update user subscription
 */
export const updateUserSubscription = functions.https.onCall(async (data, context) => {
    // Verify superadmin
    if (!context.auth || context.auth.token.email !== 'dragomirvaleriu@gmail.com') {
        throw new functions.https.HttpsError('permission-denied', 'Only superadmin can update subscriptions.');
    }

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
