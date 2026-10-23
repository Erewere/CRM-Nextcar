import { useEffect, useState } from 'react';
import { auth } from '../../lib/firebase';
import { getApiUrl } from '../../lib/api';

/**
 * Master: cuántas consultas de PlacasInfo tiene cada agencia comprada, contra lo que Luis tiene en PlacasInfo.
 * Cada agencia tiene su saldo en el CRM; todas gastan de la misma bolsa que Luis compra en PlacasInfo. Si la suma de
 * los saldos pasa de lo que queda en PlacasInfo, hay que recargar.
 */
async function pedir(ruta: string, cuerpo?: unknown) {
  const token = await auth.currentUser?.getIdToken();
  const r = await fetch(getApiUrl(ruta), { method: cuerpo ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}`, ...(cuerpo ? { 'Content-Type': 'application/json' } : {}) }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'No se pudo completar.');
  return d;
}

export function ConsumoPlacasInfo() {
  const [d, setD] = useState<any>(null);
  const [error, setError] = useState('');
  const cargar = () => pedir('/api/admin/placasinfo').then(setD).catch((e) => setError(e.message));
  useEffect(() => { cargar(); }, []);
  if (error) return null;
  if (!d) return null;
  const debidas = d.agencias.reduce((s: number, a: any) => s + a.saldo, 0);
  const enPlacas = d.creditosPlacasInfo;
  const falta = enPlacas !== null && enPlacas < debidas + 20;
  const regalar = async (a: any) => {
    const n = Number(window.prompt(`¿Cuántas consultas le regalas a ${a.nombre}? (1 a 200)`, '5'));
    if (!n) return;
    try { await pedir('/api/admin/placasinfo/regalar', { agencyId: a.agencyId, cantidad: n }); cargar(); } catch (e: any) { alert(e.message); }
  };
  return (
    <section>
      <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">Consultas de antecedentes (PlacasInfo)</h2>
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-4 space-y-3">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div><p className="text-2xl font-extrabold text-slate-900 dark:text-white">{enPlacas ?? '—'}</p><p className="text-[11px] text-slate-500">te quedan en PlacasInfo</p></div>
          <div><p className="text-2xl font-extrabold text-slate-900 dark:text-white">{debidas}</p><p className="text-[11px] text-slate-500">de agencias por usar</p></div>
          <div><p className="text-2xl font-extrabold text-slate-900 dark:text-white">{d.consultasTotales}</p><p className="text-[11px] text-slate-500">consultas hechas</p></div>
        </div>
        {falta && <p className="text-sm font-semibold text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded-lg px-3 py-2">Recarga créditos en PlacasInfo: lo que debes a las agencias ({debidas}) casi alcanza lo que tienes ({enPlacas}). Comprar 100 o más de una vez sale a $1.00 cada uno; 1,000 o más, a $0.80.</p>}
        {d.agencias.length === 0 ? (
          <p className="text-sm text-slate-500">Ninguna agencia ha usado ni comprado consultas todavía.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-700 text-sm">
            {d.agencias.map((a: any) => (
              <li key={a.agencyId} className="py-2 flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-slate-800 dark:text-slate-100">{a.nombre}</span>
                <span className="text-slate-600 dark:text-slate-300">saldo <b>{a.saldo}</b> · compró {a.comprados} · regalo {a.regalados} · usó {a.usados}</span>
                <button onClick={() => regalar(a)} className="h-8 px-3 rounded-lg border border-slate-300 dark:border-slate-600 text-xs font-bold">Regalar</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
