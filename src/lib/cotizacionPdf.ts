import { jsPDF } from 'jspdf';
import type { Vehicle } from '../types';
import { fotoCompleta, iconoWhatsApp, logo, numeroWhatsApp } from './fichaPdf';
import { calcularCotizacion, LEYENDA_COTIZACION, type DatosCotizacion } from './cotizacion';

/**
 * Cotización en PDF para el cliente: el auto, el precio, la toma a cuenta y
 * hasta cuatro plazos de crédito lado a lado. Carta, texto real, con el
 * botón de WhatsApp del asesor. Ojo: la letra del PDF (helvetica) no trae el
 * signo «−» de matemáticas; se usa el guion normal.
 */

const AZUL = [15, 23, 42] as const;
const ACENTO = [29, 78, 216] as const;
const GRIS = [71, 85, 105] as const;
const CLARO = [241, 245, 249] as const;
const LINEA = [226, 232, 240] as const;
const pesos = (n: number) => `$${Math.round(Number(n) || 0).toLocaleString('es-MX')}`;
const fechaLarga = (d: Date) => d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });

export interface CotizacionPdf {
  folio: string;
  auto: Vehicle;
  cliente: { name?: string; phone?: string };
  datos: DatosCotizacion;
  agencia?: { name?: string; address?: string; phone?: string; phoneWhatsApp?: string; logoUrl?: string } | null;
  asesor?: { name?: string; phone?: string; email?: string } | null;
}

export async function generarCotizacionPdf({ folio, auto, cliente, datos, agencia, asesor }: CotizacionPdf): Promise<Blob> {
  const pdf = new jsPDF({ unit: 'pt', format: 'letter' });
  const W = 612, H = 792, M = 36, ANCHO = W - M * 2;
  const color = (c: readonly number[]) => pdf.setTextColor(c[0], c[1], c[2]);
  const relleno = (c: readonly number[]) => pdf.setFillColor(c[0], c[1], c[2]);
  const texto = (t: string | string[], x: number, y: number, tam: number, estilo: 'normal' | 'bold' = 'normal', c: readonly number[] = AZUL, opc: any = {}) => {
    pdf.setFont('helvetica', estilo); pdf.setFontSize(tam); color(c); pdf.text(t, x, y, opc);
  };
  const r = calcularCotizacion(datos);
  const hoy = new Date();
  const vence = new Date(hoy.getTime() + (datos.vigenciaDias || 7) * 86400000);
  const titulo = `${auto.year || ''} ${auto.make || ''} ${auto.model || ''}`.trim();

  const FOTO_W = 220, FOTO_H = 165;
  const [foto, logoAg, iconoWa] = await Promise.all([
    fotoCompleta(auto.photoUrls?.[0] || auto.photoUrl, FOTO_W, FOTO_H),
    logo(agencia?.logoUrl),
    iconoWhatsApp(),
  ]);

  relleno([255, 255, 255]); pdf.rect(0, 0, W, H, 'F');

  // --- Encabezado
  let y = M;
  if (logoAg) { const alto = 34, ancho = Math.min(150, alto * logoAg.ratio); pdf.addImage(logoAg.src, 'PNG', M, y, ancho, ancho / logoAg.ratio); }
  else texto(agencia?.name || '', M, y + 22, 16, 'bold');
  texto('COTIZACIÓN', W - M, y + 12, 16, 'bold', AZUL, { align: 'right' });
  texto(`Folio ${folio}`, W - M, y + 26, 9, 'normal', GRIS, { align: 'right' });
  texto(`${fechaLarga(hoy)} · Vigente hasta el ${fechaLarga(vence)}`, W - M, y + 38, 8.5, 'normal', GRIS, { align: 'right' });
  y += 52;
  relleno(ACENTO); pdf.rect(M, y, 46, 3, 'F');
  pdf.setDrawColor(LINEA[0], LINEA[1], LINEA[2]); pdf.setLineWidth(0.6); pdf.line(M + 50, y + 1.5, W - M, y + 1.5);

  // --- Para quién
  y += 24;
  texto('PREPARADA PARA', M, y, 8, 'bold', GRIS, { charSpace: 0.8 });
  texto(cliente.name || 'Cliente', M, y + 16, 14, 'bold');
  if (asesor?.name) {
    texto('TU ASESOR', W - M, y, 8, 'bold', GRIS, { align: 'right' });
    texto(asesor.name, W - M, y + 16, 12, 'bold', AZUL, { align: 'right' });
  }

  // --- El auto
  y += 32;
  if (foto) pdf.addImage(foto, 'JPEG', M, y, FOTO_W, FOTO_H);
  else { relleno(CLARO); pdf.rect(M, y, FOTO_W, FOTO_H, 'F'); }
  const x2 = M + FOTO_W + 20, ancho2 = ANCHO - FOTO_W - 20;
  texto(`${String(auto.make || '').toUpperCase()} · ${auto.year || ''}`, x2, y + 12, 8.5, 'bold', ACENTO, { charSpace: 1 });
  texto(pdf.splitTextToSize(String(auto.model || ''), ancho2).slice(0, 2), x2, y + 32, 18, 'bold');
  const datosAuto = [auto.km ? `${Number(auto.km).toLocaleString('es-MX')} km` : '', auto.transmission, auto.color, auto.bodyType].filter(Boolean).join('  ·  ');
  texto(datosAuto, x2, y + 70, 9.5, 'normal', GRIS);
  // Precio: lista, descuento, precio final, toma
  let yy = y + 96;
  const fila = (etq: string, val: string, fuerte = false, c: readonly number[] = AZUL) => {
    texto(etq, x2, yy, fuerte ? 10.5 : 9.5, fuerte ? 'bold' : 'normal', fuerte ? AZUL : GRIS);
    texto(val, W - M, yy, fuerte ? 14 : 10, 'bold', c, { align: 'right' });
    yy += fuerte ? 20 : 15;
  };
  if (datos.descuento > 0) { fila('Precio de lista', pesos(datos.precioLista)); fila('Descuento', `- ${pesos(datos.descuento)}`, false, [21, 128, 61]); }
  fila(datos.descuento > 0 ? 'Precio especial' : 'Precio', pesos(r.precio), true);
  if (r.toma > 0) fila(`A cuenta: ${datos.tomaDescripcion || 'tu auto'}`.slice(0, 48), `- ${pesos(r.toma)}`, false, [21, 128, 61]);
  y += FOTO_H + 26;

  // --- Forma de pago
  if (datos.forma === 'contado') {
    relleno(CLARO); pdf.roundedRect(M, y, ANCHO, 74, 8, 8, 'F');
    texto('PAGO DE CONTADO', M + 18, y + 24, 9, 'bold', ACENTO, { charSpace: 1 });
    texto(r.toma > 0 ? 'Diferencia a pagar' : 'Total a pagar', M + 18, y + 48, 11, 'normal', GRIS);
    texto(pesos(r.saldoContado), W - M - 18, y + 50, 26, 'bold', AZUL, { align: 'right' });
    y += 74 + 18;
  } else {
    const banco = datos.forma === 'credito_bancario';
    texto(banco ? `CRÉDITO BANCARIO${datos.banco ? ` · ${String(datos.banco).toUpperCase()}` : ''} (ESTIMADO)` : 'PLAN DE CRÉDITO', M, y, 9, 'bold', ACENTO, { charSpace: 1 });
    texto(banco ? `Tasa anual de referencia ${datos.tasa}%` : `Interés ${datos.tasa}% mensual sobre el monto a financiar`, W - M, y, 8.5, 'normal', GRIS, { align: 'right' });
    y += 12;
    // Resumen: enganche, comisión por apertura, pago inicial y monto a financiar
    const conComision = r.comision > 0;
    relleno(CLARO); pdf.roundedRect(M, y, ANCHO, 54, 8, 8, 'F');
    const bloques: [string, string, string][] = [
      [r.toma > 0 ? 'ENGANCHE (CON TU AUTO)' : 'ENGANCHE', pesos(r.engancheTotal), r.toma > 0 ? `${pesos(r.engancheEfectivo)} en efectivo` : ''],
      ...(conComision ? [['COMISIÓN POR APERTURA', pesos(r.comision), `${datos.comisionPct}% · ${r.comisionFinanciada ? 'incluida en el crédito' : 'de contado'}`] as [string, string, string]] : []),
      ['PAGO INICIAL', pesos(r.pagoInicial), conComision && !r.comisionFinanciada ? 'enganche + comisión' : 'en efectivo'],
      ['MONTO A FINANCIAR', pesos(r.financiar), conComision && r.comisionFinanciada ? 'incluye la comisión' : ''],
    ];
    const colB = ANCHO / bloques.length;
    bloques.forEach(([etq, val, sub], i) => {
      texto(etq, M + 14 + i * colB, y + 16, 7.5, 'bold', GRIS);
      texto(val, M + 14 + i * colB, y + 33, 13, 'bold');
      if (sub) texto(sub, M + 14 + i * colB, y + 45, 7.5, 'normal', GRIS);
    });
    y += 54 + 14;
    // Tarjetas por plazo
    const n = Math.max(1, Math.min(4, r.opciones.length));
    const gap = 10, w = (ANCHO - gap * (n - 1)) / n, h = 108;
    r.opciones.slice(0, 4).forEach((o, i) => {
      const x = M + i * (w + gap);
      pdf.setDrawColor(LINEA[0], LINEA[1], LINEA[2]); pdf.setLineWidth(1); pdf.roundedRect(x, y, w, h, 8, 8, 'S');
      relleno(AZUL); pdf.roundedRect(x, y, w, 26, 8, 8, 'F'); pdf.rect(x, y + 14, w, 12, 'F');
      texto(`${o.meses} MESES`, x + w / 2, y + 17, 10, 'bold', [255, 255, 255], { align: 'center', charSpace: 0.8 });
      texto('Mensualidad', x + w / 2, y + 44, 8.5, 'normal', GRIS, { align: 'center' });
      texto(pesos(o.mensualidad), x + w / 2, y + 66, n > 3 ? 16 : 19, 'bold', AZUL, { align: 'center' });
      texto(`Total: ${pesos(o.total)}`, x + w / 2, y + 86, 8.5, 'normal', GRIS, { align: 'center' });
      texto(`Intereses: ${pesos(o.interes)}`, x + w / 2, y + 99, 7.5, 'normal', GRIS, { align: 'center' });
    });
    y += h + 18;
  }

  // --- Notas
  if (datos.notas?.trim()) {
    texto('NOTAS', M, y, 8.5, 'bold', ACENTO, { charSpace: 1 });
    const lineas = pdf.splitTextToSize(datos.notas.trim(), ANCHO).slice(0, 5);
    texto(lineas, M, y + 15, 9.5, 'normal', AZUL);
    y += 15 + lineas.length * 12 + 8;
  }

  // --- Leyenda: informativa y sin seguro
  const pie = H - 96;
  if (datos.forma !== 'contado') {
    const ly = Math.min(y, pie - 40);
    pdf.setFillColor(254, 243, 199); pdf.roundedRect(M, ly, ANCHO, 28, 6, 6, 'F');
    texto(pdf.splitTextToSize(LEYENDA_COTIZACION, ANCHO - 24), M + 12, ly + 17, 8.5, 'bold', [120, 53, 15]);
  }

  relleno(AZUL); pdf.rect(0, pie, W, H - pie, 'F');
  const blanco = [255, 255, 255] as const, gris = [203, 213, 225] as const;
  if (asesor?.name) {
    texto('TU ASESOR', M, pie + 22, 7.5, 'bold', gris, { charSpace: 1 });
    texto(asesor.name, M, pie + 37, 12, 'bold', blanco);
    if (asesor.email) texto(asesor.email, M, pie + 50, 8.5, 'normal', gris);
  }
  const telWa = numeroWhatsApp(asesor?.phone) || numeroWhatsApp(agencia?.phoneWhatsApp) || numeroWhatsApp(agencia?.phone);
  if (telWa) {
    const liga = `https://wa.me/${telWa}?text=${encodeURIComponent(`Hola${asesor?.name ? ` ${String(asesor.name).split(' ')[0]}` : ''}, sobre la cotización ${folio} del ${titulo}.`)}`;
    const bx = M, by = pie + 58, bw = 170, bh = 20;
    pdf.setFillColor(37, 211, 102); pdf.roundedRect(bx, by, bw, bh, 10, 10, 'F');
    if (iconoWa) pdf.addImage(iconoWa, 'PNG', bx + 6, by + 3.5, 13, 13);
    texto(`WhatsApp ${asesor?.phone || agencia?.phoneWhatsApp || agencia?.phone || ''}`.trim(), bx + 24, by + 13.5, 9, 'bold', blanco);
    pdf.link(bx, by, bw, bh, { url: liga });
  }
  if (agencia?.name) {
    texto('VISÍTANOS', M + 260, pie + 22, 7.5, 'bold', gris, { charSpace: 1 });
    texto(agencia.name, M + 260, pie + 37, 11, 'bold', blanco);
    if (agencia.address) texto(pdf.splitTextToSize(agencia.address, W - M - (M + 260))[0], M + 260, pie + 50, 8.5, 'normal', gris);
    if (agencia.phone) texto(`Tel. ${agencia.phone}`, M + 260, pie + 62, 8.5, 'normal', gris);
  }
  texto(`Cotización informativa, sujeta a disponibilidad del vehículo${datos.forma !== 'contado' ? ' y a aprobación de crédito' : ''}. Vigente hasta el ${fechaLarga(vence)}.`, M, H - 10, 7, 'normal', gris);

  pdf.setProperties({ title: `Cotización ${folio}`, subject: titulo, creator: agencia?.name || 'CRM Nextcar' });
  return pdf.output('blob');
}
