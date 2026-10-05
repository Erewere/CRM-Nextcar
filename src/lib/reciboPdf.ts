import { jsPDF } from 'jspdf';
import { logo } from './fichaPdf';
import { sinFondoClaro } from './contratosPdf';
import { pesosALetras } from './numeroALetras';
import { NOMBRE_CONCEPTO, NOMBRE_FORMA, type PagoVenta } from './planDePagos';

/**
 * Recibo de pago en una hoja carta: arriba el ORIGINAL (para el cliente) y
 * abajo la COPIA (para la agencia), separados por una línea para cortar.
 * Cada mitad lleva el logo de la agencia y su marca de agua.
 */

export interface DatosRecibo {
  pago: PagoVenta;
  folio: string;
  cliente: string;
  auto?: { nombre?: string; vin?: string } | null;
  agencia: { nombre?: string; logo?: string; direccion?: string; telefono?: string };
  /** «Mensualidad 3 de 38 (completa) y 4 (parcial)», «Enganche», etc. */
  concepto: string;
  saldoAntes: number;
  saldoDespues: number;
  proxima?: { n: number; fecha: string; monto: number } | null;
  plazo?: number;
}

const W = 612, H = 792, MITAD = H / 2, M = 34;
const pesos = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 }).format(Number(n) || 0);
const fechaLarga = (s: string) => (s ? new Date(`${s.slice(0, 10)}T12:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) : '');

export const folioDeRecibo = (id: string) => `R-${String(id).replace(/[^A-Za-z0-9]/g, '').slice(-7).toUpperCase()}`;

export async function generarReciboPdf(d: DatosRecibo): Promise<Blob> {
  const pdf = new jsPDF({ unit: 'pt', format: 'letter' });
  const lg = await logo(d.agencia.logo || undefined);
  const marca = lg ? await sinFondoClaro(lg.src) : '';

  const mitad = (y0: number, etiqueta: 'ORIGINAL' | 'COPIA') => {
    // Marca de agua centrada en la media hoja
    if (lg && marca) {
      const ancho = Math.min(260, 190 * lg.ratio), alto = ancho / lg.ratio;
      const GState = (pdf as any).GState;
      pdf.setGState(new GState({ opacity: 0.07 }));
      pdf.addImage(marca, 'PNG', (W - ancho) / 2, y0 + (MITAD - alto) / 2 + 10, ancho, alto);
      pdf.setGState(new GState({ opacity: 1 }));
    }

    // Encabezado: logo y datos de la agencia a la izquierda; recibo a la derecha
    let y = y0 + M;
    let xTexto = M;
    if (lg) {
      const h = Math.min(42, 150 / lg.ratio);
      pdf.addImage(lg.src, 'PNG', M, y - 4, h * lg.ratio, h);
      xTexto = M + h * lg.ratio + 10;
    }
    pdf.setTextColor(20);
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(11);
    pdf.text(d.agencia.nombre || '', xTexto, y + 8, { maxWidth: 230 });
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5); pdf.setTextColor(90);
    const contacto = [d.agencia.direccion, d.agencia.telefono ? `Tel. ${d.agencia.telefono}` : ''].filter(Boolean).join(' · ');
    if (contacto) pdf.text(pdf.splitTextToSize(contacto, 230).slice(0, 2), xTexto, y + 19);

    pdf.setTextColor(20); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(16);
    pdf.text('RECIBO DE PAGO', W - M, y + 8, { align: 'right' });
    pdf.setFontSize(9); pdf.setFont('helvetica', 'normal');
    pdf.text(`Folio ${d.folio}`, W - M, y + 21, { align: 'right' });
    pdf.text(fechaLarga(d.pago.fecha), W - M, y + 32, { align: 'right' });
    // Etiqueta ORIGINAL / COPIA
    if (etiqueta === 'ORIGINAL') pdf.setFillColor(20, 20, 20); else pdf.setFillColor(120, 120, 120);
    pdf.roundedRect(W - M - 70, y + 37, 70, 15, 3, 3, 'F');
    pdf.setTextColor(255); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8);
    pdf.text(etiqueta, W - M - 35, y + 47.5, { align: 'center' });

    y += 64;
    pdf.setDrawColor(200); pdf.setLineWidth(0.6); pdf.line(M, y, W - M, y);
    y += 18;

    // Cuerpo
    const etiquetaValor = (t: string, v: string, yy: number, ancho = W - 2 * M - 92) => {
      pdf.setTextColor(110); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8.5);
      pdf.text(t, M, yy);
      pdf.setTextColor(20); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10.5);
      const lineas = pdf.splitTextToSize(v || '—', ancho);
      pdf.text(lineas.slice(0, 2), M + 92, yy);
      return yy + 14 * Math.min(2, lineas.length) + 4;
    };
    y = etiquetaValor('Recibimos de', d.cliente, y);

    // Monto grande
    pdf.setFillColor(244, 245, 245); pdf.roundedRect(M, y - 4, W - 2 * M, 40, 4, 4, 'F');
    pdf.setTextColor(110); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8.5);
    pdf.text('La cantidad de', M + 10, y + 10);
    pdf.setTextColor(20); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(18);
    pdf.text(pesos(d.pago.monto), M + 10, y + 29);
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8);
    pdf.text(pdf.splitTextToSize(`(${pesosALetras(d.pago.monto)})`, 330).slice(0, 2), W - M - 10, y + 15, { align: 'right' });
    y += 50;

    y = etiquetaValor('Por concepto de', d.concepto, y);
    if (d.auto?.nombre) y = etiquetaValor('Vehículo', `${d.auto.nombre}${d.auto.vin ? ` · NIV ${d.auto.vin}` : ''}`, y);
    y = etiquetaValor('Forma de pago', `${NOMBRE_FORMA[d.pago.forma] || d.pago.forma}${d.pago.nota ? ` · ${d.pago.nota}` : ''}`, y);

    // Saldo y firma
    const yPie = y0 + MITAD - 62;
    pdf.setFontSize(8.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(70);
    const saldo = [`Saldo anterior ${pesos(d.saldoAntes)}`, `Saldo después de este pago ${pesos(d.saldoDespues)}`];
    if (d.saldoDespues <= 0.5) saldo.push('CUENTA LIQUIDADA');
    else if (d.proxima) saldo.push(`Próxima: mensualidad ${d.proxima.n}${d.plazo ? ` de ${d.plazo}` : ''}, ${fechaLarga(d.proxima.fecha)}, ${pesos(d.proxima.monto)}`);
    pdf.text(saldo, M, yPie);
    pdf.setDrawColor(60); pdf.setLineWidth(0.7);
    pdf.line(W - M - 190, yPie + 22, W - M, yPie + 22);
    pdf.setFontSize(8); pdf.setTextColor(60);
    pdf.text('Recibió', W - M - 95, yPie + 33, { align: 'center' });
    if (d.pago.registradoPorNombre) pdf.text(d.pago.registradoPorNombre, W - M - 95, yPie + 43, { align: 'center' });
  };

  mitad(0, 'ORIGINAL');
  mitad(MITAD, 'COPIA');

  // Línea para cortar
  pdf.setDrawColor(150); pdf.setLineWidth(0.5);
  (pdf as any).setLineDashPattern([4, 3], 0);
  pdf.line(14, MITAD, W - 14, MITAD);
  (pdf as any).setLineDashPattern([], 0);
  pdf.setFontSize(6.5); pdf.setTextColor(150); pdf.setFont('helvetica', 'normal');
  pdf.text('- - cortar aquí - -', W / 2, MITAD - 3, { align: 'center' });

  return pdf.output('blob');
}

/** El texto de «por concepto de», a partir de lo que el pago cubrió. */
export function conceptoDelRecibo(p: PagoVenta, ap: { inicial: number; cubre: { n: number; completa: boolean }[]; plazo: number } | null) {
  if (p.concepto === 'liquidacion') return 'Liquidación del crédito';
  if (!ap) return NOMBRE_CONCEPTO[p.concepto] || 'Pago';
  const partes: string[] = [];
  if (ap.inicial > 0) partes.push(p.concepto === 'comision' ? 'Comisión por apertura' : 'Enganche');
  if (ap.cubre.length) {
    const t = ap.cubre.map((c) => `${c.n}${c.completa ? '' : ' (parcial)'}`);
    partes.push(`${ap.cubre.length === 1 ? 'Mensualidad' : 'Mensualidades'} ${t.length > 1 ? `${t.slice(0, -1).join(', ')} y ${t[t.length - 1]}` : t[0]} de ${ap.plazo}`);
  }
  return partes.join(' y ') || NOMBRE_CONCEPTO[p.concepto] || 'Pago';
}
