import type { Client, Vehicle } from '../types';
import { getClientMatches } from '../services/matchingEngine';

/**
 * «Lo que buscan y no tienes»: junta lo que piden los clientes activos y lo
 * compara con el inventario disponible. Se calcula en el navegador con los
 * contactos y autos que la pantalla de Inventario ya tiene cargados: no hace
 * ninguna consulta de más a Firebase.
 *
 * Un cliente «se queda sin opción» cuando el motor de coincidencias no le
 * encuentra ningún auto disponible (ni siquiera uno parecido).
 */

export interface ClienteBuscando {
  id: string;
  nombre: string;
  telefono?: string;
  desde: Date | null;
  presupuesto: string;
  opciones: number;      // autos disponibles que le sirven
}

export interface GrupoDemanda {
  clave: string;
  titulo: string;
  detalle: string;       // años, presupuesto, transmisión…
  clientes: ClienteBuscando[];
  sinOpcion: number;
  tienesExactos: number; // autos disponibles de esa misma marca/modelo o tipo
  precioMin: number;
  precioMax: number;
}

export interface Rango { etiqueta: string; desde: number; hasta: number; piden: number; sinOpcion: number; tienes: number }

const norm = (s?: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
const MARCAS_IGUALES: Record<string, string> = { vw: 'volkswagen', chevy: 'chevrolet', mercedesbenz: 'mercedes' };
const marcaNorm = (m?: string) => MARCAS_IGUALES[norm(m)] || norm(m);
const bonito = (s?: string) => String(s || '').trim().replace(/\s+/g, ' ').replace(/(^|\s)\S/g, (l) => l.toUpperCase());
const pesosCortos = (n: number) => (n >= 1_000_000 ? `$${(n / 1_000_000).toLocaleString('es-MX', { maximumFractionDigits: 1 })} M` : `$${Math.round(n / 1000).toLocaleString('es-MX')} mil`);

export function aFecha(v: any): Date | null {
  if (!v) return null;
  if (typeof v?.toDate === 'function') return v.toDate();
  if (typeof v?.seconds === 'number') return new Date(v.seconds * 1000);
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function tieneBusqueda(c: Client) {
  const w = c.wantedVehicle;
  if (!w) return false;
  return !!(w.make || w.model || w.priceMax || w.priceMin || w.passengers || w.kmMax || w.yearMin || w.yearMax
    || (w.bodyType && w.bodyType !== 'Cualquiera') || (w.transmission && w.transmission !== 'Cualquiera'));
}

/** Clientes que siguen en juego: ni ganados ni perdidos ni borrados. */
export function clientesActivos(clientes: Client[]) {
  return clientes.filter((c) => !c.isDeleted && c.status !== 'won' && c.status !== 'lost' && tieneBusqueda(c));
}

function presupuestoDe(c: Client) {
  const w = c.wantedVehicle || {};
  if (w.priceMin && w.priceMax) return `${pesosCortos(w.priceMin)} a ${pesosCortos(w.priceMax)}`;
  if (w.priceMax) return `hasta ${pesosCortos(w.priceMax)}`;
  if (w.priceMin) return `desde ${pesosCortos(w.priceMin)}`;
  return '';
}

/** A qué grupo va lo que pide: marca y modelo; si no, el tipo; si no, el presupuesto. */
function grupoDe(c: Client): { clave: string; titulo: string } {
  const w = c.wantedVehicle || {};
  if (w.make || w.model) {
    const marca = w.make ? bonito(w.make) : '';
    const modelo = w.model ? bonito(w.model) : '';
    return { clave: `m:${marcaNorm(w.make)}|${norm(w.model)}`, titulo: [marca, modelo].filter(Boolean).join(' ') };
  }
  const tipo = w.bodyType && w.bodyType !== 'Cualquiera' ? w.bodyType : '';
  if (tipo || w.passengers) {
    const plazas = w.passengers ? ` de ${w.passengers} plazas` : '';
    return { clave: `t:${norm(tipo)}|${w.passengers || ''}`, titulo: `${tipo || 'Auto'}${plazas}` };
  }
  const tope = w.priceMax || w.priceMin || 0;
  const r = RANGOS.find((x) => tope > x.desde && tope <= x.hasta) || RANGOS[RANGOS.length - 1];
  return { clave: `p:${r.etiqueta}`, titulo: `Cualquier auto, ${r.etiqueta.toLowerCase()}` };
}

/** ¿Este auto es de lo que pide el grupo? (marca/modelo o tipo, sin mirar precio). */
function esDelGrupo(v: Vehicle, c: Client) {
  const w = c.wantedVehicle || {};
  if (w.make || w.model) {
    if (w.make && marcaNorm(v.make) !== marcaNorm(w.make) && !norm(v.make).includes(norm(w.make))) return false;
    if (w.model && !norm(v.model).includes(norm(w.model)) && !norm(w.model).includes(norm(v.model))) return false;
    return true;
  }
  if (w.bodyType && w.bodyType !== 'Cualquiera' && norm(v.bodyType) !== norm(w.bodyType)) return false;
  if (w.passengers && Number(v.passengers) < Number(w.passengers)) return false;
  return !!(w.bodyType || w.passengers);
}

export const RANGOS: { etiqueta: string; desde: number; hasta: number }[] = [
  { etiqueta: 'Hasta $150 mil', desde: 0, hasta: 150_000 },
  { etiqueta: '$150 a $250 mil', desde: 150_000, hasta: 250_000 },
  { etiqueta: '$250 a $400 mil', desde: 250_000, hasta: 400_000 },
  { etiqueta: '$400 a $600 mil', desde: 400_000, hasta: 600_000 },
  { etiqueta: 'Más de $600 mil', desde: 600_000, hasta: Infinity },
];

export function disponibles(autos: Vehicle[], agencyId?: string) {
  return autos.filter((v) => (!agencyId || v.agencyId === agencyId) && (!v.status || v.status === 'available') && !(v as any).pendingValidation);
}

export function calcularDemanda(clientes: Client[], autos: Vehicle[], agencyId?: string, desdeDias?: number) {
  const inventario = disponibles(autos, agencyId);
  const limite = desdeDias ? Date.now() - desdeDias * 86_400_000 : 0;
  const activos = clientesActivos(clientes).filter((c) => {
    if (!limite) return true;
    const f = aFecha(c.updatedAt) || aFecha(c.createdAt);
    return !f || f.getTime() >= limite;
  });

  const grupos = new Map<string, GrupoDemanda & { _ejemplo: Client }>();
  const conOpciones = new Map<string, number>();
  for (const c of activos) {
    const n = getClientMatches(c, inventario).length;
    conOpciones.set(c.id, n);
    const g = grupoDe(c);
    let grupo = grupos.get(g.clave);
    if (!grupo) {
      grupo = { clave: g.clave, titulo: g.titulo, detalle: '', clientes: [], sinOpcion: 0, tienesExactos: 0, precioMin: Infinity, precioMax: 0, _ejemplo: c };
      grupos.set(g.clave, grupo);
    }
    const w = c.wantedVehicle || {};
    grupo.clientes.push({ id: c.id, nombre: c.name || 'Sin nombre', telefono: c.phone, desde: aFecha(c.createdAt), presupuesto: presupuestoDe(c), opciones: n });
    if (!n) grupo.sinOpcion++;
    if (w.priceMin) grupo.precioMin = Math.min(grupo.precioMin, w.priceMin);
    if (w.priceMax) { grupo.precioMax = Math.max(grupo.precioMax, w.priceMax); grupo.precioMin = Math.min(grupo.precioMin, w.priceMin || w.priceMax * 0.6); }
  }

  const lista: GrupoDemanda[] = [...grupos.values()].map(({ _ejemplo, ...g }) => {
    const ws = activos.filter((c) => grupoDe(c).clave === g.clave).map((c) => c.wantedVehicle || {});
    const mins = ws.map((w) => w.yearMin).filter((x): x is number => !!x);
    const maxs = ws.map((w) => w.yearMax).filter((x): x is number => !!x);
    const textoAnios = mins.length && maxs.length ? `${Math.min(...mins)} a ${Math.max(...maxs)}`
      : mins.length ? `${Math.min(...mins)} en adelante`
      : maxs.length ? `hasta ${Math.max(...maxs)}` : '';
    const trans = [...new Set(ws.map((w) => w.transmission).filter((t) => t && t !== 'Cualquiera'))];
    const partes = [
      textoAnios,
      g.precioMax ? `${pesosCortos(g.precioMin === Infinity ? 0 : g.precioMin)} a ${pesosCortos(g.precioMax)}` : '',
      trans.join(' / '),
    ].filter(Boolean);
    g.clientes.sort((a, b) => a.opciones - b.opciones || (b.desde?.getTime() || 0) - (a.desde?.getTime() || 0));
    return { ...g, detalle: partes.join(' · '), tienesExactos: g.clave.startsWith('p:') ? 0 : inventario.filter((v) => esDelGrupo(v, _ejemplo)).length };
  }).sort((a, b) => b.sinOpcion - a.sinOpcion || b.clientes.length - a.clientes.length);

  // Por presupuesto: cuántos piden en cada rango y cuántos autos tienes ahí.
  const rangos: Rango[] = RANGOS.map((r) => ({ ...r, piden: 0, sinOpcion: 0, tienes: inventario.filter((v) => Number(v.price) > r.desde && Number(v.price) <= r.hasta).length }));
  for (const c of activos) {
    const w = c.wantedVehicle || {};
    const tope = w.priceMax || w.priceMin;
    if (!tope) continue;
    const r = rangos.find((x) => tope > x.desde && tope <= x.hasta);
    if (!r) continue;
    r.piden++;
    if (!conOpciones.get(c.id)) r.sinOpcion++;
  }

  const sinOpcion = activos.filter((c) => !conOpciones.get(c.id)).length;
  return { activos: activos.length, sinOpcion, grupos: lista, rangos, inventario: inventario.length };
}
