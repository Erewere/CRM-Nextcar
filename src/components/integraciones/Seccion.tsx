import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * Una sección desplegable de la página de Integraciones. Cerrada solo muestra
 * el título, una línea de explicación y, si hay, su estado. El contenido se
 * queda montado aunque esté cerrado (solo se esconde): así un formulario a
 * medio llenar no se pierde al plegarlo.
 */

export type EstadoSeccion = { texto: string; tono: 'ok' | 'aviso' | 'neutro' };

const TONOS: Record<EstadoSeccion['tono'], string> = {
  ok: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
  aviso: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
  neutro: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
};

export function Seccion({
  icono, colorIcono, titulo, descripcion, estado, abiertaAlInicio = false, discontinua = false, children,
}: {
  icono: React.ReactNode;
  /** Clases del cuadro del ícono, p. ej. «bg-green-100 dark:bg-green-900/30». */
  colorIcono: string;
  titulo: string;
  descripcion: string;
  estado?: EstadoSeccion | null;
  abiertaAlInicio?: boolean;
  discontinua?: boolean;
  children: React.ReactNode;
}) {
  const [abierta, setAbierta] = useState(abiertaAlInicio);
  return (
    <section className={`bg-white dark:bg-slate-800 rounded-lg shadow-sm border ${discontinua ? 'border-dashed border-indigo-300 dark:border-indigo-800' : 'border-gray-200 dark:border-slate-700'} overflow-hidden`}>
      <button
        type="button"
        onClick={() => setAbierta((a) => !a)}
        aria-expanded={abierta}
        className="w-full flex items-center gap-4 px-4 py-4 md:px-6 text-left hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors"
      >
        <span className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 ${colorIcono}`}>{icono}</span>
        <span className="flex-1 min-w-0">
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-base font-bold text-slate-900 dark:text-white">{titulo}</span>
            {estado && <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${TONOS[estado.tono]}`}>{estado.texto}</span>}
          </span>
          <span className="block text-sm text-slate-500 dark:text-slate-400 mt-0.5 truncate md:whitespace-normal">{descripcion}</span>
        </span>
        <ChevronDown className={`w-5 h-5 text-slate-400 shrink-0 transition-transform ${abierta ? 'rotate-180' : ''}`} />
      </button>
      <div hidden={!abierta} className="border-t border-gray-200 dark:border-slate-700">{children}</div>
    </section>
  );
}

/** Título de un grupo de secciones. */
export function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1">{titulo}</h2>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
