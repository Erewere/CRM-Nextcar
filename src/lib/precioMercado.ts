/**
 * Precio de mercado de un auto, a partir de los anuncios de Mercado Libre.
 *
 * Los anuncios los lee la página Nextcar (api/search-cars.php). Esa consulta
 * mezcla además los autos de la propia página: esos se quitan aquí, porque
 * compararías tu auto consigo mismo.
 *
 * Solo viaja marca, modelo y año: ningún dato de clientes y ninguna IA, como
 * promete el aviso de privacidad del CRM.
 *
 * Se calcula en el servidor una vez por semana por auto (es lenta, ~10 s) y se
 * guarda en `mercadoAutos/{vehicleId}`, que solo lee el servidor.
 */

import { PCT_POR_MIL_KM } from './kilometraje';

export const URL_MERCADO = 'https://www.nextcar.erewere.com/api/search-cars.php';
export const MINIMO_ANUNCIOS = 5;

export interface PrecioMercado {
  n: number;
  minimo: number;
  maximo: number;
  promedio: number;
  /** Precio de en medio. Los análisis viejos no lo traen: usa `medianaDe(m)`. */
  mediana?: number;
  /** Cortes de las franjas: hasta p33 excelente, hasta p66 bueno, hasta p90 justo. */
  p33: number;
  p66: number;
  p90: number;
  /** Lo que se buscó, por si hubo que quitar la versión del modelo. */
  consulta: string;
  fecha: string;
  /** Cuánto llevan publicados los anuncios (solo si se pidió y se pudieron leer al menos 5). */
  edad?: EdadMercado | null;
  /** Si los precios se llevaron al kilometraje del auto consultado: de cuánto a cuánto y con qué regla. */
  kmAjuste?: AjusteKmMercado | null;
}

export interface AjusteKmMercado {
  /** El kilometraje del auto consultado, al que se llevaron los anuncios. */
  kmObjetivo: number;
  /** El kilometraje típico de los anuncios (mediana de los que lo traen). */
  kmAnuncios: number;
  anunciosConKm: number;
  /** Cuánto baja el precio por cada 1,000 km de más, en %. */
  porMilKm: number;
  origen: 'anuncios' | 'tipico';
  /** La mediana antes de ajustar. */
  medianaSinAjuste: number;
}

/** Días que llevan publicados los anuncios que siguen a la venta, en días. */
export interface EdadMercado {
  /** Cuántos anuncios se pudieron leer. */
  n: number;
  mediana: number;
  p25: number;
  p75: number;
}

const percentil = (ordenados: number[], p: number) => {
  if (!ordenados.length) return 0;
  const i = (ordenados.length - 1) * p;
  const lo = Math.floor(i), hi = Math.ceil(i);
  return Math.round(ordenados[lo] + (ordenados[hi] - ordenados[lo]) * (i - lo));
};


const medianaDe_ = (xs: number[]) => {
  const o = [...xs].sort((a, b) => a - b);
  if (!o.length) return 0;
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
};

/**
 * Lleva el precio de cada anuncio al kilometraje del auto consultado. Un anuncio con 40,000 km de más barato que el
 * tuyo vale más que el tuyo, y uno con 120,000 vale menos. Cuánto baja el precio por kilómetro se mide en los propios
 * anuncios (pendiente robusta de Theil-Sen) si hay al menos 8 con kilometraje; si no, se usa la regla fija.
 */
export function ajustarPorKm(
  anuncios: { precio: number; km: number | null }[],
  kmObjetivo: number | null | undefined,
): { precios: number[]; info: AjusteKmMercado | null } {
  const validos = anuncios.filter((a) => a.precio > 10000);
  const sinAjuste = { precios: validos.map((a) => a.precio), info: null as AjusteKmMercado | null };
  if (!kmObjetivo || !(kmObjetivo > 0)) return sinAjuste;
  const conKm = validos.filter((a) => a.km !== null && a.km > 0 && a.km < 500_000);
  if (conKm.length < 3) return sinAjuste;
  const kmAnuncios = Math.round(medianaDe_(conKm.map((a) => a.km as number)));
  const medianaSinAjuste = Math.round(medianaDe_(validos.map((a) => a.precio)));

  let porMilKm = PCT_POR_MIL_KM;
  let origen: AjusteKmMercado['origen'] = 'tipico';
  if (conKm.length >= 8) {
    const pendientes: number[] = [];
    for (let i = 0; i < conKm.length; i++) for (let j = i + 1; j < conKm.length; j++) {
      const dk = (conKm[j].km as number) - (conKm[i].km as number);
      if (Math.abs(dk) >= 5000) pendientes.push((conKm[j].precio - conKm[i].precio) / dk);
    }
    if (pendientes.length >= 10) {
      const pct = (-medianaDe_(pendientes) * 1000 / medianaSinAjuste) * 100;
      // Menos de 0.1 % por cada 1,000 km se toma como 0.1: los km sí cuentan. Más de 1 % son anuncios revueltos
      // (versiones, golpes), no el efecto de los km, y se usa la regla de respaldo.
      if (Number.isFinite(pct) && pct > 0 && pct <= 1) { porMilKm = Math.round(Math.max(0.1, pct) * 100) / 100; origen = 'anuncios'; }
    }
  }
  const precios = validos.map((a) => {
    const km = a.km !== null && a.km > 0 && a.km < 500_000 ? a.km : kmAnuncios;
    const f = Math.min(1.3, Math.max(0.7, 1 - (porMilKm / 100) * ((kmObjetivo - km) / 1000)));
    return Math.round(a.precio * f);
  });
  return { precios, info: { kmObjetivo: Math.round(kmObjetivo), kmAnuncios, anunciosConKm: conKm.length, porMilKm, origen, medianaSinAjuste } };
}

/** Estadísticas de una lista de precios; null si no hay ninguno. */
export function resumirPrecios(precios: number[], consulta: string, fecha = new Date().toISOString()): PrecioMercado | null {
  const ps = precios.filter((p) => Number.isFinite(p) && p > 10000).sort((a, b) => a - b);
  if (!ps.length) return null;
  return {
    n: ps.length,
    minimo: ps[0],
    maximo: ps[ps.length - 1],
    promedio: Math.round(ps.reduce((a, b) => a + b, 0) / ps.length),
    mediana: percentil(ps, 0.5),
    p33: percentil(ps, 0.33),
    p66: percentil(ps, 0.66),
    p90: percentil(ps, 0.9),
    consulta,
    fecha,
  };
}

/** «18 días», «3 meses», «5 horas»: lo que dice Mercado Libre, en días. */
export function diasDeTexto(texto: string): number | null {
  const m = /(\d+)\s*(hora|d[ií]a|semana|mes|a[ñn]o)/i.exec(texto || '');
  if (!m) return null;
  const n = Number(m[1]);
  const u = m[2].toLowerCase();
  if (u.startsWith('hora')) return 0;
  if (u.startsWith('d')) return n;
  if (u.startsWith('semana')) return n * 7;
  if (u.startsWith('mes')) return n * 30;
  return n * 365;
}

const CABECERAS_ML = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept-Language': 'es-MX,es;q=0.9',
};

/** «Publicado hace X» de un anuncio; null si no se pudo leer. Solo viaja la dirección pública del anuncio. */
async function edadDeUnAnuncio(url: string): Promise<number | null> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 12000);
  try {
    const r = await fetch(url, { headers: CABECERAS_ML, signal: ctl.signal });
    if (!r.ok) return null;
    const html = await r.text();
    const m = /Publicado hace\s+([^<"]{1,25})/.exec(html);
    return m ? diasDeTexto(m[1]) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Cuánto llevan publicados los anuncios de Mercado Libre de este auto. La edad solo sale en la página de
 * cada anuncio, así que se leen hasta 14, repartidos entre los más baratos y los más caros (la lista viene
 * ordenada por precio). Menos de 5 lecturas no alcanzan para decir nada.
 */
export async function edadDeAnuncios(links: string[], maximo = 14): Promise<EdadMercado | null> {
  const validos = [...new Set(links.filter((l) => /^https:\/\/(auto|articulo)\.mercadolibre\.com\.mx\/MLM-/.test(String(l || ''))))];
  if (validos.length < 5) return null;
  const paso = validos.length / Math.min(maximo, validos.length);
  const muestra = Array.from({ length: Math.min(maximo, validos.length) }, (_, i) => validos[Math.floor(i * paso)]);
  const edades: number[] = [];
  let siguiente = 0;
  await Promise.all(Array.from({ length: 5 }, async () => {
    while (siguiente < muestra.length) {
      const e = await edadDeUnAnuncio(muestra[siguiente++]);
      if (e !== null) edades.push(e);
    }
  }));
  if (edades.length < 5) return null;
  edades.sort((a, b) => a - b);
  return { n: edades.length, mediana: percentil(edades, 0.5), p25: percentil(edades, 0.25), p75: percentil(edades, 0.75) };
}

async function anunciosDeMercadoLibre(marca: string, modelo: string, anio: number | string): Promise<{ precio: number; link: string; km: number | null }[]> {
  const qs = new URLSearchParams({ marca, modelo, anio: String(anio || '') });
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 45000);
  try {
    const r = await fetch(`${URL_MERCADO}?${qs}`, { signal: ctl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d: any = await r.json();
    const lista: any[] = Array.isArray(d?.resultados) ? d.resultados : [];
    return lista
      .filter((x) => !String(x?.id || '').startsWith('NEXTCAR-'))
      .filter((x) => !anio || !x?.['año'] || Number(x['año']) === Number(anio))
      .map((x) => ({ precio: Number(x?.precio) || 0, link: String(x?.link || ''), km: Number(x?.kilometraje) > 0 ? Number(x.kilometraje) : null }));
  } finally {
    clearTimeout(t);
  }
}

/**
 * Busca con el modelo completo («X1 118iA Exclusive») y, si salen pocos
 * anuncios, con solo la primera palabra («X1»).
 */
export async function consultarMercado(marca: string, modelo: string, anio: number | string, opciones?: { edades?: boolean; km?: number | null }): Promise<PrecioMercado | null> {
  const completo = String(modelo || '').trim();
  const corto = completo.split(/\s+/)[0] || completo;
  let anuncios = await anunciosDeMercadoLibre(marca, completo, anio);
  let consulta = `${marca} ${completo} ${anio}`.trim();
  if (anuncios.length < MINIMO_ANUNCIOS && corto && corto !== completo) {
    const otros = await anunciosDeMercadoLibre(marca, corto, anio);
    if (otros.length > anuncios.length) {
      anuncios = otros;
      consulta = `${marca} ${corto} ${anio}`.trim();
    }
  }
  // Si se dio el kilometraje del auto, los anuncios se llevan a ese kilometraje antes de sacar la mediana.
  const ajustado = ajustarPorKm(anuncios, opciones?.km);
  const resumen = resumirPrecios(ajustado.precios, consulta);
  if (resumen && ajustado.info) resumen.kmAjuste = ajustado.info;
  // La edad de los anuncios tarda unos segundos más: solo se pide donde se va a usar (recomendar precio).
  if (resumen && opciones?.edades) {
    try {
      resumen.edad = await edadDeAnuncios(anuncios.filter((a) => a.precio > 10000).map((a) => a.link));
    } catch (e) {
      console.warn('Edad de anuncios de Mercado Libre:', (e as Error)?.message || e);
      resumen.edad = null;
    }
  }
  return resumen;
}

/** Mediana del mercado; en consultas guardadas antes de que existiera, se usa el promedio. */
export const medianaDe = (m: Pick<PrecioMercado, 'promedio' | 'mediana'>) => m.mediana || m.promedio;

export type FranjaPrecio = 'excelente' | 'bueno' | 'justo' | 'arriba';

/** Dónde cae un precio contra el mercado. */
export function franjaDelPrecio(precio: number, m: Pick<PrecioMercado, 'p33' | 'p66' | 'p90'>): FranjaPrecio {
  if (precio <= m.p33) return 'excelente';
  if (precio <= m.p66) return 'bueno';
  if (precio <= m.p90) return 'justo';
  return 'arriba';
}
