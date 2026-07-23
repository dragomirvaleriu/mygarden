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
exports.trackAdClick = exports.trackAdImpression = exports.seedDefaultAds = exports.updateUserSubscription = exports.createAd = exports.listAllUsers = exports.receiveTelemetry = exports.weatherAlert = exports.stripeWebhook = exports.createCheckoutSession = exports.createGiftCode = exports.redeemGiftCode = exports.generateReferralCode = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const stripe_1 = __importDefault(require("stripe"));
__exportStar(require("./financials"), exports);
__exportStar(require("./billing"), exports);
var referrals_1 = require("./referrals");
Object.defineProperty(exports, "generateReferralCode", { enumerable: true, get: function () { return referrals_1.generateReferralCode; } });
const referrals_2 = require("./referrals");
admin.initializeApp();
const db = admin.firestore();
async function createNotification(uid, type, title, message) {
    try {
        await db.collection('users').doc(uid).collection('notifications').add({
            type,
            title,
            message,
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
    catch (err) {
        console.error('createNotification failed (non-fatal):', err);
    }
}
const stripeSecret = ((_a = functions.config().stripe) === null || _a === void 0 ? void 0 : _a.secret) || 'sk_test_placeholder';
const stripe = new stripe_1.default(stripeSecret, {
    apiVersion: '2022-11-15',
});
async function getCallerOrgId(uid) {
    var _a;
    const userSnap = await db.collection('users').doc(uid).get();
    const orgId = (_a = userSnap.data()) === null || _a === void 0 ? void 0 : _a.organizationId;
    if (!orgId) {
        throw new functions.https.HttpsError('failed-precondition', 'No organization found for this account.');
    }
    return orgId;
}
exports.redeemGiftCode = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    }
    const { code } = data;
    if (!code) {
        throw new functions.https.HttpsError('invalid-argument', 'Code is required.');
    }
    const giftCodeRef = db.collection('gift_codes').doc(code.toUpperCase());
    const orgId = await getCallerOrgId(context.auth.uid);
    const expiresAt = await db.runTransaction(async (tx) => {
        const snap = await tx.get(giftCodeRef);
        if (!snap.exists) {
            throw new functions.https.HttpsError('not-found', 'Invalid gift code.');
        }
        const giftData = snap.data();
        if (giftData === null || giftData === void 0 ? void 0 : giftData.used) {
            throw new functions.https.HttpsError('failed-precondition', 'Code already used.');
        }
        const durationDays = (giftData === null || giftData === void 0 ? void 0 : giftData.days) || 30;
        const expires = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
        const product = giftData === null || giftData === void 0 ? void 0 : giftData.product;
        const orgUpdate = {
            planExpires: admin.firestore.Timestamp.fromDate(expires),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        if (product) {
            orgUpdate.subscriptionProduct = product;
            if (product === 'academyPro' || product === 'bundle') {
                orgUpdate.subscriptionTier = 'pro';
            }
        }
        else {
            orgUpdate.subscriptionTier = 'pro';
        }
        tx.update(db.collection('organizations').doc(orgId), orgUpdate);
        tx.update(giftCodeRef, {
            used: true,
            usedBy: context.auth.uid,
            usedByOrg: orgId,
            usedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return expires;
    });
    await createNotification(context.auth.uid, 'giftcode', '🎁 Cod cadou activat!', 'Codul tău cadou a fost activat cu succes. Bucură-te de acces PRO!');
    return { success: true, expiresAt };
});
exports.createGiftCode = functions.https.onCall(async (data, context) => {
    if (!context.auth || context.auth.token.email !== 'dragomirvaleriu@gmail.com') {
        throw new functions.https.HttpsError('permission-denied', 'Only the product owner can generate gift codes.');
    }
    const days = data.days || 30;
    const product = data.product;
    const code = Math.random().toString(36).substring(2, 10).toUpperCase();
    await db.collection('gift_codes').doc(code).set(Object.assign(Object.assign({ code,
        days, used: false }, (product ? { product } : {})), { createdBy: context.auth.uid, createdAt: admin.firestore.FieldValue.serverTimestamp() }));
    return { success: true, code };
});
exports.createCheckoutSession = functions.https.onCall(async (data, context) => {
    var _a, _b, _c, _d;
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    }
    const { successUrl, cancelUrl, product } = data;
    if (!successUrl || !cancelUrl || !product) {
        throw new functions.https.HttpsError('invalid-argument', 'successUrl, cancelUrl, and product are required.');
    }
    const priceIdMap = {
        adFree: (_a = functions.config().stripe) === null || _a === void 0 ? void 0 : _a.price_id_adfree,
        academyPro: (_b = functions.config().stripe) === null || _b === void 0 ? void 0 : _b.price_id_academypro,
        bundle: (_c = functions.config().stripe) === null || _c === void 0 ? void 0 : _c.price_id_bundle,
    };
    const priceId = priceIdMap[product];
    if (!priceId || !((_d = functions.config().stripe) === null || _d === void 0 ? void 0 : _d.secret)) {
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
        metadata: { product, uid: context.auth.uid },
    });
    return { url: session.url };
});
exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
    var _a, _b, _c;
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
        const orgId = session.client_reference_id;
        const product = ((_b = session.metadata) === null || _b === void 0 ? void 0 : _b.product) || 'bundle';
        const buyerUid = (_c = session.metadata) === null || _c === void 0 ? void 0 : _c.uid;
        if (orgId) {
            const expiresAt = new Date();
            expiresAt.setFullYear(expiresAt.getFullYear() + 1);
            const updateData = {
                subscriptionProduct: product,
                planExpires: admin.firestore.Timestamp.fromDate(expiresAt),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            };
            if (product === 'academyPro' || product === 'bundle') {
                updateData.subscriptionTier = 'pro';
            }
            await db.collection('organizations').doc(orgId).update(updateData);
            if (buyerUid) {
                const productLabel = product === 'adFree' ? 'Fără Reclame' : product === 'academyPro' ? 'Academy PRO' : 'Acces Complet';
                await createNotification(buyerUid, 'purchase', '🎉 Achiziție reușită!', `Acces "${productLabel}" activat pe contul tău. Mulțumim!`);
                await (0, referrals_2.applyReferralBonus)(buyerUid, orgId);
            }
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
exports.listAllUsers = functions.https.onCall(async (data, context) => {
    if (!context.auth || context.auth.token.email !== 'dragomirvaleriu@gmail.com') {
        throw new functions.https.HttpsError('permission-denied', 'Only superadmin can list users.');
    }
    try {
        const usersSnap = await db.collection('users').get();
        const users = usersSnap.docs.map(doc => (Object.assign({ uid: doc.id }, doc.data())));
        return { success: true, users, count: users.length };
    }
    catch (err) {
        throw new functions.https.HttpsError('internal', 'Failed to list users: ' + err.message);
    }
});
exports.createAd = functions.https.onCall(async (data, context) => {
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
    }
    catch (err) {
        throw new functions.https.HttpsError('internal', 'Failed to create ad: ' + err.message);
    }
});
exports.updateUserSubscription = functions.https.onCall(async (data, context) => {
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
    }
    catch (err) {
        throw new functions.https.HttpsError('internal', 'Failed to update subscription: ' + err.message);
    }
});
exports.seedDefaultAds = functions.https.onCall(async (data, context) => {
    if (!context.auth || context.auth.token.email !== 'dragomirvaleriu@gmail.com') {
        throw new functions.https.HttpsError('permission-denied', 'Only superadmin can seed ads.');
    }
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
            batch.set(docRef, Object.assign(Object.assign({}, ad), { isActive: true, impressions: 0, clicks: 0, createdAt: admin.firestore.FieldValue.serverTimestamp(), createdBy: context.auth.uid }));
        }
        await batch.commit();
        return { success: true, count: defaultAds.length };
    }
    catch (err) {
        throw new functions.https.HttpsError('internal', 'Failed to seed ads: ' + err.message);
    }
});
exports.trackAdImpression = functions.https.onCall(async (data, context) => {
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
    }
    catch (err) {
        console.error('Failed to track ad impression:', err);
        return { success: false };
    }
});
exports.trackAdClick = functions.https.onCall(async (data, context) => {
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
    }
    catch (err) {
        console.error('Failed to track ad click:', err);
        return { success: false };
    }
});
//# sourceMappingURL=index.js.map