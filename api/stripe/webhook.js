import Stripe from "stripe";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

// Initialize Firebase Admin if not already initialized
if (getApps().length === 0) {
  try {
    const serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (serviceAccountStr) {
      const serviceAccount = JSON.parse(serviceAccountStr);
      initializeApp({
        credential: cert(serviceAccount)
      });
    }
  } catch (err) {
    console.error("Failed to initialize Firebase Admin in Webhook:", err);
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const sig = req.headers["stripe-signature"];
  let event;
  try {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
    const stripe = new Stripe(key);

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
    }
    
    // Read raw body
    const buf = await new Promise((resolve, reject) => {
      const chunks = [];
      req.on('data', (chunk) => chunks.push(chunk));
      req.on('end', () => resolve(Buffer.concat(chunks)));
      req.on('error', reject);
    });

    event = stripe.webhooks.constructEvent(buf, sig, webhookSecret);
  } catch (err) {
    console.error(`Webhook Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (getApps().length > 0) {
      const db = getFirestore();
      if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const agencyId = session.client_reference_id;
        if (agencyId) {
          await db.collection("agencies").doc(agencyId).update({
            hasProAccess: true,
            proAccessUpdatedAt: FieldValue.serverTimestamp(),
            stripeCustomerId: session.customer,
            stripeSubscriptionId: session.subscription,
          });
        }
      } else if (event.type === "customer.subscription.deleted" || event.type === "customer.subscription.updated") {
        const subscription = event.data.object;
        const agenciesSnapshot = await db
          .collection("agencies")
          .where("stripeSubscriptionId", "==", subscription.id)
          .get();

        if (!agenciesSnapshot.empty) {
          const doc = agenciesSnapshot.docs[0];
          await doc.ref.update({
            hasProAccess: subscription.status === "active",
            proAccessUpdatedAt: FieldValue.serverTimestamp(),
          });
        }
      }
    }
    res.json({ received: true });
  } catch (err) {
    console.error("Error processing webhook:", err);
    res.status(500).send("Error processing webhook");
  }
}
