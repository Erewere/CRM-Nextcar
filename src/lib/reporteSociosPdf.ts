import { jsPDF } from 'jspdf';
import type { Vehicle } from '../types';
import { fotoCompleta, logo } from './fichaPdf';
import { coloresPdf } from './plantillasRedes';

/**
 * Reporte financiero para socios de UN auto, en PDF carta dibujado directo
 * (texto real, nítido al imprimir). Lleva a quien lo emite arriba, los datos
 * del auto con su foto, lo invertido, lo que dejó (o dejaría) con su margen y
 * retorno, el detalle de gastos y el aviso de confidencialidad. Si los gastos
 * no caben, sigue en otra hoja.
 */

export interface DatosReporteSocios {
  auto: Vehicle;
  agencia?: { name?: string; address?: string; phone?: string; logoUrl?: string; colorMarca?: string } | null;
  gastos: { date?: string; description?: string; amount?: number }[];
  costo: number;
  precioVenta: number;
  dias: number | null;
  emitidoPor?: string;
  foto?: string;
}

const NEGRO = [15, 23, 42] as const;
const GRIS = [100, 116, 139] as const;
const GRIS_CLARO = [241, 245, 249] as const;
const LINEA = [226, 232, 240] as const;
const VERDE = [4, 120, 87] as const, VERDE_FONDO = [236, 253, 245] as const, VERDE_LINEA = [167, 243, 208] as const;
const ROJO = [185, 28, 28] as const, ROJO_FONDO = [254, 242, 242] as const, ROJO_LINEA = [254, 202, 202] as const;
const AMBAR = [146, 64, 14] as const, AMBAR_FONDO = [254, 243, 199] as const;

const pesos = (n: number) => `${n < 0 ? '-' : ''}$${Math.abs(Math.round(Number(n) || 0)).toLocaleString('es-MX')}`;
const fechaCorta = (f?: string) => {
  if (!f) return '';
  const d = new Date(f.length <= 10 ? `${f}T12:00:00` : f);
  return isNaN(d.getTime()) ? f : d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
};

export async function generarReporteSocios(o: DatosReporteSocios): Promise<Blob> {
  const { auto, agencia, gastos, costo, precioVenta, dias } = o;
  const pdf = new jsPDF({ unit: 'pt', format: 'letter' });
  const W = 612, H = 792, M = 40, ANCHO = W - 2 * M, CX = W / 2;
  const col = coloresPdf(agencia?.colorMarca);
  const MARCA = col.marca;

  const t = (txt: string | string[], x: number, y: number, tam: number, estilo: 'normal' | 'bold' = 'normal', c: readonly number[] = NEGRO, opc: any = {}) => {
    pdf.setFont('helvetica', estilo); pdf.setFontSize(tam); pdf.setTextColor(c[0], c[1], c[2]); pdf.text(txt, x, y, opc);
  };
  const fill = (c: readonly number[]) => pdf.setFillColor(c[0], c[1], c[2]);
  const draw = (c: readonly number[]) => pdf.setDrawColor(c[0], c[1], c[2]);

  const totalGastos = gastos.reduce((s, g) => s + (Number(g.amount) || 0), 0);
  const inversion = costo + totalGastos;
  const utilidad = precioVenta - inversion;
  const vendido = auto.status === 'sold';
  const margen = precioVenta > 0 && costo ? (utilidad / precioVenta) * 100 : null;
  const retorno = inversion > 0 && costo ? (utilidad / inversion) * 100 : null;
  const consignacion = auto.ownership === 'consignacion';
  const bien = utilidad >= 0;

  const fotoSrc = o.foto || auto.photoUrls?.[0] || auto.photoUrl;
  const [logoAg, foto] = await Promise.all([logo(agencia?.logoUrl), fotoCompleta(fotoSrc, 190, 130)]);

  const hoy = new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
  const folio = String(auto.id || '').slice(0, 8).toUpperCase();

  const pie = (n: number, total: number) => {
    draw(LINEA); pdf.setLineWidth(0.8); pdf.line(M, H - 44, W - M, H - 44);
    t(`Documento confidencial de uso interno entre socios de ${agencia?.name || 'la agencia'}. No compartir fuera de la sociedad.`, CX, H - 30, 7.5, 'normal', GRIS, { align: 'center' });
    t(`Folio ${folio}  ·  Emitido el ${hoy}  ·  Página ${n} de ${total}`, CX, H - 19, 7.5, 'normal', GRIS, { align: 'center' });
  };

  // ---------- Encabezado ----------
  fill(MARCA); pdf.rect(0, 0, W, 10, 'F');
  let y = 34;
  if (logoAg) {
    const alto = 40, ancho = Math.min(160, alto * logoAg.ratio);
    pdf.addImage(logoAg.src, 'PNG', M, y, ancho, ancho / logoAg.ratio);
  } else {
    t(agencia?.name || 'Agencia', M, y + 26, 20, 'bold');
  }
  // Confidencial y datos del documento, a la derecha
  const etiqueta = 'CONFIDENCIAL';
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8.5);
  const wEt = pdf.getTextWidth(etiqueta) + 18;
  fill(AMBAR_FONDO); pdf.roundedRect(W - M - wEt, y, wEt, 18, 4, 4, 'F');
  t(etiqueta, W - M - wEt / 2, y + 12.5, 8.5, 'bold', AMBAR, { align: 'center' });
  t(`Emitido el ${hoy}`, W - M, y + 34, 9, 'normal', GRIS, { align: 'right' });
  t(`Folio ${folio}${o.emitidoPor ? `  ·  por ${o.emitidoPor}` : ''}`, W - M, y + 46, 8.5, 'normal', GRIS, { align: 'right' });

  y += 70;
  // Título centrado
  t('REPORTE FINANCIERO DE SOCIOS', CX, y, 17, 'bold', NEGRO, { align: 'center' });
  const sub = [agencia?.name, agencia?.address, agencia?.phone].filter(Boolean).join('  ·  ');
  if (sub) t(pdf.splitTextToSize(sub, ANCHO)[0], CX, y + 16, 9, 'normal', GRIS, { align: 'center' });
  fill(MARCA); pdf.rect(CX - 28, y + 26, 56, 3, 'F');
  y += 46;

  // ---------- El auto: foto y datos ----------
  const altoAuto = 172;
  if (foto) { pdf.addImage(foto, 'JPEG', M, y, 190, altoAuto); }
  else { fill(GRIS_CLARO); pdf.roundedRect(M, y, 190, altoAuto, 6, 6, 'F'); t('Sin foto', M + 95, y + 68, 10, 'normal', GRIS, { align: 'center' }); }
  const xd = M + 206, anchoD = ANCHO - 206;
  t(`${auto.make || ''}`.toUpperCase(), xd, y + 12, 9, 'bold', MARCA);
  const nombre = `${auto.model || ''}`;
  pdf.setFont('helvetica', 'bold'); let tamN = 19; pdf.setFontSize(tamN);
  while (pdf.getTextWidth(nombre) > anchoD && tamN > 11) { tamN -= 1; pdf.setFontSize(tamN); }
  t(nombre, xd, y + 33, tamN, 'bold');
  const estado = vendido ? 'VENDIDO' : consignacion ? 'EN CONSIGNACIÓN' : 'EN INVENTARIO';
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8);
  const wEs = pdf.getTextWidth(estado) + 14;
  fill(vendido ? VERDE_FONDO : GRIS_CLARO); pdf.roundedRect(xd, y + 42, wEs, 15, 7.5, 7.5, 'F');
  t(estado, xd + wEs / 2, y + 52.5, 8, 'bold', vendido ? VERDE : GRIS, { align: 'center' });

  const datos: [string, string][] = ([
    ['Año', auto.year ? String(auto.year) : ''],
    ['Color', auto.color || ''],
    ['Kilometraje', auto.km ? `${Number(auto.km).toLocaleString('es-MX')} km` : ''],
    ['Placas', (auto as any).licensePlate || auto.checklist?.platesAndCard || ''],
    ['Ingreso', fechaCorta(auto.receivedAt)],
    [vendido ? 'Vendido el' : 'Días en inventario', vendido ? fechaCorta(auto.soldAt) : dias !== null ? `${dias} días` : ''],
    ['VIN / serie', auto.vin ? String(auto.vin).toUpperCase() : ''],
    [vendido ? 'Comprador' : 'Origen', vendido ? (auto.buyerName || '') : consignacion ? 'Consignación' : 'Compra propia'],
  ] as [string, string][]).filter(([, v]) => v);
  const cw = anchoD / 2;
  datos.forEach(([k, v], i) => {
    const cx = xd + (i % 2) * cw, cy = y + 78 + Math.floor(i / 2) * 25;
    t(k.toUpperCase(), cx, cy, 7, 'bold', GRIS);
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10.5);
    t(pdf.splitTextToSize(v, cw - 10)[0], cx, cy + 12, 10.5, 'bold');
  });
  y += altoAuto + 18;

  // ---------- Lo invertido y lo vendido ----------
  const cajas: [string, string, readonly number[]][] = [
    [vendido ? 'PRECIO DE VENTA' : 'PRECIO DE VENTA (LISTA)', pesos(precioVenta), NEGRO],
    [consignacion ? 'PAGO AL DUEÑO' : 'COSTO DE COMPRA', costo ? pesos(costo) : 'Falta', costo ? NEGRO : AMBAR],
    [`GASTOS (${gastos.length})`, pesos(totalGastos), ROJO],
    ['INVERSIÓN TOTAL', pesos(inversion), NEGRO],
  ];
  const gap = 10, cwk = (ANCHO - gap * 3) / 4;
  cajas.forEach(([k, v, c], i) => {
    const x = M + i * (cwk + gap);
    fill(GRIS_CLARO); pdf.roundedRect(x, y, cwk, 56, 8, 8, 'F');
    t(k, x + cwk / 2, y + 18, 7, 'bold', GRIS, { align: 'center' });
    pdf.setFont('helvetica', 'bold'); let tam = 17; pdf.setFontSize(tam);
    while (pdf.getTextWidth(v) > cwk - 14 && tam > 10) { tam -= 1; pdf.setFontSize(tam); }
    t(v, x + cwk / 2, y + 42, tam, 'bold', c, { align: 'center' });
  });
  y += 56 + 14;

  // ---------- Utilidad ----------
  const altoUt = 96;
  fill(bien ? VERDE_FONDO : ROJO_FONDO); draw(bien ? VERDE_LINEA : ROJO_LINEA); pdf.setLineWidth(1.2);
  pdf.roundedRect(M, y, ANCHO, altoUt, 10, 10, 'FD');
  t(`UTILIDAD BRUTA PARA SOCIOS${vendido ? '' : ' (PROYECTADA)'}`, M + 22, y + 28, 11, 'bold');
  t('Precio de venta - costo - gastos', M + 22, y + 43, 8.5, 'normal', GRIS);
  const cu = bien ? VERDE : ROJO;
  const hayCosto = costo > 0;
  t(hayCosto ? pesos(utilidad) : '—', W - M - 22, y + 48, 32, 'bold', hayCosto ? cu : GRIS, { align: 'right' });
  // métricas debajo, en tres columnas centradas
  const ms: [string, string][] = [
    ['MARGEN SOBRE LA VENTA', margen === null ? '—' : `${margen.toFixed(1)}%`],
    ['RETORNO SOBRE LO INVERTIDO', retorno === null ? '—' : `${retorno.toFixed(1)}%`],
    ['UTILIDAD POR DÍA EN PISO', hayCosto && dias ? pesos(utilidad / Math.max(1, dias)) : '—'],
  ];
  const cm = (ANCHO - 44) / 3;
  ms.forEach(([k, v], i) => {
    const x = M + 22 + i * cm + cm / 2;
    if (i) { draw(bien ? VERDE_LINEA : ROJO_LINEA); pdf.setLineWidth(0.8); pdf.line(M + 22 + i * cm, y + 60, M + 22 + i * cm, y + 86); }
    t(k, x, y + 68, 6.5, 'bold', GRIS, { align: 'center' });
    t(v, x, y + 83, 12, 'bold', NEGRO, { align: 'center' });
  });
  y += altoUt + 22;

  // ---------- Gastos ----------
  const lista = [...gastos].sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
  const encabezadoTabla = () => {
    t('DETALLE DE GASTOS', M, y, 9, 'bold', MARCA);
    y += 8;
    fill(NEGRO); pdf.roundedRect(M, y, ANCHO, 22, 4, 4, 'F');
    t('FECHA', M + 12, y + 14.5, 8, 'bold', [255, 255, 255]);
    t('CONCEPTO', M + 110, y + 14.5, 8, 'bold', [255, 255, 255]);
    t('MONTO', W - M - 12, y + 14.5, 8, 'bold', [255, 255, 255], { align: 'right' });
    y += 22;
  };
  encabezadoTabla();
  const LIMITE = H - 60;
  let hoja = 1;
  const hojas: number[] = [];
  if (!lista.length) {
    t('No se registraron gastos para este vehículo.', CX, y + 28, 10, 'normal', GRIS, { align: 'center' });
    y += 44;
  }
  lista.forEach((g, i) => {
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10);
    const lineas: string[] = pdf.splitTextToSize(g.description || 'Gasto', ANCHO - 110 - 110);
    const alto = Math.max(22, lineas.length * 12 + 10);
    if (y + alto > LIMITE - 26) {
      hojas.push(hoja); pie(hoja, 0);
      pdf.addPage('letter', 'portrait'); hoja++;
      fill(MARCA); pdf.rect(0, 0, W, 10, 'F');
      y = 40; encabezadoTabla();
    }
    if (i % 2 === 0) { fill(GRIS_CLARO); pdf.rect(M, y, ANCHO, alto, 'F'); }
    t(fechaCorta(g.date), M + 12, y + 15, 9, 'normal', GRIS);
    t(lineas, M + 110, y + 15, 10, 'normal');
    t(pesos(Number(g.amount) || 0), W - M - 12, y + 15, 10, 'bold', ROJO, { align: 'right' });
    y += alto;
  });
  if (lista.length) {
    if (y + 30 > LIMITE) { hojas.push(hoja); pie(hoja, 0); pdf.addPage('letter', 'portrait'); hoja++; fill(MARCA); pdf.rect(0, 0, W, 10, 'F'); y = 40; }
    draw(NEGRO); pdf.setLineWidth(1.2); pdf.line(M, y, W - M, y);
    t('TOTAL DE GASTOS', M + 12, y + 18, 10, 'bold');
    t(pesos(totalGastos), W - M - 12, y + 18, 11, 'bold', ROJO, { align: 'right' });
  }
  hojas.push(hoja);
  // Pie de cada hoja con el total de páginas (se pintan al final, ya sabiendo cuántas son).
  const total = hoja;
  for (let p = 1; p <= total; p++) {
    pdf.setPage(p);
    // tapa el pie provisional de las hojas ya cerradas y dibuja el definitivo
    fill([255, 255, 255]); pdf.rect(0, H - 50, W, 50, 'F');
    pie(p, total);
  }

  pdf.setProperties({ title: `Reporte para socios — ${[auto.year, auto.make, auto.model].filter(Boolean).join(' ')}`, subject: 'Reporte financiero de socios', creator: agencia?.name || 'CRM Nextcar' });
  return pdf.output('blob');
}
