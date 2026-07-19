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
  const PORT = Number(process.env.PORT) || 3001;

  // Run health check
  await checkFirestoreHealth();

  app.use(express.json());

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
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
