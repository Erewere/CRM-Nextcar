import React, { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { llamarPrecios } from '../../lib/preciosApi';

/** «Calidad de compras» en el tablero: lo pagado contra la guía, en cuatro números. Es costos: si no tienes permiso, no aparece. */

type Resumen = {
  comparables: number; caras: number; buenas: number; enLinea: number; pctPorEncimaDeGuia: number; medianaDiferenciaPct: number;
  sobreprecioPromedioPct: number; sobreprecioTotal: number; ahorroTotal: number; sinGuia: number; insights: string[];
};
const dinero = (n: number) => '$' + Math.round(n).toLocaleString('es-MX');

export function ResumenComprasTablero() {
  const [r, setR] = useState<Resumen | null>(null);
  useEffect(() => { llamarPrecios('/api/precios/compras').then((d) => setR(d.resumen)).catch(() => {}); }, []);
  if (!r || !r.comparables) return null;

  const t = (titulo: string, valor: string, sub: string) => (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{titulo}</p>
      <p className="text-2xl font-extrabold tracking-tight mt-1 text-slate-900 dark:text-white">{valor}</p>
      <p className="text-xs text-slate-500">{sub}</p>
    </div>
  );
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
      <div className="px-4 py-3 flex items-center gap-2 border-b border-slate-200 dark:border-slate-700">
        <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">Calidad de compras</h2>
        <span className="text-xs text-slate-500">contra la guía de compra</span>
        <Link to="/precios" className="ml-auto text-xs font-bold text-slate-700 dark:text-slate-300 hover:underline">Ver detalle →</Link>
      </div>
      <div className="p-3 grid grid-cols-2 lg:grid-cols-4 gap-2">
        {t('Pasadas del máximo', `${r.pctPorEncimaDeGuia}%`, `${r.caras} de ${r.comparables} compras`)}
        {t('Sobreprecio promedio', r.caras ? `+${r.sobreprecioPromedioPct}%` : '—', r.caras ? `${dinero(r.sobreprecioTotal)} en total` : 'sin compras caras')}
        {t('Buenas compras', String(r.buenas), r.buenas ? `${dinero(r.ahorroTotal)} bajo la guía` : 'ninguna todavía')}
        {t('Compra típica', `${r.medianaDiferenciaPct > 0 ? '+' : ''}${r.medianaDiferenciaPct}%`, 'contra la guía')}
      </div>
      {r.insights[0] && <p className="px-4 pb-3 text-xs text-slate-600 dark:text-slate-400">{r.insights[0]}</p>}
    </div>
  );
}
