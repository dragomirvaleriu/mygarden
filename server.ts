import express from "express";
import { createServer as createViteServer } from "vite";

console.log("Scapeflow: server.ts is starting...");

import dotenv from "dotenv";
import nodemailer from "nodemailer";
import cron from "node-cron";
import { initializeApp as initializeAdminApp, getApps, getApp, applicationDefault } from "firebase-admin/app";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import firebaseConfig from "./firebase-applet-config.json";
import { formatInTimeZone } from 'date-fns-tz';
import { isRateLimited } from "./utils/backendRateLimit";
import { verifyAuthentication } from "./utils/auth";
import invoicesHandler from "./api/invoices";
import visitsHandler from "./api/visits";
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
  } else {
    console.warn("[FIRESTORE] Admin Firestore NOT initialized (missing credentials). Some API routes may fail.");
  }
} catch (err: any) {
  console.warn("[FIRESTORE] Could not initialize Firestore Admin:", err.message);
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

// Automatic Billing has been moved to the client side.

// Automatic Visit Rescheduling has been moved to the client side.

async function startServer() {
  const app = express();
  const PORT = 3001;

  // Run health check
  await checkFirestoreHealth();

  app.use(express.json());

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // API routes for Invoices and Visits mapped to their Serverless handlers
  app.all("/api/invoices", (req, res) => {
    invoicesHandler(req, res);
  });
  app.all("/api/visits", (req, res) => {
    visitsHandler(req, res);
  });

  // Public Client Portal data endpoint. The client document ID acts as an
  // unguessable capability token (shared via the portal link), so this route
  // intentionally requires no auth — but it uses the Admin SDK to fetch and
  // return ONLY the fields the portal UI needs for that single clientId, so a
  // caller can never enumerate or dump other clients'/organizations' data
  // (which is what the old public Firestore rules allowed).
  app.get("/api/client-portal/:clientId", async (req, res) => {
    if (!dbAdmin) {
      return res.status(500).json({ error: "Admin Firestore not initialized" });
    }

    const { clientId } = req.params;
    const toIso = (ts: any): string | null => (ts && typeof ts.toDate === 'function') ? ts.toDate().toISOString() : null;

    try {
      const clientSnap = await dbAdmin.collection('clients').doc(clientId).get();
      if (!clientSnap.exists) {
        return res.status(404).json({ error: "Client not found" });
      }
      const clientData = clientSnap.data();

      const [propertiesSnap, historySnap, visitsSnap] = await Promise.all([
        dbAdmin.collection('properties').where('clientId', '==', clientId).get(),
        dbAdmin.collection('client_history').where('clientId', '==', clientId).get(),
        dbAdmin.collection('visits').where('clientId', '==', clientId).get(),
      ]);

      const properties = propertiesSnap.docs.map((d: any) => {
        const p = d.data();
        return {
          id: d.id,
          name: p.name || '',
          address: p.address || '',
          surfaceArea: p.surfaceArea ?? null,
          irrigation: !!p.irrigation,
        };
      });

      const history = historySnap.docs
        .map((d: any) => ({ id: d.id, ...d.data() }))
        .filter((h: any) => h.type !== 'payment')
        .map((h: any) => ({
          id: h.id,
          date: toIso(h.date),
          startTime: toIso(h.startTime),
          type: h.type,
          propertyId: h.propertyId || null,
          propertyName: h.propertyName || null,
          visitId: h.visitId || null,
          duration: h.duration || 0,
          services: h.services || [],
          photos: h.photos || [],
        }));

      const visits = visitsSnap.docs.map((d: any) => {
        const v = d.data();
        return {
          id: d.id,
          propertyId: v.propertyId || null,
          propertyAddress: v.propertyAddress || null,
          clientAddress: v.clientAddress || null,
        };
      });

      res.json({
        client: { nume: clientData.nume || '' },
        properties,
        history,
        visits,
      });
    } catch (err: any) {
      console.error("Client portal fetch error:", err);
      res.status(500).json({ error: "Failed to load portal data" });
    }
  });

  // Public lookup for a pending invitation by its (unguessable) code, used by the
  // Login page before the invitee has an account. Uses the Admin SDK and returns
  // only the single matching invite — direct client-side Firestore access to the
  // "invitations" collection now requires sign-in (see firestore.rules), since the
  // old rule let anyone list/dump every pending invitation.
  app.get("/api/invite-lookup", async (req, res) => {
    if (!dbAdmin) {
      return res.status(500).json({ error: "Admin Firestore not initialized" });
    }
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    if (!code) {
      return res.status(400).json({ error: "Missing code" });
    }

    try {
      const snap = await dbAdmin.collection('invitations').where('code', '==', code).limit(1).get();
      if (snap.empty) {
        return res.status(404).json({ error: "Invitation not found" });
      }
      const data = snap.docs[0].data();
      res.json({
        organizationId: data.organizationId,
        role: data.role,
        email: data.email,
        status: data.status,
        code,
      });
    } catch (err: any) {
      console.error("Invite lookup error:", err);
      res.status(500).json({ error: "Failed to look up invitation" });
    }
  });

  // API Route for triggering visit rescheduling manually is removed as it's now client-side

  // API Route for sending invitations
  app.post("/api/invite", async (req, res) => {
    // Obținem adresa IP a clientului
    const clientIp = (
      req.headers['x-forwarded-for'] || 
      req.headers['x-real-ip'] || 
      req.ip || 
      req.socket.remoteAddress || 
      'unknown'
    ).toString().split(',')[0].trim();

    try {
      const isLimited = await isRateLimited(clientIp);
      if (isLimited) {
        return res.status(429).json({ 
          error: "Too many requests", 
          message: "Te rugăm să aștepți 15 minute înainte de a trimite o nouă invitație." 
        });
      }
    } catch (rateLimitErr) {
      console.error("Rate limiting local evaluation failed:", rateLimitErr);
    }

    let user;
    try {
      user = await verifyAuthentication(req);
    } catch (authErr: any) {
      return res.status(401).json({ error: 'Unauthenticated', message: authErr.message });
    }

    const { email, inviteCode, organizationId, organizationName, appUrl } = req.body;

    if (!email || !inviteCode || !organizationName || !organizationId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Only an admin/owner of the target organization (or the super admin) may invite.
    if (!user.isSuperAdmin && (user.organizationId !== organizationId || (user.role !== 'admin' && user.role !== 'owner'))) {
      return res.status(403).json({ error: "Forbidden", message: "You do not have permission to invite members to this organization" });
    }

    console.log(`Attempting to send invite to: ${email} for org: ${organizationName}`);
    try {
      const inviteLink = `${appUrl}/#login?invite=${inviteCode}`;
      
      const info = await transporter.sendMail({
        from: '"Scapeflow" <dragomirvaleriu@gmail.com>', // sender address (must be verified in Brevo)
        to: email, // list of receivers
        subject: `Invitație în echipa ${organizationName}`, // Subject line
        html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
              <h2 style="color: #f07d00;">Bună!</h2>
              <p>Ai fost invitat să te alături echipei <strong>${organizationName}</strong> pe platforma Scapeflow.</p>
              <p>Pentru a accepta invitația și a-ți crea contul, apasă pe butonul de mai jos:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${inviteLink}" style="background-color: #f07d00; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Acceptă Invitația</a>
              </div>
              <p style="font-size: 12px; color: #666;">Dacă butonul nu funcționează, copiază link-ul în browser: <br> ${inviteLink}</p>
              <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
              <p style="font-size: 10px; color: #999;">Scapeflow - Management de Performanță pentru Peisagistică</p>
            </div>
          `,
      });

      console.log("Message sent: %s", info.messageId);
      res.json({ success: true, id: info.messageId });
    } catch (err: any) {
      console.error("Server Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // API Route for sending monthly financial report
  app.post("/api/send-monthly-report", async (req, res) => {
    let user;
    try {
      user = await verifyAuthentication(req);
    } catch (authErr: any) {
      return res.status(401).json({ error: 'Unauthenticated', message: authErr.message });
    }

    const { organizationId, recipientEmail, orgName, month, year, clients, payments } = req.body;

    if (!recipientEmail || !orgName || !clients || !organizationId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (!user.isSuperAdmin && user.organizationId !== organizationId) {
      return res.status(403).json({ error: "Forbidden", message: "You do not have access to this organization's data" });
    }

    const monthName = new Date(year, month).toLocaleString('ro-RO', { month: 'long' });

    // Build HTML table for the email
    const totalCollected = payments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
    const totalDebt = clients.reduce((sum: number, c: any) => sum + Math.max(0, c.sold || 0), 0);

    const paymentRows = payments
      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .map((p: any) => `
        <tr>
          <td style="padding:6px 10px;border-bottom:1px solid #eee">${p.clientName || 'Necunoscut'}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee">${new Date(p.date).toLocaleDateString('ro-RO')}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;font-weight:bold;color:#16a34a">${p.amount} RON</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:11px;color:#666">${p.details || '-'}</td>
        </tr>
      `).join('');

    const debtorRows = clients
      .filter((c: any) => (c.sold || 0) > 0)
      .sort((a: any, b: any) => (b.sold || 0) - (a.sold || 0))
      .map((c: any) => `
        <tr>
          <td style="padding:6px 10px;border-bottom:1px solid #eee">${c.name}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;font-weight:bold;color:#dc2626">${c.sold} RON</td>
        </tr>
      `).join('');

    try {
      await transporter.sendMail({
        from: `"Scapeflow - ${orgName}" <dragomirvaleriu@gmail.com>`,
        to: recipientEmail,
        subject: `📊 Raport Lunar ${monthName} ${year} — ${orgName}`,
        html: `
          <div style="font-family:sans-serif;max-width:700px;margin:0 auto;color:#1a1a1a">
            <div style="background:#f07d00;padding:24px 30px;border-radius:10px 10px 0 0">
              <h1 style="color:white;margin:0;font-size:22px">📊 Raport Lunar ${monthName} ${year}</h1>
              <p style="color:rgba(255,255,255,0.85);margin:6px 0 0">${orgName}</p>
            </div>
            <div style="background:#fff;border:1px solid #eee;border-top:none;padding:24px 30px;border-radius:0 0 10px 10px">
              
              <div style="display:flex;gap:20px;margin-bottom:28px">
                <div style="flex:1;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;text-align:center">
                  <div style="font-size:28px;font-weight:900;color:#16a34a">${totalCollected} RON</div>
                  <div style="font-size:11px;font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:1px;margin-top:4px">Încasat în ${monthName}</div>
                </div>
                <div style="flex:1;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;text-align:center">
                  <div style="font-size:28px;font-weight:900;color:#dc2626">${totalDebt} RON</div>
                  <div style="font-size:11px;font-weight:700;color:#991b1b;text-transform:uppercase;letter-spacing:1px;margin-top:4px">Sold Restant Total</div>
                </div>
                <div style="flex:1;background:#fafafa;border:1px solid #eee;border-radius:8px;padding:16px;text-align:center">
                  <div style="font-size:28px;font-weight:900;color:#1a1a1a">${payments.length}</div>
                  <div style="font-size:11px;font-weight:700;color:#666;text-transform:uppercase;letter-spacing:1px;margin-top:4px">Tranzacții</div>
                </div>
              </div>

              <h3 style="font-size:13px;font-weight:900;text-transform:uppercase;letter-spacing:1px;color:#f07d00;margin-bottom:10px">Încasări ${monthName} ${year}</h3>
              ${payments.length > 0 ? `
                <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:24px">
                  <thead><tr style="background:#f9fafb">
                    <th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;color:#666">Client</th>
                    <th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;color:#666">Data</th>
                    <th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;color:#666">Sumă</th>
                    <th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;color:#666">Detalii</th>
                  </tr></thead>
                  <tbody>${paymentRows}</tbody>
                </table>
              ` : '<p style="color:#666;font-size:13px;margin-bottom:24px">Nicio încasare înregistrată în această perioadă.</p>'}

              ${debtorRows ? `
                <h3 style="font-size:13px;font-weight:900;text-transform:uppercase;letter-spacing:1px;color:#dc2626;margin-bottom:10px">Clienți cu Restanțe</h3>
                <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:24px">
                  <thead><tr style="background:#fef2f2">
                    <th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;color:#991b1b">Client</th>
                    <th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;color:#991b1b">Sold</th>
                  </tr></thead>
                  <tbody>${debtorRows}</tbody>
                </table>
              ` : ''}

              <hr style="border:0;border-top:1px solid #eee;margin:20px 0">
              <p style="font-size:11px;color:#999;text-align:center">Scapeflow — Management de Performanță pentru Peisagistică<br>Raport generat automat pe ${new Date().toLocaleDateString('ro-RO')}</p>
            </div>
          </div>
        `
      });
      res.json({ success: true });
    } catch (err: any) {
      console.error("Monthly report email error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // API Route for sending mass emails (Campaigns)
  app.post("/api/campaigns/send", async (req, res) => {
    // Only accept with valid authorization token
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    if (!token) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!dbAdmin) {
       return res.status(500).json({ error: "Admin Firestore not initialized" });
    }

    try {
      const decodedToken = await getAuth(adminApp).verifyIdToken(token);
      
      // Verify Super Admin
      const userDoc = await dbAdmin.collection('users').doc(decodedToken.uid).get();
      if (!userDoc.exists || userDoc.data()?.role !== 'superadmin') {
         return res.status(403).json({ error: "Superadmin role required" });
      }

      const { subject, message, target, testEmailOnly } = req.body;
      if (!subject || !message) {
        return res.status(400).json({ error: "Missing subject or message" });
      }

      // Create campaign record
      const campaignRef = dbAdmin.collection('campaigns').doc();
      await campaignRef.set({
        subject,
        message,
        target: target || 'all',
        createdAt: new Date(),
        createdBy: decodedToken.uid,
        status: 'starting',
        sentCount: 0,
        totalCount: 0,
        errors: 0
      });

      // Start async process (DO NOT AWAIT)
      (async () => {
        try {
          let targets: string[] = [];

          if (testEmailOnly) {
             targets = [testEmailOnly];
          } else {
             // Get users based on target
             const usersSnap = await dbAdmin.collection('users').get();
             targets = usersSnap.docs
                .map((d: any) => {
                    const data = d.data();
                    if (target === 'admins' && data.role !== 'admin') return null;
                    return data.email;
                })
                .filter((e: string | null) => !!e);
          }

          // Remove duplicates
          targets = [...new Set(targets)];

          await campaignRef.update({
             status: 'sending',
             totalCount: targets.length
          });

          let sentCount = 0;
          let errorsCount = 0;

          // Process in batches to avoid overwhelming SMTP
          // 5 emails per second
          const BATCH_SIZE = 5;
          const DELAY_MS = 1000; 

          for (let i = 0; i < targets.length; i += BATCH_SIZE) {
            const batch = targets.slice(i, i + BATCH_SIZE);
            
            const promises = batch.map(email => {
               return transporter.sendMail({
                  from: '"Scapeflow" <dragomirvaleriu@gmail.com>',
                  to: email,
                  subject: subject,
                  html: message
               }).catch((err: any) => {
                  console.error(`Failed to send to ${email}:`, err.message);
                  return null; // indicate failure
               });
            });

            const results = await Promise.all(promises);
            const batchSuccess = results.filter(r => r !== null).length;
            const batchErrors = batch.length - batchSuccess;

            sentCount += batchSuccess;
            errorsCount += batchErrors;

            // Update progress in Firestore every batch
            await campaignRef.update({
               sentCount,
               errors: errorsCount
            });

            // Delay before next batch
            if (i + BATCH_SIZE < targets.length) {
               await new Promise(resolve => setTimeout(resolve, DELAY_MS));
            }
          }

          // Mark as complete
          await campaignRef.update({
             status: 'completed',
             finishedAt: new Date()
          });

        } catch (campaignErr) {
          console.error("Campaign process error:", campaignErr);
          await campaignRef.update({
             status: 'failed'
          });
        }
      })();

      // Respond immediately
      res.json({ success: true, campaignId: campaignRef.id });

    } catch (err: any) {
      console.error("Campaign setup error:", err);
      res.status(500).json({ error: "Failed to initialize campaign" });
    }
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

  // API Route for resolving shortened Google Maps links
  // Only Google Maps link-shortener hosts may be fetched here — otherwise this
  // endpoint would let a caller make the server issue arbitrary requests (SSRF),
  // e.g. against internal services or cloud metadata endpoints.
  const ALLOWED_MAPS_LINK_HOSTS = new Set([
    'maps.app.goo.gl',
    'goo.gl',
    'g.co',
    'maps.google.com',
    'www.google.com',
    'google.com',
  ]);

  app.get("/api/resolve-maps-link", async (req, res) => {
    const { url } = req.query;
    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "Missing URL parameter" });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return res.status(400).json({ error: "Invalid URL" });
    }
    if (parsedUrl.protocol !== 'https:' || !ALLOWED_MAPS_LINK_HOSTS.has(parsedUrl.hostname)) {
      return res.status(400).json({ error: "URL host is not an allowed Google Maps link" });
    }

    try {
      // Use fetch to follow redirects - GET is more reliable than HEAD for some shorteners
      const response = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      res.json({ resolvedUrl: response.url });
    } catch (err: any) {
      console.error("Error resolving maps link:", err);
      res.status(500).json({ error: "Failed to resolve link" });
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

      // Read file and send it
      const content = await fs.readFile(filePath, "utf-8");
      res.header("Content-Type", "text/plain; charset=utf-8");
      return res.send(content);

    } catch (err: any) {
      console.error(`Error loading article ${id}:`, err);
      return res.status(500).json({ error: "Failed to load article content" });
    }
  });

  // API Route to test the setup locally
  app.get("/api/test-server", (req, res) => {
    res.json({ message: "Server is running!" });
  });

  // Note: Automated billing cron has been moved to Vercel Serverless Functions (/api/cron-billing.ts)
  // because Vercel doesn't run this server.ts file in production.

  // Daily cron job for Auto Clock-Out at 23:59
  cron.schedule("59 23 * * *", async () => {
    if (!dbAdmin) {
      console.warn("[CRON] Auto clock-out skipped: Admin Firestore not initialized.");
      return;
    }
    try {
      console.log("[CRON] Running daily auto clock-out...");
      // For local dev, you can use a manual trigger if needed, but this runs automatically
      const snapshot = await dbAdmin.collection('time_logs')
        .where('status', 'in', ['working', 'on_break'])
        .get();
      
      if (snapshot.empty) {
        console.log("[CRON] No active time logs to close.");
        return;
      }

      const batch = dbAdmin.batch();
      let updatedCount = 0;

      snapshot.docs.forEach((doc: any) => {
        const data = doc.data();
        const startTimestamp = data.startTime;
        
        if (!startTimestamp) return;
        
        let breaks = data.breaks || [];
        let totalBreakMs = 0;
        
        // At 23:59, the theoretical end is calculated from the remaining day. 
        // We cap work minutes at 8 hours (480 minutes).
        const startMs = startTimestamp.toDate().getTime();
        const endMs = startMs + (480 * 60000) + totalBreakMs;
        const endTime = new Date(); // Close it at current time (23:59)

        // Close any active breaks
        breaks = breaks.map((b: any) => {
          if (b.start && !b.end) {
             b.end = endTime; // Close break now
          }
          if (b.start && b.end) {
            const bStart = b.start.toDate ? b.start.toDate().getTime() : b.start.getTime();
            const bEnd = b.end.toDate ? b.end.toDate().getTime() : b.end.getTime();
            totalBreakMs += (bEnd - bStart);
          }
          return b;
        });

        // Capping auto-close to 8 hours (480 minutes)
        const totalWorkMinutes = 480; 
        const overtimeMinutes = 0;

        batch.update(doc.ref, {
          status: 'finished',
          totalWorkMinutes,
          overtimeMinutes,
          endTime,
          breaks,
          autoClosed: true
        });
        updatedCount++;
      });

      if (updatedCount > 0) {
        await batch.commit();
        console.log(`[CRON] Auto-closed ${updatedCount} time logs.`);
      }
    } catch (err) {
      console.error("[CRON] Auto clock-out error:", err);
    }
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
