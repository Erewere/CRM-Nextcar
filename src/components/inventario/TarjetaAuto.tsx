import React from 'react';
import clsx from 'clsx';
import { Car as CarIcon, Share2, Trash2, Target, Globe } from 'lucide-react';
import { Vehicle } from '../../types';
import { InteresDeAuto, haceCuanto } from '../../lib/interesPorAuto';
import { PrecioMercado } from '../../lib/precioMercado';
import { GraficaMercado } from './GraficaMercado';

export interface Coincidencia {
  level: string;
  client: { id: string; name?: string };
}

interface Props {
  vehicle: Vehicle;
  dias: number | null;
  /** Solo para autos de la propia agencia; los de otra agencia no traen sus tratos. */
  interes?: InteresDeAuto;
  coincidencias: Coincidencia[];
  nombreAgencia?: string;
  esDeMiAgencia: boolean;
  puedeBorrar: boolean;
  puedeVender: boolean;
  costos?: { costo: number; gastos: number } | null;
  /** undefined: aún no se sabe (no se muestra nada); null: sin anuncios. */
  mercado?: PrecioMercado | null;
  onAbrir: () => void;
  onVender: () => void;
  onCompartir: () => void;
  onBorrar: () => void;
  onCoincidencia: (clientId: string) => void;
}

/** Color de la etiqueta de días: verde hasta 30, amarillo hasta 90, rojo después. */
const estiloDias = (d: number) =>
  d <= 30 ? 'bg-emerald-700 text-white' : d <= 90 ? 'bg-amber-400 text-amber-950' : 'bg-red-700 text-white';

const pesos = (n: number) => `$${Number(n || 0).toLocaleString('es-MX')}`;

export function TarjetaAuto({
  vehicle, dias, interes, coincidencias, nombreAgencia, esDeMiAgencia,
  puedeBorrar, puedeVender, costos, mercado, onAbrir, onVender, onCompartir, onBorrar, onCoincidencia,
}: Props) {
  const foto = vehicle.photoUrls?.[0] || vehicle.photoUrl;
  const pendiente = (vehicle as any).pendingValidation;
  const estado = pendiente
    ? `Pendiente: ${pendiente.type === 'sold' ? 'Vendido' : 'Reservado'}`
    : vehicle.status === 'sold' ? 'Vendido' : vehicle.status === 'reserved' ? 'Reservado' : 'Disponible';
  const sinInteres = esDeMiAgencia && vehicle.status !== 'sold' && (interes?.interesados || 0) === 0 && dias !== null && dias > 30;
  const utilidad = costos ? (vehicle.price || 0) - costos.costo - costos.gastos : 0;

  return (
    <article
      className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-800 hover:shadow-md transition-shadow cursor-pointer group relative flex flex-col"
      onClick={onAbrir}
    >
      <div className="relative aspect-[16/10] bg-slate-100 dark:bg-slate-700">
        {foto ? (
          <img src={foto} alt={`${vehicle.make} ${vehicle.model}`} loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300">
            <CarIcon className="w-16 h-16" />
          </div>
        )}

        <div className="absolute top-2 left-2 z-10 flex flex-col gap-1 items-start">
          {dias !== null && vehicle.status !== 'sold' && (
            <span className={clsx('text-xs font-extrabold px-2.5 py-1 rounded-full shadow-sm', estiloDias(dias))}>
              {dias} {dias === 1 ? 'día' : 'días'}
            </span>
          )}
          {coincidencias.map((m, i) => {
            let color = 'bg-indigo-600';
            let texto = `¡Exacto! (${m.client.name})`;
            if (m.level === 'high') { color = 'bg-emerald-600'; texto = `Muy similar (${m.client.name})`; }
            if (m.level === 'medium') { color = 'bg-yellow-600'; texto = `Algo similar (${m.client.name})`; }
            if (m.level === 'low') { color = 'bg-orange-600'; texto = `Posible match (${m.client.name})`; }
            return (
              <button
                type="button"
                key={i}
                onClick={(e) => { e.stopPropagation(); onCoincidencia(m.client.id); }}
                className={`${color} hover:brightness-110 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-sm flex items-center gap-1 w-max`}
                title="Ver cliente"
              >
                <Target className="w-3 h-3" /> {texto}
              </button>
            );
          })}
        </div>

        <div className="absolute top-2 right-2 flex gap-2 items-center">
          {(vehicle as any).publicarEnWeb && (
            <span className="bg-white text-blue-900 text-[11px] font-bold px-2 py-1 rounded-full shadow-sm flex items-center gap-1">
              <Globe className="w-3 h-3" /> En la página
            </span>
          )}
          {esDeMiAgencia && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onCompartir(); }}
              title="Compartir por WhatsApp"
              aria-label="Compartir por WhatsApp"
              className="p-1.5 bg-white dark:bg-slate-800/90 rounded text-slate-500 hover:text-green-600 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Share2 className="w-4 h-4" />
            </button>
          )}
          {puedeBorrar && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onBorrar(); }}
              title="Borrar"
              aria-label="Borrar auto"
              className="p-1.5 bg-white dark:bg-slate-800/90 rounded text-slate-500 hover:text-red-600 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="absolute bottom-2 left-2 flex gap-2">
          <span className={clsx('px-2 py-1 bg-black/65 text-white text-xs rounded font-medium', pendiente && 'text-amber-300')}>{estado}</span>
          {vehicle.ownership === 'consignacion' ? (
            <span className="px-2 py-1 bg-purple-700/85 text-white text-xs rounded font-medium">Consignación</span>
          ) : (
            <span className="px-2 py-1 bg-blue-700/85 text-white text-xs rounded font-medium">Propio</span>
          )}
        </div>
      </div>

      <div className="p-4 flex flex-col gap-3 flex-1">
        {!esDeMiAgencia && (
          <div className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold rounded-md border border-indigo-100 dark:border-indigo-900/30 w-max">
            Agencia: {nombreAgencia || 'Agencia Externa'}
          </div>
        )}
        <div>
          <h3 className="font-bold text-slate-800 dark:text-slate-100 leading-snug line-clamp-2">
            {vehicle.year} {vehicle.make} {vehicle.model}
          </h3>
          <div className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
            {(vehicle.km || 0).toLocaleString('es-MX')} km · {vehicle.transmission || '—'}{vehicle.color ? ` · ${vehicle.color}` : ''}
          </div>
        </div>

        <div className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">{pesos(vehicle.price || 0)}</div>

        {esDeMiAgencia && (
          <div className="grid grid-cols-3 gap-2 border-t border-slate-200 dark:border-slate-700 pt-3">
            <div className="flex flex-col">
              <span className="text-lg font-extrabold text-slate-900 dark:text-white">{interes?.interesados || 0}</span>
              <span className="text-[11px] text-slate-600 dark:text-slate-400">Interesados</span>
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-extrabold text-slate-900 dark:text-white">{interes?.tratosAbiertos || 0}</span>
              <span className="text-[11px] text-slate-600 dark:text-slate-400">Tratos abiertos</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold leading-7 text-slate-900 dark:text-white">{haceCuanto(interes?.ultimo)}</span>
              <span className="text-[11px] text-slate-600 dark:text-slate-400">Último interés</span>
            </div>
          </div>
        )}

        {sinInteres && (
          <div className="bg-amber-100 dark:bg-amber-900/30 text-amber-900 dark:text-amber-200 text-xs font-semibold px-2.5 py-2 rounded-lg">
            Nadie ha preguntado en {dias} días: revisa precio y fotos
          </div>
        )}

        {costos && (
          <div className="text-xs text-slate-600 dark:text-slate-400 flex flex-col gap-1 border-t border-slate-200 dark:border-slate-700 pt-2">
            <div className="flex justify-between">
              <span>Costo: {pesos(costos.costo)}</span>
              <span>Gastos: {pesos(costos.gastos)}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold">Utilidad neta:</span>
              <span className={clsx('font-semibold', utilidad >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400')}>
                {pesos(utilidad)}
              </span>
            </div>
          </div>
        )}

        {esDeMiAgencia && vehicle.status !== 'sold' && (
          <GraficaMercado precio={Number(vehicle.price) || 0} mercado={mercado} />
        )}

        <div className="flex gap-2 mt-auto pt-1">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onAbrir(); }}
            className="flex-1 min-h-[40px] rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            {esDeMiAgencia ? 'Editar' : 'Ver'}
          </button>
          {puedeVender && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onVender(); }}
              className="flex-1 min-h-[40px] rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold"
            >
              Vender
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
