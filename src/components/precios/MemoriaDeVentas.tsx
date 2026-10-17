import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import clsx from 'clsx';
import { auth } from '../../lib/firebase';
import { getApiUrl } from '../../lib/api';

/** Cada auto vendido con lo que costó, lo que se gastó, en cuánto se vendió y cuántos días tardó. */

type Op = {
  vehicleId: string; titulo: string; precioCompra: number | null; gastos: number; gastosRegistrados: boolean; precioVenta: number | null;
  utilidad: number | null; margenPct: number | null; diasEnInventario: number | null; fechaVenta: string; esConsignacion: boolean; completa: boolean; faltantes: string[];
};
const dinero = (n: number | null | undefined) => (n || n === 0 ? '$' + Math.round(n).toLocaleString('es-MX') : '—');

export function MemoriaDeVentas() {
  const navigate = useNavigate();
  const [soloIncompletas, setSoloIncompletas] = useState(false);
  const [d, setD] = useState<{ operaciones: Op[]; resumen: { vendidos: number; completas: number; utilidadTotal: number; margenMedianoPct: number | null; diasMediana: number | null; incompletas: number } } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    (async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        const r = await fetch(getApiUrl('/api/precios/operaciones'), { headers: { Authorization: `Bearer ${token}` } });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || 'No se pudo leer.');
        setD(j);
      } catch (e: any) { setError(e.message); }
    })();
  }, []);
  const filas = useMemo(() => (d?.operaciones || []).filter((o) => !soloIncompletas || (!o.completa && !o.esConsignacion)), [d, soloIncompletas]);
  const abrir = (o: Op) => navigate(`/inventory/${o.vehicleId}?seccion=${o.faltantes.includes('precio de compra') ? 'costos' : 'datos'}`);
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!d) return <p className="text-sm text-slate-500">Cargando…</p>;
  const r = d.resumen;
  const t = (titulo: string, valor: string, sub?: string) => (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{titulo}</p>
      <p className="text-2xl font-extrabold tracking-tight mt-1 text-slate-900 dark:text-white">{valor}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {t('Autos vendidos', String(r.vendidos), `${r.completas} con todos sus datos`)}
        {t('Utilidad total', dinero(r.utilidadTotal), 'de los completos, después de gastos')}
        {t('Margen típico', r.margenMedianoPct === null ? '—' : `${r.margenMedianoPct}%`, 'utilidad entre precio de venta')}
        {t('Días para vender', r.diasMediana === null ? '—' : String(Math.round(r.diasMediana)), 'lo típico')}
      </div>
      {r.incompletas > 0 && (
        <div className="flex flex-wrap items-center gap-3 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <span>{r.incompletas} {r.incompletas === 1 ? 'venta está incompleta' : 'ventas están incompletas'} (falta el precio de compra o las fechas) y no se usan para recomendar. Toca el auto para completarlo en su ficha.</span>
          <button onClick={() => setSoloIncompletas((x) => !x)} className="ml-auto h-8 px-3 rounded-lg border border-amber-300 bg-white font-semibold">{soloIncompletas ? 'Ver todas' : 'Ver solo las incompletas'}</button>
        </div>
      )}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto">
        <table className="w-full text-sm min-w-[860px]">
          <thead>
            <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 dark:border-slate-700">
              <th className="px-4 py-3">Auto</th><th className="px-3 py-3 text-right">Compra</th><th className="px-3 py-3 text-right">Gastos</th><th className="px-3 py-3 text-right">Venta</th>
              <th className="px-3 py-3 text-right">Utilidad</th><th className="px-3 py-3 text-right">Margen</th><th className="px-3 py-3 text-right">Días</th><th className="px-3 py-3">Vendido</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((o) => (
              <tr key={o.vehicleId} onClick={() => abrir(o)} className={clsx('border-t border-slate-100 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/40', !o.completa && 'text-slate-500')} title={o.faltantes.length ? `Falta: ${o.faltantes.join(', ')}` : undefined}>
                <td className="px-4 py-2.5 font-semibold">{o.titulo}{o.esConsignacion && <span className="ml-2 text-xs font-normal">consignación</span>}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{dinero(o.precioCompra)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{o.gastosRegistrados ? dinero(o.gastos) : '—'}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{dinero(o.precioVenta)}</td>
                <td className={clsx('px-3 py-2.5 text-right tabular-nums font-semibold', o.utilidad !== null && (o.utilidad < 0 ? 'text-red-600' : 'text-emerald-700'))}>{dinero(o.utilidad)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{o.margenPct === null ? '—' : `${o.margenPct}%`}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{o.diasEnInventario ?? '—'}</td>
                <td className="px-3 py-2.5 text-xs">{o.fechaVenta || '—'}{!o.completa && !o.esConsignacion && <span className="ml-2 rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 font-bold">Completar</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
