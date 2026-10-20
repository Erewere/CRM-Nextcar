import { checkIsWon } from "../lib/clientUtils.ts";
import { soloFecha, sumarDias, tareasDePostventa } from "../lib/postventa.ts";

/**
 * Siembra las tareas de postventa de las ventas recientes (ver src/lib/postventa.ts).
 *
 * Es OPCIONAL: cada agencia la enciende en «Agencia y usuarios» (`postventa.activa = true`, y ese día queda en
 * `postventa.desde`). Solo cuenta las ventas desde ese día (con 3 días de margen por si una venta se captura
 * con la fecha de hace poco): nunca se le ponen de golpe tareas a un vendedor por ventas viejas.
 * Mira solo los tratos con fecha de venta de los últimos 14 días: es una consulta barata y sirve para
 * cualquier camino por el que se cierre una venta (embudo, ficha, auto, celular).
 * Cada trato se marca con `postventaSembrada` para que, si el vendedor borra o completa una tarea, no
 * vuelva a aparecer.
 */

const VENTANA_DIAS = 14;

export const hoyEnMexico = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });

export async function sembrarPostventa(db: any, opciones: { simular?: boolean } = {}) {
  const hoy = hoyEnMexico();
  const desde = sumarDias(hoy, -VENTANA_DIAS);

  const agencias = new Map<string, { desde: string; etapas: any[] }>();
  (await db.collection("agencies").get()).docs.forEach((d: any) => {
    const a = d.data() || {};
    if (a.postventa?.activa !== true) return;
    agencias.set(d.id, { desde: sumarDias(soloFecha(a.postventa.desde) || hoy, -3), etapas: Array.isArray(a.pipelineStages) ? a.pipelineStages : [] });
  });
  if (!agencias.size) return [];

  const tratos = await db.collection("deals").where("soldAt", ">=", desde).get();
  const resultado: { dealId: string; cliente: string; tareas: { id: string; titulo: string; fecha: string }[] }[] = [];

  for (const doc of tratos.docs) {
    const d = doc.data() || {};
    const ag = agencias.get(d.agencyId);
    if (!ag || d.isDeleted || d.postventaSembrada) continue;
    if (!checkIsWon(d.status, ag.etapas) || !d.clientId) continue;
    const venta = soloFecha(d.soldAt);
    if (!venta || venta < desde || venta < ag.desde) continue;

    const c = (await db.collection("clients").doc(String(d.clientId)).get()).data();
    if (!c || c.isDeleted) continue;
    const sellerId = String(d.sellerId || c.sellerId || "");
    if (!sellerId) continue; // sin vendedor no hay a quién ponerle la tarea
    const tareas = tareasDePostventa({
      dealId: doc.id, agencyId: d.agencyId, clientId: String(d.clientId), sellerId,
      cliente: String(c.name || ""), auto: String(d.vehicle || "").replace(/^\d{4}\s+/, "") || "auto",
      venta, hoy, ahoraIso: new Date().toISOString(),
    });
    resultado.push({ dealId: doc.id, cliente: String(c.name || ""), tareas: tareas.map((t) => ({ id: t.id, titulo: t.datos.title, fecha: t.datos.dueDate })) });
    if (opciones.simular) continue;

    for (const t of tareas) {
      try {
        // create(): si ya existe (otra corrida a la vez), no la pisa.
        await db.collection("tasks").doc(t.id).create(t.datos);
      } catch (e: any) {
        if (!/ALREADY_EXISTS|already exists/i.test(String(e?.message || e?.code))) throw e;
      }
    }
    await doc.ref.update({ postventaSembrada: true, postventaEn: new Date().toISOString() });
  }
  return resultado;
}
