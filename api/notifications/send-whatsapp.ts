// WhatsApp reminder notifications via Twilio WhatsApp Business API
// TODO: Requires Twilio account setup + WhatsApp Business Account approval
//
// Flow:
// 1. User provides phone number in AccountSettings (currently placeholder UI)
// 2. On triggered reminders (watering, pruning, frost alerts), call this API
// 3. Send templated message via Twilio to user's WhatsApp

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // NOT YET IMPLEMENTED — requires Twilio credentials in env
  const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
  const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
  const TWILIO_WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM; // e.g., "whatsapp:+1234567890"

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_FROM) {
    return res.status(501).json({
      error: 'WhatsApp integration not yet configured',
      hint: 'Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM in env',
    });
  }

  const { userId, phoneNumber, message, templateName } = req.body;

  try {
    // TODO: call Twilio API to send message
    // const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Basic ${Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64')}`,
    //   },
    //   body: new URLSearchParams({
    //     From: TWILIO_WHATSAPP_FROM,
    //     To: `whatsapp:${phoneNumber}`,
    //     Body: message,
    //   }),
    // });

    res.status(501).json({
      error: 'WhatsApp integration not yet implemented',
      message: 'Feature planned but requires Twilio Business Account setup',
    });
  } catch (err: any) {
    console.error('WhatsApp send error:', err);
    res.status(500).json({ error: err.message });
  }
}
