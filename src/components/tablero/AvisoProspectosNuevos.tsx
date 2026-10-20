import React, { useMemo } from 'react';
import { Link } from 'react-router';
import { Clock, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import { prospectosNuevos, resumenDeRespuesta, textoDeEspera } from '../../lib/prospectosNuevos';

/**
 * Aviso en el Dashboard: «hay prospectos nuevos esperando». Usa los datos que el Dashboard ya
 * cargó (ninguna lectura extra) y solo aparece si hay alguien sin atender.
 */
export function AvisoProspectosNuevos({ clientes, notas, tareas, etapas, horario }: {
  clientes: any[]; notas: any[]; tareas: any[]; etapas: { id: string; title?: string }[]; horario?: { start?: string; end?: string };
}) {
  const resumen = useMemo(
    () => resumenDeRespuesta(prospectosNuevos({ clientes, notas, tareas, etapas, horario })),
    [clientes, notas, tareas, etapas, horario],
  );
  if (!resumen.sinAtender) return null;
  const tarde = resumen.criticos > 0;
  return (
    <Link
      to="/nuevos"
      className={clsx(
        'flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors',
        tarde ? 'bg-red-50 border-red-300 hover:bg-red-100 dark:bg-red-950/30 dark:border-red-800' : 'bg-amber-50 border-amber-300 hover:bg-amber-100 dark:bg-amber-950/30 dark:border-amber-800',
      )}
    >
      <Clock className={clsx('w-5 h-5 shrink-0', tarde ? 'text-red-600' : 'text-amber-600')} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-extrabold text-slate-900 dark:text-white">
          {resumen.sinAtender} prospecto{resumen.sinAtender === 1 ? '' : 's'} nuevo{resumen.sinAtender === 1 ? '' : 's'} sin atender
        </p>
        <p className="text-xs text-slate-600 dark:text-slate-300">
          El más viejo lleva {textoDeEspera(resumen.masViejoMin)}
          {resumen.sinAsignar ? ` · ${resumen.sinAsignar} sin asesor` : ''}
        </p>
      </div>
      <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-0.5 shrink-0">Atender <ChevronRight className="w-4 h-4" /></span>
    </Link>
  );
}
