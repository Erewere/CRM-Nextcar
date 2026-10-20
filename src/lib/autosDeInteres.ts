import { checkIsLost, checkIsWon } from './clientUtils';
import { MINIMO_ANUNCIOS, franjaDelPrecio, medianaDe, type PrecioMercado } from './precioMercado';

/**
 * Los autos de interés de un cliente: en qué estado está cada uno y qué ha
 * pasado con él (trato, cotización, formulario de la página, venta).
 *
 * El estado lo puede poner la persona a mano (queda en `cliente.autosInteres`);
 * si no lo ha puesto, se deduce de lo que ya hay: cotizado si hay cotización,
 * interesado si no. Todo se lee de datos que ya existen: no se inventa nada.
 */

export const ESTADOS_AUTO = [
  { id: 'interesado', texto: 'Interesado' },
  { id: 'cotizado', texto: 'Cotizado' },
  { id: 'visito', texto: 'Visitó' },
  { id: 'aparto', texto: 'Apartó' },
  { id: 'descartado', texto: 'Descartado' },
] as const;
export type EstadoAuto = (typeof ESTADOS_AUTO)[number]['id'];

export const textoDeEstado = (id: string) => ESTADOS_AUTO.find((e) => e.id === id)?.texto || id;

export interface EventoAuto {
  fecha: string;
  texto: string;
  tipo: 'trato' | 'cotizacion' | 'pagina' | 'ficha' | 'estado' | 'venta';
}

const fechaIso = (v: any): string => {
  if (!v) return '';
  if (typeof v === 'string') return v;
  if (typeof v.toDate === 'function') return v.toDate().toISOString();
  const s = v.seconds ?? v._seconds;
  return typeof s === 'number' ? new Date(s * 1000).toISOString() : '';
};

const sinAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const pesos = (n: number) => '$' + Math.round(Number(n) || 0).toLocaleString('es-MX');

/** ¿El texto «Nissan Sentra 2020» que mandó la página es este auto? Todas sus palabras tienen que estar en el auto. */
export function coincideTexto(v: { make?: string; model?: string; year?: number | string }, texto: string): boolean {
  const palabras = sinAcentos(texto).split(' ').filter((p) => p.length >= 2);
  if (palabras.length < 2) return false;
  const auto = ` ${sinAcentos(`${v.make || ''} ${v.model || ''} ${v.year || ''}`)} `;
  return palabras.every((p) => auto.includes(` ${p} `) || auto.includes(p));
}

export function eventosDelAuto(p: { v: any; cliente: any; tratos: any[]; notas: any[]; etapas: { id: string }[] }): EventoAuto[] {
  const { v, cliente, tratos, notas, etapas } = p;
  const ev: EventoAuto[] = [];

  tratos.filter((t) => !t.isDeleted && t.vehicleId === v.id).forEach((t) => {
    const creado = fechaIso(t.createdAt);
    if (creado) ev.push({ fecha: creado, texto: 'Se abrió un trato con este auto', tipo: 'trato' });
    if (checkIsWon(t.status, etapas as any)) ev.push({ fecha: fechaIso(t.updatedAt) || creado, texto: 'Trato ganado', tipo: 'trato' });
    else if (checkIsLost(t.status, etapas as any)) ev.push({ fecha: fechaIso(t.updatedAt) || creado, texto: 'Trato cerrado sin venta', tipo: 'trato' });
  });

  let hayPagina = false;
  (notas || []).forEach((n) => {
    if (n.type === 'cotizacion' && n.cotizacion?.vehicleId === v.id) {
      const c = n.cotizacion;
      const mensual = Array.isArray(c.opciones) && c.opciones.length ? Math.min(...c.opciones.map((o: any) => Number(o.mensualidad) || Infinity)) : 0;
      ev.push({
        fecha: fechaIso(n.createdAt),
        texto: `Se le cotizó${c.folio ? ` (${c.folio})` : ''}${c.precioFinal ? ` en ${pesos(c.precioFinal)}` : ''}${mensual && Number.isFinite(mensual) ? `, desde ${pesos(mensual)} al mes` : ''}`,
        tipo: 'cotizacion',
      });
    } else if (n.type === 'formulario-web') {
      const linea = String(n.content || '').split('\n').find((l) => /^auto:/i.test(l.trim()));
      const auto = linea ? linea.replace(/^auto:\s*/i, '') : '';
      if (auto && coincideTexto(v, auto)) {
        hayPagina = true;
        const tipo = String(n.tipoSolicitud || '').toLowerCase();
        const que = /cr[eé]dito/.test(tipo) ? 'Pidió crédito' : /vender|consign/.test(tipo) ? 'Mandó su auto para venderlo' : 'Pidió información';
        ev.push({ fecha: fechaIso(n.createdAt), texto: `${que} desde la página${n.origin ? ` (${n.origin})` : ''}`, tipo: 'pagina' });
      }
    }
  });

  if (cliente?.vehicleId === v.id && !hayPagina && cliente.createdAt) {
    ev.push({ fecha: fechaIso(cliente.createdAt), texto: 'Se anotó como su auto de interés', tipo: 'ficha' });
  }

  // Cada cambio de estado deja una nota en la Actividad (type «estado-auto»): ahí está el historial completo.
  // Los cambios anteriores a las notas solo dejaron el campo; ese último se muestra si no hay nota que lo cubra.
  const cambios = (notas || []).filter((n) => n.type === 'estado-auto' && n.vehicleId === v.id);
  cambios.forEach((n) => ev.push({ fecha: fechaIso(n.createdAt), texto: `Marcado como «${textoDeEstado(n.estado)}»${n.createdByName ? ` por ${n.createdByName}` : ''}`, tipo: 'estado' }));
  const manual = cliente?.autosInteres?.[v.id];
  if (manual?.estado && manual.en && !cambios.some((n) => n.estado === manual.estado && Math.abs(Date.parse(fechaIso(n.createdAt)) - Date.parse(manual.en)) < 60_000)) {
    ev.push({ fecha: manual.en, texto: `Marcado como «${textoDeEstado(manual.estado)}»${manual.porNombre ? ` por ${manual.porNombre}` : ''}`, tipo: 'estado' });
  }

  if (v.status === 'sold' && (v.buyerId === cliente?.id || v.soldToClientId === cliente?.id) && v.soldAt) {
    ev.push({ fecha: fechaIso(v.soldAt), texto: 'Lo compró', tipo: 'venta' });
  }

  return ev.filter((e) => e.fecha).sort((a, b) => b.fecha.localeCompare(a.fecha));
}

/** Estado que se muestra: el que puso la persona, o el que se deduce de lo que ya hay. */
export function estadoDelAuto(p: { v: any; cliente: any; eventos: EventoAuto[] }): { id: EstadoAuto | 'compro'; manual: boolean } {
  const { v, cliente, eventos } = p;
  if (v.status === 'sold' && (v.buyerId === cliente?.id || v.soldToClientId === cliente?.id)) return { id: 'compro', manual: false };
  const manual = cliente?.autosInteres?.[v.id]?.estado;
  if (manual && ESTADOS_AUTO.some((e) => e.id === manual)) return { id: manual, manual: true };
  return { id: eventos.some((e) => e.tipo === 'cotizacion') ? 'cotizado' : 'interesado', manual: false };
}

/** «Buen precio · 5% abajo del mercado», o null si no hay mercado suficiente para opinar. */
export function lineaDeMercado(precio: number, mercado?: PrecioMercado | null): { texto: string; tono: 'bueno' | 'justo' | 'malo' } | null {
  if (!mercado || mercado.n < MINIMO_ANUNCIOS || !(precio > 0)) return null;
  const franja = franjaDelPrecio(precio, mercado);
  const mediana = medianaDe(mercado);
  const pct = Math.round(((precio - mediana) / mediana) * 100);
  const cmp = pct === 0 ? 'en la mediana del mercado' : `${Math.abs(pct)}% ${pct < 0 ? 'abajo' : 'arriba'} del mercado`;
  const nombre = { excelente: 'Excelente precio', bueno: 'Buen precio', justo: 'Precio justo', arriba: 'Arriba del mercado' }[franja];
  return { texto: franja === 'arriba' ? `${nombre} · ${cmp.replace(' del mercado', '')}` : `${nombre} · ${cmp}`, tono: franja === 'arriba' ? 'malo' : franja === 'justo' ? 'justo' : 'bueno' };
}
