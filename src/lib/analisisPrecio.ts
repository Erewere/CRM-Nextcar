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
 *  1b. Más de 30 % de diferencia contra la mediana (para arriba o para abajo)
 *     -> «revisar»: casi siempre es otra versión, no un mal precio.
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

/** Sube cuando cambian las reglas: la revisión programada se repite sola en cuanto estrena versión. */
export const VERSION_REGLAS = 5;

/** `revisar` = el precio está tan lejos del mercado que probablemente no sean comparables. */
export type Sugerencia = 'mantener' | 'bajar' | 'subir' | 'revisar' | 'sin-datos';
export type ConfianzaAnalisis = 'alta' | 'media' | 'baja' | 'ninguna';

export const DIAS_PARADO = 45;
export const DIAS_MUY_PARADO = 60;
export const DIAS_NUEVO = 30;
/**
 * El mercado se busca por marca, modelo y año, sin versión ni kilometraje. Un
 * auto muy equipado (un Mini JCW contra los Cooper básicos) sale «carísimo» sin
 * serlo. Pasado este porcentaje de diferencia no se sugiere un precio: se pide
 * revisar que de verdad sean comparables.
 */
export const DIFERENCIA_SOSPECHOSA_PCT = 30;

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

  // 1b. Demasiado lejos para fiarse de la comparación
  if (Math.abs(dif) > DIFERENCIA_SOSPECHOSA_PCT) {
    return {
      ...base,
      confianza: 'baja',
      sugerencia: 'revisar',
      precioSugerido: precio,
      razon: `Está ${Math.abs(dif)}% ${dif > 0 ? 'arriba' : 'abajo'} de la mediana del mercado (${dinero(mediana)}, ${mercado.n} anuncios)${parado}. Es tanta diferencia que probablemente no sean la misma versión: el mercado se busca por marca, modelo y año, sin versión ni kilometraje. Confirma que sean comparables antes de mover el precio.`,
    };
  }

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


// ---------- Resumen del inventario (tablero, asistente y exportaciones) ----------

export interface AnalisisGuardado {
  vehicleId: string; titulo: string; precioLista: number; medianaMercado: number | null; comparables: number;
  diasEnInventario: number | null; analizadoEn: string; sugerencia: Sugerencia; precioSugerido: number; razon: string;
  confianza: ConfianzaAnalisis; diferenciaVsMedianaPct: number | null;
}

/** Cuenta, agrupa y redacta las conclusiones de la revisión de precios de venta de una agencia. */
export function resumirAnalisisDeVenta(autos: AnalisisGuardado[]) {
  const por: Record<Sugerencia, number> = { bajar: 0, subir: 0, mantener: 0, revisar: 0, 'sin-datos': 0 };
  autos.forEach((a) => { por[a.sugerencia] = (por[a.sugerencia] || 0) + 1; });
  const parados = autos.filter((a) => (a.diasEnInventario ?? 0) >= 90);
  const conComparables = autos.filter((a) => a.comparables > 0).map((a) => a.comparables);
  const comparablesPromedio = conComparables.length ? Math.round(conComparables.reduce((a, b) => a + b, 0) / conComparables.length) : 0;
  const valorSobrevaluado = autos.filter((a) => a.sugerencia === 'bajar').reduce((s, a) => s + Math.max(0, a.precioLista - a.precioSugerido), 0);
  const ultima = autos.reduce((m, a) => (String(a.analizadoEn || '') > m ? String(a.analizadoEn) : m), '') || null;
  const dinero = (n: number) => '$' + Math.round(n).toLocaleString('es-MX');
  const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

  const insights: string[] = [];
  if (!autos.length) {
    insights.push('Todavía no hay revisión de precios para esta agencia: se genera sola cada día, o con «correr_revision_precios».');
  } else {
    insights.push(`De ${autos.length} autos revisados: ${plural(por.bajar, 'parece caro', 'parecen caros')} contra el mercado, ${plural(por.subir, 'tiene', 'tienen')} oportunidad de subir, ${por.mantener} están bien, ${por.revisar} piden revisión manual y ${por['sin-datos']} no tienen datos suficientes.`);
    if (por.bajar) insights.push(`Bajar los precios sugeridos recortaría ${dinero(valorSobrevaluado)} en total.`);
    if (parados.length) insights.push(`${plural(parados.length, 'auto lleva', 'autos llevan')} 90 días o más en inventario${parados.filter((a) => a.sugerencia === 'bajar').length ? `; ${parados.filter((a) => a.sugerencia === 'bajar').length} de ellos ya tienen sugerencia de bajar` : ''}.`);
    if (por.revisar) insights.push(`${plural(por.revisar, 'auto está', 'autos están')} a más de ${DIFERENCIA_SOSPECHOSA_PCT}% del mercado; casi siempre es otra versión y no un mal precio, así que no se sugiere cambio.`);
    insights.push('El mercado se compara por marca, modelo y año, sin versión ni kilometraje: úsalo como guía, no como orden.');
  }
  return { total: autos.length, porSugerencia: por, parados90: parados.length, comparablesPromedio, valorSobrevaluado, fechaAnalisis: ultima, insights };
}
