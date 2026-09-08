import React from 'react';
import { Client } from '../types';
import { Target } from 'lucide-react';
import clsx from 'clsx';

// Lo que el cliente anda buscando, de un vistazo.
//
// Estaba capturado pero escondido detrás del botón "Ver / Editar Búsqueda de
// Auto": para saber si un cliente quería SUV o sedán había que abrir un
// formulario de once campos. Es el dato que más se consulta y estaba a dos
// clics. Aquí se lee sin abrir nada.

const pesos = (n: number) => '$' + n.toLocaleString('es-MX');

/** Arma las frases cortas que se pintan como etiquetas. */
export function frasesDeBusqueda(buscado: Client['wantedVehicle']): string[] {
  if (!buscado) return [];
  const f: string[] = [];

  if (buscado.bodyType) f.push(buscado.bodyType);
  if (buscado.passengers) f.push(`${buscado.passengers} pasajeros`);
  if (buscado.transmission) f.push(buscado.transmission);

  // Marca y modelo se leen juntos, como los diría un vendedor.
  const marcaModelo = [buscado.make, buscado.model].filter(Boolean).join(' ');
  if (marcaModelo) f.push(marcaModelo);

  // Los años igual: "2020 a 2024" dice más que dos etiquetas sueltas.
  if (buscado.yearMin && buscado.yearMax) f.push(`${buscado.yearMin} a ${buscado.yearMax}`);
  else if (buscado.yearMin) f.push(`${buscado.yearMin} o más nuevo`);
  else if (buscado.yearMax) f.push(`hasta ${buscado.yearMax}`);

  if (buscado.priceMin && buscado.priceMax) f.push(`${pesos(buscado.priceMin)} a ${pesos(buscado.priceMax)}`);
  else if (buscado.priceMax) f.push(`hasta ${pesos(buscado.priceMax)}`);
  else if (buscado.priceMin) f.push(`desde ${pesos(buscado.priceMin)}`);

  if (buscado.kmMax) f.push(`máx. ${buscado.kmMax.toLocaleString('es-MX')} km`);

  return f;
}

interface Props {
  buscado: Client['wantedVehicle'];
  /** Compacto: sin encabezado, para caber en la ficha del chat. */
  compacto?: boolean;
  className?: string;
}

export function ResumenBusquedaAuto({ buscado, compacto = false, className }: Props) {
  const frases = frasesDeBusqueda(buscado);
  if (frases.length === 0) return null;

  return (
    <div
      className={clsx(
        'rounded border border-indigo-200 dark:border-indigo-800/50 bg-indigo-50 dark:bg-indigo-900/20',
        compacto ? 'p-2.5' : 'p-3',
        className,
      )}
    >
      {!compacto && (
        <h4 className="text-xs font-bold text-indigo-800 dark:text-indigo-300 mb-2 flex items-center gap-1.5">
          <Target className="w-3.5 h-3.5" />
          Lo que busca
        </h4>
      )}
      <div className="flex flex-wrap gap-1.5">
        {frases.map((f) => (
          <span
            key={f}
            className="px-2 py-0.5 rounded-full bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800/50 text-[11px] font-semibold text-indigo-800 dark:text-indigo-300"
          >
            {f}
          </span>
        ))}
      </div>
    </div>
  );
}
