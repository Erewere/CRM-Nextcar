import { jsPDF } from 'jspdf';
import type { Vehicle } from '../types';
import { fotoCompleta, iconoWhatsApp, logo, numeroWhatsApp, planDeCredito } from './fichaPdf';

/**
 * Lista de precios en PDF: todos los autos disponibles en una tabla, con foto
 * chica, datos clave, precio y enganche desde. Tamaño carta, para mandarla
 * por WhatsApp o tenerla impresa en el piso. Texto real (no captura), así que
 * se ve nítida y pesa poco; cada auto con liga en la página se puede tocar.
 */

export type OrdenLista = 'precio' | 'marca' | 'anio' | 'tipo';

export interface OpcionesLista {
  autos: Vehicle[];
  agencia?: { name?: string; address?: string; phone?: string; phoneWhatsApp?: string; logoUrl?: string } | null;
  asesor?: { name?: string; phone?: string } | null;
  conFotos: boolean;
  conCredito: boolean;
  orden: OrdenLista;
  alAvanzar?: (hechas: number, total: number) => void;
}

const AZUL = [15, 23, 42] as const;
const ACENTO = [29, 78, 216] as const;
const GRIS = [71, 85, 105] as const;
const LINEA = [226, 232, 240] as const;
const pesos = (n: number) => `$${Math.round(Number(n) || 0).toLocaleString('es-MX')}`;

export function ordenarParaLista(autos: Vehicle[], orden: OrdenLista) {
  const t = (v: Vehicle) => `${v.make || ''} ${v.model || ''}`.toLowerCase();
  return [...autos].sort((a, b) => {
    if (orden === 'precio') return (Number(a.price) || 0) - (Number(b.price) || 0);
    if (orden === 'anio') return (Number(b.year) || 0) - (Number(a.year) || 0) || t(a).localeCompare(t(b));
    if (orden === 'tipo') return String(a.bodyType || 'zz').localeCompare(String(b.bodyType || 'zz')) || (Number(a.price) || 0) - (Number(b.price) || 0);
    return t(a).localeCompare(t(b)) || (Number(b.year) || 0) - (Number(a.year) || 0);
  });
}

/** Carga varias fotos a la vez, sin saturar: de 6 en 6. */
async function fotosChicas(autos: Vehicle[], w: number, h: number, alAvanzar?: (a: number, b: number) => void) {
  const res: string[] = new Array(autos.length).fill('');
  let hechas = 0, i = 0;
  const trabajar = async () => {
    while (i < autos.length) {
      const k = i++;
      const v = autos[k];
      const url = v.photoUrls?.[0] || v.photoUrl;
      res[k] = url ? await fotoCompleta(url, w, h, 2).catch(() => '') : '';
      alAvanzar?.(++hechas, autos.length);
    }
  };
  await Promise.all(Array.from({ length: 6 }, trabajar));
  return res;
}

export async function generarListaPrecios({ autos, agencia, asesor, conFotos, conCredito, orden, alAvanzar }: OpcionesLista): Promise<Blob> {
  const lista = ordenarParaLista(autos, orden);
  const pdf = new jsPDF({ unit: 'pt', format: 'letter' });
  const W = 612, H = 792, M = 32, ANCHO = W - M * 2;
  const FOTO_W = 64, FOTO_H = 48;
  const FILA = conFotos ? 56 : 30;

  const color = (c: readonly number[]) => pdf.setTextColor(c[0], c[1], c[2]);
  const texto = (t: string | string[], x: number, y: number, tam: number, estilo: 'normal' | 'bold' = 'normal', c: readonly number[] = AZUL, opc: any = {}) => {
    pdf.setFont('helvetica', estilo); pdf.setFontSize(tam); color(c); pdf.text(t, x, y, opc);
  };

  const [miniaturas, logoAg, iconoWa] = await Promise.all([
    conFotos ? fotosChicas(lista, FOTO_W, FOTO_H, alAvanzar) : Promise.resolve([] as string[]),
    logo(agencia?.logoUrl),
    iconoWhatsApp(),
  ]);

  const hoy = new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
  const telWa = numeroWhatsApp(asesor?.phone) || numeroWhatsApp(agencia?.phoneWhatsApp) || numeroWhatsApp(agencia?.phone);
  const ligaWa = telWa ? `https://wa.me/${telWa}?text=${encodeURIComponent('Hola, vi su lista de precios y me interesa un auto.')}` : '';

  // Columnas
  const cFoto = M;
  const cAuto = conFotos ? M + FOTO_W + 12 : M;
  const cKm = M + 270;
  const cTrans = M + 330;
  const cPrecio = W - M;                       // alineado a la derecha
  const cCredito = conCredito ? W - M - 100 : 0; // alineado a la derecha
  const anchoAuto = cKm - cAuto - 10;

  let pagina = 0;
  const encabezado = () => {
    pagina++;
    pdf.setFillColor(255, 255, 255); pdf.rect(0, 0, W, H, 'F');
    // Franja de color y encabezado: logo grande, nombre de la agencia a su lado.
    pdf.setFillColor(AZUL[0], AZUL[1], AZUL[2]); pdf.rect(0, 0, W, 6, 'F');
    pdf.setFillColor(ACENTO[0], ACENTO[1], ACENTO[2]); pdf.rect(0, 6, W, 2, 'F');
    let y = 24;
    const ALTO_LOGO = 56;
    let xNombre = M;
    if (logoAg) {
      const ancho = Math.min(175, ALTO_LOGO * logoAg.ratio);
      const alto = ancho / logoAg.ratio;
      pdf.addImage(logoAg.src, 'PNG', M, y + (ALTO_LOGO - alto) / 2, ancho, alto);
      xNombre = M + ancho + 16;
    }
    // El nombre y los datos bajan de renglón en vez de cortarse.
    const anchoNombre = W - M - 150 - xNombre;
    if (agencia?.name) {
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(16);
      const nombre = pdf.splitTextToSize(agencia.name, anchoNombre).slice(0, 2) as string[];
      let yy = y + (nombre.length > 1 ? 16 : 22);
      nombre.forEach((l) => { texto(l, xNombre, yy, 16, 'bold', AZUL); yy += 17; });
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8.5);
      const datos = [agencia.phone ? `Tel. ${agencia.phone}` : '', agencia.address || ''].filter(Boolean);
      datos.slice(0, nombre.length > 1 ? 1 : 2).forEach((d) => { texto(pdf.splitTextToSize(d, anchoNombre)[0], xNombre, yy - 2, 8.5, 'normal', GRIS); yy += 11; });
    }
    texto('LISTA DE PRECIOS', W - M, y + 22, 13, 'bold', AZUL, { align: 'right' });
    texto(`${lista.length} autos disponibles`, W - M, y + 37, 9, 'normal', GRIS, { align: 'right' });
    texto(hoy, W - M, y + 49, 9, 'normal', GRIS, { align: 'right' });
    y += ALTO_LOGO + 12;
    pdf.setFillColor(ACENTO[0], ACENTO[1], ACENTO[2]); pdf.rect(M, y, 46, 3, 'F');
    pdf.setDrawColor(LINEA[0], LINEA[1], LINEA[2]); pdf.setLineWidth(0.6); pdf.line(M + 50, y + 1.5, W - M, y + 1.5);
    y += 20;
    // Títulos de columna
    texto('AUTO', cAuto, y, 7.5, 'bold', GRIS, { charSpace: 0.6 });
    texto('KM', cKm, y, 7.5, 'bold', GRIS, { charSpace: 0.6 });
    texto('TRANSMISIÓN', cTrans, y, 7.5, 'bold', GRIS, { charSpace: 0.6 });
    if (conCredito) texto('ENGANCHE', cCredito, y, 7.5, 'bold', GRIS, { align: 'right' });
    texto('PRECIO', cPrecio, y, 7.5, 'bold', GRIS, { align: 'right' });
    return y + 8;
  };

  const pie = () => {
    const y = H - 52;
    pdf.setDrawColor(LINEA[0], LINEA[1], LINEA[2]); pdf.setLineWidth(0.6); pdf.line(M, y, W - M, y);
    const anchoTexto = ligaWa ? W - M * 2 - 200 : ANCHO - 30;
    texto([agencia?.name, agencia?.phone ? `Tel. ${agencia.phone}` : ''].filter(Boolean).join('  ·  '), M, y + 15, 8.5, 'bold', AZUL);
    if (agencia?.address) { pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); texto(pdf.splitTextToSize(agencia.address, anchoTexto)[0], M, y + 27, 8, 'normal', GRIS); }
    texto('Precios sujetos a cambio y a disponibilidad sin previo aviso.' + (conCredito ? ' Crédito sujeto a aprobación.' : ''), M, y + 39, 7, 'normal', GRIS);
    if (ligaWa) {
      const bw = 150, bx = W - M - bw - 30, by = y + 12, bh = 18;
      pdf.setFillColor(37, 211, 102); pdf.roundedRect(bx, by, bw, bh, 9, 9, 'F');
      if (iconoWa) pdf.addImage(iconoWa, 'PNG', bx + 5, by + 3, 12, 12);
      texto(`WhatsApp ${asesor?.phone || agencia?.phoneWhatsApp || agencia?.phone || ''}`.trim(), bx + 21, by + 12.5, 8.5, 'bold', [255, 255, 255]);
      pdf.link(bx, by, bw, bh, { url: ligaWa });
    }
    texto(`${pagina}`, W - M, y + 24, 8, 'normal', GRIS, { align: 'right' });
  };

  let y = encabezado();
  let tipoActual = '';
  lista.forEach((v, i) => {
    const tipo = orden === 'tipo' ? (v.bodyType || 'Otros') : '';
    const extra = tipo && tipo !== tipoActual ? 22 : 0;
    if (y + FILA + extra > H - 60) { pie(); pdf.addPage(); y = encabezado(); tipoActual = ''; }
    if (tipo && tipo !== tipoActual) {
      tipoActual = tipo;
      y += 16;
      texto(tipo.toUpperCase(), M, y, 8.5, 'bold', ACENTO, { charSpace: 1 });
      y += 6;
    }
    // Fila
    if (i % 2 === 1) { pdf.setFillColor(248, 250, 252); pdf.rect(M - 4, y, ANCHO + 8, FILA, 'F'); }
    const centro = y + FILA / 2;
    if (conFotos) {
      if (miniaturas[i]) pdf.addImage(miniaturas[i], 'JPEG', cFoto, y + (FILA - FOTO_H) / 2, FOTO_W, FOTO_H);
      else { pdf.setFillColor(241, 245, 249); pdf.rect(cFoto, y + (FILA - FOTO_H) / 2, FOTO_W, FOTO_H, 'F'); }
    }
    // Se mide con la letra con que se escribe: si el nombre completo no cabe
    // en su columna, el modelo baja al segundo renglón.
    const titulo = `${v.year || ''} ${v.make || ''}`.trim();
    const completo = `${titulo} ${v.model || ''}`.trim();
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(conFotos ? 10.5 : 10);
    const cabe = pdf.getTextWidth(completo) <= anchoAuto;
    if (conFotos) {
      texto(cabe ? completo : titulo, cAuto, centro - 4, 10.5, 'bold');
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8.5);
      const sub = [cabe ? '' : v.model, v.color, v.bodyType && orden !== 'tipo' ? v.bodyType : ''].filter(Boolean).join(' · ');
      texto(pdf.splitTextToSize(sub, anchoAuto)[0] || '', cAuto, centro + 10, 8.5, 'normal', GRIS);
    } else {
      texto(pdf.splitTextToSize(completo, anchoAuto)[0], cAuto, centro + 3.5, 10, 'bold');
    }
    texto(v.km ? `${Number(v.km).toLocaleString('es-MX')}` : '—', cKm, centro + 3.5, 9.5, 'normal', AZUL);
    texto(v.transmission || '—', cTrans, centro + 3.5, 9.5, 'normal', AZUL);
    if (conCredito) {
      const plan = planDeCredito(Number(v.year), Number(v.price));
      texto(plan ? pesos(plan.enganche) : '—', cCredito, centro + 3.5, 9.5, 'normal', GRIS, { align: 'right' });
    }
    texto(pesos(v.price), cPrecio, centro + 4, 12, 'bold', AZUL, { align: 'right' });
    if ((v as any).status === 'reserved') texto('APARTADO', cPrecio, centro + 15, 6.5, 'bold', [180, 83, 9], { align: 'right' });
    // Toda la fila lleva a la publicación, si tiene.
    if (v.websiteUrl) pdf.link(M - 4, y, ANCHO + 8, FILA, { url: v.websiteUrl });
    y += FILA;
  });
  pie();

  pdf.setProperties({ title: `Lista de precios ${agencia?.name || ''}`.trim(), creator: agencia?.name || 'CRM Nextcar' });
  return pdf.output('blob');
}
