import { checkIsLost, checkIsWon } from './clientUtils';

/**
 * Tratos que se están enfriando: abiertos, con vendedor o sin él, y sin ninguna actividad en 7 días o más.
 *
 * Solo cuentan los TRATOS: un contacto que apenas se capturó en el Directorio, uno importado de Google o de Excel, o uno
 * sin etapa del embudo no es un trato y nadie tiene que perseguirlo (mismo criterio que la campanita).
 *
 * «Actividad» es cualquier señal de que alguien habló con el cliente o trabajó el trato: una nota, un mensaje por el chat
 * (de la agencia o del cliente), una tarea completada por una persona, un cambio en el contacto (por ejemplo, moverlo de
 * etapa) o el «Ya lo atendí». Las tareas que crea el propio sistema NO cuentan: si contaran, el aviso se apagaría solo.
 * Si el trato tiene una tarea pendiente a futuro, ya hay un siguiente paso y no se considera frío.
 */

const DIA = 86_400_000;
export const DIAS_SIN_CONTACTO = 7;
/** A los 7 días se programa la primera tarea; a los 14, la segunda (el último intento). */
export const PASOS_REACTIVACION = [7, 14] as const;

export interface TratoFrio {
  id: string;
  nombre: string;
  telefono: string;
  sellerId: string;
  auto: string;
  etapa: string;
  ultimaActividad: number;
  dias: number;
  cliente: any;
}

const ms = (v: any): number => {
  if (!v) return 0;
  if (typeof v === 'string') { const t = Date.parse(v); return Number.isFinite(t) ? t : 0; }
  if (typeof v.toDate === 'function') return v.toDate().getTime();
  const s = v.seconds ?? v._seconds;
  return typeof s === 'number' ? s * 1000 : 0;
};

/** Tareas que crea el sistema: no son una persona trabajando el trato. */
const esDelSistema = (t: any) => !!(t?.seguimiento || t?.reactivacion || t?.postventa || t?.completadaPorPago || t?.type === 'payment' || /^(seguimiento|reactivacion|postventa|pago)_/.test(String(t?.id || '')));

export function esTratoAbierto(c: any, etapas: { id: string; title?: string }[]): boolean {
  if (!c || c.isDeleted || c.isArchived || c.isClosed || c.dismissedStale) return false;
  if (['google_contacts', 'excel_import'].includes(String(c.origin || ''))) return false;
  if (!c.status) return false;
  if (etapas.length > 0 && !etapas.some((e) => e.id === c.status)) return false;
  if (checkIsWon(c.status, etapas) || checkIsLost(c.status, etapas)) return false;
  return true;
}

export function ultimaActividadDe(c: any, notas: any[], tareas: any[]): number {
  let m = Math.max(
    ms(c.updatedAt), ms(c.createdAt), ms(c.primerContactoAt),
    ms(c.chatUltimoSalienteAt), ms(c.chatUltimoEntranteAt), ms(c.lastWhatsappInboundAt), ms(c.lastMessengerInboundAt),
  );
  for (const n of notas) m = Math.max(m, ms(n.createdAt));
  for (const t of tareas) if (t.completed && !esDelSistema(t)) m = Math.max(m, ms(t.completedAt));
  return m;
}

export function tieneSiguientePaso(tareas: any[], hoy: string): boolean {
  return tareas.some((t) => !t.completed && !esDelSistema(t) && String(t.dueDate || '').slice(0, 10) >= hoy);
}

export function tratosEnfriandose(p: {
  clientes: any[]; notas: any[]; tareas: any[]; etapas: { id: string; title?: string }[];
  ahora?: number; dias?: number; hoy?: string;
}): TratoFrio[] {
  const ahora = p.ahora ?? Date.now();
  const dias = p.dias ?? DIAS_SIN_CONTACTO;
  const hoy = p.hoy ?? new Date(ahora).toLocaleDateString('en-CA');
  const notasDe = new Map<string, any[]>();
  p.notas.forEach((n) => { if (n?.clientId) notasDe.set(n.clientId, [...(notasDe.get(n.clientId) || []), n]); });
  const tareasDe = new Map<string, any[]>();
  p.tareas.forEach((t) => { if (t?.clientId) tareasDe.set(t.clientId, [...(tareasDe.get(t.clientId) || []), t]); });
  const nombreEtapa = (id: string) => p.etapas.find((e) => e.id === id)?.title || id;

  const salida: TratoFrio[] = [];
  for (const c of p.clientes) {
    if (!esTratoAbierto(c, p.etapas)) continue;
    const tareas = tareasDe.get(c.id) || [];
    if (tieneSiguientePaso(tareas, hoy)) continue;
    const ultima = ultimaActividadDe(c, notasDe.get(c.id) || [], tareas);
    if (!ultima) continue;
    const d = Math.floor((ahora - ultima) / DIA);
    if (d < dias) continue;
    salida.push({
      id: c.id, nombre: String(c.name || 'Sin nombre'), telefono: String(c.phone || ''), sellerId: String(c.sellerId || ''),
      auto: String(c.vehicle || c.dealTitle || ''), etapa: nombreEtapa(c.status), ultimaActividad: ultima, dias: d, cliente: c,
    });
  }
  // Los que más llevan, primero.
  return salida.sort((a, b) => b.dias - a.dias);
}

/** El paso que toca (1 = a los 7 días, 2 = a los 14), 0 si no toca ninguno nuevo. */
export function pasoDeReactivacion(dias: number, pasoHecho: number): number {
  const objetivo = dias >= PASOS_REACTIVACION[1] ? 2 : dias >= PASOS_REACTIVACION[0] ? 1 : 0;
  return objetivo > pasoHecho ? objetivo : 0;
}

export const idTareaReactivacion = (clientId: string, base: number, paso: number) => `reactivacion_${clientId}_${base}_${paso}`.replace(/[^\w-]/g, '_');

export function tareaDeReactivacion(p: { paso: number; clientId: string; agencyId: string; sellerId: string; cliente: string; auto: string; dias: number; base: number; hoy: string; ahoraIso: string }) {
  const primerNombre = String(p.cliente || '').trim().split(/\s+/)[0] || '';
  const saludo = `Hola${primerNombre ? ` ${primerNombre}` : ''}`;
  const auto = p.auto ? ` el ${p.auto.replace(/^\d{4}\s+/, '')}` : ' tu búsqueda';
  const mensajes = [
    `${saludo}, ¿cómo vas con${auto}? Quedé pendiente de ti y quiero saber si te puedo ayudar con algo más.`,
    `${saludo}, no quiero ser insistente: ¿sigues interesado en${auto}? Si ya no, con gusto cierro tu solicitud; y si cambió algo, dime qué buscas y te paso opciones.`,
  ];
  const ultimo = p.paso === 2;
  return {
    id: idTareaReactivacion(p.clientId, p.base, p.paso),
    datos: {
      agencyId: p.agencyId, sellerId: p.sellerId, clientId: p.clientId,
      title: `Retomar a ${p.cliente || 'el cliente'}: lleva ${PASOS_REACTIVACION[p.paso - 1]} días sin contacto${ultimo ? ' (último intento)' : ''}`,
      notes: `Este trato lleva ${p.dias} días sin actividad. Mensaje sugerido (revísalo y mándalo tú):\n«${mensajes[p.paso - 1]}»${ultimo ? '\n\nEs el último aviso automático de esta ronda: si no contesta, considera cerrarlo como «solo contacto» o moverlo a perdido.' : ''}`,
      dueDate: p.hoy,
      completed: false,
      type: 'call',
      reactivacion: true,
      pasoReactivacion: p.paso,
      createdAt: p.ahoraIso,
      createdByName: 'Reactivación automática',
    },
  };
}
