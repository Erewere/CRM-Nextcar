import crypto from "crypto";
import { datosParaAlta, evaluarPlacas, placaValida, respuestaLista, tipoTitulo, type EvaluacionPlacas } from "../lib/placasInfo.ts";

/**
 * Consulta de VIN o placas con PlacasInfo (REPUVE, Fiscalías, aseguradoras,
 * avisos ministeriales, procedencia ilícita y robo en EE. UU./Canadá).
 *
 * - La llave vive solo en el servidor (PLACASINFO_TOKEN en Hostinger).
 * - Luis tiene el visto bueno de PlacasInfo (23 oct 2026, por WhatsApp) para
 *   ofrecer el servicio a las agencias del CRM con una sola cuenta. Cada agencia
 *   compra paquetes de consultas (créditos); Nextcar usa la llave propia sin gastar
 *   créditos. Una consulta = un crédito de PlacasInfo ($1.5, $1.0 o $0.8 MXN según
 *   cuántos se compren de una vez).
 * - Cada consulta cuesta: el mismo auto no se vuelve a consultar en 24 h
 *   salvo que se pida a propósito, y nunca dos a la vez.
 * - La API contesta a un webhook; además el CRM pregunta por el resultado
 *   mientras la pantalla espera, por si el aviso no llega.
 * - consultasPlacas no tiene regla para el navegador: solo el servidor la lee.
 */

// Agencias que usan la cuenta propia de Luis y no gastan créditos (Nextcar). Se puede cambiar en plataforma/placasInfo.propias.
const AGENCIAS_PROPIAS = ["k77PpUc4SKDVCps2qSDw"];
const CONFIG_DEFECTO = {
  apagado: false,
  propias: AGENCIAS_PROPIAS,
  /** Consultas de regalo la primera vez que una agencia consulta, para que lo pruebe. */
  regaloInicial: 3,
  /** Precio de venta en MXN. Con $1.0 de costo (PlacasInfo, 100 o más créditos) y la comisión de Stripe, deja ~70 %. */
  paquetes: [{ consultas: 20, precio: 100 }, { consultas: 50, precio: 225 }, { consultas: 100, precio: 400 }],
};
const ROLES = new Set(["admin", "manager"]);
// La constancia se guarda entre los documentos del auto, y ahí solo entran
// administradores y gerentes: ahí viven las facturas y las identificaciones
// de los dueños. Consultar antecedentes sí lo puede hacer quien maneja el
// inventario; archivar la constancia, no (decisión de Luis, 20 oct 2026).
const ROLES_DOCUMENTOS = new Set(["admin", "manager", "master"]);
const API = "https://placas.info/api/v2/consultar/";
const SERVICIOS = ["repuve", "pgj", "aviso", "ocra", "carfax", "rapi"];
const HORAS_REPETIR = 24;
const idValido = (s: string) => /^[A-Za-z0-9_-]{1,64}$/.test(s);
const sha = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

/** Lo que ve la pantalla (sin la respuesta cruda ni secretos). */
function publica(id: string, x: any) {
  return {
    id,
    estado: x.estado,
    consultado: x.consultado,
    fecha: x.fecha,
    porNombre: x.porNombre || "",
    ...(x.evaluacion ? { evaluacion: x.evaluacion } : {}),
    ...(x.constancia ? { constancia: x.constancia } : {}),
    ...(x.error ? { error: x.error } : {}),
  };
}

export type ConfigPlacas = typeof CONFIG_DEFECTO;

/**
 * Acredita un paquete pagado (lo llama el aviso de Stripe). Una sola vez por pago: el movimiento lleva el id de la sesión
 * de Stripe, así que si el aviso llega repetido no suma dos veces.
 */
export async function acreditarCompraPlacas(db: any, sesion: any): Promise<{ ok: boolean; motivo?: string }> {
  const agencyId = String(sesion?.metadata?.agencyId || "");
  const consultas = Math.floor(Number(sesion?.metadata?.consultas) || 0);
  if (sesion?.payment_status !== "paid") return { ok: false, motivo: "no pagada" };
  if (!idValido(agencyId) || consultas < 1 || consultas > 1000) return { ok: false, motivo: "datos de la compra no válidos" };
  if (!(await db.collection("agencies").doc(agencyId).get()).exists) return { ok: false, motivo: "agencia inexistente" };
  const cuenta = db.collection("creditosPlacas").doc(agencyId);
  const mov = db.collection("movimientosPlacas").doc(`compra_${String(sesion.id).replace(/[^\w-]/g, "_")}`);
  await db.runTransaction(async (tx: any) => {
    const [m, c] = await Promise.all([tx.get(mov), tx.get(cuenta)]);
    if (m.exists) return;
    const x = c.data() || { saldo: 0, regalados: 0, comprados: 0, usados: 0 };
    const saldo = (Number(x.saldo) || 0) + consultas;
    tx.set(cuenta, { ...x, saldo, comprados: (Number(x.comprados) || 0) + consultas, actualizadoEn: new Date().toISOString() }, { merge: true });
    tx.set(mov, { agencyId, tipo: "compra", cantidad: consultas, saldoDespues: saldo, sesionStripe: String(sesion.id), monto: (Number(sesion.amount_total) || 0) / 100, fecha: new Date().toISOString() });
  });
  return { ok: true };
}

export function registrarPlacasInfo(app: any, { usuarioQuePide, getAdminDb, getStripe, express, bucket }: {
  usuarioQuePide: (req: any, res: any) => Promise<any>;
  getAdminDb: () => any;
  getStripe: () => any;
  express: any;
  /** El mismo depósito de los documentos del auto (server.ts). */
  bucket: () => any;
}) {
  const token = () => String(process.env.PLACASINFO_TOKEN || "").trim();
  const baseUrl = () => String(process.env.APP_URL || "https://crm.erewere.com").replace(/\/+$/, "");

  async function quien(req: any, res: any) {
    const q = await usuarioQuePide(req, res);
    if (!q) return null;
    if ((await config(q.adminDb)).apagado) { res.status(403).json({ error: "La consulta automática está apagada por ahora." }); return null; }
    const u = (await q.adminDb.collection("users").doc(q.uid).get()).data() || {};
    return { ...q, nombre: String(u.name || u.email || "Usuario"), puede: ROLES.has(q.rol) || u.canManageVehicles === true };
  }

  // ---------- Créditos ----------
  let cacheConfig: { hasta: number; valor: ConfigPlacas } | null = null;
  async function config(db: any): Promise<ConfigPlacas> {
    if (cacheConfig && cacheConfig.hasta > Date.now()) return cacheConfig.valor;
    const d = (await db.collection("plataforma").doc("placasInfo").get()).data() || {};
    const paquetes = Array.isArray(d.paquetes)
      ? d.paquetes.map((p: any) => ({ consultas: Math.floor(Number(p?.consultas)), precio: Number(p?.precio) })).filter((p: any) => p.consultas >= 1 && p.consultas <= 1000 && p.precio >= 10 && p.precio <= 50000)
      : [];
    const valor: ConfigPlacas = {
      apagado: d.apagado === true,
      propias: Array.isArray(d.propias) ? d.propias.map(String) : CONFIG_DEFECTO.propias,
      regaloInicial: Number.isFinite(Number(d.regaloInicial)) ? Math.max(0, Math.min(20, Math.floor(Number(d.regaloInicial)))) : CONFIG_DEFECTO.regaloInicial,
      paquetes: paquetes.length ? paquetes : CONFIG_DEFECTO.paquetes,
    };
    cacheConfig = { hasta: Date.now() + 30_000, valor };
    return valor;
  }
  const esPropia = (cfg: ConfigPlacas, agencyId: string) => cfg.propias.includes(agencyId);

  /** Descuenta un crédito (y crea la cuenta con el regalo inicial si es la primera vez). Si no queda, no descuenta. */
  async function cobrar(db: any, q: any, cfg: ConfigPlacas, consultaId: string): Promise<boolean> {
    const cuenta = db.collection("creditosPlacas").doc(q.agencyId);
    return db.runTransaction(async (tx: any) => {
      const c = await tx.get(cuenta);
      const nueva = !c.exists;
      const x = c.data() || { saldo: cfg.regaloInicial, regalados: cfg.regaloInicial, comprados: 0, usados: 0, creadaEn: new Date().toISOString() };
      if ((Number(x.saldo) || 0) < 1) return false;
      const saldo = Number(x.saldo) - 1;
      const ahora = new Date().toISOString();
      if (nueva && cfg.regaloInicial > 0) tx.set(db.collection("movimientosPlacas").doc(), { agencyId: q.agencyId, tipo: "regalo", cantidad: cfg.regaloInicial, saldoDespues: cfg.regaloInicial, nota: "Consultas de bienvenida", fecha: ahora });
      tx.set(cuenta, { ...x, saldo, usados: (Number(x.usados) || 0) + 1, actualizadoEn: ahora }, { merge: true });
      tx.set(db.collection("movimientosPlacas").doc(), { agencyId: q.agencyId, tipo: "consulta", cantidad: -1, saldoDespues: saldo, consultaId, por: q.uid, porNombre: q.nombre, fecha: ahora });
      return true;
    });
  }

  /** Devuelve el crédito de una consulta que no se pudo hacer. Una sola vez por consulta. */
  async function devolver(db: any, consultaRef: any) {
    try {
      await db.runTransaction(async (tx: any) => {
        const k = await tx.get(consultaRef);
        const x = k.data();
        if (!x || !x.credito || x.creditoDevuelto) return;
        const cuentaRef = db.collection("creditosPlacas").doc(x.agencyId);
        const c = (await tx.get(cuentaRef)).data() || {};
        const saldo = (Number(c.saldo) || 0) + 1;
        const ahora = new Date().toISOString();
        tx.update(consultaRef, { creditoDevuelto: true });
        tx.set(cuentaRef, { ...c, saldo, usados: Math.max(0, (Number(c.usados) || 1) - 1), actualizadoEn: ahora }, { merge: true });
        tx.set(db.collection("movimientosPlacas").doc(), { agencyId: x.agencyId, tipo: "devolucion", cantidad: 1, saldoDespues: saldo, consultaId: consultaRef.id, nota: "La consulta no se pudo completar", fecha: ahora });
      });
    } catch (e) {
      console.error("placasinfo/devolver:", e);
    }
  }

  /** Guarda el resultado y lo refleja en la ficha del auto (el aviso rojo ya existente). */
  async function guardarResultado(adminDb: any, ref: any, x: any, crudo: any) {
    const evaluacion: EvaluacionPlacas = evaluarPlacas(crudo);
    await ref.update({ estado: "lista", evaluacion, respuesta: JSON.stringify(crudo).slice(0, 200_000), listaEn: new Date().toISOString() });
    // El auto puede haberse ligado mientras se esperaba (alta desde el VIN).
    const vehicleId = (await ref.get()).data()?.vehicleId;
    if (vehicleId) await marcarAuto(adminDb, { ...x, vehicleId }, evaluacion);
    return evaluacion;
  }

  /** Lleva el resultado a la ficha del auto: placas vacías y la consulta REPUVE (aviso rojo). */
  async function marcarAuto(adminDb: any, x: any, evaluacion: EvaluacionPlacas) {
    await llenarDesdeRepuve(adminDb, x, evaluacion);
    if (evaluacion.veredicto === "incompleto") return; // no se sabe: no marcar el auto
    const resultado = evaluacion.veredicto === "vigente" ? "con_reporte" : "sin_reporte";
    const nota = evaluacion.veredicto === "antecedente" ? `PlacasInfo: con antecedentes. ${evaluacion.historial.join(" · ")}`.slice(0, 200)
      : evaluacion.veredicto === "vigente" ? `PlacasInfo: ${evaluacion.alertas.join(" · ")}`.slice(0, 200) : "PlacasInfo: sin reportes en ninguna fuente";
    const vRef = adminDb.collection("vehicles").doc(x.vehicleId);
    await adminDb.runTransaction(async (tx: any) => {
      const v = (await tx.get(vRef)).data();
      if (!v || v.agencyId !== x.agencyId) return;
      const c = { resultado, fecha: x.fecha, por: x.por, porNombre: x.porNombre, niv: x.consultado, nota, fuente: "placasinfo" };
      tx.update(vRef, { repuve: c, repuveHistorial: [c, ...(Array.isArray(v.repuveHistorial) ? v.repuveHistorial : [])].slice(0, 10) });
    });
  }

  /**
   * Placas y estado de emplacamiento desde la ficha del REPUVE, solo si en el
   * auto están vacíos (nunca pisa lo capturado) y si la ficha es de ese VIN.
   */
  async function llenarDesdeRepuve(adminDb: any, x: any, ev: EvaluacionPlacas) {
    const f = ev.ficha;
    if (!f) return;
    const vRef = adminDb.collection("vehicles").doc(x.vehicleId);
    const v = (await vRef.get()).data();
    if (!v || v.agencyId !== x.agencyId) return;
    const vin = String(v.vin || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (f.vin && vin && f.vin.toUpperCase() !== vin) return;
    const cambios: any = {};
    const placa = placaValida(f.placa);
    if (!String(v.licensePlate || "").trim() && placa) cambios.licensePlate = placa;
    const entidad = String(f.entidad || "").trim();
    if (!String(v.checklist?.platesState || "").trim() && entidad && !/sin|desconoc/i.test(entidad)) cambios["checklist.platesState"] = tipoTitulo(entidad);
    if (Object.keys(cambios).length) await vRef.update(cambios);
  }

  /** Manda la consulta a PlacasInfo (esto es lo que cuesta un crédito). */
  async function lanzar(q: any, consultado: string, vehicleId: string | null) {
    const ref = q.adminDb.collection("consultasPlacas").doc();
    const secreto = crypto.randomBytes(24).toString("base64url");
    // Las agencias que compran consultas pagan un crédito; Nextcar usa la llave propia sin créditos.
    const cfg = await config(q.adminDb);
    const conCredito = !esPropia(cfg, q.agencyId);
    if (conCredito && !(await cobrar(q.adminDb, q, cfg, ref.id))) {
      return { status: 402, cuerpo: { error: "No te quedan consultas. Compra un paquete en Facturación.", sinSaldo: true } };
    }
    const base = { agencyId: q.agencyId, vehicleId, consultado, fecha: new Date().toISOString(), por: q.uid, porNombre: q.nombre, secretoHash: sha(secreto), estado: "procesando", credito: conCredito };
    await ref.set(base);
    let r: Response;
    try {
      r = await fetch(API, {
        method: "POST",
        headers: { Authorization: `Token ${token()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ placa_niv: consultado, callback: `${baseUrl()}/api/placasinfo/aviso/${ref.id}?s=${secreto}`, services: SERVICIOS }),
        signal: AbortSignal.timeout(20000),
      });
    } catch (e) {
      // Sin respuesta de PlacasInfo: no se cobra.
      await ref.update({ estado: "error", error: "PlacasInfo no contestó. Intenta de nuevo." });
      await devolver(q.adminDb, ref);
      return { status: 504, cuerpo: { error: "PlacasInfo no contestó. No se te cobró la consulta; intenta de nuevo." } };
    }
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d?.id) {
      const error = r.status === 401 || r.status === 403 ? "PlacasInfo rechazó la llave. Revisa PLACASINFO_TOKEN."
        : r.status === 402 || /cr[eé]dit/i.test(JSON.stringify(d)) ? "Ya no hay créditos en la cuenta de PlacasInfo."
          : `PlacasInfo no aceptó la consulta (${r.status}).`;
      console.error("placasinfo/consultar:", r.status, JSON.stringify(d).slice(0, 300));
      await ref.update({ estado: "error", error });
      await devolver(q.adminDb, ref);
      return { status: 502, cuerpo: { error } };
    }
    const extra = { externoId: String(d.id), ...(Number.isFinite(Number(d.credits)) ? { creditos: Number(d.credits) } : {}) };
    await ref.update(extra);
    return { status: 200, cuerpo: { consulta: publica(ref.id, { ...base, ...extra }) } };
  }

  /** Si sigue procesando, pregunta a PlacasInfo (sin costo: es la misma consulta). */
  async function revisar(adminDb: any, doc: any) {
    const x = doc.data();
    if (x.estado !== "procesando" || !x.externoId) return x;
    const edad = Date.now() - Date.parse(x.fecha);
    if (edad > 10 * 60 * 1000) { await doc.ref.update({ estado: "error", error: "PlacasInfo no contestó a tiempo. Intenta de nuevo." }); await devolver(adminDb, doc.ref); return { ...x, estado: "error", error: "PlacasInfo no contestó a tiempo. Intenta de nuevo." }; }
    try {
      const r = await fetch(API + encodeURIComponent(x.externoId), { headers: { Authorization: `Token ${token()}` }, signal: AbortSignal.timeout(15000) });
      if (!r.ok) return x;
      const crudo = await r.json().catch(() => null);
      if (!respuestaLista(crudo)) return x;
      const evaluacion = await guardarResultado(adminDb, doc.ref, x, crudo);
      return { ...x, estado: "lista", evaluacion };
    } catch { return x; }
  }

  // Diagnóstico sin sesión: solo dice si el servidor tiene llave, nunca la muestra.
  app.get("/api/placasinfo/estado", (_req: any, res: any) => {
    res.json({ llave: !!token() });
  });

  // ¿Está disponible para mi agencia? (para mostrar o no el botón)
  app.get("/api/placasinfo/disponible", async (req: any, res: any) => {
    const q = await usuarioQuePide(req, res);
    if (!q) return;
    const cfg = await config(q.adminDb);
    const propia = esPropia(cfg, q.agencyId);
    const cuenta = propia ? null : (await q.adminDb.collection("creditosPlacas").doc(q.agencyId).get()).data();
    res.json({ activo: !cfg.apagado && !!token(), configurado: !!token(), propia, saldo: propia ? null : cuenta ? Number(cuenta.saldo) || 0 : cfg.regaloInicial });
  });

  // Consultas de un auto (la más reciente primero)
  app.get("/api/autos/:id/placasinfo", async (req: any, res: any) => {
    const q = await quien(req, res);
    if (!q) return;
    const id = String(req.params.id || "");
    if (!idValido(id)) return res.status(400).json({ error: "Auto no válido." });
    try {
      const s = await q.adminDb.collection("consultasPlacas").where("vehicleId", "==", id).get();
      const docs = s.docs.filter((d: any) => d.data().agencyId === q.agencyId)
        .sort((a: any, b: any) => String(b.data().fecha).localeCompare(String(a.data().fecha))).slice(0, 10);
      const lista = [];
      for (const d of docs) {
        let x = d.data();
        if (x.estado === "procesando") x = await revisar(q.adminDb, d);
        else if (x.estado === "lista" && x.respuesta && (x.evaluacion?.veredicto === "incompleto" || !x.evaluacion?.fuentes)) {
          // Leídas con una regla anterior: se vuelven a leer sin gastar otra
          // consulta. Así una consulta vieja también puede dar su constancia,
          // que necesita el resultado de cada fuente por separado.
          const crudo = JSON.parse(x.respuesta);
          const nueva = evaluarPlacas(crudo);
          if (nueva.veredicto !== "incompleto" || x.evaluacion?.veredicto === "incompleto") {
            await guardarResultado(q.adminDb, d.ref, x, crudo);
            x = (await d.ref.get()).data();
          }
        }
        lista.push(publica(d.id, x));
      }
      res.json({ consultas: lista });
    } catch (e) {
      console.error("placasinfo/lista:", e);
      res.status(500).json({ error: "No se pudieron leer las consultas." });
    }
  });

  // Nueva consulta (cuesta un crédito)
  app.post("/api/autos/:id/placasinfo", async (req: any, res: any) => {
    const q = await quien(req, res);
    if (!q) return;
    if (!q.puede) return res.status(403).json({ error: "Solo un administrador o quien maneja el inventario puede consultar." });
    if (!token()) return res.status(503).json({ error: "Falta poner la llave de PlacasInfo en el servidor." });
    const id = String(req.params.id || "");
    if (!idValido(id)) return res.status(400).json({ error: "Auto no válido." });
    try {
      const v = (await q.adminDb.collection("vehicles").doc(id).get()).data();
      if (!v || v.agencyId !== q.agencyId) return res.status(404).json({ error: "No encontramos ese auto." });
      const vin = String(v.vin || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      const placa = String(v.licensePlate || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      const consultado = vin.length === 17 ? vin : placa.length >= 5 ? placa : "";
      if (!consultado) return res.status(400).json({ error: "El auto necesita un NIV completo (17 caracteres) o placas para consultarlo." });

      // Sin gastar de más: una en curso, o una completa de las últimas 24 h.
      const previas = await q.adminDb.collection("consultasPlacas").where("vehicleId", "==", id).get();
      const ahora = Date.now();
      for (const d of previas.docs) {
        const x = d.data();
        if (x.agencyId !== q.agencyId || x.consultado !== consultado) continue;
        const edad = ahora - Date.parse(x.fecha);
        if (x.estado === "procesando" && edad < 10 * 60 * 1000) return res.json({ consulta: publica(d.id, x), repetida: true });
        if (!req.body?.forzar && x.estado === "lista" && x.evaluacion?.veredicto !== "incompleto" && edad < HORAS_REPETIR * 3600 * 1000) {
          return res.json({ consulta: publica(d.id, x), repetida: true });
        }
      }

      const r = await lanzar(q, consultado, id);
      res.status(r.status).json(r.cuerpo);
    } catch (e) {
      console.error("placasinfo/consultar:", e);
      res.status(500).json({ error: "No se pudo hacer la consulta. Intenta de nuevo." });
    }
  });

  /**
   * Guarda la constancia de esta consulta en los documentos del auto.
   *
   * La hoja la manda el navegador que acaba de hacer la consulta, y solo se
   * acepta para su propio auto. Guardarla pide el mismo rol que ver los
   * documentos: administrador o gerente. Si quien consultó solo maneja el
   * inventario, el resultado se ve igual y puede bajar la hoja, pero no queda
   * archivada hasta que entre alguien con ese permiso.
   *
   * La primera que llega es la que queda: si dos pantallas tienen el auto
   * abierto, la segunda recibe la que ya estaba y no deja un duplicado.
   */
  app.post("/api/autos/:id/placasinfo/:cid/constancia", express.raw({ type: "application/pdf", limit: 2 * 1024 * 1024 }), async (req: any, res: any) => {
    const q = await quien(req, res);
    if (!q) return;
    if (!ROLES_DOCUMENTOS.has(q.rol)) return res.status(403).json({ error: "Solo administradores y gerentes guardan la constancia en el auto." });
    const id = String(req.params.id || "");
    const cid = String(req.params.cid || "");
    if (!idValido(id) || !idValido(cid)) return res.status(400).json({ error: "Datos no válidos." });
    const cuerpo = req.body as Buffer;
    if (!Buffer.isBuffer(cuerpo) || !cuerpo.length) return res.status(400).json({ error: "La constancia llegó vacía." });
    if (cuerpo.subarray(0, 5).toString("latin1") !== "%PDF-") return res.status(400).json({ error: "Eso no es un PDF." });
    let nombre = "Constancia de verificacion.pdf";
    try { nombre = decodeURIComponent(String(req.headers["x-nombre"] || nombre)); } catch { /* se queda el de siempre */ }
    nombre = nombre.replace(/[\u0000-\u001f\\/]+/g, " ").trim().slice(0, 120) || "Constancia de verificacion.pdf";
    try {
      const ref = q.adminDb.collection("consultasPlacas").doc(cid);
      const x = (await ref.get()).data();
      if (!x || x.agencyId !== q.agencyId || x.vehicleId !== id) return res.status(404).json({ error: "No encontramos esa consulta." });
      if (x.constancia) return res.json({ constancia: x.constancia, repetida: true });
      const v = (await q.adminDb.collection("vehicles").doc(id).get()).data();
      if (!v || v.agencyId !== q.agencyId) return res.status(404).json({ error: "No encontramos ese auto." });

      const docRef = q.adminDb.collection("documentosAutos").doc();
      const ruta = `documentosAutos/${q.agencyId}/${id}/${docRef.id}`;
      await bucket().file(ruta).save(cuerpo, { contentType: "application/pdf", resumable: false });
      await docRef.set({
        vehicleId: id, agencyId: q.agencyId, nombre, categoria: "Verificación", tipo: "application/pdf",
        tamano: cuerpo.length, ruta, subidoPor: q.uid, subidoPorNombre: q.nombre,
        creadoEl: new Date().toISOString(), consultaPlacas: cid,
      });
      const constancia = { docId: docRef.id, nombre, fecha: new Date().toISOString() };
      await ref.update({ constancia });
      res.json({ constancia });
    } catch (e) {
      console.error("placasinfo/constancia:", e);
      res.status(500).json({ error: "No se pudo guardar la constancia." });
    }
  });

  // ---------- Alta de un auto desde el VIN (el auto aún no existe) ----------
  app.post("/api/placasinfo/vin", async (req: any, res: any) => {
    const q = await quien(req, res);
    if (!q) return;
    if (!q.puede) return res.status(403).json({ error: "Solo un administrador o quien maneja el inventario puede consultar." });
    if (!token()) return res.status(503).json({ error: "Falta poner la llave de PlacasInfo en el servidor." });
    const vin = String(req.body?.vin || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (vin.length !== 17) return res.status(400).json({ error: "El VIN debe tener 17 caracteres." });
    try {
      // El mismo VIN en esta agencia: una en curso o una completa de 24 h se reusa sin cobrar.
      const previas = await q.adminDb.collection("consultasPlacas").where("consultado", "==", vin).get();
      const ahora = Date.now();
      const reusable = previas.docs.map((d: any) => ({ d, x: d.data() }))
        .filter(({ x }: any) => x.agencyId === q.agencyId)
        .sort((a: any, b: any) => String(b.x.fecha).localeCompare(String(a.x.fecha)))
        .find(({ x }: any) => {
          const edad = ahora - Date.parse(x.fecha);
          return (x.estado === "procesando" && edad < 10 * 60 * 1000)
            || (!req.body?.forzar && x.estado === "lista" && x.evaluacion?.veredicto !== "incompleto" && edad < HORAS_REPETIR * 3600 * 1000);
        });
      if (reusable) return res.json({ consulta: publica(reusable.d.id, reusable.x), alta: datosParaAlta(reusable.x.evaluacion?.ficha), repetida: true });
      const r = await lanzar(q, vin, null);
      res.status(r.status).json(r.cuerpo);
    } catch (e) {
      console.error("placasinfo/vin:", e);
      res.status(500).json({ error: "No se pudo hacer la consulta. Intenta de nuevo." });
    }
  });

  app.get("/api/placasinfo/consulta/:cid", async (req: any, res: any) => {
    const q = await quien(req, res);
    if (!q) return;
    const cid = String(req.params.cid || "");
    if (!idValido(cid)) return res.status(400).json({ error: "Consulta no válida." });
    try {
      const d = await q.adminDb.collection("consultasPlacas").doc(cid).get();
      if (!d.exists || d.data().agencyId !== q.agencyId) return res.status(404).json({ error: "No encontramos esa consulta." });
      const x = d.data().estado === "procesando" ? await revisar(q.adminDb, d) : d.data();
      res.json({ consulta: publica(cid, x), alta: datosParaAlta(x.evaluacion?.ficha) });
    } catch (e) {
      console.error("placasinfo/consulta:", e);
      res.status(500).json({ error: "No se pudo leer la consulta." });
    }
  });

  // Al guardar el auto nuevo: la consulta queda en su ficha (y su aviso, si lo hay).
  app.post("/api/placasinfo/consulta/:cid/ligar", async (req: any, res: any) => {
    const q = await quien(req, res);
    if (!q) return;
    const cid = String(req.params.cid || "");
    const vehicleId = String(req.body?.vehicleId || "");
    if (!idValido(cid) || !idValido(vehicleId)) return res.status(400).json({ error: "Datos no válidos." });
    try {
      const ref = q.adminDb.collection("consultasPlacas").doc(cid);
      const x = (await ref.get()).data();
      if (!x || x.agencyId !== q.agencyId) return res.status(404).json({ error: "No encontramos esa consulta." });
      const v = (await q.adminDb.collection("vehicles").doc(vehicleId).get()).data();
      if (!v || v.agencyId !== q.agencyId) return res.status(404).json({ error: "No encontramos ese auto." });
      if (String(v.vin || "").toUpperCase().replace(/[^A-Z0-9]/g, "") !== x.consultado) return res.status(409).json({ error: "El VIN del auto no es el de la consulta." });
      if (x.vehicleId && x.vehicleId !== vehicleId) return res.status(409).json({ error: "Esa consulta ya es de otro auto." });
      if (!x.vehicleId) await ref.update({ vehicleId });
      if (x.estado === "lista" && x.evaluacion) await marcarAuto(q.adminDb, { ...x, vehicleId }, x.evaluacion);
      res.json({ ok: true });
    } catch (e) {
      console.error("placasinfo/ligar:", e);
      res.status(500).json({ error: "No se pudo ligar la consulta." });
    }
  });

  // ---------- Saldo y compra de paquetes (administrador de la agencia) ----------
  app.get("/api/placasinfo/saldo", async (req: any, res: any) => {
    const q = await usuarioQuePide(req, res);
    if (!q) return;
    if (q.rol !== "admin") return res.status(403).json({ error: "Solo el administrador ve el saldo de consultas." });
    try {
      const cfg = await config(q.adminDb);
      const propia = esPropia(cfg, q.agencyId);
      const cuenta = (await q.adminDb.collection("creditosPlacas").doc(q.agencyId).get()).data();
      const mov = await q.adminDb.collection("movimientosPlacas").where("agencyId", "==", q.agencyId).get();
      const movimientos = mov.docs.map((d: any) => d.data()).sort((a: any, b: any) => String(b.fecha).localeCompare(String(a.fecha))).slice(0, 15)
        .map((m: any) => ({ tipo: m.tipo, cantidad: m.cantidad, fecha: m.fecha, nota: m.nota || "", porNombre: m.porNombre || "", monto: m.monto ?? null }));
      res.json({
        activo: !cfg.apagado && !!token(), propia,
        saldo: propia ? null : cuenta ? Number(cuenta.saldo) || 0 : cfg.regaloInicial,
        regaloPendiente: !propia && !cuenta && cfg.regaloInicial > 0,
        usadas: Number(cuenta?.usados) || 0,
        paquetes: cfg.paquetes, movimientos,
      });
    } catch (e) {
      console.error("placasinfo/saldo:", e);
      res.status(500).json({ error: "No se pudo leer el saldo." });
    }
  });

  app.post("/api/placasinfo/comprar", async (req: any, res: any) => {
    const q = await usuarioQuePide(req, res);
    if (!q) return;
    if (q.rol !== "admin") return res.status(403).json({ error: "Solo el administrador de la agencia compra consultas." });
    try {
      const cfg = await config(q.adminDb);
      if (cfg.apagado || esPropia(cfg, q.agencyId)) return res.status(409).json({ error: "Tu agencia no necesita comprar consultas." });
      const paquete = cfg.paquetes[Math.floor(Number(req.body?.indice))];
      if (!paquete) return res.status(400).json({ error: "Elige un paquete." });
      const origen = String(req.headers.origin || process.env.APP_URL || "https://crm.erewere.com").replace(/\/+$/, "");
      const a = (await q.adminDb.collection("agencies").doc(q.agencyId).get()).data() || {};
      const sesion = await getStripe().checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        allow_promotion_codes: true,
        ...(a.stripeCustomerId ? { customer: a.stripeCustomerId } : {}),
        line_items: [{
          quantity: 1,
          price_data: { currency: "mxn", unit_amount: Math.round(paquete.precio * 100), product_data: { name: `${paquete.consultas} consultas de antecedentes del auto`, description: "Consulta de VIN o placas: REPUVE, fiscalías, avisos y más. Cada consulta descuenta una." } },
        }],
        // Sin client_reference_id: ese campo activa la suscripción en el aviso de Stripe, y esto no es una suscripción.
        metadata: { tipo: "placasinfo", agencyId: q.agencyId, consultas: String(paquete.consultas) },
        success_url: `${origen}/billing?consultas=ok`,
        cancel_url: `${origen}/billing?consultas=cancelado`,
      });
      res.json({ url: sesion.url });
    } catch (e: any) {
      console.error("placasinfo/comprar:", e);
      res.status(500).json({ error: "No se pudo abrir el pago. Intenta de nuevo." });
    }
  });

  // ---------- Panel del master: cuánto consume cada agencia, y regalar consultas ----------
  async function soloMasterAqui(req: any, res: any) {
    const q = await usuarioQuePide(req, res);
    if (!q) return null;
    const u = (await q.adminDb.collection("users").doc(q.uid).get()).data();
    if (u?.role !== "master") { res.status(403).json({ error: "Solo el master." }); return null; }
    return q;
  }

  app.get("/api/admin/placasinfo", async (req: any, res: any) => {
    const q = await soloMasterAqui(req, res);
    if (!q) return;
    try {
      const cfg = await config(q.adminDb);
      const [cuentas, agencias, consultas] = await Promise.all([
        q.adminDb.collection("creditosPlacas").get(),
        q.adminDb.collection("agencies").get(),
        q.adminDb.collection("consultasPlacas").get(),
      ]);
      const nombres = new Map<string, string>(agencias.docs.map((d: any) => [d.id, String(d.data().name || d.id)]));
      const hechas = new Map<string, number>();
      consultas.docs.forEach((d: any) => hechas.set(d.data().agencyId, (hechas.get(d.data().agencyId) || 0) + 1));
      res.json({
        config: cfg,
        agencias: cuentas.docs.map((d: any) => ({ agencyId: d.id, nombre: nombres.get(d.id) || d.id, saldo: Number(d.data().saldo) || 0, comprados: Number(d.data().comprados) || 0, regalados: Number(d.data().regalados) || 0, usados: Number(d.data().usados) || 0 }))
          .sort((a: any, b: any) => b.usados - a.usados),
        consultasTotales: consultas.size,
        // Lo que le queda a Luis en PlacasInfo (lo dice la última consulta). Solo lo ve el master: es SU saldo, no el de las agencias.
        creditosPlacasInfo: (consultas.docs.map((d: any) => d.data()).filter((x: any) => typeof x.creditos === "number").sort((a: any, b: any) => String(b.fecha).localeCompare(String(a.fecha)))[0]?.creditos) ?? null,
        consultasPorAgencia: Object.fromEntries([...hechas].map(([id, n]) => [nombres.get(id) || id, n])),
      });
    } catch (e) {
      console.error("admin/placasinfo:", e);
      res.status(500).json({ error: "No se pudo leer el consumo." });
    }
  });

  app.post("/api/admin/placasinfo/regalar", async (req: any, res: any) => {
    const q = await soloMasterAqui(req, res);
    if (!q) return;
    const agencyId = String(req.body?.agencyId || "");
    const cantidad = Math.floor(Number(req.body?.cantidad));
    if (!idValido(agencyId) || !(cantidad >= 1 && cantidad <= 200)) return res.status(400).json({ error: "Agencia y cantidad (1 a 200)." });
    try {
      if (!(await q.adminDb.collection("agencies").doc(agencyId).get()).exists) return res.status(404).json({ error: "Esa agencia no existe." });
      const cuenta = q.adminDb.collection("creditosPlacas").doc(agencyId);
      const saldo = await q.adminDb.runTransaction(async (tx: any) => {
        const x = (await tx.get(cuenta)).data() || { saldo: 0, regalados: 0, comprados: 0, usados: 0, creadaEn: new Date().toISOString() };
        const nuevo = (Number(x.saldo) || 0) + cantidad;
        tx.set(cuenta, { ...x, saldo: nuevo, regalados: (Number(x.regalados) || 0) + cantidad, actualizadoEn: new Date().toISOString() }, { merge: true });
        tx.set(q.adminDb.collection("movimientosPlacas").doc(), { agencyId, tipo: "regalo", cantidad, saldoDespues: nuevo, nota: String(req.body?.nota || "Regalo").slice(0, 120), fecha: new Date().toISOString(), por: q.uid });
        return nuevo;
      });
      res.json({ ok: true, saldo });
    } catch (e) {
      console.error("admin/placasinfo/regalar:", e);
      res.status(500).json({ error: "No se pudo regalar." });
    }
  });

  // Webhook de PlacasInfo: solo vale con el secreto de esa consulta.
  app.post("/api/placasinfo/aviso/:cid", async (req: any, res: any) => {
    const cid = String(req.params.cid || "");
    const s = String(req.query?.s || "");
    if (!idValido(cid) || !s) return res.status(404).end();
    try {
      const adminDb = getAdminDb();
      if (!adminDb) return res.status(503).end();
      const ref = adminDb.collection("consultasPlacas").doc(cid);
      const x = (await ref.get()).data();
      if (!x || x.secretoHash !== sha(s)) return res.status(404).end();
      if (x.estado === "procesando" && respuestaLista(req.body)) await guardarResultado(adminDb, ref, x, req.body);
      res.json({ ok: true });
    } catch (e) {
      console.error("placasinfo/aviso:", e);
      res.status(500).end();
    }
  });
}
