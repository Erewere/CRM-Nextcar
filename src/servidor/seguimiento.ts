import { checkIsLost, checkIsWon } from "../lib/clientUtils.ts";
import { HORAS_POR_PASO, VENTANA_DIAS_SEGUIMIENTO, idTareaSeguimiento, pasoQueToca, tareaDeSeguimiento } from "../lib/seguimiento.ts";
import { hoyEnMexico } from "./postventa.ts";

/**
 * Siembra el seguimiento a quienes no responden (ver src/lib/seguimiento.ts).
 *
 * OPCIONAL por agencia: `seguimiento.activa = true`, y ese día queda en `seguimiento.desde`. Solo cuentan los mensajes
 * que la agencia mandó desde ese día. Mira únicamente los contactos a los que se les escribió en los últimos 10 días
 * (una consulta barata sobre un solo campo).
 *
 * Cada contacto lleva `seguimientoRonda {ultimoMensaje, paso}` para saber en qué paso va: si el vendedor completa o
 * borra una tarea, no se vuelve a crear. Si el cliente contesta, las tareas pendientes de esa ronda se borran.
 * Un contacto que ya tiene otra tarea pendiente a futuro no recibe tareas nuevas: ya hay un siguiente paso.
 */

const ms = (v: any): number => {
  if (!v) return 0;
  if (typeof v === "string") { const t = Date.parse(v); return Number.isFinite(t) ? t : 0; }
  if (typeof v.toDate === "function") return v.toDate().getTime();
  const s = v.seconds ?? v._seconds;
  return typeof s === "number" ? s * 1000 : 0;
};

export async function sembrarSeguimiento(db: any, opciones: { simular?: boolean; todasLasAgencias?: boolean; desdeSimulacion?: number } = {}) {
  const ahora = Date.now();
  const hoy = hoyEnMexico();

  const agencias = new Map<string, { desdeMs: number; etapas: any[] }>();
  (await db.collection("agencies").get()).docs.forEach((d: any) => {
    const a = d.data() || {};
    if (!opciones.todasLasAgencias && a.seguimiento?.activa !== true) return;
    const desde = String(a.seguimiento?.desde || "").slice(0, 10) || hoy;
    agencias.set(d.id, { desdeMs: opciones.desdeSimulacion ?? new Date(`${desde}T00:00:00-06:00`).getTime(), etapas: Array.isArray(a.pipelineStages) ? a.pipelineStages : [] });
  });
  if (!agencias.size) return [];

  const corte = new Date(ahora - VENTANA_DIAS_SEGUIMIENTO * 86_400_000).toISOString();
  const contactos = await db.collection("clients").where("chatUltimoSalienteAt", ">=", corte).get();
  const resultado: { clientId: string; cliente: string; paso: number; titulo: string }[] = [];

  for (const doc of contactos.docs) {
    const c = doc.data() || {};
    const ag = agencias.get(c.agencyId);
    if (!ag || c.isDeleted) continue;
    const ultimoMensajeAgencia = ms(c.chatUltimoSalienteAt);
    const ultimoDelCliente = Math.max(ms(c.chatUltimoEntranteAt), ms(c.lastWhatsappInboundAt), ms(c.lastMessengerInboundAt));
    const ronda = c.seguimientoRonda || null;

    // El cliente contestó después de la ronda: las tareas pendientes de esa ronda ya no sirven.
    if (ronda && ultimoDelCliente > Number(ronda.ultimoMensaje || 0)) {
      if (!opciones.simular) {
        for (let n = 1; n <= Number(ronda.paso || 0); n++) {
          const ref = db.collection("tasks").doc(idTareaSeguimiento(doc.id, Number(ronda.ultimoMensaje), n));
          const t = await ref.get();
          if (t.exists && !t.data()?.completed) await ref.delete();
        }
        await doc.ref.update({ seguimientoRonda: null });
      }
      continue;
    }

    if (ultimoDelCliente >= ultimoMensajeAgencia) continue; // contestó: no hay nada que perseguir
    if (ultimoMensajeAgencia < ag.desdeMs) continue;
    if (checkIsWon(c.status, ag.etapas) || checkIsLost(c.status, ag.etapas)) continue;
    const pasoHecho = ronda && Number(ronda.ultimoMensaje) === ultimoMensajeAgencia ? Number(ronda.paso || 0) : 0;
    const paso = pasoQueToca({ ahora, ultimoMensajeAgencia, pasoHecho });
    if (!paso) continue;
    const sellerId = String(c.sellerId || "");
    if (!sellerId) continue; // sin vendedor no hay a quién ponerle la tarea

    // ¿Ya tiene un siguiente paso agendado? Entonces no se le suma otra tarea.
    const pendientes = await db.collection("tasks").where("clientId", "==", doc.id).where("completed", "==", false).get();
    const tieneSiguientePaso = pendientes.docs.some((t: any) => {
      const x = t.data() || {};
      return !x.seguimiento && String(x.dueDate || "").slice(0, 10) >= hoy;
    });
    if (tieneSiguientePaso) continue;

    const tarea = tareaDeSeguimiento({
      paso, clientId: doc.id, agencyId: c.agencyId, sellerId, cliente: String(c.name || ""),
      auto: String(c.vehicle || "").replace(/^\d{4}\s+/, ""), ultimoMensajeAgencia, hoy, ahoraIso: new Date(ahora).toISOString(),
    });
    resultado.push({ clientId: doc.id, cliente: String(c.name || ""), paso, titulo: tarea.datos.title });
    if (opciones.simular) continue;
    try {
      await db.collection("tasks").doc(tarea.id).create(tarea.datos);
    } catch (e: any) {
      if (!/ALREADY_EXISTS|already exists/i.test(String(e?.message || e?.code))) throw e;
    }
    await doc.ref.update({ seguimientoRonda: { ultimoMensaje: ultimoMensajeAgencia, paso } });
  }
  return resultado;
}

export { HORAS_POR_PASO };
