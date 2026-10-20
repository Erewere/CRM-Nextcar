/**
 * Cuándo avisar de una actividad (cita, llamada, tarea) y qué decir. Solo reglas de tiempo, sin inteligencia
 * artificial. Las horas son SIEMPRE las de México (America/Mexico_City): el servidor puede estar en otra zona.
 *
 *  - «Cita próxima»: una actividad con hora, de hoy, sin completar, se avisa cuando faltan 15 minutos o menos
 *    (y todavía no pasa la hora). Una sola vez por actividad.
 *  - «Resumen de la mañana»: una vez al día, entre las 9:00 y las 11:59, a quien tenga tareas vencidas o para hoy.
 */

export const MINUTOS_DE_ANTICIPO = 15;
export const HORA_DEL_RESUMEN = 9; // 9:00 hora de México
export const RESUMEN_HASTA = 12;   // ya no se manda a partir de las 12:00

export interface AhoraEnMexico { fecha: string; minutos: number }

/** La fecha ('AAAA-MM-DD') y los minutos desde medianoche, hora de México. */
export function ahoraEnMexico(d: Date = new Date()): AhoraEnMexico {
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d);
  const v = (t: string) => partes.find((p) => p.type === t)?.value || '0';
  return { fecha: `${v('year')}-${v('month')}-${v('day')}`, minutos: Number(v('hour')) * 60 + Number(v('minute')) };
}

/** «09:30», «9:30», «9:30 pm» → minutos desde medianoche, o null si no hay hora. */
export function minutosDeLaHora(texto: unknown): number | null {
  const m = /^\s*(\d{1,2}):(\d{2})\s*([ap])?\.?m?\.?\s*$/i.exec(String(texto || ''));
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  if (m[3]) { const pm = m[3].toLowerCase() === 'p'; h = (h % 12) + (pm ? 12 : 0); }
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Minutos que faltan para la actividad si toca avisar ahora; null si no. */
export function minutosParaAvisar(tarea: { dueDate?: string; dueTime?: string; startTime?: string; completed?: boolean; type?: string }, ahora: AhoraEnMexico): number | null {
  if (tarea.completed || String(tarea.dueDate || '').slice(0, 10) !== ahora.fecha) return null;
  const hora = minutosDeLaHora(tarea.dueTime) ?? minutosDeLaHora(tarea.startTime);
  if (hora === null) return null;
  const faltan = hora - ahora.minutos;
  return faltan >= 0 && faltan <= MINUTOS_DE_ANTICIPO ? faltan : null;
}

export function toca(resumenDeLaManana: AhoraEnMexico): boolean {
  const h = Math.floor(resumenDeLaManana.minutos / 60);
  return h >= HORA_DEL_RESUMEN && h < RESUMEN_HASTA;
}

export function textoDelResumen(vencidas: number, deHoy: number): { titulo: string; cuerpo: string } | null {
  if (!vencidas && !deHoy) return null;
  const partes = [
    vencidas ? `${vencidas} tarea${vencidas === 1 ? '' : 's'} vencida${vencidas === 1 ? '' : 's'}` : '',
    deHoy ? `${deHoy} para hoy` : '',
  ].filter(Boolean);
  return { titulo: vencidas ? 'Tienes tareas vencidas' : 'Tus tareas de hoy', cuerpo: `${partes.join(' y ')}. Ábrelas en el CRM.` };
}

export function textoDeCita(titulo: string, faltan: number): { titulo: string; cuerpo: string } {
  const limpio = String(titulo || 'Actividad').replace(/[\u0000-\u001f<>]/g, ' ').trim().slice(0, 90);
  return { titulo: faltan <= 1 ? 'Es ahora' : `En ${faltan} minutos`, cuerpo: limpio };
}
