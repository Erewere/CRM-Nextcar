import { FieldValue } from "firebase-admin/firestore";

/**
 * Publicar un auto en Facebook e Instagram, y saber qué trajo cada publicación.
 *
 * La liga que va en la publicación apunta a una PÁGINA PÚBLICA del auto en el CRM (`/a/:agencia/:auto?o=fb|ig|wa`), que
 * funciona para cualquier agencia, tenga o no sitio web. Esa página:
 *  - se ve bien al compartirse (foto, precio y datos en la vista previa);
 *  - cuenta las visitas por origen (fb, ig, wa) sin contar a los robots que arman la vista previa;
 *  - tiene botones de WhatsApp y Messenger que llevan un CÓDIGO del auto, y cuenta los toques;
 *  - nunca muestra costos, VIN, ni nada interno: solo lo que ya va en una publicación.
 *
 * El código viaja en el mensaje de WhatsApp «(ref abc12345.fb)» o en el `ref` de Messenger (`auto_abc12345_fb`). Cuando el
 * cliente escribe, `enlazarPublicacion` lo lee y liga al contacto con ese auto y con la red de donde vino.
 * Meta no dice QUIÉN vio una publicación (solo cifras): lo que se sabe es quién tocó la liga, quién escribió y de qué auto.
 */

const ORIGENES = ["fb", "ig", "wa", "ot"] as const;
const origenDe = (v: any) => (ORIGENES as readonly string[]).includes(String(v)) ? String(v) : "ot";
const idValido = (s: string) => /^[A-Za-z0-9_-]{1,64}$/.test(s);
const RE_ROBOT = /facebookexternalhit|facebot|whatsapp\/|bot\b|crawl|spider|slurp|preview|curl|wget|python|headless|monitor|lighthouse/i;
const esc = (v: unknown) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const pesos = (n: number) => `$${Math.round(Number(n) || 0).toLocaleString("es-MX")}`;
const telParaEnlace = (t: string) => { const d = String(t || "").replace(/\D/g, ""); return d ? (d.length === 10 ? `52${d}` : d) : ""; };
export const codigoDelAuto = (vehicleId: string) => vehicleId.slice(0, 8);

/** «(ref abc12345.fb)» en un mensaje de WhatsApp. */
export function leerCodigoDeTexto(texto: string): { codigo: string; origen: string } | null {
  const m = /\(ref ([A-Za-z0-9]{6,12})\.(fb|ig|wa|ot)\)/.exec(String(texto || ""));
  return m ? { codigo: m[1], origen: m[2] } : null;
}
/** `auto_abc12345_fb` en el `ref` de Messenger. */
export function leerCodigoDeRef(ref: string): { codigo: string; origen: string } | null {
  const m = /^auto_([A-Za-z0-9]{6,12})_(fb|ig|wa|ot)$/.exec(String(ref || ""));
  return m ? { codigo: m[1], origen: m[2] } : null;
}

/**
 * Liga a un contacto con el auto de la publicación por la que escribió. No crea notas (una nota contaría como «atendido»
 * en Nuevos): deja marcas en el contacto, pone el auto de interés si no tenía otro y corrige «¿Cómo llegó?».
 */
export async function enlazarPublicacion(db: any, p: { agencyId: string; clientId: string; codigo: string; origen: string; canal: "whatsapp" | "messenger" }) {
  try {
    const autos = await db.collection("vehicles").where("agencyId", "==", p.agencyId).get();
    const v = autos.docs.find((d: any) => d.id.startsWith(p.codigo) && !d.data().isDeleted);
    if (!v) return;
    const cRef = db.collection("clients").doc(p.clientId);
    const c = (await cRef.get()).data();
    if (!c || c.agencyId !== p.agencyId || c.publicacionVehicleId === v.id) return;
    const a = v.data();
    const titulo = `${a.year || ""} ${a.make || ""} ${a.model || ""}`.replace(/\s+/g, " ").trim();
    const o = origenDe(p.origen);
    const cambios: any = { publicacionVehicleId: v.id, publicacionOrigen: o, publicacionEn: new Date().toISOString() };
    if (!c.vehicleId) { cambios.vehicleId = v.id; cambios.vehicle = titulo; }
    if ((o === "fb" || o === "ig") && (!c.fuente || c.fuente === "whatsapp" || c.fuente === "facebook")) cambios.fuente = o === "ig" ? "instagram" : "facebook";
    await cRef.update(cambios);
    await db.collection("compartidosAutos").doc(v.id).set({ agencyId: p.agencyId, contactos: { [o]: FieldValue.increment(1) }, ultimoContactoEn: new Date().toISOString() }, { merge: true });
  } catch (e) {
    console.error("publicarAuto/enlazar:", e);
  }
}

export function registrarPublicarAuto(app: any, { getAdminDb, usuarioQuePide, express }: { getAdminDb: () => any; usuarioQuePide: (req: any, res: any) => Promise<any>; express: any }) {
  const toques = new Map<string, { n: number; hasta: number }>();
  const frenoIp = (ip: string, max: number) => {
    const ahora = Date.now();
    const x = toques.get(ip);
    if (!x || x.hasta < ahora) { toques.set(ip, { n: 1, hasta: ahora + 60_000 }); return true; }
    x.n++;
    return x.n <= max;
  };

  const pagina = (cuerpo: string, titulo: string, og = "") =>
    `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(titulo)}</title><meta name="robots" content="noindex">${og}
<style>*{box-sizing:border-box}body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#f4f5f5;color:#0f0f10}.c{max-width:560px;margin:0 auto;background:#fff;min-height:100vh}
.f{width:100%;aspect-ratio:4/3;object-fit:cover;display:block;background:#e5e7eb}.mini{display:flex;gap:6px;overflow-x:auto;padding:8px 12px}.mini img{height:64px;width:86px;object-fit:cover;border-radius:6px;flex:none}
.p{padding:6px 18px 18px}h1{font-size:22px;margin:10px 0 2px;letter-spacing:-.01em}.pr{font-size:30px;font-weight:800;margin:2px 0 10px}.ch{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 14px}.ch span{background:#f1f2f4;border-radius:999px;padding:5px 11px;font-size:13px;color:#3b3b3f}
ul{padding-left:18px;margin:6px 0 14px;line-height:1.55}.b{display:block;text-align:center;text-decoration:none;font-weight:700;border-radius:10px;padding:14px;margin:10px 0;font-size:16px}.wa{background:#1fa855;color:#fff}.ms{background:#0a7cff;color:#fff}.tl{background:#fff;color:#0f0f10;border:1px solid #cfd2d6}
.ag{display:flex;align-items:center;gap:10px;padding:14px 18px;border-top:1px solid #eceef0;color:#52525b;font-size:13px}.ag img{height:34px;width:34px;border-radius:6px;object-fit:cover}.pie{padding:10px 18px 24px;font-size:11px;color:#8b8b93}</style></head><body><div class="c">${cuerpo}</div></body></html>`;

  const noHay = (res: any, texto: string) => res.status(404).type("html").send(pagina(`<div class="p"><h1>${esc(texto)}</h1></div>`, texto));

  // ---------- La página pública del auto ----------
  app.get("/a/:agencyId/:vehicleId", async (req: any, res: any) => {
    const agencyId = String(req.params.agencyId || "");
    const vehicleId = String(req.params.vehicleId || "");
    if (!idValido(agencyId) || !idValido(vehicleId)) return noHay(res, "Este auto no está disponible");
    try {
      const db = getAdminDb();
      if (!db) return noHay(res, "Intenta de nuevo en un momento");
      const [vs, as] = await Promise.all([db.collection("vehicles").doc(vehicleId).get(), db.collection("agencies").doc(agencyId).get()]);
      const v = vs.data();
      const ag = as.data();
      if (!v || !ag || v.agencyId !== agencyId || v.isDeleted) return noHay(res, "Este auto no está disponible");
      const o = origenDe(req.query.o);
      const titulo = `${v.year || ""} ${v.make || ""} ${v.model || ""}`.replace(/\s+/g, " ").trim();
      const vendido = v.status === "sold";
      const fotos: string[] = (Array.isArray(v.photoUrls) ? v.photoUrls : v.photoUrl ? [v.photoUrl] : []).filter((u: any) => typeof u === "string" && u.startsWith("https://")).slice(0, 12);
      const ua = String(req.headers["user-agent"] || "");
      if (!RE_ROBOT.test(ua) && frenoIp(`v:${req.ip}`, 120)) {
        db.collection("compartidosAutos").doc(vehicleId).set({ agencyId, vistas: { [o]: FieldValue.increment(1) }, ultimaVistaEn: new Date().toISOString() }, { merge: true }).catch(() => {});
      }
      const datos = [v.km ? `${Number(v.km).toLocaleString("es-MX")} km` : "", v.transmission, v.color, v.bodyType].filter(Boolean) as string[];
      const code = codigoDelAuto(vehicleId);
      const wa = telParaEnlace(ag.phoneWhatsApp || ag.phone);
      const waTexto = `Hola, me interesa el ${titulo} (ref ${code}.${o})`;
      const url = `https://${req.headers.host}/a/${agencyId}/${vehicleId}`;
      const og = `<meta property="og:type" content="website"><meta property="og:title" content="${esc(`${titulo} · ${pesos(v.price)}`)}"><meta property="og:description" content="${esc([...datos, ag.name].filter(Boolean).join(" · "))}">${fotos[0] ? `<meta property="og:image" content="${esc(fotos[0])}">` : ""}<meta property="og:url" content="${esc(url)}"><meta property="og:site_name" content="${esc(ag.name || "")}"><meta name="twitter:card" content="summary_large_image">`;
      const destacados = String(v.fichaWeb?.loQueNosEncanta || "").split(/\n+/).map((x: string) => x.trim()).filter(Boolean).slice(0, 5);
      const equipo = String(v.equipment || "").split(",").map((x: string) => x.trim()).filter(Boolean).slice(0, 14);
      const cuerpo = `
${fotos[0] ? `<img class="f" src="${esc(fotos[0])}" alt="${esc(titulo)}">` : ""}
${fotos.length > 1 ? `<div class="mini">${fotos.slice(1).map((u) => `<img loading="lazy" src="${esc(u)}" alt="">`).join("")}</div>` : ""}
<div class="p">
  <h1>${esc(titulo)}</h1>
  ${vendido ? `<p class="pr" style="font-size:20px">Este auto ya se vendió</p>` : `<p class="pr">${esc(pesos(v.price))}</p>`}
  ${datos.length ? `<div class="ch">${datos.map((d) => `<span>${esc(d)}</span>`).join("")}</div>` : ""}
  ${destacados.length ? `<ul>${destacados.map((d) => `<li>${esc(d)}</li>`).join("")}</ul>` : ""}
  ${equipo.length ? `<div class="ch">${equipo.map((d) => `<span>${esc(d)}</span>`).join("")}</div>` : ""}
  ${vendido ? "" : `
  ${wa ? `<a class="b wa" data-t="whatsapp" href="https://wa.me/${wa}?text=${encodeURIComponent(waTexto)}">Preguntar por WhatsApp</a>` : ""}
  ${ag.facebookPageId ? `<a class="b ms" data-t="messenger" href="https://m.me/${esc(ag.facebookPageId)}?ref=auto_${code}_${o}">Preguntar por Messenger</a>` : ""}
  ${(ag.phone || ag.phoneWhatsApp) ? `<a class="b tl" data-t="llamar" href="tel:+${telParaEnlace(ag.phone || ag.phoneWhatsApp)}">Llamar</a>` : ""}`}
</div>
<div class="ag">${ag.logoUrl ? `<img src="${esc(ag.logoUrl)}" alt="">` : ""}<div><strong style="color:#0f0f10">${esc(ag.name || "")}</strong>${ag.address ? `<br>${esc(ag.address)}` : ""}</div></div>
<div class="pie">Precio y disponibilidad sujetos a cambio. Publicado desde Nextcar CRM.</div>
<script>document.querySelectorAll('[data-t]').forEach(function(a){a.addEventListener('click',function(){try{navigator.sendBeacon('/a/click',new Blob([JSON.stringify({a:${JSON.stringify(agencyId)},v:${JSON.stringify(vehicleId)},o:${JSON.stringify(o)},t:a.getAttribute('data-t')})],{type:'text/plain'}))}catch(e){}})})</script>`;
      res.set("Cache-Control", "no-cache").type("html").send(pagina(cuerpo, `${titulo} · ${ag.name || ""}`, og));
    } catch (e) {
      console.error("publicarAuto/pagina:", e);
      noHay(res, "Intenta de nuevo en un momento");
    }
  });

  // ---------- Toques en los botones de la página (WhatsApp, Messenger, llamar) ----------
  app.post("/a/click", express.text({ type: "*/*", limit: "2kb" }), async (req: any, res: any) => {
    res.status(204).end();
    try {
      if (!frenoIp(`c:${req.ip}`, 60) || RE_ROBOT.test(String(req.headers["user-agent"] || ""))) return;
      const d = JSON.parse(String(req.body || "{}"));
      const t = ["whatsapp", "messenger", "llamar"].includes(String(d.t)) ? String(d.t) : "";
      if (!t || !idValido(String(d.a)) || !idValido(String(d.v))) return;
      const db = getAdminDb();
      const v = (await db.collection("vehicles").doc(String(d.v)).get()).data();
      if (!v || v.agencyId !== String(d.a)) return;
      await db.collection("compartidosAutos").doc(String(d.v)).set({ agencyId: String(d.a), toques: { [`${t}_${origenDe(d.o)}`]: FieldValue.increment(1) } }, { merge: true });
    } catch { /* un toque que no se cuenta no es un problema */ }
  });

  // ---------- Lo que ha traído la publicación de un auto (para la ficha) ----------
  app.get("/api/autos/:id/publicacion", async (req: any, res: any) => {
    const q = await usuarioQuePide(req, res);
    if (!q) return;
    const id = String(req.params.id || "");
    if (!idValido(id)) return res.status(400).json({ error: "Auto no válido." });
    try {
      const v = (await q.adminDb.collection("vehicles").doc(id).get()).data();
      if (!v || v.agencyId !== q.agencyId) return res.status(404).json({ error: "No encontramos ese auto." });
      const s = (await q.adminDb.collection("compartidosAutos").doc(id).get()).data() || {};
      const interesados = (await q.adminDb.collection("clients").where("agencyId", "==", q.agencyId).where("publicacionVehicleId", "==", id).count().get()).data().count;
      res.json({ vistas: s.vistas || {}, toques: s.toques || {}, contactos: s.contactos || {}, interesados, agencyId: q.agencyId, codigo: codigoDelAuto(id) });
    } catch (e) {
      console.error("publicarAuto/stats:", e);
      res.status(500).json({ error: "No se pudo leer." });
    }
  });
}
