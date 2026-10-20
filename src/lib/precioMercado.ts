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

async function anunciosDeMercadoLibre(marca: string, modelo: string, anio: number | string): Promise<{ precio: number; link: string }[]> {
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
      .map((x) => ({ precio: Number(x?.precio) || 0, link: String(x?.link || '') }));
  } finally {
    clearTimeout(t);
  }
}

/**
 * Busca con el modelo completo («X1 118iA Exclusive») y, si salen pocos
 * anuncios, con solo la primera palabra («X1»).
 */
export async function consultarMercado(marca: string, modelo: string, anio: number | string, opciones?: { edades?: boolean }): Promise<PrecioMercado | null> {
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
  const resumen = resumirPrecios(anuncios.map((a) => a.precio), consulta);
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
