import Stripe from "stripe";
import { getAuth } from 'firebase-admin/auth';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

function getAdminApp() {
  if (getApps().length === 0) {
    let projectId = process.env.FIREBASE_PROJECT_ID;
    if (!projectId) {
      try {
        const configStr = fs.readFileSync(path.join(process.cwd(), "firebase-applet-config.json"), "utf8");
        projectId = JSON.parse(configStr).projectId;
      } catch (e) {}
    }
    return initializeApp({ projectId: projectId || undefined });
  }
  return getApps()[0];
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No autorizado" });
    }
    
    const token = authHeader.split("Bearer ")[1];
    const auth = getAuth(getAdminApp());
    const decodedToken = await auth.verifyIdToken(token);
    
    const db = getFirestore(getAdminApp());
    const userDoc = await db.collection("users").doc(decodedToken.uid).get();
    if (!userDoc.exists) {
      return res.status(403).json({ error: "Usuario no encontrado" });
    }
    
    const userData = userDoc.data();
    
    const { agencyId, priceId, mode = "subscription", metadata, quantity = 1 } = req.body;
    
    if (!agencyId || !priceId) {
      return res.status(400).json({ error: "Missing agencyId or priceId" });
    }
    
    if (userData.role !== "master" && userData.agencyId !== agencyId) {
      return res.status(403).json({ error: "No tienes permiso para esta agencia" });
    }

    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
    const stripe = new Stripe(key);
    
    const origin = req.headers.origin || process.env.APP_URL || 'http://localhost:3000';

    const sessionParams = {
      payment_method_types: ["card"],
      mode: mode,
      line_items: [
        {
          price: priceId,
          quantity: quantity,
        },
      ],
      client_reference_id: agencyId,
      success_url: `${origin}/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/billing?canceled=true`,
    };

    if (metadata) {
      sessionParams.metadata = metadata;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    res.json({ url: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
