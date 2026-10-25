import React, { useEffect, useState } from 'react';
import { Facebook, Instagram, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { auth } from '../../lib/firebase';
import { getApiUrl } from '../../lib/api';

// «Conectar Facebook e Instagram»: la agencia enlaza su página con unos clics, sin pegar tokens.
// El servidor hace el trabajo (ver src/servidor/conectarRedes.ts); aquí solo el botón, la lista cuando hay varias
// páginas y el estado de lo ya conectado.

export function ConectarRedes() {
  const [estado, setEstado] = useState<any>(null);
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [lista, setLista] = useState<{ c: string; paginas: any[] } | null>(null);

  const pedir = async (ruta: string, cuerpo?: any) => {
    const token = await auth.currentUser?.getIdToken();
    const r = await fetch(getApiUrl(ruta), {
      method: cuerpo ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${token}`, ...(cuerpo ? { 'Content-Type': 'application/json' } : {}) },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(d.error || 'No se pudo completar.'), { status: r.status });
    return d;
  };

  const recargar = () => pedir('/api/redes/conectar/estado').then(setEstado).catch(() => setEstado(null)).finally(() => setCargando(false));

  useEffect(() => {
    // Al volver de Meta la liga trae ?redes=ok | elegir&c=… | error&m=…
    const p = new URLSearchParams(window.location.search);
    const r = p.get('redes');
    if (r) {
      window.history.replaceState({}, '', window.location.pathname);
      if (r === 'ok') setAviso({ tipo: 'ok', texto: 'Listo: tu página de Facebook y tu Instagram quedaron conectados.' });
      else if (r === 'error') setAviso({ tipo: 'error', texto: p.get('m') || 'No se pudo conectar.' });
      else if (r === 'elegir' && p.get('c')) {
        const c = p.get('c') as string;
        pedir(`/api/redes/conectar/paginas?c=${encodeURIComponent(c)}`).then((d) => setLista({ c, paginas: d.paginas || [] })).catch((e) => setAviso({ tipo: 'error', texto: e.message }));
      }
    }
    recargar();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const conectar = async () => {
    setOcupado(true); setAviso(null);
    try { const d = await pedir('/api/redes/conectar/iniciar', {}); window.location.href = d.url; }
    catch (e: any) { setAviso({ tipo: 'error', texto: e.message }); setOcupado(false); }
  };
  const elegir = async (pageId: string) => {
    if (!lista) return;
    setOcupado(true);
    try { await pedir('/api/redes/conectar/elegir', { c: lista.c, pageId }); setLista(null); setAviso({ tipo: 'ok', texto: 'Listo: tu página quedó conectada.' }); await recargar(); }
    catch (e: any) { setAviso({ tipo: 'error', texto: e.message }); }
    finally { setOcupado(false); }
  };
  const desconectar = async () => {
    if (!window.confirm('¿Desconectar Facebook e Instagram? Ya no se podrá publicar desde el CRM ni contestar Messenger hasta volver a conectarlos.')) return;
    setOcupado(true);
    try { await pedir('/api/redes/conectar/desconectar', {}); await recargar(); } catch (e: any) { setAviso({ tipo: 'error', texto: e.message }); } finally { setOcupado(false); }
  };

  if (!cargando && !estado) return null; // sin permiso (no es administrador ni gerente)
  const conectada = !!estado?.hayToken && !!estado?.paginaId;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto w-full">
      <div className="bg-white dark:bg-slate-800 rounded shadow-sm border border-gray-200 dark:border-slate-700 p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded flex items-center justify-center shrink-0">
            <Facebook className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">Facebook e Instagram <Instagram className="w-4 h-4 text-pink-500" /></h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Publica tus autos en tu página y en tu Instagram desde el CRM. Solo tienes que iniciar sesión en Facebook y elegir tu página.</p>

            {cargando ? (
              <p className="mt-4 text-sm text-slate-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Revisando…</p>
            ) : lista ? (
              <div className="mt-4">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">Administras varias páginas. ¿Cuál es la de tu agencia?</p>
                <div className="space-y-2">
                  {lista.paginas.map((p) => (
                    <button key={p.id} disabled={ocupado} onClick={() => elegir(p.id)} className="w-full text-left px-4 py-3 rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-60">
                      <span className="font-semibold text-slate-900 dark:text-white">{p.nombre}</span>
                      <span className="block text-xs text-slate-500">{p.instagram ? `Instagram @${p.instagram}` : 'Sin Instagram vinculado'}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : conectada ? (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="w-4 h-4" /> Conectado{estado.pagina ? `: ${estado.pagina}` : ''}{estado.instagram ? ` · @${estado.instagram}` : ''}</span>
                <button onClick={conectar} disabled={ocupado} className="text-sm font-semibold text-blue-600 hover:underline disabled:opacity-60">Volver a conectar</button>
                <button onClick={desconectar} disabled={ocupado} className="text-sm text-slate-500 hover:text-red-600 disabled:opacity-60">Desconectar</button>
              </div>
            ) : (
              <div className="mt-4">
                <button onClick={conectar} disabled={ocupado} className="inline-flex items-center gap-2 px-4 py-2 rounded bg-[#1877F2] text-white text-sm font-bold hover:bg-[#166fe0] disabled:opacity-60">
                  {ocupado ? <Loader2 className="w-4 h-4 animate-spin" /> : <Facebook className="w-4 h-4" />} Conectar Facebook e Instagram
                </button>
                {estado && !estado.configurado && <p className="mt-2 text-xs text-amber-600">Falta activar esta conexión en el servidor (META_APP_SECRET).</p>}
                <p className="mt-2 text-xs text-slate-500">Tu Instagram debe ser cuenta profesional y estar vinculado a la página de Facebook.</p>
              </div>
            )}

            {aviso && (
              <p className={`mt-3 text-sm flex items-start gap-2 ${aviso.tipo === 'ok' ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600'}`}>
                {aviso.tipo === 'ok' ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />} {aviso.texto}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
