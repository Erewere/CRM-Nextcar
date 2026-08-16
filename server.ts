import { calculateLeadScore } from "./src/services/leadScoringEngine.ts";
import express from "express";
import cors from "cors";
import { GoogleGenAI, Type } from "@google/genai";


import path from "path";
import fs from "fs";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import { initializeApp, getApps, cert, App as FirebaseApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore as getAdminFirestore, FieldValue } from "firebase-admin/firestore";

import { Resend } from "resend";
import Stripe from "stripe";

// Initialize Firebase Admin lazily to avoid crashing if env is not set yet
let adminApp: FirebaseApp | null = null;


function getAdminApp() {
  if (!adminApp) {
    try {
      const existingApps = getApps();
      if (existingApps && existingApps.length > 0) {
        adminApp = existingApps[0];
      } else {
        const saB64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
        let serviceAccount: any = null;
        if (saB64) {
          try {
            const decodedJson = Buffer.from(saB64, "base64").toString("utf8");
            serviceAccount = JSON.parse(decodedJson);
          } catch (jsonErr) {
            console.warn("FIREBASE_SERVICE_ACCOUNT_B64 inválida (error al decodificar base64 o parsear JSON):", jsonErr);
          }
        }

        if (serviceAccount && serviceAccount.project_id) {
          adminApp = initializeApp({
            credential: cert(serviceAccount),
            projectId: serviceAccount.project_id,
          });
          console.log("Firebase Admin inicializado con cuenta de servicio.");
        } else {
          console.warn("FIREBASE_SERVICE_ACCOUNT_B64 no configurada o inválida: las operaciones Admin de Firestore no funcionarán.");
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
      }
    } catch (e) {
      console.warn("Could not initialize Firebase Admin app:", e);
    }
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

async function checkAdminDbAccess() {
  // Verificación de diagnóstico del Admin SDK (ejecutado en segundo plano)
  try {
    const adminDb = getAdminDb();
    if (adminDb) {
      const snap = await adminDb.collection("agencies").limit(1).get();
      console.log(`Verificación Admin SDK: lectura de Firestore OK (${snap.docs.length} documentos).`);
    } else {
      console.error("Verificación Admin SDK FALLÓ: adminDb no está disponible.");
    }
  } catch (adminCheckErr: any) {
    console.error("Verificación Admin SDK FALLÓ:", adminCheckErr?.message || adminCheckErr);
  }
}

async function startServer() {
  const app = express();
  app.set("trust proxy", true);
  app.use(cors({
    origin: true,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
  }));
  app.options("*", cors());
  // Diagnostic check for Admin SDK in background
  checkAdminDbAccess().catch((e) => console.error("Error en verificación Admin SDK:", e));

  

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

      const adminDb = getAdminDb();
      if (!adminDb) {
        return res.status(500).send("Base de datos no disponible");
      }

      // Handle the event
      switch (event.type) {
        case "checkout.session.completed":
          const checkoutSession = event.data.object as Stripe.Checkout.Session;
          const agencyId = checkoutSession.client_reference_id;
          
          if (agencyId) {
            const agencyRef = adminDb.collection("agencies").doc(agencyId);
            const updates: any = {
              updatedAt: FieldValue.serverTimestamp(),
            };
            
            // Check if this was a credit purchase
            if (checkoutSession.metadata && checkoutSession.metadata.creditsToAdd) {
               updates.aiCredits = FieldValue.increment(parseInt(checkoutSession.metadata.creditsToAdd, 10));
            } else {
               // Otherwise assume it's the main subscription
               updates.subscriptionStatus = "active";
               updates.stripeCustomerId = checkoutSession.customer;
            }
            
            // Update agency status
            await agencyRef.set(updates, { merge: true });
          }
          break;
        case "customer.subscription.updated": {
          const subscription = event.data.object as Stripe.Subscription;
          const customerId = subscription.customer as string;
          const status = subscription.status;
          const agenciesQuery = adminDb.collection("agencies").where("stripeCustomerId", "==", customerId);
          const agenciesSnapshot = await agenciesQuery.get();
          
          if (!agenciesSnapshot.empty) {
            const agencyDoc = agenciesSnapshot.docs[0];
            await agencyDoc.ref.set({ subscriptionStatus: status, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
          }
          break;
        }
        case "customer.subscription.deleted": {
          const subscription = event.data.object as Stripe.Subscription;
          const customerId = subscription.customer as string;
          // Find agency by customerId and update status
          const agenciesQuery = adminDb.collection("agencies").where("stripeCustomerId", "==", customerId);
          const agenciesSnapshot = await agenciesQuery.get();
          
          if (!agenciesSnapshot.empty) {
            const agencyDoc = agenciesSnapshot.docs[0];
            await agencyDoc.ref.set({ subscriptionStatus: "canceled", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
          }
          break;
        }
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

      const adminApp = getAdminApp();
      if (!adminApp) return res.status(500).json({ error: "Server admin app error" });

      let decodedToken;
      try {
        decodedToken = await getAuth(adminApp).verifyIdToken(token);
      } catch (tokenErr) {
        return res.status(401).json({ error: "Token inválido o expirado. Por favor, vuelve a iniciar sesión." });
      }
      
      const { agencyId, priceId, quantity, mode, metadata } = req.body;
      if (!agencyId) {
        return res.status(400).json({ error: "Falta el ID de la agencia (agencyId)" });
      }

      const adminDb = getAdminDb();
      if (!adminDb) {
        return res.status(500).json({ error: "Base de datos no disponible" });
      }
      const userDocRef = adminDb.collection("users").doc(decodedToken.uid);
      const userDoc = await userDocRef.get();
      if (!userDoc.exists) {
        return res.status(403).json({ error: "Usuario no encontrado" });
      }
      const userData = userDoc.data();
      if (userData?.role !== "master" && userData?.agencyId !== agencyId) {
        return res.status(403).json({ error: "No tienes permiso para esta agencia" });
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

      const adminDbAuth = getAdminDb();
      if (!adminDbAuth) {
        return res.status(500).json({ error: "Base de datos no disponible" });
      }

      // Verificar tener sesion no basta: sin esto, cualquier usuario con
      // cuenta -- un vendedor, alguien de taller -- podia crear una cuenta con
      // el rol que quisiera en la agencia que quisiera, master incluido.
      const llamanteDoc = await adminDbAuth.collection("users").doc(decodedToken.uid).get();
      const llamante = llamanteDoc.exists ? llamanteDoc.data() : null;
      if (!llamante || (llamante.role !== "master" && llamante.role !== "admin")) {
        return res.status(403).json({ error: "Se requiere rol admin o master" });
      }

      const { email, password, name, role, agencyId } = req.body;
      if (!email || !password || !role || !agencyId) {
        return res.status(400).json({ error: "Faltan parámetros requeridos" });
      }

      if (llamante.role === "admin" && agencyId !== llamante.agencyId) {
        return res.status(403).json({ error: "Solo puedes crear usuarios en tu propia agencia" });
      }
      if (role === "master" && llamante.role !== "master") {
        return res.status(403).json({ error: "No puedes otorgar el rol master" });
      }

      const auth = getAuth(getAdminApp()!);
      const userRecord = await auth.createUser({
        email,
        password,
        displayName: name || email.split('@')[0],
      });

      const adminDb = getAdminDb();
      if (!adminDb) {
        return res.status(500).json({ error: "Base de datos no disponible" });
      }
      await adminDb.collection("users").doc(userRecord.uid).set({
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

  // Reactivar en el CRM a alguien que ya existe en la autenticacion.
  //
  // Antes esto se resolvia en el navegador creando el documento con un
  // identificador al azar, porque el cliente no tiene manera de averiguar el
  // identificador real de la cuenta. Ese documento no era el que se consulta
  // al entrar -- la sesion busca users/{uid} -- asi que la asignacion de
  // agencia que se veia en pantalla no era la que se aplicaba al iniciar
  // sesion. Aqui si se puede resolver el identificador correcto.
  app.post("/api/admin/reactivate-user", express.json(), async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "No autorizado" });
      }
      const adminApp = getAdminApp();
      if (!adminApp) return res.status(500).json({ error: "Server admin app error" });

      let decodedToken;
      try {
        decodedToken = await getAuth(adminApp).verifyIdToken(authHeader.split("Bearer ")[1]);
      } catch (err) {
        return res.status(401).json({ error: "Token inválido" });
      }

      const adminDb = getAdminDb();
      if (!adminDb) return res.status(500).json({ error: "Base de datos no disponible" });

      const llamanteDoc = await adminDb.collection("users").doc(decodedToken.uid).get();
      const llamante = llamanteDoc.exists ? llamanteDoc.data() : null;
      if (!llamante || (llamante.role !== "master" && llamante.role !== "admin")) {
        return res.status(403).json({ error: "Se requiere rol admin o master" });
      }

      const { email, name, role, agencyId, extras } = req.body || {};
      if (!email || !role || !agencyId) {
        return res.status(400).json({ error: "Faltan parámetros requeridos" });
      }
      if (llamante.role === "admin" && agencyId !== llamante.agencyId) {
        return res.status(403).json({ error: "Solo puedes dar de alta usuarios en tu propia agencia" });
      }
      if (role === "master" && llamante.role !== "master") {
        return res.status(403).json({ error: "No puedes otorgar el rol master" });
      }

      let userRecord;
      try {
        userRecord = await getAuth(adminApp).getUserByEmail(email);
      } catch (err) {
        return res.status(404).json({ error: "Ese correo no existe en la autenticación" });
      }

      await adminDb.collection("users").doc(userRecord.uid).set({
        email,
        name: name || email.split("@")[0],
        role,
        agencyId,
        createdAt: new Date().toISOString(),
        ...(extras && typeof extras === "object" ? extras : {}),
      }, { merge: true });

      // Documentos sueltos con ese mismo correo pero otro identificador: son
      // los que quedaron del metodo anterior. No se borran aqui; se informan
      // para poder revisarlos antes de tocar nada.
      const sueltos = await adminDb.collection("users").where("email", "==", email).get();
      const duplicados = sueltos.docs
        .filter((d) => d.id !== userRecord.uid)
        .map((d) => ({ id: d.id, agencyId: d.data().agencyId, role: d.data().role }));

      res.json({ uid: userRecord.uid, duplicados });
    } catch (err: any) {
      console.error("Reactivate User Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/delete-user", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "No autorizado" });
      }

      const token = authHeader.split("Bearer ")[1];
      if (!token) {
        return res.status(401).json({ error: "No autorizado" });
      }

      const adminApp = getAdminApp();
      if (!adminApp) return res.status(500).json({ error: "Server admin app error" });

      let decodedToken;
      try {
        decodedToken = await getAuth(adminApp).verifyIdToken(token);
      } catch (err) {
        return res.status(401).json({ error: "Token inválido" });
      }

      const adminDb = getAdminDb();
      if (!adminDb) {
        return res.status(500).json({ error: "Base de datos no disponible" });
      }

      const callerDocRef = adminDb.collection("users").doc(decodedToken.uid);
      const callerDoc = await callerDocRef.get();
      if (!callerDoc.exists) {
        return res.status(403).json({ error: "Usuario no encontrado" });
      }

      const callerData = callerDoc.data();
      if (callerData?.role !== "master" && callerData?.role !== "admin") {
        return res.status(403).json({ error: "Se requiere rol admin o master" });
      }

      const { uid } = req.body;
      if (!uid) {
        return res.status(400).json({ error: "Falta el parámetro uid" });
      }

      if (uid === decodedToken.uid) {
        return res.status(400).json({ error: "No puedes eliminar tu propio usuario" });
      }

      if (callerData.role === "admin") {
        const targetDocRef = adminDb.collection("users").doc(uid);
        const targetDoc = await targetDocRef.get();
        if (!targetDoc.exists) {
          return res.status(404).json({ error: "Usuario a eliminar no encontrado" });
        }
        const targetData = targetDoc.data();
        if (targetData?.agencyId !== callerData.agencyId) {
          return res.status(403).json({ error: "No tienes permiso para eliminar usuarios de otra agencia" });
        }
      }

      // Delete from Firebase Auth
      try {
        await getAuth(adminApp).deleteUser(uid);
      } catch (authErr: any) {
        console.warn("Could not delete from Firebase Auth (ignoring):", authErr.message);
      }

      // Delete from Firestore
      await adminDb.collection("users").doc(uid).delete();

      return res.status(200).json({ success: true });
    } catch (err: any) {
      console.error("Delete User Error:", err);
      return res.status(500).json({ error: err.message || "Error al eliminar usuario" });
    }
  });

  app.post("/api/delete-agency", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "No autorizado" });
      }

      const token = authHeader.split("Bearer ")[1];
      if (!token) {
        return res.status(401).json({ error: "No autorizado" });
      }

      const adminApp = getAdminApp();
      if (!adminApp) return res.status(500).json({ error: "Server admin app error" });

      let decodedToken;
      try {
        decodedToken = await getAuth(adminApp).verifyIdToken(token);
      } catch (err) {
        return res.status(401).json({ error: "Token inválido" });
      }

      const adminDb = getAdminDb();
      if (!adminDb) {
        return res.status(500).json({ error: "Base de datos no disponible" });
      }

      const userDocRef = adminDb.collection("users").doc(decodedToken.uid);
      const userDoc = await userDocRef.get();
      if (!userDoc.exists) {
        return res.status(403).json({ error: "Usuario no encontrado" });
      }

      const userData = userDoc.data();
      if (userData?.role !== "master") {
        return res.status(403).json({ error: "Solo el rol master puede eliminar una agencia" });
      }

      const { agencyId } = req.body;
      if (!agencyId) {
        return res.status(400).json({ error: "Falta el parámetro agencyId" });
      }

      const usersSnap = await adminDb.collection("users").where("agencyId", "==", agencyId).get();
      for (const uDoc of usersSnap.docs) {
        await adminDb.collection("users").doc(uDoc.id).update({ agencyId: "unassigned" });
      }
      await adminDb.collection("agencies").doc(agencyId).delete();

      return res.status(200).json({ success: true });
    } catch (err: any) {
      console.error("Delete Agency Error:", err);
      return res.status(500).json({ error: err.message || "Error al eliminar agencia" });
    }
  });

  app.post("/api/delete-vehicle", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "No autorizado" });
      }
      const token = authHeader.split("Bearer ")[1];
      if (!token) {
        return res.status(401).json({ error: "No autorizado" });
      }

      const adminApp = getAdminApp();
      if (!adminApp) return res.status(500).json({ error: "Server admin app error" });

      let decodedToken;
      try {
        decodedToken = await getAuth(adminApp).verifyIdToken(token);
      } catch (err) {
        return res.status(401).json({ error: "Token inválido" });
      }

      const adminDb = getAdminDb();
      if (!adminDb) {
        return res.status(500).json({ error: "Base de datos no disponible" });
      }

      const callerDocRef = adminDb.collection("users").doc(decodedToken.uid);
      const callerDoc = await callerDocRef.get();
      if (!callerDoc.exists) {
        return res.status(403).json({ error: "Usuario no encontrado" });
      }
      const callerData = callerDoc.data();
      if (callerData?.role !== "master" && callerData?.role !== "admin") {
        return res.status(403).json({ error: "Se requiere rol admin o master" });
      }

      const { vehicleId } = req.body;
      if (!vehicleId) {
        return res.status(400).json({ error: "Falta el parámetro vehicleId" });
      }

      const vehicleDocRef = adminDb.collection("vehicles").doc(vehicleId);
      const vehicleDoc = await vehicleDocRef.get();
      if (!vehicleDoc.exists) {
        return res.status(404).json({ error: "Vehículo no encontrado" });
      }

      if (callerData.role === "admin") {
        const vehicleData = vehicleDoc.data();
        if (vehicleData?.agencyId !== callerData.agencyId) {
          return res.status(403).json({ error: "No tienes permiso para eliminar vehículos de otra agencia" });
        }
      }

      await vehicleDocRef.delete();

      return res.status(200).json({ success: true });
    } catch (err: any) {
      console.error("Delete Vehicle Error:", err);
      return res.status(500).json({ error: err.message || "Error al eliminar vehículo" });
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
      
      const adminDb = getAdminDb();
      if (!adminDb) {
        return res.status(500).json({ error: "Base de datos no disponible" });
      }
      const userDocRef = adminDb.collection("users").doc(decodedToken.uid);
      const userDoc = await userDocRef.get();
      if (!userDoc.exists) {
        return res.status(403).json({ error: "Usuario no encontrado" });
      }
      
      const userData = userDoc.data();
      if (userData?.role !== "master" && userData?.role !== "admin") {
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

  // === Agency WhatsApp Config (Admin/Master only) ===
  app.get("/api/agencies/whatsapp-config", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "No autorizado" });
      }
      const token = authHeader.substring(7);
      const adminApp = getAdminApp();
      if (!adminApp) return res.status(500).json({ error: "Server admin app error" });

      const decodedToken = await getAuth(adminApp).verifyIdToken(token);
      const adminDb = getAdminDb();
      if (!adminDb) return res.status(500).json({ error: "Base de datos no disponible" });

      const userDocRef = adminDb.collection("users").doc(decodedToken.uid);
      const userDoc = await userDocRef.get();
      if (!userDoc.exists) {
        return res.status(403).json({ error: "Usuario no encontrado" });
      }
      const userData = userDoc.data();
      const agencyId = (req.query.agencyId as string) || userData?.agencyId;

      if (userData?.role !== "master" && userData?.role !== "admin") {
        return res.status(403).json({ error: "Solo administradores pueden consultar la configuración de WhatsApp" });
      }
      if (userData?.role !== "master" && userData?.agencyId !== agencyId) {
        return res.status(403).json({ error: "No tienes permiso para esta agencia" });
      }

      const agencyDocRef = adminDb.collection("agencies").doc(agencyId);
      const agencySnap = await agencyDocRef.get();
      if (!agencySnap.exists) {
        return res.status(404).json({ error: "Agencia no encontrada" });
      }
      const whatsappConfig = agencySnap.data()?.whatsappConfig || {};

      const secretSnap = await agencyDocRef.collection("secrets").doc("whatsapp").get();
      const accessToken = secretSnap.exists ? secretSnap.data()?.accessToken : null;

      return res.json({
        phoneNumberId: whatsappConfig.phoneNumberId || "",
        accountId: whatsappConfig.accountId || "",
        hasAccessToken: !!accessToken,
        maskedAccessToken: accessToken ? "••••••••" + accessToken.slice(-4) : null,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/agencies/whatsapp-config", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "No autorizado" });
      }
      const token = authHeader.substring(7);
      const adminApp = getAdminApp();
      if (!adminApp) return res.status(500).json({ error: "Server admin app error" });

      const decodedToken = await getAuth(adminApp).verifyIdToken(token);
      const adminDb = getAdminDb();
      if (!adminDb) return res.status(500).json({ error: "Base de datos no disponible" });

      const userDocRef = adminDb.collection("users").doc(decodedToken.uid);
      const userDoc = await userDocRef.get();
      if (!userDoc.exists) {
        return res.status(403).json({ error: "Usuario no encontrado" });
      }
      const userData = userDoc.data();
      const { agencyId: bodyAgencyId, phoneNumberId, accountId, accessToken } = req.body;
      const targetAgencyId = bodyAgencyId || userData?.agencyId;

      if (userData?.role !== "master" && userData?.role !== "admin") {
        return res.status(403).json({ error: "Solo administradores pueden configurar WhatsApp" });
      }
      if (userData?.role !== "master" && userData?.agencyId !== targetAgencyId) {
        return res.status(403).json({ error: "No tienes permiso para esta agencia" });
      }
      if (!phoneNumberId || !accountId) {
        return res.status(400).json({ error: "Faltan phoneNumberId o accountId" });
      }

      const agencyDocRef = adminDb.collection("agencies").doc(targetAgencyId);
      await agencyDocRef.set({
        whatsappConfig: {
          phoneNumberId,
          accountId,
          updatedAt: FieldValue.serverTimestamp(),
          // Legacy field: tokens used to be stored here in plaintext, readable by
          // any authenticated user. Always strip it — the token now lives in the
          // secrets subcollection, reachable only via the Admin SDK.
          accessToken: FieldValue.delete(),
        }
      }, { merge: true });

      if (accessToken) {
        await agencyDocRef.collection("secrets").doc("whatsapp").set({
          accessToken,
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }

      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/meta/send-template", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "No autorizado" });
      }
      
      const token = authHeader.split("Bearer ")[1];
      if (!token || token === "undefined" || token === "null") {
        return res.status(401).json({ error: "No autorizado" });
      }

      const adminApp = getAdminApp();
      if (!adminApp) return res.status(500).json({ error: "Server admin app error" });

      let decodedToken;
      try {
        decodedToken = await getAuth(adminApp).verifyIdToken(token);
      } catch (e) {
        return res.status(401).json({ error: "Token inválido" });
      }

      const adminDb = getAdminDb();
      if (!adminDb) {
        return res.status(500).json({ error: "Base de datos no disponible" });
      }
      const userDocRef = adminDb.collection("users").doc(decodedToken.uid);
      const userDoc = await userDocRef.get();
      if (!userDoc.exists) {
        return res.status(403).json({ error: "Usuario no encontrado" });
      }

      // Any user attached to an agency may send (sellers share vehicles with their
      // own clients); the credentials used are always their own agency's.
      const userData = userDoc.data();
      if (!userData?.agencyId || userData.agencyId === "unassigned") {
        return res.status(403).json({ error: "Tu usuario no pertenece a una agencia" });
      }

      const { to, templateName, variables, agencyId: bodyAgencyId } = req.body;
      if (!to || !templateName) {
        return res.status(400).json({ error: "Faltan parámetros requeridos (to, templateName)" });
      }

      const targetAgencyId = (userData?.role === "master" && bodyAgencyId) ? bodyAgencyId : userData?.agencyId;
      if (!targetAgencyId) {
        return res.status(400).json({ error: "No se pudo determinar la agencia" });
      }

      const agencyDocRef = adminDb.collection("agencies").doc(targetAgencyId);
      const agencySnap = await agencyDocRef.get();
      if (!agencySnap.exists) {
        return res.status(404).json({ error: "Agencia no encontrada" });
      }
      const phoneNumberId = agencySnap.data()?.whatsappConfig?.phoneNumberId;

      const secretSnap = await agencyDocRef.collection("secrets").doc("whatsapp").get();
      const accessToken = secretSnap.exists ? secretSnap.data()?.accessToken : null;

      if (!phoneNumberId || !accessToken) {
        return res.status(400).json({ error: "WhatsApp no está configurado para esta agencia. Ve a Integraciones para conectarlo." });
      }

      const metaRes = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "template",
          template: {
            name: templateName,
            language: { code: "es_MX" },
            ...(variables && variables.length ? { components: [{ type: "body", parameters: variables }] } : {}),
          },
        }),
      });

      const metaData: any = await metaRes.json();
      if (!metaRes.ok) {
        console.error("Meta API error:", metaData);
        return res.status(metaRes.status).json({ error: metaData?.error?.message || "Error al enviar el mensaje de WhatsApp" });
      }

      res.json({ success: true, messageId: metaData?.messages?.[0]?.id });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message || "Error al enviar plantilla" });
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
        const adminDb = getAdminDb();
        if (!adminDb) {
          return res.status(500).json({ error: "Base de datos no disponible" });
        }
        for (const entry of body.entry) {
          const entryId = entry.id; // page_id for Messenger, waba_id for WhatsApp

          // For WhatsApp: resolve the owning agency by the phone_number_id that
          // received the message (the value configured per-agency in Integraciones),
          // not by the WABA id — a single WhatsApp Business Account can host
          // multiple phone numbers belonging to different agencies.
          if (body.object === "whatsapp_business_account" && entry.changes) {
            for (const change of entry.changes) {
              const value = change.value;
              if (value && value.messages && value.messages[0]) {
                const phoneNumberId = value.metadata?.phone_number_id;
                const agenciesRef = adminDb.collection("agencies");
                const q = agenciesRef.where("whatsappConfig.phoneNumberId", "==", phoneNumberId);
                const snapshot = await q.get();
                if (snapshot.empty) {
                  console.warn(`No agency configured for WhatsApp phone_number_id ${phoneNumberId}, skipping message`);
                  continue;
                }
                const agencyId = snapshot.docs[0].id;

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
          // For Messenger: resolve the owning agency by the Facebook Page id.
          if (body.object === "page" && entry.messaging) {
            const agenciesRef = adminDb.collection("agencies");
            const q = agenciesRef.where("facebookPageId", "==", entryId);
            const snapshot = await q.get();
            if (snapshot.empty) {
              console.warn(`No agency configured for Messenger page ${entryId}, skipping messages`);
              continue;
            }
            const agencyId = snapshot.docs[0].id;
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
    if (!adminDb) return;
    const clientsRef = adminDb.collection("clients");
    
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
    await clientsRef.add(newClient);
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
  // El inventario publico se consulta en bucle desde el navegador para mostrar
  // el inventario compartido entre agencias. Se guarda la respuesta un rato
  // para que un cliente insistente no se traduzca en lecturas repetidas de
  // Firestore: el inventario de otra agencia no cambia de un segundo a otro.
  const CACHE_INVENTARIO_MS = 60 * 1000;
  const cacheInventario = new Map<string, { momento: number; vehicles: any[] }>();

  app.get("/api/public/v1/inventory", async (req, res) => {
    try {
      const agencyId = req.query.agencyId as string;
      if (!agencyId) {
        return res.status(400).json({ error: "agencyId is required" });
      }

      const guardado = cacheInventario.get(agencyId);
      if (guardado && Date.now() - guardado.momento < CACHE_INVENTARIO_MS) {
        return res.json({ vehicles: guardado.vehicles, cached: true });
      }

      const adminDb = getAdminDb();
      if (!adminDb) {
        return res.status(500).json({ error: "Base de datos no disponible" });
      }

      const q = adminDb
        .collection("vehicles")
        .where("agencyId", "==", agencyId)
        .where("status", "==", "available");
      const snapshot = await q.get();

      const vehicles = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          make: data.make,
          model: data.model,
          year: data.year,
          color: data.color,
          transmission: data.transmission,
          bodyType: data.bodyType,
          price: data.price,
          photoUrl: data.photoUrl,
          photoUrls: data.photoUrls,
          km: data.km,
          status: data.status,
          ...(data.description !== undefined ? { description: data.description } : {})
        };
      });
      cacheInventario.set(agencyId, { momento: Date.now(), vehicles });
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

      const adminDb = getAdminDb();
      if (!adminDb) {
        return res.status(500).json({ error: "Base de datos no disponible" });
      }

      // Validate sellerId: check if user exists and belongs to the given agency
      let validatedSellerId = "";
      if (sellerId && typeof sellerId === "string" && sellerId.trim() !== "") {
        try {
          const sellerDocRef = adminDb.collection("users").doc(sellerId.trim());
          const sellerSnap = await sellerDocRef.get();
          if (sellerSnap.exists) {
            const sellerData = sellerSnap.data();
            if (sellerData && sellerData.agencyId === agencyId) {
              validatedSellerId = sellerId.trim();
            }
          }
        } catch (sErr) {
          console.warn("Error validating sellerId for public lead:", sErr);
        }
      }

      const newClient = {
        agencyId,
        name,
        phone: phone || "",
        email: email || "",
        vehicle: vehicle || "",
        origin: origin || "website",
        status: "new",
        sellerId: validatedSellerId,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      };
      
      const docRef = await adminDb.collection("clients").add(newClient);

      res.status(201).json({ success: true, leadId: docRef.id });
    } catch (e: any) {
      res.status(500).json({ error: e.message, stack: e.stack });
    }
  });

  // === Agency MCP API Key Management (Admin/Master only) ===
  app.get("/api/agencies/mcp-key", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "No autorizado" });
      }
      const token = authHeader.substring(7);
      const adminApp = getAdminApp();
      if (!adminApp) return res.status(500).json({ error: "Server admin app error" });
      
      const decodedToken = await getAuth(adminApp).verifyIdToken(token);
      const adminDb = getAdminDb();
      if (!adminDb) return res.status(500).json({ error: "Base de datos no disponible" });

      const userDocRef = adminDb.collection("users").doc(decodedToken.uid);
      const userDoc = await userDocRef.get();
      if (!userDoc.exists) {
        return res.status(403).json({ error: "Usuario no encontrado" });
      }
      const userData = userDoc.data();
      const agencyId = (req.query.agencyId as string) || userData?.agencyId;
      
      if (userData?.role !== "master" && userData?.role !== "admin") {
        return res.status(403).json({ error: "Solo administradores pueden consultar la clave MCP" });
      }
      if (userData?.role !== "master" && userData?.agencyId !== agencyId) {
        return res.status(403).json({ error: "No tienes permiso para esta agencia" });
      }

      const agencyDocRef = adminDb.collection("agencies").doc(agencyId);
      const agencySnap = await agencyDocRef.get();
      if (!agencySnap.exists) {
        return res.status(404).json({ error: "Agencia no encontrada" });
      }
      const agencyData = agencySnap.data();
      const apiKey = agencyData?.mcpApiKey || null;

      if (apiKey) {
        return res.json({
          hasKey: true,
          maskedKey: "••••••••" + apiKey.slice(-4),
          createdAt: agencyData?.mcpApiKeyCreatedAt || null
        });
      } else {
        return res.json({ hasKey: false, maskedKey: null });
      }
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/agencies/mcp-key", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "No autorizado" });
      }
      const token = authHeader.substring(7);
      const adminApp = getAdminApp();
      if (!adminApp) return res.status(500).json({ error: "Server admin app error" });
      
      const decodedToken = await getAuth(adminApp).verifyIdToken(token);
      const adminDb = getAdminDb();
      if (!adminDb) return res.status(500).json({ error: "Base de datos no disponible" });

      const userDocRef = adminDb.collection("users").doc(decodedToken.uid);
      const userDoc = await userDocRef.get();
      if (!userDoc.exists) {
        return res.status(403).json({ error: "Usuario no encontrado" });
      }
      const userData = userDoc.data();
      const { agencyId } = req.body;
      const targetAgencyId = agencyId || userData?.agencyId;

      if (userData?.role !== "master" && userData?.role !== "admin") {
        return res.status(403).json({ error: "Solo administradores pueden generar claves MCP" });
      }
      if (userData?.role !== "master" && userData?.agencyId !== targetAgencyId) {
        return res.status(403).json({ error: "No tienes permiso para esta agencia" });
      }

      const newKey = `erewere_mcp_` + crypto.randomBytes(24).toString("hex");

      await adminDb.collection("agencies").doc(targetAgencyId).update({
        mcpApiKey: newKey,
        mcpApiKeyCreatedAt: FieldValue.serverTimestamp()
      });

      return res.json({
        success: true,
        mcpApiKey: newKey,
        maskedKey: "••••••••" + newKey.slice(-4)
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // === Respaldo completo de la base (exclusivo del rol master) ===
  // Descarga un JSON con todas las colecciones de todas las agencias.
  app.get("/api/admin/backup", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "No autorizado" });
      }
      const token = authHeader.substring(7);

      const adminApp = getAdminApp();
      if (!adminApp) return res.status(500).json({ error: "Server admin app error" });

      let decodedToken;
      try {
        decodedToken = await getAuth(adminApp).verifyIdToken(token);
      } catch (tokenErr) {
        return res.status(401).json({ error: "Token inválido" });
      }

      const adminDb = getAdminDb();
      if (!adminDb) return res.status(500).json({ error: "Base de datos no disponible" });

      const userDoc = await adminDb.collection("users").doc(decodedToken.uid).get();
      if (!userDoc.exists) {
        return res.status(403).json({ error: "Usuario no encontrado" });
      }
      const requester = userDoc.data() || {};
      if (requester.role !== "master") {
        return res.status(403).json({ error: "Solo el usuario master puede descargar el respaldo" });
      }

      const collectionNames = [
        "agencies",
        "clients",
        "deals",
        "vehicles",
        "vehicleExpenses",
        "tasks",
        "notes",
        "files",
        "agency_tags",
        "users",
      ];

      const backup: Record<string, any[]> = {};

      for (const name of collectionNames) {
        const snapshot = await adminDb.collection(name).get();
        backup[name] = snapshot.docs.map((d: any) => ({ ...d.data(), id: d.id }));
      }

      // La clave MCP no debe viajar dentro del respaldo
      backup.agencies = backup.agencies.map((a: any) => {
        const { mcpApiKey, ...rest } = a;
        return rest;
      });

      const totals: Record<string, number> = {};
      for (const key of Object.keys(backup)) {
        totals[key] = backup[key].length;
      }

      const payload = {
        exportedAt: new Date().toISOString(),
        exportedBy: decodedToken.uid,
        scope: "todas las agencias",
        totals,
        data: backup,
      };

      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="respaldo-crm-${stamp}.json"`
      );
      return res.status(200).send(JSON.stringify(payload, null, 2));
    } catch (err: any) {
      console.error("Backup error:", err);
      return res.status(500).json({ error: err.message || "Error generando el respaldo" });
    }
  });

  // === Fase 1 de la separacion contacto/trato: crear los tratos faltantes ===
  // Hoy muchos contactos guardan dentro de si mismos los datos de su trato.
  // Esta rutina crea el documento correspondiente en "deals" cuando no existe,
  // sin modificar ni borrar nada del contacto.
  //
  // Por defecto corre en modo simulacion. Solo escribe si se envia
  // { "apply": true } en el cuerpo de la peticion.
  // === Separacion de los datos financieros del vehiculo ===
  // Copia el precio de compra a la coleccion vehicleFinancials, que se puede
  // cerrar por reglas de forma independiente. Firestore no sabe ocultar campos
  // sueltos de un documento: o deja leer el vehiculo entero, o no lo deja. Por
  // eso, mientras el costo viva dentro del vehiculo, ocultarlo en pantalla es
  // solo cosmetico.
  //
  // Esta rutina no borra nada del vehiculo. La limpieza es un paso posterior,
  // una vez verificado que la aplicacion lee del lugar nuevo.
  // Revision de usuarios: compara cada ficha del CRM contra la cuenta real de
  // la autenticacion.
  //
  // Son dos cosas distintas y desde la base de datos no se distinguen: la
  // ficha guarda el rol y la agencia, la cuenta es con lo que se inicia
  // sesion. Al entrar se busca la ficha cuyo identificador coincide con el de
  // la cuenta. Si una cuenta se borra y se vuelve a crear, la nueva recibe
  // otro identificador y la ficha anterior se queda ahi, visible en la lista
  // de usuarios, aparentando un acceso que ya no existe.
  //
  // Solo lee. No modifica ni borra nada.
  // Comprobacion final de toda la plataforma: que ningun vehiculo, de ninguna
  // agencia, siga guardando el precio de compra dentro de si mismo.
  //
  // Las migraciones se corren agencia por agencia, asi que es facil dejar una
  // sin hacer y creer que el costo esta protegido cuando en esa agencia sigue
  // siendo legible por cualquiera que pueda ver el inventario. Solo lee.
  // Panel de control de la plataforma.
  //
  // Todo se calcula aqui, con el SDK de administrador, y al navegador solo
  // viajan numeros. Asi el master puede ver como va cada agencia sin que su
  // sesion tenga que leer los contactos, los tratos ni el inventario de nadie:
  // saber cuantos hay no exige poder verlos.
  //
  // Se usan conteos agregados en vez de traer los documentos. Firestore los
  // cobra a una lectura por cada mil, de modo que el panel entero cuesta unas
  // pocas lecturas en lugar de una por registro.
  app.get("/api/admin/platform-stats", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "No autorizado" });
      }
      const adminApp = getAdminApp();
      if (!adminApp) return res.status(500).json({ error: "Server admin app error" });

      let decodedToken;
      try {
        decodedToken = await getAuth(adminApp).verifyIdToken(authHeader.substring(7));
      } catch (err) {
        return res.status(401).json({ error: "Token inválido" });
      }

      const adminDb = getAdminDb();
      if (!adminDb) return res.status(500).json({ error: "Base de datos no disponible" });

      const userDoc = await adminDb.collection("users").doc(decodedToken.uid).get();
      if (!userDoc.exists || userDoc.data()?.role !== "master") {
        return res.status(403).json({ error: "Se requiere rol master" });
      }

      const agenciasSnap = await adminDb.collection("agencies").get();

      const contar = async (coleccion: string, agencyId: string) => {
        try {
          const agg = await adminDb
            .collection(coleccion)
            .where("agencyId", "==", agencyId)
            .count()
            .get();
          return agg.data().count as number;
        } catch {
          return -1; // -1 distingue "fallo el conteo" de "hay cero"
        }
      };

      const ahora = Date.now();
      const agencias: any[] = [];

      for (const doc of agenciasSnap.docs) {
        const a: any = doc.data() || {};

        const [usuarios, vehiculos, contactos, tratos] = await Promise.all([
          contar("users", doc.id),
          contar("vehicles", doc.id),
          contar("clients", doc.id),
          contar("deals", doc.id),
        ]);

        // Estado real de acceso, con la misma logica que usa la aplicacion:
        // la fecha de fin de prueba manda sobre la de creacion.
        const finPrueba = a.trialEndsAt ? new Date(a.trialEndsAt).getTime() : null;
        const enPrueba = finPrueba !== null && finPrueba > ahora;
        const estado = a.hasFreeAccess
          ? "cortesia"
          : a.subscriptionStatus === "active"
          ? "activa"
          : enPrueba
          ? "prueba"
          : "sin acceso";

        // Cuantos usuarios paga contra cuantos tiene. Stripe fija la cantidad
        // al contratar y nadie la actualiza despues, asi que una agencia que
        // crece sigue pagando por los que tenia el primer dia.
        let usuariosFacturados: number | null = null;
        if (a.stripeCustomerId) {
          try {
            const subs = await getStripe().subscriptions.list({
              customer: a.stripeCustomerId,
              status: "active",
              limit: 1,
            });
            const linea = subs.data[0]?.items?.data?.[0];
            if (linea) usuariosFacturados = linea.quantity ?? null;
          } catch (e) {
            usuariosFacturados = null;
          }
        }

        agencias.push({
          id: doc.id,
          nombre: a.name || doc.id,
          estado,
          diasDePruebaRestantes:
            enPrueba && finPrueba ? Math.ceil((finPrueba - ahora) / 86400000) : null,
          usuarios,
          usuariosFacturados,
          sinFacturar:
            usuariosFacturados !== null && usuarios > usuariosFacturados
              ? usuarios - usuariosFacturados
              : 0,
          vehiculos,
          contactos,
          tratos,
        });
      }

      agencias.sort((x, y) => y.usuarios - x.usuarios);

      const activas = agencias.filter((a) => a.estado === "activa");
      const totalSinFacturar = agencias.reduce((s, a) => s + a.sinFacturar, 0);
      const facturados = agencias.reduce((s, a) => s + (a.usuariosFacturados || 0), 0);

      res.json({
        generadoEl: new Date().toISOString(),
        precioPorUsuario: Number(process.env.VITE_STRIPE_PRICE_AMOUNT) || 199,
        totales: {
          agencias: agencias.length,
          activas: activas.length,
          enPrueba: agencias.filter((a) => a.estado === "prueba").length,
          cortesia: agencias.filter((a) => a.estado === "cortesia").length,
          sinAcceso: agencias.filter((a) => a.estado === "sin acceso").length,
          usuarios: agencias.reduce((s, a) => s + Math.max(a.usuarios, 0), 0),
          usuariosFacturados: facturados,
          usuariosSinFacturar: totalSinFacturar,
          vehiculos: agencias.reduce((s, a) => s + Math.max(a.vehiculos, 0), 0),
          contactos: agencias.reduce((s, a) => s + Math.max(a.contactos, 0), 0),
          tratos: agencias.reduce((s, a) => s + Math.max(a.tratos, 0), 0),
        },
        agencias,
      });
    } catch (e: any) {
      console.error("Platform stats error:", e);
      res.status(500).json({ error: "Error interno", details: e.message });
    }
  });

  // Contactos repetidos dentro de una agencia.
  //
  // La aplicacion los esconde: deduplicateClients descarta, en catorce
  // pantallas, cualquier contacto cuyo nombre ya haya aparecido. Eso deja tres
  // problemas fuera de la vista. Dos personas distintas que se llamen igual
  // desaparecen una a la otra. La copia que se muestra es la del identificador
  // menor, no la que tiene la historia, de modo que se puede estar editando la
  // equivocada. Y como no se ven, se siguen creando.
  //
  // Esta revision es para el administrador de su propia agencia, no para el
  // master: listarle nombres de clientes reabriria el acceso que se le quito.
  // Solo lee.
  app.get("/api/admin/audit-duplicate-clients", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "No autorizado" });
      }
      const adminApp = getAdminApp();
      if (!adminApp) return res.status(500).json({ error: "Server admin app error" });

      let decodedToken;
      try {
        decodedToken = await getAuth(adminApp).verifyIdToken(authHeader.substring(7));
      } catch (err) {
        return res.status(401).json({ error: "Token inválido" });
      }

      const adminDb = getAdminDb();
      if (!adminDb) return res.status(500).json({ error: "Base de datos no disponible" });

      const llamanteDoc = await adminDb.collection("users").doc(decodedToken.uid).get();
      const llamante = llamanteDoc.exists ? llamanteDoc.data() : null;
      if (!llamante || llamante.role !== "admin") {
        return res.status(403).json({
          error: "Solo el administrador de una agencia puede revisar sus contactos",
        });
      }
      const agencyId = llamante.agencyId;
      if (!agencyId || agencyId === "unassigned") {
        return res.status(400).json({ error: "Tu usuario no pertenece a una agencia" });
      }

      const porAgencia = (col: string) =>
        adminDb.collection(col).where("agencyId", "==", agencyId).get();

      const [clientes, tratos, tareas, notas] = await Promise.all([
        porAgencia("clients"),
        porAgencia("deals"),
        porAgencia("tasks"),
        porAgencia("notes"),
      ]);

      const contarPorCliente = (snap: any) => {
        const mapa = new Map<string, number>();
        snap.docs.forEach((d: any) => {
          const cid = d.data().clientId;
          if (cid) mapa.set(cid, (mapa.get(cid) || 0) + 1);
        });
        return mapa;
      };
      const nTratos = contarPorCliente(tratos);
      const nTareas = contarPorCliente(tareas);
      const nNotas = contarPorCliente(notas);

      // Se agrupa con el mismo criterio con el que la pantalla los esconde:
      // el nombre en minusculas y sin espacios sobrantes.
      const grupos = new Map<string, any[]>();
      clientes.docs.forEach((d: any) => {
        const c = d.data() || {};
        const clave = String(c.name || "").trim().toLowerCase();
        if (!clave) return;
        const lista = grupos.get(clave) || [];
        lista.push({
          id: d.id,
          nombre: c.name,
          telefono: c.phone || null,
          correo: c.email || null,
          creado: c.createdAt || null,
          tratos: nTratos.get(d.id) || 0,
          tareas: nTareas.get(d.id) || 0,
          notas: nNotas.get(d.id) || 0,
        });
        grupos.set(clave, lista);
      });

      const repetidos: any[] = [];
      let copiasDeMas = 0;
      let copiasConHistoriaOcultas = 0;

      grupos.forEach((copias) => {
        if (copias.length < 2) return;
        copiasDeMas += copias.length - 1;

        // Firestore devuelve por identificador ascendente cuando no se pide
        // otro orden, asi que la copia visible hoy es la del id menor.
        const visible = [...copias].sort((a, b) => (a.id < b.id ? -1 : 1))[0].id;

        const conActividad = copias.map((c) => ({
          ...c,
          actividad: c.tratos + c.tareas + c.notas,
          esLaQueVes: c.id === visible,
        }));
        conActividad.sort((a, b) => b.actividad - a.actividad);

        // Lo que importa es si hay TRATOS fuera de la copia visible. Antes se
        // comparaba la suma de tratos, tareas y notas, y unas cuantas notas en
        // la copia visible tapaban una venta escondida en otra.
        const tratosOcultos = conActividad
          .filter((c) => !c.esLaQueVes)
          .reduce((s, c) => s + c.tratos, 0);
        if (tratosOcultos > 0) copiasConHistoriaOcultas++;

        repetidos.push({
          nombre: copias[0].nombre,
          copias: conActividad,
          tratosOcultos,
        });
      });

      repetidos.sort((a, b) => b.copias.length - a.copias.length);

      res.json({
        agencia: agencyId,
        resumen: {
          contactosTotales: clientes.size,
          nombresRepetidos: repetidos.length,
          copiasDeMas,
          casosConTratosEnCopiasOcultas: copiasConHistoriaOcultas,
        },
        repetidos,
      });
    } catch (e: any) {
      console.error("Audit duplicate clients error:", e);
      res.status(500).json({ error: "Error interno", details: e.message });
    }
  });

  // Fusionar los contactos repetidos de una agencia.
  //
  // Sobrevive la copia que el CRM muestra hoy -- la del identificador menor --
  // porque es la que el equipo abre y edita. Todo lo que cuelga de las demas
  // (tratos, tareas, notas y archivos) se le reasigna antes de borrarlas: hay
  // tratos enteros colgando de contactos que no aparecen en pantalla, y
  // borrarlos sin mas seria perder ventas.
  //
  // Los campos vacios de la que sobrevive se completan con lo que tengan las
  // otras, nunca al reves: nada de lo que ya tiene se sobrescribe.
  app.post("/api/admin/merge-duplicate-clients", express.json(), async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "No autorizado" });
      }
      const adminApp = getAdminApp();
      if (!adminApp) return res.status(500).json({ error: "Server admin app error" });

      let decodedToken;
      try {
        decodedToken = await getAuth(adminApp).verifyIdToken(authHeader.substring(7));
      } catch (err) {
        return res.status(401).json({ error: "Token inválido" });
      }

      const adminDb = getAdminDb();
      if (!adminDb) return res.status(500).json({ error: "Base de datos no disponible" });

      const llamanteDoc = await adminDb.collection("users").doc(decodedToken.uid).get();
      const llamante = llamanteDoc.exists ? llamanteDoc.data() : null;
      if (!llamante || llamante.role !== "admin") {
        return res.status(403).json({ error: "Solo el administrador de una agencia puede fusionar sus contactos" });
      }
      const agencyId = llamante.agencyId;
      if (!agencyId || agencyId === "unassigned") {
        return res.status(400).json({ error: "Tu usuario no pertenece a una agencia" });
      }

      const apply = req.body?.apply === true;
      const VINCULADAS = ["deals", "tasks", "notes", "files"];
      const NO_COPIAR = new Set(["id", "agencyId", "createdAt", "originalClientId"]);

      const porAgencia = (col: string) =>
        adminDb.collection(col).where("agencyId", "==", agencyId).get();

      const [clientes, ...vinculadas] = await Promise.all([
        porAgencia("clients"),
        ...VINCULADAS.map(porAgencia),
      ]);

      const grupos = new Map<string, any[]>();
      clientes.docs.forEach((d: any) => {
        const clave = String((d.data() || {}).name || "").trim().toLowerCase();
        if (!clave) return;
        const lista = grupos.get(clave) || [];
        lista.push(d);
        grupos.set(clave, lista);
      });

      const detalle: any[] = [];
      let gruposFusionados = 0;
      let registrosMovidos = 0;
      let copiasBorradas = 0;
      let camposCompletados = 0;

      for (const [, docs] of grupos) {
        if (docs.length < 2) continue;
        gruposFusionados++;

        const ordenados = [...docs].sort((a, b) => (a.id < b.id ? -1 : 1));
        const sobrevive = ordenados[0];
        const sobran = ordenados.slice(1);
        const idsSobran = new Set(sobran.map((d) => d.id));

        // Que se le reasigna
        const movimientos: Record<string, number> = {};
        const pendientes: { ref: any }[] = [];
        VINCULADAS.forEach((col, i) => {
          const encontrados = vinculadas[i].docs.filter((d: any) => idsSobran.has(d.data().clientId));
          if (encontrados.length) movimientos[col] = encontrados.length;
          encontrados.forEach((d: any) => pendientes.push({ ref: d.ref }));
        });

        // Que campos vacios se le completan
        const datosSobrevive = sobrevive.data() || {};
        const completar: Record<string, any> = {};
        for (const otro of sobran) {
          for (const [k, v] of Object.entries(otro.data() || {})) {
            if (NO_COPIAR.has(k)) continue;
            const actual = datosSobrevive[k];
            const vacio = actual === undefined || actual === null || actual === "";
            const aporta = v !== undefined && v !== null && v !== "";
            if (vacio && aporta && completar[k] === undefined) completar[k] = v;
          }
        }

        if (apply) {
          for (const p of pendientes) {
            await p.ref.update({ clientId: sobrevive.id });
            registrosMovidos++;
          }
          if (Object.keys(completar).length) {
            await sobrevive.ref.set(completar, { merge: true });
            camposCompletados += Object.keys(completar).length;
          }
          for (const otro of sobran) {
            await otro.ref.delete();
            copiasBorradas++;
          }
        } else {
          registrosMovidos += pendientes.length;
          camposCompletados += Object.keys(completar).length;
          copiasBorradas += sobran.length;
        }

        detalle.push({
          nombre: datosSobrevive.name,
          texto:
            `se queda ${sobrevive.id} · se borran ${sobran.length} copias · ` +
            `se le pasan ${Object.entries(movimientos).map(([c, n]) => `${n} de ${c}`).join(", ") || "ningún registro"}` +
            (Object.keys(completar).length ? ` · se le completan: ${Object.keys(completar).join(", ")}` : ""),
        });
      }

      res.json({
        modo: apply ? "APLICADO" : "SIMULACION (no se escribió nada)",
        agencia: agencyId,
        resumen: {
          nombresRepetidos: gruposFusionados,
          registrosReasignados: registrosMovidos,
          camposCompletados,
          copiasBorradas,
        },
        detalle,
      });
    } catch (e: any) {
      console.error("Merge duplicate clients error:", e);
      res.status(500).json({ error: "Error interno", details: e.message });
    }
  });

  app.get("/api/admin/audit-costs", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "No autorizado" });
      }
      const adminApp = getAdminApp();
      if (!adminApp) return res.status(500).json({ error: "Server admin app error" });

      let decodedToken;
      try {
        decodedToken = await getAuth(adminApp).verifyIdToken(authHeader.substring(7));
      } catch (err) {
        return res.status(401).json({ error: "Token inválido" });
      }

      const adminDb = getAdminDb();
      if (!adminDb) return res.status(500).json({ error: "Base de datos no disponible" });

      const userDoc = await adminDb.collection("users").doc(decodedToken.uid).get();
      if (!userDoc.exists || userDoc.data()?.role !== "master") {
        return res.status(403).json({ error: "Se requiere rol master" });
      }

      const [vehiculos, financieros, agencias] = await Promise.all([
        adminDb.collection("vehicles").get(),
        adminDb.collection("vehicleFinancials").get(),
        adminDb.collection("agencies").get(),
      ]);

      const nombreAgencia = new Map<string, string>();
      agencias.docs.forEach((d: any) => nombreAgencia.set(d.id, d.data().name || d.id));

      const conCopia = new Set(financieros.docs.map((d: any) => d.id));

      // Por agencia: cuantos siguen con el campo dentro y cuantos no tienen
      // copia en ninguna parte.
      const porAgencia = new Map<string, { conCampo: number; sinCopia: number; total: number }>();

      vehiculos.docs.forEach((d: any) => {
        const v = d.data() || {};
        const ag = v.agencyId || "(sin agencia)";
        const acc = porAgencia.get(ag) || { conCampo: 0, sinCopia: 0, total: 0 };
        acc.total++;
        if (v.purchasePrice !== undefined && v.purchasePrice !== null) acc.conCampo++;
        if (!conCopia.has(d.id)) acc.sinCopia++;
        porAgencia.set(ag, acc);
      });

      const detalle: any[] = [];
      let totalConCampo = 0;

      porAgencia.forEach((acc, ag) => {
        totalConCampo += acc.conCampo;
        const nombre = nombreAgencia.get(ag) || ag;
        if (acc.conCampo > 0) {
          detalle.push({
            nombre,
            texto: `FALTA MIGRAR — ${acc.conCampo} de ${acc.total} vehiculos siguen con el costo dentro. Correr las dos migraciones en esta agencia (${ag}).`,
          });
        } else {
          detalle.push({
            nombre,
            texto: `limpia — ${acc.total} vehiculos, ninguno guarda el costo dentro de si mismo`,
          });
        }
      });

      res.json({
        modo: totalConCampo === 0
          ? "TODO LIMPIO (solo lectura)"
          : "FALTAN AGENCIAS POR MIGRAR (solo lectura)",
        agencia: "todas",
        resumen: {
          agenciasConVehiculos: porAgencia.size,
          vehiculosTotales: vehiculos.size,
          vehiculosQueAunGuardanElCosto: totalConCampo,
          registrosDeCostoAparte: financieros.size,
        },
        detalle,
      });
    } catch (e: any) {
      console.error("Audit costs error:", e);
      res.status(500).json({ error: "Error interno", details: e.message });
    }
  });

  app.get("/api/admin/audit-users", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "No autorizado" });
      }
      const adminApp = getAdminApp();
      if (!adminApp) return res.status(500).json({ error: "Server admin app error" });

      let decodedToken;
      try {
        decodedToken = await getAuth(adminApp).verifyIdToken(authHeader.split("Bearer ")[1]);
      } catch (err) {
        return res.status(401).json({ error: "Token inválido" });
      }

      const adminDb = getAdminDb();
      if (!adminDb) return res.status(500).json({ error: "Base de datos no disponible" });

      const llamanteDoc = await adminDb.collection("users").doc(decodedToken.uid).get();
      if (!llamanteDoc.exists || llamanteDoc.data()?.role !== "master") {
        return res.status(403).json({ error: "Se requiere rol master" });
      }

      const fichas = await adminDb.collection("users").get();

      // Un correo puede repetirse en varias fichas; su cuenta se busca una vez.
      const correos = [...new Set(fichas.docs.map((d) => d.data().email).filter(Boolean))];
      const uidPorCorreo = new Map<string, string | null>();
      for (const correo of correos) {
        try {
          const cuenta = await getAuth(adminApp).getUserByEmail(correo);
          uidPorCorreo.set(correo, cuenta.uid);
        } catch {
          uidPorCorreo.set(correo, null);
        }
      }

      let correctas = 0;
      const problemas: any[] = [];
      const avisos: any[] = [];

      for (const d of fichas.docs) {
        const datos = d.data();
        const uidVivo = datos.email ? uidPorCorreo.get(datos.email) : null;

        if (uidVivo && uidVivo === d.id) {
          correctas++;
          continue;
        }

        // Una ficha sin correo no se puede buscar por correo, pero su propio
        // identificador si puede corresponder a una cuenta real. Sin esta
        // comprobacion se reportaba como huerfana sin haberlo verificado.
        let cuentaPorUid: string | null = null;
        try {
          const cuenta = await getAuth(adminApp).getUser(d.id);
          cuentaPorUid = cuenta.email || "(cuenta sin correo)";
        } catch {
          cuentaPorUid = null;
        }

        const comun = `ficha ${d.id} · rol ${datos.role || "?"} · agencia ${datos.agencyId || "?"}`;

        // Esta ficha esta sana; se lista solo para dejar ver de quien es. No
        // se cuenta como problema, o los totales no cuadrarian.
        if (cuentaPorUid && !datos.email) {
          correctas++;
          avisos.push({
            nombre: datos.name || d.id,
            texto: `FICHA SIN CORREO — ${comun} · la cuenta existe y su correo es ${cuentaPorUid}`,
          });
          continue;
        }

        problemas.push({
          nombre: datos.name || datos.email || d.id,
          texto: uidVivo
            ? `IDENTIFICADOR VIEJO — ${comun} · ${datos.email} · la cuenta viva es ${uidVivo}`
            : `SIN CUENTA — ${comun} · ${datos.email || "sin correo"}`,
        });
      }

      res.json({
        modo: "REVISION (solo lectura)",
        agencia: "todas",
        resumen: {
          fichasTotales: fichas.size,
          fichasCorrectas: correctas,
          fichasConProblema: problemas.length,
        },
        detalle: [...problemas, ...avisos],
      });
    } catch (err: any) {
      console.error("Audit Users Error:", err);
      res.status(500).json({ error: err.message });
    }
  });
  // === Model Context Protocol (MCP) Server Implementation ===
  const sseSessions = new Map<string, { res: express.Response; agencyId: string }>();

  // In-memory storage for short-lived OAuth authorization codes
  const oauthAuthCodes = new Map<string, {
    agencyId: string;
    mcpApiKey: string;
    redirectUri: string;
    codeChallenge: string;
    codeChallengeMethod: string;
    expiresAt: number;
  }>();

  // Helper function to find agency by MCP API Key directly
  const findAgencyByMcpKey = async (apiKey: string, db: any): Promise<{ agencyId: string; agencyName?: string; mcpApiKey?: string } | null> => {
    if (!apiKey || typeof apiKey !== "string" || apiKey.trim() === "") {
      return null;
    }

    try {
      const agenciesRef = db.collection("agencies");
      const q = agenciesRef.where("mcpApiKey", "==", apiKey.trim());
      const snapshot = await q.get();

      if (snapshot.empty) {
        return null;
      }

      const agencyDoc = snapshot.docs[0];
      const data = agencyDoc.data();
      return {
        agencyId: agencyDoc.id,
        agencyName: data.name || "Agencia",
        mcpApiKey: data.mcpApiKey || apiKey.trim()
      };
    } catch (err) {
      console.error("Error authenticating MCP API key:", err);
      return null;
    }
  };

  // Helper function to validate MCP API Key from request against Firestore agencies
  const authenticateMcpKey = async (req: express.Request, db: any): Promise<{ agencyId: string; agencyName?: string; mcpApiKey?: string } | null> => {
    let apiKey = "";
    const authHeader = req.headers.authorization || "";
    if (authHeader.startsWith("Bearer ")) {
      apiKey = authHeader.substring(7).trim();
    } else if (authHeader) {
      apiKey = authHeader.trim();
    }

    if (!apiKey) {
      apiKey = (req.headers["x-api-key"] as string) || (req.query?.apiKey as string) || (req.query?.token as string) || "";
    }

    return await findAgencyByMcpKey(apiKey, db);
  };

  const verifyPkce = (codeVerifier: string, codeChallenge: string, method: string): boolean => {
    if (!codeChallenge) return true;
    if (!codeVerifier) return false;
    if (method === "plain") {
      return codeVerifier === codeChallenge;
    }
    const hash = crypto.createHash("sha256").update(codeVerifier).digest();
    const calculated = hash.toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    return calculated === codeChallenge;
  };

  const renderOauthAuthorizeHtml = (opts: {
    client_id: string;
    redirect_uri: string;
    state: string;
    code_challenge: string;
    code_challenge_method: string;
    response_type: string;
    errorMessage?: string;
  }) => {
    const { client_id, redirect_uri, state, code_challenge, code_challenge_method, response_type, errorMessage } = opts;
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Autorizar Conexión MCP - Erewere CRM</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    body { background-color: #f8fafc; color: #0f172a; display: flex; min-height: 100vh; align-items: center; justify-content: center; padding: 1.5rem; }
    .card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05); width: 100%; max-width: 440px; padding: 2rem; }
    .logo { font-size: 1.25rem; font-weight: 700; color: #1e293b; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem; }
    .logo-badge { background: #2563eb; color: #fff; padding: 2px 8px; border-radius: 6px; font-size: 0.75rem; text-transform: uppercase; }
    h1 { font-size: 1.125rem; font-weight: 600; color: #334155; margin-bottom: 0.5rem; }
    p { font-size: 0.875rem; color: #64748b; line-height: 1.4; margin-bottom: 1.5rem; }
    .error-box { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 0.75rem; border-radius: 8px; font-size: 0.875rem; margin-bottom: 1rem; }
    label { display: block; font-size: 0.875rem; font-weight: 500; color: #475569; margin-bottom: 0.5rem; }
    input[type="text"], input[type="password"] { width: 100%; padding: 0.625rem 0.875rem; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.875rem; outline: none; transition: border-color 0.15s; margin-bottom: 1.25rem; }
    input[type="text"]:focus, input[type="password"]:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1); }
    button { width: 100%; background-color: #2563eb; color: #ffffff; border: none; padding: 0.75rem; border-radius: 8px; font-size: 0.875rem; font-weight: 600; cursor: pointer; transition: background-color 0.15s; }
    button:hover { background-color: #1d4ed8; }
    .footer { font-size: 0.75rem; color: #94a3b8; text-align: center; margin-top: 1.5rem; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">
      <span>Erewere CRM</span>
      <span class="logo-badge">MCP</span>
    </div>
    <h1>Autorización de Cliente MCP</h1>
    <p>Ingresa la <strong>Clave API de MCP</strong> de tu agencia (obtenida en Ajustes &gt; Integraciones) para permitir la conexión de tu asistente o cliente remoto.</p>
    
    ${errorMessage ? `<div class="error-box">${errorMessage}</div>` : ""}

    <form method="POST" action="/oauth/authorize">
      <input type="hidden" name="client_id" value="${encodeURIComponent(client_id)}">
      <input type="hidden" name="redirect_uri" value="${encodeURIComponent(redirect_uri)}">
      <input type="hidden" name="state" value="${encodeURIComponent(state)}">
      <input type="hidden" name="code_challenge" value="${encodeURIComponent(code_challenge)}">
      <input type="hidden" name="code_challenge_method" value="${encodeURIComponent(code_challenge_method)}">
      <input type="hidden" name="response_type" value="${encodeURIComponent(response_type)}">

      <label for="mcpApiKey">Clave API de MCP de la Agencia</label>
      <input type="password" id="mcpApiKey" name="mcpApiKey" placeholder="mcp_live_..." required autofocus autocomplete="off">

      <button type="submit">Autorizar Conexión</button>
    </form>
    <div class="footer">
      Erewere CRM MCP OAuth 2.0
    </div>
  </div>
</body>
</html>`;
  };

  const mcpTools = [
    {
      name: "get_inventory",
      description: "Obtiene los vehículos disponibles en el inventario de la agencia autenticada en el CRM Erewere",
      inputSchema: {
        type: "object",
        properties: {}
      }
    },
    {
      name: "get_clients",
      description: "Obtiene la lista de clientes y prospectos registrados en el CRM Erewere para la agencia autenticada",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Número máximo de registros a retornar (por defecto 20)" }
        }
      }
    },
    {
      name: "create_lead",
      description: "Registra un nuevo prospecto o cliente potencial en el CRM Erewere para la agencia autenticada",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Nombre completo del prospecto" },
          phone: { type: "string", description: "Teléfono de contacto" },
          email: { type: "string", description: "Correo electrónico" },
          vehicle: { type: "string", description: "Vehículo o auto de interés" },
          origin: { type: "string", description: "Origen del lead (ej: whatsapp, web, mcp_ai)" }
        },
        required: ["name"]
      }
    },
    {
      name: "get_sales_stats",
      description: "Obtiene estadísticas de ventas, cierres e ingresos del CRM Erewere para la agencia autenticada",
      inputSchema: {
        type: "object",
        properties: {}
      }
    }
  ];

  const processJsonRpc = async (req: express.Request, db: any, targetAgencyId: string) => {
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

      // SECURITY ASSURANCE:
      // targetAgencyId comes exclusively from the authenticated mcpApiKey doc.
      // We ignore caller-supplied agencyId or any defaults.

      if (toolName === "get_inventory") {
        const q = db
          .collection("vehicles")
          .where("agencyId", "==", targetAgencyId)
          .where("status", "==", "available");
        const snapshot = await q.get();
        // El id del documento va al final para que no lo pise un campo "id"
        // guardado dentro de los datos.
        const vehicles = snapshot.docs.map((doc: any) => ({ ...doc.data(), id: doc.id }));

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
        const q = db
          .collection("clients")
          .where("agencyId", "==", targetAgencyId)
          .limit(limitCount);
        const snapshot = await q.get();
        // El id del documento va al final para que no lo pise un campo "id"
        // guardado dentro de los datos.
        const clients = snapshot.docs.map((doc: any) => ({ ...doc.data(), id: doc.id }));

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
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        };

        const docRef = await db.collection("clients").add(newClient);

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
        const qClients = db.collection("clients").where("agencyId", "==", targetAgencyId);
        const qVehicles = db.collection("vehicles").where("agencyId", "==", targetAgencyId);

        const [clientsSnap, vehiclesSnap] = await Promise.all([
          qClients.get(),
          qVehicles.get()
        ]);

        const clients = clientsSnap.docs.map((d: any) => d.data());
        const vehicles = vehiclesSnap.docs.map((d: any) => d.data());

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
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, mcp-session-id, x-api-key");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  };

  app.use("/.well-known", mcpCors);
  app.use("/mcp", mcpCors);
  app.use("/sse", mcpCors);
  app.use("/api/mcp", mcpCors);

  // 1. OAuth Metadata Discovery Endpoints (RFC 8414 & RFC 9728)
  const handleOauthAuthorizationServerMetadata = (req: express.Request, res: express.Response) => {
    const host = req.get("host");
    const protocol = req.protocol || "https";
    const baseUrl = `${protocol}://${host}`;
    res.json({
      issuer: baseUrl,
      authorization_servers: [baseUrl],
      authorization_endpoint: `${baseUrl}/oauth/authorize`,
      token_endpoint: `${baseUrl}/oauth/token`,
      registration_endpoint: `${baseUrl}/oauth/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"]
    });
  };

  const handleOauthProtectedResourceMetadata = (resourcePath: string = "") => {
    return (req: express.Request, res: express.Response) => {
      const host = req.get("host");
      const protocol = req.protocol || "https";
      const baseUrl = `${protocol}://${host}`;
      const resourceUrl = resourcePath ? `${baseUrl}/${resourcePath}` : baseUrl;
      res.json({
        resource: resourceUrl,
        authorization_servers: [baseUrl]
      });
    };
  };

  app.get("/.well-known/oauth-authorization-server", handleOauthAuthorizationServerMetadata);
  app.get("/.well-known/oauth-protected-resource", handleOauthProtectedResourceMetadata(""));
  app.get("/.well-known/oauth-protected-resource/mcp", handleOauthProtectedResourceMetadata("mcp"));
  app.get("/.well-known/oauth-protected-resource/sse", handleOauthProtectedResourceMetadata("sse"));

  // 2. Dynamic Client Registration (RFC 7591)
  app.post("/oauth/register", express.json(), express.urlencoded({ extended: true }), (req, res) => {
    const clientId = crypto.randomBytes(16).toString("hex");
    const body = req.body || {};
    const responseData: Record<string, any> = {
      client_id: clientId,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      token_endpoint_auth_method: body.token_endpoint_auth_method || "none",
      grant_types: Array.isArray(body.grant_types) ? body.grant_types : ["authorization_code"],
      response_types: Array.isArray(body.response_types) ? body.response_types : ["code"],
      redirect_uris: Array.isArray(body.redirect_uris) ? body.redirect_uris : []
    };

    if (body.client_name) {
      responseData.client_name = body.client_name;
    }
    if (body.application_type) {
      responseData.application_type = body.application_type;
    }

    res.json(responseData);
  });

  // 3. GET /oauth/authorize - Render authorization form
  app.get("/oauth/authorize", (req, res) => {
    const redirect_uri = (req.query.redirect_uri as string) || "";
    const client_id = (req.query.client_id as string) || "";
    const state = (req.query.state as string) || "";
    const code_challenge = (req.query.code_challenge as string) || "";
    const code_challenge_method = (req.query.code_challenge_method as string) || "S256";
    const response_type = (req.query.response_type as string) || "code";

    let isValidRedirect = false;
    if (redirect_uri && typeof redirect_uri === "string") {
      try {
        new URL(redirect_uri);
        isValidRedirect = true;
      } catch (e) {
        isValidRedirect = false;
      }
    }

    if (!isValidRedirect) {
      return res.status(400).send("redirect_uri inválida o ausente.");
    }

    const html = renderOauthAuthorizeHtml({
      client_id,
      redirect_uri,
      state,
      code_challenge,
      code_challenge_method,
      response_type,
      errorMessage: ""
    });
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.send(html);
  });

  // 4. POST /oauth/authorize - Handle form submission and generate auth code
  app.post("/oauth/authorize", express.urlencoded({ extended: true }), express.json(), async (req, res) => {
    const body = req.body || {};
    const mcpApiKey = (body.mcpApiKey || body.apiKey || "").trim();
    const client_id = body.client_id ? decodeURIComponent(body.client_id) : ((req.query.client_id as string) || "");
    const redirect_uri = body.redirect_uri ? decodeURIComponent(body.redirect_uri) : ((req.query.redirect_uri as string) || "");
    const state = body.state ? decodeURIComponent(body.state) : ((req.query.state as string) || "");
    const code_challenge = body.code_challenge ? decodeURIComponent(body.code_challenge) : ((req.query.code_challenge as string) || "");
    const code_challenge_method = body.code_challenge_method ? decodeURIComponent(body.code_challenge_method) : ((req.query.code_challenge_method as string) || "S256");
    const response_type = body.response_type ? decodeURIComponent(body.response_type) : ((req.query.response_type as string) || "code");

    let isValidRedirect = false;
    if (redirect_uri && typeof redirect_uri === "string") {
      try {
        new URL(redirect_uri);
        isValidRedirect = true;
      } catch (e) {
        isValidRedirect = false;
      }
    }

    if (!isValidRedirect) {
      return res.status(400).send("redirect_uri inválida o ausente.");
    }

    const adminDb = getAdminDb();
    if (!adminDb) {
      return res.status(500).send("Base de datos no disponible");
    }
    const agency = await findAgencyByMcpKey(mcpApiKey, adminDb);

    if (!agency) {
      const html = renderOauthAuthorizeHtml({
        client_id,
        redirect_uri,
        state,
        code_challenge,
        code_challenge_method,
        response_type,
        errorMessage: "Clave de API de MCP inválida. Verifíquela en Ajustes > Integraciones."
      });
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.send(html);
    }

    // Generate single-use authorization code expiring in 5 minutes
    const code = crypto.randomBytes(32).toString("hex");
    oauthAuthCodes.set(code, {
      agencyId: agency.agencyId,
      mcpApiKey: agency.mcpApiKey || mcpApiKey,
      redirectUri: redirect_uri,
      codeChallenge: code_challenge,
      codeChallengeMethod: code_challenge_method,
      expiresAt: Date.now() + 5 * 60 * 1000
    });

    const targetUrl = new URL(redirect_uri);
    targetUrl.searchParams.set("code", code);
    if (state) {
      targetUrl.searchParams.set("state", state);
    }
    return res.redirect(302, targetUrl.toString());
  });

  // 5. POST /oauth/token - Exchange auth code for access_token (the mcpApiKey)
  app.post("/oauth/token", express.urlencoded({ extended: true }), express.json(), async (req, res) => {
    const body = req.body || {};
    const grant_type = body.grant_type || req.query.grant_type;
    const code = body.code || req.query.code;
    const redirect_uri = body.redirect_uri || req.query.redirect_uri;
    const code_verifier = body.code_verifier || req.query.code_verifier;

    if (grant_type !== "authorization_code") {
      return res.status(400).json({ error: "invalid_grant", error_description: "grant_type debe ser authorization_code" });
    }

    if (!code || typeof code !== "string" || !oauthAuthCodes.has(code)) {
      return res.status(400).json({ error: "invalid_grant", error_description: "Código de autorización inválido o no encontrado" });
    }

    const savedData = oauthAuthCodes.get(code)!;
    // Single-use: delete immediately after lookup
    oauthAuthCodes.delete(code);

    if (savedData.expiresAt < Date.now()) {
      return res.status(400).json({ error: "invalid_grant", error_description: "Código de autorización expirado" });
    }

    if (redirect_uri && savedData.redirectUri !== redirect_uri) {
      return res.status(400).json({ error: "invalid_grant", error_description: "redirect_uri no coincide con la solicitud original" });
    }

    if (savedData.codeChallenge) {
      const pkceValid = verifyPkce(code_verifier, savedData.codeChallenge, savedData.codeChallengeMethod);
      if (!pkceValid) {
        return res.status(400).json({ error: "invalid_grant", error_description: "Fallo de verificación PKCE" });
      }
    }

    return res.json({
      access_token: savedData.mcpApiKey,
      token_type: "Bearer"
    });
  });

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
      authentication: {
        type: "bearer",
        header: "Authorization: Bearer <mcpApiKey>"
      },
      endpoints: {
        sse: `${baseUrl}/sse`,
        messages: `${baseUrl}/api/mcp/messages`,
        mcp: `${baseUrl}/mcp`
      },
      tools: mcpTools
    });
  });

  // SSE Transport connection handler
  const handleSseConnect = async (req: express.Request, res: express.Response) => {
    const adminDb = getAdminDb();
    if (!adminDb) {
      return res.status(500).json({ error: "Base de datos no disponible" });
    }
    const authResult = await authenticateMcpKey(req, adminDb);

    if (!authResult) {
      const host = req.get("host");
      const protocol = req.protocol || "https";
      const baseUrl = `${protocol}://${host}`;
      const resourcePath = req.path.includes("sse") ? "sse" : "mcp";
      res.setHeader("WWW-Authenticate", `Bearer resource_metadata="${baseUrl}/.well-known/oauth-protected-resource/${resourcePath}"`);
      return res.status(401).json({
        error: "No autorizado: Clave de API de MCP inválida o ausente.",
        message: "Proporcione su clave en el encabezado 'Authorization: Bearer <mcpApiKey>' o parámetro 'apiKey'."
      });
    }

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
        "Access-Control-Allow-Origin": req.headers.origin || "*",
        "Access-Control-Allow-Headers": "*",
        "X-Accel-Buffering": "no"
      });

      res.write(`event: endpoint\ndata: ${messageUrl}\n\n`);
      sseSessions.set(sessionId, { res, agencyId: authResult.agencyId });

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
        authenticatedAgencyId: authResult.agencyId,
        agencyName: authResult.agencyName,
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
    const adminDb = getAdminDb();
    if (!adminDb) {
      return res.status(500).json({
        jsonrpc: "2.0",
        id: req.body?.id || null,
        error: {
          code: -32603,
          message: "Base de datos no disponible"
        }
      });
    }

    // Authenticate API key for POST /mcp requests
    const authResult = await authenticateMcpKey(req, adminDb);
    if (!authResult) {
      const host = req.get("host");
      const protocol = req.protocol || "https";
      const baseUrl = `${protocol}://${host}`;
      const resourcePath = req.path.includes("sse") ? "sse" : "mcp";
      res.setHeader("WWW-Authenticate", `Bearer resource_metadata="${baseUrl}/.well-known/oauth-protected-resource/${resourcePath}"`);
      return res.status(401).json({
        jsonrpc: "2.0",
        id: req.body?.id || null,
        error: {
          code: -32001,
          message: "No autorizado: Clave de API de MCP inválida o ausente. Envíe 'Authorization: Bearer <mcpApiKey>'."
        }
      });
    }

    try {
      const responseJson = await processJsonRpc(req, adminDb, authResult.agencyId);

      if (sessionId && sseSessions.has(sessionId)) {
        const sseSession = sseSessions.get(sessionId)!;
        if (responseJson) {
          sseSession.res.write(`event: message\ndata: ${JSON.stringify(responseJson)}\n\n`);
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
      appType: "spa",
    });
    app.use(vite.middlewares);
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
