import {
  requireAuth,
  getDbAdmin,
  generateVerificationCode,
  sendTransactionalEmail,
  VERIFICATION_CODE_TTL_MS,
  VERIFICATION_RESEND_COOLDOWN_MS
} from "../_lib/authAdmin";

// Sends a fresh 6-digit code to the account's own email (from the verified
// ID token, never the request body) and stores it in Firestore for
// verify-code.ts to check. Signup only blocks on this — existing accounts
// created before this feature shipped are unaffected since they already
// have organizationId set and never hit this path. No in-memory fallback
// here (unlike server.ts's local-dev version) — a serverless function has
// no persistent memory across invocations, so Firestore is required.
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
