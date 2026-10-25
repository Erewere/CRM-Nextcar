// Un lead nuevo es un trato que LLEGÓ solo (WhatsApp, Messenger, formulario,
// Marketplace) hace poco y que nadie ha abierto todavía en este navegador.
// Los tratos capturados a mano no cuentan: quien los captura ya los conoce.

export const DIAS_LEAD_NUEVO = 3;

const ms = (v: any): number => {
  if (!v) return 0;
  if (typeof v === 'string') { const t = Date.parse(v); return Number.isFinite(t) ? t : 0; }
  if (typeof v.toDate === 'function') return v.toDate().getTime();
  const s = v.seconds ?? v._seconds;
  return typeof s === 'number' ? s * 1000 : 0;
};

export function esLeadNuevo(deal: { entrante?: boolean; isDeleted?: boolean; status?: string; createdAt?: any }): boolean {
  if (!deal.entrante || deal.isDeleted) return false;
  const s = String(deal.status || '').toLowerCase();
  if (s === 'won' || s === 'lost' || s === 'ganado' || s === 'perdido') return false;
  const creado = ms(deal.createdAt);
  return creado > 0 && Date.now() - creado < DIAS_LEAD_NUEVO * 86_400_000;
}
