/**
 * Revisión de precio de venta de un auto del inventario.
 *
 * Compara lo que pides contra lo que cuestan autos parecidos en Mercado Libre
 * (datos que ya trae `precioMercado.ts`) y contra los días que lleva parado.
 * Son reglas simples y con razón escrita: ninguna IA, a propósito (el aviso de
 * privacidad del CRM promete que nada sale a una IA), y cada sugerencia dice
 * por qué.
 *
 * Reglas, en este orden:
 *  1. Menos de 5 anuncios comparables -> «sin datos»: no se sugiere nada.
 *  2. BAJAR si el precio está por encima de lo normal del mercado (arriba del
 *     corte p66) y el auto ya lleva tiempo parado, o si está muy arriba (p90).
 *       - muy arriba (sobre p90): baja a la franja «buena» (p66), o a la
 *         mediana si ya lleva 60 días o más;
 *       - arriba pero no tanto: baja a 3 % sobre la mediana.
 *  3. SUBIR si está entre lo más barato del mercado (bajo p33), lleva poco
 *     tiempo en inventario (30 días o menos) y la subida sería de 3 % o más:
 *     sube a 3 % bajo la mediana, que sigue siendo buen precio.
 *  4. En cualquier otro caso, MANTENER.
 */

import { MINIMO_ANUNCIOS, medianaDe, type PrecioMercado } from './precioMercado';

export type Sugerencia = 'mantener' | 'bajar' | 'subir' | 'sin-datos';
export type ConfianzaAnalisis = 'alta' | 'media' | 'baja' | 'ninguna';

export const DIAS_PARADO = 45;
export const DIAS_MUY_PARADO = 60;
export const DIAS_NUEVO = 30;

export interface ResultadoAnalisis {
  sugerencia: Sugerencia;
  /** Precio que se propone; igual al actual cuando se mantiene o no hay datos. */
  precioSugerido: number;
  /** Por qué, en una o dos frases para quien vende. */
  razon: string;
  confianza: ConfianzaAnalisis;
  /** Cuánto está el precio por encima (+) o por debajo (−) de la mediana, en %. */
  diferenciaVsMedianaPct: number | null;
}

/** Redondea al medio millar más cercano (autos baratos) o al millar (el resto). */
export function redondearPrecio(n: number): number {
  const paso = n < 100_000 ? 500 : 1000;
  return Math.round(n / paso) * paso;
}

const dinero = (n: number) => '$' + Math.round(n).toLocaleString('es-MX');

export function confianzaPorComparables(n: number): ConfianzaAnalisis {
  if (n >= 15) return 'alta';
  if (n >= 8) return 'media';
  if (n >= MINIMO_ANUNCIOS) return 'baja';
  return 'ninguna';
}

export function analizarPrecio(input: {
  precio: number;
  mercado: PrecioMercado | null | undefined;
  /** Días desde que se recibió el auto; null si no se sabe. */
  dias: number | null;
}): ResultadoAnalisis {
  const { precio, mercado, dias } = input;
  const sinDatos = (razon: string): ResultadoAnalisis => ({ sugerencia: 'sin-datos', precioSugerido: precio, razon, confianza: 'ninguna', diferenciaVsMedianaPct: null });

  if (!(precio > 0)) return sinDatos('El auto no tiene precio de venta capturado.');
  if (!mercado) return sinDatos('Todavía no hay consulta de mercado para este auto.');
  if (mercado.n < MINIMO_ANUNCIOS) {
    return sinDatos(`Solo hay ${mercado.n} anuncio${mercado.n === 1 ? '' : 's'} parecido${mercado.n === 1 ? '' : 's'}; hacen falta al menos ${MINIMO_ANUNCIOS} para opinar.`);
  }

  const mediana = medianaDe(mercado);
  const dif = Math.round(((precio - mediana) / mediana) * 1000) / 10;
  const confianza = confianzaPorComparables(mercado.n);
  const dd = dias ?? 0;
  const parado = dias === null ? '' : ` y lleva ${dias} día${dias === 1 ? '' : 's'} en inventario`;
  const base = { confianza, diferenciaVsMedianaPct: dif };

  // 2. Bajar
  if (precio > mercado.p90 || (precio > mercado.p66 && dd >= DIAS_PARADO)) {
    const muyArriba = precio > mercado.p90;
    const objetivo = muyArriba ? (dd >= DIAS_MUY_PARADO ? mediana : mercado.p66) : mediana * 1.03;
    const sugerido = redondearPrecio(Math.min(objetivo, precio));
    if (sugerido < precio) {
      return {
        ...base,
        sugerencia: 'bajar',
        precioSugerido: sugerido,
        razon: muyArriba
          ? `Está ${dif}% arriba de la mediana del mercado (${dinero(mediana)}), por encima de casi todos los anuncios parecidos${parado}. Bajarlo a ${dinero(sugerido)} lo deja en un precio competitivo.`
          : `Está ${dif}% arriba de la mediana (${dinero(mediana)})${parado}. Un ajuste a ${dinero(sugerido)} lo acerca al mercado.`,
      };
    }
  }

  // 3. Subir
  if (precio <= mercado.p33 && dd <= DIAS_NUEVO) {
    const sugerido = redondearPrecio(mediana * 0.97);
    if (sugerido >= precio * 1.03) {
      return {
        ...base,
        sugerencia: 'subir',
        precioSugerido: sugerido,
        razon: `Está ${Math.abs(dif)}% por debajo de la mediana (${dinero(mediana)}), entre los más baratos del mercado${parado}. Podrías subirlo a ${dinero(sugerido)} y seguir siendo buen precio.`,
      };
    }
  }

  // 4. Mantener
  const lugar = precio <= mercado.p33 ? 'entre los más baratos' : precio <= mercado.p66 ? 'en una franja buena' : 'en el límite alto';
  const cierre = precio > mercado.p66
    ? `Por ahora se mantiene; si llega a ${DIAS_PARADO} días sin moverse, conviene bajarlo.`
    : 'No hace falta moverlo.';
  return {
    ...base,
    sugerencia: 'mantener',
    precioSugerido: precio,
    razon: `Está ${lugar} contra ${mercado.n} anuncios parecidos (mediana ${dinero(mediana)}, ${dif >= 0 ? '+' : ''}${dif}%)${parado}. ${cierre}`,
  };
}
