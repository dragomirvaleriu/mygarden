import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import nodemailer from "nodemailer";
import firebaseConfig from "../../firebase-applet-config.json";

// Self-contained (no shared api/_lib import) — a cross-file relative import
// here (api/_lib/authAdmin) 500'd in production with ERR_MODULE_NOT_FOUND;
// Vercel's per-function bundling didn't pick up the _lib file even though
// it built without error locally. Small enough to just duplicate across the
// 4 auth functions rather than fight the bundler further.
function getAdminApp() {
  if (getApps().length) return getApps()[0];
  const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (key) {
    return initializeApp({ credential: cert(JSON.parse(key)), projectId: firebaseConfig.projectId });
  }
  console.warn("[api] FIREBASE_SERVICE_ACCOUNT_KEY not set — Admin SDK calls will fail.");
  return initializeApp({ projectId: firebaseConfig.projectId });
}
const adminApp = getAdminApp();
const adminAuth = getAuth(adminApp);

function getDbAdmin() {
  try {
    return firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
      ? getFirestore(adminApp, firebaseConfig.firestoreDatabaseId)
      : getFirestore(adminApp);
  } catch (e) {
    console.error("[api] Could not get Firestore Admin instance:", e);
    return null;
  }
}

async function requireAuth(req: any): Promise<{ uid: string; email: string | null } | null> {
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

const VERIFICATION_CODE_TTL_MS = 10 * 60 * 1000;
const VERIFICATION_RESEND_COOLDOWN_MS = 60 * 1000;

function generateVerificationCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

const VERIFIED_SENDER = { name: 'My Garden', email: 'dragomirvaleriu@gmail.com' };
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp-relay.brevo.com",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER || "a39e5c001@smtp-brevo.com",
    pass: process.env.SMTP_PASS || "vh9H0czrXESJdUja",
  },
});

async function sendTransactionalEmail(to: string, subject: string, html: string) {
  const apiKey = process.env.BREVO_API_KEY || process.env.VITE_BREVO_API_KEY;
  if (apiKey) {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'accept': 'application/json', 'api-key': apiKey, 'content-type': 'application/json' },
      body: JSON.stringify({ sender: VERIFIED_SENDER, to: [{ email: to }], subject, htmlContent: html })
    });
    if (!res.ok) throw new Error(`Brevo API error: ${res.status} - ${await res.text().catch(() => '')}`);
    return;
  }
  await transporter.sendMail({ from: process.env.SMTP_FROM || `"${VERIFIED_SENDER.name}" <${VERIFIED_SENDER.email}>`, to, subject, html });
}

// Sends a fresh 6-digit code to the account's own email (from the verified
// ID token, never the request body) and stores it in Firestore for
// verify-code.ts to check. Signup only blocks on this — existing accounts
// created before this feature shipped are unaffected since they already
// have organizationId set and never hit this path.
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireAuth(req);
  if (!user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  if (!user.email) {
    return res.status(400).json({ error: "Token has no associated email" });
  }

  const dbAdmin = getDbAdmin();
  if (!dbAdmin) {
    return res.status(503).json({ error: "Verification service unavailable" });
  }

  try {
    const verifRef = dbAdmin.collection('emailVerifications').doc(user.uid);
    const existing = await verifRef.get();
    if (existing.exists) {
      const data = existing.data();
      const createdAtMs = data?.createdAt?.toMillis ? data.createdAt.toMillis() : 0;
      const elapsed = Date.now() - createdAtMs;
      if (elapsed < VERIFICATION_RESEND_COOLDOWN_MS) {
        return res.status(429).json({
          error: "Please wait before requesting another code",
          waitSeconds: Math.ceil((VERIFICATION_RESEND_COOLDOWN_MS - elapsed) / 1000)
        });
      }
    }

    const code = generateVerificationCode();
    await verifRef.set({
      code,
      email: user.email.toLowerCase(),
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + VERIFICATION_CODE_TTL_MS),
      attempts: 0
    });

    await sendTransactionalEmail(
      user.email,
      "Codul tău de verificare My Garden",
      `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color:#4A7C59;">My Garden</h2>
          <p>Codul tău de verificare este:</p>
          <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1a1a1a;">${code}</p>
          <p style="color:#666; font-size: 13px;">Codul expiră în 10 minute. Dacă nu ai cerut acest cod, poți ignora acest email.</p>
        </div>
      `
    );

    res.status(200).json({ sent: true });
  } catch (err: any) {
    console.error("Send verification code error:", err);
    res.status(500).json({ error: "Could not send verification code" });
  }
}
