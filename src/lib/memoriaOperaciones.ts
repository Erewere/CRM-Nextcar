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
 *  - (18 oct, ajustado) La referencia es el MERCADO: precio esperado = mediana del precio
 *    comercial; precio pesimista = cerca del mínimo del mercado, para el auto que no es muy
 *    comercial. NO se usa la guía de venta (aquí se vende casi siempre arriba de ella).
 *  - La utilidad ya no decide el precio: se informa (cuánto dejaría al esperado y al
 *    pesimista). El margen de la agencia solo sirve para avisar si queda corto.
 *  - El máximo a pagar es el MENOR entre el tope de la guía según qué tan comercial es el
 *    auto (`techoDeCompra`, tu regla) y lo que recuperarías en el peor caso menos gastos.
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
  /** Precio de venta esperado = la mediana del precio comercial (mercado). Alias de `precioVentaEsperado`. */
  precioVentaSugerido: number | null;
  precioVentaEsperado: number | null;
  /** Peor caso razonable si el auto no es muy comercial: cerca del mínimo del mercado. */
  precioVentaPesimista: number | null;
  /** De dónde sale: mercado, ventas propias o guía. */
  origenPrecioVenta: 'mercado' | 'ventas-propias' | 'guia' | 'ninguno';
  /** Lo que recuperarías en el peor caso, menos gastos. */
  maxCompraPorPesimista: number | null;
  maxCompraPorGuia: number | null;
  /** El menor de los dos que existan. */
  maxCompraRecomendado: number | null;
  gastosEstimados: number;
  /** Informativas: lo que dejaría comprar al máximo recomendado, vendiendo al precio esperado o al pesimista. */
  utilidadEsperada: number | null;
  utilidadPesimista: number | null;
  margenEsperadoPct: number | null;
  margenPesimistaPct: number | null;
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

/** El mínimo del mercado a veces es un caso raro (otra versión, un golpe). No se baja de este porcentaje de la mediana. */
export const PISO_PESIMISTA = 0.75;

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

  // ---- Precio de venta: el mercado manda (Luis, 18 oct 2026)
  // Esperado = mediana del precio comercial. Pesimista = cerca del mínimo del mercado, para cuando
  // el auto no es muy comercial. La utilidad ya no decide nada: se informa al final.
  const g = input.guia;
  let esperado: number | null = null;
  let pesimista: number | null = null;
  let origen: Recomendacion['origenPrecioVenta'] = 'ninguno';
  if (mercadoOk && medMercado && input.mercado) {
    esperado = medMercado; origen = 'mercado';
    const piso = medMercado * PISO_PESIMISTA;
    pesimista = Math.max(input.mercado.minimo, piso);
    if (input.mercado.minimo < piso) advertencias.push(`El anuncio más barato del mercado (${dinero(input.mercado.minimo)}) es muy bajo contra la mediana y parece un caso raro (otra versión o un auto golpeado); el peor caso se puso en ${dinero(pesimista)}.`);
    advertencias.push('Los anuncios del mercado son precios de lista: lo que se cierra suele quedar algo abajo.');
    if (n >= 3 && medVenta && Math.abs(medVenta - esperado) / esperado > 0.15) {
      advertencias.push(`Tus ${n} ventas parecidas se cerraron en una mediana de ${dinero(medVenta)}, ${medVenta < esperado ? 'abajo' : 'arriba'} de la mediana del mercado (${dinero(esperado)}). Considera tu propia experiencia.`);
    }
  } else if (n >= 1 && medVenta) {
    esperado = medVenta; origen = 'ventas-propias';
    const ventas = comps.map((o) => o.precioVenta as number);
    pesimista = n >= 2 ? Math.min(...ventas) : medVenta;
    advertencias.push(`No hay mercado suficiente: el precio sale de ${n} venta${n === 1 ? '' : 's'} tuya${n === 1 ? '' : 's'} parecida${n === 1 ? '' : 's'}${n === 1 ? ' y no hay forma de calcular un peor caso' : ''}.`);
  } else if (g?.venta) {
    esperado = g.venta; origen = 'guia';
    pesimista = g.ventaMin && g.ventaMin > 0 ? Math.min(g.ventaMin, g.venta) : g.venta;
    advertencias.push('Sin mercado ni ventas tuyas: el precio sale de la guía de venta, que en este mercado suele quedarse corta.');
  }
  if (input.mercado && !mercadoOk) advertencias.push(`El mercado tiene solo ${input.mercado.n} anuncios parecidos: no alcanza para fiarse.`);
  if (esperado) esperado = redondear(esperado);
  if (pesimista) pesimista = redondear(Math.min(pesimista, esperado ?? pesimista));

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

  // ---- Máximo a pagar: el menor entre la guía (tu regla) y lo que recuperarías en el peor caso
  const maxPesimista = pesimista ? Math.max(0, redondear(pesimista - gastosEst)) : null;
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
      advertencias.push('La guía no es confiable para este auto; el máximo se calcula solo con el peor caso de venta.');
    }
  } else if (!g) {
    advertencias.push('No hay guía para este auto: el máximo sale solo del peor caso de venta. Contrástalo con tu Libro Azul (puedes escribirlo para que mande).');
  }
  if (g && g.venta > 0 && esperado && esperado > g.venta * 1.15 && origen === 'mercado') {
    advertencias.push(`El precio esperado está ${Math.round(((esperado - g.venta) / g.venta) * 100)}% arriba de la guía de venta (${dinero(g.venta)}): son precios de lista. Para comprar manda la guía.`);
  }
  const candidatos = [maxGuia, maxPesimista].filter((x): x is number => x !== null && x > 0);
  const maxRecomendado = candidatos.length ? Math.min(...candidatos) : null;

  // ---- Lo que dejaría (informativo)
  const utilEsp = esperado !== null && maxRecomendado !== null ? esperado - maxRecomendado - gastosEst : null;
  const utilPes = pesimista !== null && maxRecomendado !== null ? pesimista - maxRecomendado - gastosEst : null;
  const margenEsp = utilEsp !== null && esperado ? Math.round((utilEsp / esperado) * 1000) / 10 : null;
  const margenPes = utilPes !== null && pesimista ? Math.round((utilPes / pesimista) * 1000) / 10 : null;
  if (margenEsp !== null && margenEsp < margen) advertencias.push(`Comprando al máximo, la ganancia esperada (${margenEsp}%) queda debajo de tu margen de referencia (${margen}%).`);

  // ---- Conclusiones
  const insights: string[] = [];
  if (n === 0) insights.push('Tu agencia no tiene ventas completas de este modelo; la recomendación se apoya en el mercado y la guía y es poco segura.');
  else insights.push(`Se usaron ${n} venta${n === 1 ? '' : 's'} parecida${n === 1 ? '' : 's'} de tu agencia (confianza ${confianza}).`);
  if (esperado) {
    const de = origen === 'mercado' ? `mediana de ${input.mercado?.n} anuncios del mercado` : origen === 'ventas-propias' ? 'mediana de lo que vendiste' : 'guía de venta';
    insights.push(`Precio de venta esperado: ${dinero(esperado)} (${de}).`);
  }
  if (pesimista && esperado) {
    insights.push(`Peor caso, si el auto no es muy comercial: ${dinero(pesimista)} (cerca del mínimo del mercado). ${com.nivel === 'alta' ? 'Como en tus ventas sale rápido, el esperado es lo normal.' : 'Sin ventas tuyas rápidas de este modelo, conviene planear con este precio.'}`);
  }
  if (maxRecomendado !== null) {
    const razon = maxGuia !== null && maxPesimista !== null ? (maxGuia <= maxPesimista ? 'lo limita la guía' : 'lo limita el peor caso de venta') : maxGuia !== null ? 'por la guía' : 'por el peor caso de venta';
    insights.push(`Máximo a pagar: ${dinero(maxRecomendado)} (${razon}).`);
    if (maxGuia !== null && maxPesimista !== null && Math.abs(maxGuia - maxPesimista) / Math.max(maxGuia, maxPesimista) > 0.1) {
      insights.push(`La guía permite hasta ${dinero(maxGuia)} y el peor caso de venta, ${dinero(maxPesimista)} (ya sin gastos de ${dinero(gastosEst)}). Gana el menor.`);
    }
    if (utilEsp !== null && utilPes !== null) insights.push(`Comprando a ${dinero(maxRecomendado)}: ganarías ${dinero(utilEsp)} (${margenEsp}%) si se vende al precio esperado y ${utilPes >= 0 ? `ganarías ${dinero(utilPes)}` : `perderías ${dinero(-utilPes)}`} (${margenPes}%) en el peor caso.`);
  }
  if (diasEstimados !== null) insights.push(`Tiempo estimado de venta: ${Math.round(diasEstimados)} días${diasRango ? ` (lo normal: entre ${diasRango[0]} y ${diasRango[1]})` : ''}.`);
  if (input.precioOfrecido && maxRecomendado) {
    const dif = input.precioOfrecido - maxRecomendado;
    insights.push(dif <= 0 ? `Lo que piden (${dinero(input.precioOfrecido)}) está dentro del máximo.` : `Lo que piden (${dinero(input.precioOfrecido)}) pasa del máximo por ${dinero(dif)}: conviene negociar o dejarlo pasar.`);
  }

  return {
    precioVentaSugerido: esperado, precioVentaEsperado: esperado, precioVentaPesimista: pesimista, origenPrecioVenta: origen,
    maxCompraPorPesimista: maxPesimista, maxCompraPorGuia: maxGuia, maxCompraRecomendado: maxRecomendado,
    gastosEstimados: gastosEst, utilidadEsperada: utilEsp, utilidadPesimista: utilPes, margenEsperadoPct: margenEsp, margenPesimistaPct: margenPes,
    diasEstimados: diasEstimados === null ? null : Math.round(diasEstimados), diasRango,
    comercial: com.nivel, margenObjetivoPct: margen, confianza, comparables: n, advertencias, insights,
    comparablesUsados: comps.slice(0, 10),
  };
}
