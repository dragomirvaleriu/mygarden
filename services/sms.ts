export const sendSms = async (to: string, message: string) => {
  const apiKey = import.meta.env.VITE_BREVO_API_KEY;
  if (!apiKey) {
    console.warn("Brevo API key is missing. SMS (Email) not sent.");
    return { success: false, error: "Missing API key" };
  }

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        sender: { name: "My Garden", email: "no-reply@landscapeos.com" },
        to: [{ email: "delivered@landscapeos.com" }], // Replace with actual email or use Brevo SMS API
        subject: `SMS to ${to}`,
        htmlContent: `<p>${message}</p>`
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Brevo API error: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    return { success: true };
  } catch (error) {
    console.error('Error sending SMS (via Brevo Email):', error);
    return { success: false, error };
  }
};
