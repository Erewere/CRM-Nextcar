import crypto from "crypto";
import { avanceDatos, camposDelPdf, heredarMapa } from "../lib/creditoCampos.ts";

/**
 * Solicitudes de crédito (mejora 8).
 *
 * Todo pasa por el servidor: las colecciones solicitudesCredito y
 * formatosCredito no tienen regla para el navegador (las reglas niegan por
 * omisión), y los archivos van a Storage sin liga pública. Cada petición
 * revisa agencia y rol; un vendedor solo ve las solicitudes de sus clientes.
 *
 * El cliente llena la suya con una liga (token al azar, se guarda solo su
 * huella sha256, vence en 7 días). Esas rutas públicas tienen límite de
 * peticiones por IP y solo tocan la solicitud de ese token.
 */

const ROLES_TODO = new Set(["admin", "manager", "master"]);
const MAX_DOC = 15 * 1024 * 1024;
const MAX_FORMATO = 15 * 1024 * 1024;
const MAX_DOCS_POR_SOLICITUD = 40;
const DIAS_LIGA = 7;
const TIPOS_ARCHIVO = /^(application\/pdf|image\/(jpeg|png|webp|heic|heif))$/;
const TIPOS_DOC = new Set(["ine", "domicilio", "ingresos", "constancia", "firmada", "otro"]);
const ETAPAS = ["recibida", "datos", "enviada", "respuesta", "cerrada", "cancelada"];
const ESTADOS_BANCO = new Set(["pendiente", "firmada", "enviada", "aprobado", "condiciones", "rechazado"]);
const idValido = (s: string) => /^[A-Za-z0-9_-]{1,64}$/.test(s);

/** Datos del cliente: solo texto corto, números y objetos poco profundos. */
function limpiarDatos(v: any, prof = 0): any {
  if (prof > 4) return undefined;
  if (typeof v === "string") return v.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 300);
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  if (typeof v === "boolean") return v;
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const o: any = {};
    for (const [k, x] of Object.entries(v).slice(0, 80)) {
      if (!/^[A-Za-z0-9_]{1,40}$/.test(k)) continue;
      const l = limpiarDatos(x, prof + 1);
      if (l !== undefined && l !== "") o[k] = l;
    }
    return o;
  }
  return undefined;
}

function partirNombre(nombre: string) {
  const p = String(nombre || "").trim().split(/\s+/).filter(Boolean);
  if (p.length >= 4) return { nombres: p.slice(0, -2).join(" "), apellidoPaterno: p[p.length - 2], apellidoMaterno: p[p.length - 1] };
  if (p.length === 3) return { nombres: p[0], apellidoPaterno: p[1], apellidoMaterno: p[2] };
  if (p.length === 2) return { nombres: p[0], apellidoPaterno: p[1], apellidoMaterno: "" };
  return { nombres: p[0] || "", apellidoPaterno: "", apellidoMaterno: "" };
}

/** Lo que ve la lista: sin datos personales ni rutas. */
function resumen(id: string, x: any) {
  return {
    id,
    clienteNombre: x.clienteNombre || "",
    clientId: x.clientId,
    auto: x.auto || "",
    vehicleId: x.vehicleId || null,
    dealId: x.dealId || null,
    origen: x.origen || 'manual',
    vendedorId: x.vendedorId,
    vendedorNombre: x.vendedorNombre || "",
    etapa: x.etapa,
    bancos: (x.bancos || []).map((b: any) => ({ clave: b.clave, nombre: b.nombre, estado: b.estado, folio: b.folio || "" })),
    operacion: x.operacion || {},
    avance: avanceDatos(x.datos || {}),
    documentos: (x.documentos || []).map((d: any) => d.tipo),
    ligaVence: x.ligaVence || null,
    ligaAbiertaEl: x.ligaAbiertaEl || null,
    clienteTerminoEl: x.clienteTerminoEl || null,
    creadoEl: x.creadoEl,
    actualizadoEl: x.actualizadoEl,
  };
}

/** Completa, para el expediente (sin la huella de la liga ni rutas de Storage). */
function completa(id: string, x: any) {
  const { ligaHash, documentos, ...resto } = x;
  return { id, ...resto, documentos: (documentos || []).map(({ ruta, ...d }: any) => d) };
}

export function registrarCreditos(app: any, deps: {
  express: any;
  usuarioQuePide: (req: any, res: any) => Promise<null | { uid: string; rol: string; agencyId: string; adminDb: any }>;
  getAdminDb: () => any;
  bucket: () => any;
}) {
  const { express, usuarioQuePide, getAdminDb, bucket } = deps;
  const col = (db: any) => db.collection("solicitudesCredito");
  const colFormatos = (db: any) => db.collection("formatosCredito");

  // ---------- Límite de peticiones para las rutas públicas ----------
  const visitas = new Map<string, { n: number; desde: number }>();
  const limite = (req: any, res: any, max = 240) => {
    const ip = String(req.headers["x-forwarded-for"] || req.ip || "").split(",")[0].trim() || "?";
    const ahora = Date.now();
    const v = visitas.get(ip);
    if (!v || ahora - v.desde > 15 * 60 * 1000) { visitas.set(ip, { n: 1, desde: ahora }); return true; }
    v.n++;
    if (v.n > max) { res.status(429).json({ error: "Demasiadas solicitudes. Intenta en unos minutos." }); return false; }
    return true;
  };
  setInterval(() => { const corte = Date.now() - 15 * 60 * 1000; for (const [k, v] of visitas) if (v.desde < corte) visitas.delete(k); }, 10 * 60 * 1000).unref?.();

  async function nombreDe(db: any, uid: string) {
    const u = (await db.collection("users").doc(uid).get()).data() || {};
    return String(u.name || u.email || "Usuario");
  }

  /** La solicitud, si quien pide puede verla. */
  async function solicitudDe(req: any, res: any) {
    const q = await usuarioQuePide(req, res);
    if (!q) return null;
    const id = String(req.params.id || "");
    if (!idValido(id)) { res.status(400).json({ error: "Solicitud no válida." }); return null; }
    const snap = await col(q.adminDb).doc(id).get();
    const x = snap.exists ? snap.data() : null;
    const deSuAgencia = x && (x.agencyId === q.agencyId || q.rol === "master");
    const puede = deSuAgencia && (ROLES_TODO.has(q.rol) || x.vendedorId === q.uid);
    if (!puede) { res.status(404).json({ error: "No encontramos esta solicitud." }); return null; }
    return { ...q, id, ref: snap.ref, x };
  }

  /** Formatos que ve una agencia: los de la plataforma y los suyos (los suyos reemplazan al de igual clave). */
  async function formatosVisibles(db: any, agencyId: string) {
    const [globales, propios] = await Promise.all([
      colFormatos(db).where("agencyId", "==", null).get(),
      colFormatos(db).where("agencyId", "==", agencyId).get(),
    ]);
    const mapa = new Map<string, any>();
    globales.docs.forEach((d: any) => mapa.set(d.data().clave, { id: d.id, ...d.data() }));
    propios.docs.forEach((d: any) => mapa.set(d.data().clave, { id: d.id, ...d.data() }));
    return [...mapa.values()].filter((f) => !f.archivado).map(({ ruta, ...f }) => f);
  }

  const historial = (texto: string, por: string) => ({ fecha: new Date().toISOString(), texto: texto.slice(0, 300), por });

  function etapaPorBancos(etapa: string, bancos: any[]) {
    if (etapa === "cerrada" || etapa === "cancelada") return etapa;
    const estados = bancos.map((b) => b.estado);
    if (estados.some((e) => ["aprobado", "condiciones", "rechazado"].includes(e))) return "respuesta";
    if (estados.includes("enviada")) return ETAPAS.indexOf(etapa) < 2 ? "enviada" : etapa;
    return etapa;
  }

  // =================== Agencia ===================

  app.get("/api/creditos", async (req: any, res: any) => {
    const q = await usuarioQuePide(req, res);
    if (!q) return;
    try {
      let consulta = col(q.adminDb).where("agencyId", "==", q.agencyId);
      if (!ROLES_TODO.has(q.rol)) consulta = consulta.where("vendedorId", "==", q.uid);
      const cliente = String(req.query?.clientId || "");
      if (idValido(cliente)) consulta = consulta.where("clientId", "==", cliente);
      const snap = await consulta.limit(500).get();
      res.json({ solicitudes: snap.docs.map((d: any) => resumen(d.id, d.data())) });
    } catch (e) {
      console.error("creditos/lista:", e);
      res.status(500).json({ error: "No se pudieron leer las solicitudes." });
    }
  });

  /** Crea una solicitud con los datos del cliente. La usan «Nueva solicitud» y el embudo. */
  async function crearSolicitud(q: { uid: string; rol: string; agencyId: string; adminDb: any }, p: { clientId: string; vehicleId?: string | null; bancos?: any[]; todosLosBancos?: boolean; operacion?: any; dealId?: string | null; origen?: string }) {
    const c = (await q.adminDb.collection("clients").doc(String(p.clientId)).get()).data();
    if (!c || c.agencyId !== q.agencyId) return { status: 404, error: "No encontramos ese cliente en tu agencia." };
    if (!ROLES_TODO.has(q.rol) && c.sellerId !== q.uid) return { status: 403, error: "Solo puedes abrir solicitudes de tus clientes." };
    let auto = "";
    let vid: string | null = null;
    let precioAuto = 0;
    if (p.vehicleId && idValido(String(p.vehicleId))) {
      const v = (await q.adminDb.collection("vehicles").doc(String(p.vehicleId)).get()).data();
      if (v && v.agencyId === q.agencyId) { auto = `${v.year || ""} ${v.make || ""} ${v.model || ""}`.trim(); vid = String(p.vehicleId); precioAuto = Number(v.price) || 0; }
    }
    const visibles = await formatosVisibles(q.adminDb, q.agencyId);
    const elegidos: any[] = [];
    const lista = p.todosLosBancos ? visibles.map((f: any) => f.id) : (Array.isArray(p.bancos) ? p.bancos.slice(0, 6) : []);
    for (const b of lista) {
      if (b === "casa") elegidos.push({ clave: "casa", nombre: "Crédito de la casa", formatoId: null, estado: "pendiente" });
      else { const f = visibles.find((x: any) => x.id === b); if (f) elegidos.push({ clave: f.clave, nombre: f.nombre, formatoId: f.id, estado: "pendiente" }); }
    }
    if (!elegidos.length) return { status: 400, error: "Elige al menos un banco o crédito de la casa." };
    const n = partirNombre(c.name);
    const datos = limpiarDatos({
      ...n,
      email: c.email || "",
      celular: String(c.phone || "").replace(/\D/g, "").slice(-10),
      dom: { calle: c.street || "", numExt: c.exteriorNumber || "", colonia: c.neighborhood || "", ciudad: c.city || "", cp: c.zipCode || "" },
      paisNacimiento: "México",
      nacionalidad: "mexicana",
    }) || {};
    const vendedorId = c.sellerId || q.uid;
    const ahora = new Date().toISOString();
    const quien = await nombreDe(q.adminDb, q.uid);
    let operacion = limpiarDatos(p.operacion || {}) || {};
    if (!operacion.precio && precioAuto) operacion = { precio: precioAuto, enganche: Math.round(precioAuto * 0.2), plazo: 48, ...operacion };
    if (operacion.precio && !operacion.enganche) operacion = { ...operacion, enganche: Math.round(Number(operacion.precio) * 0.2), plazo: operacion.plazo || 48 };
    const doc = {
      agencyId: q.agencyId,
      clientId: String(p.clientId),
      clienteNombre: c.name || "",
      clienteTelefono: c.phone || "",
      vehicleId: vid,
      auto,
      dealId: p.dealId || null,
      origen: p.origen || "manual",
      vendedorId,
      vendedorNombre: vendedorId === q.uid ? quien : await nombreDe(q.adminDb, vendedorId),
      etapa: "recibida",
      bancos: elegidos,
      operacion,
      datos,
      documentos: [],
      historial: [historial(p.origen === "embudo" ? `${quien} pasó el trato a la etapa de crédito en el embudo: se abrió la solicitud.` : `Solicitud creada por ${quien}.`, q.uid)],
      ligaHash: null,
      ligaVence: null,
      creadoEl: ahora,
      actualizadoEl: ahora,
    };
    const ref = await col(q.adminDb).add(doc);
    return { solicitud: completa(ref.id, doc) };
  }

  app.post("/api/creditos", async (req: any, res: any) => {
    const q = await usuarioQuePide(req, res);
    if (!q) return;
    const { clientId, vehicleId, bancos, operacion } = req.body || {};
    if (!idValido(String(clientId || ""))) return res.status(400).json({ error: "Elige un cliente." });
    try {
      const r: any = await crearSolicitud(q, { clientId, vehicleId, bancos, operacion });
      if (r.error) return res.status(r.status).json({ error: r.error });
      res.json({ solicitud: r.solicitud });
    } catch (e) {
      console.error("creditos/crear:", e);
      res.status(500).json({ error: "No se pudo crear la solicitud." });
    }
  });

  /** ¿Esta etapa del embudo es la de crédito? Por su nombre: cada agencia nombra sus etapas. */
  const esEtapaCredito = (titulo: string) => /credito/.test(String(titulo || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));

  // Un trato llegó a la etapa «Crédito» del embudo: se abre (o se liga) su solicitud.
  app.post("/api/creditos/desde-trato", async (req: any, res: any) => {
    const q = await usuarioQuePide(req, res);
    if (!q) return;
    const dealId = String(req.body?.dealId || "");
    if (!idValido(dealId)) return res.status(400).json({ error: "Trato no válido." });
    try {
      const d = (await q.adminDb.collection("deals").doc(dealId).get()).data();
      if (!d || d.agencyId !== q.agencyId) return res.status(404).json({ error: "No encontramos ese trato." });
      const ag = (await q.adminDb.collection("agencies").doc(q.agencyId).get()).data() || {};
      // Sin embudo propio, la agencia usa las etapas de fábrica (con «Crédito», id "credito").
      const etapas = Array.isArray(ag.pipelineStages) && ag.pipelineStages.length ? ag.pipelineStages : [{ id: "credito", title: "Crédito" }];
      const etapa = etapas.find((e: any) => e.id === d.status);
      if (!etapa || !esEtapaCredito(etapa.title)) return res.json({ creada: false, motivo: "no-es-credito" });
      const clientId = String(d.clientId || "");
      if (!idValido(clientId)) return res.json({ creada: false, motivo: "sin-cliente" });
      // Sin duplicados: si el cliente ya tiene una solicitud activa, se liga a este trato.
      const previas = await col(q.adminDb).where("agencyId", "==", q.agencyId).where("clientId", "==", clientId).get();
      const activa = previas.docs.find((x: any) => !["cerrada", "cancelada"].includes(x.data().etapa));
      if (activa) {
        if (!activa.data().dealId) await activa.ref.update({ dealId, actualizadoEl: new Date().toISOString() });
        return res.json({ creada: false, motivo: "ya-existe", id: activa.id, clienteNombre: activa.data().clienteNombre });
      }
      const r: any = await crearSolicitud(q, { clientId, vehicleId: d.vehicleId || null, todosLosBancos: true, operacion: d.value ? { precio: Number(d.value) || 0 } : {}, dealId, origen: "embudo" });
      if (r.error) return res.status(r.status).json({ error: r.error });
      res.json({ creada: true, id: r.solicitud.id, clienteNombre: r.solicitud.clienteNombre });
    } catch (e) {
      console.error("creditos/desde-trato:", e);
      res.status(500).json({ error: "No se pudo abrir la solicitud de crédito." });
    }
  });

  app.get("/api/creditos/formatos", async (req: any, res: any) => {
    const q = await usuarioQuePide(req, res);
    if (!q) return;
    try { res.json({ formatos: await formatosVisibles(q.adminDb, q.agencyId) }); }
    catch (e) { console.error("creditos/formatos:", e); res.status(500).json({ error: "No se pudieron leer los formatos." }); }
  });

  app.get("/api/creditos/formatos/:fid/pdf", async (req: any, res: any) => {
    const q = await usuarioQuePide(req, res);
    if (!q) return;
    const fid = String(req.params.fid || "");
    if (!idValido(fid)) return res.status(400).json({ error: "Formato no válido." });
    const d = (await colFormatos(q.adminDb).doc(fid).get()).data();
    if (!d || (d.agencyId && d.agencyId !== q.agencyId && q.rol !== "master")) return res.status(404).json({ error: "No encontramos ese formato." });
    try {
      const [bytes] = await bucket().file(d.ruta).download();
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Cache-Control", "private, no-store");
      res.send(bytes);
    } catch (e) { console.error("formatos/pdf:", e); res.status(500).json({ error: "No se pudo abrir el formato." }); }
  });

  // Subir un formato nuevo o una versión nueva de uno que ya existe.
  app.post("/api/creditos/formatos", express.raw({ type: () => true, limit: MAX_FORMATO }), async (req: any, res: any) => {
    const q = await usuarioQuePide(req, res);
    if (!q) return;
    if (!ROLES_TODO.has(q.rol)) return res.status(403).json({ error: "Solo administradores cambian los formatos." });
    const cuerpo = req.body as Buffer;
    if (!Buffer.isBuffer(cuerpo) || !cuerpo.length) return res.status(400).json({ error: "El archivo llegó vacío." });
    let nombre = "";
    try { nombre = decodeURIComponent(String(req.headers["x-nombre"] || "")); } catch {}
    nombre = nombre.replace(/[\u0000-\u001f\\/]+/g, " ").trim().slice(0, 60);
    const reemplaza = String(req.headers["x-reemplaza"] || "");
    try {
      let campos;
      try { campos = await camposDelPdf(cuerpo); } catch { return res.status(400).json({ error: "No pudimos leer ese PDF. ¿Es el formato del banco con sus casillas para llenar?" }); }
      if (!campos.filter((c) => c.tipo !== "otro").length) return res.status(400).json({ error: "Ese PDF no tiene casillas para llenar: pide al banco la versión «rellenable»." });
      let anterior: any = null;
      if (reemplaza && idValido(reemplaza)) {
        const a = await colFormatos(q.adminDb).doc(reemplaza).get();
        if (a.exists && (!a.data().agencyId || a.data().agencyId === q.agencyId || q.rol === "master")) anterior = { id: a.id, ...a.data() };
      }
      const clave = anterior?.clave || (nombre || "banco").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").slice(0, 30);
      // Un global solo lo cambia el master; si lo cambia una agencia, queda como versión suya.
      const agencyId = anterior ? (anterior.agencyId || (q.rol === "master" ? null : q.agencyId)) : (q.rol === "master" && req.headers["x-global"] === "1" ? null : q.agencyId);
      const destinoId = anterior && (anterior.agencyId || q.rol === "master") && agencyId === (anterior.agencyId ?? null) ? anterior.id : null;
      const { mapa, conservados, sinAcomodar } = heredarMapa(anterior?.mapa || {}, campos);
      const ref = destinoId ? colFormatos(q.adminDb).doc(destinoId) : colFormatos(q.adminDb).doc();
      const version = (anterior?.version || 0) + 1;
      const ruta = `formatosCredito/${agencyId || "global"}/${ref.id}/v${version}.pdf`;
      await bucket().file(ruta).save(cuerpo, { contentType: "application/pdf", resumable: false });
      const datos = {
        clave,
        nombre: nombre || anterior?.nombre || "Banco",
        agencyId,
        version,
        ruta,
        campos,
        mapa,
        mayusculas: anterior?.mayusculas ?? true,
        actualizadoEl: new Date().toISOString(),
        actualizadoPor: q.uid,
      };
      await ref.set(datos);
      const { ruta: _r, ...publico } = datos;
      res.json({ formato: { id: ref.id, ...publico }, conservados, sinAcomodar });
    } catch (e) {
      console.error("formatos/subir:", e);
      res.status(500).json({ error: "No se pudo guardar el formato." });
    }
  });

  app.patch("/api/creditos/formatos/:fid", async (req: any, res: any) => {
    const q = await usuarioQuePide(req, res);
    if (!q) return;
    if (!ROLES_TODO.has(q.rol)) return res.status(403).json({ error: "Solo administradores cambian los formatos." });
    const fid = String(req.params.fid || "");
    if (!idValido(fid)) return res.status(400).json({ error: "Formato no válido." });
    const ref = colFormatos(q.adminDb).doc(fid);
    const d = (await ref.get()).data();
    if (!d) return res.status(404).json({ error: "No encontramos ese formato." });
    if (!d.agencyId && q.rol !== "master") return res.status(403).json({ error: "Este formato es de la plataforma: sube una versión para tu agencia si necesitas cambiarlo." });
    if (d.agencyId && d.agencyId !== q.agencyId && q.rol !== "master") return res.status(404).json({ error: "No encontramos ese formato." });
    const { mapa, nombre, mayusculas } = req.body || {};
    const cambios: any = { actualizadoEl: new Date().toISOString(), actualizadoPor: q.uid };
    if (mapa && typeof mapa === "object") {
      const limpio: any = {};
      const nombres = new Set((d.campos || []).map((c: any) => c.nombre));
      for (const [k, v] of Object.entries(mapa).slice(0, 600)) {
        if (!nombres.has(k) || !v || typeof v !== "object") continue;
        const m: any = v;
        const e: any = {};
        if (typeof m.clave === "string" && m.clave.length <= 80) e.clave = m.clave;
        if (typeof m.fijo === "string" && m.fijo.length <= 120) e.fijo = m.fijo;
        if (m.opciones && typeof m.opciones === "object") {
          e.opciones = {};
          for (const [a, b] of Object.entries(m.opciones).slice(0, 40)) if (typeof b === "string" && b.length <= 40 && a.length <= 60) e.opciones[a] = b;
        }
        if (e.clave || e.fijo) limpio[k] = e;
      }
      cambios.mapa = limpio;
    }
    if (typeof nombre === "string" && nombre.trim()) cambios.nombre = nombre.trim().slice(0, 60);
    if (typeof mayusculas === "boolean") cambios.mayusculas = mayusculas;
    await ref.update(cambios);
    res.json({ ok: true });
  });

  app.get("/api/creditos/:id", async (req: any, res: any) => {
    const s = await solicitudDe(req, res);
    if (!s) return;
    res.json({ solicitud: completa(s.id, s.x) });
  });

  app.patch("/api/creditos/:id", async (req: any, res: any) => {
    const s = await solicitudDe(req, res);
    if (!s) return;
    const { datos, etapa, bancos, operacion, nota } = req.body || {};
    const quien = await nombreDe(s.adminDb, s.uid);
    const cambios: any = { actualizadoEl: new Date().toISOString() };
    const hist: any[] = [];
    if (datos && typeof datos === "object") { cambios.datos = limpiarDatos(datos) || {}; }
    if (operacion && typeof operacion === "object") cambios.operacion = limpiarDatos(operacion) || {};
    let nuevosBancos = s.x.bancos || [];
    if (Array.isArray(bancos)) {
      const visibles = await formatosVisibles(s.adminDb, s.x.agencyId);
      nuevosBancos = bancos.slice(0, 6).map((b: any) => {
        const prev = (s.x.bancos || []).find((p: any) => p.clave === b?.clave) || {};
        const formato = b?.clave === "casa" ? null : visibles.find((f: any) => f.clave === b?.clave || f.id === b?.formatoId);
        if (b?.clave !== "casa" && !formato && !prev.clave) return null;
        const estado = ESTADOS_BANCO.has(b?.estado) ? b.estado : (prev.estado || "pendiente");
        const nombre = prev.nombre || formato?.nombre || "Crédito de la casa";
        if (prev.estado && prev.estado !== estado) hist.push(historial(`${nombre}: ${estado === "enviada" ? "enviada al banco" : estado === "firmada" ? "solicitud firmada" : estado}.`, s.uid));
        if (!prev.clave) hist.push(historial(`Se agregó ${nombre}.`, s.uid));
        const ahora = new Date().toISOString();
        return {
          clave: b?.clave === "casa" ? "casa" : (formato?.clave || prev.clave),
          nombre,
          formatoId: b?.clave === "casa" ? null : (formato?.id || prev.formatoId || null),
          estado,
          folio: String(b?.folio ?? prev.folio ?? "").slice(0, 40),
          nota: String(b?.nota ?? prev.nota ?? "").slice(0, 300),
          enviadaEl: estado === "enviada" && prev.estado !== "enviada" ? ahora : (prev.enviadaEl || null),
          respuestaEl: ["aprobado", "condiciones", "rechazado"].includes(estado) && prev.estado !== estado ? ahora : (prev.respuestaEl || null),
        };
      }).filter(Boolean);
      for (const p of s.x.bancos || []) if (!nuevosBancos.find((b: any) => b.clave === p.clave)) hist.push(historial(`Se quitó ${p.nombre}.`, s.uid));
      cambios.bancos = nuevosBancos;
    }
    let nuevaEtapa = s.x.etapa;
    if (typeof etapa === "string" && ETAPAS.includes(etapa) && etapa !== s.x.etapa) {
      if (etapa === "cancelada" && !ROLES_TODO.has(s.rol) && s.x.vendedorId !== s.uid) return res.status(403).json({ error: "No puedes cancelar esta solicitud." });
      nuevaEtapa = etapa;
      hist.push(historial(`Etapa: ${etapa}.`, s.uid));
    }
    nuevaEtapa = etapaPorBancos(nuevaEtapa, nuevosBancos);
    if (nuevaEtapa !== s.x.etapa) cambios.etapa = nuevaEtapa;
    if (typeof nota === "string" && nota.trim()) hist.push(historial(`${quien}: ${nota.trim()}`, s.uid));
    if (hist.length) cambios.historial = [...hist.reverse(), ...(s.x.historial || [])].slice(0, 200);
    await s.ref.update(cambios);
    const nuevo = (await s.ref.get()).data();
    res.json({ solicitud: completa(s.id, nuevo) });
  });

  app.post("/api/creditos/:id/liga", async (req: any, res: any) => {
    const s = await solicitudDe(req, res);
    if (!s) return;
    const token = crypto.randomBytes(24).toString("base64url");
    const vence = new Date(Date.now() + DIAS_LIGA * 86400000).toISOString();
    const quien = await nombreDe(s.adminDb, s.uid);
    const cambios: any = {
      ligaHash: crypto.createHash("sha256").update(token).digest("hex"),
      ligaVence: vence,
      actualizadoEl: new Date().toISOString(),
      historial: [historial(`${quien} generó la liga para el cliente (vence en ${DIAS_LIGA} días).`, s.uid), ...(s.x.historial || [])].slice(0, 200),
    };
    if (s.x.etapa === "recibida") cambios.etapa = "datos";
    await s.ref.update(cambios);
    const host = String(req.headers["x-forwarded-host"] || req.headers.host || "crm.erewere.com");
    const proto = host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https";
    res.json({ url: `${proto}://${host}/solicitud/${token}`, vence });
  });

  app.delete("/api/creditos/:id/liga", async (req: any, res: any) => {
    const s = await solicitudDe(req, res);
    if (!s) return;
    await s.ref.update({ ligaHash: null, ligaVence: null, actualizadoEl: new Date().toISOString() });
    res.json({ ok: true });
  });

  async function guardarDocumento(ref: any, x: any, cuerpo: Buffer, tipoMime: string, meta: { tipo: string; nombre: string; banco?: string; por: "cliente" | "agencia"; porNombre: string }) {
    const id = crypto.randomBytes(10).toString("hex");
    const ruta = `creditos/${x.agencyId}/${ref.id}/${id}`;
    await bucket().file(ruta).save(cuerpo, { contentType: tipoMime, resumable: false });
    const doc = { id, tipo: meta.tipo, nombre: meta.nombre, banco: meta.banco || null, mime: tipoMime, tamano: cuerpo.length, ruta, por: meta.por, porNombre: meta.porNombre, subidoEl: new Date().toISOString() };
    const docs = [...(x.documentos || []), doc];
    const hist = [historial(`${meta.porNombre} subió: ${meta.nombre}.`, meta.por), ...(x.historial || [])].slice(0, 200);
    const cambios: any = { documentos: docs, historial: hist, actualizadoEl: doc.subidoEl };
    // La solicitud firmada de un banco pasa ese banco a «firmada».
    if (meta.tipo === "firmada" && meta.banco) {
      cambios.bancos = (x.bancos || []).map((b: any) => (b.clave === meta.banco && b.estado === "pendiente" ? { ...b, estado: "firmada" } : b));
    }
    await ref.update(cambios);
    const { ruta: _r, ...publico } = doc;
    return publico;
  }

  function leerSubida(req: any, res: any) {
    const cuerpo = req.body as Buffer;
    const mime = String(req.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
    if (!Buffer.isBuffer(cuerpo) || !cuerpo.length) { res.status(400).json({ error: "El archivo llegó vacío." }); return null; }
    if (!TIPOS_ARCHIVO.test(mime)) { res.status(400).json({ error: "Sube una foto (JPG o PNG) o un PDF." }); return null; }
    const tipo = String(req.headers["x-tipo"] || "otro");
    if (!TIPOS_DOC.has(tipo)) { res.status(400).json({ error: "Tipo de documento no válido." }); return null; }
    let nombre = "documento";
    try { nombre = decodeURIComponent(String(req.headers["x-nombre"] || "documento")); } catch {}
    nombre = nombre.replace(/[\u0000-\u001f\\/]+/g, " ").trim().slice(0, 120) || "documento";
    const banco = String(req.headers["x-banco"] || "").replace(/[^a-z0-9-]/g, "").slice(0, 30);
    return { cuerpo, mime, tipo, nombre, banco };
  }

  app.post("/api/creditos/:id/documentos", express.raw({ type: () => true, limit: MAX_DOC }), async (req: any, res: any) => {
    const s = await solicitudDe(req, res);
    if (!s) return;
    const sub = leerSubida(req, res);
    if (!sub) return;
    if ((s.x.documentos || []).length >= MAX_DOCS_POR_SOLICITUD) return res.status(400).json({ error: "Esta solicitud ya tiene demasiados archivos." });
    try {
      const doc = await guardarDocumento(s.ref, s.x, sub.cuerpo, sub.mime, { tipo: sub.tipo, nombre: sub.nombre, banco: sub.banco, por: "agencia", porNombre: await nombreDe(s.adminDb, s.uid) });
      res.json({ documento: doc });
    } catch (e) { console.error("creditos/doc:", e); res.status(500).json({ error: "No se pudo guardar el archivo." }); }
  });

  app.get("/api/creditos/:id/documentos/:docId", async (req: any, res: any) => {
    const s = await solicitudDe(req, res);
    if (!s) return;
    const d = (s.x.documentos || []).find((x: any) => x.id === String(req.params.docId));
    if (!d) return res.status(404).json({ error: "No encontramos ese archivo." });
    try {
      const [bytes] = await bucket().file(d.ruta).download();
      res.setHeader("Content-Type", d.mime || "application/octet-stream");
      res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(d.nombre)}`);
      res.setHeader("Cache-Control", "private, no-store");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.send(bytes);
    } catch (e) { console.error("creditos/ver:", e); res.status(500).json({ error: "No se pudo abrir el archivo." }); }
  });

  app.delete("/api/creditos/:id/documentos/:docId", async (req: any, res: any) => {
    const s = await solicitudDe(req, res);
    if (!s) return;
    const d = (s.x.documentos || []).find((x: any) => x.id === String(req.params.docId));
    if (!d) return res.status(404).json({ error: "No encontramos ese archivo." });
    try {
      await bucket().file(d.ruta).delete({ ignoreNotFound: true });
      const quien = await nombreDe(s.adminDb, s.uid);
      await s.ref.update({
        documentos: (s.x.documentos || []).filter((x: any) => x.id !== d.id),
        historial: [historial(`${quien} quitó: ${d.nombre}.`, s.uid), ...(s.x.historial || [])].slice(0, 200),
        actualizadoEl: new Date().toISOString(),
      });
      res.json({ ok: true });
    } catch (e) { console.error("creditos/quitar:", e); res.status(500).json({ error: "No se pudo quitar el archivo." }); }
  });

  // =================== Cliente (liga) ===================

  async function porToken(req: any, res: any) {
    if (!limite(req, res)) return null;
    const token = String(req.params.token || "");
    if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) { res.status(404).json({ error: "Esta liga no es válida." }); return null; }
    const db = getAdminDb();
    if (!db) { res.status(500).json({ error: "Servicio no disponible." }); return null; }
    const hash = crypto.createHash("sha256").update(token).digest("hex");
    const snap = await col(db).where("ligaHash", "==", hash).limit(1).get();
    const d = snap.docs[0];
    const x = d?.data();
    if (!x) { res.status(404).json({ error: "Esta liga no es válida o ya se cambió. Pide una nueva a tu asesor." }); return null; }
    if (!x.ligaVence || new Date(x.ligaVence).getTime() < Date.now()) { res.status(410).json({ error: "Esta liga ya venció. Pide una nueva a tu asesor." }); return null; }
    if (x.etapa === "cancelada") { res.status(410).json({ error: "Esta solicitud ya no está activa." }); return null; }
    return { db, ref: d.ref, x };
  }

  app.get("/api/solicitud/:token", async (req: any, res: any) => {
    const t = await porToken(req, res);
    if (!t) return;
    try {
      const ag = (await t.db.collection("agencies").doc(t.x.agencyId).get()).data() || {};
      if (!t.x.ligaAbiertaEl) {
        await t.ref.update({ ligaAbiertaEl: new Date().toISOString(), historial: [historial("El cliente abrió la liga.", "cliente"), ...(t.x.historial || [])].slice(0, 200) });
      }
      const formatos = await formatosVisibles(t.db, t.x.agencyId);
      res.json({
        agencia: { name: ag.name || "", logoUrl: ag.logoUrl || "", phone: ag.phoneWhatsApp || ag.phone || "" },
        auto: t.x.auto || "",
        operacion: t.x.operacion || {},
        bancos: (t.x.bancos || []).map((b: any) => {
          const f = formatos.find((x: any) => x.id === b.formatoId);
          return { clave: b.clave, nombre: b.nombre, formatoId: b.formatoId, mapa: f?.mapa || null, mayusculas: f?.mayusculas ?? true };
        }),
        datos: t.x.datos || {},
        documentos: (t.x.documentos || []).filter((d: any) => d.por === "cliente").map(({ ruta, ...d }: any) => d),
        tiposAgencia: (t.x.documentos || []).filter((d: any) => d.por === "agencia").map((d: any) => d.tipo),
        vence: t.x.ligaVence,
        terminadoEl: t.x.clienteTerminoEl || null,
      });
    } catch (e) { console.error("solicitud/ver:", e); res.status(500).json({ error: "No se pudo abrir la solicitud." }); }
  });

  app.patch("/api/solicitud/:token", async (req: any, res: any) => {
    const t = await porToken(req, res);
    if (!t) return;
    const datos = limpiarDatos(req.body?.datos || {});
    if (!datos) return res.status(400).json({ error: "Datos no válidos." });
    await t.ref.update({ datos, clienteEditoEl: new Date().toISOString(), actualizadoEl: new Date().toISOString() });
    res.json({ ok: true });
  });

  app.post("/api/solicitud/:token/documentos", express.raw({ type: () => true, limit: MAX_DOC }), async (req: any, res: any) => {
    const t = await porToken(req, res);
    if (!t) return;
    if (!limite(req, res, 60)) return;
    const sub = leerSubida(req, res);
    if (!sub) return;
    if ((t.x.documentos || []).length >= MAX_DOCS_POR_SOLICITUD) return res.status(400).json({ error: "Ya subiste demasiados archivos. Habla con tu asesor." });
    try {
      const doc = await guardarDocumento(t.ref, t.x, sub.cuerpo, sub.mime, { tipo: sub.tipo, nombre: sub.nombre, banco: sub.banco, por: "cliente", porNombre: "El cliente" });
      res.json({ documento: doc });
    } catch (e) { console.error("solicitud/doc:", e); res.status(500).json({ error: "No se pudo guardar el archivo." }); }
  });

  app.delete("/api/solicitud/:token/documentos/:docId", async (req: any, res: any) => {
    const t = await porToken(req, res);
    if (!t) return;
    const d = (t.x.documentos || []).find((x: any) => x.id === String(req.params.docId) && x.por === "cliente");
    if (!d) return res.status(404).json({ error: "No encontramos ese archivo." });
    await bucket().file(d.ruta).delete({ ignoreNotFound: true });
    await t.ref.update({ documentos: (t.x.documentos || []).filter((x: any) => x.id !== d.id), actualizadoEl: new Date().toISOString() });
    res.json({ ok: true });
  });

  app.get("/api/solicitud/:token/formatos/:fid/pdf", async (req: any, res: any) => {
    const t = await porToken(req, res);
    if (!t) return;
    const fid = String(req.params.fid || "");
    if (!(t.x.bancos || []).some((b: any) => b.formatoId === fid)) return res.status(404).json({ error: "No encontramos ese formato." });
    const d = (await colFormatos(t.db).doc(fid).get()).data();
    if (!d) return res.status(404).json({ error: "No encontramos ese formato." });
    try {
      const [bytes] = await bucket().file(d.ruta).download();
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Cache-Control", "private, no-store");
      res.send(bytes);
    } catch (e) { console.error("solicitud/formato:", e); res.status(500).json({ error: "No se pudo abrir el formato." }); }
  });

  app.post("/api/solicitud/:token/enviar", async (req: any, res: any) => {
    const t = await porToken(req, res);
    if (!t) return;
    if (req.body?.acepta !== true) return res.status(400).json({ error: "Necesitamos tu autorización para compartir la solicitud con los bancos." });
    const ahora = new Date().toISOString();
    await t.ref.update({
      clienteTerminoEl: ahora,
      consentimiento: { fecha: ahora, bancos: (t.x.bancos || []).map((b: any) => b.nombre), ip: String(req.headers["x-forwarded-for"] || req.ip || "").split(",")[0].trim().slice(0, 60) },
      historial: [historial("El cliente terminó su solicitud y autorizó compartirla con los bancos.", "cliente"), ...(t.x.historial || [])].slice(0, 200),
      actualizadoEl: ahora,
    });
    res.json({ ok: true });
  });
}
