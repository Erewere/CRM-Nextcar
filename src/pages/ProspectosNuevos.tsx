import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { collection, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { Check, Clock, MessageCircle, Phone, Star, UserX } from 'lucide-react';
import clsx from 'clsx';
import { auth, db } from '../lib/firebase';
import { getApiUrl } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useActualizarAlVolver } from '../hooks/useActualizarAlVolver';
import { alClicWhatsApp } from '../lib/whatsappApp';
import { tratosEnfriandose, DIAS_SIN_CONTACTO } from '../lib/enfriandose';
import { prospectosNuevos, resumenDeRespuesta, textoDeEspera, VENTANA_DIAS, type NivelEspera, type ProspectoNuevo } from '../lib/prospectosNuevos';

/**
 * «Nuevos»: los prospectos que llegaron solos (WhatsApp, Messenger, formularios de la página…) y
 * cuánto llevan esperando a que alguien los atienda. Las reglas están en src/lib/prospectosNuevos.ts.
 * Un vendedor ve los suyos; el administrador ve todos y puede asignarlos.
 */

const ESTILO_NIVEL: Record<NivelEspera, { reloj: string; texto: string }> = {
  nuevo: { reloj: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800', texto: 'Recién llegó' },
  ya: { reloj: 'bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-800', texto: 'Atiéndelo ya' },
  tarde: { reloj: 'bg-red-50 text-red-800 border-red-300 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800', texto: 'Va tarde' },
  critico: { reloj: 'bg-red-700 text-white border-red-700', texto: 'Se enfría' },
};

type Pestana = 'sin' | 'atendidos' | 'preferidos' | 'todos' | 'frios';

export function ProspectosNuevos() {
  const navigate = useNavigate();
  const { userData, agencyData } = useAuth();
  const [clientes, setClientes] = useState<any[]>([]);
  const [notas, setNotas] = useState<any[]>([]);
  const [tareas, setTareas] = useState<any[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [pestana, setPestana] = useState<Pestana>('sin');
  const [origen, setOrigen] = useState('');
  const [asesor, setAsesor] = useState('');
  const [ocupado, setOcupado] = useState('');
  const [, tic] = useState(0);

  const esAdmin = userData?.role === 'admin';
  const agencyId = userData?.agencyId;

  const cargar = useCallback(async () => {
    if (!agencyId || !userData) return;
    try {
      const deLaAgencia = where('agencyId', '==', agencyId);
      const soloMios = userData.role === 'seller';
      const [c, n, t, u] = await Promise.all([
        getDocs(soloMios ? query(collection(db, 'clients'), deLaAgencia, where('sellerId', '==', userData.id)) : query(collection(db, 'clients'), deLaAgencia)),
        getDocs(query(collection(db, 'notes'), deLaAgencia)),
        getDocs(soloMios ? query(collection(db, 'tasks'), deLaAgencia, where('sellerId', '==', userData.id)) : query(collection(db, 'tasks'), deLaAgencia)),
        getDocs(query(collection(db, 'users'), deLaAgencia)),
      ]);
      setClientes(c.docs.map((d) => ({ ...d.data(), id: d.id })));
      setNotas(n.docs.map((d) => ({ ...d.data(), id: d.id })));
      setTareas(t.docs.map((d) => ({ ...d.data(), id: d.id })));
      setUsuarios(u.docs.map((d) => ({ ...d.data(), id: d.id })));
      setError('');
    } catch (e: any) {
      console.error('Prospectos nuevos:', e);
      setError('No se pudieron leer los prospectos. Intenta de nuevo.');
    } finally { setCargando(false); }
  }, [agencyId, userData]);

  useEffect(() => { cargar(); }, [cargar]);
  // Mientras la pantalla está a la vista, se recarga cada 2 minutos y al regresar a la pestaña; y el reloj avanza cada minuto.
  useActualizarAlVolver(cargar, { minimoMs: 60_000, cadaMs: 120_000 });
  useEffect(() => { const t = setInterval(() => tic((x) => x + 1), 60_000); return () => clearInterval(t); }, []);

  const etapas = (agencyData as any)?.pipelineStages || [];
  const lista = useMemo(
    () => prospectosNuevos({ clientes, notas, tareas, etapas, horario: (agencyData as any)?.businessHours }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clientes, notas, tareas, agencyData, Math.floor(Date.now() / 60_000)],
  );
  const resumen = useMemo(() => resumenDeRespuesta(lista), [lista]);
  // Tratos abiertos que llevan 7 días o más sin ninguna actividad (ver src/lib/enfriandose.ts). Solo tratos, no contactos del Directorio.
  const frios = useMemo(
    () => tratosEnfriandose({ clientes, notas, tareas, etapas }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clientes, notas, tareas, agencyData, Math.floor(Date.now() / 3_600_000)],
  );
  const friosVisibles = frios.filter((f) => !asesor || (asesor === '_sin' ? !f.sellerId : f.sellerId === asesor));
  const nombreDe = (id: string) => usuarios.find((u) => u.id === id)?.name || usuarios.find((u) => u.id === id)?.email || 'Sin asignar';

  const origenes = useMemo(() => [...new Set(lista.map((x) => x.origen))].sort(), [lista]);
  const visibles = pestana === 'frios' ? [] : lista.filter((x) =>
    (pestana === 'sin' ? !x.atendido : pestana === 'atendidos' ? x.atendido : pestana === 'preferidos' ? x.preferido : true)
    && (!origen || x.origen === origen) && (!asesor || (asesor === '_sin' ? x.sinAsignar : x.sellerId === asesor)));

  const guardar = async (p: ProspectoNuevo, cambios: Record<string, any>, local: Record<string, any>) => {
    setOcupado(p.id);
    try {
      await updateDoc(doc(db, 'clients', p.id), cambios);
      setClientes((prev) => prev.map((c) => (c.id === p.id ? { ...c, ...local } : c)));
    } catch (e) { console.error(e); setError('No se pudo guardar. Intenta de nuevo.'); } finally { setOcupado(''); }
  };
  const atendido = (p: ProspectoNuevo) => { const ahora = new Date().toISOString(); return guardar(p, { primerContactoAt: ahora }, { primerContactoAt: ahora }); };
  const estrella = (p: ProspectoNuevo) => guardar(p, { preferido: !p.preferido }, { preferido: !p.preferido });
  const asignar = async (p: ProspectoNuevo, sellerId: string) => {
    setOcupado(p.id);
    try {
      const token = await auth.currentUser?.getIdToken();
      const r = await fetch(getApiUrl('/api/clients/assign-seller'), { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ clientId: p.id, sellerId }) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'No se pudo asignar.');
      setClientes((prev) => prev.map((c) => (c.id === p.id ? { ...c, sellerId } : c)));
    } catch (e: any) { setError(e.message); } finally { setOcupado(''); }
  };

  const tel = (p: ProspectoNuevo) => { const d = p.telefono.replace(/\D/g, ''); return d ? (d.length === 10 ? `52${d}` : d) : ''; };
  const hora = (iso: string) => new Date(iso).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  const tarjeta = (titulo: string, valor: string, sub?: string, tono = 'text-slate-900 dark:text-white') => (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{titulo}</p>
      <p className={clsx('text-2xl font-extrabold tracking-tight mt-1', tono)}>{valor}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-[#f4f5f5] dark:bg-slate-900 overflow-y-auto">
      <div className="p-4 md:p-6 max-w-5xl mx-auto w-full space-y-4">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">Prospectos nuevos</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Los que llegaron solos en los últimos {VENTANA_DIAS} días. El reloj cuenta solo dentro del horario de la agencia, y se detiene cuando alguien les escribe, les anota algo o los atiende.</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {tarjeta('Sin atender', String(resumen.sinAtender), resumen.criticos ? `${resumen.criticos} ya van tarde` : 'todo al día', resumen.sinAtender ? 'text-red-600' : 'text-emerald-600')}
          {tarjeta('Sin asignar', String(resumen.sinAsignar), 'sin asesor', resumen.sinAsignar ? 'text-amber-600' : 'text-slate-900 dark:text-white')}
          {tarjeta('El más viejo', resumen.sinAtender ? textoDeEspera(resumen.masViejoMin) : '—', 'esperando')}
          {tarjeta('Respuesta típica', resumen.respuestaTipicaMin === null ? '—' : textoDeEspera(resumen.respuestaTipicaMin), `${resumen.atendidos} atendidos`)}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex h-9 p-0.5 bg-slate-100 dark:bg-slate-700 rounded-lg">
            {([['sin', `Sin atender ${resumen.sinAtender}`], ['atendidos', `Atendidos ${resumen.atendidos}`], ['frios', `Sin contacto ${frios.length}`], ['preferidos', 'Preferidos'], ['todos', 'Todos']] as [Pestana, string][]).map(([k, t]) => (
              <button key={k} onClick={() => setPestana(k)} className={clsx('px-3 rounded-md text-sm font-semibold transition', pestana === k ? 'bg-white dark:bg-slate-900 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500')}>{t}</button>
            ))}
          </div>
          {pestana !== 'frios' && origenes.length > 1 && (
            <select value={origen} onChange={(e) => setOrigen(e.target.value)} className="h-9 px-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm" aria-label="Filtrar por origen">
              <option value="">Todos los orígenes</option>
              {origenes.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          )}
          {esAdmin && (
            <select value={asesor} onChange={(e) => setAsesor(e.target.value)} className="h-9 px-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm" aria-label="Filtrar por asesor">
              <option value="">Todos los asesores</option>
              <option value="_sin">Sin asignar</option>
              {usuarios.filter((u) => u.role === 'seller' || u.role === 'admin').map((u) => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
            </select>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {cargando && <p className="text-sm text-slate-500">Cargando…</p>}

        {pestana === 'frios' && (
          <p className="text-sm text-slate-600 dark:text-slate-400">Tratos abiertos que llevan <b>{DIAS_SIN_CONTACTO} días o más</b> sin ninguna actividad: ni una nota, ni un mensaje, ni una tarea hecha. Los más fríos, primero. Cualquier seguimiento que les des (anotar algo, escribirles, completar una tarea o agendar la siguiente) los saca de esta lista. Los contactos que solo están en el Directorio no aparecen.</p>
        )}

        {!cargando && pestana === 'frios' && !friosVisibles.length && (
          <div className="bg-white dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-8 text-center text-sm text-slate-600 dark:text-slate-400">¡Al día! No hay tratos enfriándose.</div>
        )}

        {!cargando && pestana !== 'frios' && !visibles.length && (
          <div className="bg-white dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-8 text-center text-sm text-slate-600 dark:text-slate-400">
            {pestana === 'sin' ? '¡Al día! No hay prospectos nuevos esperando.' : 'No hay prospectos en este filtro.'}
          </div>
        )}

        {pestana === 'frios' && (
          <ul className="flex flex-col gap-2.5">
            {friosVisibles.map((f) => {
              const d = f.telefono.replace(/\D/g, '');
              const num = d ? (d.length === 10 ? `52${d}` : d) : '';
              const rojo = f.dias >= 14;
              return (
                <li key={f.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 flex flex-wrap items-center gap-x-4 gap-y-2">
                  <button onClick={() => navigate('/persons', { state: { clientId: f.id } })} className="min-w-0 flex-1 basis-52 text-left">
                    <p className="font-bold text-slate-900 dark:text-white truncate">{f.nombre}</p>
                    <p className="text-xs text-slate-500 truncate">{[f.etapa, f.auto].filter(Boolean).join(' · ')}</p>
                  </button>
                  <span className={clsx('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-extrabold', rojo ? 'bg-red-700 text-white border-red-700' : 'bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-800')}>
                    <Clock className="w-3.5 h-3.5" /> {f.dias} días sin contacto
                  </span>
                  <span className="w-40 text-sm text-slate-600 dark:text-slate-300 inline-flex items-center gap-1">{f.sellerId ? nombreDe(f.sellerId) : <><UserX className="w-4 h-4 text-amber-600" /> Sin asesor</>}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    {num && <a href={`tel:+${num}`} aria-label="Llamar" className="h-9 w-9 rounded-lg border border-slate-300 dark:border-slate-600 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-700"><Phone className="w-4 h-4" /></a>}
                    {num && <a href={`https://wa.me/${num}`} onClick={alClicWhatsApp} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className="h-9 w-9 rounded-lg bg-green-700 hover:bg-green-800 text-white flex items-center justify-center"><MessageCircle className="w-4 h-4" /></a>}
                    <button onClick={() => navigate('/persons', { state: { clientId: f.id } })} className="h-9 px-3 rounded-lg border border-slate-300 dark:border-slate-600 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-700">Abrir</button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <ul className="flex flex-col gap-2.5">
          {visibles.map((p) => {
            const e = ESTILO_NIVEL[p.nivel];
            const num = tel(p);
            return (
              <li key={p.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 flex flex-wrap items-center gap-x-4 gap-y-2">
                <button onClick={() => estrella(p)} disabled={ocupado === p.id} aria-label={p.preferido ? 'Quitar de preferidos' : 'Marcar como preferido'} className="shrink-0">
                  <Star className={clsx('w-5 h-5', p.preferido ? 'fill-amber-400 text-amber-400' : 'text-slate-300 hover:text-amber-400')} />
                </button>
                <button onClick={() => navigate('/persons', { state: { clientId: p.id } })} className="min-w-0 flex-1 basis-52 text-left">
                  <p className="font-bold text-slate-900 dark:text-white truncate">{p.nombre}</p>
                  <p className="text-xs text-slate-500 truncate">
                    {[p.origen, p.tipo ? p.tipo.toLowerCase().replace(/^./, (c) => c.toUpperCase()) : '', p.auto].filter(Boolean).join(' · ')}
                  </p>
                  {p.ultimoTexto && !p.atendido && <p className="text-xs text-slate-600 dark:text-slate-300 truncate italic">«{p.ultimoTexto}»</p>}
                </button>

                <div className="flex flex-col items-start gap-1 w-44">
                  {p.atendido ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-2.5 py-1 text-xs font-bold text-slate-700 dark:text-slate-200"><Check className="w-3.5 h-3.5 text-emerald-600" /> Atendido en {textoDeEspera(p.minutos)}</span>
                  ) : (
                    <span className={clsx('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-extrabold', e.reloj)}><Clock className="w-3.5 h-3.5" /> {textoDeEspera(p.minutos)} · {e.texto}</span>
                  )}
                  <span className="text-[11px] text-slate-400">Llegó {hora(p.llegada)}</span>
                </div>

                <div className="w-40">
                  {esAdmin ? (
                    <select value={p.sellerId} disabled={ocupado === p.id} onChange={(ev) => asignar(p, ev.target.value)} className={clsx('w-full h-9 px-2 rounded-lg border text-sm bg-white dark:bg-slate-800', p.sinAsignar ? 'border-amber-400 text-amber-800' : 'border-slate-300 dark:border-slate-600')} aria-label="Asignar a un asesor">
                      <option value="">Sin asignar</option>
                      {usuarios.filter((u) => u.role === 'seller' || u.role === 'admin').map((u) => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
                    </select>
                  ) : <span className="text-sm text-slate-600 dark:text-slate-300 inline-flex items-center gap-1">{p.sinAsignar ? <><UserX className="w-4 h-4 text-amber-600" /> Sin asignar</> : nombreDe(p.sellerId)}</span>}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {num && <a href={`tel:+${num}`} aria-label="Llamar" className="h-9 w-9 rounded-lg border border-slate-300 dark:border-slate-600 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-700"><Phone className="w-4 h-4" /></a>}
                  {num && <a href={`https://wa.me/${num}`} onClick={alClicWhatsApp} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className="h-9 w-9 rounded-lg bg-green-700 hover:bg-green-800 text-white flex items-center justify-center"><MessageCircle className="w-4 h-4" /></a>}
                  {!p.atendido && <button onClick={() => atendido(p)} disabled={ocupado === p.id} className="h-9 px-3 rounded-lg border border-slate-300 dark:border-slate-600 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50">Ya lo atendí</button>}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
