import nodemailer from 'nodemailer';
import { isRateLimited } from '../utils/backendRateLimit';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Obținem adresa IP a clientului din headere (Vercel/Proxies) sau socket
  const clientIp = (
    req.headers['x-forwarded-for'] || 
    req.headers['x-real-ip'] || 
    req.socket.remoteAddress || 
    'unknown'
  ).toString().split(',')[0].trim();

  // 1. Verificare Rate-Limiting pe bază de IP
  try {
    const isLimited = await isRateLimited(clientIp);
    if (isLimited) {
      return res.status(429).json({ 
        error: "Too many requests", 
        message: "Te rugăm să aștepți 15 minute înainte de a trimite o nouă invitație." 
      });
    }
  } catch (rateLimitErr) {
    console.error("Rate limiting evaluation failed:", rateLimitErr);
    // Continuăm (fail-open) pentru a nu bloca invitarea utilizatorilor legitimi
  }

  const { email, inviteCode, organizationName, appUrl } = req.body;

  if (!email || !inviteCode || !organizationName) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const smtpConfig = {
    host: process.env.SMTP_HOST || "smtp-relay.brevo.com",
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER || "a39e5c001@smtp-brevo.com",
      pass: process.env.SMTP_PASS || "vh9H0czrXESJdUja",
    },
  };

  const transporter = nodemailer.createTransport(smtpConfig);

  try {
    const inviteLink = `${appUrl}/#login?invite=${inviteCode}`;
    
    const info = await transporter.sendMail({
      from: '"Scapeflow" <dragomirvaleriu@gmail.com>',
      to: email,
      subject: `Invitație în echipa ${organizationName}`,
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

    res.status(200).json({ success: true, id: info.messageId });
  } catch (err: any) {
    console.error("Vercel API Error:", err);
    res.status(500).json({ error: err.message });
  }
}
