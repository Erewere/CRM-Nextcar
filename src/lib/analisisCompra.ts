/**
 * Calidad de las compras: lo que se pagó por cada auto contra el precio de
 * COMPRA de la guía de Autocosmos (`guiaPrecios.ts`, 87 % de la venta).
 *
 * Límites que hay que tener presentes al leer los números:
 *  - La guía es la de HOY, no la del día en que se compró. Un auto comprado hace
 *    medio año se compara contra el valor actual.
 *  - Con confianza «baja» no se compara (la guía no sabe qué versión es).
 *  - Los autos en consignación no cuentan: lo que se les paga es lo del dueño,
 *    no una compra.
 *  - Es un promedio de guía, no una oferta real: ±5 % ya es ruido (así de
 *    precisa fue contra el Libro Azul), por eso «en línea» es de −5 % a +5 %.
 *
 * Reglas, para quien vende y no programa:
 *  buena compra  = pagaste al menos 5 % menos que la guía,
 *  en línea      = dentro de ±5 %,
 *  cara          = pagaste más de 5 % por encima.
 *  Con confianza «media» en la guía el margen es de 8 %, porque se equivoca más.
 */

export type ClasificacionCompra = 'buena' | 'en-linea' | 'cara' | 'sin-guia';

export const UMBRAL_ALTA_PCT = 5;
export const UMBRAL_MEDIA_PCT = 8;

export function analizarCompra(input: {
  precioCompra: number;
  guiaCompra: number | null | undefined;
  confianzaGuia: string | null | undefined;
}): { clasificacion: ClasificacionCompra; diferenciaPct: number | null; diferenciaMonto: number | null; motivo: string } {
  const { precioCompra, guiaCompra, confianzaGuia } = input;
  if (!(precioCompra > 0)) return { clasificacion: 'sin-guia', diferenciaPct: null, diferenciaMonto: null, motivo: 'No hay precio de compra capturado.' };
  if (!(guiaCompra && guiaCompra > 0)) return { clasificacion: 'sin-guia', diferenciaPct: null, diferenciaMonto: null, motivo: 'La guía no tiene este modelo y año.' };
  if (confianzaGuia !== 'alta' && confianzaGuia !== 'media') {
    return { clasificacion: 'sin-guia', diferenciaPct: null, diferenciaMonto: null, motivo: 'La guía no es confiable para este auto (no se pudo saber la versión).' };
  }
  const diferenciaMonto = Math.round(precioCompra - guiaCompra);
  const diferenciaPct = Math.round(((precioCompra - guiaCompra) / guiaCompra) * 1000) / 10;
  const umbral = confianzaGuia === 'alta' ? UMBRAL_ALTA_PCT : UMBRAL_MEDIA_PCT;
  const clasificacion: ClasificacionCompra = diferenciaPct <= -umbral ? 'buena' : diferenciaPct > umbral ? 'cara' : 'en-linea';
  const abs = Math.abs(diferenciaPct);
  const motivo = clasificacion === 'buena' ? `Pagaste ${abs}% menos que la guía.` : clasificacion === 'cara' ? `Pagaste ${abs}% más que la guía.` : `Pagaste lo que dice la guía (${diferenciaPct >= 0 ? '+' : ''}${diferenciaPct}%).`;
  return { clasificacion, diferenciaPct, diferenciaMonto, motivo };
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
    if (comp.length >= 10 && Math.abs(medianaDiferenciaPct) > UMBRAL_ALTA_PCT) {
      insights.push(`Ojo: la compra típica (la mediana) está ${medianaDiferenciaPct > 0 ? '+' : ''}${medianaDiferenciaPct}% ${medianaDiferenciaPct > 0 ? 'arriba' : 'abajo'} de la guía. Cuando casi todo cae del mismo lado, suele ser que la guía se queda ${medianaDiferenciaPct > 0 ? 'corta' : 'alta'} para este mercado y no que se pague mal siempre. Fíjate más en qué autos y qué meses se salen de lo normal que en el porcentaje total.`);
    }
    const marcaCara = porMarca.filter((g) => g.autos >= 3 && g.caras > 0).sort((a, b) => b.diferenciaPromedioPct - a.diferenciaPromedioPct)[0];
    if (marcaCara && marcaCara.diferenciaPromedioPct > UMBRAL_ALTA_PCT) insights.push(`La marca donde más se paga arriba de la guía es ${marcaCara.clave}: ${marcaCara.diferenciaPromedioPct}% en promedio (${marcaCara.autos} autos).`);
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
