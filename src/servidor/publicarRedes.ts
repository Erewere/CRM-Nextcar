/**
 * Publicar un auto en la página de Facebook y en el Instagram de la agencia, desde el CRM (Nivel 2).
 *
 * Usa el token de la página que la agencia ya tiene en Integraciones (agencies/{id}/secrets/messenger.pageAccessToken) y su
 * `facebookPageId`. Para publicar, ese token tiene que haberse emitido con los permisos `pages_manage_posts`,
 * `pages_read_engagement`, `instagram_basic` e `instagram_content_publish` (los de Messenger no bastan). Si falta algo, el
 * CRM lo dice en claro: nunca finge que publicó.
 *
 *  - Facebook: foto con el texto en la página (`POST /{pagina}/photos`).
 *  - Instagram: publicación con la misma imagen (`/media` y `/media_publish`); la cuenta de Instagram tiene que ser
 *    profesional y estar vinculada a la página.
 *  - La imagen la arma el navegador; se sube aquí a una carpeta privada del depósito y Meta la descarga con una liga que
 *    vence en 30 minutos.
 *  - Solo administrador y gerente publican en nombre de la agencia. Cada publicación queda en `publicaciones` (solo el
 *    servidor la lee) para ver después cuánto alcance y reacciones ha tenido.
 */

const GRAPH = "https://graph.facebook.com/v21.0";
const idValido = (s: string) => /^[A-Za-z0-9_-]{1,64}$/.test(s);
const ROLES = new Set(["admin", "manager"]);

type Res = { ok: boolean; data: any };
async function graph(ruta: string, token: string, opciones: { metodo?: "GET" | "POST"; params?: Record<string, string>; ms?: number } = {}): Promise<Res> {
  const metodo = opciones.metodo || "GET";
  const params = new URLSearchParams({ ...(opciones.params || {}), access_token: token });
  const url = metodo === "GET" ? `${GRAPH}/${ruta}?${params}` : `${GRAPH}/${ruta}`;
  try {
    const r = await fetch(url, {
      method: metodo,
      ...(metodo === "POST" ? { body: params, headers: { "Content-Type": "application/x-www-form-urlencoded" } } : {}),
      signal: AbortSignal.timeout(opciones.ms ?? 25_000),
    });
    const data = await r.json().catch(() => ({}));
    return { ok: r.ok && !data?.error, data };
  } catch (e: any) {
    return { ok: false, data: { error: { message: e?.name === "TimeoutError" ? "Meta tardó demasiado en contestar." : String(e?.message || e), code: -1 } } };
  }
}

/**
 * Lo que se pega en Integraciones puede ser el token de la página o el del usuario que la administra (el Explorador de
 * Meta entrega este último si no se elige la página aparte). Con el de usuario Meta no deja publicar ni leer `tasks`.
 * Pidiéndole a la página su propio `access_token` se obtiene el bueno en los dos casos; si no se puede, se queda con el
 * que había y el error de Meta se explica como siempre. Se recuerda 10 minutos para no preguntarle a Meta cada vez.
 */
const tokensDePagina = new Map<string, { token: string; hasta: number }>();
/** Lo último que se supo de por qué no se pudo resolver el token, para decírselo a quien administra. */
let ultimoAviso = "";
async function tokenDeLaPagina(pageId: string, guardado: string): Promise<string> {
  const clave = `${pageId}:${guardado.slice(-12)}`;
  const visto = tokensDePagina.get(clave);
  if (visto && visto.hasta > Date.now()) return visto.token;
  let token = guardado;
  const r = await graph(pageId, guardado, { params: { fields: "access_token" }, ms: 10_000 });
  if (r.ok && typeof r.data?.access_token === "string" && r.data.access_token) token = r.data.access_token;
  else {
    // Segunda vía: la lista de páginas que administra la persona dueña del token.
    const c = await graph("me/accounts", guardado, { params: { fields: "id,name,access_token", limit: "100" }, ms: 12_000 });
    const lista: any[] = c.ok && Array.isArray(c.data?.data) ? c.data.data : [];
    const suya = lista.find((x) => String(x.id) === pageId);
    if (suya?.access_token) token = String(suya.access_token);
    else if (c.ok && lista.length) ultimoAviso = `El ID de página guardado (${pageId}) no es de ninguna de las páginas que administra esa cuenta: ${lista.map((x) => `${x.name} (${x.id})`).join(", ")}.`;
  }
  tokensDePagina.set(clave, { token, hasta: Date.now() + (token === guardado ? 60_000 : 10 * 60_000) });
  return token;
}

/** El error de Meta, dicho para quien vende autos. */
export function explicarError(data: any, red: "facebook" | "instagram"): string {
  const e = data?.error || {};
  const code = Number(e.code);
  const msg = String(e.message || "");
  if (code === 190) return "El token de la página venció o ya no sirve. Genera uno nuevo y ponlo en Integraciones.";
  if (code === 200 || code === 10 || code === 283 || /permission/i.test(msg)) {
    return red === "facebook"
      ? "El token de la página no tiene permiso para publicar (falta «pages_manage_posts»). Genera un token nuevo con ese permiso y ponlo en Integraciones."
      : "El token no tiene permiso para publicar en Instagram (faltan «instagram_basic» e «instagram_content_publish»). Genera un token nuevo con esos permisos y ponlo en Integraciones.";
  }
  if (code === 368 || code === 4 || code === 17 || code === 32) return "Meta bloqueó o limitó la publicación por ahora (demasiadas seguidas). Espera un rato e intenta de nuevo.";
  if (code === 2207026 || code === 2207052 || /media/i.test(msg) && red === "instagram") return "Instagram no pudo descargar o aceptar la imagen. Intenta de nuevo con la imagen cuadrada.";
  if (code === -1) return msg;
  return `${red === "facebook" ? "Facebook" : "Instagram"} no aceptó la publicación: ${msg || "error sin detalle"}.`;
}

export function registrarPublicarRedes(app: any, { usuarioQuePide, bucket, express }: { usuarioQuePide: (req: any, res: any) => Promise<any>; bucket: () => any; express: any }) {
  async function quien(req: any, res: any) {
    const q = await usuarioQuePide(req, res);
    if (!q) return null;
    if (!ROLES.has(q.rol)) { res.status(403).json({ error: "Solo el administrador o el gerente publica en la página de la agencia." }); return null; }
    return q;
  }

  async function datosDeRedes(q: any) {
    const ref = q.adminDb.collection("agencies").doc(q.agencyId);
    const [ag, sec] = await Promise.all([ref.get(), ref.collection("secrets").doc("messenger").get()]);
    const pageId = String(ag.data()?.facebookPageId || "");
    const guardado = String(sec.data()?.pageAccessToken || "");
    return { pageId, token: pageId && guardado ? await tokenDeLaPagina(pageId, guardado) : guardado };
  }

  // ---------- ¿Está lista la agencia para publicar? ----------
  app.get("/api/redes/estado", async (req: any, res: any) => {
    const q = await quien(req, res);
    if (!q) return;
    try {
      const { pageId, token } = await datosDeRedes(q);
      const sal: any = { facebook: { listo: false, motivo: "" }, instagram: { listo: false, motivo: "" } };
      if (!pageId) { sal.facebook.motivo = "Falta el identificador de la página de Facebook (Integraciones)."; return res.json(sal); }
      if (!token) { sal.facebook.motivo = "Falta el token de la página (Integraciones)."; return res.json(sal); }
      const p = await graph(pageId, token, { params: { fields: "name,instagram_business_account{id,username}" }, ms: 12_000 });
      if (!p.ok) { sal.facebook.motivo = (ultimoAviso ? ultimoAviso + " " : "") + explicarError(p.data, "facebook"); return res.json(sal); }
      sal.facebook.nombre = String(p.data.name || "");
      // `tasks` solo se deja leer con el token de la página; si no, no se exige: publicar dirá lo que haga falta.
      const t = await graph(pageId, token, { params: { fields: "tasks" }, ms: 8_000 });
      const tareas: string[] = t.ok && Array.isArray(t.data.tasks) ? t.data.tasks : [];
      // `tasks` lista lo que el dueño del token puede hacer en la página; sin CREATE_CONTENT no podrá publicar.
      if (tareas.length && !tareas.includes("CREATE_CONTENT")) sal.facebook.motivo = "La persona dueña del token no tiene permiso de crear contenido en la página.";
      else sal.facebook.listo = true;
      const ig = p.data.instagram_business_account;
      if (ig?.id) { sal.instagram = { listo: true, usuario: String(ig.username || ""), motivo: "" }; }
      else sal.instagram.motivo = "La página no tiene una cuenta profesional de Instagram vinculada (Facebook → Configuración de la página → Cuentas vinculadas).";
      res.json(sal);
    } catch (e) {
      console.error("redes/estado:", e);
      res.status(500).json({ error: "No se pudo revisar la conexión." });
    }
  });

  // ---------- 1. La imagen que armó el navegador ----------
  app.post("/api/autos/:id/publicar/imagen", express.raw({ type: "image/jpeg", limit: "6mb" }), async (req: any, res: any) => {
    const q = await quien(req, res);
    if (!q) return;
    const id = String(req.params.id || "");
    const cuerpo = req.body as Buffer;
    if (!idValido(id)) return res.status(400).json({ error: "Auto no válido." });
    if (!Buffer.isBuffer(cuerpo) || cuerpo.length < 1000 || cuerpo[0] !== 0xff || cuerpo[1] !== 0xd8) return res.status(400).json({ error: "La imagen no es válida." });
    try {
      const v = (await q.adminDb.collection("vehicles").doc(id).get()).data();
      if (!v || v.agencyId !== q.agencyId) return res.status(404).json({ error: "No encontramos ese auto." });
      const ruta = `publicaciones/${q.agencyId}/${id}/${Date.now()}.jpg`;
      await bucket().file(ruta).save(cuerpo, { contentType: "image/jpeg", resumable: false });
      res.json({ imagenId: ruta });
    } catch (e) {
      console.error("redes/imagen:", e);
      res.status(500).json({ error: "No se pudo subir la imagen." });
    }
  });

  // ---------- 2. Publicar ----------
  const reciente = new Map<string, number>();
  app.post("/api/autos/:id/publicar", async (req: any, res: any) => {
    const q = await quien(req, res);
    if (!q) return;
    const id = String(req.params.id || "");
    const redes: string[] = Array.isArray(req.body?.redes) ? req.body.redes.filter((r: string) => r === "fb" || r === "ig") : [];
    const imagenId = String(req.body?.imagenId || "");
    const textos = req.body?.textos || {};
    if (!idValido(id) || !redes.length) return res.status(400).json({ error: "Elige dónde publicar." });
    if (!imagenId.startsWith(`publicaciones/${q.agencyId}/${id}/`) || imagenId.includes("..")) return res.status(400).json({ error: "La imagen no es de este auto." });
    try {
      const v = (await q.adminDb.collection("vehicles").doc(id).get()).data();
      if (!v || v.agencyId !== q.agencyId || v.isDeleted) return res.status(404).json({ error: "No encontramos ese auto." });
      if (v.status === "sold") return res.status(409).json({ error: "Ese auto ya se vendió." });
      const { pageId, token } = await datosDeRedes(q);
      if (!pageId || !token) return res.status(409).json({ error: "Falta conectar la página en Integraciones." });

      const [url] = await bucket().file(imagenId).getSignedUrl({ action: "read", version: "v4", expires: Date.now() + 30 * 60_000 });
      const resultado: Record<string, any> = {};

      for (const red of redes) {
        const clave = `${id}:${red}`;
        if (!req.body?.forzar && Date.now() - (reciente.get(clave) || 0) < 10 * 60_000) { resultado[red] = { ok: false, error: "Este auto se publicó hace menos de 10 minutos en esa red. Si de verdad quieres repetirla, vuelve a intentar." , repetida: true }; continue; }
        const texto = String(textos[red] || "").slice(0, red === "ig" ? 2200 : 8000);
        if (red === "fb") {
          const r = await graph(`${pageId}/photos`, token, { metodo: "POST", params: { url, caption: texto, published: "true" } });
          if (!r.ok) { resultado.fb = { ok: false, error: explicarError(r.data, "facebook") }; continue; }
          const postId = String(r.data.post_id || r.data.id || "");
          reciente.set(clave, Date.now());
          resultado.fb = { ok: true, id: postId, url: `https://www.facebook.com/${postId}` };
        } else {
          const p = await graph(pageId, token, { params: { fields: "instagram_business_account" }, ms: 12_000 });
          const igId = p.data?.instagram_business_account?.id;
          if (!p.ok || !igId) { resultado.ig = { ok: false, error: p.ok ? "La página no tiene una cuenta de Instagram vinculada." : explicarError(p.data, "instagram") }; continue; }
          const c = await graph(`${igId}/media`, token, { metodo: "POST", params: { image_url: url, caption: texto } });
          if (!c.ok) { resultado.ig = { ok: false, error: explicarError(c.data, "instagram") }; continue; }
          // Instagram procesa la imagen unos segundos antes de dejarla publicar.
          let listo = false;
          for (let i = 0; i < 10 && !listo; i++) {
            const s = await graph(String(c.data.id), token, { params: { fields: "status_code" }, ms: 10_000 });
            const estado = String(s.data?.status_code || "");
            if (estado === "FINISHED") listo = true;
            else if (estado === "ERROR" || estado === "EXPIRED") break;
            else await new Promise((ok) => setTimeout(ok, 2000));
          }
          if (!listo) { resultado.ig = { ok: false, error: "Instagram no terminó de procesar la imagen. Intenta de nuevo en un momento." }; continue; }
          const pub = await graph(`${igId}/media_publish`, token, { metodo: "POST", params: { creation_id: String(c.data.id) } });
          if (!pub.ok) { resultado.ig = { ok: false, error: explicarError(pub.data, "instagram") }; continue; }
          const mediaId = String(pub.data.id || "");
          const link = await graph(mediaId, token, { params: { fields: "permalink" }, ms: 10_000 });
          reciente.set(clave, Date.now());
          resultado.ig = { ok: true, id: mediaId, url: String(link.data?.permalink || "") };
        }
      }

      for (const [red, r] of Object.entries(resultado) as [string, any][]) {
        if (!r.ok) continue;
        await q.adminDb.collection("publicaciones").add({ agencyId: q.agencyId, vehicleId: id, red, postId: r.id, url: r.url || "", fecha: new Date().toISOString(), por: q.uid });
      }
      res.json({ resultado });
    } catch (e: any) {
      console.error("redes/publicar:", e);
      res.status(500).json({ error: "No se pudo publicar. Intenta de nuevo." });
    }
  });

  // ---------- Lo ya publicado, con sus cifras ----------
  app.get("/api/autos/:id/publicaciones", async (req: any, res: any) => {
    const q = await quien(req, res);
    if (!q) return;
    const id = String(req.params.id || "");
    if (!idValido(id)) return res.status(400).json({ error: "Auto no válido." });
    try {
      const s = await q.adminDb.collection("publicaciones").where("agencyId", "==", q.agencyId).where("vehicleId", "==", id).get();
      const docs = s.docs.map((d: any) => d.data()).sort((a: any, b: any) => String(b.fecha).localeCompare(String(a.fecha))).slice(0, 6);
      const { token } = await datosDeRedes(q);
      const lista = await Promise.all(docs.map(async (p: any) => {
        let cifras: any = null;
        if (token) {
          const campos = p.red === "fb" ? "reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0),shares" : "like_count,comments_count";
          const r = await graph(String(p.postId), token, { params: { fields: campos }, ms: 8_000 });
          if (r.ok) {
            cifras = p.red === "fb"
              ? { reacciones: r.data.reactions?.summary?.total_count ?? 0, comentarios: r.data.comments?.summary?.total_count ?? 0, compartidos: r.data.shares?.count ?? 0 }
              : { reacciones: r.data.like_count ?? 0, comentarios: r.data.comments_count ?? 0 };
          }
        }
        return { red: p.red, fecha: p.fecha, url: p.url, cifras };
      }));
      res.json({ publicaciones: lista });
    } catch (e) {
      console.error("redes/lista:", e);
      res.status(500).json({ error: "No se pudo leer lo publicado." });
    }
  });
}
