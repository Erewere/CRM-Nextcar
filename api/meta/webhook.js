export default async function handler(req, res) {
  if (req.method === 'GET') {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    const metaVerifyToken = process.env.META_VERIFY_TOKEN;

    if (mode && token) {
      if (mode === "subscribe" && token === metaVerifyToken) {
        console.log("WEBHOOK_VERIFIED");
        return res.status(200).send(challenge);
      } else {
        return res.sendStatus(403);
      }
    }
    return res.status(200).send("Webhook endpoint is ready");
  }

  if (req.method === 'POST') {
    let body = req.body;
    // Log the incoming message
    console.log("Incoming Webhook:", JSON.stringify(body, null, 2));
    
    // In a real app, process the WhatsApp message here
    // Verify it's from WhatsApp API
    if (body.object === 'whatsapp_business_account') {
      res.status(200).send('EVENT_RECEIVED');
    } else {
      res.sendStatus(404);
    }
  } else {
    res.status(405).json({ error: 'Method Not Allowed' });
  }
}
