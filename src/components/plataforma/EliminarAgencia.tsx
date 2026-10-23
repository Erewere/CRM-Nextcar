import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import { auth } from '../../lib/firebase';
import { getApiUrl } from '../../lib/api';

/**
 * Eliminar una agencia (solo master). Muestra qué se borra, pide escribir el nombre y guarda un respaldo antes de tocar
 * nada. Ver src/servidor/agencias.ts.
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

const ETIQUETA: Record<string, string> = {
  clients: 'contactos', deals: 'tratos', tasks: 'tareas', notes: 'notas', files: 'archivos de clientes', vehicles: 'autos', vehicleExpenses: 'gastos de autos',
  vehicleFinancials: 'precios de compra', notasAutos: 'notas de autos', documentosAutos: 'documentos de autos', pagosVenta: 'pagos de ventas',
  agency_tags: 'etiquetas', analisis_precio: 'análisis de precios', analisis_compra: 'análisis de compras', analisis_precio_corridas: 'revisiones de precios',
  operaciones_venta: 'ventas analizadas', consultas_precio: 'consultas de precio', mercadoAutos: 'precios de mercado', consultasPlacas: 'consultas de antecedentes',
  movimientosPlacas: 'movimientos de consultas', whatsappMessages: 'mensajes de WhatsApp', solicitudesCredito: 'solicitudes de crédito',
  paquetesCredito: 'paquetes de crédito', formatosCredito: 'formatos de crédito', metasVentas: 'metas', pushSuscripciones: 'dispositivos con avisos',
  correosEnviados: 'registro de correos', agencySecrets: 'llaves de la agencia', userSecrets: 'llaves de usuarios',
};

export function EliminarAgencia({ agencyId, nombre, onCerrar, onEliminada }: { agencyId: string; nombre: string; onCerrar: () => void; onEliminada: () => void }) {
  const [r, setR] = useState<any>(null);
  const [error, setError] = useState('');
  const [escrito, setEscrito] = useState('');
  const [conUsuarios, setConUsuarios] = useState(true);
  const [borrando, setBorrando] = useState(false);
  const [listo, setListo] = useState<any>(null);

  useEffect(() => { pedir(`/api/admin/agencias/${agencyId}/eliminar-resumen`).then(setR).catch((e) => setError(e.message)); }, [agencyId]);

  const coincide = r && escrito.trim().toLowerCase() === r.nombre.trim().toLowerCase();
  const borrar = async () => {
    setBorrando(true); setError('');
    try { setListo(await pedir(`/api/admin/agencias/${agencyId}/eliminar`, { nombre: escrito, eliminarUsuarios: conUsuarios })); }
    catch (e: any) { setError(e.message); setBorrando(false); }
  };

  const conDatos = r ? Object.entries(r.conteos as Record<string, number>).filter(([, n]) => n > 0) : [];
  const usuariosABorrar = r ? r.usuarios.filter((u: any) => !u.esMaster) : [];

  return (
    <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center bg-black/50 md:p-4" onClick={() => !borrando && !listo && onCerrar()}>
      <div className="w-full max-w-lg max-h-[92dvh] overflow-y-auto bg-white dark:bg-slate-900 rounded-t-3xl md:rounded-2xl p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <h2 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-red-600" /> Eliminar «{nombre}»</h2>
          {!borrando && <button onClick={() => (listo ? onEliminada() : onCerrar())} aria-label="Cerrar" className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center"><X className="w-4 h-4" /></button>}
        </div>

        {listo ? (
          <div className="space-y-3 text-sm text-slate-700 dark:text-slate-300">
            <p className="font-semibold text-emerald-700 dark:text-emerald-400">Agencia eliminada.</p>
            <p>Se borraron {listo.registrosBorrados} registros{listo.usuariosEliminados ? ` y ${listo.usuariosEliminados} cuentas de usuario` : ''}.</p>
            {listo.usuariosSinAgencia > 0 && <p>{listo.usuariosSinAgencia} usuarios quedaron sin agencia.</p>}
            <p className="text-xs text-slate-500">Antes de borrar se guardó un respaldo en el servidor: <code className="break-all">{listo.respaldo}</code>. Si necesitas recuperar algo, avísame y lo busco ahí.</p>
            <button onClick={onEliminada} className="h-11 w-full rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold">Listo</button>
          </div>
        ) : !r && !error ? (
          <p className="text-sm text-slate-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Revisando qué tiene la agencia…</p>
        ) : (
          <div className="space-y-4 text-sm">
            {error && <p className="text-red-700 dark:text-red-400 font-semibold">{error}</p>}
            {r && (
              <>
                {r.bloqueo && <p className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-800 p-3 text-red-900 dark:text-red-200 font-semibold">{r.bloqueo}</p>}
                {r.advertencias.map((a: string) => <p key={a} className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-3 text-amber-900 dark:text-amber-200">{a}</p>)}

                <div>
                  <p className="font-bold text-slate-800 dark:text-slate-100 mb-1">Se borrará para siempre:</p>
                  {conDatos.length === 0 ? <p className="text-slate-500">No tiene datos, solo la agencia.</p> : (
                    <ul className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-slate-600 dark:text-slate-300">
                      {conDatos.map(([c, n]) => <li key={c}><b>{n}</b> {ETIQUETA[c] || c}</li>)}
                    </ul>
                  )}
                </div>

                {usuariosABorrar.length > 0 && (
                  <div>
                    <p className="font-bold text-slate-800 dark:text-slate-100 mb-1">Usuarios de esta agencia:</p>
                    <ul className="text-slate-600 dark:text-slate-300 mb-2">{usuariosABorrar.map((u: any) => <li key={u.uid}>{u.nombre || u.email} <span className="text-slate-400">· {u.email} · {u.rol}</span></li>)}</ul>
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input type="checkbox" checked={conUsuarios} onChange={(e) => setConUsuarios(e.target.checked)} className="mt-1" />
                      <span>Eliminar también sus cuentas de usuario. <span className="text-slate-500">Si las dejas, quedan sin agencia y no podrán entrar a nada.</span></span>
                    </label>
                  </div>
                )}

                <p className="text-xs text-slate-500">Antes de borrar, el servidor guarda un respaldo con los datos de la agencia. No se borra nada si el respaldo falla.</p>

                {!r.bloqueo && (
                  <label className="block">
                    <span className="font-bold text-slate-800 dark:text-slate-100">Para confirmar, escribe el nombre de la agencia:</span>
                    <input value={escrito} onChange={(e) => setEscrito(e.target.value)} placeholder={r.nombre} className="mt-1 w-full h-11 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3" />
                  </label>
                )}
                <div className="flex gap-2 pt-1">
                  <button onClick={onCerrar} disabled={borrando} className="h-11 flex-1 rounded-lg border border-slate-300 dark:border-slate-600 font-bold disabled:opacity-50">Cancelar</button>
                  <button onClick={borrar} disabled={!!r.bloqueo || !coincide || borrando} className="h-11 flex-1 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold disabled:opacity-40 flex items-center justify-center gap-2">
                    {borrando ? <><Loader2 className="w-4 h-4 animate-spin" /> Eliminando…</> : 'Eliminar para siempre'}
                  </button>
                </div>
              </>
            )}
            {!r && error && <button onClick={onCerrar} className="h-11 w-full rounded-lg border border-slate-300 dark:border-slate-600 font-bold">Cerrar</button>}
          </div>
        )}
      </div>
    </div>
  );
}
