import React, { useEffect, useState } from 'react';
import { ShoppingBag, Copy, Check, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { auth } from '../../lib/firebase';
import { getApiUrl } from '../../lib/api';

/**
 * «Catálogo para anuncios de Meta»: la agencia pega esta liga en el Commerce
 * Manager de Meta y sus autos se actualizan solos cada hora (/feed/meta/...).
 * No usa ninguna conexión con Facebook: Meta baja el archivo por su cuenta.
 */

type Liga = {
  url: string; total: number; direccionLista: boolean; ultimaLecturaAt: string | null;
  fuera: { sinFoto: number; sinKm: number; sinColor: number; sinPrecio: number; sinLiga: number };
};

async function llamar(ruta: string, metodo = 'GET') {
  const token = await auth.currentUser?.getIdToken();
  const r = await fetch(getApiUrl(ruta), { method: metodo, headers: { Authorization: `Bearer ${token}` } });
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

export function CatalogoMeta() {
  const [liga, setLiga] = useState<Liga | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => { llamar('/api/feed-meta/mi-liga').then(setLiga).catch((e) => setError(e.message)); }, []);

  if (!liga) return error ? <p className="text-sm text-red-600 mt-8 px-4 md:px-6 max-w-4xl mx-auto w-full">{error}</p> : null;

  const copiar = () => {
    navigator.clipboard?.writeText(liga.url);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1800);
  };
  const renovar = async () => {
    if (!window.confirm('Esto desactiva la liga actual: tu catálogo en Meta dejará de actualizarse hasta que pegues la nueva. ¿Continuar?')) return;
    setOcupado(true); setError('');
    try { setLiga(await llamar('/api/feed-meta/mi-liga/renovar', 'POST')); } catch (e: any) { setError(e.message); } finally { setOcupado(false); }
  };

  const leyendo = liga.ultimaLecturaAt && Date.now() - Date.parse(liga.ultimaLecturaAt) < 3 * 3600_000;
  const f = liga.fuera;
  const faltantes = [
    f.sinFoto && `${f.sinFoto} sin foto`,
    f.sinKm && `${f.sinKm} sin kilometraje`,
    f.sinColor && `${f.sinColor} sin color`,
    f.sinPrecio && `${f.sinPrecio} sin precio`,
    f.sinLiga && `${f.sinLiga} sin liga para ver el auto`,
  ].filter(Boolean) as string[];

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto w-full">
      <div className="bg-white dark:bg-slate-800 rounded shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-slate-700 flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded flex items-center justify-center shrink-0">
            <ShoppingBag className="w-6 h-6 text-blue-600" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Catálogo para anuncios de Meta</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Tu inventario listo para anunciar tus autos en Facebook e Instagram. Se actualiza solo: lo que vendes sale del catálogo.</p>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {liga.ultimaLecturaAt && (
            <div className={`rounded-lg border px-3 py-2 text-sm flex items-start gap-2 ${leyendo ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-200' : 'border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-200'}`}>
              {leyendo ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
              <span>Meta descargó tu catálogo <b>{hace(liga.ultimaLecturaAt)}</b>.{!leyendo && ' Hace rato que no lo descarga: revisa la fuente de datos en tu Commerce Manager.'}</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">Liga de tu catálogo</label>
            <div className="flex items-stretch gap-2">
              <code className="flex-1 min-w-0 break-all bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-3 py-2 text-xs">{liga.url}</code>
              <button onClick={copiar} className="px-3 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1">
                {copiado ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} Copiar
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Es privada: cualquiera que la tenga puede ver tu inventario público. No la compartas.</p>
          </div>

          <ol className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
            {[
              <>Entra al Administrador de comercio de Meta (Commerce Manager) y crea un catálogo de tipo <b>Vehículos</b>.</>,
              <>En tu catálogo abre <b>Fuentes de datos</b>, agrega una con <b>liga programada</b> y pega tu liga.</>,
              <>Elige que se actualice cada hora y guarda. Meta revisa tus autos y te avisa si a alguno le falta un dato.</>,
            ].map((p, i) => (
              <li key={i} className="flex gap-3 items-start">
                <span className="w-6 h-6 rounded-full bg-slate-900 dark:bg-white dark:text-slate-900 text-white text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                <span className="pt-0.5">{p}</span>
              </li>
            ))}
          </ol>

          <div className="rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 text-sm">
            <p className="font-semibold text-slate-800 dark:text-slate-200">Hoy entran {liga.total} {liga.total === 1 ? 'auto' : 'autos'} al catálogo.</p>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Entran los autos disponibles que tengan fotos, kilometraje, color, precio y una liga para verlos (la de su ficha o la de «Mi página web»).</p>
            {faltantes.length > 0 && <p className="text-amber-700 dark:text-amber-300 mt-1">Les falta algo: {faltantes.join(', ')}.</p>}
            {!liga.direccionLista && <p className="text-amber-700 dark:text-amber-300 mt-1">Para que Meta ubique tu lote, llena la dirección de tu agencia en Datos del negocio.</p>}
          </div>

          <div>
            <button disabled={ocupado} onClick={renovar} className="h-9 px-3 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-semibold flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50">
              <RefreshCw className="w-4 h-4" /> Crear liga nueva
            </button>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </div>
    </div>
  );
}
