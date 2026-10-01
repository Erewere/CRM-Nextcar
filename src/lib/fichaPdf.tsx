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

/**
 * La foto completa dentro del recuadro, sin recortarle nada (como
 * object-fit: contain), centrada sobre gris claro. Antes se recortaba para
 * llenar el recuadro y al auto se le iban la defensa o el techo.
 */
async function fotoCompleta(url: string | undefined, ancho: number, alto: number, escala = 2): Promise<string> {
  const img = await cargar(await aDataUrl(url));
  if (!img) return '';
  const c = document.createElement('canvas');
  c.width = Math.round(ancho * escala); c.height = Math.round(alto * escala);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#f1f5f9'; ctx.fillRect(0, 0, c.width, c.height);
  const r = Math.min(c.width / img.width, c.height / img.height);
  const w = img.width * r, h = img.height * r;
  ctx.drawImage(img, (c.width - w) / 2, (c.height - h) / 2, w, h);
  return c.toDataURL('image/jpeg', 0.88);
}

/** Icono de WhatsApp (blanco sobre verde), para el botón del pie. */
async function iconoWhatsApp(): Promise<string> {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="96" height="96"><path fill="#ffffff" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>';
  const img = await cargar(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
  if (!img) return '';
  const c = document.createElement('canvas');
  c.width = 96; c.height = 96;
  c.getContext('2d')!.drawImage(img, 0, 0, 96, 96);
  return c.toDataURL('image/png');
}

/** Número para wa.me: solo dígitos y con 52 si viene de 10. */
function numeroWhatsApp(tel?: string) {
  const n = String(tel || '').replace(/\D/g, '');
  if (n.length < 10) return '';
  return n.length === 10 ? `52${n}` : n;
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

  // Fotos de celular (4:3): la principal a la izquierda y dos a la derecha,
  // del mismo alto entre las dos, para que no sobre espacio gris.
  const ALTO_FOTO = 270, ANCHO_FOTO = 360, ANCHO_MINI = ANCHO - ANCHO_FOTO - 8, ALTO_MINI = (ALTO_FOTO - 8) / 2;
  const fotos = (auto.photoUrls?.length ? auto.photoUrls : auto.photoUrl ? [auto.photoUrl] : []).filter(Boolean);
  const ficha: any = (auto as any).fichaWeb || {};
  const [principal, miniaturas, logoAg, qr, iconoWa] = await Promise.all([
    fotoCompleta(fotos[0], ANCHO_FOTO, ALTO_FOTO),
    Promise.all(fotos.slice(1, 3).map((f) => fotoCompleta(f, ANCHO_MINI, ALTO_MINI))),
    logo(agencia?.logoUrl),
    auto.websiteUrl ? codigoQR(auto.websiteUrl) : Promise.resolve(''),
    iconoWhatsApp(),
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
  const fotosChicas = miniaturas.filter(Boolean);
  // Sin fotos chicas, la principal usa todo el ancho.
  const anchoPrincipal = fotosChicas.length ? ANCHO_FOTO : ANCHO;
  if (principal) {
    const src = fotosChicas.length ? principal : await fotoCompleta(fotos[0], ANCHO, ALTO_FOTO);
    pdf.addImage(src, 'JPEG', M, y, anchoPrincipal, ALTO_FOTO);
  } else { relleno(GRIS_CLARO); pdf.rect(M, y, ANCHO, ALTO_FOTO, 'F'); texto('Sin fotografía', W / 2, y + ALTO_FOTO / 2, 12, 'normal', GRIS, { align: 'center' }); }
  fotosChicas.forEach((src, i) => pdf.addImage(src, 'JPEG', M + ANCHO_FOTO + 8, y + i * (ALTO_MINI + 8), ANCHO_MINI, ALTO_MINI));
  y += ALTO_FOTO + 24;

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
  // Botón de WhatsApp: abre el chat con el asesor (o con la agencia) con el
  // mensaje ya escrito. Funciona al tocarlo en el teléfono o al hacer clic en
  // la computadora; en papel, el número queda escrito al lado.
  const telWa = numeroWhatsApp(asesor?.phone) || numeroWhatsApp(agencia?.phoneWhatsApp) || numeroWhatsApp(agencia?.phone);
  const ligaWa = telWa
    ? `https://wa.me/${telWa}?text=${encodeURIComponent(`Hola${asesor?.name ? ` ${String(asesor.name).split(' ')[0]}` : ''}, me interesa el ${[auto.year, auto.make, auto.model].filter(Boolean).join(' ')} de ${pesos(auto.price)}.`)}`
    : '';
  if (asesor?.name || asesor?.phone) {
    texto('TU ASESOR', px, pie + 20, 7.5, 'bold', gris, { charSpace: 1 });
    texto(asesor?.name || '', px, pie + 34, 12, 'bold', blanco);
    if (asesor?.email) texto(asesor.email, px, pie + 46, 8.5, 'normal', gris);
    px = M + 230;
  }
  if (ligaWa) {
    // Pastilla verde con el icono y el número, toda clicable.
    const bx = M, by = pie + (asesor?.email ? 53 : 44), bw = 168, bh = 20;
    pdf.setFillColor(37, 211, 102); pdf.roundedRect(bx, by, bw, bh, 10, 10, 'F');
    if (iconoWa) pdf.addImage(iconoWa, 'PNG', bx + 6, by + 3.5, 13, 13);
    texto(`WhatsApp ${asesor?.phone || agencia?.phoneWhatsApp || agencia?.phone || ''}`.trim(), bx + 24, by + 13.5, 9, 'bold', blanco);
    pdf.link(bx, by, bw, bh, { url: ligaWa });
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
