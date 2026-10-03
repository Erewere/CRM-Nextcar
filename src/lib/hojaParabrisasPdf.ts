import { jsPDF } from 'jspdf';
import type { Vehicle } from '../types';
import { codigoQR, logo, numeroWhatsApp, planDeCredito } from './fichaPdf';

/**
 * Hoja para el parabrisas: tamaño carta, para pegarla por dentro del vidrio.
 * Letras muy grandes (se lee desde fuera, a unos metros), sin foto (el auto
 * está ahí mismo) y fondo blanco para no gastar tóner. El código QR lleva a
 * la página del auto o, si no tiene, al WhatsApp de la agencia con el mensaje
 * escrito.
 *
 * Varias hojas van en un solo PDF, una página por auto.
 */

export interface DatosHoja {
  autos: Vehicle[];
  agencia?: { name?: string; address?: string; phone?: string; phoneWhatsApp?: string; logoUrl?: string } | null;
  asesor?: { name?: string; phone?: string } | null;
  conCredito?: boolean;
  alAvanzar?: (hecho: number, total: number) => void;
}

const W = 612, H = 792, M = 36;
const NEGRO = [15, 23, 42] as const;
const ACENTO = [29, 78, 216] as const;
const GRIS = [71, 85, 105] as const;
const LINEA = [203, 213, 225] as const;
const ROJO = [185, 28, 28] as const;
const VERDE = [21, 128, 61] as const;

const pesos = (n: number) => `$${Math.round(Number(n) || 0).toLocaleString('es-MX')}`;

/** Mensualidad aproximada del plan de referencia (tasa anual, pago fijo). */
export function mensualidadAprox(precio: number, plan: { enganche: number; plazo: number; tasa: string } | null) {
  if (!plan || !precio) return 0;
  const monto = Math.max(0, precio - plan.enganche);
  const i = (parseFloat(plan.tasa) || 0) / 100 / 12;
  return i > 0 ? (monto * i) / (1 - Math.pow(1 + i, -plan.plazo)) : monto / plan.plazo;
}

/** Ajusta el tamaño de letra hasta que el texto quepa en el ancho. */
function ajustar(pdf: jsPDF, texto: string, ancho: number, max: number, min: number) {
  let t = max;
  pdf.setFontSize(t);
  while (pdf.getTextWidth(texto) > ancho && t > min) { t -= 1; pdf.setFontSize(t); }
  return t;
}

function telBonito(tel: string) {
  const n = String(tel || '').replace(/\D/g, '').slice(-10);
  return n.length === 10 ? `${n.slice(0, 2)} ${n.slice(2, 6)} ${n.slice(6)}` : tel;
}

async function pagina(pdf: jsPDF, auto: Vehicle, o: DatosHoja, logoAg: { src: string; ratio: number } | null) {
  const ag = o.agencia || {};
  const tel = ag.phoneWhatsApp || ag.phone || o.asesor?.phone || '';
  const num = numeroWhatsApp(tel);
  const titulo = `${auto.make || ''} ${auto.model || ''}`.trim().toUpperCase();
  const ficha: any = auto.fichaWeb || {};
  const precio = Number(auto.price) || 0;
  const antes = Number(ficha.precioAnterior) > precio ? Number(ficha.precioAnterior) : 0;
  const plan = o.conCredito === false ? null : planDeCredito(Number(auto.year), precio);
  const mensual = Math.round(mensualidadAprox(precio, plan));

  // --- Encabezado: logo y nombre de la agencia
  let y = M;
  if (logoAg) {
    const h = Math.min(48, 170 / logoAg.ratio), w = h * logoAg.ratio;
    pdf.addImage(logoAg.src, 'PNG', M, y, w, h);
  } else if (ag.name) {
    pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...NEGRO); pdf.setFontSize(20);
    pdf.text(ag.name, M, y + 30);
  }
  pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...ACENTO); pdf.setFontSize(26);
  pdf.text('¡SE VENDE!', W - M, y + 32, { align: 'right' });
  y += 62;
  pdf.setDrawColor(...ACENTO); pdf.setLineWidth(3); pdf.line(M, y, W - M, y);

  // --- Año, marca y modelo, en grande. Si el nombre no cabe en un renglón,
  // va en dos y más chico, para que todo lo demás quepa en la hoja.
  y += 42;
  pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...ACENTO); pdf.setFontSize(34);
  pdf.text(String(auto.year || ''), M, y);
  pdf.setTextColor(...NEGRO);
  let t = ajustar(pdf, titulo, W - 2 * M, 64, 44);
  if (pdf.getTextWidth(titulo) > W - 2 * M) {
    t = 46; pdf.setFontSize(t);
    let lineas = pdf.splitTextToSize(titulo, W - 2 * M);
    while (lineas.length > 2 && t > 30) { t -= 2; pdf.setFontSize(t); lineas = pdf.splitTextToSize(titulo, W - 2 * M); }
    lineas.slice(0, 2).forEach((l: string) => { y += t * 0.98; pdf.text(l, M, y); });
  } else {
    y += t * 0.98; pdf.text(titulo, M, y);
  }
  const sub = [(auto as any).version, auto.color, auto.bodyType].filter(Boolean).join(' · ');
  if (sub) {
    y += 24; pdf.setFont('helvetica', 'normal'); pdf.setFontSize(17); pdf.setTextColor(...GRIS);
    pdf.text(sub, M, y, { maxWidth: W - 2 * M });
  }

  // --- Precio, en un recuadro con borde (sin relleno: no gasta tóner)
  y += 18;
  const altoPrecio = 114;
  pdf.setDrawColor(...NEGRO); pdf.setLineWidth(4);
  pdf.roundedRect(M, y, W - 2 * M, altoPrecio, 14, 14, 'S');
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(15); pdf.setTextColor(...GRIS);
  pdf.text('PRECIO', M + 22, y + 30);
  if (antes) {
    const ta = `Antes ${pesos(antes)}`;
    pdf.setFontSize(18); pdf.setTextColor(...ROJO);
    pdf.text(ta, W - M - 22, y + 30, { align: 'right' });
    const wa = pdf.getTextWidth(ta);
    pdf.setDrawColor(...ROJO); pdf.setLineWidth(1.6);
    pdf.line(W - M - 22 - wa, y + 24, W - M - 22, y + 24);
  }
  pdf.setTextColor(...NEGRO);
  ajustar(pdf, pesos(precio), W - 2 * M - 44, 76, 46);
  pdf.text(pesos(precio), W / 2, y + altoPrecio - 20, { align: 'center' });
  y += altoPrecio;

  // --- Crédito: enganche y mensualidad
  if (plan) {
    y += 12;
    const ancho = (W - 2 * M - 14) / 2, alto = 78;
    const caja = (x: number, etiqueta: string, valor: string, nota: string) => {
      pdf.setDrawColor(...LINEA); pdf.setLineWidth(1.5);
      pdf.roundedRect(x, y, ancho, alto, 10, 10, 'S');
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(12); pdf.setTextColor(...GRIS);
      pdf.text(etiqueta, x + 16, y + 20);
      pdf.setTextColor(...ACENTO);
      ajustar(pdf, valor, ancho - 32, 30, 18);
      pdf.text(valor, x + 16, y + 52);
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10.5); pdf.setTextColor(...GRIS);
      pdf.text(nota, x + 16, y + 69);
    };
    caja(M, 'ENGANCHE DESDE', pesos(plan.enganche), `${Math.round(plan.pctEnganche)}% del precio`);
    caja(M + ancho + 14, 'MENSUALIDAD APROX.', pesos(mensual), `a ${plan.plazo} meses · tasa ${plan.tasa} anual`);
    y += alto;
  }

  // --- Datos clave en cuadrícula
  const motor = ficha.motor || [auto.liters ? `${Number(auto.liters).toFixed(1)} L` : '', auto.cylinders ? `${auto.cylinders} cil.` : ''].filter(Boolean).join(' ');
  const datos: [string, string][] = ([
    ['Kilometraje', auto.km ? `${Number(auto.km).toLocaleString('es-MX')} km` : ''],
    ['Transmisión', auto.transmission || ''],
    ['Motor', motor],
    ['Combustible', ficha.combustible || ''],
    ['Pasajeros', auto.passengers ? String(auto.passengers) : ''],
    ['Tracción', ficha.traccion || ''],
  ] as [string, string][]).filter(([, v]) => v).slice(0, 6);
  // El pie va fijo abajo: si no caben dos renglones de datos, va uno.
  const pieY = H - M - 140;
  const filasQueCaben = Math.floor((pieY - 14 - (y + 24) + 18) / 46);
  datos.splice(Math.max(0, filasQueCaben) * 3);
  if (datos.length) {
    y += 24;
    const cols = 3, anchoCol = (W - 2 * M) / cols;
    datos.forEach(([e, v], i) => {
      const cx = M + (i % cols) * anchoCol, cy = y + Math.floor(i / cols) * 50;
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(11); pdf.setTextColor(...GRIS);
      pdf.text(e.toUpperCase(), cx, cy);
      pdf.setTextColor(...NEGRO);
      ajustar(pdf, v, anchoCol - 12, 21, 12);
      pdf.text(v, cx, cy + 22);
    });
    y += Math.ceil(datos.length / cols) * 46 - 18;
  }

  // --- Lo que nos encanta (si hay espacio)
  const ideas = String(ficha.loQueNosEncanta || '').split(/\n+/).map((s) => s.trim()).filter(Boolean);
  if (ideas.length && y + 22 + 24 + 19 < pieY - 6) {
    y += 22;
    pdf.setDrawColor(...LINEA); pdf.setLineWidth(1); pdf.line(M, y, W - M, y);
    y += 24;
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(15);
    for (const idea of ideas) {
      const lineas = pdf.splitTextToSize(idea, W - 2 * M - 26);
      if (y + lineas.length * 19 > pieY - 6) break;
      pdf.setFillColor(...VERDE); pdf.circle(M + 6, y - 5, 4, 'F');
      pdf.setTextColor(...NEGRO);
      lineas.forEach((l: string, k: number) => pdf.text(l, M + 22, y + k * 19));
      y += lineas.length * 19 + 6;
    }
  }

  // --- Pie: código QR y WhatsApp
  const liga = auto.websiteUrl
    || (num ? `https://wa.me/${num}?text=${encodeURIComponent(`Hola, me interesa el ${auto.year} ${auto.make} ${auto.model} que vi en su lote.`)}` : '');
  const qr = liga ? await codigoQR(liga) : '';
  pdf.setDrawColor(...ACENTO); pdf.setLineWidth(3); pdf.line(M, pieY, W - M, pieY);
  const lado = 112;
  let x = M;
  if (qr) {
    pdf.addImage(qr, 'PNG', M, pieY + 14, lado, lado);
    x = M + lado + 22;
  }
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(14); pdf.setTextColor(...GRIS);
  pdf.text(qr ? (auto.websiteUrl ? 'Escanea para ver fotos y más datos' : 'Escanea para escribirnos por WhatsApp') : 'Escríbenos por WhatsApp', x, pieY + 34);
  if (tel) {
    pdf.setTextColor(...VERDE);
    ajustar(pdf, `WhatsApp ${telBonito(tel)}`, W - M - x, 34, 20);
    pdf.text(`WhatsApp ${telBonito(tel)}`, x, pieY + 74);
  }
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(11); pdf.setTextColor(...GRIS);
  const lineaAg = [ag.name, ag.address].filter(Boolean).join(' · ');
  if (lineaAg) pdf.text(pdf.splitTextToSize(lineaAg, W - M - x).slice(0, 2), x, pieY + 98);
  pdf.setFontSize(8.5);
  pdf.text(
    plan ? 'Precio sujeto a cambio sin previo aviso. Crédito sujeto a aprobación; mensualidad aproximada, no incluye seguro.'
      : 'Precio sujeto a cambio sin previo aviso.',
    W / 2, H - M + 14, { align: 'center' }
  );
}

export async function generarHojasParabrisas(o: DatosHoja): Promise<Blob> {
  const pdf = new jsPDF({ unit: 'pt', format: 'letter' });
  const logoAg = await logo(o.agencia?.logoUrl || undefined);
  for (let i = 0; i < o.autos.length; i++) {
    if (i > 0) pdf.addPage('letter', 'portrait');
    o.alAvanzar?.(i + 1, o.autos.length);
    await pagina(pdf, o.autos[i], o, logoAg);
  }
  return pdf.output('blob');
}
