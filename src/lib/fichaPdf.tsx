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
  /** Las fotos que lleva la ficha, en orden (la primera en grande). Sin esto, las primeras del auto. */
  fotosElegidas?: string[];
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

export async function aDataUrl(url?: string): Promise<string> {
  if (!url) return '';
  if (url.startsWith('data:')) return url;
  try {
    const r = await fetch(/^https?:\/\//.test(url) ? `/api/proxy-image?url=${encodeURIComponent(url)}` : url);
    if (!r.ok) return '';
    const b = await r.blob();
    return await new Promise((ok) => { const fr = new FileReader(); fr.onloadend = () => ok(String(fr.result || '')); fr.onerror = () => ok(''); fr.readAsDataURL(b); });
  } catch { return ''; }
}

export function cargar(src: string): Promise<HTMLImageElement | null> {
  return new Promise((ok) => { if (!src) return ok(null); const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; });
}

/**
 * La foto completa dentro del recuadro, sin recortarle nada (como
 * object-fit: contain), centrada sobre gris claro. Antes se recortaba para
 * llenar el recuadro y al auto se le iban la defensa o el techo.
 */
export async function fotoCompleta(url: string | undefined, ancho: number, alto: number, escala = 2): Promise<string> {
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
export async function iconoWhatsApp(): Promise<string> {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="96" height="96"><path fill="#ffffff" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>';
  const img = await cargar(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
  if (!img) return '';
  const c = document.createElement('canvas');
  c.width = 96; c.height = 96;
  c.getContext('2d')!.drawImage(img, 0, 0, 96, 96);
  return c.toDataURL('image/png');
}

/** Número para wa.me: solo dígitos y con 52 si viene de 10. */
export function numeroWhatsApp(tel?: string) {
  const n = String(tel || '').replace(/\D/g, '');
  if (n.length < 10) return '';
  return n.length === 10 ? `52${n}` : n;
}

/** El logo sin recortar, en PNG (conserva la transparencia), y su proporción. */
export async function logo(url?: string): Promise<{ src: string; ratio: number } | null> {
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

export async function generarFichaPdf({ auto, agencia, asesor, fotosElegidas }: DatosFicha): Promise<Blob> {
  const pdf = new jsPDF({ unit: 'pt', format: 'letter' });
  const W = 612, H = 792, M = 36, ANCHO = W - M * 2;
  const color = (c: readonly number[]) => pdf.setTextColor(c[0], c[1], c[2]);
  const relleno = (c: readonly number[]) => pdf.setFillColor(c[0], c[1], c[2]);
  const trazo = (c: readonly number[]) => pdf.setDrawColor(c[0], c[1], c[2]);
  const texto = (t: string | string[], x: number, y: number, tam: number, estilo: 'normal' | 'bold' = 'normal', c: readonly number[] = AZUL, opc: any = {}) => {
    pdf.setFont('helvetica', estilo); pdf.setFontSize(tam); color(c); pdf.text(t, x, y, opc);
  };

  const fotos = (fotosElegidas?.length ? fotosElegidas : (auto.photoUrls?.length ? auto.photoUrls : auto.photoUrl ? [auto.photoUrl] : [])).filter(Boolean);
  const ficha: any = (auto as any).fichaWeb || {};

  // Fondo blanco explícito: algunos visores pintan de negro una página transparente.
  pdf.setFillColor(255, 255, 255); pdf.rect(0, 0, W, H, 'F');
  const CX = W / 2;
  const blanco = [255, 255, 255] as const, gris = [203, 213, 225] as const;

  // Foto con esquinas redondeadas (recorte), para que se vea acabada.
  const fotoRedonda = (src: string, x: number, y: number, w: number, h: number) => {
    pdf.saveGraphicsState();
    pdf.roundedRect(x, y, w, h, 8, 8, null as any);
    (pdf as any).clip(); (pdf as any).discardPath();
    pdf.addImage(src, 'JPEG', x, y, w, h);
    pdf.restoreGraphicsState();
  };

  // ---------- Medir antes de dibujar, para repartir el espacio parejo ----------
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
  const FILAS_DATOS = Math.ceil(datos.length / 4), TILE_H = 40, TILE_GAP = 8;
  const altoDatos = datos.length ? 18 + FILAS_DATOS * TILE_H + (FILAS_DATOS - 1) * TILE_GAP : 0;

  const destacados = (ficha.loQueNosEncanta ? String(ficha.loQueNosEncanta).split(/\n+/) : String(auto.equipment || '').split(/[,;\n]/))
    .map((x: string) => x.replace(/^[-•*\s]+/, '').trim()).filter(Boolean).slice(0, 4);
  const plan = auto.status !== 'sold' ? planDeCredito(Number(auto.year), Number(auto.price)) : null;
  const dosTarjetas = destacados.length > 0 && !!plan;
  const anchoTarjeta = dosTarjetas ? (ANCHO - 12) / 2 : ANCHO;
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9.5);
  const lineasDestacados = destacados.map((d) => pdf.splitTextToSize(d, anchoTarjeta - 40).slice(0, 2) as string[]);
  const altoDestacados = destacados.length ? 34 + lineasDestacados.reduce((s, l) => s + l.length * 12 + 4, 0) + 6 : 0;
  const altoTarjetas = Math.max(altoDestacados, plan ? 96 : 0);

  const PIE = H - 96;
  const TOPE = 92;                  // encabezado
  const altoTitulo = 104;           // marca, modelo, datos y precio
  // Fotos de celular (4:3): la principal y dos a la derecha, del mismo alto.
  // Si el contenido no cabe, las fotos se achican (hasta cierto punto) antes
  // de que algo se meta debajo del pie.
  const HUECO_MIN = 14;
  const resto = [altoTitulo, altoDatos, altoTarjetas].filter((h) => h > 0);
  const disponibleFotos = PIE - 14 - TOPE - resto.reduce((a, b) => a + b, 0) - HUECO_MIN * (resto.length + 1);
  const ALTO_FOTO = Math.max(180, Math.min(270, disponibleFotos));
  const ALTO_MINI = (ALTO_FOTO - 8) / 2;
  const ANCHO_MINI_43 = ALTO_MINI * 4 / 3;
  const ANCHO_FOTO = Math.min(ALTO_FOTO * 4 / 3, ANCHO - 8 - ANCHO_MINI_43);
  const ANCHO_MINI = ANCHO_MINI_43;
  const altoFotos = ALTO_FOTO;
  const bloques = [altoTitulo, altoFotos, altoDatos, altoTarjetas].filter((h) => h > 0);
  const libre = PIE - 14 - TOPE - bloques.reduce((a, b) => a + b, 0);
  const hueco = Math.max(HUECO_MIN, Math.min(34, libre / Math.max(1, bloques.length)));

  const [principal, miniaturas, logoAg, qr, iconoWa] = await Promise.all([
    fotoCompleta(fotos[0], fotos.length > 1 ? ANCHO_FOTO : ANCHO_FOTO, ALTO_FOTO),
    Promise.all(fotos.slice(1, 3).map((f) => fotoCompleta(f, ANCHO_MINI, ALTO_MINI))),
    logo(agencia?.logoUrl),
    auto.websiteUrl ? codigoQR(auto.websiteUrl) : Promise.resolve(''),
    iconoWhatsApp(),
  ]);
  const fotosChicas = miniaturas.filter(Boolean);

  // ---------- Franja y encabezado ----------
  relleno(AZUL); pdf.rect(0, 0, W, 6, 'F');
  relleno(ACENTO); pdf.rect(0, 6, W, 2, 'F');
  let y = 28;
  if (logoAg) {
    const alto = 36, ancho = Math.min(150, alto * logoAg.ratio);
    pdf.addImage(logoAg.src, 'PNG', M, y, ancho, ancho / logoAg.ratio);
  } else {
    texto(agencia?.name || '', M, y + 24, 18, 'bold');
  }
  const contacto = [agencia?.phone || agencia?.phoneWhatsApp ? `Tel. ${agencia?.phone || agencia?.phoneWhatsApp}` : '', agencia?.address || ''].filter(Boolean);
  texto(agencia?.name || '', W - M, y + 12, 11, 'bold', AZUL, { align: 'right' });
  contacto.forEach((l, i) => texto(pdf.splitTextToSize(l, 260)[0], W - M, y + 26 + i * 11, 8.5, 'normal', GRIS, { align: 'right' }));
  trazo(LINEA); pdf.setLineWidth(0.8); pdf.line(M, TOPE - 12, W - M, TOPE - 12);

  // ---------- Título centrado y precio en pastilla ----------
  y = TOPE + hueco * 0.4;
  texto(`${String(auto.make || '').toUpperCase()}   ·   ${auto.year || ''}`, CX, y + 8, 9.5, 'bold', ACENTO, { align: 'center' });
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(24);
  const modelo = pdf.splitTextToSize(String(auto.model || ''), ANCHO - 40)[0] || '';
  texto(modelo, CX, y + 34, 24, 'bold', AZUL, { align: 'center' });
  const linea = [auto.km ? `${Number(auto.km).toLocaleString('es-MX')} km` : '', auto.transmission, auto.color].filter(Boolean).join('    ·    ');
  texto(linea, CX, y + 52, 10, 'normal', GRIS, { align: 'center' });
  // Pastilla del precio
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(20);
  const precioTxt = pesos(auto.price);
  const anchoPastilla = pdf.getTextWidth(precioTxt) + 120;
  const px0 = CX - anchoPastilla / 2, py0 = y + 64;
  relleno(AZUL); pdf.roundedRect(px0, py0, anchoPastilla, 34, 17, 17, 'F');
  texto('CONTADO', px0 + 18, py0 + 21, 7.5, 'bold', gris);
  texto(precioTxt, px0 + anchoPastilla - 18, py0 + 24, 20, 'bold', blanco, { align: 'right' });
  const anterior = Number(ficha.precioAnterior) || 0;
  if (anterior > Number(auto.price)) {
    const t = `Antes ${pesos(anterior)}`;
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10);
    const tw = pdf.getTextWidth(t);
    texto(t, px0 + anchoPastilla + 12, py0 + 21, 10, 'normal', GRIS);
    trazo(GRIS); pdf.setLineWidth(0.8); pdf.line(px0 + anchoPastilla + 12, py0 + 17.5, px0 + anchoPastilla + 12 + tw, py0 + 17.5);
  }
  y += altoTitulo + hueco;

  // ---------- Fotos: principal y dos a la derecha, esquinas redondeadas ----------
  if (principal && fotosChicas.length) {
    // El bloque de fotos va centrado (si las fotos se achicaron, queda angosto).
    const x0 = CX - (ANCHO_FOTO + 8 + ANCHO_MINI) / 2;
    fotoRedonda(principal, x0, y, ANCHO_FOTO, ALTO_FOTO);
    fotosChicas.forEach((src, i) => fotoRedonda(src, x0 + ANCHO_FOTO + 8, y + i * (ALTO_MINI + 8), ANCHO_MINI, ALTO_MINI));
  } else if (principal) {
    // Una sola foto: centrada, a su tamaño (sin estirarla a todo el ancho).
    fotoRedonda(principal, CX - ANCHO_FOTO / 2, y, ANCHO_FOTO, ALTO_FOTO);
  } else {
    relleno(GRIS_CLARO); pdf.roundedRect(M, y, ANCHO, ALTO_FOTO, 8, 8, 'F');
    texto('Sin fotografía', CX, y + ALTO_FOTO / 2, 12, 'normal', GRIS, { align: 'center' });
  }
  y += altoFotos + hueco;

  // ---------- Ficha técnica: recuadros centrados ----------
  if (datos.length) {
    texto('FICHA TÉCNICA', CX, y + 8, 9, 'bold', ACENTO, { align: 'center' });
    const ty = y + 18;
    const tw = (ANCHO - TILE_GAP * 3) / 4;
    for (let f = 0; f < FILAS_DATOS; f++) {
      const fila = datos.slice(f * 4, f * 4 + 4);
      const anchoFila = fila.length * tw + (fila.length - 1) * TILE_GAP;
      const x0 = CX - anchoFila / 2;
      fila.forEach(([k, v], i) => {
        const x = x0 + i * (tw + TILE_GAP), yy = ty + f * (TILE_H + TILE_GAP);
        relleno(GRIS_CLARO); pdf.roundedRect(x, yy, tw, TILE_H, 6, 6, 'F');
        texto(k.toUpperCase(), x + tw / 2, yy + 15, 7, 'bold', GRIS, { align: 'center' });
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(11);
        texto(pdf.splitTextToSize(v, tw - 12)[0], x + tw / 2, yy + 30, 11, 'bold', AZUL, { align: 'center' });
      });
    }
    y += altoDatos + hueco;
  }

  // ---------- Lo que nos encanta  +  crédito (mismo alto) ----------
  if (altoTarjetas) {
    let x = M;
    if (destacados.length) {
      pdf.setDrawColor(LINEA[0], LINEA[1], LINEA[2]); pdf.setLineWidth(1);
      pdf.roundedRect(x, y, anchoTarjeta, altoTarjetas, 8, 8, 'S');
      texto(ficha.loQueNosEncanta ? 'LO QUE NOS ENCANTA' : 'EQUIPAMIENTO', x + 18, y + 22, 8.5, 'bold', ACENTO);
      let yy = y + 40;
      lineasDestacados.forEach((ls) => {
        relleno(ACENTO); pdf.circle(x + 21, yy - 3.2, 2, 'F');
        texto(ls, x + 30, yy, 9.5, 'normal', AZUL);
        yy += ls.length * 12 + 4;
      });
      x += anchoTarjeta + 12;
    }
    if (plan) {
      relleno(AZUL); pdf.roundedRect(x, y, anchoTarjeta, altoTarjetas, 8, 8, 'F');
      const cxT = x + anchoTarjeta / 2, my = y + altoTarjetas / 2;
      texto('A CRÉDITO', cxT, my - 30, 8.5, 'bold', gris, { align: 'center' });
      texto(`Enganche desde ${pesos(plan.enganche)}`, cxT, my - 8, 14, 'bold', blanco, { align: 'center' });
      texto(`${plan.pctEnganche}% de enganche · hasta ${plan.plazo} meses · tasa desde ${plan.tasa}`, cxT, my + 10, 8.5, 'normal', gris, { align: 'center' });
      texto('Sujeto a aprobación de crédito.', cxT, my + 26, 7.5, 'normal', gris, { align: 'center' });
    }
  }

  // ---------- Pie: asesor y WhatsApp · agencia · QR ----------
  relleno(AZUL); pdf.rect(0, PIE, W, H - PIE, 'F');
  relleno(ACENTO); pdf.rect(0, PIE, W, 2, 'F');
  const telWa = numeroWhatsApp(asesor?.phone) || numeroWhatsApp(agencia?.phoneWhatsApp) || numeroWhatsApp(agencia?.phone);
  // Botón de WhatsApp: abre el chat con el asesor (o con la agencia) con el
  // mensaje ya escrito. En papel, el número queda escrito en el botón.
  const ligaWa = telWa
    ? `https://wa.me/${telWa}?text=${encodeURIComponent(`Hola${asesor?.name ? ` ${String(asesor.name).split(' ')[0]}` : ''}, me interesa el ${[auto.year, auto.make, auto.model].filter(Boolean).join(' ')} de ${pesos(auto.price)}.`)}`
    : '';
  const col2 = M + 232;
  if (asesor?.name) {
    texto('TU ASESOR', M, PIE + 24, 7.5, 'bold', gris);
    texto(asesor.name, M, PIE + 39, 12, 'bold', blanco);
    if (asesor.email) texto(asesor.email, M, PIE + 51, 8.5, 'normal', gris);
  }
  if (ligaWa) {
    const bx = M, by = PIE + (asesor?.name ? 59 : 30), bw = 172, bh = 21;
    pdf.setFillColor(37, 211, 102); pdf.roundedRect(bx, by, bw, bh, 10.5, 10.5, 'F');
    if (iconoWa) pdf.addImage(iconoWa, 'PNG', bx + 7, by + 4, 13, 13);
    texto(`WhatsApp ${asesor?.phone || agencia?.phoneWhatsApp || agencia?.phone || ''}`.trim(), bx + 25, by + 14, 9, 'bold', blanco);
    pdf.link(bx, by, bw, bh, { url: ligaWa });
  }
  if (agencia?.name) {
    texto('VISÍTANOS', col2, PIE + 24, 7.5, 'bold', gris);
    texto(agencia.name, col2, PIE + 39, 11, 'bold', blanco);
    const limite = (qr ? W - M - 84 : W - M) - col2;
    if (agencia.address) texto(pdf.splitTextToSize(agencia.address, limite)[0], col2, PIE + 52, 8.5, 'normal', gris);
    if (agencia.phone) texto(`Tel. ${agencia.phone}`, col2, PIE + 64, 8.5, 'normal', gris);
  }
  if (qr) {
    relleno(blanco); pdf.roundedRect(W - M - 66, PIE + 12, 66, 66, 6, 6, 'F');
    pdf.addImage(qr, 'PNG', W - M - 60, PIE + 18, 54, 54);
    pdf.link(W - M - 66, PIE + 12, 66, 66, { url: auto.websiteUrl! });
    texto('Más fotos', W - M - 33, PIE + 88, 7, 'bold', gris, { align: 'center' });
  }
  const hoy = new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
  texto(`Precio y disponibilidad sujetos a cambio sin previo aviso · Ficha del ${hoy}`, M, H - 8, 7, 'normal', gris);

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
