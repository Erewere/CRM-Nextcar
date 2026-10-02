import React, { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { Check, Copy, Download, Share2, X } from 'lucide-react';
import type { Vehicle } from '../../types';
import { generarImagenRed, textoParaPublicacion, type FormatoRed, type OpcionesRed } from '../../lib/imagenesRedes';

/**
 * Imágenes para redes: cuadrada (publicación / Marketplace) y vertical
 * (historias / estados). Se arman en el navegador con la foto, el precio, el
 * logo y el WhatsApp; no se guarda nada ni se manda a ningún lado.
 */

const ETIQUETAS = ['', '¡Recién llegado!', '¡Precio rebajado!', '¡Oferta!', 'Único dueño', 'A crédito'];
const enTelefono = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));

export function ImagenesRedes({ auto, fotos, agencia, telefonoAsesor, onCerrar }: {
  auto: Vehicle;
  fotos: string[];
  agencia: any;
  telefonoAsesor?: string;
  onCerrar: () => void;
}) {
  const telAgencia = agencia?.phoneWhatsApp || agencia?.phone || '';
  const [formato, setFormato] = useState<FormatoRed>('cuadrada');
  // En orden: la primera es la principal; en la vertical van hasta 2 más abajo.
  const [elegidas, setElegidas] = useState<string[]>(fotos.slice(0, 3));
  const principal = elegidas[0] || fotos[0] || '';
  const extras = useMemo(() => elegidas.slice(1, 3), [elegidas]);
  const [etiqueta, setEtiqueta] = useState(Number(auto.fichaWeb?.precioAnterior) > Number(auto.price) ? '¡Precio rebajado!' : '');
  const [conEnganche, setConEnganche] = useState(true);
  const [telefono, setTelefono] = useState(telefonoAsesor || telAgencia);
  const [vista, setVista] = useState('');
  const [armando, setArmando] = useState(false);
  const [error, setError] = useState('');
  const [copiado, setCopiado] = useState(false);
  const blobRef = useRef<Blob | null>(null);

  const opciones: OpcionesRed = useMemo(() => ({
    auto, foto: principal, fotosExtra: extras, agencia, telefono, etiqueta, conEnganche,
  }), [auto, principal, extras, agencia, telefono, etiqueta, conEnganche]);
  const texto = useMemo(() => textoParaPublicacion(opciones), [opciones]);

  // Se vuelve a armar la vista previa cada vez que cambia algo (con una pausa corta al escribir).
  useEffect(() => {
    let vigente = true;
    setArmando(true); setError('');
    const t = setTimeout(async () => {
      try {
        const b = await generarImagenRed(formato, opciones);
        if (!vigente) return;
        blobRef.current = b;
        setVista((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(b); });
      } catch {
        if (vigente) setError('No se pudo armar la imagen. Intenta de nuevo.');
      } finally {
        if (vigente) setArmando(false);
      }
    }, 250);
    return () => { vigente = false; clearTimeout(t); };
  }, [formato, opciones]);

  useEffect(() => () => { if (vista) URL.revokeObjectURL(vista); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const nombre = `${[auto.year, auto.make, auto.model].filter(Boolean).join('-')}-${formato}.jpg`.replace(/\s+/g, '-');

  const descargar = () => {
    if (!blobRef.current) return;
    const url = URL.createObjectURL(blobRef.current);
    const a = document.createElement('a');
    a.href = url; a.download = nombre;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const compartir = async () => {
    if (!blobRef.current) return;
    const archivo = new File([blobRef.current], nombre, { type: 'image/jpeg' });
    if (navigator.share && navigator.canShare?.({ files: [archivo] })) {
      try { await copiarTexto(); await navigator.share({ files: [archivo], text: texto }); return; } catch { /* lo cerraron */ return; }
    }
    descargar();
  };

  const copiarTexto = async () => {
    try { await navigator.clipboard.writeText(texto); setCopiado(true); setTimeout(() => setCopiado(false), 2500); } catch { /* sin permiso */ }
  };

  const tocarFoto = (u: string) => {
    // Cuadrada: la que se toca pasa a ser la principal.
    if (formato === 'cuadrada') { setElegidas((e) => [u, ...e.filter((x) => x !== u)].slice(0, 3)); return; }
    // Vertical: se eligen en orden, hasta 3; tocar otra vez la quita (siempre queda una).
    setElegidas((e) => (e.includes(u) ? (e.length > 1 ? e.filter((x) => x !== u) : e) : e.length < 3 ? [...e, u] : e));
  };

  const boton = 'min-h-[40px] px-3 rounded-lg text-sm font-bold flex items-center justify-center gap-1.5';

  return (
    <div className="fixed inset-0 z-[110] flex items-stretch md:items-center justify-center md:p-4" role="dialog" aria-modal="true" aria-labelledby="titulo-redes">
      <div className="absolute inset-0 bg-slate-900/60" onClick={onCerrar} />
      <div className="relative bg-white dark:bg-slate-800 md:rounded-2xl shadow-2xl w-full max-w-5xl md:max-h-[92vh] flex flex-col">
        <div className="flex items-start justify-between gap-3 p-4 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 id="titulo-redes" className="text-lg font-extrabold text-slate-900 dark:text-white">Imágenes para redes</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">Lista para Facebook, Instagram, Marketplace o tu estado de WhatsApp.</p>
          </div>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-5 p-4">
          {/* Vista previa */}
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-900">
              {([['cuadrada', 'Cuadrada', 'Publicación · Marketplace'], ['vertical', 'Vertical', 'Historia · Estado']] as const).map(([v, t, sub]) => (
                <button key={v} type="button" onClick={() => setFormato(v)} aria-pressed={formato === v}
                  className={clsx('rounded-lg py-1.5 text-sm font-bold leading-tight', formato === v ? 'bg-white dark:bg-slate-700 shadow text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400')}>
                  {t}<span className="block text-[11px] font-medium opacity-80">{sub}</span>
                </button>
              ))}
            </div>
            <div className={clsx('relative mx-auto w-full rounded-xl overflow-hidden bg-slate-900', formato === 'cuadrada' ? 'aspect-square max-w-[460px]' : 'aspect-[9/16] max-w-[290px]')}>
              {vista && <img src={vista} alt="Vista previa de la imagen" className="w-full h-full object-contain" />}
              {armando && <div className="absolute inset-0 flex items-center justify-center bg-slate-900/40 text-white text-sm font-semibold">Armando…</div>}
              {!fotos.length && <div className="absolute inset-0 flex items-center justify-center text-slate-300 text-sm p-6 text-center">Este auto no tiene fotos todavía.</div>}
            </div>
            {error && <p className="text-sm font-semibold text-red-700 dark:text-red-400">{error}</p>}
          </div>

          {/* Opciones */}
          <div className="flex flex-col gap-4">
            {fotos.length > 1 && (
              <div>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Fotos</p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
                  {formato === 'cuadrada' ? 'Toca la foto que va en la imagen.' : 'Elige hasta 3, en orden: la primera va en grande y las otras dos abajo. Toca otra vez para quitarla.'}
                </p>
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5 max-h-44 overflow-y-auto">
                  {fotos.map((u, i) => {
                    const esPrincipal = u === principal;
                    const extra = formato === 'vertical' ? extras.indexOf(u) : -1;
                    return (
                      <button key={u + i} type="button" onClick={() => tocarFoto(u)}
                        aria-pressed={esPrincipal || extra >= 0}
                        aria-label={`Foto ${i + 1}${esPrincipal ? ', principal' : extra >= 0 ? `, abajo ${extra + 1}` : ''}`}
                        className={clsx('relative aspect-[4/3] rounded-md overflow-hidden border-[3px]',
                          esPrincipal ? 'border-blue-600' : extra >= 0 ? 'border-emerald-500' : 'border-transparent opacity-75 hover:opacity-100')}>
                        <img src={u} alt="" loading="lazy" className="w-full h-full object-cover" />
                        {esPrincipal && <span className="absolute bottom-0 inset-x-0 bg-blue-700 text-white text-[10px] font-bold text-center">Principal</span>}
                        {extra >= 0 && <span className="absolute bottom-0 inset-x-0 bg-emerald-600 text-white text-[10px] font-bold text-center">Abajo {extra + 1}</span>}
                      </button>
                    );
                  })}
                </div>
                {formato === 'vertical' && (
                  <button type="button" onClick={() => setElegidas([principal])} className="mt-1 text-xs font-semibold text-blue-700 dark:text-blue-300 hover:underline">Solo la principal, sin fotos abajo</button>
                )}
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-sm font-bold text-slate-800 dark:text-slate-200">
                Etiqueta
                <select value={etiqueta} onChange={(e) => setEtiqueta(e.target.value)}
                  className="min-h-[40px] px-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-medium">
                  {ETIQUETAS.map((t) => <option key={t} value={t}>{t || 'Sin etiqueta'}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm font-bold text-slate-800 dark:text-slate-200">
                WhatsApp que aparece
                <input value={telefono} onChange={(e) => setTelefono(e.target.value)} inputMode="tel" placeholder="Ej. 33 1234 5678"
                  className="min-h-[40px] px-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-medium" />
                <span className="flex gap-2 text-xs font-semibold">
                  {telefonoAsesor && <button type="button" onClick={() => setTelefono(telefonoAsesor)} className="text-blue-700 dark:text-blue-300 hover:underline">El mío</button>}
                  {telAgencia && <button type="button" onClick={() => setTelefono(telAgencia)} className="text-blue-700 dark:text-blue-300 hover:underline">El de la agencia</button>}
                </span>
              </label>
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-800 dark:text-slate-200 cursor-pointer">
              <input type="checkbox" checked={conEnganche} onChange={(e) => setConEnganche(e.target.checked)} className="w-4 h-4 accent-blue-700" />
              Poner «Enganche desde…» (según el plan de crédito del año)
            </label>

            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Texto para la publicación</p>
                <button type="button" onClick={copiarTexto} className="text-xs font-bold text-blue-700 dark:text-blue-300 flex items-center gap-1 hover:underline">
                  {copiado ? <><Check className="w-3.5 h-3.5" /> Copiado</> : <><Copy className="w-3.5 h-3.5" /> Copiar texto</>}
                </button>
              </div>
              <pre className="whitespace-pre-wrap text-xs leading-relaxed bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-3 max-h-40 overflow-y-auto font-sans text-slate-800 dark:text-slate-200">{texto}</pre>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-end gap-2">
          <p className="mr-auto text-xs text-slate-600 dark:text-slate-400">
            {enTelefono() ? 'Al compartir, el texto se copia solo: pégalo en la publicación.' : 'Descarga la imagen y pega el texto al publicar.'}
          </p>
          <button type="button" onClick={descargar} disabled={!vista || armando}
            className={clsx(boton, 'border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50')}>
            <Download className="w-4 h-4" /> Descargar
          </button>
          {enTelefono() && (
            <button type="button" onClick={compartir} disabled={!vista || armando}
              className={clsx(boton, 'bg-blue-700 hover:bg-blue-800 text-white disabled:opacity-50')}>
              <Share2 className="w-4 h-4" /> Compartir
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
