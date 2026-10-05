import { auth } from './firebase';
import { getApiUrl } from './api';

/** Pagos de las ventas: todo pasa por el servidor (ver src/servidor/ventas.ts). */
async function api(ruta: string, cuerpo?: any) {
  const token = await auth.currentUser?.getIdToken();
  const r = await fetch(getApiUrl(ruta), {
    method: cuerpo ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${token}`, ...(cuerpo ? { 'Content-Type': 'application/json' } : {}) },
    ...(cuerpo ? { body: JSON.stringify(cuerpo) } : {}),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d?.error || `Error ${r.status}`), { datos: d });
  return d;
}

const clave = () => (crypto as any).randomUUID?.().replace(/-/g, '') || Math.random().toString(36).slice(2) + Date.now().toString(36);

export const ventasApi = {
  leer: (dealId: string) => api(`/api/ventas/${dealId}`),
  /** La clave la genera quien abre la ventana: si se manda dos veces, cuenta una. */
  nuevaClave: clave,
  pagar: (dealId: string, pago: { monto: number; fecha: string; forma: string; concepto: string; nota?: string; clave: string }) => api(`/api/ventas/${dealId}/pagos`, pago),
  anular: (dealId: string, pagoId: string, motivo: string) => api(`/api/ventas/${dealId}/pagos/${pagoId}/anular`, { motivo }),
  liquidar: (dealId: string, datos: { fecha: string; forma: string; descontarIntereses: boolean; montoEsperado: number; nota?: string; clave: string }) => api(`/api/ventas/${dealId}/liquidar`, datos),
  /** Después de guardar la venta: vuelve a poner pagos y tareas de cobro en su lugar. */
  reflejar: (dealId: string) => api(`/api/ventas/${dealId}/reflejar`, {}).catch((e) => { console.error('reflejar venta:', e); }),
};
