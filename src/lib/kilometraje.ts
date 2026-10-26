/**
 * Cuánto vale de menos un auto por tener más kilómetros.
 *
 * La guía de Autocosmos se muestra TAL CUAL la da su página con el kilometraje del auto (así coincide con lo que se ve
 * en autocosmos.com.mx/PriceGuide). Pero esa guía NO baja el precio cuando el auto tiene más kilómetros: en Versa 2020,
 * Jetta 2019 y HB20 2023 (oct 2026) sube entre 4 y 8 % al pasar de 10,000 a 140,000 km, al revés de lo que se ve en
 * los anuncios de Mercado Libre. Por eso el descuento por kilómetros no se espera de la guía: se aplica aparte, al
 * «pagar como máximo», y solo hacia abajo (un auto con pocos km no sube el máximo: es lo prudente al comprar).
 */

/** Kilómetros que recorre un auto al año, en promedio (lo mismo que estima la página Nextcar). */
export const KM_POR_ANIO = 15_000;
/**
 * Lo que baja el precio por cada 1,000 km por encima (o sube por debajo) de lo normal, en %. Es la regla de respaldo:
 * cuando hay al menos 8 anuncios con kilometraje se mide en ellos (precioMercado.ts) y esa medida manda.
 * Medido en Mercado Libre (oct 2026, 5 modelos, 37 a 48 anuncios cada uno): entre 0.08 y 0.18 % por cada 1,000 km.
 * Son precios de lista, así que el descuento real al cerrar suele ser algo mayor: de ahí el 0.2 %.
 */
export const PCT_POR_MIL_KM = 0.2;
/** El ajuste nunca pasa de aquí: ni se castiga un auto de más de la tercera parte, ni se premia de más. */
const FACTOR_MINIMO = 0.65;
const FACTOR_MAXIMO = 1.15;

/** Kilometraje normal para un auto de ese año. */
export function kmTipico(anio: number | string, hoy = new Date()): number {
  const edad = Math.max(1, hoy.getFullYear() - Number(anio));
  return Math.min(200_000, edad * KM_POR_ANIO);
}

/** Por cuánto se multiplica el precio de un auto de `kmReferencia` para dejarlo a `km`. */
export function factorPorKm(km: number, kmReferencia: number, pctPorMilKm = PCT_POR_MIL_KM): number {
  const f = 1 - (pctPorMilKm / 100) * ((km - kmReferencia) / 1000);
  return Math.min(FACTOR_MAXIMO, Math.max(FACTOR_MINIMO, f));
}

/** Menos de esta diferencia no se ajusta: es ruido. */
export const DIFERENCIA_MINIMA_KM = 2_000;
