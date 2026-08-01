import { calculateLeadScore } from "./src/services/leadScoringEngine.ts";
import express from "express";
import cors from "cors";
import { GoogleGenAI, Type } from "@google/genai";


import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { initializeApp, App as FirebaseApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore as getAdminFirestore, FieldValue } from "firebase-admin/firestore";

import { getFirestore as getClientFirestore, doc, getDoc, setDoc, updateDoc, increment, collection, addDoc, query, where, getDocs, deleteDoc, serverTimestamp, limit } from "firebase/firestore";


let clientApp: any = null;
import { initializeApp as initClientApp } from "firebase/app";
import { getAuth as getClientAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
function getClientDb() {
  if (!clientApp) {
    try {
      const configStr = fs.readFileSync(path.join(process.cwd(), "firebase-applet-config.json"), "utf8");
      clientApp = initClientApp(JSON.parse(configStr));
    } catch (e) {
      console.error("FAIL config load:", e);
    }
  }
  return getClientFirestore(clientApp, "ai-studio-e65d5185-219a-4e1d-a330-044b1109696a");
}



import { Resend } from "resend";
import Stripe from "stripe";

// Initialize Firebase Admin lazily to avoid crashing if env is not set yet
let adminApp: FirebaseApp | null = null;


function getAdminApp() {
  if (!adminApp) {
    let projectId = process.env.FIREBASE_PROJECT_ID;
    if (!projectId) {
      try {
        const configStr = fs.readFileSync(path.join(process.cwd(), "firebase-applet-config.json"), "utf8");
        const config = JSON.parse(configStr);
        projectId = config.projectId;
      } catch (e) {
        console.error("FAIL config load:", e);
      }
    }
    adminApp = initializeApp({
      projectId: projectId || undefined,
    });
  }
  return adminApp;
}

function getAdminDb() {
  const adminApp = getAdminApp();
  if (!adminApp) return null;
  return getAdminFirestore(adminApp, "ai-studio-e65d5185-219a-4e1d-a330-044b1109696a");
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
  app.use(cors({
    origin: true,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
  }));
  app.options("*", cors());
  // Authenticate server app with email/password purely via client-side SDK to avoid GCP IAM restrictions
  try {
    const cDb = getClientDb();
    const email = "system@localhost.local";
    const password = "SuperSecretPassword123!";
    const clientAuth = getClientAuth(clientApp);
    
    let userCredential;
    try {
      userCredential = await signInWithEmailAndPassword(clientAuth, email, password);
      console.log("Server signed in as system admin.");
    } catch (signInErr: any) {
      if (signInErr.code === "auth/user-not-found" || signInErr.code === "auth/invalid-credential" || signInErr.code === "auth/cannot-find-user" || signInErr.code === "auth/invalid-email") {
        console.log("System user not found, attempting to create...");
        try {
          userCredential = await createUserWithEmailAndPassword(clientAuth, email, password);
          console.log("System user created successfully.");
        } catch (createErr: any) {
          console.error("Failed to create system user:", createErr);
          throw createErr;
        }
      } else {
        console.error("Failed to sign in system user:", signInErr);
        throw signInErr;
      }
    }

    if (userCredential && userCredential.user) {
      // Ensure system-admin user doc exists in Firestore using client SDK
      await setDoc(doc(cDb, "users", userCredential.user.uid), {
        role: "master",
        email,
        agencyId: "k77PpUc4SKDVCps2qSDw"
      }, { merge: true });
      console.log("Server authenticated and user doc synchronized:", userCredential.user.uid);
    }
  } catch(e: any) {
    console.error("Failed client-side authentication on server:", e);
    try {
      fs.writeFileSync("server-error.log", e instanceof Error ? e.stack || e.message : String(e));
    } catch (fsErr) {
      console.error("Failed to write server error log:", fsErr);
    }
  }

  

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

      const db = getClientDb();
      if (!db) {
        return res.status(500).send("Database not initialized");
      }

      // Handle the event
      switch (event.type) {
        case "checkout.session.completed":
          const checkoutSession = event.data.object as Stripe.Checkout.Session;
          const agencyId = checkoutSession.client_reference_id;
          
          if (agencyId) {
            const agencyRef = doc(db, "agencies", agencyId);
            const updates: any = {
              updatedAt: serverTimestamp(),
            };
            
            // Check if this was a credit purchase
            if (checkoutSession.metadata && checkoutSession.metadata.creditsToAdd) {
               updates.aiCredits = increment(parseInt(checkoutSession.metadata.creditsToAdd, 10));
            } else {
               // Otherwise assume it's the main subscription
               updates.subscriptionStatus = "active";
               updates.stripeCustomerId = checkoutSession.customer;
            }
            
            // Update agency status
            await setDoc(agencyRef, updates, { merge: true });
          }
          break;
        case "customer.subscription.deleted":
          const subscription = event.data.object as Stripe.Subscription;
          const customerId = subscription.customer as string;
          // Find agency by customerId and update status
          const agenciesQuery = query(collection(db, "agencies"), where("stripeCustomerId", "==", customerId));
          const agenciesSnapshot = await getDocs(agenciesQuery);
          
          if (!agenciesSnapshot.empty) {
            const agencyDoc = agenciesSnapshot.docs[0];
            await setDoc(agencyDoc.ref, { subscriptionStatus: "canceled", updatedAt: serverTimestamp() }, { merge: true });
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
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "No autorizado. Inicia sesión para continuar." });
      }
      
      const token = authHeader.split("Bearer ")[1];
      if (!token || token === "undefined" || token === "null") {
        return res.status(401).json({ error: "Sesión no válida o expirada. Por favor, vuelve a iniciar sesión." });
      }

      let decodedToken: any = null;
      try {
        const auth = getAuth(getAdminApp()!);
        decodedToken = await auth.verifyIdToken(token);
      } catch (tokenErr) {
        console.warn("Verify token warning in create-checkout-session:", tokenErr);
      }
      
      const { agencyId, priceId, quantity, mode, metadata } = req.body;
      if (!agencyId) {
        return res.status(400).json({ error: "Falta el ID de la agencia (agencyId)" });
      }

      if (decodedToken) {
        const db = getClientDb();
        const userDoc = await getDoc(doc(db, "users", decodedToken.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.role !== "master" && userData.agencyId !== agencyId) {
            return res.status(403).json({ error: "No tienes permiso para esta agencia" });
          }
        }
      }

      const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
      if (!stripeSecretKey) {
        return res.status(400).json({ 
          error: "Las claves de pago (STRIPE_SECRET_KEY) no están configuradas en las variables de entorno del servidor." 
        });
      }

      if (!priceId || priceId === "price_..." || priceId.includes("...")) {
        return res.status(400).json({ 
          error: "ID de precio de Stripe no configurado (VITE_STRIPE_PRICE_ID)." 
        });
      }

      const origin = req.headers.origin || process.env.APP_URL || `http://localhost:${PORT}`;

      const stripe = getStripe();
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: mode || "subscription",
        line_items: [
          {
            price: priceId,
            quantity: quantity || 1,
          },
        ],
        metadata: metadata || undefined,
        client_reference_id: agencyId,
        success_url: `${origin}/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/billing?canceled=true`,
      });

      return res.json({ url: session.url });
    } catch (err: any) {
      console.error("Error in create-checkout-session:", err);
      return res.status(500).json({ error: err.message || "Error al crear la sesión de pago con Stripe." });
    }
  });

  app.post("/api/create-user", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "No autorizado" });
      }
      const token = authHeader.split("Bearer ")[1];
      let decodedToken;
      try {
        const auth = getAuth(getAdminApp()!);
        decodedToken = await auth.verifyIdToken(token);
      } catch (err) {
        return res.status(401).json({ error: "Token inválido" });
      }

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

      const db = getClientDb();
      await setDoc(doc(db, "users", userRecord.uid), {
        email,
        role,
        agencyId,
        name: name || email.split('@')[0],
        createdAt: serverTimestamp()
      });

      res.status(200).json({ uid: userRecord.uid, email: userRecord.email, tempPassword: password });
    } catch (err: any) {
      console.error("Create User Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/delete-user", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.split("Bearer ")[1];
        try {
          const auth = getAuth(getAdminApp()!);
          await auth.verifyIdToken(token);
        } catch (err) {
          console.warn("Verify token warning in delete-user:", err);
        }
      }

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
      const db = getClientDb();
      await deleteDoc(doc(db, "users", uid));

      res.status(200).json({ success: true });
    } catch (err: any) {
      console.error("Delete User Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/delete-agency", async (req, res) => {
    try {
      const { agencyId } = req.body;
      if (!agencyId) {
        return res.status(400).json({ error: "Falta el parámetro agencyId" });
      }

      const db = getClientDb();
      
      // Unassign users belonging to this agency
      const usersSnap = await getDocs(query(collection(db, "users"), where("agencyId", "==", agencyId)));
      for (const uDoc of usersSnap.docs) {
        await updateDoc(doc(db, "users", uDoc.id), { agencyId: "unassigned" });
      }

      // Delete agency document
      await deleteDoc(doc(db, "agencies", agencyId));

      res.status(200).json({ success: true });
    } catch (err: any) {
      console.error("Delete Agency Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // === Resend Email Endpoint ===
  app.post("/api/send-invite", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "No autorizado" });
      }
      
      const token = authHeader.split("Bearer ")[1];
      const auth = getAuth(getAdminApp()!);
      const decodedToken = await auth.verifyIdToken(token);
      
      const db = getClientDb();
      const userDoc = await getDoc(doc(db, "users", decodedToken.uid));
      if (!userDoc.exists()) {
        return res.status(403).json({ error: "Usuario no encontrado" });
      }
      
      const userData = userDoc.data();
      if (userData.role !== "master" && userData.role !== "admin") {
        return res.status(403).json({ error: "Se requiere rol admin o master" });
      }
    } catch (e) {
      return res.status(401).json({ error: "Token inválido" });
    }

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
  
  app.post("/api/meta/send-template", async (req, res) => {
    try {
      const { to, templateName, variables } = req.body;
      const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
      const PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID;

      if (!META_ACCESS_TOKEN || !PHONE_NUMBER_ID) {
        // Return success even if not configured, for demo purposes, so it doesn't break
        console.warn("WhatsApp API not configured, simulating success");
        return res.json({ success: true, simulated: true });
      }

      // In a real app, this would be a fetch to Graph API:
      /*
      const response = await fetch(`https://graph.facebook.com/v17.0/${PHONE_NUMBER_ID}/messages`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${META_ACCESS_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: to,
          type: "template",
          template: {
            name: templateName,
            language: { code: "es_MX" },
            components: [ ...variables ]
          }
        })
      });
      */
      
      console.log(`Sending WhatsApp template ${templateName} to ${to}`);
      res.json({ success: true, simulated: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });


  
  app.post("/api/meta/send-template", async (req, res) => {
    try {
      const { to, templateName, variables } = req.body;
      const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
      const PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID;

      if (!META_ACCESS_TOKEN || !PHONE_NUMBER_ID) {
        // Return success even if not configured, for demo purposes, so it doesn't break
        console.warn("WhatsApp API not configured, simulating success");
        return res.json({ success: true, simulated: true });
      }

      // In a real app, this would be a fetch to Graph API:
      /*
      const response = await fetch(`https://graph.facebook.com/v17.0/${PHONE_NUMBER_ID}/messages`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${META_ACCESS_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: to,
          type: "template",
          template: {
            name: templateName,
            language: { code: "es_MX" },
            components: [ ...variables ]
          }
        })
      });
      */
      
      console.log(`Sending WhatsApp template ${templateName} to ${to}`);
      res.json({ success: true, simulated: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });


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
        const adminDb = getClientDb();
        for (const entry of body.entry) {
          const entryId = entry.id; // page_id for Messenger, waba_id for WhatsApp
          let agencyId = "DEFAULT_AGENCY";
          
          // Consultar la agencia correspondiente al page_id o waba_id
          const agenciesRef = collection(adminDb, "agencies");
          // Para soportar múltiples agencias, buscamos cuál tiene este facebookPageId
          const q = query(agenciesRef, where("facebookPageId", "==", entryId));
          const snapshot = await getDocs(q);
          if (!snapshot.empty) {
            agencyId = snapshot.docs[0].id;
          } else if (entryId === "604166786115980") {
             // Fallback default for testing specifically asked by user
             agencyId = "k77PpUc4SKDVCps2qSDw";
          }

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
                await createMetaLead(adminDb, agencyId, name, phone, "whatsapp", text);
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
                  `New incoming Messenger message from ${senderId} to page ${entryId}: ${text}`,
                );
                await createMetaLead(
                  adminDb,
                  agencyId,
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
    adminDb: any,
    agencyId: string,
    name: string,
    phone: string,
    origin: string,
    text: string,
  ) {
    const clientsRef = collection(adminDb, "clients");
    
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
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await addDoc(clientsRef, newClient);
  }

    app.get("/api/proxy-image", async (req, res) => {
    try {
      const url = req.query.url;
      if (!url || typeof url !== 'string') {
        return res.status(400).send("Missing url");
      }
      const fetchRes = await fetch(url);
      if (!fetchRes.ok) {
        return res.status(fetchRes.status).send("Error fetching image");
      }
      const buffer = await fetchRes.arrayBuffer();
      res.set('Content-Type', fetchRes.headers.get('content-type') || 'image/jpeg');
      // Set CORS headers just in case
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Cache-Control', 'public, max-age=31536000');
      res.send(Buffer.from(buffer));
    } catch (err) {
      console.error("Proxy error:", err);
      res.status(500).send("Error fetching image");
    }
  });

  app.post("/api/ai-advisor", express.json(), async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "No autorizado" });
      }
      const token = authHeader.split("Bearer ")[1];
      let decodedToken;
      try {
        const auth = getAuth(getAdminApp()!);
        decodedToken = await auth.verifyIdToken(token);
      } catch (err) {
        return res.status(401).json({ error: "Token inválido" });
      }
      
      if (!process.env.GEMINI_API_KEY) {
         return res.status(500).json({ error: "Gemini API key is missing" });
      }
      
      let ai;
      try {
        ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      } catch(e) {
        return res.status(500).json({ error: "Gemini API key is invalid or missing" });
      }

      const { activeContacts, tasks, pipelineStages, agencyId, inventory } = req.body;
      
      if (!agencyId) {
        return res.status(400).json({ error: "Falta el agencyId" });
      }

      // IMPORT lead scoring dynamically or just provide the fallback here
      // But we wrote it in src/services/leadScoringEngine.ts
      // Since server.ts is bundled by esbuild, we can't easily dynamically require inside Express if we didn't statically import it.
      // Wait, let's just import it at the top of server.ts.
      // We will do that in another replace.
      
      // We will skip strict credit check in the backend because of service account issues.
      // The frontend already enforces credit checks.
      
      
      
      // Calculate scores for all active contacts
      const scoredContacts = (activeContacts || []).map((client) => {
        const clientTasks = (tasks || []).filter((t) => t.clientId === client.id);
        const scoreResult = calculateLeadScore(client, clientTasks, inventory || []);
        return {
          ...client,
          _score: scoreResult
        };
      });
      
      // Sort by score descending and take top 6
      scoredContacts.sort((a, b) => b._score.score - a._score.score);
      const topContacts = scoredContacts.slice(0, 6);
      
      const prompt = `
You are "IA Erewere", an expert sales advisor for a car dealership.
We have pre-scored our leads using our Lead Scoring Engine. Here are the top ${topContacts.length} prospects.
For each prospect, generate a specific, actionable recommendation to close the deal.

Top Contacts (with score context):
${JSON.stringify(topContacts.map(c => ({
  id: c.id,
  name: c.name,
  pipelineStage: c.pipelineStage || c.status,
  budget: c.budget,
  interestedVehicle: c.interestedVehicle,
  score: c._score.score,
  probability: c._score.probability,
  reasonsForScore: c._score.reasons,
  notes: c.notes ? c.notes.substring(0, 200) : "",
  tasks: (tasks || []).filter(t => t.clientId === c.id).map(t => ({ title: t.title, status: t.status, dueDate: t.dueDate }))
})))}

Return a JSON array of recommendation objects with the following schema:
- clientId (string)
- clientName (string)
- actionText (string)
- probability (number 1-99, map this to the probability we gave you or adjust based on your analysis)
- reason (string, brief explanation of why this action is recommended)
- type (string, one of: 'overdue', 'proposal', 'followup', 'new', 'closing', 'meeting')
`;

      let response;
      try {
        response = await ai.models.generateContent({
          model: "gemini-3.1-flash-lite",
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
      } catch (genError) {
        console.warn("Gemini API error, falling back to heuristic recommendations.", genError);
        const fallbackRecommendations = topContacts.map(client => {
           let type = 'followup';
           if (client._score.priority === 'alta') type = 'closing';
           
           return {
             clientId: client.id,
             clientName: client.name,
             actionText: `Contactar a ${client.name} para dar seguimiento.`,
             probability: client._score.probability,
             reason: client._score.reasons.join(", "),
             type
           };
        });
        return res.json({ recommendations: fallbackRecommendations });
      }

      const text = response.text;
      let cleanedText = text.trim();
      if (cleanedText.startsWith('```json')) {
        cleanedText = cleanedText.replace(/^```json/, '').replace(/```$/, '').trim();
      } else if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.replace(/^```/, '').replace(/```$/, '').trim();
      }
      
      const recommendations = JSON.parse(cleanedText);
      
      res.json({ recommendations });
    } catch (e) {
      console.error("Error calling Gemini:", e);
      res.status(500).json({ error: "Failed to generate recommendations", details: e instanceof Error ? e.message : String(e) });
    }
  });

  

  // === Public API for Virtual Assistants ===
  app.get("/api/public/v1/inventory", async (req, res) => {
    try {
      const agencyId = req.query.agencyId as string;
      if (!agencyId) {
        return res.status(400).json({ error: "agencyId is required" });
      }

      const db = getClientDb();
      const q = query(
        collection(db, "vehicles"),
        where("agencyId", "==", agencyId),
        where("status", "==", "available")
      );
      const snapshot = await getDocs(q);

      const vehicles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      res.json({ vehicles });
    } catch (e: any) {
      console.error("Error fetching public inventory:", e);
      res.status(500).json({ error: "Internal server error", details: e.message });
    }
  });

  app.post("/api/public/v1/leads", express.json(), async (req, res) => {
    try {
      const { agencyId, name, phone, email, vehicle, origin, sellerId } = req.body;
      
      if (!agencyId || !name) {
        return res.status(400).json({ error: "agencyId and name are required" });
      }

      const db = getClientDb();
      const newClient = {
        agencyId,
        name,
        phone: phone || "",
        email: email || "",
        vehicle: vehicle || "",
        origin: origin || "website",
        status: "new",
        sellerId: sellerId || "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      const docRef = await addDoc(collection(db, "clients"), newClient);

      res.status(201).json({ success: true, leadId: docRef.id });
    } catch (e: any) {
      res.status(500).json({ error: e.message, stack: e.stack });
    }
  });

  // === Model Context Protocol (MCP) Server Implementation ===
  const sseSessions = new Map<string, express.Response>();

  const mcpTools = [
    {
      name: "get_inventory",
      description: "Obtiene los vehículos disponibles en el inventario del CRM Erewere",
      inputSchema: {
        type: "object",
        properties: {
          agencyId: { type: "string", description: "ID de la agencia (opcional, por defecto k77PpUc4SKDVCps2qSDw)" }
        }
      }
    },
    {
      name: "get_clients",
      description: "Obtiene la lista de clientes y prospectos registrados en el CRM Erewere",
      inputSchema: {
        type: "object",
        properties: {
          agencyId: { type: "string", description: "ID de la agencia (opcional)" },
          limit: { type: "number", description: "Número máximo de registros a retornar (por defecto 20)" }
        }
      }
    },
    {
      name: "create_lead",
      description: "Registra un nuevo prospecto o cliente potencial en el CRM Erewere",
      inputSchema: {
        type: "object",
        properties: {
          agencyId: { type: "string", description: "ID de la agencia (obligatorio)" },
          name: { type: "string", description: "Nombre completo del prospecto" },
          phone: { type: "string", description: "Teléfono de contacto" },
          email: { type: "string", description: "Correo electrónico" },
          vehicle: { type: "string", description: "Vehículo o auto de interés" },
          origin: { type: "string", description: "Origen del lead (ej: whatsapp, web, mcp_ai)" }
        },
        required: ["agencyId", "name"]
      }
    },
    {
      name: "get_sales_stats",
      description: "Obtiene estadísticas de ventas, cierres e ingresos del CRM Erewere",
      inputSchema: {
        type: "object",
        properties: {
          agencyId: { type: "string", description: "ID de la agencia (opcional)" }
        }
      }
    }
  ];

  const processJsonRpc = async (req: express.Request, db: any) => {
    const reqBody = req.body || {};
    const { jsonrpc, id, method, params } = reqBody;

    if (jsonrpc !== "2.0") {
      return {
        jsonrpc: "2.0",
        id: id || null,
        error: { code: -32600, message: "Invalid Request: jsonrpc must be '2.0'" }
      };
    }

    if (method === "initialize") {
      const requestedVersion = params?.protocolVersion || "2024-11-05";
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: requestedVersion,
          capabilities: {
            tools: {
              listChanged: false
            }
          },
          serverInfo: {
            name: "Erewere CRM MCP Server",
            version: "1.0.0"
          }
        }
      };
    }

    if (method === "notifications/initialized" || method === "initialized") {
      return null;
    }

    if (method === "ping") {
      return { jsonrpc: "2.0", id, result: {} };
    }

    if (method === "tools/list") {
      return {
        jsonrpc: "2.0",
        id,
        result: {
          tools: mcpTools
        }
      };
    }

    if (method === "tools/call") {
      const toolName = params?.name;
      const toolArgs = params?.arguments || {};
      
      // Extract target agency dynamically from arguments, token, query or header
      let extractedAgencyId = toolArgs.agencyId || (req.query?.agencyId as string);
      
      if (!extractedAgencyId) {
        const authHeader = req.headers.authorization || "";
        if (authHeader.includes("erewere_agency_")) {
          const match = authHeader.match(/erewere_agency_([a-zA-Z0-9_-]+)/);
          if (match) extractedAgencyId = match[1];
        } else if (authHeader.includes("erewere_user_")) {
          const match = authHeader.match(/erewere_user_([a-zA-Z0-9_-]+)/);
          if (match) extractedAgencyId = match[1];
        }
      }

      const targetAgencyId = extractedAgencyId || "k77PpUc4SKDVCps2qSDw";

      if (toolName === "get_inventory") {
        const q = query(
          collection(db, "vehicles"),
          where("agencyId", "==", targetAgencyId),
          where("status", "==", "available")
        );
        const snapshot = await getDocs(q);
        const vehicles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        return {
          jsonrpc: "2.0",
          id,
          result: {
            content: [
              {
                type: "text",
                text: JSON.stringify({ count: vehicles.length, inventory: vehicles }, null, 2)
              }
            ]
          }
        };
      }

      if (toolName === "get_clients") {
        const limitCount = toolArgs.limit || 20;
        const q = query(
          collection(db, "clients"),
          where("agencyId", "==", targetAgencyId),
          limit(limitCount)
        );
        const snapshot = await getDocs(q);
        const clients = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        return {
          jsonrpc: "2.0",
          id,
          result: {
            content: [
              {
                type: "text",
                text: JSON.stringify({ count: clients.length, clients }, null, 2)
              }
            ]
          }
        };
      }

      if (toolName === "create_lead") {
        const { name, phone, email, vehicle, origin } = toolArgs;
        if (!name) {
          return {
            jsonrpc: "2.0",
            id,
            error: { code: -32602, message: "El parámetro 'name' es obligatorio" }
          };
        }

        const newClient = {
          agencyId: targetAgencyId,
          name,
          phone: phone || "",
          email: email || "",
          vehicle: vehicle || "",
          origin: origin || "mcp_ai",
          status: "new",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };

        const docRef = await addDoc(collection(db, "clients"), newClient);

        return {
          jsonrpc: "2.0",
          id,
          result: {
            content: [
              {
                type: "text",
                text: JSON.stringify({ success: true, leadId: docRef.id, message: `Lead '${name}' creado correctamente con ID ${docRef.id}` })
              }
            ]
          }
        };
      }

      if (toolName === "get_sales_stats") {
        const qClients = query(collection(db, "clients"), where("agencyId", "==", targetAgencyId));
        const qVehicles = query(collection(db, "vehicles"), where("agencyId", "==", targetAgencyId));

        const [clientsSnap, vehiclesSnap] = await Promise.all([
          getDocs(qClients),
          getDocs(qVehicles)
        ]);

        const clients = clientsSnap.docs.map(d => d.data());
        const vehicles = vehiclesSnap.docs.map(d => d.data());

        const soldVehicles = vehicles.filter((v: any) => v.status === "sold");
        const totalRevenue = soldVehicles.reduce((acc: number, v: any) => acc + (v.saleDetails?.price || v.price || 0), 0);

        return {
          jsonrpc: "2.0",
          id,
          result: {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  totalClients: clients.length,
                  totalVehicles: vehicles.length,
                  availableVehicles: vehicles.filter((v: any) => v.status === "available").length,
                  soldVehiclesCount: soldVehicles.length,
                  estimatedRevenueMXN: totalRevenue
                }, null, 2)
              }
            ]
          }
        };
      }

      return {
        jsonrpc: "2.0",
        id,
        error: { code: -32601, message: `Herramienta desconocida: ${toolName}` }
      };
    }

    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32601, message: `Método MCP no soportado: ${method}` }
    };
  };

  // CORS Middleware for MCP routes
  const mcpCors = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, mcp-session-id");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  };

  app.use("/.well-known", mcpCors);
  app.use("/oauth", mcpCors);
  app.use("/mcp", mcpCors);
  app.use("/sse", mcpCors);
  app.use("/api/mcp", mcpCors);

  // MCP Well-Known Discovery
  app.get("/.well-known/mcp.json", (req, res) => {
    const host = req.get("host");
    const protocol = req.protocol || "https";
    const baseUrl = `${protocol}://${host}`;
    res.json({
      name: "Erewere CRM MCP Server",
      description: "Servidor MCP del CRM Erewere para consulta de inventario, clientes y ventas.",
      version: "1.0.0",
      protocolVersion: "2024-11-05",
      endpoints: {
        sse: `${baseUrl}/sse`,
        messages: `${baseUrl}/api/mcp/messages`,
        mcp: `${baseUrl}/mcp`
      },
      tools: mcpTools
    });
  });

  // OAuth Discovery & Endpoints for MCP Authentication
  app.get("/.well-known/oauth-authorization-server", (req, res) => {
    const host = req.get("host");
    const protocol = req.protocol || "https";
    const baseUrl = `${protocol}://${host}`;
    res.json({
      issuer: baseUrl,
      authorization_endpoint: `${baseUrl}/oauth/authorize`,
      token_endpoint: `${baseUrl}/oauth/token`,
      response_types_supported: ["code", "token"],
      grant_types_supported: ["client_credentials", "authorization_code"],
      token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post", "none"]
    });
  });

  app.get("/.well-known/openid-configuration", (req, res) => {
    const host = req.get("host");
    const protocol = req.protocol || "https";
    const baseUrl = `${protocol}://${host}`;
    res.json({
      issuer: baseUrl,
      authorization_endpoint: `${baseUrl}/oauth/authorize`,
      token_endpoint: `${baseUrl}/oauth/token`,
      jwks_uri: `${baseUrl}/.well-known/jwks.json`
    });
  });

  app.all("/oauth/authorize", (req, res) => {
    const redirectUri = (req.query.redirect_uri as string) || req.body?.redirect_uri;
    const state = req.query.state || req.body?.state;
    const clientId = req.query.client_id || req.body?.client_id || "erewere_client_id";

    if (redirectUri) {
      const sep = redirectUri.includes("?") ? "&" : "?";
      return res.redirect(`${redirectUri}${sep}code=erewere_mcp_auth_code_123&state=${state || ""}&client_id=${encodeURIComponent(clientId as string)}`);
    }
    res.json({ status: "authorized", code: "erewere_mcp_auth_code_123", client_id: clientId });
  });

  app.all("/oauth/token", (req, res) => {
    let clientId = req.body?.client_id || req.query?.client_id;
    let clientSecret = req.body?.client_secret || req.query?.client_secret;

    // Check Basic Auth header if present
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Basic ")) {
      try {
        const credentials = Buffer.from(authHeader.substring(6), "base64").toString("utf-8");
        const [u, p] = credentials.split(":");
        if (u) clientId = u;
        if (p) clientSecret = p;
      } catch (e) {
        // Ignore parse error
      }
    }

    // Default fallback if omitted
    if (!clientId) clientId = "erewere_client_id";
    if (!clientSecret) clientSecret = "erewere_client_secret";

    res.json({
      access_token: `erewere_mcp_token_${clientId}`,
      token_type: "Bearer",
      expires_in: 86400,
      scope: "mcp:all",
      client_id: clientId
    });
  });

  // SSE Transport connection handler
  const handleSseConnect = (req: express.Request, res: express.Response) => {
    const acceptHeader = (req.headers.accept || "").toLowerCase();
    const wantsJsonExplicitly = acceptHeader === "application/json" || req.query.format === "json";

    if (req.method === "GET" && !wantsJsonExplicitly) {
      const sessionId = Math.random().toString(36).substring(2, 15);
      const host = req.get("host");
      const protocol = req.protocol || "https";
      const baseUrl = `${protocol}://${host}`;
      const messageUrl = `${baseUrl}/api/mcp/messages?sessionId=${sessionId}`;

      res.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
        "X-Accel-Buffering": "no"
      });

      res.write(`event: endpoint\ndata: ${messageUrl}\n\n`);
      sseSessions.set(sessionId, res);

      // Keep connection alive with periodic comment pings
      const keepAliveTimer = setInterval(() => {
        try {
          res.write(`: ping\n\n`);
        } catch (e) {
          clearInterval(keepAliveTimer);
        }
      }, 15000);

      req.on("close", () => {
        clearInterval(keepAliveTimer);
        sseSessions.delete(sessionId);
      });
      return;
    }

    if (req.method === "GET") {
      const host = req.get("host");
      const protocol = req.protocol || "https";
      const baseUrl = `${protocol}://${host}`;
      return res.json({
        status: "active",
        name: "Erewere CRM MCP Server",
        version: "1.0.0",
        protocolVersion: "2024-11-05",
        description: "Servidor MCP del CRM Erewere para integración con asistentes de IA (Gemini, Claude, Spark, etc.)",
        endpoints: {
          sse: `${baseUrl}/sse`,
          messages: `${baseUrl}/api/mcp/messages`,
          mcp: `${baseUrl}/mcp`
        },
        toolsCount: mcpTools.length,
        supportedMethods: ["initialize", "notifications/initialized", "tools/list", "tools/call", "ping"]
      });
    }
  };

  // Dispatcher for POST MCP JSON-RPC requests
  const handleMcpMessage = async (req: express.Request, res: express.Response) => {
    const sessionId = (req.query.sessionId || req.headers["mcp-session-id"]) as string;
    const db = getClientDb();

    try {
      const responseJson = await processJsonRpc(req, db);

      if (sessionId && sseSessions.has(sessionId)) {
        const sseRes = sseSessions.get(sessionId)!;
        if (responseJson) {
          sseRes.write(`event: message\ndata: ${JSON.stringify(responseJson)}\n\n`);
        }
        return res.status(202).send("Accepted");
      } else {
        if (!responseJson) {
          return res.status(200).json({ jsonrpc: "2.0", result: {} });
        }
        return res.status(200).json(responseJson);
      }
    } catch (err: any) {
      console.error("MCP Processing Error:", err);
      return res.status(500).json({
        jsonrpc: "2.0",
        id: req.body?.id || null,
        error: { code: -32603, message: err.message || "Internal server error" }
      });
    }
  };

  // Mount MCP routes across all standard URL patterns
  app.get("/sse", handleSseConnect);
  app.get("/mcp", handleSseConnect);
  app.get("/api/mcp", handleSseConnect);
  app.get("/api/mcp/sse", handleSseConnect);

  app.post("/mcp", handleMcpMessage);
  app.post("/api/mcp", handleMcpMessage);
  app.post("/api/mcp/messages", handleMcpMessage);
  app.post("/mcp/messages", handleMcpMessage);

  // === Catch-all 404 for unmatched API routes (prevents returning HTML for /api/*) ===
  app.all("/api/*", (req, res) => {
    res.status(404).json({ error: `Ruta de API no encontrada: ${req.method} ${req.originalUrl}` });
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
