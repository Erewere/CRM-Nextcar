import { useEffect, useState } from 'react';
import { Mail } from 'lucide-react';
import { auth } from '../../lib/firebase';
import { getApiUrl } from '../../lib/api';

/**
 * «Edición del lunes»: el correo de los lunes cambia cada semana (qué va primero y cómo se dice). Aquí se ve cuál toca
 * y se puede fijar la estructura o escribir una nota para esa semana. Los sábados a las 9:00 llega la revisión por correo.
 * Ver src/lib/edicionCorreo.ts.
 */
async function pedir(ruta: string, cuerpo?: unknown) {
  const token = await auth.currentUser?.getIdToken();
  const r = await fetch(getApiUrl(ruta), {
    method: cuerpo !== undefined ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${token}`, ...(cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'No se pudo completar.');
  return d;
}

const NOMBRE: Record<string, string> = { numeros: 'Cifras primero', novedades: 'Novedades primero', consejo: 'Consejo primero' };
const fecha = (s: string) => new Date(`${s}T12:00:00`).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });

export function EdicionDelLunes() {
  const [d, setD] = useState<any>(null);
  const [estructura, setEstructura] = useState('auto');
  const [nota, setNota] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [ocupado, setOcupado] = useState('');

  const cargar = () => pedir('/api/admin/correos/edicion').then((r) => { setD(r); setEstructura(r.ajuste.estructura || 'auto'); setNota(r.ajuste.nota || ''); }).catch((e) => setMsg({ ok: false, t: e.message }));
  useEffect(() => { cargar(); }, []);

  const guardar = async () => {
    setOcupado('guardar'); setMsg(null);
    try { await pedir('/api/admin/correos/edicion', { estructura, nota }); await cargar(); setMsg({ ok: true, t: 'Guardado para esta semana. Mándate la revisión para verlo.' }); }
    catch (e: any) { setMsg({ ok: false, t: e.message }); } finally { setOcupado(''); }
  };
  const revision = async () => {
    setOcupado('revision'); setMsg(null);
    try { const r = await pedir('/api/admin/correos/revision', {}); setMsg({ ok: r.enviados > 0, t: r.enviados > 0 ? `Te mandé ${r.enviados} correo${r.enviados === 1 ? '' : 's'} de revisión (resumen de administrador, de vendedor y de ánimo).` : r.motivo || 'No se pudo mandar.' }); }
    catch (e: any) { setMsg({ ok: false, t: e.message }); } finally { setOcupado(''); }
  };

  if (!d) return null;
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4 space-y-3">
      <div>
        <h3 className="font-bold text-slate-900 dark:text-white">Edición del lunes</h3>
        <p className="text-xs text-slate-500">
          Sale el <b>{fecha(d.semana)}</b> a las 9:00. Esta semana toca <b>{NOMBRE[d.automatica]}</b>{d.contexto === 'cierre-de-mes' ? ' y lleva la línea de cierre de mes' : d.contexto === 'inicio-de-mes' ? ' y lleva la línea de arranque de mes' : ''}.
          {' '}Cada semana cambia sola: qué va primero, el título, el asunto y las frases.
          {d.ultimaRevision ? ` Última revisión mandada: semana del ${d.ultimaRevision}.` : ''}
        </p>
      </div>
      <div className="grid md:grid-cols-[220px_1fr] gap-3">
        <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Estructura de esta semana
          <select value={estructura} onChange={(e) => setEstructura(e.target.value)} className="mt-1 w-full h-10 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 text-sm font-normal">
            <option value="auto">Automática ({NOMBRE[d.automatica]})</option>
            <option value="numeros">Cifras primero</option>
            <option value="novedades">Novedades primero</option>
            <option value="consejo">Consejo primero</option>
          </select>
        </label>
        <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Nota del equipo (opcional, sale arriba)
          <textarea value={nota} onChange={(e) => setNota(e.target.value)} maxLength={600} rows={2} placeholder="Ej.: Esta semana abrimos las consultas de antecedentes para todas las agencias." className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-normal" />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={guardar} disabled={!!ocupado} className="h-9 px-4 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold disabled:opacity-50">{ocupado === 'guardar' ? 'Guardando…' : 'Guardar'}</button>
        <button onClick={revision} disabled={!!ocupado} className="h-9 px-3 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-semibold flex items-center gap-1.5 disabled:opacity-50"><Mail className="w-4 h-4" /> {ocupado === 'revision' ? 'Mandando…' : 'Mandarme la revisión ahora'}</button>
        <span className="text-xs text-slate-500">Los sábados a las 9:00 te llega sola.</span>
      </div>
      {msg && <p className={`text-sm font-semibold ${msg.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>{msg.t}</p>}
    </div>
  );
}
