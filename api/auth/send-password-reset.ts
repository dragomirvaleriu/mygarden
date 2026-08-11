import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import nodemailer from "nodemailer";
import firebaseConfig from "../../firebase-applet-config.json";

// Self-contained — see send-verification-code.ts for why (cross-file
// api/_lib import 500'd in production with ERR_MODULE_NOT_FOUND).
function getAdminApp() {
  if (getApps().length) return getApps()[0];
  const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (key) {
    return initializeApp({ credential: cert(JSON.parse(key)), projectId: firebaseConfig.projectId });
  }
  console.warn("[api] FIREBASE_SERVICE_ACCOUNT_KEY not set — Admin SDK calls will fail.");
  return initializeApp({ projectId: firebaseConfig.projectId });
}
const adminAuth = getAuth(getAdminApp());

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

// Password reset via our own verified Brevo sender instead of Firebase
// Auth's built-in email, which sends from a generic *.firebaseapp.com
// address shared by every Firebase project and reliably lands in spam.
// No auth required — the user isn't signed in when they've forgotten their
// password, same as the endpoint it replaces.
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email } = req.body || {};
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: "Email required" });
  }

  const genericResponse = { sent: true };

  try {
    const actionCodeSettings = {
      url: `${process.env.APP_URL || 'https://gradinamea.vercel.app'}/#reset-password`,
      handleCodeInApp: true
    };
    const link = await adminAuth.generatePasswordResetLink(email.trim().toLowerCase(), actionCodeSettings);
    await sendTransactionalEmail(
      email,
      "Resetează parola My Garden",
      `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color:#4A7C59;">My Garden</h2>
          <p>Ai cerut resetarea parolei. Apasă pe linkul de mai jos pentru a-ți seta o parolă nouă:</p>
          <p><a href="${link}" style="display:inline-block; background:#4A7C59; color:#fff; padding:12px 24px; border-radius:6px; text-decoration:none; font-weight:bold;">Resetează parola</a></p>
          <p style="color:#666; font-size: 13px;">Dacă nu ai cerut acest lucru, poți ignora acest email — parola ta rămâne neschimbată.</p>
        </div>
      `
    );
  } catch (err: any) {
    if (err?.code !== 'auth/user-not-found') {
      console.error("Send password reset error:", err);
    }
  }

  res.status(200).json(genericResponse);
}
