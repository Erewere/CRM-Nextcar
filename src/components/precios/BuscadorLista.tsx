import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { ChevronDown } from 'lucide-react';

/**
 * Un campo donde se escriben las primeras letras y la lista se filtra, para listas largas (marcas, modelos).
 * Sirve igual con el teclado de la computadora y con el del teléfono: un <select> normal en el celular obliga a
 * recorrer toda la lista con el dedo. Primero salen las opciones que EMPIEZAN con lo escrito y luego las que lo
 * contienen («ford» → Ford, y después Land Rover Defender si dijera «ford» en el nombre).
 */

const sinAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const MAXIMO_VISIBLES = 80;

interface Props {
  etiqueta: string;
  valor: string;
  items: string[];
  alElegir: (valor: string) => void;
  campo: string;
  vacio: string;
  cargando?: boolean;
  deshabilitado?: boolean;
  requerido?: boolean;
}

export function BuscadorLista({ etiqueta, valor, items, alElegir, campo, vacio, cargando, deshabilitado, requerido }: Props) {
  const [texto, setTexto] = useState(valor);
  const [abierto, setAbierto] = useState(false);
  const [resaltado, setResaltado] = useState(0);
  const caja = useRef<HTMLDivElement>(null);
  const cierre = useRef<number | undefined>(undefined);
  const id = useId();

  // Si el valor cambia desde fuera (otra marca, o se vació por cambiar de padre), el texto lo sigue.
  useEffect(() => { setTexto(valor); }, [valor]);

  const visibles = useMemo(() => {
    const q = sinAcentos(texto === valor ? '' : texto);
    if (!q) return items.slice(0, MAXIMO_VISIBLES);
    const empiezan: string[] = [], contienen: string[] = [];
    for (const it of items) {
      const n = sinAcentos(it);
      if (n.startsWith(q)) empiezan.push(it); else if (n.includes(q)) contienen.push(it);
    }
    return [...empiezan, ...contienen].slice(0, MAXIMO_VISIBLES);
  }, [items, texto, valor]);

  useEffect(() => { setResaltado(0); }, [texto]);

  const elegir = (v: string) => { window.clearTimeout(cierre.current); alElegir(v); setTexto(v); setAbierto(false); };

  /**
   * Al salir del campo: si lo escrito es exactamente una opción, se toma; si no, se vuelve a lo que ya estaba elegido.
   * Espera un instante: en el teléfono el campo pierde el foco antes de que llegue el toque a la opción, y cerrar
   * de inmediato quitaría la lista justo cuando se está eligiendo.
   */
  const cerrar = () => {
    cierre.current = window.setTimeout(() => {
      const exacta = items.find((x) => sinAcentos(x) === sinAcentos(texto));
      if (exacta && exacta !== valor) alElegir(exacta);
      setTexto(exacta || valor);
      setAbierto(false);
    }, 180);
  };

  const teclas = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setAbierto(true); setResaltado((i) => Math.min(visibles.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setResaltado((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Enter' && abierto && visibles[resaltado]) { e.preventDefault(); elegir(visibles[resaltado]); }
    else if (e.key === 'Escape') { setTexto(valor); setAbierto(false); }
  };

  // El elemento resaltado se mantiene a la vista al bajar con las flechas.
  useEffect(() => {
    if (abierto) caja.current?.querySelector<HTMLElement>('[data-resaltado="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [resaltado, abierto]);

  return (
    <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 min-w-0 relative">
      <label htmlFor={id}>{etiqueta}</label>
      <div className="relative">
        <input
          id={id}
          required={requerido}
          value={cargando ? '' : texto}
          disabled={deshabilitado || cargando}
          placeholder={cargando ? 'Cargando…' : vacio}
          onChange={(e) => { setTexto(e.target.value); setAbierto(true); }}
          onFocus={(e) => { window.clearTimeout(cierre.current); setAbierto(true); e.target.select(); }}
          onBlur={cerrar}
          onKeyDown={teclas}
          autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false}
          role="combobox" aria-expanded={abierto} aria-autocomplete="list"
          className={clsx(campo, 'pr-8 disabled:opacity-60')}
        />
        <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden />
        {abierto && !deshabilitado && (
          <div ref={caja} role="listbox" className="absolute z-30 left-0 right-0 mt-1 max-h-60 overflow-y-auto rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-lg">
            {visibles.length === 0 ? (
              <p className="px-3 py-2 text-sm font-normal text-slate-500">{items.length ? 'Ninguna coincide. Revisa las letras.' : 'No hay opciones.'}</p>
            ) : visibles.map((it, i) => (
              <button
                type="button" key={it} role="option" aria-selected={it === valor} data-resaltado={i === resaltado}
                // Se elige al soltar (click), no al tocar: tocar para desplazar la lista no debe elegir nada.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => elegir(it)}
                onMouseEnter={() => setResaltado(i)}
                className={clsx('block w-full text-left px-3 py-2.5 text-sm font-normal text-slate-900 dark:text-slate-100', i === resaltado && 'bg-slate-100 dark:bg-slate-700', it === valor && 'font-bold')}
              >{it}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
