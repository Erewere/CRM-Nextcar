import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import admin from "firebase-admin";
import { Resend } from "resend";
import Stripe from "stripe";

// Initialize Firebase Admin lazily to avoid crashing if env is not set yet
let adminApp: admin.app.App | null = null;
function getAdminApp() {
  if (!adminApp) {
    if (process.env.FIREBASE_PROJECT_ID) {
      adminApp = admin.initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID,
      });
    } else {
      // In AI Studio / local dev, default init often works if set up through gcloud
      // but without a service account it might fail. We attempt.
      adminApp = admin.initializeApp();
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

      const adminDb = getAdminApp().firestore();

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
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
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
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
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
      const { agencyId, priceId } = req.body;
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
            quantity: 1,
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
      if (!fromEmail.includes("@")) {
        fromEmail = "Nextcar CRM <onboarding@resend.dev>";
      }
      
      let finalTo = to;
      // Resend sandbox restricts sending emails to the verified address only
      if (fromEmail.includes("onboarding@resend.dev")) {
        finalTo = "luisfj@gmail.com";
      }

      const { data, error } = await resend.emails.send({
        from: fromEmail,
        to: finalTo,
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
        const adminDb = getAdminApp().firestore();

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
    adminDb: admin.firestore.Firestore,
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
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    await adminDb.collection("clients").add(newClient);
  }

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
