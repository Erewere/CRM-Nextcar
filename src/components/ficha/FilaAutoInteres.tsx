import React, { useMemo, useState } from 'react';
import clsx from 'clsx';
import { Car as CarIcon, ChevronDown, FileText, FileSignature, Globe, Handshake, Pencil, UserPlus } from 'lucide-react';
import { alClicWhatsApp } from '../../lib/whatsappApp';
import { ESTADOS_AUTO, eventosDelAuto, estadoDelAuto, lineaDeMercado, textoDeEstado, type EventoAuto } from '../../lib/autosDeInteres';
import { diasDesde } from '../../lib/interesPorAuto';
import type { PrecioMercado } from '../../lib/precioMercado';

/**
 * Un auto de interés en la columna de la ficha: estado que se puede cambiar,
 * qué tan bien está de precio contra el mercado, y su historial (qué ha pasado
 * con ESTE auto y este cliente). Solo lee; cambiar el estado lo hace quien lo monta.
 */

const pesos = (n: number) => `$${Math.round(Number(n) || 0).toLocaleString('es-MX')}`;

const ICONO: Record<EventoAuto['tipo'], React.ComponentType<{ className?: string }>> = {
  trato: Handshake, cotizacion: FileText, pagina: Globe, ficha: UserPlus, estado: Pencil, venta: FileSignature,
};

const cuando = (iso: string) => {
  const d = diasDesde(iso);
  if (d === null) return '';
  if (d === 0) return 'hoy';
  if (d === 1) return 'ayer';
  if (d < 30) return `hace ${d} días`;
  return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: d > 300 ? 'numeric' : undefined });
};

const ESTILO_ESTADO: Record<string, string> = {
  interesado: 'bg-blue-50 text-blue-900 border-blue-200 dark:bg-blue-950/40 dark:text-blue-200 dark:border-blue-800',
  cotizado: 'bg-violet-50 text-violet-900 border-violet-200 dark:bg-violet-950/40 dark:text-violet-200 dark:border-violet-800',
  visito: 'bg-sky-50 text-sky-900 border-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:border-sky-800',
  aparto: 'bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800',
  descartado: 'bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600',
  compro: 'bg-emerald-700 text-white border-emerald-700',
};

export function FilaAutoInteres({ v, tipo, cliente, tratos, notas, etapas, mercado, liga, soloLectura, onAbrirAuto, onCotizar, onCambiarEstado }: {
  v: any; tipo: 'trato' | 'ficha'; cliente: any; tratos: any[]; notas: any[]; etapas: { id: string }[];
  mercado?: PrecioMercado | null; liga: string | null; soloLectura?: boolean;
  onAbrirAuto?: (v: any) => void; onCotizar?: (v: any) => void;
  onCambiarEstado?: (vehicleId: string, estado: string) => Promise<void> | void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const eventos = useMemo(() => eventosDelAuto({ v, cliente, tratos, notas, etapas }), [v, cliente, tratos, notas, etapas]);
  const estado = estadoDelAuto({ v, cliente, eventos });
  const mercadoLinea = v.status !== 'sold' ? lineaDeMercado(Number(v.price) || 0, mercado) : null;
  const foto = v.photoUrls?.[0] || v.photoUrl;
  const dInv = diasDesde(v.receivedAt);
  const descartado = estado.id === 'descartado';
  const puedeCambiar = !soloLectura && !!onCambiarEstado && estado.id !== 'compro' && v.status !== 'sold';

  const cambiar = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    setGuardando(true);
    try { await onCambiarEstado?.(v.id, e.target.value); } finally { setGuardando(false); }
  };

  return (
    <li className={clsx('flex flex-col gap-2', descartado && 'opacity-60')}>
      <div className="flex gap-3 items-start">
        <button type="button" onClick={() => onAbrirAuto?.(v)} className="w-20 h-14 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-700 shrink-0" aria-label={`Ver ${v.make} ${v.model}`}>
          {foto ? <img src={foto} alt="" loading="lazy" className="w-full h-full object-cover" /> : <span className="w-full h-full flex items-center justify-center text-slate-300"><CarIcon className="w-6 h-6" /></span>}
        </button>
        <div className="flex-1 min-w-0">
          <p className={clsx('text-sm font-bold text-slate-900 dark:text-slate-100 truncate', descartado && 'line-through')}>{v.year} {v.make} {v.model}</p>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            <b className="text-slate-900 dark:text-white">{pesos(v.price || 0)}</b>
            {v.km ? <> · {Number(v.km).toLocaleString('es-MX')} km</> : null}
            {v.status === 'sold' ? <> · Vendido</> : dInv !== null ? <> · {dInv} días en inventario</> : null}
          </p>
          {mercadoLinea && (
            <p className={clsx('text-[11px] font-bold', mercadoLinea.tono === 'bueno' ? 'text-emerald-700 dark:text-emerald-400' : mercadoLinea.tono === 'malo' ? 'text-red-700 dark:text-red-400' : 'text-slate-700 dark:text-slate-300')}>{mercadoLinea.texto}</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {puedeCambiar ? (
          <label className={clsx('relative inline-flex items-center rounded-full border text-[11px] font-extrabold', ESTILO_ESTADO[estado.id], guardando && 'opacity-60')}>
            <span className="sr-only">Estado de este auto para el cliente</span>
            <select value={estado.id} onChange={cambiar} disabled={guardando} className="appearance-none bg-transparent pl-2.5 pr-6 py-1 rounded-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-600">
              {ESTADOS_AUTO.map((e) => <option key={e.id} value={e.id}>{e.texto}{!estado.manual && e.id === estado.id ? ' (por ahora)' : ''}</option>)}
            </select>
            <ChevronDown className="w-3 h-3 absolute right-1.5 pointer-events-none" aria-hidden />
          </label>
        ) : (
          <span className={clsx('inline-flex rounded-full border px-2.5 py-1 text-[11px] font-extrabold', ESTILO_ESTADO[estado.id])}>{estado.id === 'compro' ? 'Lo compró' : textoDeEstado(estado.id)}</span>
        )}
        <div className="flex gap-3 text-xs font-bold">
          {onCotizar && v.status !== 'sold' && <button type="button" onClick={() => onCotizar(v)} className="text-blue-700 dark:text-blue-300 hover:underline">Cotizar</button>}
          {liga && v.status !== 'sold' && <a href={liga} onClick={alClicWhatsApp} target="_blank" rel="noopener noreferrer" className="text-green-700 dark:text-green-400 hover:underline">Mandar</a>}
          {onAbrirAuto && <button type="button" onClick={() => onAbrirAuto(v)} className="text-slate-600 dark:text-slate-300 hover:underline">Ver auto</button>}
          {eventos.length > 0 && (
            <button type="button" onClick={() => setAbierto((x) => !x)} aria-expanded={abierto} className="text-slate-600 dark:text-slate-300 hover:underline inline-flex items-center gap-0.5">
              Historial ({eventos.length}) <ChevronDown className={clsx('w-3 h-3 transition-transform', abierto && 'rotate-180')} />
            </button>
          )}
        </div>
      </div>

      {abierto && (
        <ol className="ml-1 border-l-2 border-slate-200 dark:border-slate-700 pl-3 flex flex-col gap-2">
          {eventos.slice(0, 8).map((e, i) => {
            const Icono = ICONO[e.tipo];
            return (
              <li key={i} className="flex gap-2 items-start text-xs text-slate-700 dark:text-slate-300">
                <Icono className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-400" />
                <span className="flex-1 min-w-0">{e.texto}</span>
                <span className="shrink-0 text-slate-400">{cuando(e.fecha)}</span>
              </li>
            );
          })}
          {eventos.length > 8 && <li className="text-[11px] text-slate-400">y {eventos.length - 8} más…</li>}
        </ol>
      )}
    </li>
  );
}
