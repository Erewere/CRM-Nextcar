import crypto from "crypto";
import { datosParaAlta, evaluarPlacas, placaValida, respuestaLista, tipoTitulo, type EvaluacionPlacas } from "../lib/placasInfo.ts";

/**
 * Consulta de VIN o placas con PlacasInfo (REPUVE, Fiscalías, aseguradoras,
 * avisos ministeriales, procedencia ilícita y robo en EE. UU./Canadá).
 *
 * - La llave vive solo en el servidor (PLACASINFO_TOKEN en Hostinger).
 * - Por ahora solo para Nextcar: sus términos no permiten dar el servicio a
 *   terceros con una sola cuenta sin su permiso escrito.
 * - Cada consulta cuesta: el mismo auto no se vuelve a consultar en 24 h
 *   salvo que se pida a propósito, y nunca dos a la vez.
 * - La API contesta a un webhook; además el CRM pregunta por el resultado
 *   mientras la pantalla espera, por si el aviso no llega.
 * - consultasPlacas no tiene regla para el navegador: solo el servidor la lee.
 */

const AGENCIAS_ACTIVAS = new Set(["k77PpUc4SKDVCps2qSDw"]); // Nextcar
const ROLES = new Set(["admin", "manager"]);
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
    ...(x.error ? { error: x.error } : {}),
    ...(typeof x.creditos === "number" ? { creditos: x.creditos } : {}),
  };
}

export function registrarPlacasInfo(app: any, { usuarioQuePide, getAdminDb }: { usuarioQuePide: (req: any, res: any) => Promise<any>; getAdminDb: () => any }) {
  const token = () => String(process.env.PLACASINFO_TOKEN || "").trim();
  const baseUrl = () => String(process.env.APP_URL || "https://crm.erewere.com").replace(/\/+$/, "");

  async function quien(req: any, res: any) {
    const q = await usuarioQuePide(req, res);
    if (!q) return null;
    if (!AGENCIAS_ACTIVAS.has(q.agencyId)) { res.status(403).json({ error: "La consulta automática aún no está activa para tu agencia." }); return null; }
    const u = (await q.adminDb.collection("users").doc(q.uid).get()).data() || {};
    return { ...q, nombre: String(u.name || u.email || "Usuario"), puede: ROLES.has(q.rol) || u.canManageVehicles === true };
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
    const base = { agencyId: q.agencyId, vehicleId, consultado, fecha: new Date().toISOString(), por: q.uid, porNombre: q.nombre, secretoHash: sha(secreto), estado: "procesando" };
    await ref.set(base);
    const r = await fetch(API, {
      method: "POST",
      headers: { Authorization: `Token ${token()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ placa_niv: consultado, callback: `${baseUrl()}/api/placasinfo/aviso/${ref.id}?s=${secreto}`, services: SERVICIOS }),
      signal: AbortSignal.timeout(20000),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d?.id) {
      const error = r.status === 401 || r.status === 403 ? "PlacasInfo rechazó la llave. Revisa PLACASINFO_TOKEN."
        : r.status === 402 || /cr[eé]dit/i.test(JSON.stringify(d)) ? "Ya no hay créditos en la cuenta de PlacasInfo."
          : `PlacasInfo no aceptó la consulta (${r.status}).`;
      console.error("placasinfo/consultar:", r.status, JSON.stringify(d).slice(0, 300));
      await ref.update({ estado: "error", error });
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
    if (edad > 10 * 60 * 1000) { await doc.ref.update({ estado: "error", error: "PlacasInfo no contestó a tiempo. Intenta de nuevo." }); return { ...x, estado: "error", error: "PlacasInfo no contestó a tiempo. Intenta de nuevo." }; }
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
    res.json({ activo: AGENCIAS_ACTIVAS.has(q.agencyId) && !!token(), configurado: !!token() });
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
        else if (x.estado === "lista" && x.respuesta && x.evaluacion?.veredicto === "incompleto") {
          // Leídas con una regla anterior: se vuelven a leer sin gastar otra consulta.
          const crudo = JSON.parse(x.respuesta);
          if (evaluarPlacas(crudo).veredicto !== "incompleto") { await guardarResultado(q.adminDb, d.ref, x, crudo); x = (await d.ref.get()).data(); }
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
