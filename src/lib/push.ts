import { auth } from './firebase';
import { getApiUrl } from './api';

/**
 * Avisos al celular (Web Push) desde el navegador. La parte del servidor está en src/servidor/push.ts.
 *
 * En iPhone los avisos SOLO funcionan si el CRM está guardado en la pantalla de inicio («Agregar a pantalla de
 * inicio» en Safari) y se abre desde ahí; en Android y en la computadora funcionan desde el navegador.
 * El permiso solo se puede pedir al tocar un botón, nunca al cargar la página.
 */

export const pushSoportado = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
export const esIPhone = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const esAppGuardada = () => (navigator as any).standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true;

async function pedir(ruta: string, metodo: 'GET' | 'POST' = 'GET', cuerpo?: unknown) {
  const token = await auth.currentUser?.getIdToken();
  const r = await fetch(getApiUrl(ruta), {
    method: metodo,
    headers: { Authorization: `Bearer ${token}`, ...(cuerpo ? { 'Content-Type': 'application/json' } : {}) },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d.error || 'No se pudo completar.'), { datos: d });
  return d;
}

const aBytes = (base64Url: string) => {
  const relleno = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const b64 = (base64Url + relleno).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  return Uint8Array.from([...bin].map((c) => c.charCodeAt(0)));
};

export type EstadoPush = {
  soportado: boolean;
  /** iPhone con el CRM abierto en Safari: hay que guardarlo en la pantalla de inicio primero. */
  necesitaGuardarla: boolean;
  permiso: NotificationPermission | 'no-disponible';
  /** Este celular o navegador ya está suscrito. */
  esteDispositivo: boolean;
  /** Dispositivos suscritos de esta persona (celular, computadora…). */
  dispositivos: number;
};

export async function estadoPush(): Promise<EstadoPush> {
  const soportado = pushSoportado();
  const necesitaGuardarla = esIPhone() && !esAppGuardada();
  if (!soportado) return { soportado: false, necesitaGuardarla, permiso: 'no-disponible', esteDispositivo: false, dispositivos: 0 };
  let esteDispositivo = false;
  try {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js');
    esteDispositivo = !!(reg && (await reg.pushManager.getSubscription()));
  } catch { /* sin registro: no está suscrito */ }
  let dispositivos = 0;
  try { dispositivos = (await pedir('/api/push/estado')).dispositivos || 0; } catch { /* sin sesión: no se sabe */ }
  return { soportado, necesitaGuardarla, permiso: Notification.permission, esteDispositivo, dispositivos };
}

/** Llamar SOLO desde un toque del usuario (iOS no deja pedir el permiso de otra forma). */
export async function activarPush() {
  if (!pushSoportado()) throw new Error('Este navegador no recibe avisos.');
  if (esIPhone() && !esAppGuardada()) throw new Error('En iPhone primero guarda el CRM en la pantalla de inicio y ábrelo desde ahí.');
  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') throw new Error('No diste permiso para los avisos. Puedes cambiarlo en los Ajustes del teléfono, en Notificaciones.');
  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  const { publicKey } = await pedir('/api/push/clave');
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: aBytes(publicKey) });
  await pedir('/api/push/suscribir', 'POST', { subscription: sub.toJSON() });
}

export async function desactivarPush() {
  const reg = await navigator.serviceWorker.getRegistration('/sw.js');
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  try { await pedir('/api/push/baja', 'POST', { endpoint: sub.endpoint }); } catch { /* si el servidor no responde, igual se quita aquí */ }
  await sub.unsubscribe();
}

export async function probarPush(): Promise<{ dispositivos: number; entregados: number; fallos: { estado?: number; motivo?: string }[] }> {
  return pedir('/api/push/probar', 'POST', {});
}
