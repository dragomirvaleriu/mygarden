import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { promises as fs } from "fs";
import path from "path";

// Self-contained Admin SDK init — see api/auth/revoke-sessions.ts for why
// (cross-file api/_lib imports and JSON config imports both 500'd in
// production; duplicating this ~15-line init is more reliable than fighting
// the bundler a third time).
const FIREBASE_PROJECT_ID = "mygarden-hq";

// Article metadata lookup: read from a plain JSON file on disk instead of
// importing src/data/academyContent.ts directly — that import 500'd in
// production with ERR_MODULE_NOT_FOUND (Vercel's per-function bundler
// doesn't trace it, same class of failure as the api/_lib case above). The
// JSON is regenerated fresh on every build by scripts/generate-academy-
// manifest.ts (see package.json's prebuild step) and ships with this
// function via vercel.json's functions.includeFiles.
interface ArticleManifestEntry { id: string; contentPath: string; isPremium: boolean; }
let manifestCache: ArticleManifestEntry[] | null = null;
async function getManifest(): Promise<ArticleManifestEntry[]> {
  if (manifestCache) return manifestCache;
  const raw = await fs.readFile(path.join(process.cwd(), 'content/academy/manifest.json'), 'utf-8');
  manifestCache = JSON.parse(raw);
  return manifestCache!;
}

function getAdminApp() {
  if (getApps().length) return getApps()[0];
  const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (key) {
    return initializeApp({ credential: cert(JSON.parse(key)), projectId: FIREBASE_PROJECT_ID });
  }
  console.warn("[api] FIREBASE_SERVICE_ACCOUNT_KEY not set — Admin SDK calls will fail.");
  return initializeApp({ projectId: FIREBASE_PROJECT_ID });
}
const adminAuth = getAuth(getAdminApp());
const dbAdmin = getFirestore(getAdminApp());

// Loads an academy article's markdown body securely, enforcing the PRO gate
// for premium articles. Ported from server.ts's /api/academy/article route,
// which only ran in local dev (tsx server.ts) — in production, Vercel's
// catch-all rewrite (vercel.json) was serving index.html for this path
// instead (with a 200, so the client's !res.ok check never caught it),
// dumping the raw page HTML into the article body. See vercel.json's
// functions.includeFiles for why content/academy/**/*.md ships with this
// function — fs.readFile's path here is built at runtime, so Vercel's
// static import tracer can't discover those files on its own.
export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { id } = req.query;
  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "Missing article ID" });
  }

  const manifest = await getManifest();
  const article = manifest.find(a => a.id === id);
  if (!article) {
    return res.status(404).json({ error: "Article not found" });
  }

  try {
    const filePath = path.join(process.cwd(), article.contentPath);

    if (article.isPremium) {
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
      if (!token) {
        return res.status(401).json({ error: "Authentication required for premium articles" });
      }

      let uid: string;
      let userEmail: string | undefined;
      try {
        const decoded = await adminAuth.verifyIdToken(token);
        uid = decoded.uid;
        userEmail = decoded.email?.toLowerCase();
      } catch (authErr: any) {
        console.error("Token verification failed:", authErr.message);
        return res.status(401).json({ error: "Invalid token" });
      }

      let isPro = false;
      if (userEmail === 'dragomirvaleriu@gmail.com') {
        isPro = true;
      } else {
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
      }

      if (!isPro) {
        return res.status(403).json({ error: "PRO subscription required to view this article" });
      }
    }

    let content = await fs.readFile(filePath, "utf-8");
    content = content.replace(/^-{3,}\s*[\s\S]*?\n-{3,}\s*\n/, '').trim();
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.status(200).send(content);
  } catch (err: any) {
    console.error(`Error loading article ${id}:`, err);
    return res.status(500).json({ error: "Failed to load article content" });
  }
}
