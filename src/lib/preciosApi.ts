import { auth } from './firebase';
import { getApiUrl } from './api';

/** Llamadas a /api/precios/* con la sesión de quien está en la pantalla. */
export async function llamarPrecios<T = any>(ruta: string, metodo: 'GET' | 'POST' | 'PUT' = 'GET', cuerpo?: unknown): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  const r = await fetch(getApiUrl(ruta), {
    method: metodo,
    headers: { Authorization: `Bearer ${token}`, ...(cuerpo ? { 'Content-Type': 'application/json' } : {}) },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d.error || 'No se pudo completar.'), { status: r.status });
  return d as T;
}
