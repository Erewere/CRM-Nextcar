import type { Vehicle } from '../types';
import { fotoConFondo, iconoWa, LETRA, pesos, rectRedondo, textoAjustado } from './imagenesRedes';

/**
 * Plantillas de la imagen para redes. Todas toman el color de la agencia
 * (`colorMarca`) y se dibujan igual en cuadrada (1080×1080) y vertical
 * (1080×1920). La «clásica» vive en imagenesRedes.ts; aquí van las demás.
 */

export type PlantillaRed = 'clasica' | 'moderna' | 'elegante' | 'oferta' | 'ficha';

export const PLANTILLAS: { id: PlantillaRed; nombre: string; nota: string }[] = [
  { id: 'moderna', nombre: 'Moderna', nota: 'Foto grande, datos en etiquetas' },
  { id: 'elegante', nombre: 'Elegante', nota: 'Fondo claro, tipo revista' },
  { id: 'oferta', nombre: 'Oferta', nota: 'Precio enorme, llama la atención' },
  { id: 'ficha', nombre: 'Con datos', nota: 'Más datos técnicos del auto' },
  { id: 'clasica', nombre: 'Clásica', nota: 'La de siempre' },
];

export const COLORES_MARCA = ['#1d4ed8', '#dc2626', '#059669', '#d97706', '#7c3aed', '#0f172a', '#db2777', '#0891b2'];
export const COLOR_MARCA_BASE = '#1d4ed8';

/* ---------- color ---------- */
export function hexValido(h?: string) { return /^#[0-9a-fA-F]{6}$/.test(String(h || '')); }
function rgb(h: string): [number, number, number] { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
function aHex(c: number[]) { return '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join(''); }
/** t=0 → a, t=1 → b */
export function mezclar(a: string, b: string, t: number) { const x = rgb(a), y = rgb(b); return aHex(x.map((v, i) => v + (y[i] - v) * t)); }
function luz(h: string) { const [r, g, b] = rgb(h); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; }
/** Blanco o casi negro, el que se lea sobre ese color. */
export function textoSobre(h: string) { return luz(h) > 0.62 ? '#0f172a' : '#ffffff'; }

export interface PaletaRed { marca: string; oscuro: string; suave: string; sobreMarca: string }
export function paleta(color?: string): PaletaRed {
  const marca = hexValido(color) ? String(color).toLowerCase() : COLOR_MARCA_BASE;
  return { marca, oscuro: mezclar(marca, '#050b16', 0.82), suave: mezclar(marca, '#ffffff', 0.9), sobreMarca: textoSobre(marca) };
}

/** Colores de la agencia como [r,g,b], para los PDF (jsPDF). Sin color guardado, el azul de siempre. */
export function coloresPdf(color?: string): { marca: readonly [number, number, number]; oscuro: readonly [number, number, number]; suave: readonly [number, number, number]; sobreMarca: readonly [number, number, number] } {
  const pal = paleta(color);
  return {
    marca: rgb(pal.marca), suave: rgb(pal.suave),
    oscuro: hexValido(color) ? rgb(pal.oscuro) : [15, 23, 42],
    sobreMarca: pal.sobreMarca === '#ffffff' ? [255, 255, 255] : [15, 23, 42],
  };
}

/* ---------- datos ---------- */
export interface EntradaPlantilla {
  ctx: CanvasRenderingContext2D;
  W: number; H: number; vertical: boolean;
  a: Vehicle;
  foto: HTMLImageElement | null;
  extras: HTMLImageElement[];
  logo: HTMLImageElement | null;
  nombreAgencia?: string;
  tel: string;
  etiqueta?: string;
  enganche: number;     // 0 si no se muestra
  antes: number;        // 0 si no hay precio anterior
  p: PaletaRed;
}

function especificaciones(a: Vehicle): [string, string][] {
  const f: any = a.fichaWeb || {};
  const motor = f.motor || [a.liters ? `${Number(a.liters).toFixed(1)} L` : '', a.cylinders ? `${a.cylinders} cil.` : ''].filter(Boolean).join(' · ');
  return ([
    ['Año', a.year ? String(a.year) : ''],
    ['Kilometraje', a.km ? `${Number(a.km).toLocaleString('es-MX')} km` : ''],
    ['Transmisión', a.transmission || ''],
    ['Motor', motor],
    ['Combustible', f.combustible || ''],
    ['Color', a.color || ''],
    ['Tracción', f.traccion || ''],
    ['Pasajeros', a.passengers ? `${a.passengers}` : ''],
    ['Carrocería', a.bodyType || ''],
  ] as [string, string][]).filter(([, v]) => v);
}

/* ---------- piezas comunes ---------- */
const ajustar = (ctx: CanvasRenderingContext2D, t: string, maxW: number, tam: number, min: number) => textoAjustado(ctx, t, maxW, tam, 'bold', min);

function tituloAuto(a: Vehicle) {
  const marca = String(a.make || '').toUpperCase();
  const modelo = `${a.model || ''}`.trim();
  return { marca, modelo, completo: `${a.make || ''} ${a.model || ''}`.trim() };
}

function etiquetaPastilla(ctx: CanvasRenderingContext2D, t: string, xDer: number, y: number, tam: number, fondo: string, color: string) {
  ctx.font = `bold ${tam}px ${LETRA}`;
  const w = ctx.measureText(t).width + tam * 1.5, h = tam * 1.9;
  ctx.fillStyle = fondo; rectRedondo(ctx, xDer - w, y, w, h, h / 2); ctx.fill();
  ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(t, xDer - w + tam * 0.75, y + h / 2 + 1);
}

function logoChip(ctx: CanvasRenderingContext2D, logo: HTMLImageElement | null, nombre: string | undefined, x: number, y: number, altoMax: number, anchoMax: number, textoColor: string, fondoChip = 'rgba(255,255,255,0.95)') {
  if (logo) {
    const r = Math.min(anchoMax / logo.width, altoMax / logo.height);
    const w = logo.width * r, h = logo.height * r;
    ctx.fillStyle = fondoChip; rectRedondo(ctx, x - 18, y - 14, w + 36, h + 28, 18); ctx.fill();
    ctx.drawImage(logo, x, y, w, h);
    return { w: w + 36, h: h + 28 };
  }
  if (nombre) {
    ctx.font = `bold 40px ${LETRA}`; ctx.fillStyle = textoColor; ctx.textBaseline = 'top'; ctx.textAlign = 'left';
    ctx.fillText(nombre, x, y);
  }
  return { w: 0, h: 0 };
}

function sombra(ctx: CanvasRenderingContext2D, on: boolean, blur = 40, dy = 16, a = 0.28) {
  if (on) { ctx.shadowColor = `rgba(2,6,23,${a})`; ctx.shadowBlur = blur; ctx.shadowOffsetY = dy; ctx.shadowOffsetX = 0; }
  else { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; }
}

function botonWhatsApp(ctx: CanvasRenderingContext2D, tel: string, cx: number, y: number, tam: number) {
  const t = `WhatsApp ${tel}`;
  ctx.font = `bold ${tam}px ${LETRA}`;
  const bw = ctx.measureText(t).width + tam * 3.4, bh = tam * 2.5;
  ctx.fillStyle = '#25d366'; rectRedondo(ctx, cx - bw / 2, y, bw, bh, bh / 2); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(cx - bw / 2 + bh / 2, y + bh / 2, bh * 0.32, 0, Math.PI * 2); ctx.fill();
  iconoWa(ctx, cx - bw / 2 + bh / 2, y + bh / 2, bh * 0.27);
  ctx.fillStyle = '#ffffff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(t, cx - bw / 2 + bh * 0.95, y + bh / 2 + 2);
  return bh;
}

/** Fotos chicas (solo en la vertical). Devuelve el alto que ocuparon. */
function filaExtras(e: EntradaPlantilla, x: number, y: number, w: number, h: number, hueco = 20, radio = 26) {
  if (!e.vertical || !e.extras.length) return 0;
  const n = e.extras.length, ancho = (w - hueco * (n - 1)) / n;
  e.extras.forEach((im, i) => fotoConFondo(e.ctx, im, x + i * (ancho + hueco), y, ancho, h, radio));
  return h;
}

/* =====================================================================
   MODERNA — foto grande arriba que se funde con un panel del color de la
   agencia; datos en etiquetas; precio en una pastilla.
   ===================================================================== */
function moderna(e: EntradaPlantilla) {
  const { ctx, W, H, vertical, a, foto, p } = e;
  const t = tituloAuto(a);
  ctx.fillStyle = p.oscuro; ctx.fillRect(0, 0, W, H);

  const altoExtras = vertical && e.extras.length ? 250 : 0;
  const altoFoto = vertical ? 820 : 640;
  if (foto) fotoConFondo(ctx, foto, 0, 0, W, altoFoto);
  // fundido hacia el panel
  const g = ctx.createLinearGradient(0, altoFoto - 170, 0, altoFoto);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, p.oscuro);
  ctx.fillStyle = g; ctx.fillRect(0, altoFoto - 170, W, 170);
  const g2 = ctx.createLinearGradient(0, 0, 0, 230);
  g2.addColorStop(0, 'rgba(0,0,0,0.55)'); g2.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g2; ctx.fillRect(0, 0, W, 230);

  logoChip(ctx, e.logo, e.nombreAgencia, 56, 50, 70, 300, '#ffffff');
  if (e.etiqueta) etiquetaPastilla(ctx, e.etiqueta.toUpperCase(), W - 56, 52, 30, p.marca, p.sobreMarca);

  let y = altoFoto - 6;
  if (altoExtras) { filaExtras(e, 56, altoFoto + 6, W - 112, altoExtras - 24); y = altoFoto + altoExtras; }

  // marca + año
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  y += vertical ? 70 : 58;
  ctx.font = `bold ${vertical ? 36 : 30}px ${LETRA}`; ctx.fillStyle = mezclar(p.marca, '#ffffff', 0.45);
  ctx.fillText(`${t.marca}${a.year ? `  ·  ${a.year}` : ''}`, 60, y);
  // modelo grande
  y += vertical ? 96 : 78;
  const tam = ajustar(ctx, t.modelo, W - 120, vertical ? 96 : 84, 40);
  ctx.fillStyle = '#ffffff'; ctx.fillText(t.modelo, 60, y);
  void tam;

  // etiquetas de datos
  const chips = especificaciones(a).filter(([k]) => ['Kilometraje', 'Transmisión', 'Motor', 'Combustible', 'Color'].includes(k)).slice(0, 4).map(([, v]) => v);
  y += vertical ? 44 : 34;
  let x = 60;
  const tamChip = vertical ? 30 : 26, hChip = tamChip * 2;
  ctx.font = `bold ${tamChip}px ${LETRA}`;
  for (const c of chips) {
    const w = ctx.measureText(c).width + tamChip * 1.6;
    if (x + w > W - 60) break;
    ctx.strokeStyle = mezclar(p.marca, '#ffffff', 0.35); ctx.lineWidth = 2.5;
    rectRedondo(ctx, x, y, w, hChip, hChip / 2); ctx.stroke();
    ctx.fillStyle = '#e2e8f0'; ctx.textBaseline = 'middle'; ctx.fillText(c, x + tamChip * 0.8, y + hChip / 2 + 1);
    x += w + 14;
  }
  ctx.textBaseline = 'alphabetic';

  // precio
  const precio = pesos(a.price);
  const hP = vertical ? 150 : 112;
  const yP = vertical ? H - 420 : H - 52 - hP;
  ctx.font = `bold ${vertical ? 88 : 70}px ${LETRA}`;
  const wP = ctx.measureText(precio).width + (vertical ? 120 : 90);
  if (e.antes) {
    ctx.font = `bold ${vertical ? 36 : 30}px ${LETRA}`; ctx.fillStyle = '#fca5a5'; ctx.textAlign = 'left';
    const ta = `Antes ${pesos(e.antes)}`; ctx.fillText(ta, 66, yP - 30);
    ctx.fillRect(66, yP - 30 - 11, ctx.measureText(ta).width, 3.5);
  }
  sombra(ctx, true, 30, 10, 0.4);
  ctx.fillStyle = p.marca; rectRedondo(ctx, 56, yP, wP, hP, hP / 2); ctx.fill();
  sombra(ctx, false);
  ctx.font = `bold ${vertical ? 88 : 70}px ${LETRA}`; ctx.fillStyle = p.sobreMarca; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
  ctx.fillText(precio, 56 + wP / 2, yP + hP / 2 + 4);
  ctx.textAlign = 'left';

  if (!vertical) {
    // a la derecha: enganche y WhatsApp
    const xr = W - 56; ctx.textAlign = 'right';
    if (e.enganche) {
      ctx.font = `bold 24px ${LETRA}`; ctx.fillStyle = '#94a3b8'; ctx.textBaseline = 'alphabetic'; ctx.fillText('ENGANCHE DESDE', xr, yP + 38);
      ctx.font = `bold 44px ${LETRA}`; ctx.fillStyle = '#ffffff'; ctx.fillText(pesos(e.enganche), xr, yP + 88);
    }
    if (e.tel) { ctx.font = `bold 26px ${LETRA}`; ctx.fillStyle = '#25d366'; ctx.textBaseline = 'alphabetic'; ctx.fillText(`WhatsApp ${e.tel}`, xr, yP + hP + 38 > H - 14 ? H - 16 : yP + hP + 38); }
  } else {
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    if (e.enganche) { ctx.font = `bold 40px ${LETRA}`; ctx.fillStyle = '#e2e8f0'; ctx.fillText(`Enganche desde ${pesos(e.enganche)}`, W / 2, yP + hP + 64); }
    if (e.tel) botonWhatsApp(ctx, e.tel, W / 2, H - 150, 36);
  }
}

/* =====================================================================
   ELEGANTE — fondo claro, la foto en una tarjeta con sombra, tipografía
   de revista y el color de la agencia solo en los detalles.
   ===================================================================== */
function elegante(e: EntradaPlantilla) {
  const { ctx, W, H, vertical, a, foto, p } = e;
  const t = tituloAuto(a);
  ctx.fillStyle = '#f8fafc'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = p.marca; ctx.fillRect(0, 0, W, 14);

  // encabezado
  const logo = logoChip(ctx, e.logo, e.nombreAgencia, 60, 56, 62, 280, '#0f172a', '#ffffff');
  void logo;
  if (e.etiqueta) etiquetaPastilla(ctx, e.etiqueta.toUpperCase(), W - 60, 56, 26, p.marca, p.sobreMarca);

  // tarjeta de foto
  const yF = 170, altoF = vertical ? 700 : 440;
  sombra(ctx, true, 50, 18, 0.22);
  ctx.fillStyle = '#ffffff'; rectRedondo(ctx, 60, yF, W - 120, altoF, 30); ctx.fill();
  sombra(ctx, false);
  if (foto) fotoConFondo(ctx, foto, 60, yF, W - 120, altoF, 30);
  let y = yF + altoF;
  if (vertical && e.extras.length) { y += 26; y += filaExtras(e, 60, y, W - 120, 210, 20, 24); }

  // título
  y += vertical ? 86 : 70;
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = p.marca; ctx.fillRect(60, y - 56, 70, 6);
  ctx.font = `bold ${vertical ? 30 : 26}px ${LETRA}`; ctx.fillStyle = '#64748b';
  ctx.fillText(`${t.marca}${a.year ? `  ·  ${a.year}` : ''}`, 60, y);
  y += vertical ? 80 : 62;
  ctx.font = `bold ${vertical ? 84 : 66}px Georgia, "Times New Roman", serif`;
  let s = vertical ? 84 : 66;
  while (ctx.measureText(t.modelo).width > W - 120 && s > 36) { s -= 2; ctx.font = `bold ${s}px Georgia, "Times New Roman", serif`; }
  ctx.fillStyle = '#0f172a'; ctx.fillText(t.modelo, 60, y);

  // datos en columnas con separadores
  const cols = especificaciones(a).filter(([k]) => ['Kilometraje', 'Transmisión', 'Motor', 'Combustible', 'Color'].includes(k)).slice(0, 3);
  y += vertical ? 60 : 44;
  if (cols.length) {
    const ancho = (W - 120) / cols.length;
    cols.forEach(([k, v], i) => {
      const x = 60 + i * ancho;
      if (i) { ctx.fillStyle = '#cbd5e1'; ctx.fillRect(x - 12, y, 2, vertical ? 84 : 66); }
      ctx.textAlign = 'left'; ctx.font = `bold ${vertical ? 22 : 19}px ${LETRA}`; ctx.fillStyle = '#94a3b8';
      ctx.fillText(k.toUpperCase(), x + (i ? 8 : 0), y + (vertical ? 26 : 22));
      const tam = ajustar(ctx, v, ancho - 28, vertical ? 36 : 30, 18);
      void tam;
      ctx.fillStyle = '#0f172a'; ctx.fillText(v, x + (i ? 8 : 0), y + (vertical ? 70 : 58));
    });
    y += vertical ? 100 : 80;
  }

  // precio y contacto en la franja inferior
  const yPie = H - (vertical ? 400 : 196);
  ctx.fillStyle = '#e2e8f0'; ctx.fillRect(60, yPie, W - 120, 2);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  if (e.antes) {
    ctx.font = `bold ${vertical ? 34 : 28}px ${LETRA}`; ctx.fillStyle = '#ef4444';
    const ta = `Antes ${pesos(e.antes)}`; ctx.fillText(ta, 60, yPie + (vertical ? 52 : 44));
    ctx.fillRect(60, yPie + (vertical ? 40 : 33), ctx.measureText(ta).width, 3);
  }
  const precio = pesos(a.price);
  const tamP = ajustar(ctx, precio, vertical ? W - 120 : 520, vertical ? 110 : 88, 50);
  ctx.fillStyle = p.marca; ctx.fillText(precio, 60, yPie + (vertical ? 160 : 140));
  void tamP;
  ctx.textAlign = 'right';
  if (!vertical) {
    if (e.enganche) { ctx.font = `bold 22px ${LETRA}`; ctx.fillStyle = '#64748b'; ctx.fillText('ENGANCHE DESDE', W - 60, yPie + 50); ctx.font = `bold 44px ${LETRA}`; ctx.fillStyle = '#0f172a'; ctx.fillText(pesos(e.enganche), W - 60, yPie + 100); }
    if (e.tel) { ctx.font = `bold 26px ${LETRA}`; ctx.fillStyle = '#16a34a'; ctx.fillText(`WhatsApp ${e.tel}`, W - 60, yPie + 142); }
  } else {
    if (e.enganche) { ctx.font = `bold 34px ${LETRA}`; ctx.fillStyle = '#334155'; ctx.fillText(`Enganche desde ${pesos(e.enganche)}`, W - 60, yPie + 52); }
    if (e.tel) { ctx.textAlign = 'center'; botonWhatsApp(ctx, e.tel, W / 2, H - 120, 34); }
  }
}

/* =====================================================================
   OFERTA — todo el fondo del color de la agencia, el precio manda.
   ===================================================================== */
function oferta(e: EntradaPlantilla) {
  const { ctx, W, H, vertical, a, foto, p } = e;
  const t = tituloAuto(a);
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, mezclar(p.marca, '#ffffff', 0.08)); g.addColorStop(1, mezclar(p.marca, '#000000', 0.45));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // franjas diagonales de fondo
  ctx.save(); ctx.globalAlpha = 0.07; ctx.fillStyle = '#ffffff';
  for (let i = -2; i < 8; i++) { ctx.beginPath(); ctx.moveTo(i * 240, 0); ctx.lineTo(i * 240 + 90, 0); ctx.lineTo(i * 240 - 300, H); ctx.lineTo(i * 240 - 390, H); ctx.closePath(); ctx.fill(); }
  ctx.restore();

  const claro = p.sobreMarca === '#ffffff' ? '#ffffff' : '#0f172a';
  // encabezado: la etiqueta grande
  logoChip(ctx, e.logo, e.nombreAgencia, 56, 48, 62, 260, claro);
  const grito = (e.etiqueta || '¡Oferta!').toUpperCase();
  ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
  const tg = ajustar(ctx, grito, W - 420, vertical ? 84 : 66, 34);
  ctx.fillStyle = '#fbbf24'; ctx.fillText(grito, W - 56, 112); void tg;

  // foto en marco blanco, un poco girada
  const yF = vertical ? 200 : 170, altoF = vertical ? 700 : 450;
  ctx.save();
  ctx.translate(W / 2, yF + altoF / 2); ctx.rotate(-0.025);
  sombra(ctx, true, 40, 18, 0.45);
  ctx.fillStyle = '#ffffff'; rectRedondo(ctx, -(W - 100) / 2, -altoF / 2, W - 100, altoF, 26); ctx.fill();
  sombra(ctx, false);
  if (foto) fotoConFondo(ctx, foto, -(W - 100) / 2 + 12, -altoF / 2 + 12, W - 124, altoF - 24, 18);
  ctx.restore();
  let y = yF + altoF;
  if (vertical && e.extras.length) { y += 30; y += filaExtras(e, 50, y, W - 100, 190, 18, 22); }

  // sello de enganche
  if (e.enganche) {
    const r = vertical ? 118 : 96, cx = W - 56 - r + 14, cy = yF + r * 0.55;
    sombra(ctx, true, 20, 8, 0.4);
    ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); sombra(ctx, false);
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#111827';
    ctx.font = `bold ${r * 0.2}px ${LETRA}`; ctx.fillText('ENGANCHE', cx, cy - r * 0.28);
    ctx.fillText('DESDE', cx, cy - r * 0.05);
    const tam = ajustar(ctx, pesos(e.enganche), r * 1.55, r * 0.34, 18); void tam;
    ctx.fillStyle = '#111827'; ctx.fillText(pesos(e.enganche), cx, cy + r * 0.38);
  }

  // nombre y datos
  y += vertical ? 78 : 66;
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  const nombre = `${t.completo}${a.year ? ` ${a.year}` : ''}`;
  ajustar(ctx, nombre, W - 120, vertical ? 66 : 54, 30);
  ctx.fillStyle = '#ffffff'; ctx.fillText(nombre, 60, y);
  const datos = [a.km ? `${Number(a.km).toLocaleString('es-MX')} km` : '', a.transmission, a.color].filter(Boolean).join('   ·   ');
  y += vertical ? 50 : 40; ctx.font = `bold ${vertical ? 30 : 26}px ${LETRA}`; ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillText(datos, 60, y);

  // precio enorme
  const precio = pesos(a.price);
  const hP = vertical ? 190 : 150, yP = vertical ? H - 190 - hP : H - 40 - hP - (e.tel ? 0 : 0);
  ctx.font = `bold ${vertical ? 110 : 92}px ${LETRA}`;
  const wP = Math.min(W - 112, ctx.measureText(precio).width + 100);
  if (e.antes) { ctx.font = `bold ${vertical ? 38 : 32}px ${LETRA}`; ctx.fillStyle = '#fecaca'; const ta = `Antes ${pesos(e.antes)}`; ctx.fillText(ta, 62, yP - 16); ctx.fillRect(62, yP - 16 - 12, ctx.measureText(ta).width, 4); }
  sombra(ctx, true, 28, 10, 0.4);
  ctx.fillStyle = '#ffffff'; rectRedondo(ctx, 56, yP, wP, hP, 28); ctx.fill(); sombra(ctx, false);
  const tamP = ajustar(ctx, precio, wP - 60, vertical ? 110 : 92, 40); void tamP;
  ctx.fillStyle = p.marca === '#ffffff' ? '#0f172a' : (luz(p.marca) > 0.62 ? '#0f172a' : p.marca);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(precio, 56 + wP / 2, yP + hP / 2 + 6);
  if (e.tel) {
    if (vertical) botonWhatsApp(ctx, e.tel, W / 2, H - 150, 36);
    else { ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic'; ctx.font = `bold 28px ${LETRA}`; ctx.fillStyle = '#ffffff'; ctx.fillText('Escríbenos por', W - 56, yP + 52); ctx.font = `bold 34px ${LETRA}`; ctx.fillStyle = '#86efac'; ctx.fillText(`WhatsApp ${e.tel}`, W - 56, yP + 100); }
  }
}

/* =====================================================================
   CON DATOS — foto y una cuadrícula de datos técnicos: para quien
   compara autos antes de escribir.
   ===================================================================== */
function conDatos(e: EntradaPlantilla) {
  const { ctx, W, H, vertical, a, foto, p } = e;
  const t = tituloAuto(a);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);

  // cinta de color con logo y nombre
  const hCinta = 132;
  ctx.fillStyle = p.marca; ctx.fillRect(0, 0, W, hCinta);
  logoChip(ctx, e.logo, e.nombreAgencia, 50, 34, 62, 260, p.sobreMarca);
  if (e.etiqueta) etiquetaPastilla(ctx, e.etiqueta.toUpperCase(), W - 50, 40, 26, p.sobreMarca, p.marca);
  else if (e.nombreAgencia && e.logo) { ctx.font = `bold 30px ${LETRA}`; ctx.fillStyle = p.sobreMarca; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText(e.nombreAgencia, W - 50, hCinta / 2); }

  const altoF = vertical ? 700 : 420;
  if (foto) fotoConFondo(ctx, foto, 0, hCinta, W, altoF);
  let y = hCinta + altoF;
  if (vertical && e.extras.length) { y += 16; y += filaExtras(e, 40, y, W - 80, 200, 16, 20) + 8; }
  ctx.fillStyle = p.marca; ctx.fillRect(0, y, W, 8); y += 8;

  // título y precio en la misma línea
  const alturaTit = vertical ? 150 : 118;
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  ctx.font = `bold ${vertical ? 28 : 24}px ${LETRA}`; ctx.fillStyle = p.marca;
  ctx.fillText(`${t.marca}${a.year ? `  ·  ${a.year}` : ''}`, 50, y + (vertical ? 54 : 44));
  const precio = pesos(a.price);
  ctx.textAlign = 'right';
  ajustar(ctx, precio, 430, vertical ? 76 : 62, 38);
  ctx.fillStyle = '#0f172a'; ctx.fillText(precio, W - 50, y + (vertical ? 104 : 88));
  if (e.antes) { ctx.font = `bold ${vertical ? 28 : 24}px ${LETRA}`; ctx.fillStyle = '#ef4444'; const ta = `Antes ${pesos(e.antes)}`; ctx.fillText(ta, W - 50, y + (vertical ? 36 : 30)); const w = ctx.measureText(ta).width; ctx.fillRect(W - 50 - w, y + (vertical ? 26 : 21), w, 3); }
  ctx.textAlign = 'left';
  ajustar(ctx, t.modelo, W - 100 - 440, vertical ? 66 : 54, 30);
  ctx.fillStyle = '#0f172a'; ctx.fillText(t.modelo, 50, y + (vertical ? 112 : 90));
  y += alturaTit;

  // cuadrícula de datos
  const specs = especificaciones(a).filter(([k]) => k !== 'Año').slice(0, vertical ? 8 : 6);
  const colsN = vertical ? 2 : 3;
  const filas = Math.ceil(specs.length / colsN);
  const yPie = H - (vertical ? 230 : 126);
  const espacio = yPie - y - 14;
  const hCel = Math.min(vertical ? 120 : 92, (espacio - 14 * (filas - 1)) / Math.max(1, filas));
  const wCel = (W - 100 - 14 * (colsN - 1)) / colsN;
  specs.forEach(([k, v], i) => {
    const cx = 50 + (i % colsN) * (wCel + 14), cy = y + Math.floor(i / colsN) * (hCel + 14);
    ctx.fillStyle = p.suave; rectRedondo(ctx, cx, cy, wCel, hCel, 16); ctx.fill();
    ctx.fillStyle = p.marca; ctx.fillRect(cx, cy + hCel * 0.2, 6, hCel * 0.6);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.font = `bold ${hCel * 0.2}px ${LETRA}`; ctx.fillStyle = '#64748b'; ctx.fillText(k.toUpperCase(), cx + 22, cy + hCel * 0.38);
    ajustar(ctx, v, wCel - 44, hCel * 0.36, 16);
    ctx.fillStyle = '#0f172a'; ctx.fillText(v, cx + 22, cy + hCel * 0.78);
  });

  // pie
  ctx.fillStyle = p.oscuro; ctx.fillRect(0, yPie, W, H - yPie);
  ctx.textBaseline = 'alphabetic';
  if (!vertical) {
    if (e.enganche) { ctx.textAlign = 'left'; ctx.font = `bold 22px ${LETRA}`; ctx.fillStyle = '#94a3b8'; ctx.fillText('A CRÉDITO · ENGANCHE DESDE', 50, yPie + 46); ctx.font = `bold 48px ${LETRA}`; ctx.fillStyle = '#ffffff'; ctx.fillText(pesos(e.enganche), 50, yPie + 98); }
    if (e.tel) { ctx.textAlign = 'right'; ctx.font = `bold 22px ${LETRA}`; ctx.fillStyle = '#94a3b8'; ctx.fillText('ESCRÍBENOS', W - 50, yPie + 46); ctx.font = `bold 38px ${LETRA}`; ctx.fillStyle = '#25d366'; ctx.fillText(e.tel, W - 50, yPie + 98); }
  } else {
    if (e.enganche) { ctx.textAlign = 'center'; ctx.font = `bold 40px ${LETRA}`; ctx.fillStyle = '#ffffff'; ctx.fillText(`A crédito · enganche desde ${pesos(e.enganche)}`, W / 2, yPie + 66); }
    if (e.tel) botonWhatsApp(ctx, e.tel, W / 2, yPie + 100, 34);
  }
}

export function dibujarPlantilla(id: PlantillaRed, e: EntradaPlantilla) {
  if (id === 'moderna') return moderna(e);
  if (id === 'elegante') return elegante(e);
  if (id === 'oferta') return oferta(e);
  if (id === 'ficha') return conDatos(e);
}
