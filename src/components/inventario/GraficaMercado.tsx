import React from 'react';
import clsx from 'clsx';
import { PrecioMercado, MINIMO_ANUNCIOS, franjaDelPrecio } from '../../lib/precioMercado';

const pesos = (n: number) => `$${Math.round(n || 0).toLocaleString('es-MX')}`;

const FRANJAS = [
  { id: 'excelente', texto: 'Excelente', color: 'bg-teal-500' },
  { id: 'bueno', texto: 'Bueno', color: 'bg-green-600' },
  { id: 'justo', texto: 'Justo', color: 'bg-green-800' },
] as const;

const VEREDICTO: Record<string, { texto: string; clase: string }> = {
  excelente: { texto: 'Excelente precio', clase: 'text-teal-700 dark:text-teal-300' },
  bueno: { texto: 'Buen precio', clase: 'text-green-700 dark:text-green-400' },
  justo: { texto: 'Precio justo', clase: 'text-green-900 dark:text-green-300' },
  arriba: { texto: 'Arriba del mercado', clase: 'text-red-700 dark:text-red-400' },
};

/**
 * Barra de tres franjas, como la de carsforsale: dónde cae el precio del auto
 * contra los anuncios de Mercado Libre del mismo modelo y año.
 */
export function GraficaMercado({ precio, mercado }: { precio: number; mercado?: PrecioMercado | null }) {
  if (mercado === undefined) return null;

  if (!mercado || mercado.n < MINIMO_ANUNCIOS) {
    return (
      <div className="text-[11px] text-slate-600 dark:text-slate-400 border-t border-slate-200 dark:border-slate-700 pt-2">
        Mercado Libre: {mercado ? `solo ${mercado.n} anuncio${mercado.n === 1 ? '' : 's'}` : 'sin anuncios'} de este modelo y año, pocos para comparar.
      </div>
    );
  }

  const franja = franjaDelPrecio(precio, mercado);
  const v = VEREDICTO[franja];
  // La barra va del más barato al p90: los anuncios más caros suelen ser
  // casos raros y aplastarían las franjas.
  const ini = mercado.minimo;
  const fin = Math.max(mercado.p90, ini + 1);
  const pos = (x: number) => Math.min(100, Math.max(0, ((x - ini) / (fin - ini)) * 100));
  const anchos = [pos(mercado.p33), pos(mercado.p66) - pos(mercado.p33), 100 - pos(mercado.p66)];
  const fecha = new Date(mercado.fecha).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });

  return (
    <div
      className="border-t border-slate-200 dark:border-slate-700 pt-2.5 flex flex-col gap-1.5"
      title={`${mercado.n} anuncios en Mercado Libre (${mercado.consulta}), del ${pesos(mercado.minimo)} al ${pesos(mercado.maximo)}. Consultado el ${fecha}.`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className={clsx('text-xs font-extrabold', v.clase)}>{v.texto}</span>
        <span className="text-[11px] text-slate-600 dark:text-slate-400">Prom. {pesos(mercado.promedio)}</span>
      </div>
      <div className="relative pt-3">
        <span
          className="absolute top-0 -translate-x-1/2 w-0 h-0 border-x-[6px] border-x-transparent border-t-[8px] border-t-slate-900 dark:border-t-white"
          style={{ left: `${pos(precio)}%` }}
          aria-hidden
        />
        <div className="flex gap-0.5 h-2 rounded-full overflow-hidden">
          {FRANJAS.map((f, i) => (
            <div key={f.id} className={f.color} style={{ width: `${Math.max(anchos[i], 2)}%` }} />
          ))}
        </div>
        <span
          className="absolute -bottom-1 -translate-x-1/2 w-px h-3 bg-slate-500"
          style={{ left: `${pos(mercado.promedio)}%` }}
          aria-hidden
        />
      </div>
      <div className="flex justify-between text-[10px] text-slate-600 dark:text-slate-400">
        {FRANJAS.map((f) => <span key={f.id}>{f.texto}</span>)}
      </div>
      <div className="text-[10px] text-slate-500 dark:text-slate-400">
        {mercado.n} anuncios de {mercado.consulta} en Mercado Libre · {fecha}
      </div>
    </div>
  );
}
