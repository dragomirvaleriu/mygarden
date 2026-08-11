import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

// Self-contained — see send-verification-code.ts for the reasoning (cross-
// file api/_lib imports and JSON config imports both 500'd in production;
// duplicating this ~15-line init is more reliable than fighting the bundler
// a third time).
const FIREBASE_PROJECT_ID = "mygarden-hq";

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

// Called right after a password change succeeds — either AccountSettings.tsx
// (already signed in, changing their own password) or ResetPassword.tsx
// (just completed a forgot-password reset, then signs itself in fresh so it
// has a token to call this with). revokeRefreshTokens invalidates every
// refresh token issued before *now* for this uid, so any OTHER device still
// holding an old session will fail its next token refresh. The calling
// device's own token was issued moments ago (from updatePassword's reauth,
// or the fresh signInWithEmailAndPassword right before this call) — the
// client is expected to force one more getIdToken(true) right after this
// resolves so its own session picks up a token stamped *after* the
// revocation instead of getting caught by it too.
//
// Requires a valid ID token for the account being acted on — there's no
// separate "whose sessions" input, so this can only ever revoke the caller's
// own sessions, never someone else's.
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const authHeader = req.headers?.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  let uid: string;
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    uid = decoded.uid;
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  try {
    await adminAuth.revokeRefreshTokens(uid);
    res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error("Revoke sessions error:", err);
    res.status(500).json({ error: "Could not revoke other sessions" });
  }
}
