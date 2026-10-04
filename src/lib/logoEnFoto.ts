import { aDataUrl, cargar } from './fichaPdf';

/**
 * Logo de la agencia sobre las fotos de sus autos. Se estampa en el navegador
 * al subir la foto (o a las que ya están, desde la página del auto); no se
 * manda nada a ningún servicio.
 *
 * El ajuste vive en el documento de la agencia (`fotosConLogo`) y lo cambia un
 * administrador: así todos los vendedores suben las fotos igual.
 */

export type PosicionLogo = 'abajo-derecha' | 'abajo-izquierda' | 'arriba-derecha' | 'arriba-izquierda' | 'centro';
export type TamanoLogo = 'chico' | 'mediano' | 'grande';

export interface ConfigLogoFotos {
  activo: boolean;
  posicion: PosicionLogo;
  tamano: TamanoLogo;
  /** 0.3 a 1 */
  opacidad: number;
  /** Quita el fondo blanco o gris claro del logo (para logos que traen fondo). */
  sinFondo: boolean;
}

export const CONFIG_LOGO_POR_OMISION: ConfigLogoFotos = {
  activo: false, posicion: 'abajo-derecha', tamano: 'mediano', opacidad: 0.9, sinFondo: false,
};

export function configLogoDe(agencia: any): ConfigLogoFotos {
  return { ...CONFIG_LOGO_POR_OMISION, ...(agencia?.fotosConLogo || {}) };
}

const ANCHO_RELATIVO: Record<TamanoLogo, number> = { chico: 0.14, mediano: 0.2, grande: 0.28 };

/** El logo listo para estampar (con o sin su fondo claro). */
export async function prepararLogo(url: string | undefined, sinFondo: boolean): Promise<HTMLImageElement | null> {
  const img = await cargar(await aDataUrl(url));
  if (!img || !sinFondo) return img;
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  try {
    const datos = ctx.getImageData(0, 0, c.width, c.height);
    const p = datos.data;
    for (let i = 0; i < p.length; i += 4) {
      const max = Math.max(p[i], p[i + 1], p[i + 2]), min = Math.min(p[i], p[i + 1], p[i + 2]);
      if (min > 215 && max - min < 25) p[i + 3] = 0;
    }
    ctx.putImageData(datos, 0, 0);
  } catch { return img; }
  return cargar(c.toDataURL('image/png'));
}

/** Dibuja el logo sobre un canvas que ya tiene la foto. */
export function dibujarLogo(ctx: CanvasRenderingContext2D, ancho: number, alto: number, logo: HTMLImageElement, c: ConfigLogoFotos) {
  const centro = c.posicion === 'centro';
  const w = ancho * (centro ? Math.max(0.4, ANCHO_RELATIVO[c.tamano] * 2) : ANCHO_RELATIVO[c.tamano]);
  const h = w * (logo.height / logo.width);
  const margen = Math.round(Math.min(ancho, alto) * 0.035);
  let x = margen, y = margen;
  if (centro) { x = (ancho - w) / 2; y = (alto - h) / 2; }
  if (c.posicion.endsWith('derecha')) x = ancho - w - margen;
  if (c.posicion.startsWith('abajo')) y = alto - h - margen;
  ctx.save();
  ctx.globalAlpha = Math.min(1, Math.max(0.2, c.opacidad)) * (centro ? 0.6 : 1);
  if (c.sinFondo) {
    // Sin fondo, una sombra suave para que se lea sobre fotos claras u oscuras.
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = Math.round(w * 0.04);
  }
  ctx.drawImage(logo, x, y, w, h);
  ctx.restore();
}

/** Foto (archivo o liga) → JPG con el logo. */
export async function estamparLogo(foto: Blob | string, logo: HTMLImageElement, c: ConfigLogoFotos): Promise<Blob> {
  const src = typeof foto === 'string' ? await aDataUrl(foto) : URL.createObjectURL(foto);
  const img = await cargar(src);
  if (typeof foto !== 'string') URL.revokeObjectURL(src);
  if (!img) throw new Error('No se pudo leer la foto');
  const canvas = document.createElement('canvas');
  canvas.width = img.width; canvas.height = img.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  dibujarLogo(ctx, canvas.width, canvas.height, logo, c);
  return new Promise((ok, mal) => canvas.toBlob((b) => (b ? ok(b) : mal(new Error('No se pudo armar la foto'))), 'image/jpeg', 0.86));
}
