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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.receiveTelemetry = exports.weatherAlert = exports.stripeWebhook = exports.createGiftCode = exports.redeemGiftCode = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const stripe_1 = __importDefault(require("stripe"));
__exportStar(require("./financials"), exports);
__exportStar(require("./billing"), exports);
admin.initializeApp();
const db = admin.firestore();
const stripeSecret = ((_a = functions.config().stripe) === null || _a === void 0 ? void 0 : _a.secret) || 'sk_test_placeholder';
const stripe = new stripe_1.default(stripeSecret, {
    apiVersion: '2022-11-15',
});
exports.redeemGiftCode = functions.https.onCall(async (data, context) => {
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
    if (giftData === null || giftData === void 0 ? void 0 : giftData.used) {
        throw new functions.https.HttpsError('failed-precondition', 'Code already used.');
    }
    const now = Date.now();
    const durationDays = (giftData === null || giftData === void 0 ? void 0 : giftData.days) || 30;
    const expiresAt = new Date(now + durationDays * 24 * 60 * 60 * 1000);
    await db.collection('users').doc(context.auth.uid).update({
        plan: 'pro',
        planExpires: admin.firestore.Timestamp.fromDate(expiresAt),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await giftCodeRef.update({
        used: true,
        usedBy: context.auth.uid,
        usedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { success: true, expiresAt };
});
exports.createGiftCode = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Admin must be logged in.');
    }
    const userSnap = await db.collection('users').doc(context.auth.uid).get();
    const userData = userSnap.data();
    if ((userData === null || userData === void 0 ? void 0 : userData.role) !== 'admin' || (userData === null || userData === void 0 ? void 0 : userData.plan) !== 'pro') {
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
exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
    var _a;
    const sig = req.headers['stripe-signature'];
    const endpointSecret = (_a = functions.config().stripe) === null || _a === void 0 ? void 0 : _a.webhook_secret;
    let event;
    try {
        event = stripe.webhooks.constructEvent(req.rawBody, sig, endpointSecret);
    }
    catch (err) {
        res.status(400).send(`Webhook Error: ${err.message}`);
        return;
    }
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const userId = session.client_reference_id;
        if (userId) {
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
exports.weatherAlert = functions.pubsub.schedule('0 */3 * * *')
    .timeZone('Europe/Bucharest')
    .onRun(async (context) => {
    var _a;
    const apiKey = (_a = functions.config().openweather) === null || _a === void 0 ? void 0 : _a.key;
    if (!apiKey) {
        console.error('openweather.key is not defined in functions config.');
        return null;
    }
    const lat = '44.2536';
    const lon = '23.8642';
    const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
    try {
        const response = await global.fetch(url);
        if (!response.ok) {
            throw new Error(`OpenWeather API responded with status ${response.status}`);
        }
        const data = (await response.json());
        const forecasts = data.list || [];
        let maxPop = 0;
        let totalRain = 0;
        const next24h = forecasts.slice(0, 8);
        next24h.forEach((item) => {
            if (item.pop !== undefined && item.pop > maxPop) {
                maxPop = item.pop;
            }
            if (item.rain && item.rain['3h'] !== undefined) {
                totalRain += item.rain['3h'];
            }
        });
        const delayedByRain = maxPop >= 0.50 && totalRain >= 5;
        await db.collection('system').doc('craiova_weather').set({
            forecasts,
            maxPop,
            totalRain,
            delayedByRain,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`Successfully cached Craiova weather to system doc. Rain delay: ${delayedByRain}`);
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
    }
    catch (error) {
        console.error('Error running weatherAlert cron:', error);
    }
    return null;
});
exports.receiveTelemetry = functions.https.onCall(async (data, context) => {
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
    const stateChanged = lastTelemetry.wateringActive !== wateringActive ||
        lastTelemetry.decoderStatus !== decoderStatus;
    const wasDry = lastTelemetry.humidity !== undefined && lastTelemetry.humidity < 30;
    const isDry = humidity !== undefined && humidity < 30;
    const wasWet = lastTelemetry.humidity !== undefined && lastTelemetry.humidity > 70;
    const isWet = humidity !== undefined && humidity > 70;
    const thresholdCrossed = (wasDry !== isDry) || (wasWet !== isWet);
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
        await propertyRef.update({
            lastTelemetry: telemetryPayload,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        await propertyRef.collection('telemetry_history').add(Object.assign(Object.assign({}, telemetryPayload), { timestamp: admin.firestore.FieldValue.serverTimestamp() }));
        return { success: true, status: 'written', stateChanged, thresholdCrossed, timeLimitExceeded };
    }
    return { success: true, status: 'buffered', reason: 'No state change or threshold crossed, within 4 hour heartbeat buffer.' };
});
//# sourceMappingURL=index.js.map