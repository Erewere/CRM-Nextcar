import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { TrendingDown, TrendingUp, Clock, AlertTriangle, X, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import { llamarPrecios } from '../../lib/preciosApi';

/**
 * «Salud del inventario» en el tablero: qué autos están caros contra el mercado,
 * cuáles llevan mucho parados y dónde hay oportunidad de subir. Lee el análisis
 * que el servidor calcula cada día (src/lib/analisisPrecio.ts) y permite aplicar
 * el precio sugerido, SIEMPRE con confirmación: nada cambia solo.
 */

type Auto = {
  vehicleId: string; titulo: string; precioLista: number; medianaMercado: number | null; comparables: number; diasEnInventario: number | null;
  sugerencia: 'bajar' | 'subir' | 'mantener' | 'revisar' | 'sin-datos'; precioSugerido: number; razon: string; confianza: string;
  diferenciaVsMedianaPct: number | null; analizadoEn: string;
};
type Vista = 'bajar' | 'parados' | 'subir' | 'revisar';

const DIAS_MUY_PARADO = 90;
const dinero = (n: number | null | undefined) => (n || n === 0 ? '$' + Math.round(n).toLocaleString('es-MX') : '—');

export function SaludDelInventario() {
  const navigate = useNavigate();
  const [autos, setAutos] = useState<Auto[] | null>(null);
  const [ultima, setUltima] = useState<string | null>(null);
  const [oculto, setOculto] = useState(false);
  const [vista, setVista] = useState<Vista>('bajar');
  const [confirmar, setConfirmar] = useState<Auto | null>(null);
  const [aplicando, setAplicando] = useState(false);
  const [error, setError] = useState('');

  const cargar = () => llamarPrecios('/api/precios/analisis')
    .then((d) => { setAutos(d.autos || []); setUltima(d.ultimaRevision || null); })
    .catch((e) => { if (e.status === 403 || e.status === 401) setOculto(true); else setError(e.message); });
  useEffect(() => { cargar(); }, []);

  const grupos = useMemo(() => {
    const l = autos || [];
    return {
      bajar: l.filter((a) => a.sugerencia === 'bajar'),
      parados: l.filter((a) => (a.diasEnInventario ?? 0) >= DIAS_MUY_PARADO).sort((a, b) => (b.diasEnInventario || 0) - (a.diasEnInventario || 0)),
      subir: l.filter((a) => a.sugerencia === 'subir'),
      revisar: l.filter((a) => a.sugerencia === 'revisar'),
    } as Record<Vista, Auto[]>;
  }, [autos]);

  if (oculto) return null;
  if (!autos) return error ? <p className="text-sm text-red-600">{error}</p> : null;

  const tarjetas: { id: Vista; titulo: string; Icono: React.ComponentType<{ className?: string }>; tono: string; ayuda: string }[] = [
    { id: 'bajar', titulo: 'Sobrevaluados', Icono: TrendingDown, tono: 'text-red-600', ayuda: 'caros contra el mercado' },
    { id: 'parados', titulo: 'Muchos días parados', Icono: Clock, tono: 'text-amber-600', ayuda: `${DIAS_MUY_PARADO} días o más` },
    { id: 'subir', titulo: 'Oportunidad de subir', Icono: TrendingUp, tono: 'text-emerald-600', ayuda: 'baratos y se mueven rápido' },
    { id: 'revisar', titulo: 'Por revisar', Icono: AlertTriangle, tono: 'text-slate-600', ayuda: 'muy lejos del mercado' },
  ];
  const lista = grupos[vista].slice(0, 8);

  const aplicar = async () => {
    if (!confirmar) return;
    setAplicando(true); setError('');
    try {
      await llamarPrecios('/api/precios/aplicar', 'POST', { vehicleId: confirmar.vehicleId, precio: confirmar.precioSugerido });
      setConfirmar(null);
      await cargar();
    } catch (e: any) { setError(e.message); } finally { setAplicando(false); }
  };

  const hace = ultima ? Math.round((Date.now() - Date.parse(ultima)) / 3_600_000) : null;

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
      <div className="px-4 py-3 flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-700">
        <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">Salud del inventario</h2>
        <span className="text-xs text-slate-500">{hace === null ? 'sin revisión todavía' : hace < 1 ? 'revisado hace menos de una hora' : hace < 24 ? `revisado hace ${hace} h` : `revisado hace ${Math.round(hace / 24)} días`}</span>
        <Link to="/precios" className="ml-auto text-xs font-bold text-slate-700 dark:text-slate-300 hover:underline">Ver análisis completo →</Link>
      </div>

      <div className="p-3 grid grid-cols-2 lg:grid-cols-4 gap-2">
        {tarjetas.map(({ id, titulo, Icono, tono, ayuda }) => (
          <button
            key={id} onClick={() => setVista(id)}
            className={clsx('text-left rounded-lg border p-3 transition', vista === id ? 'border-slate-900 dark:border-white bg-slate-50 dark:bg-slate-700/50' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30')}
          >
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5"><Icono className={clsx('w-3.5 h-3.5', tono)} />{titulo}</p>
            <p className={clsx('text-2xl font-extrabold tracking-tight mt-1', grupos[id].length ? tono : 'text-slate-400')}>{grupos[id].length}</p>
            <p className="text-xs text-slate-500">{ayuda}</p>
          </button>
        ))}
      </div>

      {error && <p className="px-4 pb-2 text-sm text-red-600">{error}</p>}

      <div className="px-3 pb-3">
        {!lista.length ? (
          <p className="text-sm text-slate-500 px-1 py-4">{vista === 'bajar' ? 'Ningún auto está caro contra el mercado.' : vista === 'parados' ? 'Ningún auto lleva tanto tiempo parado.' : vista === 'subir' ? 'No hay autos con oportunidad de subir.' : 'Nada por revisar.'}</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-700">
            {lista.map((a) => {
              const puedeAplicar = a.sugerencia === 'bajar' || a.sugerencia === 'subir';
              return (
                <li key={a.vehicleId} className="py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1">
                  <button onClick={() => navigate(`/inventory/${a.vehicleId}`)} className="min-w-0 flex-1 basis-56 text-left">
                    <p className="font-semibold text-sm text-slate-900 dark:text-white truncate">{a.titulo}</p>
                    <p className="text-xs text-slate-500 line-clamp-2">{a.razon}</p>
                  </button>
                  <div className="text-xs text-slate-500 tabular-nums w-16 text-right">{a.diasEnInventario ?? '—'} días</div>
                  <div className="text-sm tabular-nums text-right w-44">
                    {puedeAplicar ? <><span className="text-slate-500">{dinero(a.precioLista)}</span> → <b>{dinero(a.precioSugerido)}</b></> : <b>{dinero(a.precioLista)}</b>}
                  </div>
                  {puedeAplicar ? (
                    <button onClick={() => setConfirmar(a)} className="h-8 px-3 rounded-lg bg-slate-900 dark:bg-white dark:text-slate-900 text-white text-xs font-bold">Aplicar precio</button>
                  ) : <span className="w-[104px]" />}
                </li>
              );
            })}
          </ul>
        )}
        {grupos[vista].length > lista.length && <Link to="/precios" className="block text-xs font-bold text-slate-600 hover:underline px-1 pt-2">Y {grupos[vista].length - lista.length} más en el análisis completo →</Link>}
        <p className="text-[11px] text-slate-400 px-1 pt-2">Se compara con anuncios del mercado por marca, modelo y año (sin versión ni kilometraje). Si el precio sugerido no te convence, ábrelo y decide tú.</p>
      </div>

      {confirmar && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !aplicando && setConfirmar(null)}>
          <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-xl shadow-xl p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">¿Cambiar el precio?</h3>
              <button onClick={() => setConfirmar(null)} disabled={aplicando} aria-label="Cerrar" className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-slate-700 dark:text-slate-300 mt-2"><b>{confirmar.titulo}</b></p>
            <p className="text-2xl font-extrabold mt-2 tabular-nums">{dinero(confirmar.precioLista)} <span className="text-slate-400">→</span> {dinero(confirmar.precioSugerido)}</p>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">{confirmar.razon}</p>
            <p className="text-xs text-slate-500 mt-3">El precio se actualiza en el inventario y, si el auto está publicado, también en tu página. Queda registrado quién lo cambió.</p>
            {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setConfirmar(null)} disabled={aplicando} className="h-9 px-4 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-semibold">Cancelar</button>
              <button onClick={aplicar} disabled={aplicando} className="h-9 px-4 rounded-lg bg-[#D6402A] hover:bg-[#A82A17] text-white text-sm font-bold flex items-center gap-2 disabled:opacity-60">
                {aplicando && <Loader2 className="w-4 h-4 animate-spin" />} Sí, cambiar precio
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
