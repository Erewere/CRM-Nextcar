import { idTareaReactivacion, pasoDeReactivacion, tareaDeReactivacion, tratosEnfriandose, ultimaActividadDe, esTratoAbierto, tieneSiguientePaso } from "../lib/enfriandose.ts";
import { hoyEnMexico } from "./postventa.ts";

/**
 * Siembra las tareas de «retomar» de los tratos que se enfrían (ver src/lib/enfriandose.ts).
 *
 * OPCIONAL por agencia: `reactivacion.activa = true`, y ese día queda en `reactivacion.desde`. Solo se le pone tarea a un
 * trato cuyo día 7 sin contacto cae DESPUÉS de esa fecha: nunca se le llenan de golpe las tareas al vendedor por tratos que
 * ya llevaban semanas quietos (esos salen en la lista «Sin contacto» de Nuevos, para limpiarlos a mano).
 *
 * Cada contacto lleva `reactivacionRonda {base, paso}` (base = su última actividad) para saber en qué paso va. Si
 * después se le da cualquier seguimiento, la última actividad avanza, las tareas pendientes de esa ronda se borran y la
 * cuenta vuelve a empezar. Un trato sin vendedor no recibe tarea (no hay a quién ponérsela).
 */

const DIA = 86_400_000;

export async function sembrarReactivacion(db: any, opciones: { simular?: boolean } = {}) {
  const ahora = Date.now();
  const hoy = hoyEnMexico();
  const agencias = new Map<string, { desdeMs: number; etapas: any[] }>();
  (await db.collection("agencies").get()).docs.forEach((d: any) => {
    const a = d.data() || {};
    if (a.reactivacion?.activa !== true) return;
    const desde = String(a.reactivacion?.desde || "").slice(0, 10) || hoy;
    agencias.set(d.id, { desdeMs: new Date(`${desde}T00:00:00-06:00`).getTime(), etapas: Array.isArray(a.pipelineStages) ? a.pipelineStages : [] });
  });
  const resultado: { agencyId: string; clientId: string; cliente: string; paso: number; titulo: string }[] = [];

  for (const [agencyId, ag] of agencias) {
    const [cs, ns, ts] = await Promise.all([
      db.collection("clients").where("agencyId", "==", agencyId).get(),
      db.collection("notes").where("agencyId", "==", agencyId).get(),
      db.collection("tasks").where("agencyId", "==", agencyId).get(),
    ]);
    const clientes = cs.docs.map((d: any) => ({ ...d.data(), id: d.id }));
    const notas = ns.docs.map((d: any) => ({ ...d.data(), id: d.id }));
    const tareas = ts.docs.map((d: any) => ({ ...d.data(), id: d.id }));
    const notasDe = new Map<string, any[]>();
    notas.forEach((n: any) => { if (n.clientId) notasDe.set(n.clientId, [...(notasDe.get(n.clientId) || []), n]); });
    const tareasDe = new Map<string, any[]>();
    tareas.forEach((t: any) => { if (t.clientId) tareasDe.set(t.clientId, [...(tareasDe.get(t.clientId) || []), t]); });

    // 1. Quien ya recibió seguimiento: las tareas pendientes de su ronda se quitan y la ronda se reinicia.
    for (const c of clientes) {
      const ronda = c.reactivacionRonda;
      if (!ronda) continue;
      const ultima = ultimaActividadDe(c, notasDe.get(c.id) || [], tareasDe.get(c.id) || []);
      if (ultima <= Number(ronda.base || 0) + 1000) continue;
      if (!opciones.simular) {
        for (let n = 1; n <= Number(ronda.paso || 0); n++) {
          const ref = db.collection("tasks").doc(idTareaReactivacion(c.id, Number(ronda.base), n));
          const t = await ref.get();
          if (t.exists && !t.data()?.completed) await ref.delete();
        }
        await db.collection("clients").doc(c.id).update({ reactivacionRonda: null });
      }
      c.reactivacionRonda = null;
    }

    // 2. Los que llevan 7 (o 14) días sin contacto.
    const frios = tratosEnfriandose({ clientes, notas, tareas, etapas: ag.etapas, ahora, dias: 7, hoy });
    for (const f of frios) {
      const c = f.cliente;
      // Su día 7 tiene que haber caído después de que se encendió.
      if (f.ultimaActividad + 7 * DIA < ag.desdeMs) continue;
      if (!f.sellerId) continue;
      const ronda = c.reactivacionRonda;
      const pasoHecho = ronda && Number(ronda.base) === f.ultimaActividad ? Number(ronda.paso || 0) : 0;
      const paso = pasoDeReactivacion(f.dias, pasoHecho);
      if (!paso) continue;
      const tarea = tareaDeReactivacion({
        paso, clientId: f.id, agencyId, sellerId: f.sellerId, cliente: f.nombre, auto: f.auto, dias: f.dias,
        base: f.ultimaActividad, hoy, ahoraIso: new Date(ahora).toISOString(),
      });
      resultado.push({ agencyId, clientId: f.id, cliente: f.nombre, paso, titulo: tarea.datos.title });
      if (opciones.simular) continue;
      try {
        await db.collection("tasks").doc(tarea.id).create(tarea.datos);
      } catch (e: any) {
        if (!/ALREADY_EXISTS|already exists/i.test(String(e?.message || e?.code))) throw e;
      }
      await db.collection("clients").doc(f.id).update({ reactivacionRonda: { base: f.ultimaActividad, paso } });
    }
  }
  return resultado;
}

export { esTratoAbierto, tieneSiguientePaso };
