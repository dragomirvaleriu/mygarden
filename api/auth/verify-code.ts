import { requireAuth, getDbAdmin, VERIFICATION_MAX_ATTEMPTS } from "../_lib/authAdmin";

// Checks a submitted code against the pending verification doc created by
// send-verification-code.ts. Caps attempts and enforces expiry server-side
// so this can't be brute-forced from the client.
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireAuth(req);
  if (!user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const { code } = req.body || {};
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: "Verification code required" });
  }

  const dbAdmin = getDbAdmin();
  if (!dbAdmin) {
    return res.status(503).json({ error: "Verification service unavailable" });
  }

  try {
    const verifRef = dbAdmin.collection('emailVerifications').doc(user.uid);
    const snap = await verifRef.get();
    if (!snap.exists) {
      return res.status(400).json({ error: "No verification pending. Request a new code." });
    }

    const data = snap.data();
    const expiresAtMs = data?.expiresAt?.toMillis ? data.expiresAt.toMillis() : 0;
    if (Date.now() > expiresAtMs) {
      await verifRef.delete();
      return res.status(400).json({ error: "Code expired. Request a new one." });
    }

    if ((data?.attempts || 0) >= VERIFICATION_MAX_ATTEMPTS) {
      await verifRef.delete();
      return res.status(429).json({ error: "Too many attempts. Request a new code." });
    }

    if (data?.code !== code.trim()) {
      await verifRef.update({ attempts: (data?.attempts || 0) + 1 });
      return res.status(400).json({ error: "Incorrect code." });
    }

    await verifRef.delete();
    res.status(200).json({ verified: true });
  } catch (err: any) {
    console.error("Verify code error:", err);
    res.status(500).json({ error: "Could not verify code" });
  }
}
