import { checkIsLost, checkIsWon } from './clientUtils';

/** Lo que dice cada tarjeta del inventario sobre el interés de la gente en un auto. */
export interface InteresDeAuto {
  interesados: number;
  tratosAbiertos: number;
  /** Fecha (ISO) del interesado más reciente, o null si nadie ha preguntado. */
  ultimo: string | null;
}

const fechaIso = (v: any): string | null => {
  if (!v) return null;
  if (typeof v === 'string') return v;
  if (typeof v.toDate === 'function') return v.toDate().toISOString();
  const s = v.seconds ?? v._seconds;
  return typeof s === 'number' ? new Date(s * 1000).toISOString() : null;
};

/**
 * Interesados por auto: personas distintas con un trato de ese auto o con
 * ese auto en su ficha. Un trato abierto es el que no está ganado ni perdido.
 */
export function interesPorAuto(
  tratos: any[],
  contactos: any[],
  etapas: { id: string; title?: string }[] = []
): Map<string, InteresDeAuto> {
  const personas = new Map<string, Set<string>>();
  const abiertos = new Map<string, number>();
  const ultimo = new Map<string, string>();

  const anotar = (vehicleId: string, persona: string, fecha: string | null) => {
    if (!personas.has(vehicleId)) personas.set(vehicleId, new Set());
    personas.get(vehicleId)!.add(persona);
    if (fecha && fecha > (ultimo.get(vehicleId) || '')) ultimo.set(vehicleId, fecha);
  };

  tratos.forEach((t) => {
    if (!t?.vehicleId || t.isDeleted) return;
    anotar(t.vehicleId, t.clientId || `trato:${t.id}`, fechaIso(t.createdAt));
    if (!checkIsWon(t.status, etapas) && !checkIsLost(t.status, etapas)) {
      abiertos.set(t.vehicleId, (abiertos.get(t.vehicleId) || 0) + 1);
    }
  });
  contactos.forEach((c) => {
    if (!c?.vehicleId || c.isDeleted) return;
    anotar(c.vehicleId, c.id, fechaIso(c.createdAt));
  });

  const resultado = new Map<string, InteresDeAuto>();
  personas.forEach((set, vehicleId) => {
    resultado.set(vehicleId, {
      interesados: set.size,
      tratosAbiertos: abiertos.get(vehicleId) || 0,
      ultimo: ultimo.get(vehicleId) || null,
    });
  });
  return resultado;
}

/** Días completos desde una fecha (YYYY-MM-DD o ISO); null si no hay fecha válida. */
export function diasDesde(fecha?: string | null): number | null {
  if (!fecha) return null;
  const t = new Date(fecha).getTime();
  if (isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 86400000));
}

/** «hoy», «ayer», «hace 23 días». */
export function haceCuanto(fecha?: string | null): string {
  const d = diasDesde(fecha);
  if (d === null) return '—';
  if (d === 0) return 'hoy';
  if (d === 1) return 'ayer';
  return `hace ${d} días`;
}
