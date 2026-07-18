import admin from 'firebase-admin';
import crypto from 'crypto';

// Inițializare Firebase Admin dacă nu a fost deja realizată
const apps = (admin as any).apps || [];
if (!apps.length) {
  admin.initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID || 'landscapeos-c3701'
  });
}
const db = admin.firestore();

const WINDOW_MS = 15 * 60 * 1000; // Fereastră de 15 minute
const MAX_REQUESTS = 5; // Maxim 5 invitații permise per fereastră

/**
 * Verifică și aplică rate-limiting pe baza adresei IP a clientului.
 * Folosește Firestore pentru stocarea stării distribuite, funcționând perfect în
 * serverless (Vercel) și pe servere Express, fără a necesita setup complex de Redis.
 * Pentru conformitate GDPR, IP-ul este hashed cu SHA-256 înainte de salvare.
 * 
 * @param ipAddress Adresa IP a clientului (ex: req.headers['x-forwarded-for'] sau req.ip)
 * @returns Promise<boolean> true dacă utilizatorul a depășit limita (429), false dacă este permis.
 */
export async function isRateLimited(ipAddress: string): Promise<boolean> {
  if (!ipAddress) return false;

  const ipHash = crypto.createHash('sha256').update(ipAddress).digest('hex');
  const docRef = db.collection('rate_limits').doc(ipHash);

  try {
    const docSnap = await docRef.get();
    const now = Date.now();

    if (!docSnap.exists) {
      await docRef.set({
        count: 1,
        windowStart: admin.firestore.Timestamp.fromMillis(now),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return false;
    }

    const data = docSnap.data();
    const windowStartMs = data?.windowStart?.toMillis() || now;
    const count = data?.count || 0;

    if (now - windowStartMs < WINDOW_MS) {
      if (count >= MAX_REQUESTS) {
        return true;
      }

      await docRef.update({
        count: count + 1,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return false;
    } else {
      await docRef.set({
        count: 1,
        windowStart: admin.firestore.Timestamp.fromMillis(now),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return false;
    }
  } catch (error) {
    console.error('[RATE-LIMIT] Eroare la verificarea rate limit-ului în Firestore:', error);
    return false;
  }
}
