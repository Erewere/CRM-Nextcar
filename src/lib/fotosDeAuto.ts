import imageCompression from 'browser-image-compression';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';
import { estamparLogo, type ConfigLogoFotos } from './logoEnFoto';

export interface MarcaEnFotos { logo: HTMLImageElement; config: ConfigLogoFotos }

/**
 * Sube fotos de un auto ya comprimidas, igual que la página de Nextcar
 * (optimizarImagen en su db.php): lado mayor de 1600 px, calidad 82 % y
 * siempre JPG. Devuelve las ligas en el orden en que se eligieron.
 * Con `marca`, cada foto lleva el logo de la agencia.
 */
export async function subirFotosDeAuto(
  archivos: FileList | File[],
  usuarioId: string,
  autoId: string,
  alAvanzar?: (hechas: number, total: number) => void,
  marca?: MarcaEnFotos | null
): Promise<string[]> {
  const lista = Array.from(archivos);
  const urls: string[] = [];
  for (let i = 0; i < lista.length; i++) {
    const archivo = lista[i];
    const comprimida = await imageCompression(archivo, {
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
    alAvanzar?.(i + 1, lista.length);
  }
  return urls;
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
