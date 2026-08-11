import { adminAuth, sendTransactionalEmail } from "../_lib/authAdmin";

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
    // auth/user-not-found is expected and intentionally silent (privacy).
    if (err?.code !== 'auth/user-not-found') {
      console.error("Send password reset error:", err);
    }
  }

  res.status(200).json(genericResponse);
}
