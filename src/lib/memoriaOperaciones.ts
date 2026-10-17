/**
 * Memoria de operaciones y recomendación de precios (Fase 3).
 *
 * `armarOperacion` convierte un auto VENDIDO en una ficha con lo que costó, lo
 * que se gastó, en cuánto se vendió, la utilidad y los días que tardó. Usa los
 * datos que ya existen y no escribe nada en el auto: si falta algo (precio de
 * compra, fechas) lo marca en `faltantes` en vez de inventarlo.
 *
 * `recomendarPrecios` busca los autos vendidos más parecidos y responde:
 *   - cuánto se podría vender,
 *   - cuánto es lo MÁXIMO que conviene pagar,
 *   - en cuántos días se vendería,
 *   - y qué tan seguro es, según cuántos comparables hubo.
 * Con pocos comparables lo dice y se apoya en el mercado (anuncios de Mercado
 * Libre) y en la guía. Reglas simples y explicadas; ninguna IA.
 *
 * Decisiones (Luis, oct 2026):
 *  - El precio de venta sugerido sale de lo que de verdad se vendió y del mercado,
 *    NO de la guía de venta: aquí se vende casi siempre arriba de ella.
 *  - El margen es utilidad entre precio de venta (un auto que se vende en $300,000
 *    con 10 % deja $30,000), y es configurable por agencia.
 *  - El máximo a pagar es el MENOR entre lo que deja el margen objetivo y el tope de
 *    la guía según qué tan comercial es el auto (`techoDeCompra`).
 */

import { comercialidad, techoDeCompra, type Comercialidad } from './analisisCompra';
import { FACTOR_COMPRA } from './guiaPrecios';
import type { PrecioMercado } from './precioMercado';
import { medianaDe } from './precioMercado';

/** Margen con el que arranca cada agencia (Luis, 18 oct 2026); el administrador lo cambia en Revisión de precios. */
export const MARGEN_OBJETIVO_INICIAL_PCT = 12;
export const KM_PARECIDO = 60_000;

export interface Operacion {
  vehicleId: string;
  titulo: string;
  marca: string;
  modelo: string;
  anio: number;
  km: number | null;
  precioCompra: number | null;
  gastos: number;
  /** false si el auto no tiene un solo gasto capturado: puede ser cero de verdad o falta de captura. */
  gastosRegistrados: boolean;
  precioVenta: number | null;
  utilidad: number | null;
  /** Utilidad entre precio de venta, en %. */
  margenPct: number | null;
  diasEnInventario: number | null;
  fechaCompra: string;
  fechaVenta: string;
  esConsignacion: boolean;
  completa: boolean;
  faltantes: string[];
}

const num = (x: any) => (Number.isFinite(Number(x)) ? Number(x) : 0);

export function armarOperacion(v: any, precioCompra: number, gastosLista: { amount?: number }[]): Operacion {
  const consignacion = v.ownership === 'consignacion';
  const venta = num(v.saleDetails?.price) || num(v.price) || 0;
  const compra = precioCompra > 0 ? precioCompra : 0;
  const gastos = gastosLista.reduce((a, e) => a + num(e.amount), 0);
  const desde = Date.parse(v.receivedAt || v.createdAt || '');
  const hasta = Date.parse(v.soldAt || '');
  const dias = Number.isFinite(desde) && Number.isFinite(hasta) && hasta >= desde ? Math.floor((hasta - desde) / 86_400_000) : null;

  const faltantes: string[] = [];
  if (!consignacion && !(compra > 0)) faltantes.push('precio de compra');
  if (!(venta > 0)) faltantes.push('precio de venta');
  if (dias === null) faltantes.push('fechas de recepción o venta');

  const utilidad = !consignacion && compra > 0 && venta > 0 ? Math.round(venta - compra - gastos) : null;
  return {
    vehicleId: String(v.id || ''),
    titulo: `${v.make} ${v.model} ${v.year}`,
    marca: String(v.make || '').trim(),
    modelo: String(v.model || '').trim(),
    anio: num(v.year),
    km: num(v.km) > 0 ? num(v.km) : null,
    precioCompra: compra > 0 ? compra : null,
    gastos: Math.round(gastos),
    gastosRegistrados: gastosLista.length > 0,
    precioVenta: venta > 0 ? venta : null,
    utilidad,
    margenPct: utilidad !== null && venta > 0 ? Math.round((utilidad / venta) * 1000) / 10 : null,
    diasEnInventario: dias,
    fechaCompra: String(v.receivedAt || v.createdAt || '').slice(0, 10),
    fechaVenta: String(v.soldAt || '').slice(0, 10),
    esConsignacion: consignacion,
    completa: faltantes.length === 0 && !consignacion,
    faltantes,
  };
}

// ---------- Recomendación ----------

const quitarAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const norm = (s: string) => quitarAcentos(String(s || '').toLowerCase()).replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const primera = (s: string) => norm(s).split(' ')[0] || '';

const mediana = (xs: number[]) => {
  const o = xs.filter(Number.isFinite).sort((a, b) => a - b);
  if (!o.length) return null;
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
};
const redondear = (n: number) => Math.round(n / (n < 100_000 ? 500 : 1000)) * (n < 100_000 ? 500 : 1000);
const dinero = (n: number) => '$' + Math.round(n).toLocaleString('es-MX');

export type ConfianzaReco = 'alta' | 'media' | 'baja' | 'ninguna';

export interface Recomendacion {
  precioVentaSugerido: number | null;
  /** De dónde sale: ventas propias, mezcla con el mercado, anuncios del mercado o guía. */
  origenPrecioVenta: 'ventas-propias' | 'ventas-y-mercado' | 'mercado' | 'guia' | 'ninguno';
  maxCompraPorMargen: number | null;
  maxCompraPorGuia: number | null;
  /** El menor de los dos que existan. */
  maxCompraRecomendado: number | null;
  gastosEstimados: number;
  diasEstimados: number | null;
  diasRango: [number, number] | null;
  comercial: Comercialidad | null;
  margenObjetivoPct: number;
  confianza: ConfianzaReco;
  comparables: number;
  advertencias: string[];
  insights: string[];
  comparablesUsados: Operacion[];
}

export function recomendarPrecios(input: {
  marca: string; modelo: string; version?: string; anio: number; km?: number | null;
  operaciones: Operacion[];
  mercado?: PrecioMercado | null;
  /**
   * Guía de Autocosmos, o la que la persona escribió a mano (p. ej. del Libro Azul: `manual`).
   * `ventaMin` = la versión más barata de la guía; sirve de tope prudente cuando no se sabe la versión.
   */
  guia?: { compra: number; venta: number; confianza: string; ventaMin?: number | null; manual?: boolean } | null;
  margenObjetivoPct?: number;
  /** Lo que piden por el auto, si ya hay una oferta sobre la mesa. */
  precioOfrecido?: number | null;
}): Recomendacion {
  const margen = Number.isFinite(input.margenObjetivoPct) && (input.margenObjetivoPct as number) > 0 && (input.margenObjetivoPct as number) < 60
    ? (input.margenObjetivoPct as number) : MARGEN_OBJETIVO_INICIAL_PCT;
  const km = input.km && input.km > 0 ? input.km : null;
  const marca = norm(input.marca), modelo = primera(input.modelo);
  const palabrasVersion = norm(input.version || '').split(' ').filter((p) => p.length > 1);
  const advertencias: string[] = [];

  // Todas las ventas propias completas de ese modelo (año parecido, km parecido).
  const buenas = input.operaciones.filter((o) => o.completa && !o.esConsignacion && o.precioVenta && o.precioCompra);
  let comps = buenas.filter((o) => norm(o.marca) === marca && primera(o.modelo) === modelo && Math.abs(o.anio - input.anio) <= 2);
  if (km) {
    const cercanos = comps.filter((o) => o.km === null || Math.abs(o.km - km) <= KM_PARECIDO);
    if (cercanos.length < comps.length) advertencias.push(`Se dejaron fuera ${comps.length - cercanos.length} ventas de autos con kilometraje muy distinto (más de ${KM_PARECIDO.toLocaleString('es-MX')} km de diferencia).`);
    comps = cercanos;
  }
  // Si dan una versión y alguna venta la menciona, esas pesan primero.
  if (palabrasVersion.length) {
    const mismaVersion = comps.filter((o) => palabrasVersion.every((p) => norm(o.titulo).includes(p)));
    if (mismaVersion.length >= 2) comps = mismaVersion;
  }
  const n = comps.length;
  const confianza: ConfianzaReco = n >= 5 ? 'alta' : n >= 3 ? 'media' : n >= 1 ? 'baja' : 'ninguna';

  const medVenta = mediana(comps.map((o) => o.precioVenta as number));
  const medMercado = input.mercado ? medianaDe(input.mercado) : null;
  const mercadoOk = !!input.mercado && input.mercado.n >= 5;

  // ---- Precio de venta
  let venta: number | null = null;
  let origen: Recomendacion['origenPrecioVenta'] = 'ninguno';
  if (n >= 3 && medVenta) { venta = medVenta; origen = 'ventas-propias'; }
  else if (n >= 1 && medVenta && mercadoOk && medMercado) { venta = (medVenta + medMercado) / 2; origen = 'ventas-y-mercado'; advertencias.push(`Solo hay ${n} venta${n === 1 ? '' : 's'} parecida${n === 1 ? '' : 's'}; el precio mezcla lo que vendiste con los anuncios del mercado.`); }
  else if (n >= 1 && medVenta) { venta = medVenta; origen = 'ventas-propias'; advertencias.push(`Solo hay ${n} venta${n === 1 ? '' : 's'} parecida${n === 1 ? '' : 's'} y no hay consulta de mercado.`); }
  else if (mercadoOk && medMercado) { venta = medMercado; origen = 'mercado'; advertencias.push('No tienes ventas de este modelo. El precio sale de anuncios del mercado: son precios de lista, no de venta, así que lo vendido suele quedar algo abajo.'); }
  else if (input.guia?.venta) { venta = input.guia.venta; origen = 'guia'; advertencias.push('Sin ventas tuyas ni mercado: se usa la guía de venta, que en este mercado suele quedarse corta.'); }
  if (input.mercado && !mercadoOk) advertencias.push(`El mercado tiene solo ${input.mercado.n} anuncios parecidos: no alcanza para fiarse.`);
  if (venta) venta = redondear(venta);

  // ---- Gastos esperados
  const gastosComps = comps.filter((o) => o.gastosRegistrados).map((o) => o.gastos);
  const gastosTodos = buenas.filter((o) => o.gastosRegistrados).map((o) => o.gastos);
  const gastosEst = Math.round(mediana(gastosComps.length ? gastosComps : gastosTodos) ?? 0);
  if (!gastosComps.length) advertencias.push(gastosTodos.length ? 'Los gastos esperados son los de una venta típica de tu agencia, no de este modelo.' : 'No hay gastos capturados en tus ventas: se calculan en cero.');

  // ---- Tiempo de venta y qué tan comercial es
  const diasComps = comps.map((o) => o.diasEnInventario).filter((d): d is number => d !== null);
  const diasTodos = buenas.map((o) => o.diasEnInventario).filter((d): d is number => d !== null);
  const diasFuente = diasComps.length >= 2 ? diasComps : diasTodos;
  const diasEstimados = mediana(diasFuente);
  const q = (xs: number[], p: number) => { const o = [...xs].sort((a, b) => a - b); return o[Math.min(o.length - 1, Math.max(0, Math.round((o.length - 1) * p)))]; };
  const diasRango: [number, number] | null = diasFuente.length >= 3 ? [q(diasFuente, 0.25), q(diasFuente, 0.75)] : null;
  if (diasComps.length < 2) advertencias.push(diasTodos.length ? 'Los días para vender son los de una venta típica de tu agencia: pocas ventas de este modelo.' : 'No hay ventas con fechas para estimar los días.');
  const com = comercialidad({ anuncios: input.mercado?.n, diasPropios: diasComps });

  // ---- Máximo a pagar
  const maxMargen = venta ? Math.max(0, redondear(venta * (1 - margen / 100) - gastosEst)) : null;
  const g = input.guia;
  let maxGuia: number | null = null;
  if (g && g.compra > 0) {
    if (g.confianza === 'alta' || g.confianza === 'media') {
      maxGuia = techoDeCompra({ guiaCompra: g.compra, guiaVenta: g.venta, nivel: com.nivel, confianzaGuia: g.confianza });
      if (g.manual) advertencias.push('El tope de compra usa los precios de guía que escribiste a mano.');
    } else if (g.ventaMin && g.ventaMin > 0) {
      // No se supo qué versión es: nunca se descarta la guía. Se toma la versión más barata como tope.
      maxGuia = Math.round((g.ventaMin * FACTOR_COMPRA) / 500) * 500;
      advertencias.push(`No se pudo saber qué versión es y la guía las tiene muy distintas. Por prudencia el tope usa la versión más barata de la guía (${dinero(maxGuia)}). Escribe la versión para afinarlo.`);
    } else {
      advertencias.push('La guía no es confiable para este auto; el máximo se calcula solo por el margen.');
    }
  }
  if (!g && venta && origen !== 'ventas-propias') {
    advertencias.push('No hay guía para este auto. El máximo sale solo del margen sobre precios de lista del mercado y puede quedar alto: contrástalo con tu Libro Azul (puedes escribirlo para que mande).');
  }
  // Los anuncios son precios de lista y suelen estar muy arriba de la guía: si el precio de venta
  // sale de ellos, el margen daría un máximo inflado. Se avisa para que se mire el tope de la guía.
  if (g && g.venta > 0 && venta && venta > g.venta * 1.15 && origen !== 'ventas-propias') {
    advertencias.push(`El precio de venta sugerido está ${Math.round(((venta - g.venta) / g.venta) * 100)}% arriba de la guía de venta (${dinero(g.venta)}): son precios de lista del mercado. Por eso el máximo a pagar lo limita la guía.`);
  }
  const candidatos = [maxMargen, maxGuia].filter((x): x is number => x !== null && x > 0);
  const maxRecomendado = candidatos.length ? Math.min(...candidatos) : (maxMargen === 0 ? 0 : null);

  // ---- Conclusiones
  const insights: string[] = [];
  if (n === 0) insights.push('Tu agencia no tiene ventas completas de este modelo; la recomendación se apoya en el mercado y la guía y es poco segura.');
  else insights.push(`Se usaron ${n} venta${n === 1 ? '' : 's'} parecida${n === 1 ? '' : 's'} de tu agencia (confianza ${confianza}).`);
  if (venta) insights.push(`Precio de venta sugerido: ${dinero(venta)} (${origen === 'ventas-propias' ? 'mediana de lo que vendiste' : origen === 'ventas-y-mercado' ? 'mezcla de tus ventas y el mercado' : origen === 'mercado' ? 'mediana de anuncios del mercado' : 'guía de venta'}).`);
  if (maxRecomendado !== null) {
    const razon = maxGuia !== null && maxMargen !== null ? (maxGuia <= maxMargen ? 'lo limita la guía' : 'lo limita el margen') : maxMargen !== null ? 'por el margen' : 'por la guía';
    insights.push(`Máximo a pagar: ${dinero(maxRecomendado)} (${razon}; margen objetivo ${margen}% y gastos esperados ${dinero(gastosEst)}).`);
    if (maxMargen !== null && maxGuia !== null && Math.abs(maxMargen - maxGuia) / Math.max(maxMargen, maxGuia) > 0.1) {
      insights.push(`El margen permite hasta ${dinero(maxMargen)} y la guía, según qué tan comercial es el auto (${com.nivel === 'alta' ? 'muy' : com.nivel === 'media' ? 'medio' : 'poco'}), ${dinero(maxGuia)}. Gana el menor.`);
    }
  }
  if (diasEstimados !== null) insights.push(`Tiempo estimado de venta: ${Math.round(diasEstimados)} días${diasRango ? ` (lo normal: entre ${diasRango[0]} y ${diasRango[1]})` : ''}.`);
  if (input.precioOfrecido && maxRecomendado) {
    const dif = input.precioOfrecido - maxRecomendado;
    insights.push(dif <= 0 ? `Lo que piden (${dinero(input.precioOfrecido)}) está dentro del máximo.` : `Lo que piden (${dinero(input.precioOfrecido)}) pasa del máximo por ${dinero(dif)}: conviene negociar o dejarlo pasar.`);
  }

  return {
    precioVentaSugerido: venta, origenPrecioVenta: origen,
    maxCompraPorMargen: maxMargen, maxCompraPorGuia: maxGuia, maxCompraRecomendado: maxRecomendado,
    gastosEstimados: gastosEst, diasEstimados: diasEstimados === null ? null : Math.round(diasEstimados), diasRango,
    comercial: com.nivel, margenObjetivoPct: margen, confianza, comparables: n, advertencias, insights,
    comparablesUsados: comps.slice(0, 10),
  };
}
