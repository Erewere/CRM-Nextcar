import imageCompression from 'browser-image-compression';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';
import { estamparLogo, type ConfigLogoFotos } from './logoEnFoto';

export interface MarcaEnFotos { logo: HTMLImageElement; config: ConfigLogoFotos }
export interface ResultadoSubida { urls: string[]; fallidas: { nombre: string; motivo: string }[] }

const pareceHeic = (a: File) => /hei[cf]/i.test(a.type) || /\.(heic|heif)$/i.test(a.name || '');

/**
 * Las fotos del iPhone vienen en HEIC y Chrome no las sabe abrir: sin esto
 * la subida fallaba sin decir por qué. Se convierten a JPG aquí mismo; la
 * librería (~2 MB) solo se descarga cuando de verdad llega una HEIC.
 */
async function aJpegSiEsHeic(archivo: File): Promise<File> {
  if (!pareceHeic(archivo)) return archivo;
  const { heicTo } = await import('heic-to');
  const jpg = await heicTo({ blob: archivo, type: 'image/jpeg', quality: 0.9 });
  return new File([jpg], (archivo.name || 'foto').replace(/\.(heic|heif)$/i, '') + '.jpg', { type: 'image/jpeg' });
}

/** Un error de imagen a veces llega como Event, sin mensaje: traducirlo. */
function motivoDe(e: any, archivo: File) {
  const m = e?.message || (typeof e === 'string' ? e : '');
  if (m && !/^\[object/.test(m)) return m;
  return pareceHeic(archivo) ? 'no se pudo convertir la foto HEIC' : 'el navegador no pudo abrir la foto (¿formato raro o archivo dañado?)';
}

/**
 * Sube fotos de un auto ya comprimidas, igual que la página de Nextcar
 * (optimizarImagen en su db.php): lado mayor de 1600 px, calidad 82 % y
 * siempre JPG. Devuelve las ligas en el orden en que se eligieron.
 * Con `marca`, cada foto lleva el logo de la agencia.
 * Si una foto falla se sigue con las demás y se avisa cuál y por qué.
 */
export async function subirFotosDeAuto(
  archivos: FileList | File[],
  usuarioId: string,
  autoId: string,
  alAvanzar?: (hechas: number, total: number) => void,
  marca?: MarcaEnFotos | null
): Promise<ResultadoSubida> {
  const lista = Array.from(archivos);
  const urls: string[] = [];
  const fallidas: ResultadoSubida['fallidas'] = [];
  for (let i = 0; i < lista.length; i++) {
    const archivo = lista[i];
    try {
      const legible = await aJpegSiEsHeic(archivo);
      const comprimida = await imageCompression(legible, {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 1600,
        initialQuality: 0.82,
        fileType: 'image/jpeg',
        useWebWorker: true,
      });
      const final = marca ? await estamparLogo(comprimida, marca.logo, marca.config) : comprimida;
      const base = (archivo.name || 'foto').replace(/\.[^.]+$/, '').replace(/[^\w-]+/g, '_').slice(0, 60);
      const destino = ref(storage, `users/${usuarioId}/vehicles/${autoId}/${Date.now()}_${i}_${base}.jpg`);
      await uploadBytes(destino, final, { contentType: 'image/jpeg' });
      urls.push(await getDownloadURL(destino));
    } catch (e: any) {
      console.error('foto no subida:', archivo.name, e);
      fallidas.push({ nombre: archivo.name || `foto ${i + 1}`, motivo: motivoDe(e, archivo) });
    }
    alAvanzar?.(i + 1, lista.length);
  }
  return { urls, fallidas };
}

/** Texto para avisar de las que no subieron. */
export function avisoFallidas(f: ResultadoSubida['fallidas']) {
  if (!f.length) return '';
  return `${f.length === 1 ? 'Una foto no se subió' : `${f.length} fotos no se subieron`}:\n` + f.slice(0, 8).map((x) => `• ${x.nombre}: ${x.motivo}`).join('\n');
}

/**
 * Pone el logo a fotos que ya están subidas: cada una se baja, se le estampa
 * el logo y se sube como archivo nuevo. La original no se borra: se devuelve
 * el par (original → con logo) para poder regresarla.
 */
export async function ponerLogoAFotos(
  urls: string[],
  usuarioId: string,
  autoId: string,
  marca: MarcaEnFotos,
  alAvanzar?: (hechas: number, total: number) => void
): Promise<{ original: string; conLogo: string }[]> {
  const pares: { original: string; conLogo: string }[] = [];
  for (let i = 0; i < urls.length; i++) {
    const blob = await estamparLogo(urls[i], marca.logo, marca.config);
    const destino = ref(storage, `users/${usuarioId}/vehicles/${autoId}/${Date.now()}_${i}_con_logo.jpg`);
    await uploadBytes(destino, blob, { contentType: 'image/jpeg' });
    pares.push({ original: urls[i], conLogo: await getDownloadURL(destino) });
    alAvanzar?.(i + 1, urls.length);
  }
  return pares;
}
