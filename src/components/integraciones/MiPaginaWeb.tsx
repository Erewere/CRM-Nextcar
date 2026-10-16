import React, { useEffect, useState } from 'react';
import { Globe, Copy, Check, KeyRound, RefreshCw, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import { auth } from '../../lib/firebase';
import { getApiUrl } from '../../lib/api';

/**
 * «Mi página web»: la agencia que tiene su propia página la conecta aquí. El
 * CRM le da una llave privada; con ella la página pide SOLO los autos de esta
 * agencia (/api/public/v1/catalogo-web). La llave se ve una sola vez.
 */

type Conexion = {
  agencyId: string; url: string; soloMarcados: boolean; tieneLlave: boolean; llavePrefijo: string;
  llaveCreadaAt: string | null; ultimaLecturaAt: string | null; ultimaLecturaTotal: number;
};

async function llamar(ruta: string, metodo = 'GET', cuerpo?: unknown) {
  const token = await auth.currentUser?.getIdToken();
  const r = await fetch(getApiUrl(ruta), {
    method: metodo,
    headers: { Authorization: `Bearer ${token}`, ...(cuerpo ? { 'Content-Type': 'application/json' } : {}) },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'No se pudo completar.');
  return d;
}

const hace = (iso: string | null) => {
  if (!iso) return '';
  const min = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (min < 2) return 'hace un momento';
  if (min < 60) return `hace ${min} min`;
  if (min < 1440) return `hace ${Math.round(min / 60)} h`;
  return `hace ${Math.round(min / 1440)} días`;
};

export function MiPaginaWeb() {
  const [c, setC] = useState<Conexion | null>(null);
  const [url, setUrl] = useState('');
  const [soloMarcados, setSoloMarcados] = useState(false);
  const [llaveNueva, setLlaveNueva] = useState('');
  const [copiado, setCopiado] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [guardado, setGuardado] = useState(false);

  const cargar = () => llamar('/api/pagina/mi-conexion').then((d: Conexion) => { setC(d); setUrl(d.url); setSoloMarcados(d.soloMarcados); }).catch((e) => setError(e.message));
  useEffect(() => { cargar(); }, []);

  const copiar = (clave: string, texto: string) => {
    navigator.clipboard?.writeText(texto);
    setCopiado(clave);
    setTimeout(() => setCopiado(''), 1800);
  };
  const correr = async (f: () => Promise<void>) => {
    setOcupado(true); setError('');
    try { await f(); } catch (e: any) { setError(e.message); } finally { setOcupado(false); }
  };

  if (!c) return error ? <p className="text-sm text-red-600 mt-8">{error}</p> : null;

  const feed = `${window.location.origin}/api/public/v1/catalogo-web`;
  const leyendo = c.ultimaLecturaAt && Date.now() - Date.parse(c.ultimaLecturaAt) < 3 * 3600_000;

  return (
    <div className="bg-white dark:bg-slate-800 rounded shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden mt-8">
      <div className="p-6 border-b border-gray-200 dark:border-slate-700 flex items-center gap-4">
        <div className="w-12 h-12 bg-sky-100 dark:bg-sky-900/30 rounded flex items-center justify-center shrink-0">
          <Globe className="w-6 h-6 text-sky-600" />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Mi página web</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Si tu agencia tiene su propia página, conéctala y tus autos se publican solos desde el inventario.</p>
        </div>
      </div>

      <div className="p-6 space-y-5">
        {c.tieneLlave && (
          <div className={`rounded-lg border px-3 py-2 text-sm flex items-start gap-2 ${leyendo ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-200' : 'border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-200'}`}>
            {leyendo ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
            <span>
              {c.ultimaLecturaAt
                ? <>Tu página consultó el inventario <b>{hace(c.ultimaLecturaAt)}</b> ({c.ultimaLecturaTotal} {c.ultimaLecturaTotal === 1 ? 'auto' : 'autos'}).{!leyendo && ' Hace rato que no lo consulta: pide a quien te hizo la página que revise la conexión.'}</>
                : <>La llave está lista, pero tu página todavía no ha consultado el inventario. Entrega la llave a quien administra tu página.</>}
            </span>
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">Dirección de tu página</label>
          <input
            value={url}
            onChange={(e) => { setUrl(e.target.value); setGuardado(false); }}
            placeholder="https://tuagencia.com"
            className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm"
          />
        </div>

        <label className="flex items-start gap-3 text-sm cursor-pointer">
          <input type="checkbox" checked={soloMarcados} onChange={(e) => { setSoloMarcados(e.target.checked); setGuardado(false); }} className="mt-1 h-4 w-4" />
          <span>
            <b className="text-slate-800 dark:text-slate-200">Publicar solo los autos que yo marque</b>
            <span className="block text-slate-500 dark:text-slate-400">Apagado: tu página muestra todo tu inventario disponible con foto. Encendido: solo los autos con «Publicar en la página» activado.</span>
          </span>
        </label>

        <div className="flex items-center gap-3">
          <button
            disabled={ocupado}
            onClick={() => correr(async () => { const d = await llamar('/api/pagina/mi-conexion', 'PUT', { url, soloMarcados }); setC(d); setGuardado(true); })}
            className="h-10 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 text-white text-sm font-bold disabled:opacity-50"
          >Guardar</button>
          {guardado && <span className="text-sm text-emerald-600 flex items-center gap-1"><Check className="w-4 h-4" /> Guardado</span>}
        </div>

        <div className="border-t border-slate-200 dark:border-slate-700 pt-5">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2"><KeyRound className="w-4 h-4" /> Llave de conexión</p>
          {llaveNueva ? (
            <div className="mt-3 rounded-lg border border-sky-300 bg-sky-50 dark:bg-sky-950/30 dark:border-sky-800 p-4">
              <p className="text-sm text-sky-900 dark:text-sky-200 font-semibold">Copia tu llave ahora: no se vuelve a mostrar.</p>
              <div className="mt-2 flex items-stretch gap-2">
                <code className="flex-1 min-w-0 break-all bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-3 py-2 text-xs">{llaveNueva}</code>
                <button onClick={() => copiar('llave', llaveNueva)} className="h-auto px-3 rounded bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold flex items-center gap-1">
                  {copiado === 'llave' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} Copiar
                </button>
              </div>
            </div>
          ) : c.tieneLlave ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Llave activa que termina en <code className="bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded">…{c.llavePrefijo}</code>{c.llaveCreadaAt ? `, creada ${hace(c.llaveCreadaAt)}` : ''}.</p>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Aún no tienes llave. Créala y dásela a quien administra tu página.</p>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              disabled={ocupado}
              onClick={() => {
                if (c.tieneLlave && !window.confirm('Esto desactiva la llave actual: tu página dejará de actualizarse hasta que le pongas la nueva. ¿Continuar?')) return;
                correr(async () => { const d = await llamar('/api/pagina/mi-conexion/llave', 'POST'); setLlaveNueva(d.llave); await cargar(); });
              }}
              className="h-9 px-3 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-semibold flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
            >
              <RefreshCw className="w-4 h-4" /> {c.tieneLlave ? 'Crear llave nueva' : 'Crear llave'}
            </button>
            {c.tieneLlave && (
              <button
                disabled={ocupado}
                onClick={() => {
                  if (!window.confirm('Tu página dejará de recibir autos del CRM. ¿Quitar la llave?')) return;
                  correr(async () => { await llamar('/api/pagina/mi-conexion/llave', 'DELETE'); setLlaveNueva(''); await cargar(); });
                }}
                className="h-9 px-3 rounded-lg border border-red-200 text-red-600 text-sm font-semibold flex items-center gap-2 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30 disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" /> Quitar llave
              </button>
            )}
          </div>
        </div>

        <div className="border-t border-slate-200 dark:border-slate-700 pt-5">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Para quien administra tu página</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">La página pide el inventario con la llave en el encabezado <code>X-Pagina-Llave</code>. Tu <b>ID de agencia</b> para los prospectos es:</p>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <code className="bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded text-sm">{c.agencyId}</code>
            <button onClick={() => copiar('id', c.agencyId)} className="text-xs text-sky-600 font-semibold flex items-center gap-1">{copiado === 'id' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} Copiar</button>
          </div>
          <div className="mt-3 bg-slate-800 text-slate-300 p-3 rounded text-xs font-mono overflow-x-auto">
            curl -H "X-Pagina-Llave: TU_LLAVE" {feed}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Solo salen autos disponibles, apartados y vendidos recientes, con foto, y nunca costos, compradores ni notas internas.</p>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
