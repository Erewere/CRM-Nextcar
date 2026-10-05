import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import clsx from 'clsx';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Landmark, Loader2, Plus, Settings, X } from 'lucide-react';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { creditosApi } from '../lib/creditosApi';
import { FormatosBancos } from '../components/credito/FormatosBancos';

/**
 * Créditos: cada solicitud, por etapa, desde que la pide el cliente hasta que
 * se cierra la venta. Los datos personales viven en el servidor; aquí solo
 * llega el resumen.
 */

export const ETAPAS_CREDITO: { id: string; titulo: string }[] = [
  { id: 'recibida', titulo: 'Recibida' },
  { id: 'datos', titulo: 'Juntando datos y documentos' },
  { id: 'enviada', titulo: 'Enviada al banco' },
  { id: 'respuesta', titulo: 'Respuesta' },
  { id: 'cerrada', titulo: 'Venta cerrada' },
];

export const ESTILO_BANCO: Record<string, string> = {
  pendiente: 'bg-slate-100 text-slate-700',
  firmada: 'bg-blue-100 text-blue-900',
  enviada: 'bg-indigo-100 text-indigo-900',
  aprobado: 'bg-emerald-600 text-white',
  condiciones: 'bg-amber-500 text-white',
  rechazado: 'bg-red-600 text-white',
};
export const TEXTO_ESTADO_BANCO: Record<string, string> = {
  pendiente: 'Pendiente', firmada: 'Firmada', enviada: 'Enviada', aprobado: 'Aprobado', condiciones: 'Con condiciones', rechazado: 'Rechazado',
};
const DOCS_REQUERIDOS = ['ine', 'domicilio', 'ingresos', 'constancia'];
const dias = (iso?: string | null) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) : null);

function avisoDe(s: any): { texto: string; tono: 'rojo' | 'ambar' } | null {
  if (s.etapa === 'recibida' && !s.ligaVence) return { texto: 'Falta mandarle la liga', tono: 'ambar' };
  if (s.ligaVence && new Date(s.ligaVence).getTime() < Date.now() && !s.clienteTerminoEl && s.etapa === 'datos') return { texto: 'La liga venció sin terminar', tono: 'rojo' };
  if (s.ligaAbiertaEl && !s.clienteTerminoEl && (dias(s.actualizadoEl) ?? 0) >= 2 && s.etapa === 'datos') return { texto: `Abrió la liga y no ha terminado (${dias(s.ligaAbiertaEl)} días)`, tono: 'ambar' };
  const esperando = (s.bancos || []).filter((b: any) => b.estado === 'enviada');
  if (esperando.length && (dias(s.actualizadoEl) ?? 0) >= 3) return { texto: `${dias(s.actualizadoEl)} días sin respuesta del banco`, tono: 'rojo' };
  return null;
}

export function Creditos() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { userData } = useAuth();
  const esAdmin = ['admin', 'manager', 'master'].includes(String(userData?.role));
  const [lista, setLista] = useState<any[] | null>(null);
  const [error, setError] = useState('');
  const [filtroBanco, setFiltroBanco] = useState('');
  const [verCanceladas, setVerCanceladas] = useState(false);
  const [creando, setCreando] = useState(!!params.get('cliente'));
  const [viendoFormatos, setViendoFormatos] = useState(false);

  const cargar = () => creditosApi.lista().then(setLista).catch((e) => setError(e.message));
  useEffect(() => { cargar(); }, []);

  const filtradas = useMemo(() => (lista || []).filter((s) => (verCanceladas || s.etapa !== 'cancelada') && (!filtroBanco || s.bancos.some((b: any) => b.clave === filtroBanco))), [lista, filtroBanco, verCanceladas]);
  const bancosEnUso = useMemo(() => { const m = new Map<string, string>(); (lista || []).forEach((s) => s.bancos.forEach((b: any) => m.set(b.clave, b.nombre))); return [...m.entries()]; }, [lista]);

  const mesActual = new Date().toISOString().slice(0, 7);
  const respondidas = (lista || []).flatMap((s) => s.bancos).filter((b: any) => ['aprobado', 'condiciones', 'rechazado'].includes(b.estado));
  const kpis = {
    enProceso: (lista || []).filter((s) => !['cerrada', 'cancelada'].includes(s.etapa)).length,
    esperando: (lista || []).filter((s) => s.bancos.some((b: any) => b.estado === 'enviada')).length,
    aprobadas: (lista || []).filter((s) => s.bancos.some((b: any) => b.estado === 'aprobado') && String(s.actualizadoEl).slice(0, 7) === mesActual).length,
    tasa: respondidas.length ? Math.round((respondidas.filter((b: any) => b.estado !== 'rechazado').length / respondidas.length) * 100) : null,
  };

  return (
    <div className="max-w-[1500px] mx-auto px-3 md:px-6 py-4 md:py-6 flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2"><Landmark className="w-6 h-6" /> Créditos</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">Cada solicitud, desde que la pide el cliente hasta que se cierra la venta.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {bancosEnUso.length > 1 && (
            <select value={filtroBanco} onChange={(e) => setFiltroBanco(e.target.value)} className="h-10 px-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-semibold">
              <option value="">Todos los bancos</option>
              {bancosEnUso.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
            </select>
          )}
          {esAdmin && <button type="button" onClick={() => setViendoFormatos(true)} className="h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-bold flex items-center gap-1.5"><Settings className="w-4 h-4" /> Formatos de bancos</button>}
          <button type="button" onClick={() => setCreando(true)} className="h-10 px-4 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-sm font-bold flex items-center gap-1.5"><Plus className="w-4 h-4" /> Nueva solicitud</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {[
          ['En proceso', kpis.enProceso, ''],
          ['Esperando al banco', kpis.esperando, ''],
          ['Aprobadas este mes', kpis.aprobadas, 'text-emerald-700'],
          ['Se aprueban', kpis.tasa === null ? '—' : `${kpis.tasa}%`, ''],
        ].map(([t, v, c]) => (
          <div key={String(t)} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{t}</p>
            <p className={clsx('text-3xl font-extrabold text-slate-900 dark:text-white', c)}>{v}</p>
          </div>
        ))}
      </div>

      {error && <p className="text-sm font-semibold text-red-700">{error}</p>}
      {!lista && !error && <div className="py-16 flex justify-center"><Loader2 className="w-7 h-7 animate-spin text-slate-400" /></div>}

      {lista && (
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-3 items-start">
          {ETAPAS_CREDITO.map((e) => {
            const items = filtradas.filter((s) => s.etapa === e.id).sort((a, b) => String(b.actualizadoEl).localeCompare(String(a.actualizadoEl)));
            return (
              <div key={e.id} className="bg-slate-200/60 dark:bg-slate-800/60 rounded-xl p-2.5 min-h-[120px]">
                <p className="text-xs font-extrabold uppercase text-slate-600 dark:text-slate-300 px-1 mb-2">{e.titulo} · {items.length}</p>
                <div className="flex flex-col gap-2">
                  {items.map((s) => {
                    const aviso = avisoDe(s);
                    const docsListos = DOCS_REQUERIDOS.filter((t) => s.documentos.includes(t)).length;
                    return (
                      <button key={s.id} type="button" onClick={() => navigate(`/creditos/${s.id}`)} className="text-left bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-3 hover:border-blue-400 hover:shadow-sm">
                        <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{s.clienteNombre || 'Cliente'}</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400 truncate">{[s.auto, s.operacion?.precio ? `$${Number(s.operacion.precio).toLocaleString('es-MX')}` : ''].filter(Boolean).join(' · ') || 'Sin auto elegido'}</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {s.origen === 'embudo' && <span className="text-[10px] font-bold rounded-full px-2 py-0.5 bg-violet-100 text-violet-900">Del embudo</span>}
                          {s.bancos.map((b: any) => <span key={b.clave} className={clsx('text-[10px] font-bold rounded-full px-2 py-0.5', ESTILO_BANCO[b.estado])}>{b.nombre}{b.estado !== 'pendiente' ? ` · ${TEXTO_ESTADO_BANCO[b.estado]}` : ''}</span>)}
                        </div>
                        {['recibida', 'datos'].includes(s.etapa) && (
                          <div className="mt-2">
                            <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-700"><div className={clsx('h-full rounded-full', s.avance === 100 ? 'bg-emerald-500' : 'bg-blue-600')} style={{ width: `${s.avance}%` }} /></div>
                            <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">Datos {s.avance}% · Documentos {docsListos} de 4</p>
                          </div>
                        )}
                        {aviso && <p className={clsx('text-[11px] font-semibold mt-1.5', aviso.tono === 'rojo' ? 'text-red-700' : 'text-amber-700')}>{aviso.texto}</p>}
                        {esAdmin && s.vendedorNombre && <p className="text-[10px] text-slate-500 mt-1">{s.vendedorNombre}</p>}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {lista && lista.some((s) => s.etapa === 'cancelada') && (
        <label className="text-xs text-slate-600 flex items-center gap-2"><input type="checkbox" checked={verCanceladas} onChange={(e) => setVerCanceladas(e.target.checked)} /> Ver canceladas</label>
      )}

      {creando && (
        <NuevaSolicitud
          clienteInicial={params.get('cliente') || ''}
          autoInicial={params.get('auto') || ''}
          onCerrar={() => { setCreando(false); if (params.get('cliente')) setParams({}); }}
          onCreada={(id) => navigate(`/creditos/${id}`)}
        />
      )}
      {viendoFormatos && <FormatosBancos onCerrar={() => setViendoFormatos(false)} />}
    </div>
  );
}

function NuevaSolicitud({ clienteInicial, autoInicial, onCerrar, onCreada }: { clienteInicial: string; autoInicial: string; onCerrar: () => void; onCreada: (id: string) => void }) {
  const { userData } = useAuth();
  const [clientes, setClientes] = useState<any[]>([]);
  const [autos, setAutos] = useState<any[]>([]);
  const [formatos, setFormatos] = useState<any[]>([]);
  const [busca, setBusca] = useState('');
  const [clientId, setClientId] = useState(clienteInicial);
  const [vehicleId, setVehicleId] = useState(autoInicial);
  const [bancos, setBancos] = useState<string[]>([]);
  const [precio, setPrecio] = useState('');
  const [enganche, setEnganche] = useState('');
  const [plazo, setPlazo] = useState('48');
  const [creando, setCreando] = useState(false);

  useEffect(() => {
    if (!userData?.agencyId) return;
    const qc = userData.role === 'seller'
      ? query(collection(db, 'clients'), where('agencyId', '==', userData.agencyId), where('sellerId', '==', userData.id))
      : query(collection(db, 'clients'), where('agencyId', '==', userData.agencyId));
    getDocs(qc).then((s) => setClientes(s.docs.map((d) => ({ id: d.id, ...d.data() })).filter((c: any) => !c.isDeleted).sort((a: any, b: any) => String(a.name).localeCompare(String(b.name))))).catch(() => {});
    getDocs(query(collection(db, 'vehicles'), where('agencyId', '==', userData.agencyId))).then((s) => setAutos(s.docs.map((d) => ({ id: d.id, ...d.data() })).filter((v: any) => v.status !== 'sold'))).catch(() => {});
    creditosApi.formatos().then((f) => { setFormatos(f); setBancos(f.map((x) => x.id)); }).catch(() => {});
  }, [userData?.agencyId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { const v = autos.find((a) => a.id === vehicleId); if (v?.price && !precio) { setPrecio(String(v.price)); setEnganche(String(Math.round(v.price * 0.2))); } }, [vehicleId, autos]); // eslint-disable-line react-hooks/exhaustive-deps

  const visibles = clientes.filter((c) => !busca.trim() || `${c.name} ${c.phone}`.toLowerCase().includes(busca.toLowerCase())).slice(0, 50);
  const crear = async () => {
    setCreando(true);
    try {
      const s = await creditosApi.crear({ clientId, vehicleId: vehicleId || null, bancos, operacion: { precio: Number(precio) || 0, enganche: Number(enganche) || 0, plazo: Number(plazo) || 0 } });
      onCreada(s.id);
    } catch (e: any) { alert(e.message); setCreando(false); }
  };
  const marcar = (id: string) => setBancos((b) => (b.includes(id) ? b.filter((x) => x !== id) : [...b, id]));
  const campo = 'h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm';

  return (
    <div className="fixed inset-0 z-[110] flex items-stretch md:items-center justify-center md:p-4" role="dialog" aria-modal="true" aria-labelledby="titulo-nueva-sol">
      <div className="absolute inset-0 bg-slate-900/60" onClick={creando ? undefined : onCerrar} />
      <div className="relative bg-white dark:bg-slate-800 md:rounded-2xl shadow-2xl w-full max-w-xl md:max-h-[92vh] flex flex-col">
        <div className="flex items-start justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <h2 id="titulo-nueva-sol" className="text-lg font-extrabold">Nueva solicitud de crédito</h2>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-bold">Cliente</span>
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nombre o teléfono…" className={campo} />
            <select value={clientId} onChange={(e) => setClientId(e.target.value)} className={campo} size={Math.min(6, Math.max(2, visibles.length + 1))}>
              <option value="">— Elige al cliente —</option>
              {visibles.map((c) => <option key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ''}</option>)}
            </select>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold">Auto</span>
            <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} className={campo}>
              <option value="">— Sin auto por ahora —</option>
              {autos.map((v) => <option key={v.id} value={v.id}>{v.year} {v.make} {v.model}{v.price ? ` · $${Number(v.price).toLocaleString('es-MX')}` : ''}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-3 gap-2">
            <label className="flex flex-col gap-1.5"><span className="text-xs font-bold">Precio</span><input value={precio} onChange={(e) => setPrecio(e.target.value)} inputMode="decimal" className={campo} /></label>
            <label className="flex flex-col gap-1.5"><span className="text-xs font-bold">Enganche</span><input value={enganche} onChange={(e) => setEnganche(e.target.value)} inputMode="decimal" className={campo} /></label>
            <label className="flex flex-col gap-1.5"><span className="text-xs font-bold">Plazo (meses)</span><input value={plazo} onChange={(e) => setPlazo(e.target.value)} inputMode="numeric" className={campo} /></label>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-bold">¿A qué bancos se manda?</span>
            <div className="flex flex-wrap gap-2">
              {[...formatos.map((f) => [f.id, f.nombre]), ['casa', 'Crédito de la casa']].map(([id, n]) => (
                <button key={id} type="button" onClick={() => marcar(id)} aria-pressed={bancos.includes(id)} className={clsx('h-10 px-3 rounded-lg border text-sm font-bold', bancos.includes(id) ? 'border-blue-600 bg-blue-50 text-blue-900 dark:bg-blue-950/40 dark:text-blue-200' : 'border-slate-300 dark:border-slate-600')}>
                  {bancos.includes(id) ? '✓ ' : ''}{n}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2">
          <button type="button" onClick={onCerrar} disabled={creando} className="h-10 px-4 rounded-lg text-sm font-semibold hover:bg-slate-100">Cancelar</button>
          <button type="button" onClick={crear} disabled={creando || !clientId || !bancos.length} className="h-10 px-4 rounded-lg bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-sm font-bold">{creando ? 'Creando…' : 'Crear solicitud'}</button>
        </div>
      </div>
    </div>
  );
}
