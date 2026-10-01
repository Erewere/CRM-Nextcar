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
  /** Cortes de las franjas: hasta p33 excelente, hasta p66 bueno, hasta p90 justo. */
  p33: number;
  p66: number;
  p90: number;
  /** Lo que se buscó, por si hubo que quitar la versión del modelo. */
  consulta: string;
  fecha: string;
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
    p33: percentil(ps, 0.33),
    p66: percentil(ps, 0.66),
    p90: percentil(ps, 0.9),
    consulta,
    fecha,
  };
}

async function preciosDeMercadoLibre(marca: string, modelo: string, anio: number | string): Promise<number[]> {
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
      .map((x) => Number(x?.precio) || 0);
  } finally {
    clearTimeout(t);
  }
}

/**
 * Busca con el modelo completo («X1 118iA Exclusive») y, si salen pocos
 * anuncios, con solo la primera palabra («X1»).
 */
export async function consultarMercado(marca: string, modelo: string, anio: number | string): Promise<PrecioMercado | null> {
  const completo = String(modelo || '').trim();
  const corto = completo.split(/\s+/)[0] || completo;
  let precios = await preciosDeMercadoLibre(marca, completo, anio);
  let consulta = `${marca} ${completo} ${anio}`.trim();
  if (precios.length < MINIMO_ANUNCIOS && corto && corto !== completo) {
    const otros = await preciosDeMercadoLibre(marca, corto, anio);
    if (otros.length > precios.length) {
      precios = otros;
      consulta = `${marca} ${corto} ${anio}`.trim();
    }
  }
  return resumirPrecios(precios, consulta);
}

export type FranjaPrecio = 'excelente' | 'bueno' | 'justo' | 'arriba';

/** Dónde cae un precio contra el mercado. */
export function franjaDelPrecio(precio: number, m: Pick<PrecioMercado, 'p33' | 'p66' | 'p90'>): FranjaPrecio {
  if (precio <= m.p33) return 'excelente';
  if (precio <= m.p66) return 'bueno';
  if (precio <= m.p90) return 'justo';
  return 'arriba';
}
