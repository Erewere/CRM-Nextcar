/**
 * Cuánto vale de menos un auto por tener más kilómetros.
 *
 * La guía de Autocosmos, al pedirle el precio con un kilometraje, contesta AL REVÉS: en Versa 2020, Jetta 2019 y
 * HB20 2023 (oct 2026) el precio sube entre 4 y 8 % cuando el auto pasa de 10,000 a 140,000 km. Por eso el
 * kilometraje ya no se le manda a la guía para que lo descuente: se le pide el precio a un kilometraje típico de la
 * edad del auto (lo que mide ±5 % contra el Libro Azul) y el descuento por kilómetros se hace aquí.
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
