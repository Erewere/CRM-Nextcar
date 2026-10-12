import React from 'react';
import clsx from 'clsx';
import type { GuiaPrecio } from '../../lib/guiaPrecios';

const pesos = (n: number) => `$${Math.round(n || 0).toLocaleString('es-MX')}`;

/** Lo que el servidor manda de la guía: sin `compra` si el usuario no ve costos. */
export type GuiaVista = Partial<GuiaPrecio> & Pick<GuiaPrecio, 'confianza' | 'motivo'>;

/**
 * Venta y compra según la guía de Autocosmos. Con confianza baja no enseña
 * números: un precio dudoso en pantalla se vuelve el precio de alguien.
 */
export function LineaGuia({ guia, precio, mostrarPrecio = true }: { guia?: GuiaVista | null; precio?: number; mostrarPrecio?: boolean }) {
  if (!guia) return null;

  if (guia.confianza === 'baja' || !guia.venta) {
    return (
      <div className="text-[11px] text-slate-600 dark:text-slate-400 border-t border-slate-200 dark:border-slate-700 pt-2">
        Guía Autocosmos: poco confiable para este auto. {guia.motivo}
      </div>
    );
  }

  const esRango = !guia.version && guia.ventaMin !== guia.ventaMax;
  const diferencia = precio && guia.venta ? Math.round(((precio - guia.venta) / guia.venta) * 100) : null;
  const fecha = guia.fecha ? new Date(guia.fecha).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) : '';

  return (
    <div
      className="border-t border-slate-200 dark:border-slate-700 pt-2 flex flex-col gap-1"
      title={`${guia.motivo}${guia.version ? ` Versión de la guía: ${guia.version}.` : ''} La compra es el 87% de la venta (relación del Libro Azul).${fecha ? ` Consultado el ${fecha}.` : ''}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-extrabold uppercase tracking-wide text-slate-700 dark:text-slate-300">Guía Autocosmos</span>
        <span className={clsx('text-[10px] font-bold px-1.5 py-0.5 rounded', guia.confianza === 'alta' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200')}>
          {guia.confianza === 'alta' ? 'Versión exacta' : esRango ? 'Rango' : 'Aproximada'}
        </span>
      </div>
      <div className="flex justify-between text-xs">
        <span>Venta: <strong>{pesos(guia.venta!)}</strong></span>
        {guia.compra ? <span>Compra: <strong>{pesos(guia.compra)}</strong></span> : null}
      </div>
      {esRango && (
        <div className="text-[10px] text-slate-500 dark:text-slate-400">Versiones de {pesos(guia.ventaMin!)} a {pesos(guia.ventaMax!)}</div>
      )}
      {mostrarPrecio && diferencia !== null && (
        <div className={clsx('text-[11px] font-semibold', Math.abs(diferencia) <= 5 ? 'text-slate-600 dark:text-slate-400' : diferencia > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-teal-700 dark:text-teal-300')}>
          Tu precio está {Math.abs(diferencia) <= 1 ? 'en la guía' : `${Math.abs(diferencia)}% ${diferencia > 0 ? 'arriba' : 'abajo'} de la guía`}
        </div>
      )}
    </div>
  );
}
