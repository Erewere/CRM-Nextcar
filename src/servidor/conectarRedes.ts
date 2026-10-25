/**
 * «Conectar Facebook e Instagram»: que cada agencia enlace su página sin tocar tokens.
 *
 * El administrador pulsa el botón, Meta le pregunta si autoriza a «CRM Nextcar» y a qué página, y el CRM guarda el token
 * de ESA página en agencies/{id}/secrets/messenger (el mismo lugar que ya usa publicarRedes) junto con su
 * `facebookPageId`. Nadie pega nada.
 *
 *  - /iniciar: arma la liga de Meta. El `state` va firmado con el secreto de la app y vence en 15 minutos, así que quien
 *    vuelve de Meta no puede hacerse pasar por otra agencia.
 *  - /volver: Meta regresa aquí con un código. Se cambia por un token de larga duración y se piden las páginas que
 *    administra la persona. Con una sola página se guarda directo; con varias queda una lista pendiente (solo el
 *    servidor la lee; trae los tokens) para que elija.
 *  - Una página solo puede estar conectada a UNA agencia: el webhook de Messenger reparte los mensajes por el id de la
 *    página, y dos agencias con la misma página se robarían los mensajes.
 *
 * Variables en Hostinger: META_APP_SECRET (obligatoria). META_APP_ID tiene por omisión la app «CRM Nextcar».
 * META_LOGIN_CONFIG_ID (opcional): si la app usa «Inicio de sesión con Facebook para empresas», Meta pide el id de una
 * configuración en lugar de la lista de permisos.
 */
import crypto from "crypto";

const GRAPH = "https://graph.facebook.com/v21.0";
const ROLES = new Set(["admin", "manager"]);
const PERMISOS = [
  "pages_show_list", "pages_read_engagement", "pages_manage_posts", "pages_manage_metadata", "pages_messaging",
  "instagram_basic", "instagram_content_publish", "business_management",
].join(",");
const VIDA_MS = 15 * 60_000;

const appId = () => process.env.META_APP_ID || "980384091487868";
const secreto = () => process.env.META_APP_SECRET || "";
const base = () => (process.env.APP_PUBLIC_URL || "https://crm.erewere.com").replace(/\/+$/, "");
const redirectUri = () => `${base()}/api/redes/conectar/volver`;

const firmar = (cuerpo: string) => crypto.createHmac("sha256", secreto()).update(cuerpo).digest("base64url");
function armarEstado(datos: { agencyId: string; uid: string }) {
  const cuerpo = Buffer.from(JSON.stringify({ ...datos, exp: Date.now() + VIDA_MS, n: crypto.randomBytes(6).toString("hex") })).toString("base64url");
  return `${cuerpo}.${firmar(cuerpo)}`;
}
function leerEstado(estado: string): { agencyId: string; uid: string } | null {
  const [cuerpo, firma] = String(estado || "").split(".");
  if (!cuerpo || !firma || !secreto()) return null;
  const esperada = firmar(cuerpo);
  if (firma.length !== esperada.length || !crypto.timingSafeEqual(Buffer.from(firma), Buffer.from(esperada))) return null;
  try {
    const d = JSON.parse(Buffer.from(cuerpo, "base64url").toString());
    return d.exp > Date.now() && d.agencyId && d.uid ? { agencyId: String(d.agencyId), uid: String(d.uid) } : null;
  } catch { return null; }
}

async function graph(ruta: string, params: Record<string, string>, metodo: "GET" | "POST" = "GET") {
  const q = new URLSearchParams(params);
  try {
    const r = await fetch(metodo === "GET" ? `${GRAPH}/${ruta}?${q}` : `${GRAPH}/${ruta}`, {
      method: metodo,
      ...(metodo === "POST" ? { body: q, headers: { "Content-Type": "application/x-www-form-urlencoded" } } : {}),
      signal: AbortSignal.timeout(20_000),
    });
    const data = await r.json().catch(() => ({}));
    return { ok: r.ok && !data?.error, data };
  } catch (e: any) {
    return { ok: false, data: { error: { message: String(e?.message || e) } } };
  }
}

export function registrarConectarRedes(app: any, { usuarioQuePide, FieldValue, getAdminDb }: { usuarioQuePide: (req: any, res: any) => Promise<any>; FieldValue: any; getAdminDb: () => any }) {
  async function quien(req: any, res: any) {
    const q = await usuarioQuePide(req, res);
    if (!q) return null;
    if (!ROLES.has(q.rol)) { res.status(403).json({ error: "Solo el administrador o el gerente conecta las redes de la agencia." }); return null; }
    return q;
  }

  /** Guarda la página en la agencia. Devuelve un texto de error, o null si quedó. */
  async function guardar(adminDb: any, agencyId: string, uid: string, pagina: any): Promise<string | null> {
    const otra = await adminDb.collection("agencies").where("facebookPageId", "==", String(pagina.id)).limit(3).get();
    if (otra.docs.some((d: any) => d.id !== agencyId)) return "Esa página de Facebook ya está conectada a otra agencia.";
    const ref = adminDb.collection("agencies").doc(agencyId);
    await ref.set({
      facebookPageId: String(pagina.id),
      redesConectadas: {
        pagina: String(pagina.name || ""),
        instagram: String(pagina.instagram_business_account?.username || ""),
        por: uid,
        en: new Date().toISOString(),
      },
    }, { merge: true });
    await ref.collection("secrets").doc("messenger").set({ pageAccessToken: String(pagina.access_token), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    // Para que los mensajes de Messenger de esa página lleguen al CRM. Si falla no se pierde nada: publicar funciona igual.
    await graph(`${pagina.id}/subscribed_apps`, { subscribed_fields: "messages,messaging_postbacks", access_token: String(pagina.access_token) }, "POST");
    return null;
  }

  // 1. La liga de Meta.
  app.post("/api/redes/conectar/iniciar", async (req: any, res: any) => {
    const q = await quien(req, res);
    if (!q) return;
    if (!secreto()) return res.status(503).json({ error: "Falta configurar la conexión con Meta en el servidor (META_APP_SECRET). Avisa a tu administrador técnico." });
    const params: Record<string, string> = {
      client_id: appId(), redirect_uri: redirectUri(), state: armarEstado({ agencyId: q.agencyId, uid: q.uid }), response_type: "code",
    };
    if (process.env.META_LOGIN_CONFIG_ID) params.config_id = process.env.META_LOGIN_CONFIG_ID; else params.scope = PERMISOS;
    res.json({ url: `https://www.facebook.com/v21.0/dialog/oauth?${new URLSearchParams(params)}` });
  });

  // 2. Meta regresa aquí.
  app.get("/api/redes/conectar/volver", async (req: any, res: any) => {
    const volver = (k: string, v: string) => res.redirect(`/integrations?redes=${k}${v ? `&${v}` : ""}`);
    const datos = leerEstado(String(req.query.state || ""));
    if (!datos) return volver("error", `m=${encodeURIComponent("La conexión venció o no es válida. Vuelve a intentarlo.")}`);
    if (req.query.error || !req.query.code) return volver("error", `m=${encodeURIComponent("No se autorizó la conexión en Facebook.")}`);
    try {
      const db = getAdminDb();
      if (!db) return volver("error", `m=${encodeURIComponent("Base de datos no disponible.")}`);
      const corto = await graph("oauth/access_token", { client_id: appId(), client_secret: secreto(), redirect_uri: redirectUri(), code: String(req.query.code) });
      if (!corto.ok || !corto.data?.access_token) return volver("error", `m=${encodeURIComponent("Meta no aceptó la autorización. Vuelve a intentarlo.")}`);
      const largo = await graph("oauth/access_token", { grant_type: "fb_exchange_token", client_id: appId(), client_secret: secreto(), fb_exchange_token: String(corto.data.access_token) });
      const tokenUsuario = String(largo.data?.access_token || corto.data.access_token);
      const c = await graph("me/accounts", { fields: "id,name,access_token,instagram_business_account{id,username}", limit: "100", access_token: tokenUsuario });
      const paginas: any[] = c.ok && Array.isArray(c.data?.data) ? c.data.data.filter((p: any) => p?.id && p?.access_token) : [];
      if (!paginas.length) return volver("error", `m=${encodeURIComponent("No encontramos páginas de Facebook que administres con esa cuenta.")}`);
      if (paginas.length === 1) {
        const malo = await guardar(db, datos.agencyId, datos.uid, paginas[0]);
        return malo ? volver("error", `m=${encodeURIComponent(malo)}`) : volver("ok", "");
      }
      const ref = db.collection("redesPendientes").doc();
      await ref.set({ agencyId: datos.agencyId, uid: datos.uid, paginas, vence: Date.now() + VIDA_MS });
      return volver("elegir", `c=${ref.id}`);
    } catch (e) {
      console.error("redes/conectar/volver:", e);
      return volver("error", `m=${encodeURIComponent("No se pudo completar la conexión. Intenta de nuevo.")}`);
    }
  });

  async function pendiente(q: any, id: string) {
    if (!/^[A-Za-z0-9]{10,40}$/.test(id)) return null;
    const s = await q.adminDb.collection("redesPendientes").doc(id).get();
    const d = s.exists ? s.data() : null;
    if (!d || d.agencyId !== q.agencyId || d.uid !== q.uid || d.vence < Date.now()) return null;
    return { ref: s.ref, d };
  }

  // 3. Elegir entre varias páginas (la lista no lleva tokens).
  app.get("/api/redes/conectar/paginas", async (req: any, res: any) => {
    const q = await quien(req, res);
    if (!q) return;
    const p = await pendiente(q, String(req.query.c || ""));
    if (!p) return res.status(404).json({ error: "La lista venció. Vuelve a pulsar «Conectar»." });
    res.json({ paginas: p.d.paginas.map((x: any) => ({ id: String(x.id), nombre: String(x.name || ""), instagram: String(x.instagram_business_account?.username || "") })) });
  });

  app.post("/api/redes/conectar/elegir", async (req: any, res: any) => {
    const q = await quien(req, res);
    if (!q) return;
    const p = await pendiente(q, String(req.body?.c || ""));
    if (!p) return res.status(404).json({ error: "La lista venció. Vuelve a pulsar «Conectar»." });
    const pagina = p.d.paginas.find((x: any) => String(x.id) === String(req.body?.pageId || ""));
    if (!pagina) return res.status(400).json({ error: "Esa página no está en la lista." });
    try {
      const malo = await guardar(q.adminDb, q.agencyId, q.uid, pagina);
      if (malo) return res.status(409).json({ error: malo });
      await p.ref.delete();
      res.json({ ok: true });
    } catch (e) {
      console.error("redes/conectar/elegir:", e);
      res.status(500).json({ error: "No se pudo guardar la conexión." });
    }
  });

  // Lo conectado, sin tokens.
  app.get("/api/redes/conectar/estado", async (req: any, res: any) => {
    const q = await quien(req, res);
    if (!q) return;
    const ag = (await q.adminDb.collection("agencies").doc(q.agencyId).get()).data() || {};
    const sec = (await q.adminDb.collection("agencies").doc(q.agencyId).collection("secrets").doc("messenger").get()).data() || {};
    res.json({
      configurado: !!secreto(),
      hayToken: !!sec.pageAccessToken,
      paginaId: String(ag.facebookPageId || ""),
      pagina: String(ag.redesConectadas?.pagina || ""),
      instagram: String(ag.redesConectadas?.instagram || ""),
    });
  });

  app.post("/api/redes/conectar/desconectar", async (req: any, res: any) => {
    const q = await quien(req, res);
    if (!q) return;
    const ref = q.adminDb.collection("agencies").doc(q.agencyId);
    await ref.collection("secrets").doc("messenger").set({ pageAccessToken: FieldValue.delete() }, { merge: true });
    await ref.set({ facebookPageId: "", redesConectadas: FieldValue.delete() }, { merge: true });
    res.json({ ok: true });
  });
}
