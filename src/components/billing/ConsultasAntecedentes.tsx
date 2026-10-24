import { useCallback, useEffect, useState } from 'react';
import { Radar, Loader2 } from 'lucide-react';
import { auth } from '../../lib/firebase';
import { getApiUrl } from '../../lib/api';

/**
 * Saldo y compra de consultas de antecedentes del auto (PlacasInfo): REPUVE, fiscalías, avisos, robo.
 * Se compran paquetes (pago único con Stripe) y cada consulta descuenta una. Ver src/servidor/placasInfo.ts.
 */
async function pedir(ruta: string, cuerpo?: unknown) {
  const token = await auth.currentUser?.getIdToken();
  const r = await fetch(getApiUrl(ruta), {
    method: cuerpo ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${token}`, ...(cuerpo ? { 'Content-Type': 'application/json' } : {}) },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'No se pudo completar.');
  return d;
}

const dinero = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 }).format(n);
const TIPO: Record<string, string> = { compra: 'Compra', consulta: 'Consulta', regalo: 'Regalo', devolucion: 'Devuelta' };

export function ConsultasAntecedentes({ volvioDePagar }: { volvioDePagar: boolean }) {
  const [d, setD] = useState<any>(null);
  const [error, setError] = useState('');
  const [comprando, setComprando] = useState<number | null>(null);

  const cargar = useCallback(() => pedir('/api/placasinfo/saldo').then(setD).catch((e) => setError(e.message)), []);
  useEffect(() => { cargar(); }, [cargar]);
  // Al volver de pagar, el aviso de Stripe tarda unos segundos en sumar el saldo: se vuelve a leer un par de veces.
  useEffect(() => {
    if (!volvioDePagar) return;
    const t = [3000, 8000, 15000].map((ms) => setTimeout(cargar, ms));
    return () => t.forEach(clearTimeout);
  }, [volvioDePagar, cargar]);

  const comprar = async (indice: number) => {
    setComprando(indice); setError('');
    try {
      const r = await pedir('/api/placasinfo/comprar', { indice });
      if (r.url) window.location.href = r.url;
    } catch (e: any) { setError(e.message); setComprando(null); }
  };

  if (!d && !error) return null;
  if (error && !d) return null; // sin permiso (no es administrador) o apagado: no se muestra
  if (!d.activo) return null;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6 shadow-sm">
      <div className="flex items-start gap-3 mb-3">
        <span className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0"><Radar className="w-5 h-5" /></span>
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">Consultas de antecedentes del auto</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Revisa por VIN o placas si un auto tiene reporte de robo, antecedentes o avisos (REPUVE, fiscalías, aseguradoras y más) y deja la constancia en su ficha.</p>
        </div>
      </div>

      {d.propia ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-300 font-semibold">Tu agencia tiene consultas incluidas, sin límite.</p>
      ) : (
        <>
          <p className="text-3xl font-extrabold text-slate-900 dark:text-white">{d.saldo} <span className="text-sm font-medium text-slate-500">{d.saldo === 1 ? 'consulta disponible' : 'consultas disponibles'}</span></p>
          {d.regaloPendiente && <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">Incluye {d.saldo} de bienvenida para que lo pruebes.</p>}
          {volvioDePagar && <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-2">Con tarjeta, el saldo se actualiza en unos segundos. Si elegiste OXXO, se acredita al día hábil siguiente de pagar la ficha en la tienda.</p>}

          <div className="grid sm:grid-cols-3 gap-3 mt-4">
            {d.paquetes.map((p: any, i: number) => (
              <button key={p.consultas} onClick={() => comprar(i)} disabled={comprando !== null} className="text-left rounded-xl border border-slate-200 dark:border-slate-600 p-4 hover:border-blue-400 hover:bg-blue-50/40 dark:hover:bg-blue-950/20 disabled:opacity-60 transition-colors">
                <p className="text-lg font-extrabold text-slate-900 dark:text-white">{p.consultas} consultas</p>
                <p className="text-sm text-slate-600 dark:text-slate-300">{dinero(p.precio)} <span className="text-slate-400">· {dinero(p.precio / p.consultas)} c/u</span></p>
                <span className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 dark:text-blue-300">{comprando === i ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Abriendo el pago…</> : 'Comprar'}</span>
              </button>
            ))}
          </div>
          <p className="text-[11px] text-slate-500 mt-2">Pago único con tarjeta o en efectivo en OXXO (con OXXO se acredita al día hábil siguiente de pagar). Las consultas no caducan. Si una consulta no se puede completar, se te devuelve.</p>

          {d.movimientos?.length > 0 && (
            <details className="mt-4 text-sm">
              <summary className="cursor-pointer font-semibold text-slate-700 dark:text-slate-300">Movimientos recientes</summary>
              <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-700">
                {d.movimientos.map((m: any, i: number) => (
                  <li key={i} className="py-1.5 flex justify-between gap-3 text-slate-600 dark:text-slate-300">
                    <span>{TIPO[m.tipo] || m.tipo}{m.porNombre ? ` · ${m.porNombre}` : ''}{m.nota ? ` · ${m.nota}` : ''} <span className="text-slate-400">· {new Date(m.fecha).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}</span></span>
                    <b className={m.cantidad > 0 ? 'text-emerald-700 dark:text-emerald-400' : ''}>{m.cantidad > 0 ? '+' : ''}{m.cantidad}</b>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  );
}
