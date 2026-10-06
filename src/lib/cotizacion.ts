/**
 * Cuentas de una cotización. El crédito propio usa el mismo interés global
 * fijo que «Trato ganado» (DealWonModal), para que lo cotizado y lo que luego
 * se registra coincidan. El bancario es un pago fijo con tasa anual
 * (amortización francesa), como estimado.
 */

export type FormaCotizacion = 'contado' | 'credito' | 'credito_bancario';

export interface DatosCotizacion {
  forma: FormaCotizacion;
  precioLista: number;
  descuento: number;
  tomaACuenta: number;        // valor del auto que deja el cliente
  tomaDescripcion: string;
  enganche: number;           // en efectivo, además de la toma
  plazos: number[];           // meses a comparar
  tasa: number;               // % mensual (propio) o anual (bancario)
  comisionPct: number;        // comisión por apertura, % sobre el monto a financiar
  comisionFinanciada: boolean; // solo crédito de la casa: dentro del financiamiento
  banco?: string;             // crédito bancario: el banco con convenio elegido (solo para mostrarlo)
  vigenciaDias: number;
  notas: string;
}

/** Leyenda obligatoria en toda cotización con crédito. */
export const LEYENDA_COTIZACION = 'Cotización informativa: no incluye el seguro del auto, que se cotiza aparte y es requisito del crédito.';

export interface Opcion {
  meses: number;
  financiar: number;
  interes: number;
  mensualidad: number;
  total: number;              // lo que paga en total (enganche + comisión + toma + mensualidades)
}

export const redondear = (n: number) => Math.round(n);

export function calcularCotizacion(d: DatosCotizacion) {
  const precio = Math.max(0, (d.precioLista || 0) - (d.descuento || 0));
  const toma = Math.max(0, d.tomaACuenta || 0);
  if (d.forma === 'contado') {
    return { precio, toma, engancheTotal: 0, engancheEfectivo: 0, baseFinanciar: 0, comision: 0, comisionFinanciada: false, pagoInicial: 0, financiar: 0, saldoContado: Math.max(0, precio - toma), opciones: [] as Opcion[] };
  }
  const engancheTotal = Math.min(precio, toma + Math.max(0, d.enganche || 0));
  const engancheEfectivo = Math.max(0, engancheTotal - toma);
  // La comisión por apertura se calcula sobre lo que se financia. En crédito
  // de la casa puede ir dentro del financiamiento; en el bancario siempre se
  // paga de contado, junto con el enganche.
  const baseFinanciar = Math.max(0, precio - engancheTotal);
  const comision = baseFinanciar * Math.max(0, d.comisionPct || 0) / 100;
  const comisionFinanciada = d.forma === 'credito' && !!d.comisionFinanciada;
  const financiar = baseFinanciar + (comisionFinanciada ? comision : 0);
  const pagoInicial = engancheEfectivo + (comisionFinanciada ? 0 : comision);
  const opciones: Opcion[] = (d.plazos || []).filter((m) => m > 0).sort((a, b) => a - b).map((meses) => {
    let mensualidad = 0, interes = 0;
    if (d.forma === 'credito') {
      interes = financiar * ((d.tasa || 0) / 100) * meses;
      mensualidad = (financiar + interes) / meses;
    } else {
      const i = (d.tasa || 0) / 100 / 12;
      mensualidad = i > 0 ? (financiar * i) / (1 - Math.pow(1 + i, -meses)) : financiar / meses;
      interes = mensualidad * meses - financiar;
    }
    return { meses, financiar, interes, mensualidad, total: toma + pagoInicial + mensualidad * meses };
  });
  return { precio, toma, engancheTotal, engancheEfectivo, baseFinanciar, comision, comisionFinanciada, pagoInicial, financiar, saldoContado: 0, opciones };
}

/** Folio corto y legible: COT-261001-4F7K. */
export function folioCotizacion(fecha = new Date()) {
  const f = `${String(fecha.getFullYear()).slice(2)}${String(fecha.getMonth() + 1).padStart(2, '0')}${String(fecha.getDate()).padStart(2, '0')}`;
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const azar = Array.from({ length: 4 }, () => letras[Math.floor(Math.random() * letras.length)]).join('');
  return `COT-${f}-${azar}`;
}
