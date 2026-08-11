import express from "express";
import { createServer as createViteServer } from "vite";

console.log("My Garden: server.ts is starting...");

import dotenv from "dotenv";
import nodemailer from "nodemailer";
import { initializeApp as initializeAdminApp, getApps, getApp, applicationDefault } from "firebase-admin/app";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import firebaseConfig from "./firebase-applet-config.json";
import { formatInTimeZone } from 'date-fns-tz';
import { AiDiagnosisRequestSchema, AiDiagnosisResponseSchema } from "./src/schemas/aiDiagnosis";
import Anthropic from "@anthropic-ai/sdk";
import { getAuth } from "firebase-admin/auth";
import { ARTICLES_RO, ARTICLES_EN } from "./src/data/academyContent";
import fs from "fs/promises";
import path from "path";

dotenv.config();

// Initialize Firebase Client SDK (for some API routes if needed, though admin is better)
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

// Initialize Firebase Admin SDK for server-side tasks
let adminApp: any;
let dbAdmin: any;

try {
  // Only try applicationDefault if GOOGLE_APPLICATION_CREDENTIALS is set
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    if (!getApps().length) {
      adminApp = initializeAdminApp({
        credential: applicationDefault(),
        projectId: firebaseConfig.projectId
      });
      console.log("[ADMIN] Firebase Admin initialized with GOOGLE_APPLICATION_CREDENTIALS");
    } else {
      adminApp = getApp();
    }
  } else {
    // Fallback/Default for local dev
    if (!getApps().length) {
      adminApp = initializeAdminApp({
        projectId: firebaseConfig.projectId
      });
      console.log("[ADMIN] Firebase Admin initialized with projectId only (local dev fallback)");
    } else {
      adminApp = getApp();
    }
  }
} catch (err: any) {
  console.error("[ADMIN] Failed to initialize Firebase Admin SDK:", err.message);
}

// Initialize Firestore Admin
try {
  if (adminApp && process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    dbAdmin = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
      ? getAdminFirestore(adminApp, firebaseConfig.firestoreDatabaseId)
      : getAdminFirestore(adminApp);
    console.log("[FIRESTORE] Admin Firestore initialized with credentials");
  } else {
    console.warn("[FIRESTORE] Firestore Admin requires GOOGLE_APPLICATION_CREDENTIALS env var. API routes needing DB will fail gracefully.");
    dbAdmin = null;
  }
} catch (err: any) {
  console.warn("[FIRESTORE] Could not initialize Firestore Admin:", err.message);
  dbAdmin = null;
}

// Firestore Health Check
async function checkFirestoreHealth() {
  if (!dbAdmin) {
    console.warn("[FIRESTORE] Skipping health check as Firestore Admin is not initialized.");
    return;
  }
  try {
    // Try to list collections to verify permissions
    const collections = await dbAdmin.listCollections();
    console.log("[FIRESTORE] Admin connection verified. Collections:", collections.map((c: any) => c.id).join(", "));
  } catch (err: any) {
    console.error("[FIRESTORE] Admin connection check failed. This usually indicates missing IAM permissions or credentials.");
    console.error("[FIRESTORE] Error details:", err.message);
  }
}

// Use provided SMTP credentials or environment variables
const smtpConfig = {
  host: process.env.SMTP_HOST || "smtp-relay.brevo.com",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER || "a39e5c001@smtp-brevo.com",
    pass: process.env.SMTP_PASS || "vh9H0czrXESJdUja",
  },
};

const transporter = nodemailer.createTransport(smtpConfig);

// Verified in the Brevo dashboard (Senders, Domains & Dedicated IPs →
// Senders): "My company <dragomirvaleriu@gmail.com>" is the ONLY verified
// sender on this account — zero domains are configured there at all. Every
// earlier attempt used no-reply@landscapeos.com, an address never added as
// a sender, which is exactly why Brevo accepted the mail (250 OK) but never
// actually delivered it. REST API tried first (same account, separate
// credential from SMTP_USER/SMTP_PASS); raw SMTP relay as fallback.
const VERIFIED_SENDER = { name: 'My Garden', email: 'dragomirvaleriu@gmail.com' };

async function sendTransactionalEmail(to: string, subject: string, html: string): Promise<{ via: 'brevo-api' | 'smtp' }> {
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

// 6-digit email verification codes (signup only — see /api/auth/send-verification-code).
// Stored in Firestore rather than issued as a signed token so a resend can
// invalidate the previous code and attempts can be capped server-side.
const VERIFICATION_CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const VERIFICATION_RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds
const VERIFICATION_MAX_ATTEMPTS = 5;

function generateVerificationCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// Dev-only fallback store, used only when Firestore Admin has no credentials
// (see the "local dev fallback" branch above) — otherwise local development
// could never exercise the signup email-verification flow at all. Production
// always has dbAdmin available, same as /api/recover-account already assumes,
// so this Map is never touched there.
interface PendingVerification { code: string; email: string; createdAt: number; expiresAt: number; attempts: number; }
const devVerificationStore = new Map<string, PendingVerification>();

// Automatic Billing has been moved to the client side.

// Automatic Visit Rescheduling has been moved to the client side.

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3001;

  // Run health check
  await checkFirestoreHealth();

  app.use(express.json());

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // Vercel's edge network adds this header to every incoming request — no
  // API key or external geo-IP service needed. Used to pick a sensible
  // default UI language (RO in Romania, EN elsewhere) for first-time
  // visitors only; see src/i18n.ts. Absent in local dev (no Vercel edge in
  // front of it), which the client already treats as "couldn't determine,
  // keep whatever the browser-language detector guessed".
  app.get("/api/geo", (req, res) => {
    const country = (req.headers['x-vercel-ip-country'] as string) || null;
    res.json({ country });
  });

  // API Route for recovering account by email
  app.post("/api/recover-account", async (req, res) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
    if (!token) {
      return res.status(401).json({ error: "Authentication required" });
    }

    let decodedToken;
    try {
      decodedToken = await getAuth(adminApp).verifyIdToken(token);
    } catch (err) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    // Security: the account being recovered and the uid it's recovered into
    // must both come from the verified token, never from the request body —
    // otherwise any caller could hijack an arbitrary victim's profile.
    const newUid = decodedToken.uid;
    const email = decodedToken.email;
    if (!email) {
      return res.status(400).json({ error: "Token has no associated email" });
    }

    try {
      const usersSnap = await dbAdmin.collection('users').where('email', '==', email.toLowerCase()).get();
      if (usersSnap.empty) {
        return res.json({ recovered: false });
      }

      const oldProfileDoc = usersSnap.docs[0];
      const oldProfile = oldProfileDoc.data();
      const orgId = oldProfile.organizationId;

      // Create new profile
      await dbAdmin.collection('users').doc(newUid).set({
        ...oldProfile,
        uid: newUid
      });

      // Update organization adminUid if applicable
      if (orgId) {
        const orgDoc = await dbAdmin.collection('organizations').doc(orgId).get();
        if (orgDoc.exists && orgDoc.data()?.adminUid === oldProfileDoc.id) {
          await dbAdmin.collection('organizations').doc(orgId).update({
            adminUid: newUid
          });
        }
      }

      // Delete old profile if different
      if (oldProfileDoc.id !== newUid) {
        await dbAdmin.collection('users').doc(oldProfileDoc.id).delete();
      }

      res.json({ recovered: true, profile: { ...oldProfile, uid: newUid } });
    } catch (err: any) {
      console.error("Recovery error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Sends a fresh 6-digit code to the account's own email (from the verified
  // ID token, never the request body) and stores it in Firestore for
  // /api/auth/verify-code to check. Signup only blocks on this — existing
  // accounts created before this feature shipped are unaffected since they
  // already have organizationId set and never hit this path.
  app.post("/api/auth/send-verification-code", async (req, res) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
    if (!token) {
      return res.status(401).json({ error: "Authentication required" });
    }

    let decodedToken;
    try {
      decodedToken = await getAuth(adminApp).verifyIdToken(token);
    } catch (err) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    const uid = decodedToken.uid;
    const email = decodedToken.email;
    if (!email) {
      return res.status(400).json({ error: "Token has no associated email" });
    }

    try {
      const existingCreatedAtMs = dbAdmin
        ? (await dbAdmin.collection('emailVerifications').doc(uid).get()).data()?.createdAt?.toMillis?.() ?? 0
        : devVerificationStore.get(uid)?.createdAt ?? 0;
      const elapsed = Date.now() - existingCreatedAtMs;
      if (existingCreatedAtMs && elapsed < VERIFICATION_RESEND_COOLDOWN_MS) {
        return res.status(429).json({
          error: "Please wait before requesting another code",
          waitSeconds: Math.ceil((VERIFICATION_RESEND_COOLDOWN_MS - elapsed) / 1000)
        });
      }

      const code = generateVerificationCode();
      const record: PendingVerification = {
        code,
        email: email.toLowerCase(),
        createdAt: Date.now(),
        expiresAt: Date.now() + VERIFICATION_CODE_TTL_MS,
        attempts: 0
      };
      if (dbAdmin) {
        await dbAdmin.collection('emailVerifications').doc(uid).set({
          ...record,
          createdAt: new Date(record.createdAt),
          expiresAt: new Date(record.expiresAt)
        });
      } else {
        devVerificationStore.set(uid, record);
        console.warn(`[DEV] Firestore Admin unavailable — verification code for ${email} held in-memory only.`);
      }

      const { via } = await sendTransactionalEmail(
        email,
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
      console.log(`[DEV] Verification email sent via ${via} to ${email}`);

      res.json({ sent: true });
    } catch (err: any) {
      console.error("Send verification code error:", err);
      res.status(500).json({ error: "Could not send verification code" });
    }
  });

  // Checks a submitted code against the pending verification doc created by
  // /api/auth/send-verification-code above. Caps attempts and enforces
  // expiry server-side so this can't be brute-forced from the client.
  app.post("/api/auth/verify-code", async (req, res) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
    if (!token) {
      return res.status(401).json({ error: "Authentication required" });
    }

    let decodedToken;
    try {
      decodedToken = await getAuth(adminApp).verifyIdToken(token);
    } catch (err) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    const uid = decodedToken.uid;
    const { code } = req.body || {};
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: "Verification code required" });
    }

    try {
      const verifRef = dbAdmin ? dbAdmin.collection('emailVerifications').doc(uid) : null;
      const data = verifRef ? (await verifRef.get()).data() : devVerificationStore.get(uid);
      const dataExpiresAtMs = data
        ? ((data as any).expiresAt?.toMillis ? (data as any).expiresAt.toMillis() : (data as any).expiresAt)
        : 0;

      if (!data) {
        return res.status(400).json({ error: "No verification pending. Request a new code." });
      }

      if (Date.now() > dataExpiresAtMs) {
        if (verifRef) await verifRef.delete(); else devVerificationStore.delete(uid);
        return res.status(400).json({ error: "Code expired. Request a new one." });
      }

      if ((data.attempts || 0) >= VERIFICATION_MAX_ATTEMPTS) {
        if (verifRef) await verifRef.delete(); else devVerificationStore.delete(uid);
        return res.status(429).json({ error: "Too many attempts. Request a new code." });
      }

      if (data.code !== code.trim()) {
        if (verifRef) await verifRef.update({ attempts: (data.attempts || 0) + 1 });
        else devVerificationStore.set(uid, { ...(data as PendingVerification), attempts: (data.attempts || 0) + 1 });
        return res.status(400).json({ error: "Incorrect code." });
      }

      if (verifRef) await verifRef.delete(); else devVerificationStore.delete(uid);
      res.json({ verified: true });
    } catch (err: any) {
      console.error("Verify code error:", err);
      res.status(500).json({ error: "Could not verify code" });
    }
  });

  // Password reset via our own verified Brevo sender instead of Firebase
  // Auth's built-in email, which sends from a generic *.firebaseapp.com
  // address shared across every Firebase project — no sender reputation of
  // its own, so it reliably lands in spam. generatePasswordResetLink()
  // produces the same Firebase-hosted reset link; only the delivery channel
  // changes. No auth required — the user isn't signed in when they've
  // forgotten their password, same as the endpoint it replaces.
  app.post("/api/auth/send-password-reset", async (req, res) => {
    const { email } = req.body || {};
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: "Email required" });
    }

    // Same message whether or not the account exists, so this can't be used
    // to probe which emails are registered.
    const genericResponse = { sent: true };

    try {
      // handleCodeInApp routes the link to our own #reset-password screen
      // (pages/ResetPassword.tsx) instead of Firebase's default hosted page —
      // Firebase appends mode/oobCode/apiKey after the hash fragment we give
      // it here, so they land in location.hash, same pattern the app already
      // uses for invite/purchase links.
      const actionCodeSettings = {
        url: `${process.env.APP_URL || 'https://gradinamea.vercel.app'}/#reset-password`,
        handleCodeInApp: true
      };
      const link = await getAuth(adminApp).generatePasswordResetLink(email.trim().toLowerCase(), actionCodeSettings);
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
      // auth/user-not-found is expected and intentionally silent (privacy).
      // Anything else is worth knowing about even though the client still
      // gets the generic response.
      if (err?.code !== 'auth/user-not-found') {
        console.error("Send password reset error:", err);
      }
    }

    res.json(genericResponse);
  });

  // Called right after a password change succeeds — see
  // api/auth/revoke-sessions.ts (the production version of this route) for
  // the full reasoning. Invalidates every refresh token issued before now
  // for the caller's own uid, so any OTHER device holding an old session
  // fails its next token refresh and gets signed out (via App.tsx's forced
  // getIdToken(true)-on-load check).
  app.post("/api/auth/revoke-sessions", async (req, res) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
    if (!token) {
      return res.status(401).json({ error: "Authentication required" });
    }

    let decodedToken;
    try {
      decodedToken = await getAuth(adminApp).verifyIdToken(token);
    } catch (err) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    try {
      await getAuth(adminApp).revokeRefreshTokens(decodedToken.uid);
      res.json({ ok: true });
    } catch (err: any) {
      console.error("Revoke sessions error:", err);
      res.status(500).json({ error: "Could not revoke other sessions" });
    }
  });

  // API Route for Vision AI (Plant Scan) — real Claude Vision diagnosis
  app.post("/api/vision", async (req, res) => {
    try {
      const parsed = AiDiagnosisRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request payload", details: parsed.error.issues });
      }

      if (!process.env.ANTHROPIC_API_KEY) {
        return res.status(503).json({ error: "AI diagnosis is not configured (missing ANTHROPIC_API_KEY)" });
      }

      const { imageBase64, mimeType } = parsed.data;

      const anthropic = new Anthropic();
      const message = await anthropic.messages.create({
        model: "claude-opus-4-8",
        max_tokens: 1024,
        system:
          "Ești un inginer peisagist și fitopatolog expert. Analizezi fotografia unei plante/gazon și " +
          "identifici boala, dăunătorul sau problema. Răspunzi DOAR în limba română. Fii concret și practic: " +
          "numește problema, estimează încrederea (0-100), și dă o recomandare de tratament acționabilă cu " +
          "produse și dozaje unde e relevant. Dacă planta pare sănătoasă, folosește type='healthy'. Dacă nu " +
          "poți identifica nimic cu certitudine din imagine, folosește type='unknown' și o încredere scăzută.",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: mimeType, data: imageBase64 },
              },
              {
                type: "text",
                text: "Diagnostichează această plantă/gazon și returnează rezultatul structurat.",
              },
            ],
          },
        ],
        output_config: {
          format: {
            type: "json_schema",
            schema: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["disease", "pest", "healthy", "unknown"] },
                diagnostic: { type: "string" },
                confidence: { type: "number" },
                actiune_urgenta: { type: "string" },
              },
              required: ["type", "diagnostic", "confidence", "actiune_urgenta"],
              additionalProperties: false,
            },
          },
        },
      });

      const textBlock = message.content.find((b: any) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        return res.status(502).json({ error: "AI returned no usable diagnosis" });
      }

      const validResponse = AiDiagnosisResponseSchema.parse(JSON.parse(textBlock.text));
      res.json(validResponse);
    } catch (err: any) {
      console.error("Vision API Error:", err);
      res.status(500).json({ error: "Failed to process image diagnosis" });
    }
  });

  // API Route for AI Assistant (Mock)
  app.post("/api/assistant/chat", async (req, res) => {
    try {
      const { messages } = req.body;
      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: "Invalid messages format" });
      }

      const lastMessage = messages[messages.length - 1]?.content?.toLowerCase() || '';
      
      // Mock delay to simulate AI thinking
      await new Promise(resolve => setTimeout(resolve, 1500));

      let reply = "Aceasta este o recomandare standard: Asigură-te că solul este bine drenat și aerat. Pentru mai multe detalii specifice, te rugăm să consulți secțiunea BUSTED din Academy.";

      if (lastMessage.includes("sol") || lastMessage.includes("pământ") || lastMessage.includes("pregăt")) {
        reply = "Pentru pregătirea solului (gazon nou), urmează pașii aceștia:\n\n1. **Curățarea:** Elimină resturile vegetale și pietrele.\n2. **Erbicidare (opțional):** Dacă ai buruieni, aplică un erbicid total cu 2-3 săptămâni înainte. *Atenție: glifosatul nu omoară semințele latente.*\n3. **Frezarea:** Sapă sau frezează la 10-15 cm adâncime.\n4. **Nivelarea și Tasarea:** Greblează pentru a mărunți bolovanii, apoi tăvălugește solul pentru a obține un pat germinativ ferm (călcâiul nu ar trebui să se scufunde mai mult de 1 cm).";
      } else if (lastMessage.includes("apă") || lastMessage.includes("ud") || lastMessage.includes("irig")) {
        reply = "Regula de aur la irigare: **Udă rar, dar abundent!**\n\n- **Evită:** Udarea zilnică timp de 10 minute. Menține rădăcinile la suprafață.\n- **Evită:** Udarea seara, deoarece frunza umedă peste noapte favorizează bolile fungice.\n- **Ideal:** Udă dimineața devreme (4:00 - 6:00 AM) pentru a spăla roua și a permite uscarea rapidă la soare.";
      } else if (lastMessage.includes("îngrășământ") || lastMessage.includes("fertiliz") || lastMessage.includes("npk")) {
        reply = "Nutriția gazonului este esențială. Folosește îngrășăminte solide granulate cu eliberare lentă. Primăvara ai nevoie de mult Azot (N) pentru creștere, iar toamna de mai mult Potasiu (K) pentru rezistență la ger și stres. Ai aplicat vreun tratament recent?";
      } else if (lastMessage.includes("boală") || lastMessage.includes("uscat") || lastMessage.includes("pete")) {
        reply = "Petele uscate sau galbene pot avea două cauze majore:\n\n1. **Boli Fungice** (ex: Brown Patch, Pythium) - adesea circulare, cu margini active/închise la culoare.\n2. **Deficit Local de Apă** - acoperire slabă a aspersoarelor.\n\nÎți recomand să folosești **Doctorul Grădinii (Smart Troubleshooter)** pentru un diagnostic pas-cu-pas sau să încerci Testul Șurubelniței!";
      }

      res.json({ reply });
    } catch (err: any) {
      console.error("Assistant API Error:", err);
      res.status(500).json({ error: "Failed to process chat message" });
    }
  });

  // API Route for loading academy articles securely
  app.get("/api/academy/article", async (req, res) => {
    const { id } = req.query;

    if (!id || typeof id !== "string") {
      return res.status(400).json({ error: "Missing article ID" });
    }

    const allArticles = [...ARTICLES_RO, ...ARTICLES_EN];
    const article = allArticles.find(a => a.id === id);

    if (!article) {
      return res.status(404).json({ error: "Article not found" });
    }

    try {
      // Determine file path
      const filePath = path.join(process.cwd(), article.contentPath);
      
      // If it is a premium article, verify authorization
      if (article.isPremium) {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

        if (!token) {
          return res.status(401).json({ error: "Authentication required for premium articles" });
        }

        try {
          const decodedToken = await getAuth(adminApp).verifyIdToken(token);
          const uid = decodedToken.uid;

          let isPro = false;
          const userEmail = decodedToken.email?.toLowerCase();

          // Developer has permanent PRO status
          if (userEmail === 'dragomirvaleriu@gmail.com') {
            isPro = true;
          } else if (dbAdmin) {
            // Check in Firestore
            const userDoc = await dbAdmin.collection('users').doc(uid).get();
            if (userDoc.exists) {
              const userData = userDoc.data();
              const orgId = userData?.organizationId;
              if (orgId) {
                const orgDoc = await dbAdmin.collection('organizations').doc(orgId).get();
                if (orgDoc.exists) {
                  const orgData = orgDoc.data();
                  const now = Date.now();
                  const expires = orgData?.planExpires?.toDate ? orgData.planExpires.toDate().getTime() : Infinity;
                  let tier: 'free' | 'pro' | 'enterprise' | 'lifetime' = 'free';
                  if (orgData?.subscriptionTier) {
                    tier = orgData.subscriptionTier;
                  } else {
                    const effectiveLicense = orgData?.licenseType || (orgData?.plan === 'pro' && now < expires ? 'pro' : 'free');
                    tier = orgData?.isLifetime ? 'lifetime' : (effectiveLicense === 'pro' ? 'pro' : 'free');
                  }
                  
                  if (tier !== 'lifetime' && tier !== 'enterprise' && now > expires) {
                     tier = 'free';
                  }

                  isPro = tier === 'pro' || tier === 'enterprise' || tier === 'lifetime';
                }
              }
            }
          } else {
            // Local dev fallback when credentials are not configured
            console.warn(`[API WARNING] dbAdmin not initialized. Direct bypass for user: ${uid}`);
            isPro = true; 
          }

          if (!isPro) {
            return res.status(403).json({ error: "PRO subscription required to view this article" });
          }
        } catch (authErr: any) {
          console.error("Token verification failed:", authErr.message);
          return res.status(401).json({ error: "Invalid token" });
        }
      }

      // Read file and strip frontmatter
      let content = await fs.readFile(filePath, "utf-8");
      // Remove YAML frontmatter (lines between --- delimiters) - flexible with line endings
      content = content.replace(/^-{3,}\s*[\s\S]*?\n-{3,}\s*\n/, '').trim();
      res.header("Content-Type", "text/plain; charset=utf-8");
      return res.send(content);

    } catch (err: any) {
      console.error(`Error loading article ${id}:`, err);
      return res.status(500).json({ error: "Failed to load article content" });
    }
  });

  // API Route to restore superadmin role (for dragomirvaleriu@gmail.com after password reset)
  app.post("/api/restore-superadmin", async (req, res) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    if (!token) {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      const decodedToken = await getAuth(adminApp).verifyIdToken(token);
      const uid = decodedToken.uid;
      const email = decodedToken.email?.toLowerCase();

      // Only allow dragomirvaleriu@gmail.com to restore their own role
      if (email !== 'dragomirvaleriu@gmail.com') {
        return res.status(403).json({ error: "Only dragomirvaleriu@gmail.com can use this endpoint" });
      }

      if (!dbAdmin) {
        return res.status(503).json({ error: "Database not available" });
      }

      // Update user document with superadmin role
      await dbAdmin.collection('users').doc(uid).update({
        role: 'superadmin',
        updatedAt: new Date()
      });

      console.log(`✓ Superadmin role restored for ${email} (uid: ${uid})`);
      res.json({ success: true, message: 'Superadmin role restored' });
    } catch (err: any) {
      console.error("Failed to restore superadmin role:", err);
      res.status(500).json({ error: "Failed to restore superadmin role: " + err.message });
    }
  });

  // Subscription grants and account deletion used to live here as
  // /api/admin/grant-subscription and /api/admin/delete-user. Both were
  // unfixable in this process: the dev server has no service-account
  // credentials, so dbAdmin is null and the routes fell back to an
  // *unauthenticated* client SDK write that Firestore rejected with
  // PERMISSION_DENIED every time. They also wrote the entitlement to
  // users/{uid}, which usePlan() never reads. They are now the
  // grantSubscription / revokeSubscription / deleteUserAccount callables in
  // functions/src/index.ts, which run with real Admin SDK credentials and
  // write to organizations/{orgId} where the app actually looks.

  // API Route to test the setup locally
  app.get("/api/test-server", (req, res) => {
    res.json({ message: "Server is running!" });
  });

  // Vite middleware for development
  if (true || process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // In production, serve static files
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
      res.sendFile("dist/index.html", { root: "." });
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
