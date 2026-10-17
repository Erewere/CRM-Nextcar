import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import clsx from 'clsx';
import { auth } from '../../lib/firebase';
import { getApiUrl } from '../../lib/api';

/**
 * Lo que se pagó por cada auto contra la guía de compra de Autocosmos. Los
 * números los arma el servidor (src/lib/analisisCompra.ts). Es un dato de
 * costos: solo lo ve quien ya puede ver costos en el inventario.
 */

type Grupo = { clave: string; autos: number; caras: number; pctCaras: number; diferenciaPromedioPct: number };
type Resumen = {
  comprasTotales: number; comparables: number; sinGuia: number; caras: number; buenas: number; enLinea: number;
  pctPorEncimaDeGuia: number; medianaDiferenciaPct: number; sobreprecioPromedioPct: number; sobreprecioTotal: number; ahorroTotal: number;
  porMes: Grupo[]; porMarca: Grupo[]; porComprador: Grupo[]; insights: string[];
};
type Compra = {
  vehicleId: string; titulo: string; estado: string; precioCompra: number; guiaCompra: number | null; confianzaGuia: string | null;
  clasificacion: 'buena' | 'en-linea' | 'cara' | 'sin-guia'; diferenciaPct: number | null; diferenciaMonto: number | null; motivo: string;
  mes: string; compradoPorNombre: string;
};

const dinero = (n: number | null | undefined) => (n || n === 0 ? '$' + Math.round(n).toLocaleString('es-MX') : '—');
const PILDORA = {
  cara: { t: 'Cara', c: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-900' },
  buena: { t: 'Buena compra', c: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900' },
  'en-linea': { t: 'En línea', c: 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600' },
  'sin-guia': { t: 'Sin guía', c: 'bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-700 dark:text-slate-400 dark:border-slate-600' },
} as const;

function Tabla({ titulo, filas }: { titulo: string; filas: Grupo[] }) {
  if (!filas.length) return null;
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <p className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 dark:border-slate-700">{titulo}</p>
      <table className="w-full text-sm">
        <tbody>
          {filas.map((f) => (
            <tr key={f.clave} className="border-t first:border-t-0 border-slate-100 dark:border-slate-700">
              <td className="px-4 py-2 font-medium text-slate-800 dark:text-slate-200">{f.clave}</td>
              <td className="px-3 py-2 text-right tabular-nums text-slate-500">{f.autos} {f.autos === 1 ? 'auto' : 'autos'}</td>
              <td className="px-3 py-2 text-right tabular-nums text-slate-500">{f.pctCaras}% caras</td>
              <td className={clsx('px-4 py-2 text-right tabular-nums font-semibold', f.diferenciaPromedioPct > 5 ? 'text-red-600' : f.diferenciaPromedioPct < -5 ? 'text-emerald-600' : 'text-slate-600')}>
                {f.diferenciaPromedioPct > 0 ? '+' : ''}{f.diferenciaPromedioPct}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CalidadDeCompras() {
  const navigate = useNavigate();
  const [d, setD] = useState<{ resumen: Resumen; autos: Compra[]; limites: string } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        const r = await fetch(getApiUrl('/api/precios/compras'), { headers: { Authorization: `Bearer ${token}` } });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || 'No se pudo leer.');
        setD(j);
      } catch (e: any) { setError(e.message); }
    })();
  }, []);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!d) return <p className="text-sm text-slate-500">Cargando…</p>;
  const r = d.resumen;

  const tarjeta = (titulo: string, valor: string, sub?: string, tono = '') => (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{titulo}</p>
      <p className={clsx('text-2xl font-extrabold tracking-tight mt-1', tono || 'text-slate-900 dark:text-white')}>{valor}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {tarjeta('Compradas arriba de la guía', `${r.pctPorEncimaDeGuia}%`, `${r.caras} de ${r.comparables} comparables · compra típica ${r.medianaDiferenciaPct > 0 ? '+' : ''}${r.medianaDiferenciaPct}%`, '')}
        {tarjeta('Sobreprecio promedio', r.caras ? `+${r.sobreprecioPromedioPct}%` : '—', r.caras ? `${dinero(r.sobreprecioTotal)} en total` : 'sin compras caras')}
        {tarjeta('Buenas compras', String(r.buenas), r.buenas ? `${dinero(r.ahorroTotal)} bajo la guía` : undefined, r.buenas ? 'text-emerald-600' : '')}
        {tarjeta('Sin guía confiable', String(r.sinGuia), `de ${r.comprasTotales} compras`)}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Conclusiones</p>
        <ul className="space-y-1.5 text-sm text-slate-700 dark:text-slate-300 list-disc pl-5">{r.insights.map((t, i) => <li key={i}>{t}</li>)}</ul>
        <p className="text-xs text-slate-500 mt-3">{d.limites}</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-3">
        <Tabla titulo="Por mes de compra" filas={r.porMes} />
        <Tabla titulo="Por marca" filas={r.porMarca} />
        <Tabla titulo="Por quién compró" filas={r.porComprador} />
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 dark:border-slate-700">
              <th className="px-4 py-3">Auto</th><th className="px-3 py-3 text-right">Pagaste</th><th className="px-3 py-3 text-right">Compra según guía</th>
              <th className="px-3 py-3 text-right">Diferencia</th><th className="px-3 py-3">Resultado</th><th className="px-3 py-3">Compró</th>
            </tr>
          </thead>
          <tbody>
            {d.autos.map((a) => {
              const p = PILDORA[a.clasificacion];
              return (
                <tr key={a.vehicleId} onClick={() => navigate(`/inventory/${a.vehicleId}`)} className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/40 cursor-pointer" title={a.motivo}>
                  <td className="px-4 py-2.5 font-semibold text-slate-900 dark:text-white">{a.titulo}{a.estado === 'vendido' && <span className="ml-2 text-xs font-normal text-slate-400">vendido</span>}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{dinero(a.precioCompra)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-300">{dinero(a.guiaCompra)}</td>
                  <td className={clsx('px-3 py-2.5 text-right tabular-nums font-semibold', a.diferenciaPct === null ? 'text-slate-400' : a.diferenciaPct > 5 ? 'text-red-600' : a.diferenciaPct <= -5 ? 'text-emerald-600' : 'text-slate-600')}>
                    {a.diferenciaPct === null ? '—' : `${a.diferenciaPct > 0 ? '+' : ''}${a.diferenciaPct}%`}
                  </td>
                  <td className="px-3 py-2.5"><span className={clsx('inline-flex rounded-full border px-2.5 py-1 text-xs font-bold', p.c)}>{p.t}</span></td>
                  <td className="px-3 py-2.5 text-slate-500">{a.compradoPorNombre || '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
