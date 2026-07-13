import express from "express";
import { GoogleGenAI, Type } from "@google/genai";


import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { initializeApp, App as FirebaseApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue, Firestore } from "firebase-admin/firestore";
import { Resend } from "resend";
import Stripe from "stripe";

// Initialize Firebase Admin lazily to avoid crashing if env is not set yet
let adminApp: FirebaseApp | null = null;
function getAdminApp() {
  if (!adminApp) {
    if (process.env.FIREBASE_PROJECT_ID) {
      adminApp = initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID,
      });
    } else {
      // In AI Studio / local dev, default init often works if set up through gcloud
      // but without a service account it might fail. We attempt.
      adminApp = initializeApp();
    }
  }
  return adminApp;
}

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

let stripeClient: Stripe | null = null;
function getStripe(): Stripe {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY environment variable is required");
    }
    stripeClient = new Stripe(key, { apiVersion: "2023-10-16" as any });
  }
  return stripeClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // === Stripe Webhook Endpoint (Must be before express.json) ===
  app.post(
    "/api/stripe/webhook",
    express.raw({ type: "application/json" }),
    async (req, res) => {
      const sig = req.headers["stripe-signature"];
      let event;

      try {
        const stripe = getStripe();
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
        if (!webhookSecret) {
          throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
        }
        event = stripe.webhooks.constructEvent(req.body, sig as string, webhookSecret);
      } catch (err: any) {
        console.error("Webhook Error:", err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }

      const adminDb = getFirestore(getAdminApp()!);

      // Handle the event
      switch (event.type) {
        case "checkout.session.completed":
          const checkoutSession = event.data.object as Stripe.Checkout.Session;
          const agencyId = checkoutSession.client_reference_id;
          if (agencyId) {
            // Update agency status to active
            await adminDb.collection("agencies").doc(agencyId).set(
              {
                subscriptionStatus: "active",
                stripeCustomerId: checkoutSession.customer,
                updatedAt: FieldValue.serverTimestamp(),
              },
              { merge: true }
            );
          }
          break;
        case "customer.subscription.deleted":
          const subscription = event.data.object as Stripe.Subscription;
          const customerId = subscription.customer as string;
          // Find agency by customerId and update status
          const agenciesSnapshot = await adminDb
            .collection("agencies")
            .where("stripeCustomerId", "==", customerId)
            .get();
          
          if (!agenciesSnapshot.empty) {
            const agencyDoc = agenciesSnapshot.docs[0];
            await agencyDoc.ref.set(
              {
                subscriptionStatus: "canceled",
                updatedAt: FieldValue.serverTimestamp(),
              },
              { merge: true }
            );
          }
          break;
        // ... handle other event types
        default:
          console.log(`Unhandled event type ${event.type}`);
      }

      res.send();
    }
  );

  // Use JSON middleware for other webhook bodies
  app.use(express.json());

  // === Stripe Create Checkout Session ===
  app.post("/api/create-checkout-session", async (req, res) => {
    try {
      const { agencyId, priceId, quantity } = req.body;
      if (!agencyId || !priceId) {
        return res.status(400).json({ error: "Missing agencyId or priceId" });
      }

      const stripe = getStripe();
      const origin = req.headers.origin || process.env.APP_URL || `http://localhost:${PORT}`;

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "subscription",
        line_items: [
          {
            price: priceId, // e.g. price_1...
            quantity: quantity || 1,
          },
        ],
        client_reference_id: agencyId,
        success_url: `${origin}/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/billing?canceled=true`,
      });

      res.json({ url: session.url });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/create-user", async (req, res) => {
    try {
      const { email, password, name, role, agencyId } = req.body;
      if (!email || !password || !role || !agencyId) {
        return res.status(400).json({ error: "Faltan parámetros requeridos" });
      }

      const auth = getAuth(getAdminApp()!);
      const userRecord = await auth.createUser({
        email,
        password,
        displayName: name || email.split('@')[0],
      });

      const db = getFirestore(getAdminApp()!);
      await db.collection("users").doc(userRecord.uid).set({
        email,
        role,
        agencyId,
        name: name || email.split('@')[0],
        createdAt: FieldValue.serverTimestamp()
      });

      res.status(200).json({ uid: userRecord.uid, email: userRecord.email, tempPassword: password });
    } catch (err: any) {
      console.error("Create User Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/delete-user", async (req, res) => {
    try {
      const { uid } = req.body;
      if (!uid) {
        return res.status(400).json({ error: "Falta el parámetro uid" });
      }

      // Delete from Firebase Auth
      try {
        const auth = getAuth(getAdminApp()!);
        await auth.deleteUser(uid);
      } catch (authErr: any) {
        console.warn("Could not delete from Firebase Auth (ignoring):", authErr.message);
      }

      // Delete from Firestore
      const db = getFirestore(getAdminApp()!);
      await db.collection("users").doc(uid).delete();

      res.status(200).json({ success: true });
    } catch (err: any) {
      console.error("Delete User Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // === Resend Email Endpoint ===
  app.post("/api/send-invite", async (req, res) => {
    if (!resend) {
      return res.status(500).json({
        error: "Servicio de correo no configurado (Falta RESEND_API_KEY)",
      });
    }
    const { to, subject, html } = req.body;
    if (!to || !subject || !html) {
      return res
        .status(400)
        .json({ error: "Faltan parámetros requeridos (to, subject, html)" });
    }
    try {
      let fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
      
      const toList = to.split(',').map((e: string) => e.trim()).filter(Boolean);

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
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // === Meta (WhatsApp/Messenger) Webhook Integration ===

  // 1. Webhook Verification (GET)
  app.get("/api/meta/webhook", (req, res) => {
    // Meta requires verifying the token.
    const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || "12345";
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode && token) {
      if (mode === "subscribe" && token === VERIFY_TOKEN) {
        console.log("WEBHOOK_VERIFIED");
        res.status(200).send(challenge);
      } else {
        res.sendStatus(403);
      }
    } else {
      res.sendStatus(400);
    }
  });

  // 2. Webhook Payload parsing (POST)
  app.post("/api/meta/webhook", async (req, res) => {
    const body = req.body;

    if (body.object === "whatsapp_business_account" || body.object === "page") {
      try {
        const adminDb = getFirestore(getAdminApp()!);

        for (const entry of body.entry) {
          // For WhatsApp
          if (body.object === "whatsapp_business_account" && entry.changes) {
            for (const change of entry.changes) {
              const value = change.value;
              if (value && value.messages && value.messages[0]) {
                const phone = value.contacts?.[0]?.wa_id || "";
                const name =
                  value.contacts?.[0]?.profile?.name || "Unknown WA Lead";
                const text = value.messages[0]?.text?.body || "";

                console.log(
                  `New incoming WA message from ${name} (${phone}): ${text}`,
                );

                await createMetaLead(adminDb, name, phone, "whatsapp", text);
              }
            }
          }

          // For Messenger
          if (body.object === "page" && entry.messaging) {
            for (const event of entry.messaging) {
              const senderId = event.sender?.id || "";
              const text = event.message?.text || "";

              if (senderId && text) {
                console.log(
                  `New incoming Messenger message from ${senderId}: ${text}`,
                );
                await createMetaLead(
                  adminDb,
                  `Messenger Lead (${senderId})`,
                  "",
                  "messenger",
                  text,
                );
              }
            }
          }
        }
        res.sendStatus(200);
      } catch (e) {
        console.error("Error processing meta payload:", e);
        res.sendStatus(500);
      }
    } else {
      res.sendStatus(404);
    }
  });

  async function createMetaLead(
    adminDb: Firestore,
    name: string,
    phone: string,
    origin: string,
    text: string,
  ) {
    // In a real multi-tenant app, map the phone or page ID to the correct agencyId.
    // For now we'll assign to a default or find the first admin agency.
    let agencyId = "DEFAULT_AGENCY";

    const newClient = {
      agencyId,
      name,
      address: `Lead from ${origin}`,
      phone,
      email: "",
      vehicle: text.substring(0, 100),
      status: "new",
      origin: origin,
      sellerId: "",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    await adminDb.collection("clients").add(newClient);
  }

  app.post("/api/ai-advisor", express.json(), async (req, res) => {
    try {
      if (!process.env.GEMINI_API_KEY) {
         return res.status(500).json({ error: "Gemini API key is missing" });
      }
      
      let ai;
      try {
        ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      } catch(e) {
        return res.status(500).json({ error: "Gemini API key is invalid or missing" });
      }

      const { activeContacts, tasks, pipelineStages } = req.body;
      
      const prompt = `
You are "IA Erewere", an expert sales advisor for a car dealership.
Analyze the following active contacts, their tasks/notes, and the pipeline stages.
Identify up to 6 of the most critical actions to take to close deals.
Take into account:
1. How far along the pipeline stage they are (closer to the end = higher closing probability).
2. The notes and follow-ups in their tasks.
3. Overdue or pending tasks.

Pipeline Stages:
${JSON.stringify(pipelineStages)}

Active Contacts:
${JSON.stringify(activeContacts)}

Tasks/Notes:
${JSON.stringify(tasks)}

Return a JSON array of recommendation objects with the following schema:
- clientId (string)
- clientName (string)
- actionText (string)
- probability (number 1-99, representing probability to close based on stage and notes)
- reason (string, brief explanation of why this action is recommended)
- type (string, one of: 'overdue', 'proposal', 'followup', 'new', 'closing', 'meeting')
`;

      const response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                clientId: { type: Type.STRING },
                clientName: { type: Type.STRING },
                actionText: { type: Type.STRING },
                probability: { type: Type.NUMBER },
                reason: { type: Type.STRING },
                type: { type: Type.STRING },
              }
            }
          }
        }
      });
      
      const text = response.text;
      const recommendations = JSON.parse(text);
      res.json({ recommendations });
    } catch (e) {
      console.error("Error calling Gemini:", e);
      res.status(500).json({ error: "Failed to generate recommendations" });
    }
  });

  
  // === Vite Middleware for development ===
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "custom",
    });
    app.use(vite.middlewares);
    // Provide fallback for SPA router in development
    app.get("*", async (req, res, next) => {
      const url = req.originalUrl;
      try {
        let template = fs.readFileSync(
          path.resolve(process.cwd(), "index.html"),
          "utf-8",
        );
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    // Provide a fallback for React Router
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);
