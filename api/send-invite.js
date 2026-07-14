import { Resend } from 'resend';
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
    if (userData.role !== "master" && userData.role !== "admin") {
      return res.status(403).json({ error: "Se requiere rol admin o master" });
    }
  } catch (e) {
    return res.status(401).json({ error: "Token inválido" });
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
