import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import admin from 'firebase-admin';

// Initialize Firebase Admin lazily to avoid crashing if env is not set yet
let adminApp: admin.app.App | null = null;
function getAdminApp() {
  if (!adminApp) {
    if (process.env.FIREBASE_PROJECT_ID) {
      adminApp = admin.initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID
      });
    } else {
      // In AI Studio / local dev, default init often works if set up through gcloud
      // but without a service account it might fail. We attempt.
      adminApp = admin.initializeApp();
    }
  }
  return adminApp;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Use JSON middleware for webhook bodies
  app.use(express.json());

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
                const name = value.contacts?.[0]?.profile?.name || "Unknown WA Lead";
                const text = value.messages[0]?.text?.body || "";
                
                console.log(`New incoming WA message from ${name} (${phone}): ${text}`);
                
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
                console.log(`New incoming Messenger message from ${senderId}: ${text}`);
                await createMetaLead(adminDb, `Messenger Lead (${senderId})`, "", "messenger", text);
              }
            }
          }
        }
        res.sendStatus(200);
      } catch(e) {
        console.error("Error processing meta payload:", e);
        res.sendStatus(500);
      }
    } else {
      res.sendStatus(404);
    }
  });

  async function createMetaLead(adminDb: admin.firestore.Firestore, name: string, phone: string, origin: string, text: string) {
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
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    await adminDb.collection("clients").add(newClient);
  }


  // === Vite Middleware for development ===
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // Provide a fallback for React Router
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);
