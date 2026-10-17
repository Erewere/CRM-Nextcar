import React, { useEffect, useState } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';
import { auth } from '../../lib/firebase';
import { getApiUrl } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';

/**
 * «¿Cuánto vendería y cuánto pagaría como máximo?» Busca en las ventas pasadas
 * de la agencia los autos más parecidos (src/lib/memoriaOperaciones.ts) y se
 * apoya en el mercado y la guía cuando hay pocos. Es costos: solo para quien los ve.
 */

type Comp = { vehicleId: string; titulo: string; anio: number; km: number | null; precioCompra: number | null; gastos: number; precioVenta: number | null; utilidad: number | null; diasEnInventario: number | null };
type Resultado = {
  precioVentaEsperado: number | null; precioVentaPesimista: number | null; origenPrecioVenta: string; maxCompraPorPesimista: number | null; maxCompraPorGuia: number | null; maxCompraRecomendado: number | null;
  utilidadEsperada: number | null; utilidadPesimista: number | null; margenEsperadoPct: number | null; margenPesimistaPct: number | null;
  gastosEstimados: number; diasEstimados: number | null; diasRango: [number, number] | null; comercial: string | null; margenObjetivoPct: number;
  confianza: 'alta' | 'media' | 'baja' | 'ninguna'; comparables: number; advertencias: string[]; insights: string[]; comparablesUsados: Comp[];
  mercado: { n: number; mediana: number } | null; guia: { compra: number; venta: number; confianza: string } | null; fechaAnalisis: string;
};

const dinero = (n: number | null | undefined) => (n || n === 0 ? '$' + Math.round(n).toLocaleString('es-MX') : '—');
const CONF = {
  alta: { t: 'Confianza alta', c: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  media: { t: 'Confianza media', c: 'bg-sky-50 text-sky-700 border-sky-200' },
  baja: { t: 'Confianza baja', c: 'bg-amber-50 text-amber-700 border-amber-200' },
  ninguna: { t: 'Sin ventas parecidas', c: 'bg-slate-50 text-slate-600 border-slate-200' },
} as const;

async function llamar(ruta: string, metodo = 'GET', cuerpo?: unknown) {
  const token = await auth.currentUser?.getIdToken();
  const r = await fetch(getApiUrl(ruta), { method: metodo, headers: { Authorization: `Bearer ${token}`, ...(cuerpo ? { 'Content-Type': 'application/json' } : {}) }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'No se pudo completar.');
  return d;
}

const campo = 'h-10 w-full px-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm';

export function Recomendador() {
  const { userData } = useAuth();
  const [f, setF] = useState({ marca: '', modelo: '', version: '', anio: '', km: '', precioOfrecido: '', guiaCompra: '', guiaVenta: '' });
  const [margen, setMargen] = useState('');
  const [guardado, setGuardado] = useState(false);
  const [r, setR] = useState<Resultado | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { llamar('/api/precios/config').then((d) => setMargen(String(d.margenObjetivoPct))).catch(() => {}); }, []);
  const poner = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((x) => ({ ...x, [k]: e.target.value }));

  const consultar = async (e: React.FormEvent) => {
    e.preventDefault();
    setCargando(true); setError(''); setR(null);
    try {
      setR(await llamar('/api/precios/recomendar', 'POST', {
        marca: f.marca, modelo: f.modelo, version: f.version, anio: Number(f.anio), km: f.km === '' ? null : Number(f.km.replace(/,/g, '')),
        precioOfrecido: f.precioOfrecido ? Number(f.precioOfrecido.replace(/[$,]/g, '')) : null,
        guiaCompra: f.guiaCompra ? Number(f.guiaCompra.replace(/[$,]/g, '')) : null,
        guiaVenta: f.guiaVenta ? Number(f.guiaVenta.replace(/[$,]/g, '')) : null,
      }));
    } catch (er: any) { setError(er.message); } finally { setCargando(false); }
  };

  const guardarMargen = async () => {
    try { await llamar('/api/precios/config', 'PUT', { margenObjetivoPct: Number(margen) }); setGuardado(true); setTimeout(() => setGuardado(false), 2000); } catch (er: any) { setError(er.message); }
  };

  const grande = (titulo: string, valor: string, sub?: string) => (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{titulo}</p>
      <p className="text-2xl font-extrabold tracking-tight mt-1 text-slate-900 dark:text-white">{valor}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );

  return (
    <div className="space-y-4">
      <form onSubmit={consultar} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Marca<input required value={f.marca} onChange={poner('marca')} placeholder="Nissan" className={campo} /></label>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Modelo<input required value={f.modelo} onChange={poner('modelo')} placeholder="Sentra" className={campo} /></label>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Versión (opcional)<input value={f.version} onChange={poner('version')} placeholder="Advance" className={campo} /></label>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Año<input required inputMode="numeric" value={f.anio} onChange={poner('anio')} placeholder="2020" className={campo} /></label>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Kilometraje<input inputMode="numeric" value={f.km} onChange={poner('km')} placeholder="68,000" className={campo} /></label>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Piden (opcional)<input inputMode="numeric" value={f.precioOfrecido} onChange={poner('precioOfrecido')} placeholder="$215,000" className={campo} /></label>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 md:col-span-2">Libro Azul: compra (opcional)<input inputMode="numeric" value={f.guiaCompra} onChange={poner('guiaCompra')} placeholder="$181,000" className={campo} /></label>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 md:col-span-2">Libro Azul: venta (opcional)<input inputMode="numeric" value={f.guiaVenta} onChange={poner('guiaVenta')} placeholder="$207,000" className={campo} /></label>
          <p className="text-xs text-slate-500 md:col-span-2 self-end">Si los escribes, mandan sobre la guía automática. Con uno solo se calcula el otro.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button disabled={cargando} className="h-10 px-4 rounded-lg bg-slate-900 dark:bg-white dark:text-slate-900 text-white text-sm font-bold disabled:opacity-50 flex items-center gap-2">
            {cargando && <Loader2 className="w-4 h-4 animate-spin" />} {cargando ? 'Buscando… (puede tardar 15 segundos)' : 'Recomendar precios'}
          </button>
          <div className="ml-auto flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            Margen de referencia
            <input value={margen} onChange={(e) => { setMargen(e.target.value); setGuardado(false); }} disabled={userData?.role !== 'admin'} inputMode="decimal" className="h-9 w-16 px-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-center" /> %
            {userData?.role === 'admin' && <button type="button" onClick={guardarMargen} className="h-9 px-3 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-semibold hover:bg-slate-50">{guardado ? 'Guardado' : 'Guardar'}</button>}
          </div>
        </div>
        <p className="text-xs text-slate-500">El precio lo manda el mercado (esperado = mediana; peor caso = cerca del mínimo). El margen de referencia solo avisa si comprar al máximo deja menos ganancia que ese porcentaje.</p>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {r && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className={clsx('inline-flex rounded-full border px-2.5 py-1 text-xs font-bold', CONF[r.confianza].c)}>{CONF[r.confianza].t} · {r.comparables} {r.comparables === 1 ? 'venta parecida' : 'ventas parecidas'}</span>
            {r.mercado && <span className="text-xs text-slate-500">Mercado: {r.mercado.n} anuncios, mediana {dinero(r.mercado.mediana)}</span>}
            {r.guia && <span className="text-xs text-slate-500">· Guía: compra {dinero(r.guia.compra)} / venta {dinero(r.guia.venta)}</span>}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {grande('Se vendería en (esperado)', dinero(r.precioVentaEsperado), r.origenPrecioVenta === 'mercado' ? 'mediana del precio comercial' : r.origenPrecioVenta === 'ventas-propias' ? 'mediana de tus ventas' : r.origenPrecioVenta === 'guia' ? 'guía de venta' : '')}
            {grande('Peor caso', dinero(r.precioVentaPesimista), 'si no es muy comercial')}
            {grande('Pagar como máximo', dinero(r.maxCompraRecomendado), r.maxCompraPorGuia !== null ? 'tope de la guía' : 'sin guía: sale del peor caso')}
            {grande('Se vendería en', r.diasEstimados === null ? '—' : `${r.diasEstimados} días`, r.diasRango ? `normalmente entre ${r.diasRango[0]} y ${r.diasRango[1]}` : undefined)}
          </div>
          {r.utilidadEsperada !== null && r.utilidadPesimista !== null && (
            <p className="text-sm text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3">
              Comprando al máximo: <b>{dinero(r.utilidadEsperada)}</b> de ganancia ({r.margenEsperadoPct}%) si se vende al esperado, y <b className={r.utilidadPesimista < 0 ? 'text-red-600' : ''}>{r.utilidadPesimista < 0 ? `pérdida de ${dinero(-r.utilidadPesimista)}` : dinero(r.utilidadPesimista)}</b> ({r.margenPesimistaPct}%) en el peor caso. <span className="text-slate-400">Es informativo: el precio lo manda el mercado.</span>
            </p>
          )}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Conclusiones</p>
            <ul className="space-y-1.5 text-sm text-slate-700 dark:text-slate-300 list-disc pl-5">{r.insights.map((t, i) => <li key={i}>{t}</li>)}</ul>
          </div>
          {r.advertencias.length > 0 && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-4 text-sm text-amber-900 dark:text-amber-200">
              <p className="font-bold flex items-center gap-2 mb-1"><AlertTriangle className="w-4 h-4" /> Ten en cuenta</p>
              <ul className="list-disc pl-5 space-y-1">{r.advertencias.map((t, i) => <li key={i}>{t}</li>)}</ul>
            </div>
          )}
          {r.comparablesUsados.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto">
              <p className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 dark:border-slate-700">Ventas parecidas que se usaron</p>
              <table className="w-full text-sm min-w-[640px]">
                <tbody>
                  {r.comparablesUsados.map((c) => (
                    <tr key={c.vehicleId} className="border-t first:border-t-0 border-slate-100 dark:border-slate-700">
                      <td className="px-4 py-2 font-medium">{c.titulo}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-500">{c.km ? `${c.km.toLocaleString('es-MX')} km` : '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums">compra {dinero(c.precioCompra)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">venta {dinero(c.precioVenta)}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold text-emerald-700">{dinero(c.utilidad)}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-slate-500">{c.diasEnInventario ?? '—'} días</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
