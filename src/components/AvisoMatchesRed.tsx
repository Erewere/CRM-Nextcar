import React, { useState, useMemo } from 'react';
import { useSharedInventoryMatches } from '../hooks/useSharedInventoryMatches';
import { useAvisosDescartados, descartarAviso, idDeMatch } from '../lib/avisosDescartados';
import { useIsMobile } from '../hooks/useIsMobile';
import { VehicleDetailModal } from './VehicleDetailModal';
import { Vehicle, Client } from '../types';
import { Sparkles, X, ChevronDown } from 'lucide-react';
import clsx from 'clsx';

// El aviso flotante de coincidencias con el inventario de otras agencias.
//
// Existía uno así hasta el 23 de agosto: salía solo, abajo a la derecha, y
// anunciaba los matches sin que nadie fuera a buscarlos. Se fue al juntar los
// tres sistemas de avisos en la campanita, y con él se perdió lo mejor que
// tenía — que saltaba a la vista. En la campanita los matches quedan sepultados
// entre tareas vencidas, papeles faltantes y contactos calientes.
//
// Vuelve, pero solo para esto, y compartiendo la lista de descartados con la
// campanita: el error de la vez pasada no fue tener dos pantallas, fue tener
// dos listas de "ya lo vi" que no se hablaban.

export function AvisoMatchesRed() {
  const { matches, ownAgencySharing } = useSharedInventoryMatches();
  const descartados = useAvisosDescartados();
  const esMovil = useIsMobile();
  const [abierto, setAbierto] = useState(false);
  const [vehiculoAbierto, setVehiculoAbierto] = useState<Vehicle | null>(null);
  const [clienteDelVehiculo, setClienteDelVehiculo] = useState<Client | null>(null);

  const visibles = useMemo(
    () => matches.filter((m) => !descartados.has(idDeMatch(m.client.id, m.vehicle.id))),
    [matches, descartados],
  );

  // En el móvil ya hay un botón flotante para crear cosas; dos se estorban.
  if (esMovil || !ownAgencySharing || visibles.length === 0) {
    // El modal se queda montado aunque el aviso se cierre, para que cerrar el
    // último match no cierre de golpe la ficha del auto que estabas viendo.
    return vehiculoAbierto ? (
      <VehicleDetailModal
        vehicle={vehiculoAbierto}
        onClose={() => setVehiculoAbierto(null)}
        clientContext={clienteDelVehiculo || undefined}
      />
    ) : null;
  }

  const abrir = (v: Vehicle, c: Client) => {
    setVehiculoAbierto(v);
    setClienteDelVehiculo(c);
  };

  return (
    <>
      <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2 print:hidden">
        {!abierto ? (
          <button
            onClick={() => setAbierto(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-slate-900 dark:bg-slate-800 dark:border dark:border-slate-700 text-white shadow-2xl hover:bg-slate-800 transition-colors font-bold text-sm"
          >
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            {visibles.length} {visibles.length === 1 ? 'coincidencia' : 'coincidencias'} en la red
          </button>
        ) : (
          <div className="w-[92vw] sm:w-96 max-h-[70vh] flex flex-col rounded bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-slate-800 shrink-0">
              <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                Autos de otras agencias para tus clientes
              </h3>
              <button
                onClick={() => setAbierto(false)}
                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                title="Ocultar"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {visibles.slice(0, 12).map((m) => (
                <div
                  key={idDeMatch(m.client.id, m.vehicle.id)}
                  className="flex items-start gap-2 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <button
                    onClick={() => abrir(m.vehicle, m.client)}
                    className="flex-1 text-left min-w-0"
                  >
                    <p className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">
                      {m.vehicle.make} {m.vehicle.model} {m.vehicle.year}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      para <strong>{m.client.name}</strong> · {m.agencyName}
                    </p>
                    <span
                      className={clsx(
                        'inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full',
                        m.level === 'exact'
                          ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300'
                          : m.level === 'high'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
                      )}
                    >
                      {m.level === 'exact' ? '¡Exacto!' : `${m.score}%`}
                    </span>
                  </button>
                  <button
                    onClick={() => descartarAviso(idDeMatch(m.client.id, m.vehicle.id))}
                    className="p-1 text-slate-300 hover:text-red-500 shrink-0"
                    title="Descartar esta coincidencia"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {visibles.length > 12 && (
              <p className="px-4 py-2 text-[11px] text-slate-400 border-t border-gray-200 dark:border-slate-800 shrink-0">
                y {visibles.length - 12} más — están todas en Inteligencia.
              </p>
            )}
          </div>
        )}
      </div>

      {vehiculoAbierto && (
        <VehicleDetailModal
          vehicle={vehiculoAbierto}
          onClose={() => setVehiculoAbierto(null)}
          clientContext={clienteDelVehiculo || undefined}
        />
      )}
    </>
  );
}
