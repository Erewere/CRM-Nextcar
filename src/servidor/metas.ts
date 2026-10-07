import { checkIsWon } from "../lib/clientUtils.ts";
import { mesDeMetas, type MetaMes } from "../lib/metas.ts";

/**
 * Metas de ventas por mes: del equipo y de cada asesor, y su avance.
 *
 * - Las metas viven en metasVentas/{agencia}_{AAAA-MM} (sin regla para el
 *   navegador: solo el servidor las lee y escribe). Las fija un administrador
 *   o gerente.
 * - El avance se calcula aquí, con los tratos ganados del mes, para que un
 *   asesor vea el avance del EQUIPO sin poder leer los tratos de los demás.
 *   Una venta = trato ganado con fecha de venta dentro del mes (hora de
 *   México), igual que el tablero de la agencia.
 * - Un asesor solo recibe su propia meta y la del equipo; el administrador
 *   y el gerente reciben la de todos.
 */

const ROLES_FIJAN = new Set(["admin", "manager"]);
const ROLES_EQUIPO = new Set(["seller", "admin", "manager"]);
const MX = 6 * 3_600_000; // México, UTC-6
const num = (v: any, max = 1e10) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? Math.min(max, Math.round(n * 100) / 100) : 0; };
const idValido = (s: string) => /^[A-Za-z0-9_-]{1,64}$/.test(s);

/** «AAAA-MM» de una fecha que puede ser texto, Timestamp o milisegundos (hora de México). */
function mesDe(x: any): string | null {
  if (!x) return null;
  if (typeof x === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(x)) return x.slice(0, 7); // fecha local ya escrita en México
    const t = Date.parse(x);
    return Number.isNaN(t) ? null : new Date(t - MX).toISOString().slice(0, 7);
  }
  const ms = typeof x === "number" ? x : typeof x.toMillis === "function" ? x.toMillis() : typeof x._seconds === "number" ? x._seconds * 1000 : typeof x.seconds === "number" ? x.seconds * 1000 : null;
  return ms === null ? null : new Date(ms - MX).toISOString().slice(0, 7);
}

export function registrarMetas(app: any, { usuarioQuePide, getAdminDb }: { usuarioQuePide: (req: any, res: any) => Promise<any>; getAdminDb: () => any }) {
  const col = (db: any) => db.collection("metasVentas");
  const cache = new Map<string, { hasta: number; porMes: Map<string, { ventas: Record<string, number>; monto: Record<string, number> }> }>();

  /** Ventas y monto por asesor, de todos los meses (se guarda 60 s para no leer los tratos en cada pantalla). */
  async function ventasPorMes(db: any, agencyId: string) {
    const c = cache.get(agencyId);
    if (c && c.hasta > Date.now()) return c.porMes;
    const ag = (await db.collection("agencies").doc(agencyId).get()).data() || {};
    const etapas = Array.isArray(ag.pipelineStages) && ag.pipelineStages.length ? ag.pipelineStages : [];
    const snap = await db.collection("deals").where("agencyId", "==", agencyId).get();
    const porMes = new Map<string, { ventas: Record<string, number>; monto: Record<string, number> }>();
    for (const d of snap.docs) {
      const t = d.data();
      if (t.isDeleted || !checkIsWon(t.status, etapas)) continue;
      const mes = mesDe(t.soldAt) || mesDe(t.updatedAt);
      if (!mes) continue;
      const quien = String(t.sellerId || "sin-asesor");
      const m = porMes.get(mes) || { ventas: {}, monto: {} };
      m.ventas[quien] = (m.ventas[quien] || 0) + 1;
      m.monto[quien] = (m.monto[quien] || 0) + (Number(t.saleDetails?.price) || Number(t.value) || 0);
      porMes.set(mes, m);
    }
    cache.set(agencyId, { hasta: Date.now() + 60_000, porMes });
    return porMes;
  }

  const anterior = (mes: string) => { const [a, m] = mes.split("-").map(Number); const d = new Date(Date.UTC(a, m - 2, 1)); return d.toISOString().slice(0, 7); };

  app.get("/api/metas", async (req: any, res: any) => {
    const q = await usuarioQuePide(req, res);
    if (!q) return;
    const mes = mesDeMetas(String(req.query?.mes || ""));
    try {
      const db = q.adminDb;
      const doc = (await col(db).doc(`${q.agencyId}_${mes}`).get()).data() || null;
      const previa = doc ? null : (await col(db).doc(`${q.agencyId}_${anterior(mes)}`).get()).data() || null;
      const asesores = (await db.collection("users").where("agencyId", "==", q.agencyId).get()).docs
        .map((d: any) => ({ id: d.id, nombre: String(d.data().name || d.data().email || "Asesor"), rol: String(d.data().role || "") }))
        .filter((u: any) => ROLES_EQUIPO.has(u.rol));
      const ventas = (await ventasPorMes(db, q.agencyId)).get(mes) || { ventas: {}, monto: {} };
      const veTodos = ROLES_FIJAN.has(q.rol);
      const todos = (o: Record<string, number>) => Object.values(o).reduce((s, n) => s + n, 0);
      const metaDe = (d: any, uid: string) => d?.vendedores?.[uid] || { autos: 0, ingresos: 0 };
      const respuesta: MetaMes = {
        mes,
        puedeFijar: veTodos,
        equipo: { meta: doc?.equipo || { autos: 0, ingresos: 0 }, ventas: todos(ventas.ventas), monto: todos(ventas.monto) },
        // El asesor ve solo lo suyo; el administrador, a todos.
        asesores: asesores.filter((u: any) => veTodos || u.id === q.uid).map((u: any) => ({
          id: u.id, nombre: u.nombre, meta: metaDe(doc, u.id), ventas: ventas.ventas[u.id] || 0, monto: ventas.monto[u.id] || 0,
        })),
        sugerida: veTodos && previa ? { equipo: previa.equipo || { autos: 0, ingresos: 0 }, vendedores: previa.vendedores || {} } : null,
        definida: !!doc,
      };
      res.json(respuesta);
    } catch (e) {
      console.error("metas/leer:", e);
      res.status(500).json({ error: "No se pudieron leer las metas." });
    }
  });

  app.put("/api/metas", async (req: any, res: any) => {
    const q = await usuarioQuePide(req, res);
    if (!q) return;
    if (!ROLES_FIJAN.has(q.rol)) return res.status(403).json({ error: "Solo un administrador o gerente fija las metas." });
    const b = req.body || {};
    const mes = mesDeMetas(String(b.mes || ""));
    try {
      const db = q.adminDb;
      const validos = new Set((await db.collection("users").where("agencyId", "==", q.agencyId).get()).docs.map((d: any) => d.id));
      const vendedores: Record<string, { autos: number; ingresos: number }> = {};
      for (const [uid, m] of Object.entries(b.vendedores || {}) as [string, any][]) {
        if (!idValido(uid) || !validos.has(uid)) continue;
        vendedores[uid] = { autos: Math.round(num(m?.autos, 1000)), ingresos: num(m?.ingresos) };
      }
      const nombre = String((await db.collection("users").doc(q.uid).get()).data()?.name || "");
      await col(db).doc(`${q.agencyId}_${mes}`).set({
        agencyId: q.agencyId, mes,
        equipo: { autos: Math.round(num(b.equipo?.autos, 5000)), ingresos: num(b.equipo?.ingresos) },
        vendedores,
        actualizadoEl: new Date().toISOString(), actualizadoPor: q.uid, actualizadoPorNombre: nombre,
      });
      res.json({ ok: true });
    } catch (e) {
      console.error("metas/guardar:", e);
      res.status(500).json({ error: "No se pudieron guardar las metas." });
    }
  });
}
