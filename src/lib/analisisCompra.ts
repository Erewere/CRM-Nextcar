/**
 * Calidad de las compras: lo que se pagó por cada auto contra la guía de
 * Autocosmos (`guiaPrecios.ts`).
 *
 * La regla de compra es de Luis (oct 2026) y depende de qué tan COMERCIAL es el auto:
 *  - poco comercial (cuesta venderlo): se compra POR DEBAJO de la compra de la guía;
 *  - muy comercial (se vende rápido): se puede pagar hasta la MEDIA de la guía
 *    (la mitad entre su precio de compra y su precio de venta);
 *  - en medio: a medio camino.
 * Ese tope es el «máximo a pagar» (`techoDeCompra`) y la Fase 3 lo reutiliza.
 *
 * Qué tan comercial es (`comercialidad`), de lo más confiable a lo menos:
 *  1. Si la agencia ya vendió 2 o más autos de ese modelo: sus días en inventario
 *     (mediana de 45 días o menos = muy comercial; 90 o más = poco).
 *  2. Si no, cuántos anuncios parecidos hay en Mercado Libre (40 o más = muy
 *     comercial; menos de 15 = poco). Un modelo que todos publican es un modelo
 *     que todos buscan.
 *
 * Resultado: BUENA COMPRA si pagaste 5 % o más por debajo de la compra de la guía;
 * EN LÍNEA si estás entre eso y el máximo a pagar; CARA si pasaste el máximo.
 *
 * Límites que hay que tener presentes al leer los números:
 *  - La guía es la de HOY, no la del día en que se compró.
 *  - Con confianza «baja» no se compara. Con «media» se da 3 % de holgura.
 *  - Los autos en consignación no cuentan (lo que se paga al dueño no es compra).
 *  - Esta guía se queda corta frente a lo que de verdad se paga y se vende en este
 *    mercado (los precios de venta propios andan ~19 % sobre la guía de venta):
 *    por eso casi todo sale «arriba» y conviene mirar los casos que se salen del resto.
 */

export type ClasificacionCompra = 'buena' | 'en-linea' | 'cara' | 'sin-guia';
export type Comercialidad = 'alta' | 'media' | 'baja';

export const MARGEN_BUENA_PCT = 5;
export const HOLGURA_GUIA_MEDIA_PCT = 3;
export const DIAS_MUY_COMERCIAL = 45;
export const DIAS_POCO_COMERCIAL = 90;
export const ANUNCIOS_MUY_COMERCIAL = 40;
export const ANUNCIOS_POCO_COMERCIAL = 15;

/** Qué tan fácil es vender este modelo. `diasPropios`: días en inventario de los autos del mismo modelo ya vendidos. */
export function comercialidad(input: { anuncios: number | null | undefined; diasPropios?: number[] }): { nivel: Comercialidad; motivo: string } {
  const dias = (input.diasPropios || []).filter((d) => Number.isFinite(d)).sort((a, b) => a - b);
  if (dias.length >= 2) {
    const med = dias.length % 2 ? dias[(dias.length - 1) / 2] : (dias[dias.length / 2 - 1] + dias[dias.length / 2]) / 2;
    const m = Math.round(med);
    const nivel: Comercialidad = med <= DIAS_MUY_COMERCIAL ? 'alta' : med >= DIAS_POCO_COMERCIAL ? 'baja' : 'media';
    return { nivel, motivo: `Tus ${dias.length} ventas de este modelo tardaron ${m} días en promedio.` };
  }
  const n = Number(input.anuncios) || 0;
  const nivel: Comercialidad = n >= ANUNCIOS_MUY_COMERCIAL ? 'alta' : n >= ANUNCIOS_POCO_COMERCIAL ? 'media' : 'baja';
  return { nivel, motivo: `Hay ${n} anuncios parecidos en el mercado${n >= ANUNCIOS_MUY_COMERCIAL ? ': se publica y se busca mucho.' : n >= ANUNCIOS_POCO_COMERCIAL ? '.' : ': es un modelo poco común.'}` };
}

/** Lo máximo que conviene pagar. Poco comercial: la compra de la guía. Muy comercial: la media de la guía. */
export function techoDeCompra(g: { guiaCompra: number; guiaVenta: number | null | undefined; nivel: Comercialidad; confianzaGuia?: string | null }): number {
  const media = g.guiaVenta && g.guiaVenta > g.guiaCompra ? (g.guiaCompra + g.guiaVenta) / 2 : g.guiaCompra;
  const avance = g.nivel === 'alta' ? 1 : g.nivel === 'media' ? 0.5 : 0;
  const base = g.guiaCompra + (media - g.guiaCompra) * avance;
  return Math.round(base * (g.confianzaGuia === 'media' ? 1 + HOLGURA_GUIA_MEDIA_PCT / 100 : 1));
}

export function analizarCompra(input: {
  precioCompra: number;
  guiaCompra: number | null | undefined;
  guiaVenta?: number | null;
  confianzaGuia: string | null | undefined;
  nivelComercial?: Comercialidad;
}): { clasificacion: ClasificacionCompra; diferenciaPct: number | null; diferenciaMonto: number | null; techoCompra: number | null; motivo: string } {
  const { precioCompra, guiaCompra, confianzaGuia } = input;
  const sin = (motivo: string) => ({ clasificacion: 'sin-guia' as const, diferenciaPct: null, diferenciaMonto: null, techoCompra: null, motivo });
  if (!(precioCompra > 0)) return sin('No hay precio de compra capturado.');
  if (!(guiaCompra && guiaCompra > 0)) return sin('La guía no tiene este modelo y año.');
  if (confianzaGuia !== 'alta' && confianzaGuia !== 'media') return sin('La guía no es confiable para este auto (no se pudo saber la versión).');

  const nivel = input.nivelComercial || 'baja';
  const techoCompra = techoDeCompra({ guiaCompra, guiaVenta: input.guiaVenta, nivel, confianzaGuia });
  const diferenciaMonto = Math.round(precioCompra - guiaCompra);
  const diferenciaPct = Math.round(((precioCompra - guiaCompra) / guiaCompra) * 1000) / 10;
  const clasificacion: ClasificacionCompra = diferenciaPct <= -MARGEN_BUENA_PCT ? 'buena' : precioCompra > techoCompra ? 'cara' : 'en-linea';
  const dinero0 = (n: number) => '$' + Math.round(n).toLocaleString('es-MX');
  const nom = nivel === 'alta' ? 'muy comercial' : nivel === 'media' ? 'medianamente comercial' : 'poco comercial';
  const motivo = clasificacion === 'buena'
    ? `Pagaste ${Math.abs(diferenciaPct)}% menos que la compra de la guía.`
    : clasificacion === 'cara'
      ? `Pagaste ${dinero0(precioCompra - techoCompra)} por encima de lo máximo recomendado (${dinero0(techoCompra)}) para un auto ${nom}.`
      : `Dentro de lo recomendado para un auto ${nom} (hasta ${dinero0(techoCompra)}).`;
  return { clasificacion, diferenciaPct, diferenciaMonto, techoCompra, motivo };
}

export interface CompraAnalizada {
  vehicleId: string;
  titulo: string;
  marca: string;
  clasificacion: ClasificacionCompra;
  diferenciaPct: number | null;
  diferenciaMonto: number | null;
  /** AAAA-MM de la fecha en que se recibió el auto; '' si no se sabe. */
  mes: string;
  compradoPorNombre: string;
}

interface Grupo { clave: string; autos: number; caras: number; pctCaras: number; diferenciaPromedioPct: number }

const redondear1 = (n: number) => Math.round(n * 10) / 10;
const dinero = (n: number) => '$' + Math.round(n).toLocaleString('es-MX');

function agrupar(compras: CompraAnalizada[], clave: (c: CompraAnalizada) => string, minimo = 1): Grupo[] {
  const mapa = new Map<string, CompraAnalizada[]>();
  compras.forEach((c) => { const k = clave(c); mapa.set(k, [...(mapa.get(k) || []), c]); });
  return [...mapa.entries()]
    .filter(([, xs]) => xs.length >= minimo)
    .map(([k, xs]) => {
      const caras = xs.filter((x) => x.clasificacion === 'cara').length;
      return {
        clave: k, autos: xs.length, caras,
        pctCaras: Math.round((caras / xs.length) * 100),
        diferenciaPromedioPct: redondear1(xs.reduce((a, x) => a + (x.diferenciaPct || 0), 0) / xs.length),
      };
    });
}

/** Resumen de todas las compras comparables (las «sin guía» no entran en los porcentajes). */
export function resumirCompras(todas: CompraAnalizada[]) {
  const comp = todas.filter((c) => c.clasificacion !== 'sin-guia' && c.diferenciaPct !== null);
  const caras = comp.filter((c) => c.clasificacion === 'cara');
  const buenas = comp.filter((c) => c.clasificacion === 'buena');
  const sinGuia = todas.length - comp.length;
  const pctPorEncimaDeGuia = comp.length ? Math.round((caras.length / comp.length) * 100) : 0;
  const sobreprecioPromedioPct = caras.length ? redondear1(caras.reduce((a, c) => a + (c.diferenciaPct || 0), 0) / caras.length) : 0;
  const ordenadas = comp.map((c) => c.diferenciaPct as number).sort((a, b) => a - b);
  const medianaDiferenciaPct = ordenadas.length ? redondear1(ordenadas.length % 2 ? ordenadas[(ordenadas.length - 1) / 2] : (ordenadas[ordenadas.length / 2 - 1] + ordenadas[ordenadas.length / 2]) / 2) : 0;
  const sobreprecioTotal = caras.reduce((a, c) => a + Math.max(0, c.diferenciaMonto || 0), 0);
  const ahorroTotal = buenas.reduce((a, c) => a + Math.max(0, -(c.diferenciaMonto || 0)), 0);

  const porMes = agrupar(comp.filter((c) => c.mes), (c) => c.mes).sort((a, b) => a.clave.localeCompare(b.clave));
  const porMarca = agrupar(comp, (c) => c.marca || 'Sin marca').sort((a, b) => b.autos - a.autos);
  const porComprador = agrupar(comp, (c) => c.compradoPorNombre || 'Sin registrar').sort((a, b) => b.autos - a.autos);

  const insights: string[] = [];
  if (!comp.length) {
    insights.push('Todavía no hay compras que se puedan comparar con la guía: faltan precios de compra o la guía no tiene esos modelos.');
  } else {
    insights.push(`De ${comp.length} compras comparables con la guía, ${caras.length} (${pctPorEncimaDeGuia}%) se pagaron por encima${caras.length ? `, con un sobreprecio promedio de ${sobreprecioPromedioPct}% (${dinero(sobreprecioTotal)} en total)` : ''}.`);
    if (buenas.length) insights.push(`${buenas.length} ${buenas.length === 1 ? 'compra salió' : 'compras salieron'} por debajo de la guía, ${dinero(ahorroTotal)} menos de lo que vale${buenas.length === 1 ? '' : 'n'} según ella.`);
    // Si TODAS las compras quedan del mismo lado de la guía, lo más probable es que la guía
    // esté sesgada para este mercado y no que se pague mal siempre. Se dice, para que nadie
    // lea «63 % caras» como un regaño cuando es una guía corta.
    if (comp.length >= 10 && Math.abs(medianaDiferenciaPct) > MARGEN_BUENA_PCT) {
      insights.push(`Ojo: la compra típica (la mediana) está ${medianaDiferenciaPct > 0 ? '+' : ''}${medianaDiferenciaPct}% ${medianaDiferenciaPct > 0 ? 'arriba' : 'abajo'} de la guía. Cuando casi todo cae del mismo lado, suele ser que la guía se queda ${medianaDiferenciaPct > 0 ? 'corta' : 'alta'} para este mercado y no que se pague mal siempre. Fíjate más en qué autos y qué meses se salen de lo normal que en el porcentaje total.`);
    }
    const marcaCara = porMarca.filter((g) => g.autos >= 3 && g.caras > 0).sort((a, b) => b.diferenciaPromedioPct - a.diferenciaPromedioPct)[0];
    if (marcaCara && marcaCara.diferenciaPromedioPct > MARGEN_BUENA_PCT) insights.push(`La marca donde más se paga arriba de la guía es ${marcaCara.clave}: ${marcaCara.diferenciaPromedioPct}% en promedio (${marcaCara.autos} autos).`);
    const reciente = porMes.slice(-3);
    if (reciente.length >= 2) {
      const a = reciente[0], b = reciente[reciente.length - 1];
      if (Math.abs(b.diferenciaPromedioPct - a.diferenciaPromedioPct) >= 2) {
        insights.push(`Tendencia: en ${a.clave} se pagaba ${a.diferenciaPromedioPct >= 0 ? '+' : ''}${a.diferenciaPromedioPct}% contra la guía y en ${b.clave}, ${b.diferenciaPromedioPct >= 0 ? '+' : ''}${b.diferenciaPromedioPct}%.`);
      }
    }
    const sinComprador = comp.filter((c) => !c.compradoPorNombre).length;
    if (sinComprador === comp.length) insights.push('Todavía no se sabe quién compró cada auto: se empieza a guardar desde ahora, al dar de alta un auto nuevo.');
    else if (sinComprador) insights.push(`En ${sinComprador} compras no se registró quién compró; solo los autos dados de alta desde ahora lo guardan.`);
  }
  if (sinGuia) insights.push(`${sinGuia} ${sinGuia === 1 ? 'auto no se pudo comparar' : 'autos no se pudieron comparar'} (sin guía confiable para ese modelo).`);

  return {
    comprasTotales: todas.length, comparables: comp.length, sinGuia,
    caras: caras.length, buenas: buenas.length, enLinea: comp.length - caras.length - buenas.length,
    pctPorEncimaDeGuia, medianaDiferenciaPct, sobreprecioPromedioPct, sobreprecioTotal, ahorroTotal,
    porMes, porMarca, porComprador, insights,
  };
}
