import React, { useMemo, useState } from 'react';
import clsx from 'clsx';
import { ArrowLeft, Check, ChevronDown, ClipboardList, Search, Users } from 'lucide-react';
import { useNavigate } from 'react-router';
import type { Client, Vehicle } from '../../types';
import { calcularDemanda, type GrupoDemanda } from '../../lib/demanda';

/**
 * «Lo que buscan y no tienes»: qué piden los clientes activos y qué parte de
 * eso no hay en el inventario. Sirve para decidir qué comprar. Usa los datos
 * que Inventario ya tiene cargados (no hace consultas nuevas).
 */

const PERIODOS = [
  { dias: 30, texto: '30 días' },
  { dias: 90, texto: '3 meses' },
  { dias: 180, texto: '6 meses' },
  { dias: 0, texto: 'Todos' },
];

const hace = (d: Date | null) => {
  if (!d) return '';
  const dias = Math.max(0, Math.floor((Date.now() - d.getTime()) / 86_400_000));
  return dias === 0 ? 'hoy' : dias === 1 ? 'ayer' : dias < 60 ? `hace ${dias} días` : `hace ${Math.round(dias / 30)} meses`;
};

export function LoQueBuscan({ clientes, autos, agencyId, esVendedor, onCerrar }: {
  clientes: Client[];
  autos: Vehicle[];
  agencyId?: string;
  esVendedor: boolean;
  onCerrar: () => void;
}) {
  const navigate = useNavigate();
  const [dias, setDias] = useState(90);
  const [soloSinOpcion, setSoloSinOpcion] = useState(true);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const d = useMemo(() => calcularDemanda(clientes, autos, agencyId, dias || undefined), [clientes, autos, agencyId, dias]);
  const grupos = soloSinOpcion ? d.grupos.filter((g) => g.sinOpcion > 0) : d.grupos;
  const maxRango = Math.max(1, ...d.rangos.map((r) => Math.max(r.piden, r.tienes)));
  const pct = d.activos ? Math.round((d.sinOpcion / d.activos) * 100) : 0;

  const copiarLista = async () => {
    const renglones = d.grupos.filter((g) => g.sinOpcion > 0).slice(0, 15)
      .map((g, i) => `${i + 1}. ${g.titulo}${g.detalle ? ` (${g.detalle})` : ''}: ${g.sinOpcion} ${g.sinOpcion === 1 ? 'cliente' : 'clientes'} sin opción`);
    const texto = [`Lo que buscan y no tenemos (${PERIODOS.find((p) => p.dias === dias)?.texto.toLowerCase()})`, '', ...renglones].join('\n');
    try { await navigator.clipboard.writeText(texto); setCopiado(true); setTimeout(() => setCopiado(false), 2500); } catch { /* sin permiso */ }
  };

  const verCliente = (id: string) => navigate('/persons', { state: { clientId: id } });

  const tarjeta = (g: GrupoDemanda) => {
    const abiertoEste = abierto === g.clave;
    return (
      <li key={g.clave} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
        <button type="button" onClick={() => setAbierto(abiertoEste ? null : g.clave)} aria-expanded={abiertoEste}
          className="w-full text-left p-3.5 flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <p className="font-extrabold text-slate-900 dark:text-white truncate">{g.titulo}</p>
            {g.detalle && <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{g.detalle}</p>}
            <div className="flex flex-wrap gap-1.5 mt-2">
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-200">{g.clientes.length} {g.clientes.length === 1 ? 'lo busca' : 'lo buscan'}</span>
              {g.sinOpcion > 0 && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200">{g.sinOpcion} sin ninguna opción</span>}
              {!g.clave.startsWith('p:') && (
                <span className={clsx('text-[11px] font-bold px-2 py-0.5 rounded-full', g.tienesExactos ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200' : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200')}>
                  {g.tienesExactos ? `Tienes ${g.tienesExactos} así` : 'No tienes ninguno así'}
                </span>
              )}
            </div>
          </div>
          <ChevronDown className={clsx('w-5 h-5 text-slate-500 shrink-0 mt-0.5 transition-transform', abiertoEste && 'rotate-180')} />
        </button>
        {abiertoEste && (
          <ul className="border-t border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700/60">
            {g.clientes.map((c) => (
              <li key={c.id} className="px-3.5 py-2 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <button type="button" onClick={() => verCliente(c.id)} className="text-sm font-bold text-slate-900 dark:text-slate-100 hover:underline truncate block max-w-full text-left">{c.nombre}</button>
                  <p className="text-xs text-slate-600 dark:text-slate-400">{[c.presupuesto, c.desde ? `llegó ${hace(c.desde)}` : ''].filter(Boolean).join(' · ')}</p>
                </div>
                <span className={clsx('text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0', c.opciones ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200' : 'bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200')}>
                  {c.opciones ? `${c.opciones} ${c.opciones === 1 ? 'opción' : 'opciones'}` : 'Sin opción'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <div className="fixed inset-0 z-[90] bg-slate-50 dark:bg-slate-900 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="titulo-buscan">
      <div className="max-w-6xl mx-auto px-4 py-4 md:py-6 flex flex-col gap-5">
        <header className="flex flex-col gap-3">
          <button type="button" onClick={onCerrar} className="self-start flex items-center gap-1 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white">
            <ArrowLeft className="w-4 h-4" /> Inventario
          </button>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 id="titulo-buscan" className="text-xl md:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">Lo que buscan y no tienes</h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 max-w-2xl">
                Lo que piden {esVendedor ? 'tus clientes' : 'los clientes'} activos (ni ganados ni perdidos) comparado con los autos disponibles. Úsalo para decidir qué comprar.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex p-1 rounded-lg bg-slate-200/70 dark:bg-slate-800" role="group" aria-label="Clientes que llegaron o se movieron en">
                {PERIODOS.map((p) => (
                  <button key={p.dias} type="button" onClick={() => setDias(p.dias)} aria-pressed={dias === p.dias}
                    className={clsx('px-2.5 py-1 rounded-md text-xs font-bold', dias === p.dias ? 'bg-white dark:bg-slate-700 shadow text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400')}>
                    {p.texto}
                  </button>
                ))}
              </div>
              <button type="button" onClick={copiarLista} disabled={!d.sinOpcion}
                className="min-h-[34px] px-3 rounded-lg bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5">
                {copiado ? <><Check className="w-4 h-4" /> Copiada</> : <><ClipboardList className="w-4 h-4" /> Copiar lista de compras</>}
              </button>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">Clientes buscando auto</p>
            <p className="text-3xl font-extrabold text-slate-900 dark:text-white">{d.activos}</p>
            <p className="text-xs text-slate-600 dark:text-slate-400">con lo que buscan capturado</p>
          </div>
          <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-red-800 dark:text-red-300">Sin ninguna opción</p>
            <p className="text-3xl font-extrabold text-red-800 dark:text-red-200">{d.sinOpcion}</p>
            <p className="text-xs text-red-800/80 dark:text-red-300/80">{pct}% no tiene ni un auto parecido</p>
          </div>
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">Autos disponibles</p>
            <p className="text-3xl font-extrabold text-slate-900 dark:text-white">{d.inventario}</p>
            <p className="text-xs text-slate-600 dark:text-slate-400">sin contar apartados ni vendidos</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-5 items-start">
          {/* Por presupuesto */}
          <section className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <h2 className="font-extrabold text-slate-900 dark:text-white">Por presupuesto</h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">Cuántos clientes piden en cada rango y cuántos autos tienes ahí.</p>
            <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-2">
              <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-blue-600" /> Clientes</span>
              <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-slate-400" /> Autos</span>
            </div>
            <ul className="flex flex-col gap-3">
              {d.rangos.map((r) => {
                const faltan = r.piden > r.tienes;
                return (
                  <li key={r.etiqueta}>
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="font-bold text-slate-800 dark:text-slate-200">{r.etiqueta}</span>
                      {faltan && <span className="text-[11px] font-bold text-red-700 dark:text-red-300">Faltan autos</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-2.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden"><div className="h-full bg-blue-600 rounded-full" style={{ width: `${(r.piden / maxRango) * 100}%` }} /></div>
                      <span className="w-16 text-right text-xs font-semibold text-slate-700 dark:text-slate-300">{r.piden} {r.piden === 1 ? 'cliente' : 'clientes'}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-2.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden"><div className="h-full bg-slate-400 rounded-full" style={{ width: `${(r.tienes / maxRango) * 100}%` }} /></div>
                      <span className="w-16 text-right text-xs font-semibold text-slate-700 dark:text-slate-300">{r.tienes} {r.tienes === 1 ? 'auto' : 'autos'}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-3">El rango de cada cliente es lo máximo que dijo poder pagar.</p>
          </section>

          {/* Lo que más piden */}
          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-extrabold text-slate-900 dark:text-white">Lo que más piden</h2>
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                <input type="checkbox" checked={soloSinOpcion} onChange={(e) => setSoloSinOpcion(e.target.checked)} className="w-4 h-4 accent-blue-700" />
                Solo lo que no tienes
              </label>
            </div>
            {grupos.length ? (
              <ul className="grid md:grid-cols-2 gap-2.5">{grupos.map(tarjeta)}</ul>
            ) : (
              <div className="bg-white dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-8 text-center">
                {d.activos ? <Search className="w-8 h-8 mx-auto text-emerald-600" /> : <Users className="w-8 h-8 mx-auto text-slate-400" />}
                <p className="font-bold text-slate-800 dark:text-slate-200 mt-2">
                  {d.activos ? 'Todos tienen al menos una opción en tu inventario.' : 'Aún no hay clientes con lo que buscan capturado.'}
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  {d.activos ? 'Quita «Solo lo que no tienes» para ver todo lo que piden.' : 'En la ficha del cliente, llena «Características del vehículo buscado»: marca, tipo, presupuesto…'}
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
