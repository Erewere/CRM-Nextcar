import React, { useState } from 'react';
import { Sparkles, Loader2, AlertTriangle } from 'lucide-react';
import { llamarPrecios } from '../../lib/preciosApi';

/**
 * Al dar de alta un auto: «¿en cuánto lo vendería y cuánto es lo máximo que
 * conviene haber pagado?». Mismo cálculo que la pestaña «Recomendar precios»
 * (src/lib/memoriaOperaciones.ts). No escribe nada en el formulario.
 */

type Reco = {
  precioVentaEsperado: number | null; precioVentaPesimista: number | null; maxCompraRecomendado: number | null; diasEstimados: number | null; confianza: 'alta' | 'media' | 'baja' | 'ninguna';
  comparables: number; insights: string[]; advertencias: string[];
};
const dinero = (n: number | null | undefined) => (n || n === 0 ? '$' + Math.round(n).toLocaleString('es-MX') : '—');
const CONF = { alta: 'confianza alta', media: 'confianza media', baja: 'confianza baja', ninguna: 'sin ventas parecidas' } as const;

export function RecomendacionAlta({ marca, modelo, anio, km, costo, onUsarVenta }: {
  marca: string; modelo: string; anio: number; km?: number; costo?: number; onUsarVenta?: (v: number) => void;
}) {
  const [cargando, setCargando] = useState(false);
  const [r, setR] = useState<Reco | null>(null);
  const [error, setError] = useState('');
  const [oculto, setOculto] = useState(false);
  const listo = marca.trim() && modelo.trim() && anio >= 1980;
  if (oculto) return null;

  const consultar = async () => {
    setCargando(true); setError(''); setR(null);
    try {
      const palabras = modelo.trim().split(/\s+/);
      setR(await llamarPrecios('/api/precios/recomendar', 'POST', {
        marca: marca.trim(), modelo: modelo.trim(), version: palabras.slice(1).join(' '), anio, km: km || null, precioOfrecido: costo || null,
      }));
    } catch (e: any) {
      if (e.status === 403) setOculto(true); else setError(e.message);
    } finally { setCargando(false); }
  };

  const pasado = r && costo && r.maxCompraRecomendado && costo > r.maxCompraRecomendado ? costo - r.maxCompraRecomendado : 0;

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={consultar} disabled={!listo || cargando} className="h-9 px-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-semibold flex items-center gap-2 disabled:opacity-50">
          {cargando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} {cargando ? 'Buscando…' : 'Recomendación de compra y venta'}
        </button>
        {!listo && <span className="text-xs text-slate-500">Llena marca, modelo y año.</span>}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {r && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center">
            <div className="rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Se vendería en</p>
              <p className="text-base font-extrabold tabular-nums">{dinero(r.precioVentaEsperado)}</p>
              {onUsarVenta && r.precioVentaEsperado ? <button type="button" onClick={() => onUsarVenta(r.precioVentaEsperado!)} className="text-[11px] font-bold text-slate-600 hover:underline">Usar como precio</button> : null}
            </div>
            <div className="rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Peor caso</p>
              <p className="text-base font-extrabold tabular-nums">{dinero(r.precioVentaPesimista)}</p>
            </div>
            <div className="rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Pagar máximo</p>
              <p className="text-base font-extrabold tabular-nums">{dinero(r.maxCompraRecomendado)}</p>
            </div>
            <div className="rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Se vendería en</p>
              <p className="text-base font-extrabold tabular-nums">{r.diasEstimados === null ? '—' : `${r.diasEstimados} días`}</p>
            </div>
          </div>
          <p className="text-xs text-slate-500">{CONF[r.confianza]}{r.comparables ? ` · ${r.comparables} ${r.comparables === 1 ? 'venta parecida' : 'ventas parecidas'}` : ''}</p>
          {pasado > 0 && (
            <p className="text-sm rounded-md bg-red-50 border border-red-200 text-red-800 px-3 py-2 flex items-start gap-2"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> El costo de compra que capturaste pasa del máximo recomendado por {dinero(pasado)}.</p>
          )}
          {r.advertencias.length > 0 && <ul className="text-xs text-amber-800 dark:text-amber-300 list-disc pl-5 space-y-0.5">{r.advertencias.map((t, i) => <li key={i}>{t}</li>)}</ul>}
        </>
      )}
    </div>
  );
}
