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

/**
 * Redeem a gift code to upgrade user to Pro
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
    const snap = await giftCodeRef.get();

    if (!snap.exists) {
        throw new functions.https.HttpsError('not-found', 'Invalid gift code.');
    }

    const giftData = snap.data();
    if (giftData?.used) {
        throw new functions.https.HttpsError('failed-precondition', 'Code already used.');
    }

    const now = Date.now();
    const durationDays = giftData?.days || 30;
    const expiresAt = new Date(now + durationDays * 24 * 60 * 60 * 1000);

    // Update user profile
    await db.collection('users').doc(context.auth.uid).update({
        plan: 'pro',
        planExpires: admin.firestore.Timestamp.fromDate(expiresAt),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Mark code as used
    await giftCodeRef.update({
        used: true,
        usedBy: context.auth.uid,
        usedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true, expiresAt };
});

/**
 * Generate a gift code (Admin Pro only)
 */
export const createGiftCode = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Admin must be logged in.');
    }

    // Check if user is admin and pro
    const userSnap = await db.collection('users').doc(context.auth.uid).get();
    const userData = userSnap.data();
    if (userData?.role !== 'admin' || userData?.plan !== 'pro') {
        throw new functions.https.HttpsError('permission-denied', 'Only Pro Admins can generate codes.');
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
        const userId = session.client_reference_id;

        if (userId) {
            // Upgrade user for 1 year (or based on product)
            const expiresAt = new Date();
            expiresAt.setFullYear(expiresAt.getFullYear() + 1);

            await db.collection('users').doc(userId).update({
                plan: 'pro',
                planExpires: admin.firestore.Timestamp.fromDate(expiresAt),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
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
