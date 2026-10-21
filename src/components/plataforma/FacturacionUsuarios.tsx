import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { auth } from '../../lib/firebase';
import { getApiUrl } from '../../lib/api';

/**
 * Interruptor del cobro por usuario en Stripe y reporte de la última revisión (solo master).
 * Apagado: se calcula y se anota la diferencia, pero Stripe no se toca. Encendido: la cantidad de la suscripción
 * sigue a los usuarios de cada agencia (ver src/servidor/usuariosFacturados.ts).
 */
async function llamar(cuerpo?: unknown) {
  const token = await auth.currentUser?.getIdToken();
  const r = await fetch(getApiUrl('/api/admin/facturacion-usuarios'), {
    method: cuerpo ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${token}`, ...(cuerpo ? { 'Content-Type': 'application/json' } : {}) },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'No se pudo completar.');
  return d;
}

const TEXTO: Record<string, string> = {
  'al-dia': 'Al día', diferencia: 'Hay diferencia', ajustada: 'Ajustada', revisar: 'Revisar', error: 'Error',
  'suscripcion-no-vigente': 'Sin suscripción vigente',
};

export function FacturacionUsuarios() {
  const [d, setD] = useState<any>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { llamar().then(setD).catch((e) => setError(e.message)); }, []);

  const accion = async (cuerpo: unknown) => {
    setOcupado(true); setError('');
    try { setD(await llamar(cuerpo)); } catch (e: any) { setError(e.message); } finally { setOcupado(false); }
  };
  const alternar = () => {
    const encender = !d?.sincronizar;
    if (encender && !window.confirm('Al encender, cada vez que una agencia que paga por Stripe agregue o quite usuarios, su suscripción se ajusta sola (Stripe prorratea el mes). ¿Encender?')) return;
    accion({ sincronizar: encender });
  };
  const resultados: any[] = d?.ultima?.resultados || [];
  const importantes = resultados.filter((r) => r.estado !== 'al-dia');

  return (
    <section>
      <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">Cobro por usuario en Stripe</h2>
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-4 space-y-3">
        {!d && !error && <p className="text-sm text-slate-500">Cargando…</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {d && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-700 dark:text-slate-300">
                Ajuste automático: <b className={d.sincronizar ? 'text-emerald-600' : 'text-amber-600'}>{d.sincronizar ? 'ENCENDIDO' : 'apagado (solo anota diferencias)'}</b>
              </p>
              <div className="flex gap-2">
                <button onClick={() => accion({})} disabled={ocupado} className="h-9 px-3 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-semibold flex items-center gap-1.5 disabled:opacity-50">
                  <RefreshCw className={`w-4 h-4 ${ocupado ? 'animate-spin' : ''}`} /> Revisar ahora
                </button>
                <button onClick={alternar} disabled={ocupado} className={`h-9 px-3 rounded-lg text-sm font-bold text-white disabled:opacity-50 ${d.sincronizar ? 'bg-slate-700 hover:bg-slate-800' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                  {d.sincronizar ? 'Apagar' : 'Encender'}
                </button>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              {d.ultima?.en ? `Última revisión: ${new Date(d.ultima.en).toLocaleString('es-MX')}. ` : 'Aún no hay revisión. '}
              {resultados.length === 0 ? 'Ninguna agencia paga por Stripe todavía, así que no hay nada que ajustar.' : `${resultados.length} agencia${resultados.length === 1 ? '' : 's'} con suscripción.`}
            </p>
            {importantes.length > 0 && (
              <ul className="text-sm divide-y divide-slate-100 dark:divide-slate-700">
                {importantes.map((r) => (
                  <li key={r.agencyId} className="py-1.5 flex justify-between gap-3">
                    <span className="font-semibold text-slate-800 dark:text-slate-100">{r.nombre}</span>
                    <span className="text-slate-600 dark:text-slate-300 text-right">{TEXTO[r.estado] || r.estado}{r.usuarios != null ? ` · ${r.usuarios} usuarios, ${r.cobrados ?? '?'} cobrados` : ''}{r.detalle ? ` · ${r.detalle}` : ''}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </section>
  );
}
