import React, { useState } from 'react';
import clsx from 'clsx';
import { FileText, X } from 'lucide-react';

/**
 * Antes de hacer la ficha en PDF: qué 3 fotos lleva. La primera que se elige
 * es la grande; las otras dos van a la derecha. Por omisión, las que se
 * eligieron la última vez para este auto, o sus primeras tres.
 */
export const MAX_FOTOS_FICHA = 3;

export function fotosInicialesDeFicha(fotos: string[], guardadas?: string[]) {
  const validas = (guardadas || []).filter((u) => fotos.includes(u)).slice(0, MAX_FOTOS_FICHA);
  return validas.length ? validas : fotos.slice(0, MAX_FOTOS_FICHA);
}

export function ElegirFotosFicha({ fotos, inicial, puedeRecordar, generando, onCancelar, onGenerar }: {
  fotos: string[];
  inicial: string[];
  puedeRecordar: boolean;
  generando: boolean;
  onCancelar: () => void;
  onGenerar: (elegidas: string[], recordar: boolean) => void;
}) {
  const [elegidas, setElegidas] = useState<string[]>(inicial);
  const [recordar, setRecordar] = useState(true);
  const [aviso, setAviso] = useState('');

  const tocar = (u: string) => {
    setAviso('');
    setElegidas((prev) => {
      if (prev.includes(u)) return prev.filter((x) => x !== u);
      if (prev.length >= MAX_FOTOS_FICHA) { setAviso(`Van ${MAX_FOTOS_FICHA} fotos como máximo: quita una para elegir otra.`); return prev; }
      return [...prev, u];
    });
  };

  const etiqueta = (i: number) => (i === 0 ? 'Principal' : `Foto ${i + 1}`);

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-3" role="dialog" aria-modal="true" aria-labelledby="titulo-fotos-ficha">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onCancelar} />
      <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between gap-3 p-4 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 id="titulo-fotos-ficha" className="text-lg font-extrabold text-slate-900 dark:text-white">Fotos de la ficha</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">Elige hasta {MAX_FOTOS_FICHA}, en orden: la primera que toques va en grande. Toca otra vez para quitarla.</p>
          </div>
          <button type="button" onClick={onCancelar} aria-label="Cerrar" className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
          {fotos.map((u, i) => {
            const orden = elegidas.indexOf(u);
            const activa = orden >= 0;
            return (
              <button
                key={u + i}
                type="button"
                onClick={() => tocar(u)}
                aria-pressed={activa}
                aria-label={activa ? `Quitar foto ${i + 1} (${etiqueta(orden)})` : `Elegir foto ${i + 1}`}
                className={clsx('relative aspect-[4/3] rounded-lg overflow-hidden border-[3px] bg-slate-100 dark:bg-slate-700 transition-all',
                  activa ? 'border-blue-600 ring-2 ring-blue-200 dark:ring-blue-900' : 'border-transparent opacity-80 hover:opacity-100 hover:border-slate-300')}
              >
                <img src={u} alt="" loading="lazy" className="w-full h-full object-cover" />
                {activa && (
                  <span className="absolute top-1.5 left-1.5 flex items-center gap-1 bg-blue-700 text-white text-[11px] font-extrabold pl-1 pr-2 py-0.5 rounded-full shadow">
                    <span className="w-5 h-5 rounded-full bg-white text-blue-800 flex items-center justify-center">{orden + 1}</span>
                    {etiqueta(orden)}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            {aviso ? <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">{aviso}</span>
              : <span className="text-xs text-slate-600 dark:text-slate-400">{elegidas.length} de {MAX_FOTOS_FICHA} elegidas</span>}
            {puedeRecordar && (
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                <input type="checkbox" checked={recordar} onChange={(e) => setRecordar(e.target.checked)} className="w-4 h-4 accent-blue-700" />
                Recordar estas fotos para la ficha de este auto
              </label>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setElegidas(fotos.slice(0, MAX_FOTOS_FICHA))} className="min-h-[40px] px-3 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700">Usar las primeras</button>
            <button
              type="button"
              disabled={!elegidas.length || generando}
              onClick={() => onGenerar(elegidas, puedeRecordar && recordar)}
              className="min-h-[40px] px-4 rounded-lg bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-sm font-bold flex items-center gap-1.5"
            >
              <FileText className="w-4 h-4" /> {generando ? 'Preparando…' : 'Hacer ficha'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
