import React, { useEffect, useState } from 'react';
import clsx from 'clsx';
import { Car as CarIcon, ChevronLeft, ChevronRight, Star, X, Maximize2 } from 'lucide-react';

/**
 * Fotos del auto: la grande, miniaturas para cambiarla, flechas del teclado y
 * pantalla completa. «Principal» manda la foto al primer lugar (la portada en
 * el inventario y en la página Nextcar).
 */
export function Galeria({
  fotos, titulo, puedeOrdenar, onHacerPortada, cuadricula,
}: {
  fotos: string[];
  titulo: string;
  puedeOrdenar: boolean;
  onHacerPortada: (indice: number) => void;
  /** Sección «Fotos»: todas en cuadrícula. */
  cuadricula?: boolean;
}) {
  const [actual, setActual] = useState(0);
  const [completa, setCompleta] = useState(false);
  const total = fotos.length;

  useEffect(() => { if (actual >= total) setActual(0); }, [total, actual]);

  const mover = (paso: number) => total && setActual((a) => (a + paso + total) % total);

  useEffect(() => {
    if (!completa) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCompleta(false);
      if (e.key === 'ArrowRight') mover(1);
      if (e.key === 'ArrowLeft') mover(-1);
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [completa, total]);

  if (!total) {
    return (
      <div className="aspect-[16/9] rounded-lg bg-slate-100 dark:bg-slate-700 flex flex-col items-center justify-center text-slate-400 gap-2">
        <CarIcon className="w-14 h-14" />
        <span className="text-sm">Sin fotos todavía</span>
      </div>
    );
  }

  const miniatura = (url: string, i: number, grande = false) => (
    <div key={url + i} className="relative group">
      <button
        type="button"
        onClick={() => { setActual(i); if (cuadricula) setCompleta(true); }}
        aria-label={`Foto ${i + 1}`}
        className={clsx(
          'block w-full overflow-hidden rounded-md border-2 bg-slate-100 dark:bg-slate-700',
          grande ? 'aspect-[4/3]' : 'aspect-[4/3]',
          i === actual && !cuadricula ? 'border-blue-600' : 'border-transparent hover:border-slate-300'
        )}
      >
        <img src={url} alt="" loading="lazy" className="w-full h-full object-cover" />
      </button>
      {i === 0 ? (
        <span className="absolute top-1 left-1 bg-black/70 text-white text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 pointer-events-none">
          <Star className="w-2.5 h-2.5" /> Portada
        </span>
      ) : puedeOrdenar && (
        <button
          type="button"
          onClick={() => onHacerPortada(i)}
          className="absolute bottom-1 left-1 bg-black/70 hover:bg-black text-white text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100"
        >
          <Star className="w-2.5 h-2.5" /> Portada
        </button>
      )}
    </div>
  );

  return (
    <>
      {cuadricula ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">{fotos.map((u, i) => miniatura(u, i, true))}</div>
      ) : (
        <div className="flex flex-col gap-2">
          <div
            className="relative aspect-[16/9] rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-700 group outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') mover(1);
              if (e.key === 'ArrowLeft') mover(-1);
              if (e.key === 'Enter') setCompleta(true);
            }}
          >
            <img src={fotos[actual]} alt={titulo} className="w-full h-full object-cover" />
            {total > 1 && (
              <>
                <button type="button" onClick={() => mover(-1)} aria-label="Foto anterior" className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 text-slate-900 shadow flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><ChevronLeft className="w-5 h-5" /></button>
                <button type="button" onClick={() => mover(1)} aria-label="Foto siguiente" className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 text-slate-900 shadow flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><ChevronRight className="w-5 h-5" /></button>
              </>
            )}
            <button type="button" onClick={() => setCompleta(true)} aria-label="Ver en pantalla completa" className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Maximize2 className="w-4 h-4" /></button>
            <span className="absolute bottom-2 right-2 bg-black/70 text-white text-xs font-bold px-2.5 py-1 rounded-full">{actual + 1} de {total}</span>
          </div>
          {total > 1 && <div className="grid grid-cols-6 gap-1.5">{fotos.slice(0, 6).map((u, i) => miniatura(u, i))}</div>}
          {total > 6 && <span className="text-xs text-slate-600 dark:text-slate-400">y {total - 6} fotos más — míralas en «Fotos»</span>}
        </div>
      )}

      {completa && (
        <div className="fixed inset-0 z-[80] bg-black/95 flex flex-col" onClick={() => setCompleta(false)}>
          <div className="flex justify-between items-center p-3 text-white">
            <span className="text-sm font-semibold">{titulo} · {actual + 1} de {total}</span>
            <button type="button" onClick={() => setCompleta(false)} aria-label="Cerrar" className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center"><X className="w-6 h-6" /></button>
          </div>
          <div className="flex-1 flex items-center justify-center relative min-h-0 px-14" onClick={(e) => e.stopPropagation()}>
            <img src={fotos[actual]} alt={titulo} className="max-w-full max-h-full object-contain" />
            {total > 1 && (
              <>
                <button type="button" onClick={() => mover(-1)} aria-label="Foto anterior" className="absolute left-3 w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center"><ChevronLeft className="w-6 h-6" /></button>
                <button type="button" onClick={() => mover(1)} aria-label="Foto siguiente" className="absolute right-3 w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center"><ChevronRight className="w-6 h-6" /></button>
              </>
            )}
          </div>
          <div className="flex gap-1.5 justify-center p-3 overflow-x-auto" onClick={(e) => e.stopPropagation()}>
            {fotos.map((u, i) => (
              <button key={u + i} type="button" onClick={() => setActual(i)} aria-label={`Foto ${i + 1}`} className={clsx('w-16 h-12 shrink-0 rounded overflow-hidden border-2', i === actual ? 'border-white' : 'border-transparent opacity-60 hover:opacity-100')}>
                <img src={u} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
