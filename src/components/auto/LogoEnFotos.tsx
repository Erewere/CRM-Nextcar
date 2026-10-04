import React, { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { X } from 'lucide-react';
import { aDataUrl, cargar } from '../../lib/fichaPdf';
import { dibujarLogo, prepararLogo, type ConfigLogoFotos, type PosicionLogo, type TamanoLogo } from '../../lib/logoEnFoto';

/**
 * Ajuste del logo en las fotos, con vista previa sobre una foto real del
 * auto. Lo guarda quien llama (en el documento de la agencia).
 */

const POSICIONES: [PosicionLogo, string][] = [
  ['arriba-izquierda', 'Arriba izq.'], ['arriba-derecha', 'Arriba der.'], ['centro', 'Centro'],
  ['abajo-izquierda', 'Abajo izq.'], ['abajo-derecha', 'Abajo der.'],
];
const TAMANOS: [TamanoLogo, string][] = [['chico', 'Chico'], ['mediano', 'Mediano'], ['grande', 'Grande']];

export function AjusteLogoEnFotos({ inicial, logoUrl, fotoMuestra, onGuardar, onCerrar }: {
  inicial: ConfigLogoFotos;
  logoUrl?: string;
  fotoMuestra?: string;
  onGuardar: (c: ConfigLogoFotos) => Promise<void>;
  onCerrar: () => void;
}) {
  const [c, setC] = useState<ConfigLogoFotos>(inicial);
  const [guardando, setGuardando] = useState(false);
  const [foto, setFoto] = useState<HTMLImageElement | null>(null);
  const [logo, setLogo] = useState<HTMLImageElement | null>(null);
  const lienzo = useRef<HTMLCanvasElement>(null);

  useEffect(() => { (async () => setFoto(await cargar(await aDataUrl(fotoMuestra))))(); }, [fotoMuestra]);
  useEffect(() => { (async () => setLogo(await prepararLogo(logoUrl, c.sinFondo)))(); }, [logoUrl, c.sinFondo]);

  useEffect(() => {
    const cv = lienzo.current;
    if (!cv) return;
    const W = 960, H = foto ? Math.round(960 * foto.height / foto.width) : 640;
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d')!;
    if (foto) ctx.drawImage(foto, 0, 0, W, H);
    else { ctx.fillStyle = '#94a3b8'; ctx.fillRect(0, 0, W, H); }
    if (logo) dibujarLogo(ctx, W, H, logo, c);
  }, [foto, logo, c]);

  const guardar = async () => {
    setGuardando(true);
    try { await onGuardar(c); onCerrar(); } catch (e: any) { alert(`No se pudo guardar. ${e?.message || ''}`); } finally { setGuardando(false); }
  };

  const boton = (activo: boolean) => clsx('px-2.5 py-1.5 rounded-lg text-xs font-bold border',
    activo ? 'bg-blue-700 border-blue-700 text-white' : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50');

  return (
    <div className="fixed inset-0 z-[110] flex items-stretch md:items-center justify-center md:p-4" role="dialog" aria-modal="true" aria-labelledby="titulo-logo-fotos">
      <div className="absolute inset-0 bg-slate-900/60" onClick={guardando ? undefined : onCerrar} />
      <div className="relative bg-white dark:bg-slate-800 md:rounded-2xl shadow-2xl w-full max-w-4xl md:max-h-[94vh] flex flex-col">
        <div className="flex items-start justify-between gap-3 p-4 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 id="titulo-logo-fotos" className="text-lg font-extrabold text-slate-900 dark:text-white">Logo en las fotos</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">Aplica a toda la agencia: cada foto que se suba llevará el logo así.</p>
          </div>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 grid md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-5">
          <div className="flex flex-col gap-2">
            <canvas ref={lienzo} className={clsx('w-full rounded-xl bg-slate-200', !c.activo && 'opacity-60')} aria-label="Vista previa" />
            {!logoUrl && <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Tu agencia no tiene logo cargado: súbelo en los datos de la agencia.</p>}
          </div>
          <div className="flex flex-col gap-4">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" checked={c.activo} onChange={(e) => setC({ ...c, activo: e.target.checked })} className="w-5 h-5 accent-blue-700" />
              <span className="text-sm font-extrabold text-slate-900 dark:text-white">Poner el logo en las fotos nuevas</span>
            </label>
            <div className={clsx('flex flex-col gap-4', !c.activo && 'opacity-50 pointer-events-none')}>
              <div>
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Dónde</p>
                <div className="flex flex-wrap gap-1.5">{POSICIONES.map(([v, t]) => <button key={v} type="button" onClick={() => setC({ ...c, posicion: v })} className={boton(c.posicion === v)}>{t}</button>)}</div>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Tamaño</p>
                <div className="flex flex-wrap gap-1.5">{TAMANOS.map(([v, t]) => <button key={v} type="button" onClick={() => setC({ ...c, tamano: v })} className={boton(c.tamano === v)}>{t}</button>)}</div>
              </div>
              <label className="flex flex-col gap-1 text-xs font-bold text-slate-700 dark:text-slate-300">
                Transparencia: {Math.round((1 - c.opacidad) * 100)}%
                <input type="range" min={30} max={100} step={5} value={Math.round(c.opacidad * 100)} onChange={(e) => setC({ ...c, opacidad: Number(e.target.value) / 100 })} className="accent-blue-700" />
              </label>
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input type="checkbox" checked={c.sinFondo} onChange={(e) => setC({ ...c, sinFondo: e.target.checked })} className="mt-0.5 w-4 h-4 accent-blue-700" />
                <span className="flex flex-col"><span className="text-sm font-semibold text-slate-800 dark:text-slate-200">Quitar el fondo claro del logo</span><span className="text-xs text-slate-600 dark:text-slate-400">Si tu logo trae fondo blanco o gris. Revisa la vista previa: si el logo tiene partes blancas, también se quitan.</span></span>
              </label>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">Las fotos que ya están no cambian solas: en cada auto hay un botón para ponerles el logo.</p>
          </div>
        </div>
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2">
          <button type="button" onClick={onCerrar} disabled={guardando} className="min-h-[40px] px-4 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700">Cancelar</button>
          <button type="button" onClick={guardar} disabled={guardando} className="min-h-[40px] px-4 rounded-lg bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-sm font-bold">{guardando ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  );
}
