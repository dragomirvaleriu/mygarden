// Shared by every function under api/auth/* — kept in _lib (not routable by
// Vercel's file-based routing) since none of this is itself an endpoint.
// This mirrors server.ts's equivalent setup, which only runs during local
// dev (`npm run dev`) — Vercel's production build never executes server.ts
// at all, it only wires up individual files directly under api/. Firebase
// Admin here uses a real service account (FIREBASE_SERVICE_ACCOUNT_KEY),
// unlike server.ts's local-dev applicationDefault()/projectId-only fallback,
// because Vercel's serverless runtime has no ambient GCP credentials the
// way Cloud Run/Cloud Functions would.
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import nodemailer from "nodemailer";
import firebaseConfig from "../../firebase-applet-config.json";

function getAdminApp() {
  if (getApps().length) return getApps()[0];

  const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (key) {
    return initializeApp({
      credential: cert(JSON.parse(key)),
      projectId: firebaseConfig.projectId
    });
  }

  console.warn("[api] FIREBASE_SERVICE_ACCOUNT_KEY not set — Admin SDK calls (verifyIdToken, generatePasswordResetLink, Firestore) will fail.");
  return initializeApp({ projectId: firebaseConfig.projectId });
}

export const adminApp = getAdminApp();
export const adminAuth = getAuth(adminApp);

let _dbAdmin: FirebaseFirestore.Firestore | null = null;
export function getDbAdmin() {
  if (_dbAdmin) return _dbAdmin;
  try {
    _dbAdmin = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
      ? getFirestore(adminApp, firebaseConfig.firestoreDatabaseId)
      : getFirestore(adminApp);
    return _dbAdmin;
  } catch (e) {
    console.error("[api] Could not get Firestore Admin instance:", e);
    return null;
  }
}

export async function requireAuth(req: any): Promise<{ uid: string; email: string | null } | null> {
  const authHeader = req.headers?.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
  if (!token) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return { uid: decoded.uid, email: decoded.email || null };
  } catch {
    return null;
  }
}

// ---- 6-digit verification codes ----
export const VERIFICATION_CODE_TTL_MS = 10 * 60 * 1000;
export const VERIFICATION_RESEND_COOLDOWN_MS = 60 * 1000;
export const VERIFICATION_MAX_ATTEMPTS = 5;

export function generateVerificationCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// ---- Outbound mail ----
// "My company <dragomirvaleriu@gmail.com>" is the only verified sender in
// the Brevo account backing these credentials (confirmed via the Brevo
// dashboard — zero domains configured there) — see server.ts's identical
// comment for the fuller story of how the previous sender address
// (no-reply@landscapeos.com, never actually verified) silently swallowed
// every send instead of bouncing.
const VERIFIED_SENDER = { name: 'My Garden', email: 'dragomirvaleriu@gmail.com' };

const smtpConfig = {
  host: process.env.SMTP_HOST || "smtp-relay.brevo.com",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER || "a39e5c001@smtp-brevo.com",
    pass: process.env.SMTP_PASS || "vh9H0czrXESJdUja",
  },
};
const transporter = nodemailer.createTransport(smtpConfig);

export async function sendTransactionalEmail(to: string, subject: string, html: string): Promise<{ via: 'brevo-api' | 'smtp' }> {
  const apiKey = process.env.BREVO_API_KEY || process.env.VITE_BREVO_API_KEY;
  if (apiKey) {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'accept': 'application/json', 'api-key': apiKey, 'content-type': 'application/json' },
      body: JSON.stringify({
        sender: VERIFIED_SENDER,
        to: [{ email: to }],
        subject,
        htmlContent: html
      })
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`Brevo API error: ${res.status} - ${errBody}`);
    }
    return { via: 'brevo-api' };
  }

  await transporter.sendMail({
    from: process.env.SMTP_FROM || `"${VERIFIED_SENDER.name}" <${VERIFIED_SENDER.email}>`,
    to,
    subject,
    html
  });
  return { via: 'smtp' };
}
