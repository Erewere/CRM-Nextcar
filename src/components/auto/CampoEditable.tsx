import React, { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { Check, Pencil } from 'lucide-react';

/**
 * Un dato que se edita ahí mismo: clic (o Enter) para cambiarlo, Enter o salir
 * del campo para guardar, Esc para cancelar. Guarda solo ese dato, al momento,
 * sin pasar por «Editar».
 */

type Tipo = 'texto' | 'numero' | 'fecha' | 'opciones' | 'largo';

interface Props {
  etiqueta: string;
  valor: any;
  tipo?: Tipo;
  opciones?: { valor: string; texto: string }[];
  /** Cómo se ve el valor cuando no se edita. */
  mostrar?: (v: any) => React.ReactNode;
  sufijo?: string;
  puedeEditar: boolean;
  /** Si falta el dato, se marca para que se note. */
  marcarSiFalta?: boolean;
  onGuardar: (nuevo: any) => Promise<void>;
  className?: string;
  /** Clases para el valor (p. ej. el precio grande sobre fondo oscuro). */
  claseValor?: string;
}

export function CampoEditable({
  etiqueta, valor, tipo = 'texto', opciones, mostrar, sufijo, puedeEditar, marcarSiFalta, onGuardar, className, claseValor,
}: Props) {
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState<string>('');
  const [estado, setEstado] = useState<'' | 'guardando' | 'listo' | 'error'>('');
  const ref = useRef<any>(null);

  useEffect(() => {
    if (editando) {
      ref.current?.focus();
      if (ref.current?.select && tipo !== 'opciones') ref.current.select();
    }
  }, [editando, tipo]);

  const vacio = valor === undefined || valor === null || valor === '' || (tipo === 'numero' && !Number(valor));

  const empezar = () => {
    if (!puedeEditar || editando) return;
    setBorrador(valor === undefined || valor === null ? '' : String(valor));
    setEditando(true);
  };

  const guardar = async () => {
    if (!editando) return;
    setEditando(false);
    const original = valor === undefined || valor === null ? '' : String(valor);
    if (borrador.trim() === original.trim()) return;
    let nuevo: any = borrador.trim();
    if (tipo === 'numero') {
      nuevo = nuevo === '' ? null : Number(nuevo.replace(/[^\d.]/g, ''));
      if (nuevo !== null && Number.isNaN(nuevo)) return;
    }
    setEstado('guardando');
    try {
      await onGuardar(nuevo);
      setEstado('listo');
      setTimeout(() => setEstado(''), 1500);
    } catch (e: any) {
      console.error(e);
      setEstado('error');
      alert(`No se pudo guardar «${etiqueta}». ${e?.message || ''}`);
    }
  };

  const teclas = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); setEditando(false); }
    if (e.key === 'Enter' && tipo !== 'largo') { e.preventDefault(); guardar(); }
  };

  const claseInput = 'w-full text-sm font-semibold px-2 py-1 rounded-md border border-blue-500 ring-2 ring-blue-200 dark:ring-blue-900 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none';

  return (
    <div className={clsx('flex flex-col min-w-0', className)}>
      <span className={clsx('text-[11px] text-slate-600 dark:text-slate-400 flex items-center gap-1', !etiqueta && !estado && 'hidden')}>
        {etiqueta}
        {estado === 'guardando' && <span className="text-slate-500">· guardando…</span>}
        {estado === 'listo' && <span className="text-emerald-700 dark:text-emerald-400 flex items-center gap-0.5"><Check className="w-3 h-3" /> guardado</span>}
      </span>
      {editando ? (
        tipo === 'opciones' ? (
          <select ref={ref} value={borrador} onChange={(e) => setBorrador(e.target.value)} onBlur={guardar} onKeyDown={teclas} className={claseInput}>
            <option value="">—</option>
            {(opciones || []).map((o) => <option key={o.valor} value={o.valor}>{o.texto}</option>)}
          </select>
        ) : tipo === 'largo' ? (
          <textarea ref={ref} value={borrador} onChange={(e) => setBorrador(e.target.value)} onBlur={guardar} onKeyDown={teclas} rows={4} className={claseInput} />
        ) : (
          <input
            ref={ref}
            type={tipo === 'fecha' ? 'date' : 'text'}
            inputMode={tipo === 'numero' ? 'decimal' : undefined}
            value={borrador}
            onChange={(e) => setBorrador(e.target.value)}
            onBlur={guardar}
            onKeyDown={teclas}
            className={claseInput}
          />
        )
      ) : (
        <button
          type="button"
          onClick={empezar}
          disabled={!puedeEditar}
          title={puedeEditar ? 'Clic para cambiar' : undefined}
          className={clsx(
            'group text-left text-sm font-bold rounded-md -mx-1 px-1 py-0.5 flex items-start gap-1 min-h-[26px]',
            puedeEditar ? 'hover:bg-blue-50 dark:hover:bg-blue-950/30 cursor-text' : 'cursor-default',
            vacio ? (marcarSiFalta ? 'text-amber-700 dark:text-amber-400' : 'text-slate-400') : 'text-slate-900 dark:text-slate-100',
            tipo === 'largo' && 'whitespace-pre-wrap font-medium',
            claseValor
          )}
        >
          <span className="min-w-0 break-words">
            {vacio ? (marcarSiFalta ? 'Falta' : puedeEditar ? 'Agregar' : '—') : (mostrar ? mostrar(valor) : `${valor}${sufijo ? ` ${sufijo}` : ''}`)}
          </span>
          {puedeEditar && <Pencil className="w-3 h-3 mt-1 shrink-0 opacity-0 group-hover:opacity-60" />}
        </button>
      )}
    </div>
  );
}
