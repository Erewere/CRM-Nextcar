import imageCompression from 'browser-image-compression';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

/**
 * Sube fotos de un auto ya comprimidas, igual que la página de Nextcar
 * (optimizarImagen en su db.php): lado mayor de 1600 px, calidad 82 % y
 * siempre JPG. Devuelve las ligas en el orden en que se eligieron.
 */
export async function subirFotosDeAuto(
  archivos: FileList | File[],
  usuarioId: string,
  autoId: string,
  alAvanzar?: (hechas: number, total: number) => void
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
    const base = (archivo.name || 'foto').replace(/\.[^.]+$/, '').replace(/[^\w-]+/g, '_').slice(0, 60);
    const destino = ref(storage, `users/${usuarioId}/vehicles/${autoId}/${Date.now()}_${i}_${base}.jpg`);
    await uploadBytes(destino, comprimida);
    urls.push(await getDownloadURL(destino));
    alAvanzar?.(i + 1, lista.length);
  }
  return urls;
}
