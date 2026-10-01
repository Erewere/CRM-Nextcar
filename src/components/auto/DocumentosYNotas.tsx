import React, { useEffect, useState } from 'react';
import clsx from 'clsx';
import { FileText, Image as ImageIcon, Lock, Trash2, Upload } from 'lucide-react';
import { auth } from '../../lib/firebase';
import { getApiUrl } from '../../lib/api';

/**
 * Documentos y notas internas de un auto. Todo pasa por el servidor, que
 * revisa agencia y rol en cada consulta: los documentos solo los ven
 * administradores y gerentes de la agencia; las notas, toda la agencia.
 */

const conToken = async (ruta: string, init: RequestInit = {}) => {
  const token = await auth.currentUser?.getIdToken();
  return fetch(getApiUrl(ruta), { ...init, headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` } });
};
const error = async (r: Response) => { try { return (await r.json()).error || `Error ${r.status}`; } catch { return `Error ${r.status}`; } };
const cuando = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
};
const tamano = (b: number) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

const CATEGORIAS = ['Factura', 'Tarjeta de circulación', 'Identificación del dueño', 'Tenencias / pagos', 'Contrato', 'Verificación', 'Otro'];
const MAX = 20 * 1024 * 1024;

export function DocumentosDelAuto({ vehicleId }: { vehicleId: string }) {
  const [docs, setDocs] = useState<any[] | null>(null);
  const [categoria, setCategoria] = useState('Factura');
  const [subiendo, setSubiendo] = useState('');
  const [aviso, setAviso] = useState('');

  const cargar = async () => {
    const r = await conToken(`/api/autos/${vehicleId}/documentos`);
    if (r.ok) setDocs((await r.json()).documentos || []);
    else { setAviso(await error(r)); setDocs([]); }
  };
  useEffect(() => { cargar(); }, [vehicleId]);

  const subir = async (archivos: FileList | null) => {
    if (!archivos?.length) return;
    setAviso('');
    const lista = Array.from(archivos);
    for (let i = 0; i < lista.length; i++) {
      const a = lista[i];
      if (a.size > MAX) { setAviso(`«${a.name}» pesa más de 20 MB.`); continue; }
      setSubiendo(`Subiendo ${i + 1} de ${lista.length}…`);
      const r = await conToken(`/api/autos/${vehicleId}/documentos`, {
        method: 'POST',
        headers: { 'Content-Type': a.type || 'application/octet-stream', 'X-Nombre': encodeURIComponent(a.name), 'X-Categoria': categoria },
        body: a,
      });
      if (!r.ok) setAviso(`«${a.name}»: ${await error(r)}`);
    }
    setSubiendo('');
    cargar();
  };

  const abrir = async (d: any) => {
    // Se abre la ventana antes de pedir el archivo: si se abre después, el
    // navegador la toma por ventana emergente y la bloquea.
    const ventana = window.open('', '_blank');
    const r = await conToken(`/api/autos/${vehicleId}/documentos/${d.id}`);
    if (!r.ok) { ventana?.close(); setAviso(await error(r)); return; }
    const url = URL.createObjectURL(await r.blob());
    if (ventana) ventana.location.href = url; else window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const quitar = async (d: any) => {
    if (!window.confirm(`¿Quitar el documento «${d.nombre}»? No se puede deshacer.`)) return;
    const r = await conToken(`/api/autos/${vehicleId}/documentos/${d.id}`, { method: 'DELETE' });
    if (!r.ok) setAviso(await error(r));
    cargar();
  };

  return (
    <section className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-sm font-extrabold flex items-center gap-1.5">Archivos del auto {docs && <span className="text-slate-500 font-semibold">{docs.length}</span>}</h2>
        <span className="text-[11px] text-slate-600 dark:text-slate-400 flex items-center gap-1"><Lock className="w-3 h-3" /> Solo administradores y gerentes de tu agencia</span>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <label className="flex flex-col gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-400 sm:w-56">Tipo de documento
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="px-2 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm font-normal text-slate-900 dark:text-slate-100">
            {CATEGORIAS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); subir(e.dataTransfer.files); }}
          className="flex-1 flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 px-3 py-3 cursor-pointer hover:border-blue-500 hover:bg-blue-50/40 dark:hover:bg-blue-950/20 text-sm font-bold text-slate-800 dark:text-slate-200"
        >
          <Upload className="w-4 h-4 text-slate-500" />
          {subiendo || 'Arrastra o elige PDF, fotos, Word o Excel (hasta 20 MB)'}
          <input type="file" multiple className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx,.xls,.xlsx,.txt" disabled={!!subiendo} onChange={(e) => { subir(e.target.files); e.target.value = ''; }} />
        </label>
      </div>

      {aviso && <p role="alert" className="text-xs font-semibold text-red-700 dark:text-red-400">{aviso}</p>}

      {docs === null ? (
        <p className="text-xs text-slate-500">Cargando…</p>
      ) : docs.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">Aún no hay documentos de este auto.</p>
      ) : (
        <ul className="flex flex-col">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center gap-2.5 py-2 border-t border-slate-100 dark:border-slate-700 first:border-t-0">
              <span className={clsx('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', d.tipo?.startsWith('image/') ? 'bg-purple-100 text-purple-800' : 'bg-red-100 text-red-800')}>
                {d.tipo?.startsWith('image/') ? <ImageIcon className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
              </span>
              <button type="button" onClick={() => abrir(d)} className="flex flex-col min-w-0 flex-1 text-left hover:underline">
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{d.nombre}</span>
                <span className="text-[11px] text-slate-600 dark:text-slate-400 truncate">{[d.categoria, tamano(d.tamano || 0), d.subidoPorNombre, cuando(d.creadoEl)].filter(Boolean).join(' · ')}</span>
              </button>
              <button type="button" aria-label={`Quitar ${d.nombre}`} onClick={() => quitar(d)} className="p-1.5 rounded text-slate-500 hover:text-red-700 hover:bg-slate-100 dark:hover:bg-slate-700"><Trash2 className="w-4 h-4" /></button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function NotasDelAuto({ vehicleId, compacto, onVerTodas }: { vehicleId: string; compacto?: boolean; onVerTodas?: () => void }) {
  const [notas, setNotas] = useState<any[] | null>(null);
  const [permiso, setPermiso] = useState<{ todas: boolean; yo: string }>({ todas: false, yo: '' });
  const [texto, setTexto] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState('');

  const cargar = async () => {
    const r = await conToken(`/api/autos/${vehicleId}/notas`);
    if (!r.ok) { setAviso(await error(r)); setNotas([]); return; }
    const d = await r.json();
    setNotas(d.notas || []);
    setPermiso({ todas: !!d.puedoBorrarTodas, yo: d.yo || '' });
  };
  useEffect(() => { cargar(); }, [vehicleId]);

  const agregar = async () => {
    if (!texto.trim()) return;
    setGuardando(true); setAviso('');
    const r = await conToken(`/api/autos/${vehicleId}/notas`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ texto }) });
    if (r.ok) { setTexto(''); cargar(); } else setAviso(await error(r));
    setGuardando(false);
  };

  const quitar = async (n: any) => {
    if (!window.confirm('¿Borrar esta nota?')) return;
    const r = await conToken(`/api/autos/${vehicleId}/notas/${n.id}`, { method: 'DELETE' });
    if (!r.ok) setAviso(await error(r));
    cargar();
  };

  const visibles = compacto ? (notas || []).slice(0, 2) : notas || [];

  return (
    <section className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-extrabold">Notas internas {notas && notas.length > 0 && <span className="text-slate-500 font-semibold">{notas.length}</span>}</h2>
        {compacto && notas && notas.length > 2 ? (
          <button type="button" onClick={onVerTodas} className="text-xs font-bold text-blue-700 hover:underline">Ver todas</button>
        ) : (
          <span className="text-[11px] text-slate-600 dark:text-slate-400">Solo tu agencia · no salen en la página</span>
        )}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); agregar(); }} className="flex gap-2 items-start">
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); agregar(); } }}
          rows={compacto ? 1 : 2}
          placeholder="Ej. trae golpe en la puerta trasera; el dueño acepta hasta $330,000…"
          aria-label="Nueva nota interna"
          className="flex-1 px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 resize-y"
        />
        <button type="submit" disabled={guardando || !texto.trim()} className="min-h-[38px] px-3 rounded-lg bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-sm font-bold">Anotar</button>
      </form>
      {aviso && <p role="alert" className="text-xs font-semibold text-red-700 dark:text-red-400">{aviso}</p>}
      {notas === null ? (
        <p className="text-xs text-slate-500">Cargando…</p>
      ) : notas.length === 0 ? (
        <p className="text-xs text-slate-600 dark:text-slate-400">Sin notas todavía.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visibles.map((n) => (
            <li key={n.id} className="group rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/40 px-3 py-2">
              <p className="text-sm text-slate-900 dark:text-slate-100 whitespace-pre-wrap break-words">{n.texto}</p>
              <div className="flex items-center justify-between gap-2 mt-1">
                <span className="text-[11px] text-slate-600 dark:text-slate-400">{[n.autorNombre, cuando(n.creadoEl)].filter(Boolean).join(' · ')}</span>
                {(permiso.todas || n.autorId === permiso.yo) && (
                  <button type="button" aria-label="Borrar nota" onClick={() => quitar(n)} className="p-1 rounded text-slate-500 hover:text-red-700 opacity-100 md:opacity-0 md:group-hover:opacity-100"><Trash2 className="w-3.5 h-3.5" /></button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
