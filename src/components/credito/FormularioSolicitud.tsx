import React from 'react';
import clsx from 'clsx';
import { camposVisibles, leer, poner, type CampoForm, type SeccionForm } from '../../lib/creditoCampos';

/**
 * Los campos de una sección de la solicitud. Lo usan la liga del cliente (un
 * paso a la vez) y el expediente de la agencia (por pestañas).
 */
export function FormularioSolicitud({ seccion, datos, onCambio, mostrarFaltantes = false, grande = false }: {
  seccion: SeccionForm;
  datos: any;
  onCambio: (d: any) => void;
  mostrarFaltantes?: boolean;
  grande?: boolean;
}) {
  const campos = camposVisibles(seccion, datos);
  const cambiar = (c: CampoForm, v: string) => onCambio(poner(datos, c.k, c.mayus ? v.toUpperCase() : v));
  const control = clsx('w-full rounded-lg border bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-3', grande ? 'h-12 text-base' : 'h-10 text-sm');

  return (
    <div className={clsx('grid grid-cols-1 gap-x-3 gap-y-3.5', grande ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3')}>
      {campos.map((c) => {
        const v = leer(datos, c.k) ?? '';
        const falta = mostrarFaltantes && c.req && String(v).trim() === '';
        const borde = falta ? 'border-red-400 ring-1 ring-red-200' : 'border-slate-300 dark:border-slate-600';
        // En la liga (grande) hay 2 columnas; en el expediente, 3. Un campo no
        // puede pedir más columnas de las que hay: el navegador crearía una
        // columna extra sin ancho y todo se encimaría.
        const ancho = grande
          ? (c.ancho && c.ancho >= 2 ? 'sm:col-span-2' : '')
          : (c.ancho === 3 ? 'sm:col-span-2 lg:col-span-3' : c.ancho === 2 ? 'sm:col-span-2' : '');
        const etiqueta = (
          <span className={clsx('font-semibold text-slate-800 dark:text-slate-200', grande ? 'text-sm' : 'text-xs')}>
            {c.e}{c.req && <span className="text-red-600"> *</span>}
          </span>
        );
        if (c.t === 'opcion' && c.ops && c.ops.length <= 4) {
          return (
            <div key={c.k} className={clsx('flex flex-col gap-1.5 min-w-0', ancho, c.ops.length > 2 && 'sm:col-span-2')}>
              {etiqueta}
              <div className={clsx('grid gap-1.5', c.ops.length === 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4')}>
                {c.ops.map(([val, txt]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => cambiar(c, val)}
                    aria-pressed={v === val}
                    className={clsx('rounded-lg border px-2 font-bold text-center', grande ? 'min-h-[44px] text-sm' : 'min-h-[38px] text-xs',
                      v === val ? 'border-blue-600 bg-blue-50 text-blue-900 dark:bg-blue-950/40 dark:text-blue-200 ring-1 ring-blue-600' : clsx('bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300', borde))}
                  >
                    {txt}
                  </button>
                ))}
              </div>
              {c.ayuda && <span className="text-[11px] text-slate-500">{c.ayuda}</span>}
            </div>
          );
        }
        return (
          <label key={c.k} className={clsx('flex flex-col gap-1.5 min-w-0', ancho)}>
            {etiqueta}
            {c.t === 'opcion' ? (
              <select value={v} onChange={(e) => cambiar(c, e.target.value)} className={clsx(control, borde)}>
                <option value="">Elige…</option>
                {c.ops!.map(([val, txt]) => <option key={val} value={val}>{txt}</option>)}
              </select>
            ) : (
              <input
                value={v}
                onChange={(e) => cambiar(c, e.target.value)}
                type={c.t === 'fecha' ? 'date' : c.t === 'email' ? 'email' : 'text'}
                inputMode={c.t === 'numero' ? 'decimal' : c.t === 'tel' ? 'tel' : undefined}
                autoComplete="off"
                className={clsx(control, borde, c.mayus && 'uppercase')}
              />
            )}
            {c.ayuda && <span className="text-[11px] text-slate-500">{c.ayuda}</span>}
          </label>
        );
      })}
    </div>
  );
}
