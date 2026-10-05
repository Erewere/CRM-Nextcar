import { auth } from './firebase';
import { getApiUrl } from './api';

/**
 * Embudo → créditos. Cuando un trato llega a la etapa de crédito (cualquier
 * etapa cuyo nombre diga «crédito»), el servidor abre su solicitud con los
 * datos del cliente, o la liga si el cliente ya tenía una abierta. Se avisa
 * en pantalla con un evento que escucha el Layout.
 */
export const esEtapaCredito = (titulo?: string) =>
  /credito/.test(String(titulo || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''));

export async function avisarEtapaCredito(dealId: string | null | undefined, etapaId: string, etapas: { id: string; title?: string }[]) {
  if (!dealId) return;
  const etapa = etapas.find((e) => e.id === etapaId);
  if (!etapa || !esEtapaCredito(etapa.title)) return;
  try {
    const token = await auth.currentUser?.getIdToken();
    const r = await fetch(getApiUrl('/api/creditos/desde-trato'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ dealId }),
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok && d.id) window.dispatchEvent(new CustomEvent('nc-credito-abierto', { detail: d }));
  } catch { /* el cambio de etapa ya se guardó; la solicitud se puede abrir a mano */ }
}
