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
  vigenciaDias: number;
  notas: string;
}

export interface Opcion {
  meses: number;
  financiar: number;
  interes: number;
  mensualidad: number;
  total: number;              // lo que paga en total (enganche + toma + mensualidades)
}

export const redondear = (n: number) => Math.round(n);

export function calcularCotizacion(d: DatosCotizacion) {
  const precio = Math.max(0, (d.precioLista || 0) - (d.descuento || 0));
  const toma = Math.max(0, d.tomaACuenta || 0);
  if (d.forma === 'contado') {
    return { precio, toma, engancheTotal: 0, financiar: 0, saldoContado: Math.max(0, precio - toma), opciones: [] as Opcion[] };
  }
  const engancheTotal = Math.min(precio, toma + Math.max(0, d.enganche || 0));
  const financiar = Math.max(0, precio - engancheTotal);
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
    return { meses, financiar, interes, mensualidad, total: engancheTotal + mensualidad * meses };
  });
  return { precio, toma, engancheTotal, financiar, saldoContado: 0, opciones };
}

/** Folio corto y legible: COT-261001-4F7K. */
export function folioCotizacion(fecha = new Date()) {
  const f = `${String(fecha.getFullYear()).slice(2)}${String(fecha.getMonth() + 1).padStart(2, '0')}${String(fecha.getDate()).padStart(2, '0')}`;
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const azar = Array.from({ length: 4 }, () => letras[Math.floor(Math.random() * letras.length)]).join('');
  return `COT-${f}-${azar}`;
}
