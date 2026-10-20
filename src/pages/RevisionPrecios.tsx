import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useVolver } from '../hooks/useVolver';
import { ArrowLeft, RefreshCw, Search, TrendingDown, TrendingUp, Equal, HelpCircle, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';
import { auth } from '../lib/firebase';
import { getApiUrl } from '../lib/api';
import { CalidadDeCompras } from '../components/precios/CalidadDeCompras';
import { Recomendador } from '../components/precios/Recomendador';
import { MemoriaDeVentas } from '../components/precios/MemoriaDeVentas';

/**
 * Revisión de precios de venta: cada auto contra el mercado. Los datos los
 * calcula el servidor una vez al día (src/lib/analisisPrecio.ts); aquí solo se
 * leen. Todavía no cambia precios: es para analizar.
 */

type Sugerencia = 'bajar' | 'subir' | 'mantener' | 'revisar' | 'sin-datos';
type Analisis = {
  vehicleId: string; titulo: string; precioLista: number; medianaMercado: number | null;
  rangoMercado: { minimo: number; maximo: number; p33: number; p66: number; p90: number } | null;
  comparables: number; diasEnInventario: number | null; analizadoEn: string; mercadoDe: string | null;
  sugerencia: Sugerencia; precioSugerido: number; razon: string; confianza: string; diferenciaVsMedianaPct: number | null;
};

const dinero = (n: number | null | undefined) => (n || n === 0 ? '$' + Math.round(n).toLocaleString('es-MX') : '—');

const PILDORAS: Record<Sugerencia, { texto: string; clase: string; Icono: React.ComponentType<{ className?: string }> }> = {
  bajar: { texto: 'Bajar', clase: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-900', Icono: TrendingDown },
  subir: { texto: 'Subir', clase: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900', Icono: TrendingUp },
  mantener: { texto: 'Mantener', clase: 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600', Icono: Equal },
  revisar: { texto: 'Revisar', clase: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900', Icono: AlertTriangle },
  'sin-datos': { texto: 'Sin datos', clase: 'bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-700 dark:text-slate-400 dark:border-slate-600', Icono: HelpCircle },
};
const ORDEN: Sugerencia[] = ['bajar', 'revisar', 'subir', 'mantener', 'sin-datos'];

async function pedir(ruta: string, metodo = 'GET') {
  const token = await auth.currentUser?.getIdToken();
  const r = await fetch(getApiUrl(ruta), { method: metodo, headers: { Authorization: `Bearer ${token}` } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'No se pudo completar.');
  return d;
}

const hace = (iso: string | null) => {
  if (!iso) return 'nunca';
  const h = Math.round((Date.now() - Date.parse(iso)) / 3_600_000);
  if (h < 1) return 'hace menos de una hora';
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} días`;
};

export function RevisionPrecios() {
  const navigate = useNavigate();
  const volver = useVolver('/inventory');
  const [autos, setAutos] = useState<Analisis[] | null>(null);
  const [ultima, setUltima] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [filtro, setFiltro] = useState<Sugerencia | 'todos'>('todos');
  const [busca, setBusca] = useState('');
  const [revisando, setRevisando] = useState(false);
  const [vista, setVista] = useState<'venta' | 'compras' | 'recomendar' | 'memoria'>('venta');

  const cargar = () => pedir('/api/precios/analisis').then((d) => { setAutos(d.autos || []); setUltima(d.ultimaRevision || null); setError(''); }).catch((e) => setError(e.message));
  useEffect(() => { cargar(); }, []);

  const cuenta = useMemo(() => {
    const c: Record<string, number> = { todos: autos?.length || 0 };
    (autos || []).forEach((a) => { c[a.sugerencia] = (c[a.sugerencia] || 0) + 1; });
    return c;
  }, [autos]);

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (autos || []).filter((a) => (filtro === 'todos' || a.sugerencia === filtro) && (!q || a.titulo.toLowerCase().includes(q)));
  }, [autos, filtro, busca]);

  const revisarAhora = async () => {
    setRevisando(true); setError('');
    try { await pedir('/api/precios/revisar', 'POST'); await cargar(); } catch (e: any) { setError(e.message); } finally { setRevisando(false); }
  };

  return (
    <div className="flex flex-col h-full bg-[#f4f5f5] dark:bg-slate-900 overflow-y-auto">
      <div className="p-4 md:p-6 max-w-7xl mx-auto w-full space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={volver} className="h-9 w-9 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 flex items-center justify-center hover:bg-slate-50" aria-label="Volver al inventario">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">Revisión de precios</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Cada auto contra autos parecidos en Mercado Libre. Última revisión: {hace(ultima)}.</p>
          </div>
          <button onClick={revisarAhora} disabled={revisando} className="ml-auto h-9 px-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-semibold flex items-center gap-2 hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw className={clsx('w-4 h-4', revisando && 'animate-spin')} /> {revisando ? 'Revisando…' : 'Revisar ahora'}
          </button>
        </div>

        <div className="inline-flex flex-wrap h-auto min-h-9 p-0.5 bg-slate-100 dark:bg-slate-700 rounded-lg">
          {([['venta', 'Precios de venta'], ['compras', 'Calidad de compras'], ['recomendar', 'Recomendar precios'], ['memoria', 'Ventas pasadas']] as const).map(([k, t]) => (
            <button key={k} onClick={() => setVista(k)} className={clsx('px-3 h-8 rounded-md text-sm font-semibold transition', vista === k ? 'bg-white dark:bg-slate-900 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500')}>{t}</button>
          ))}
        </div>

        {vista === 'compras' && <CalidadDeCompras />}
        {vista === 'recomendar' && <Recomendador />}
        {vista === 'memoria' && <MemoriaDeVentas />}

        {vista === 'venta' && <p className="text-xs text-slate-500 dark:text-slate-400 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2">
          El mercado se busca por <b>marca, modelo y año</b>, sin versión ni kilometraje: un auto muy equipado puede verse «caro» sin serlo. Cuando la diferencia pasa de 30 % sale como <b>Revisar</b> y no se propone precio. Esta pantalla solo muestra; no cambia ningún precio.
        </p>}

        {error && vista === 'venta' && <p className="text-sm text-red-600">{error}</p>}

        {vista === 'venta' && autos && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {(['todos', ...ORDEN] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setFiltro(k)}
                  className={clsx('h-9 px-3 rounded-full text-sm font-semibold border transition', filtro === k ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white' : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50')}
                >
                  {k === 'todos' ? 'Todos' : PILDORAS[k].texto} <span className="opacity-60">{cuenta[k] || 0}</span>
                </button>
              ))}
              <div className="relative ml-auto">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar auto" className="h-9 pl-9 pr-3 w-48 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm" />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto">
              <table className="w-full text-sm min-w-[860px]">
                <thead>
                  <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 dark:border-slate-700">
                    <th className="px-4 py-3">Auto</th>
                    <th className="px-3 py-3 text-right">Tu precio</th>
                    <th className="px-3 py-3 text-right">Mediana mercado</th>
                    <th className="px-3 py-3 text-right">Diferencia</th>
                    <th className="px-3 py-3 text-right">Días</th>
                    <th className="px-3 py-3 text-right">Comparables</th>
                    <th className="px-3 py-3">Sugerencia</th>
                    <th className="px-3 py-3 text-right">Precio sugerido</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((a) => {
                    const p = PILDORAS[a.sugerencia] || PILDORAS['sin-datos'];
                    const dif = a.diferenciaVsMedianaPct;
                    return (
                      <React.Fragment key={a.vehicleId}>
                        <tr onClick={() => navigate(`/inventory/${a.vehicleId}`)} className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/40 cursor-pointer">
                          <td className="px-4 py-2.5 font-semibold text-slate-900 dark:text-white">{a.titulo}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{dinero(a.precioLista)}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-300">{dinero(a.medianaMercado)}</td>
                          <td className={clsx('px-3 py-2.5 text-right tabular-nums font-semibold', dif === null ? 'text-slate-400' : dif > 10 ? 'text-red-600' : dif < -5 ? 'text-emerald-600' : 'text-slate-600')}>
                            {dif === null ? '—' : `${dif > 0 ? '+' : ''}${dif}%`}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{a.diasEnInventario ?? '—'}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{a.comparables} <span className="text-xs text-slate-400">{a.confianza !== 'ninguna' ? a.confianza : ''}</span></td>
                          <td className="px-3 py-2.5"><span className={clsx('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold', p.clase)}><p.Icono className="w-3.5 h-3.5" />{p.texto}</span></td>
                          <td className="px-3 py-2.5 text-right tabular-nums font-semibold">{a.sugerencia === 'bajar' || a.sugerencia === 'subir' ? dinero(a.precioSugerido) : '—'}</td>
                        </tr>
                        <tr onClick={() => navigate(`/inventory/${a.vehicleId}`)} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/40">
                          <td colSpan={8} className="px-4 pb-3 pt-0 text-xs text-slate-500 dark:text-slate-400">{a.razon}</td>
                        </tr>
                      </React.Fragment>
                    );
                  })}
                  {!lista.length && <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-500">No hay autos en este filtro.</td></tr>}
                </tbody>
              </table>
            </div>
          </>
        )}
        {vista === 'venta' && !autos && !error && <p className="text-sm text-slate-500">Cargando…</p>}
      </div>
    </div>
  );
}
