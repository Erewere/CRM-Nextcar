import type { Vehicle } from '../types';
import { aDataUrl, cargar, planDeCredito } from './fichaPdf';

/**
 * Imágenes para redes de un auto, armadas en el navegador (canvas):
 * cuadrada 1080×1080 (publicación de Facebook, Instagram, Marketplace) y
 * vertical 1080×1920 (historias y estados de WhatsApp). La foto va completa,
 * sin recortar, sobre un fondo hecho con la misma foto oscurecida.
 */

export type FormatoRed = 'cuadrada' | 'vertical';

export interface OpcionesRed {
  auto: Vehicle;
  foto: string;                 // la principal
  fotosExtra: string[];         // hasta 2, solo en la vertical
  agencia?: { name?: string; phone?: string; phoneWhatsApp?: string; logoUrl?: string } | null;
  telefono?: string;            // WhatsApp que sale en la imagen
  etiqueta?: string;            // «¡Recién llegado!», etc.
  conEnganche: boolean;
}

const AZUL = '#0f172a', ACENTO = '#1d4ed8', VERDE = '#25d366', AMBAR = '#f59e0b';
const LETRA = '"Helvetica Neue", Helvetica, Arial, sans-serif';
const pesos = (n: number) => `$${Math.round(Number(n) || 0).toLocaleString('es-MX')}`;

async function imagen(url?: string) {
  if (!url) return null;
  return cargar(await aDataUrl(url));
}

function rectRedondo(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

/** Foto completa (contain) dentro de un recuadro, con fondo de la misma foto difuminada/oscura. */
function fotoConFondo(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, radio = 0) {
  ctx.save();
  if (radio) rectRedondo(ctx, x, y, w, h, radio); else { ctx.beginPath(); ctx.rect(x, y, w, h); }
  ctx.clip();
  // Fondo: la foto llenando todo (un poco más grande, para que el difuminado
  // no deje orillas claras), difuminada si el navegador puede, y oscurecida.
  const rc = Math.max(w / img.width, h / img.height) * 1.15;
  try { (ctx as any).filter = 'blur(28px)'; } catch { /* sin difuminado */ }
  ctx.drawImage(img, x + (w - img.width * rc) / 2, y + (h - img.height * rc) / 2, img.width * rc, img.height * rc);
  try { (ctx as any).filter = 'none'; } catch { /* nada */ }
  ctx.fillStyle = 'rgba(15,23,42,0.45)'; ctx.fillRect(x, y, w, h);
  // La foto completa encima.
  const r = Math.min(w / img.width, h / img.height);
  const iw = img.width * r, ih = img.height * r;
  ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
  ctx.restore();
}

function textoAjustado(ctx: CanvasRenderingContext2D, t: string, maxW: number, tam: number, peso = 'bold', min = 28) {
  let s = tam;
  ctx.font = `${peso} ${s}px ${LETRA}`;
  while (ctx.measureText(t).width > maxW && s > min) { s -= 2; ctx.font = `${peso} ${s}px ${LETRA}`; }
  return s;
}

function pastilla(ctx: CanvasRenderingContext2D, t: string, x: number, y: number, tam: number, fondo: string, color: string, alinear: 'left' | 'center' = 'left') {
  ctx.font = `bold ${tam}px ${LETRA}`;
  const w = ctx.measureText(t).width + tam * 1.4, h = tam * 1.9;
  const x0 = alinear === 'center' ? x - w / 2 : x;
  ctx.fillStyle = fondo; rectRedondo(ctx, x0, y, w, h, h / 2); ctx.fill();
  ctx.fillStyle = color; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  ctx.fillText(t, x0 + tam * 0.7, y + h / 2 + 1);
  return w;
}

function logoArriba(ctx: CanvasRenderingContext2D, logo: HTMLImageElement | null, nombre: string | undefined, x: number, y: number, altoMax: number, anchoMax: number) {
  if (logo) {
    const r = Math.min(anchoMax / logo.width, altoMax / logo.height);
    const w = logo.width * r, h = logo.height * r;
    ctx.fillStyle = 'rgba(255,255,255,0.94)'; rectRedondo(ctx, x - 18, y - 14, w + 36, h + 28, 18); ctx.fill();
    ctx.drawImage(logo, x, y, w, h);
  } else if (nombre) {
    ctx.font = `bold 40px ${LETRA}`; ctx.fillStyle = '#ffffff'; ctx.textBaseline = 'top'; ctx.textAlign = 'left';
    ctx.fillText(nombre, x, y);
  }
}

/** Ícono de WhatsApp dibujado (círculo verde con el globito), para no depender de otra imagen. */
function iconoWa(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.fillStyle = VERDE; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = r * 0.14; ctx.beginPath(); ctx.arc(cx, cy, r * 0.55, 0.7, Math.PI * 2 + 0.4); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx - r * 0.42, cy + r * 0.3); ctx.lineTo(cx - r * 0.55, cy + r * 0.62); ctx.lineTo(cx - r * 0.18, cy + r * 0.5); ctx.stroke();
}

export async function generarImagenRed(formato: FormatoRed, o: OpcionesRed): Promise<Blob> {
  const W = 1080, H = formato === 'cuadrada' ? 1080 : 1920;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d')!;
  const [foto, logo, ...extras] = await Promise.all([imagen(o.foto), imagen(o.agencia?.logoUrl), ...(formato === 'vertical' ? o.fotosExtra.slice(0, 2).map(imagen) : [])]);
  const a = o.auto;
  const titulo = `${a.make || ''} ${a.model || ''}`.trim();
  const datos = [a.year ? String(a.year) : '', a.km ? `${Number(a.km).toLocaleString('es-MX')} km` : '', a.transmission || ''].filter(Boolean);
  const plan = o.conEnganche ? planDeCredito(Number(a.year), Number(a.price)) : null;
  const tel = o.telefono || o.agencia?.phoneWhatsApp || o.agencia?.phone || '';
  const anterior = Number(a.fichaWeb?.precioAnterior) || 0;
  const antes = anterior > Number(a.price) ? anterior : 0;

  ctx.fillStyle = AZUL; ctx.fillRect(0, 0, W, H);

  if (formato === 'cuadrada') {
    // Foto arriba (70 %), panel oscuro abajo.
    const altoFoto = 700;
    if (foto) fotoConFondo(ctx, foto, 0, 0, W, altoFoto);
    // degradado para que el logo y la etiqueta se lean
    const g = ctx.createLinearGradient(0, 0, 0, 220); g.addColorStop(0, 'rgba(15,23,42,0.55)'); g.addColorStop(1, 'rgba(15,23,42,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, 220);
    logoArriba(ctx, logo, o.agencia?.name, 54, 46, 70, 300);
    if (o.etiqueta) pastilla(ctx, o.etiqueta.toUpperCase(), W - 54 - (() => { ctx.font = `bold 30px ${LETRA}`; return ctx.measureText(o.etiqueta!.toUpperCase()).width + 42; })(), 50, 30, AMBAR, AZUL);

    ctx.fillStyle = ACENTO; ctx.fillRect(0, altoFoto, W, 8);
    let y = altoFoto + 58;
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    ctx.font = `bold 30px ${LETRA}`; ctx.fillStyle = '#93c5fd';
    ctx.fillText(datos.join('   ·   '), 60, y);
    y += 66;
    const t1 = textoAjustado(ctx, titulo, W - 120, 64);
    ctx.fillStyle = '#ffffff'; ctx.fillText(titulo, 60, y);
    y += 30 + (t1 - 40);
    // precio y enganche
    const precio = pesos(a.price);
    if (antes) {
      ctx.font = `bold 34px ${LETRA}`; ctx.fillStyle = '#fca5a5';
      const t = `Antes ${pesos(antes)}`;
      ctx.fillText(t, 60, H - 178);
      ctx.fillRect(60, H - 190, ctx.measureText(t).width, 4);
    }
    textoAjustado(ctx, precio, 520, 96);
    ctx.fillStyle = '#ffffff'; ctx.fillText(precio, 60, H - 70);
    if (plan) {
      ctx.textAlign = 'right';
      ctx.font = `bold 26px ${LETRA}`; ctx.fillStyle = '#cbd5e1'; ctx.fillText('ENGANCHE DESDE', W - 60, H - 140);
      ctx.font = `bold 46px ${LETRA}`; ctx.fillStyle = '#ffffff'; ctx.fillText(pesos(plan.enganche), W - 60, H - 88);
    }
    if (tel) {
      ctx.textAlign = 'right';
      ctx.font = `bold 28px ${LETRA}`; ctx.fillStyle = VERDE;
      const t = `WhatsApp ${tel}`;
      ctx.fillText(t, W - 60, H - 46);
      const tw = ctx.measureText(t).width;
      iconoWa(ctx, W - 60 - tw - 26, H - 56, 18);
    }
  } else {
    // Vertical: logo, foto grande, dos fotos chicas, datos, precio y llamada a la acción.
    logoArriba(ctx, logo, o.agencia?.name, 70, 80, 90, 380);
    if (o.etiqueta) {
      ctx.font = `bold 34px ${LETRA}`;
      const w = ctx.measureText(o.etiqueta.toUpperCase()).width + 48;
      pastilla(ctx, o.etiqueta.toUpperCase(), W - 70 - w, 90, 34, AMBAR, AZUL);
    }
    // Primero se mide el texto de abajo; las fotos ocupan lo que sobra.
    const chicas = extras.filter(Boolean) as HTMLImageElement[];
    const altoTexto = 84 + 60 + (antes ? 40 : 0) + 140 + 30 + (plan ? 70 : 0) + 60;
    const yFoto = 250, finFotos = H - 210 - altoTexto;
    const espacio = finFotos - yFoto - 40;
    const altoChicas = chicas.length ? Math.round(espacio * 0.3) : 0;
    const altoFoto = espacio - (chicas.length ? altoChicas + 24 : 0);
    if (foto) fotoConFondo(ctx, foto, 50, yFoto, W - 100, altoFoto, 36);
    let y = yFoto + altoFoto + 24;
    if (chicas.length) {
      const w = (W - 100 - 24 * (chicas.length - 1)) / chicas.length;
      chicas.forEach((im, i) => fotoConFondo(ctx, im, 50 + i * (w + 24), y, w, altoChicas, 28));
    }
    y = finFotos + 40;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.font = `bold 34px ${LETRA}`; ctx.fillStyle = '#93c5fd';
    ctx.fillText(datos.join('   ·   '), W / 2, y);
    y += 84;
    textoAjustado(ctx, titulo, W - 140, 72);
    ctx.fillStyle = '#ffffff'; ctx.fillText(titulo, W / 2, y);
    y += 60;
    if (antes) {
      ctx.font = `bold 38px ${LETRA}`; ctx.fillStyle = '#fca5a5';
      const t = `Antes ${pesos(antes)}`;
      ctx.fillText(t, W / 2, y + 10);
      const tw = ctx.measureText(t).width;
      ctx.fillRect(W / 2 - tw / 2, y - 3, tw, 4);
      y += 40;
    }
    // precio en pastilla azul
    ctx.font = `bold 92px ${LETRA}`;
    const precio = pesos(a.price);
    const pw = ctx.measureText(precio).width + 110, ph = 140;
    ctx.fillStyle = ACENTO; rectRedondo(ctx, W / 2 - pw / 2, y, pw, ph, ph / 2); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.textBaseline = 'middle'; ctx.fillText(precio, W / 2, y + ph / 2 + 4);
    y += ph + 30;
    if (plan) {
      ctx.textBaseline = 'alphabetic'; ctx.font = `bold 38px ${LETRA}`; ctx.fillStyle = '#e2e8f0';
      ctx.fillText(`Enganche desde ${pesos(plan.enganche)}`, W / 2, y + 40);
      y += 70;
    }
    if (tel) {
      const t = `Escríbenos: ${tel}`;
      ctx.font = `bold 40px ${LETRA}`;
      const bw = ctx.measureText(t).width + 150, bh = 104, by = H - 170;
      ctx.fillStyle = VERDE; rectRedondo(ctx, W / 2 - bw / 2, by, bw, bh, bh / 2); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(W / 2 - bw / 2 + 62, by + bh / 2, 30, 0, Math.PI * 2); ctx.fill();
      iconoWa(ctx, W / 2 - bw / 2 + 62, by + bh / 2, 26);
      ctx.fillStyle = '#ffffff'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      ctx.fillText(t, W / 2 - bw / 2 + 110, by + bh / 2 + 2);
    }
  }

  return await new Promise<Blob>((ok, mal) => c.toBlob((b) => (b ? ok(b) : mal(new Error('No se pudo armar la imagen'))), 'image/jpeg', 0.9));
}

/** Texto para la publicación (sin IA: se arma con los datos del auto). */
export function textoParaPublicacion(o: OpcionesRed) {
  const a = o.auto;
  const plan = o.conEnganche ? planDeCredito(Number(a.year), Number(a.price)) : null;
  const tel = o.telefono || o.agencia?.phoneWhatsApp || o.agencia?.phone || '';
  const ficha = a.fichaWeb || {};
  const destacados = String(ficha.loQueNosEncanta || '').split(/\n+/).map((x: string) => x.trim()).filter(Boolean).slice(0, 3);
  const etiquetas = ['#Seminuevos', a.make ? `#${String(a.make).replace(/[^\p{L}\p{N}]/gu, '')}` : '', a.model ? `#${String(a.model).split(' ')[0].replace(/[^\p{L}\p{N}]/gu, '')}` : '', '#AutosUsados'].filter(Boolean);
  return [
    `🚗 ${a.year || ''} ${a.make || ''} ${a.model || ''}`.trim(),
    [a.km ? `${Number(a.km).toLocaleString('es-MX')} km` : '', a.transmission, a.color].filter(Boolean).join(' · '),
    '',
    Number(ficha.precioAnterior) > Number(a.price) ? `🔻 Antes ${pesos(Number(ficha.precioAnterior))}` : '',
    `💰 ${pesos(a.price)}${plan ? ` · Enganche desde ${pesos(plan.enganche)}` : ''}`,
    ...destacados.map((d) => `✅ ${d}`),
    '',
    tel ? `📲 Escríbenos por WhatsApp: ${tel}` : '',
    a.websiteUrl ? `🔎 Más fotos: ${a.websiteUrl}` : '',
    '',
    etiquetas.join(' '),
  ].filter((l, i, arr) => !(l === '' && arr[i - 1] === '')).join('\n').trim();
}
