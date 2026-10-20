import crypto from "crypto";

/**
 * Avisos al celular (Web Push), para quien guardó el CRM en la pantalla de inicio del iPhone (o abre el CRM en
 * Chrome en Android o en la computadora).
 *
 *  - Las llaves del servicio (VAPID) se crean solas la primera vez y viven en `plataforma/vapid`, una colección que
 *    solo lee el servidor: ni la persona que usa el CRM ni nadie más tiene que crear ni pegar llaves.
 *  - Cada dispositivo suscrito es un documento de `pushSuscripciones` (id = huella de su dirección de aviso).
 *  - Solo se aceptan direcciones de los servicios de avisos conocidos (Apple, Google, Mozilla, Microsoft): el
 *    servidor manda una petición a esa dirección, y no debe poder apuntarse a cualquier lugar.
 *  - Un dispositivo que ya no existe (404 o 410) se borra solo.
 *  - El texto de un aviso nunca lleva el mensaje del cliente, solo quién escribió: la pantalla bloqueada la puede ver cualquiera.
 */

const DOMINIOS_PERMITIDOS = [
  /(^|\.)push\.apple\.com$/,
  /(^|\.)fcm\.googleapis\.com$/,
  /(^|\.)android\.googleapis\.com$/,
  /(^|\.)push\.services\.mozilla\.com$/,
  /(^|\.)notify\.windows\.com$/,
];

export const direccionDeAvisoValida = (raw: string): boolean => {
  try {
    const u = new URL(raw);
    return u.protocol === "https:" && !u.username && !u.password && !u.port && DOMINIOS_PERMITIDOS.some((r) => r.test(u.hostname));
  } catch { return false; }
};

/**
 * La libreria se carga al usarla, no al arrancar: si en algun despliegue no estuviera instalada, fallarian los
 * avisos, pero el CRM entero seguiria arrancando.
 */
const cargarWebPush = async () => (await import("web-push")).default;

const huella = (endpoint: string) => crypto.createHash("sha256").update(endpoint).digest("hex").slice(0, 40);
const MAX_DISPOSITIVOS_POR_PERSONA = 5;

export interface AvisoPush {
  titulo: string;
  cuerpo: string;
  /** Pantalla que se abre al tocar el aviso. */
  url?: string;
  /** Avisos con la misma etiqueta se reemplazan en el celular en lugar de apilarse. */
  etiqueta?: string;
}

export function registrarPush(app: any, { usuarioQuePide, getAdminDb, frenoPermite }: {
  usuarioQuePide: (req: any, res: any) => Promise<any>;
  getAdminDb: () => any;
  frenoPermite: (clave: string, max: number, ventanaMs?: number) => boolean;
}) {
  let llaves: { publicKey: string; privateKey: string } | null = null;

  async function claves(db: any) {
    if (llaves) return llaves;
    const ref = db.collection("plataforma").doc("vapid");
    const s = await ref.get();
    if (s.exists && s.data()?.publicKey && s.data()?.privateKey) {
      llaves = { publicKey: s.data().publicKey, privateKey: s.data().privateKey };
      return llaves;
    }
    const webpush = await cargarWebPush();
    const nuevas = webpush.generateVAPIDKeys();
    try {
      await ref.create({ ...nuevas, creadaEn: new Date().toISOString() });
      llaves = nuevas;
    } catch {
      // Otra instancia las creó al mismo tiempo: se usan las que ganaron.
      const g = (await ref.get()).data();
      llaves = { publicKey: g.publicKey, privateKey: g.privateKey };
    }
    return llaves!;
  }

  async function enviar(db: any, subs: any[], aviso: AvisoPush) {
    const webpush = await cargarWebPush();
    const k = await claves(db);
    const cuerpo = JSON.stringify({ titulo: aviso.titulo, cuerpo: aviso.cuerpo, url: aviso.url || "/", etiqueta: aviso.etiqueta || "" });
    const resultados: { ok: boolean; estado?: number; motivo?: string }[] = [];
    for (const doc of subs) {
      const x = doc.data();
      try {
        await webpush.sendNotification(
          { endpoint: x.endpoint, keys: x.keys },
          cuerpo,
          { TTL: 3600, urgency: "high", vapidDetails: { subject: "mailto:contacto@erewere.com", publicKey: k.publicKey, privateKey: k.privateKey } },
        );
        resultados.push({ ok: true });
      } catch (e: any) {
        const estado = Number(e?.statusCode) || 0;
        resultados.push({ ok: false, estado, motivo: String(e?.body || e?.message || "").slice(0, 120) });
        if (estado === 404 || estado === 410) await doc.ref.delete().catch(() => {});
      }
    }
    return resultados;
  }

  /** Avisa a estas personas (sus dispositivos). */
  async function avisarA(db: any, uids: string[], aviso: AvisoPush) {
    const lista = [...new Set(uids.filter(Boolean))];
    if (!lista.length) return 0;
    let enviados = 0;
    for (let i = 0; i < lista.length; i += 10) {
      const subs = await db.collection("pushSuscripciones").where("uid", "in", lista.slice(i, i + 10)).get();
      const r = await enviar(db, subs.docs, aviso);
      enviados += r.filter((x) => x.ok).length;
    }
    return enviados;
  }

  /** Al vendedor del contacto; si no tiene, a los administradores de la agencia. */
  async function avisarDeUnContacto(db: any, agencyId: string, sellerId: string, aviso: AvisoPush) {
    try {
      let destino = sellerId ? [sellerId] : [];
      if (!destino.length) {
        const admins = await db.collection("users").where("agencyId", "==", agencyId).where("role", "==", "admin").get();
        destino = admins.docs.map((d: any) => d.id);
      }
      return await avisarA(db, destino, aviso);
    } catch (e) {
      console.error("Aviso push:", e);
      return 0;
    }
  }

  // ----- Rutas (siempre con sesión) -----
  app.get("/api/push/clave", async (req: any, res: any) => {
    const q = await usuarioQuePide(req, res);
    if (!q) return;
    try { res.json({ publicKey: (await claves(q.adminDb)).publicKey }); } catch (e) { console.error("push/clave:", e); res.status(500).json({ error: "No se pudo preparar los avisos." }); }
  });

  app.get("/api/push/estado", async (req: any, res: any) => {
    const q = await usuarioQuePide(req, res);
    if (!q) return;
    const s = await q.adminDb.collection("pushSuscripciones").where("uid", "==", q.uid).get();
    res.json({ dispositivos: s.size });
  });

  app.post("/api/push/suscribir", async (req: any, res: any) => {
    const q = await usuarioQuePide(req, res);
    if (!q) return;
    const sub = req.body?.subscription;
    const endpoint = String(sub?.endpoint || "");
    const p256dh = String(sub?.keys?.p256dh || "");
    const auth = String(sub?.keys?.auth || "");
    if (!direccionDeAvisoValida(endpoint) || !p256dh || !auth || endpoint.length > 600) return res.status(400).json({ error: "Este dispositivo no mandó una suscripción válida." });
    try {
      const col = q.adminDb.collection("pushSuscripciones");
      await col.doc(huella(endpoint)).set({
        uid: q.uid, agencyId: q.agencyId, endpoint, keys: { p256dh, auth },
        dispositivo: String(req.headers["user-agent"] || "").slice(0, 120), creadaEn: new Date().toISOString(),
      });
      // Tope por persona: se quitan las más viejas.
      const todas = await col.where("uid", "==", q.uid).get();
      const sobran = todas.docs.sort((a: any, b: any) => String(b.data().creadaEn).localeCompare(String(a.data().creadaEn))).slice(MAX_DISPOSITIVOS_POR_PERSONA);
      for (const d of sobran) await d.ref.delete();
      res.json({ ok: true });
    } catch (e) {
      console.error("push/suscribir:", e);
      res.status(500).json({ error: "No se pudo guardar este dispositivo." });
    }
  });

  app.post("/api/push/baja", async (req: any, res: any) => {
    const q = await usuarioQuePide(req, res);
    if (!q) return;
    const endpoint = String(req.body?.endpoint || "");
    if (!endpoint) return res.status(400).json({ error: "Falta el dispositivo." });
    const ref = q.adminDb.collection("pushSuscripciones").doc(huella(endpoint));
    const s = await ref.get();
    if (s.exists && s.data()?.uid === q.uid) await ref.delete();
    res.json({ ok: true });
  });

  // Un aviso de prueba a los dispositivos de quien lo pide, y se dice qué pasó con cada uno.
  app.post("/api/push/probar", async (req: any, res: any) => {
    const q = await usuarioQuePide(req, res);
    if (!q) return;
    if (!frenoPermite(`push-prueba:${q.uid}`, 5)) return res.status(429).json({ error: "Muchas pruebas seguidas. Espera un minuto." });
    try {
      const subs = await q.adminDb.collection("pushSuscripciones").where("uid", "==", q.uid).get();
      if (subs.empty) return res.status(404).json({ error: "Este usuario no tiene ningún dispositivo con avisos activados." });
      const r = await enviar(q.adminDb, subs.docs, { titulo: "Nextcar CRM", cuerpo: "Así se verán los avisos de prospectos nuevos y mensajes.", url: "/nuevos", etiqueta: "prueba" });
      res.json({ dispositivos: r.length, entregados: r.filter((x) => x.ok).length, fallos: r.filter((x) => !x.ok) });
    } catch (e) {
      console.error("push/probar:", e);
      res.status(500).json({ error: "No se pudo mandar el aviso de prueba." });
    }
  });

  return { avisarDeUnContacto, avisarA };
}
