import { ahoraEnMexico, minutosParaAvisar, textoDeCita, textoDelResumen, toca, type AhoraEnMexico } from "../lib/avisosDeActividades.ts";
import type { AvisoPush } from "./push.ts";

/**
 * Avisos al celular de las actividades (cita próxima y resumen de la mañana). Reglas en src/lib/avisosDeActividades.ts.
 *
 * Barato a propósito: solo mira a las personas que TIENEN el celular suscrito, y de cada una solo las tareas de HOY
 * (y, una vez al día, sus pendientes para contar las vencidas). Cada aviso deja una marca en `pushEnviados` con id
 * fijo, así que aunque dos corridas coincidan solo sale uno; las marcas de más de 3 días se limpian solas.
 */

let ultimaLimpieza = "";

export async function avisarActividades(db: any, avisarA: (db: any, uids: string[], aviso: AvisoPush) => Promise<number>, opciones: { simular?: boolean; ahora?: AhoraEnMexico } = {}) {
  const ahora = opciones.ahora ?? ahoraEnMexico();
  const subs = await db.collection("pushSuscripciones").get();
  const uids = [...new Set<string>(subs.docs.map((d: any) => String(d.data()?.uid || "")).filter(Boolean))];
  const hechos: { uid: string; tipo: string; texto: string }[] = [];
  if (!uids.length) return hechos;

  // Solo de 7:00 a 21:59: nadie quiere un aviso de cita de madrugada.
  const hora = Math.floor(ahora.minutos / 60);
  if (hora < 7 || hora >= 22) return hechos;

  const marcar = async (id: string) => {
    try { await db.collection("pushEnviados").doc(id).create({ fecha: ahora.fecha, creada: new Date().toISOString() }); return true; }
    catch (e: any) { if (/ALREADY_EXISTS|already exists/i.test(String(e?.message || e?.code))) return false; throw e; }
  };

  for (const uid of uids) {
    // ---- Citas próximas: las tareas de hoy de esta persona con hora.
    const deHoy = await db.collection("tasks").where("sellerId", "==", uid).where("dueDate", "==", ahora.fecha).get();
    for (const t of deHoy.docs) {
      const x = t.data() || {};
      const faltan = minutosParaAvisar(x, ahora);
      if (faltan === null) continue;
      const aviso = textoDeCita(String(x.title || ""), faltan);
      hechos.push({ uid, tipo: "cita", texto: `${aviso.titulo}: ${aviso.cuerpo}` });
      if (opciones.simular) continue;
      if (await marcar(`cita_${t.id}`)) await avisarA(db, [uid], { ...aviso, url: "/tasks", etiqueta: `tarea-${t.id}` });
    }

    // ---- Resumen de la mañana: una vez al día.
    if (toca(ahora)) {
      const idResumen = `resumen_${uid}_${ahora.fecha}`;
      const yaSalio = !opciones.simular && (await db.collection("pushEnviados").doc(idResumen).get()).exists;
      if (!yaSalio) {
        const pendientes = await db.collection("tasks").where("sellerId", "==", uid).where("completed", "==", false).get();
        let vencidas = 0, paraHoy = 0;
        pendientes.docs.forEach((t: any) => {
          const f = String(t.data()?.dueDate || "").slice(0, 10);
          if (!f) return;
          if (f < ahora.fecha) vencidas++; else if (f === ahora.fecha) paraHoy++;
        });
        const texto = textoDelResumen(vencidas, paraHoy);
        if (texto) {
          hechos.push({ uid, tipo: "resumen", texto: `${texto.titulo}: ${texto.cuerpo}` });
          if (!opciones.simular && (await marcar(idResumen))) await avisarA(db, [uid], { ...texto, url: "/tasks", etiqueta: `resumen-${ahora.fecha}` });
        }
      }
    }
  }

  // Limpieza de marcas viejas, una vez al día.
  if (!opciones.simular && ultimaLimpieza !== ahora.fecha) {
    ultimaLimpieza = ahora.fecha;
    try {
      const [a, m, d] = ahora.fecha.split("-").map(Number);
      const corte = new Date(a, m - 1, d - 3, 12).toLocaleDateString("en-CA");
      const viejas = await db.collection("pushEnviados").where("fecha", "<", corte).get();
      for (const doc of viejas.docs) await doc.ref.delete();
    } catch (e) { console.error("Limpieza de avisos:", e); }
  }
  return hechos;
}
