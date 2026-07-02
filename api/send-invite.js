import { Resend } from 'resend';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    return res.status(500).json({ error: 'Servicio de correo no configurado (Falta RESEND_API_KEY)' });
  }

  const resend = new Resend(resendApiKey);
  const { to, subject, html } = req.body;

  if (!to || !subject || !html) {
    return res.status(400).json({ error: 'Faltan parámetros requeridos (to, subject, html)' });
  }

  try {
    let fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
    if (!fromEmail.includes("<") && fromEmail.includes("@")) {
      fromEmail = `Nextcar CRM <${fromEmail}>`;
    }
    
    // Support multiple comma separated emails
    const toList = to.split(',').map(e => e.trim()).filter(Boolean);

    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: toList,
      subject,
      html,
    });

    if (error) {
      return res.status(400).json({ error });
    }

    res.status(200).json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
