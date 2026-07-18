import nodemailer from 'nodemailer';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { organizationId, recipientEmail, orgName, month, year, clients, payments } = req.body;

  if (!recipientEmail || !orgName || !clients) {
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
  const monthName = new Date(year, month).toLocaleString('ro-RO', { month: 'long' });

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
    res.status(200).json({ success: true });
  } catch (err: any) {
    console.error("Vercel Monthly Report Error:", err);
    res.status(500).json({ error: err.message });
  }
}
