import { jsPDF } from 'jspdf';
import { renderToStaticMarkup } from 'react-dom/server';
import { QRCodeSVG } from 'qrcode.react';
import type { Vehicle } from '../types';

/**
 * Ficha del auto en PDF, dibujada directo (texto real, no una captura de
 * pantalla): se ve nítida al imprimir o hacer zoom, el texto se puede
 * seleccionar y el archivo pesa poco. Tamaño carta, fondo blanco para no
 * gastar tóner.
 *
 * Las fotos y el logo pasan por /api/proxy-image: el navegador no puede leer
 * los bytes de Firebase Storage directo (CORS).
 */

export interface DatosFicha {
  auto: Vehicle;
  agencia?: { name?: string; address?: string; phone?: string; phoneWhatsApp?: string; logoUrl?: string } | null;
  asesor?: { name?: string; phone?: string; email?: string } | null;
}

const AZUL = [15, 23, 42] as const;      // #0f172a
const ACENTO = [29, 78, 216] as const;   // #1d4ed8
const GRIS = [71, 85, 105] as const;     // #475569
const GRIS_CLARO = [241, 245, 249] as const;
const LINEA = [226, 232, 240] as const;

const pesos = (n: number) => `$${Math.round(Number(n) || 0).toLocaleString('es-MX')}`;

/** Plan de crédito de referencia por año del auto (el mismo que usaba la ficha anterior). */
export function planDeCredito(year: number, price: number) {
  const planes: Record<number, { plazo: number; enganche: number; tasa: string }> = {
    2014: { plazo: 12, enganche: 0.5, tasa: '30.00%' }, 2015: { plazo: 18, enganche: 0.5, tasa: '30.00%' },
    2016: { plazo: 60, enganche: 0.2, tasa: '30.00%' }, 2017: { plazo: 60, enganche: 0.2, tasa: '14.99%' },
    2018: { plazo: 60, enganche: 0.2, tasa: '14.99%' }, 2019: { plazo: 60, enganche: 0.2, tasa: '13.99%' },
    2020: { plazo: 60, enganche: 0.2, tasa: '13.99%' }, 2021: { plazo: 60, enganche: 0.2, tasa: '13.99%' },
    2022: { plazo: 72, enganche: 0.2, tasa: '13.99%' }, 2023: { plazo: 84, enganche: 0.2, tasa: '13.99%' },
    2024: { plazo: 96, enganche: 0.2, tasa: '13.99%' }, 2025: { plazo: 120, enganche: 0.2, tasa: '13.99%' },
    2026: { plazo: 120, enganche: 0.2, tasa: '13.99%' },
  };
  if (!year || year < 2014 || !price) return null;
  const p = planes[Math.min(year, 2026)];
  return p ? { enganche: price * p.enganche, pctEnganche: p.enganche * 100, plazo: p.plazo, tasa: p.tasa } : null;
}

async function aDataUrl(url?: string): Promise<string> {
  if (!url) return '';
  if (url.startsWith('data:')) return url;
  try {
    const r = await fetch(/^https?:\/\//.test(url) ? `/api/proxy-image?url=${encodeURIComponent(url)}` : url);
    if (!r.ok) return '';
    const b = await r.blob();
    return await new Promise((ok) => { const fr = new FileReader(); fr.onloadend = () => ok(String(fr.result || '')); fr.onerror = () => ok(''); fr.readAsDataURL(b); });
  } catch { return ''; }
}

function cargar(src: string): Promise<HTMLImageElement | null> {
  return new Promise((ok) => { if (!src) return ok(null); const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; });
}

/** Recorta la foto para llenar el recuadro (como object-fit: cover) y la devuelve en JPG. */
async function fotoRecortada(url: string | undefined, ancho: number, alto: number, escala = 2): Promise<string> {
  const img = await cargar(await aDataUrl(url));
  if (!img) return '';
  const c = document.createElement('canvas');
  c.width = Math.round(ancho * escala); c.height = Math.round(alto * escala);
  const ctx = c.getContext('2d')!;
  const r = Math.max(c.width / img.width, c.height / img.height);
  const w = img.width * r, h = img.height * r;
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, (c.width - w) / 2, (c.height - h) / 2, w, h);
  return c.toDataURL('image/jpeg', 0.86);
}

/** El logo sin recortar, en PNG (conserva la transparencia), y su proporción. */
async function logo(url?: string): Promise<{ src: string; ratio: number } | null> {
  const img = await cargar(await aDataUrl(url));
  if (!img) return null;
  const c = document.createElement('canvas');
  const r = Math.min(1, 600 / img.width);
  c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  return { src: c.toDataURL('image/png'), ratio: img.width / img.height };
}

async function codigoQR(texto: string): Promise<string> {
  let svg = renderToStaticMarkup(<QRCodeSVG value={texto} size={240} level="M" />);
  // Como imagen suelta, el navegador solo carga el SVG si declara su espacio de nombres.
  if (!svg.includes('xmlns=')) svg = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  const img = await cargar(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
  if (!img) return '';
  const c = document.createElement('canvas');
  c.width = 240; c.height = 240;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 240, 240);
  ctx.drawImage(img, 0, 0, 240, 240);
  return c.toDataURL('image/png');
}

export async function generarFichaPdf({ auto, agencia, asesor }: DatosFicha): Promise<Blob> {
  const pdf = new jsPDF({ unit: 'pt', format: 'letter' });
  const W = 612, H = 792, M = 36, ANCHO = W - M * 2;
  const color = (c: readonly number[]) => pdf.setTextColor(c[0], c[1], c[2]);
  const relleno = (c: readonly number[]) => pdf.setFillColor(c[0], c[1], c[2]);
  const trazo = (c: readonly number[]) => pdf.setDrawColor(c[0], c[1], c[2]);
  const texto = (t: string, x: number, y: number, tam: number, estilo: 'normal' | 'bold' = 'normal', c: readonly number[] = AZUL, opc: any = {}) => {
    pdf.setFont('helvetica', estilo); pdf.setFontSize(tam); color(c); pdf.text(t, x, y, opc);
  };

  const ALTO_FOTO = 236, ALTO_MINI = 62;
  const fotos = (auto.photoUrls?.length ? auto.photoUrls : auto.photoUrl ? [auto.photoUrl] : []).filter(Boolean);
  const ficha: any = (auto as any).fichaWeb || {};
  const [principal, miniaturas, logoAg, qr] = await Promise.all([
    fotoRecortada(fotos[0], ANCHO, ALTO_FOTO),
    Promise.all(fotos.slice(1, 5).map((f) => fotoRecortada(f, (ANCHO - 24) / 4, ALTO_MINI))),
    logo(agencia?.logoUrl),
    auto.websiteUrl ? codigoQR(auto.websiteUrl) : Promise.resolve(''),
  ]);

  // Fondo blanco explícito: algunos visores pintan de negro una página transparente.
  pdf.setFillColor(255, 255, 255); pdf.rect(0, 0, W, H, 'F');

  // --- Encabezado: logo y datos de la agencia
  let y = M;
  if (logoAg) {
    const alto = 36, ancho = Math.min(150, alto * logoAg.ratio);
    pdf.addImage(logoAg.src, 'PNG', M, y, ancho, ancho / logoAg.ratio);
  } else {
    texto(agencia?.name || '', M, y + 24, 18, 'bold');
  }
  const contacto = [agencia?.phone || agencia?.phoneWhatsApp ? `Tel. ${agencia?.phone || agencia?.phoneWhatsApp}` : '', agencia?.address || ''].filter(Boolean);
  texto(agencia?.name || '', W - M, y + 12, 11, 'bold', AZUL, { align: 'right' });
  contacto.forEach((l, i) => texto(pdf.splitTextToSize(l, 260)[0], W - M, y + 26 + i * 11, 8.5, 'normal', GRIS, { align: 'right' }));
  y += 50;
  relleno(ACENTO); pdf.rect(M, y, 46, 3, 'F');
  trazo(LINEA); pdf.setLineWidth(0.6); pdf.line(M + 50, y + 1.5, W - M, y + 1.5);

  // --- Título y precio
  y += 26;
  texto(`${String(auto.make || '').toUpperCase()}  ·  ${auto.year || ''}`, M, y, 9, 'bold', ACENTO, { charSpace: 1.2 });
  const modelo = pdf.splitTextToSize(String(auto.model || ''), ANCHO - 200);
  texto(modelo[0] || '', M, y + 26, 24, 'bold');
  const linea = [auto.km ? `${Number(auto.km).toLocaleString('es-MX')} km` : '', auto.transmission, auto.color].filter(Boolean).join('   ·   ');
  texto(linea, M, y + 44, 10, 'normal', GRIS);

  texto('PRECIO DE CONTADO', W - M, y, 8, 'bold', GRIS, { align: 'right' });
  texto(pesos(auto.price), W - M, y + 28, 26, 'bold', AZUL, { align: 'right' });
  const anterior = Number(ficha.precioAnterior) || 0;
  if (anterior > Number(auto.price)) {
    const t = `Antes ${pesos(anterior)}`;
    texto(t, W - M, y + 44, 10, 'normal', GRIS, { align: 'right' });
    const ancho = pdf.getTextWidth(t);
    trazo(GRIS); pdf.setLineWidth(0.8); pdf.line(W - M - ancho, y + 40.5, W - M, y + 40.5);
  }

  // --- Fotos
  y += 60;
  if (principal) pdf.addImage(principal, 'JPEG', M, y, ANCHO, ALTO_FOTO);
  else { relleno(GRIS_CLARO); pdf.rect(M, y, ANCHO, ALTO_FOTO, 'F'); texto('Sin fotografía', W / 2, y + ALTO_FOTO / 2, 12, 'normal', GRIS, { align: 'center' }); }
  y += ALTO_FOTO + 8;
  const fotosChicas = miniaturas.filter(Boolean);
  if (fotosChicas.length) {
    const w = (ANCHO - 24) / 4;
    fotosChicas.forEach((src, i) => pdf.addImage(src, 'JPEG', M + i * (w + 8), y, w, ALTO_MINI));
    y += ALTO_MINI + 18;
  } else {
    y += 10;
  }

  // --- Ficha técnica: hasta 8 datos, solo los que están llenos
  const datos: [string, string][] = ([
    ['Año', auto.year ? String(auto.year) : ''],
    ['Kilometraje', auto.km ? `${Number(auto.km).toLocaleString('es-MX')} km` : ''],
    ['Transmisión', auto.transmission || ''],
    ['Motor', ficha.motor || [auto.liters ? `${auto.liters} L` : '', auto.cylinders ? `${auto.cylinders} cil.` : ''].filter(Boolean).join(' · ')],
    ['Carrocería', auto.bodyType || ''],
    ['Color', auto.color || ''],
    ['Pasajeros', auto.passengers ? String(auto.passengers) : ''],
    ['Combustible', ficha.combustible || ''],
    ['Tracción', ficha.traccion || ''],
    ['Rendimiento', ficha.rendimiento || ''],
  ] as [string, string][]).filter(([, v]) => v).slice(0, 8);
  texto('FICHA TÉCNICA', M, y, 9, 'bold', ACENTO, { charSpace: 1.2 });
  y += 10;
  const col = ANCHO / 4, filaAlto = 34;
  datos.forEach(([k, v], i) => {
    const cx = M + (i % 4) * col, cy = y + Math.floor(i / 4) * filaAlto;
    if (i % 4 !== 0) { trazo(LINEA); pdf.setLineWidth(0.6); pdf.line(cx, cy + 6, cx, cy + filaAlto - 6); }
    texto(k.toUpperCase(), cx + (i % 4 ? 12 : 0), cy + 17, 7.5, 'bold', GRIS, { charSpace: 0.6 });
    texto(pdf.splitTextToSize(v, col - 16)[0], cx + (i % 4 ? 12 : 0), cy + 31, 11, 'bold');
  });
  y += Math.ceil(datos.length / 4) * filaAlto + 24;

  // --- Lo que nos encanta / equipamiento  +  crédito
  const pie = H - 92;
  const izqAncho = ANCHO * 0.58, derX = M + izqAncho + 16, derAncho = ANCHO - izqAncho - 16;
  const destacados = (ficha.loQueNosEncanta ? String(ficha.loQueNosEncanta).split(/\n+/) : String(auto.equipment || '').split(/[,;\n]/))
    .map((x: string) => x.replace(/^[-•*\s]+/, '').trim()).filter(Boolean).slice(0, 6);
  const espacio = pie - y - 12;
  if (destacados.length && espacio > 40) {
    texto(ficha.loQueNosEncanta ? 'LO QUE NOS ENCANTA' : 'EQUIPAMIENTO', M, y, 9, 'bold', ACENTO, { charSpace: 1.2 });
    let yy = y + 16;
    for (const d of destacados) {
      const lineas = pdf.splitTextToSize(d, izqAncho - 14).slice(0, 2);
      if (yy + lineas.length * 12 > pie - 10) break;
      relleno(ACENTO); pdf.circle(M + 3, yy - 3.2, 1.8, 'F');
      texto(lineas, M + 12, yy, 9.5, 'normal', AZUL);
      yy += lineas.length * 12 + 3;
    }
  }
  const plan = planDeCredito(Number(auto.year), Number(auto.price));
  if (plan && espacio > 70 && auto.status !== 'sold') {
    const alto = Math.min(96, espacio);
    relleno(GRIS_CLARO); pdf.roundedRect(derX, y - 10, derAncho, alto, 6, 6, 'F');
    texto('A CRÉDITO', derX + 14, y + 8, 8, 'bold', ACENTO, { charSpace: 1 });
    texto(`Enganche desde ${pesos(plan.enganche)}`, derX + 14, y + 28, 12, 'bold');
    texto(`${plan.pctEnganche}% de enganche · hasta ${plan.plazo} meses`, derX + 14, y + 44, 9, 'normal', GRIS);
    texto(`Tasa desde ${plan.tasa} anual`, derX + 14, y + 57, 9, 'normal', GRIS);
    if (alto > 80) texto('Sujeto a aprobación de crédito.', derX + 14, y + 74, 7.5, 'normal', GRIS);
  }

  // --- Pie: asesor, agencia y QR
  relleno(AZUL); pdf.rect(0, pie, W, H - pie, 'F');
  const blanco = [255, 255, 255] as const, gris = [203, 213, 225] as const;
  let px = M;
  if (asesor?.name || asesor?.phone) {
    texto('TU ASESOR', px, pie + 24, 7.5, 'bold', gris, { charSpace: 1 });
    texto(asesor?.name || '', px, pie + 40, 12, 'bold', blanco);
    texto([asesor?.phone, asesor?.email].filter(Boolean).join('   ·   '), px, pie + 54, 9, 'normal', gris);
    px = M + 230;
  }
  if (agencia?.name) {
    texto('VISÍTANOS', px, pie + 24, 7.5, 'bold', gris, { charSpace: 1 });
    texto(agencia.name, px, pie + 40, 11, 'bold', blanco);
    if (agencia.address) texto(pdf.splitTextToSize(agencia.address, (qr ? W - M - 80 : W - M) - px)[0], px, pie + 54, 8.5, 'normal', gris);
  }
  if (qr) {
    relleno(blanco); pdf.roundedRect(W - M - 62, pie + 10, 62, 62, 4, 4, 'F');
    pdf.addImage(qr, 'PNG', W - M - 57, pie + 15, 52, 52);
    pdf.link(W - M - 62, pie + 10, 62, 62, { url: auto.websiteUrl! });
  }
  const hoy = new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
  texto(`Precio y disponibilidad sujetos a cambio sin previo aviso · Ficha del ${hoy}${qr ? ' · Escanea el código para ver más fotos' : ''}`, M, H - 10, 7, 'normal', gris);

  pdf.setProperties({ title: `${auto.year || ''} ${auto.make || ''} ${auto.model || ''}`.trim(), subject: 'Ficha del auto', creator: agencia?.name || 'CRM Nextcar' });
  return pdf.output('blob');
}

/** En el teléfono, compartir (WhatsApp de un toque); en la computadora, descargar. */
export async function descargarOCompartir(blob: Blob, nombre: string, titulo: string) {
  const archivo = new File([blob], nombre, { type: 'application/pdf' });
  const enTelefono = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));
  if (enTelefono && navigator.share && navigator.canShare?.({ files: [archivo] })) {
    try { await navigator.share({ title: titulo, files: [archivo] }); return; } catch { /* si lo cierran, se descarga */ }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nombre;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
