import React, { useEffect, useMemo, useState } from 'react';
import { alClicWhatsApp } from '../../lib/whatsappApp';
import clsx from 'clsx';
import { Car as CarIcon, MessageCircle } from 'lucide-react';
import { auth } from '../../lib/firebase';
import { getApiUrl } from '../../lib/api';
import { checkIsLost, checkIsWon } from '../../lib/clientUtils';
import { etiquetaDeFuente, fuenteDelContacto } from '../../lib/fuentes';
import { diasDesde } from '../../lib/interesPorAuto';
import type { PrecioMercado } from '../../lib/precioMercado';
import { getVehicleMatches } from '../../pages/Inventory';
import { getClientMatches } from '../../services/matchingEngine';
import { useSharedInventoryMatches } from '../../hooks/useSharedInventoryMatches';
import { GraficaMercado } from '../inventario/GraficaMercado';
import type { Task, Vehicle } from '../../types';

/**
 * Lo importante de un cliente a primera vista: cinco recuadros (pendiente,
 * etapa, vendedor, cómo llegó, interés) y sus autos de interés como tarjetas.
 * Solo lee: nada de aquí escribe en el contacto ni en sus tratos.
 */

interface Props {
  cliente: any;
  tratos: any[];
  tareas: Task[];
  etapas: { id: string; title?: string }[];
  usuarios: any[];
  inventario: Vehicle[];
  onAbrirAuto?: (v: Vehicle) => void;
  /** Cotizar un auto a este cliente (sin auto: elegirlo del inventario). */
  onCotizar?: (v: Vehicle | null) => void;
  /** Sección «Autos de interés» del menú: sin los recuadros de arriba. */
  soloAutos?: boolean;
  /** Columna angosta de la ficha en pantalla completa: interés y autos en lista. */
  columna?: boolean;
}

const pesos = (n: number) => `$${Math.round(Number(n) || 0).toLocaleString('es-MX')}`;

const fechaIso = (v: any): string | null => {
  if (!v) return null;
  if (typeof v === 'string') return v;
  if (typeof v.toDate === 'function') return v.toDate().toISOString();
  const s = v.seconds ?? v._seconds;
  return typeof s === 'number' ? new Date(s * 1000).toISOString() : null;
};

const cuando = (iso: string | null) => {
  const d = diasDesde(iso);
  if (d === null) return '';
  if (d === 0) return 'hoy';
  if (d === 1) return 'ayer';
  return `hace ${d} días`;
};

function textoDeTarea(t: Task) {
  if (!t.dueDate) return 'Sin fecha';
  const fecha = new Date(`${t.dueDate.slice(0, 10)}T12:00:00`);
  const hoy = new Date(); hoy.setHours(12, 0, 0, 0);
  const dif = Math.round((fecha.getTime() - hoy.getTime()) / 86400000);
  const dia = dif === 0 ? 'Hoy' : dif === 1 ? 'Mañana' : dif === -1 ? 'Ayer'
    : fecha.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' });
  const hora = t.dueTime || t.startTime;
  return hora ? `${dia}, ${hora}` : dia;
}

function Recuadro({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-3 flex flex-col gap-1 min-w-0">
      <span className="text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">{titulo}</span>
      {children}
    </div>
  );
}

export function ResumenCliente({ cliente, tratos, tareas, etapas, usuarios, inventario, onAbrirAuto, onCotizar, soloAutos, columna }: Props) {
  const [mercado, setMercado] = useState<Record<string, PrecioMercado | null> | null>(null);
  useEffect(() => {
    let vigente = true;
    (async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        const r = await fetch(getApiUrl('/api/mercado/inventario'), { headers: { Authorization: `Bearer ${token}` } });
        if (r.ok && vigente) setMercado((await r.json()).porAuto || {});
      } catch {
        // Sin dato de mercado las tarjetas no muestran la barra.
      }
    })();
    return () => { vigente = false; };
  }, []);

  // --- Pendiente
  const pendientes = useMemo(
    () => tareas.filter((t) => !t.completed).sort((a, b) =>
      `${a.dueDate || '9999'} ${a.dueTime || ''}`.localeCompare(`${b.dueDate || '9999'} ${b.dueTime || ''}`)),
    [tareas]
  );
  const hoyTxt = new Date().toLocaleDateString('en-CA');
  const vencidas = pendientes.filter((t) => t.dueDate && t.dueDate.slice(0, 10) < hoyTxt).length;
  const proxima = pendientes[0];

  // --- Etapa
  const status = cliente.status || '';
  const ganado = checkIsWon(status, etapas);
  const perdido = checkIsLost(status, etapas);
  const etapasDelEmbudo = etapas.filter((e) => !checkIsLost(e.id, etapas));
  const indice = etapasDelEmbudo.findIndex((e) => e.id === status);
  const nombreEtapa = ganado ? 'Ganado' : perdido ? 'Solo contacto' : (etapas.find((e) => e.id === status)?.title || 'Sin etapa');

  // --- Vendedor
  const vendedor = usuarios.find((u) => u.id === cliente.sellerId);

  // --- Interés: cuándo escribió el cliente por última vez.
  const ultimoDelCliente = fechaIso(cliente.chatUltimoEntranteAt) || fechaIso(cliente.lastWhatsappInboundAt);
  const dias = diasDesde(ultimoDelCliente);
  const interes = dias === null
    ? { nivel: 'Sin mensajes', pct: 0, color: '#94a3b8', clase: 'text-slate-600 dark:text-slate-400' }
    : dias <= 3 ? { nivel: 'Alto', pct: 85, color: '#ea580c', clase: 'text-orange-700 dark:text-orange-400' }
    : dias <= 14 ? { nivel: 'Medio', pct: 50, color: '#d97706', clase: 'text-amber-700 dark:text-amber-400' }
    : { nivel: 'Bajo', pct: 20, color: '#64748b', clase: 'text-slate-700 dark:text-slate-300' };

  // --- Autos de interés: los de sus tratos y su ficha, y luego los que
  // coinciden con lo que busca.
  const autos = useMemo(() => {
    const porId = new Map(inventario.map((v) => [v.id, v]));
    const lista: { v: Vehicle; etiqueta: string; tipo: 'trato' | 'ficha' | 'coincide' }[] = [];
    const vistos = new Set<string>();
    tratos.filter((t) => !t.isDeleted && t.vehicleId).forEach((t) => {
      const v = porId.get(t.vehicleId);
      if (!v || vistos.has(v.id)) return;
      vistos.add(v.id);
      const abierto = !checkIsWon(t.status, etapas) && !checkIsLost(t.status, etapas);
      lista.push({ v, etiqueta: checkIsWon(t.status, etapas) ? 'Lo compró' : abierto ? 'Trato abierto' : 'Trato cerrado', tipo: 'trato' });
    });
    const propio = cliente.vehicleId && porId.get(cliente.vehicleId);
    if (propio && !vistos.has(propio.id)) {
      vistos.add(propio.id);
      lista.push({ v: propio, etiqueta: 'Preguntó por él', tipo: 'ficha' });
    }
    if (!ganado) {
      inventario
        .filter((v) => !vistos.has(v.id))
        .map((v) => ({ v, m: getVehicleMatches(v, [cliente])[0] }))
        .filter((x) => x.m && x.m.level !== 'low')
        .slice(0, columna ? 4 : 3)
        .forEach(({ v }) => lista.push({ v, etiqueta: 'Coincide con lo que busca', tipo: 'coincide' }));
    }
    return lista.slice(0, columna ? 8 : 6);
  }, [inventario, tratos, cliente, etapas, ganado, columna]);

  // Autos de agencias aliadas que le sirven (solo si ambas comparten inventario
  // y quien mira es administrador o gerente: la misma regla que la campanita).
  const { otherVehicles, sharingAgencies } = useSharedInventoryMatches();
  const deAliadas = useMemo(() => {
    if (ganado || !otherVehicles.length) return [];
    return getClientMatches({ ...cliente, status: 'open' } as any, otherVehicles).slice(0, 4);
  }, [otherVehicles, cliente, ganado]);

  const telefono = String(cliente.phone || '').replace(/\D/g, '');
  const whatsapp = (v: Vehicle) => {
    if (!telefono) return null;
    const num = telefono.length === 10 ? `52${telefono}` : telefono;
    const nombre = String(cliente.name || '').split(' ')[0];
    const liga = v.websiteUrl ? `\n${v.websiteUrl}` : '';
    const texto = `Hola${nombre ? ` ${nombre}` : ''}, te comparto el ${v.year} ${v.make} ${v.model} en ${pesos(v.price || 0)}.${liga}`;
    return `https://wa.me/${num}?text=${encodeURIComponent(texto)}`;
  };

  const estiloEtiqueta = (tipo: string) =>
    tipo === 'trato' ? 'bg-blue-700 text-white' : tipo === 'coincide' ? 'bg-emerald-700 text-white' : 'bg-white text-slate-900';

  if (columna) {
    const propios = autos.filter((a) => a.tipo !== 'coincide');
    const sugeridos = autos.filter((a) => a.tipo === 'coincide');
    const fila = ({ v, etiqueta, tipo }: (typeof autos)[number]) => {
      const foto = v.photoUrls?.[0] || v.photoUrl;
      const liga = whatsapp(v);
      return (
        <li key={v.id} className="flex gap-3 items-center">
          <button type="button" onClick={() => onAbrirAuto?.(v)} className="w-20 h-14 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-700 shrink-0" aria-label={`Ver ${v.make} ${v.model}`}>
            {foto ? <img src={foto} alt="" loading="lazy" className="w-full h-full object-cover" /> : <span className="w-full h-full flex items-center justify-center text-slate-300"><CarIcon className="w-6 h-6" /></span>}
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{v.year} {v.make} {v.model}</p>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              <b className="text-slate-900 dark:text-white">{pesos(v.price || 0)}</b>
              {tipo !== 'coincide' && <> · {etiqueta}</>}
              {v.status === 'sold' && <> · Vendido</>}
            </p>
            <div className="flex gap-3 mt-0.5 text-xs font-bold">
              {onCotizar && v.status !== 'sold' && <button type="button" onClick={() => onCotizar(v)} className="text-blue-700 dark:text-blue-300 hover:underline">Cotizar</button>}
              {liga && v.status !== 'sold' && <a href={liga} onClick={alClicWhatsApp} target="_blank" rel="noopener noreferrer" className="text-green-700 dark:text-green-400 hover:underline">Mandar</a>}
              {onAbrirAuto && <button type="button" onClick={() => onAbrirAuto(v)} className="text-slate-600 dark:text-slate-300 hover:underline">Ver auto</button>}
            </div>
          </div>
        </li>
      );
    };
    return (
      <div className="flex flex-col gap-4">
        <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0" style={{ background: `conic-gradient(${interes.color} 0 ${interes.pct}%, #e2e8f0 ${interes.pct}% 100%)` }} aria-hidden>
            <div className="w-9 h-9 rounded-full bg-white dark:bg-slate-800" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">Interés</span>
            <span className={clsx('text-sm font-extrabold', interes.clase)}>{interes.nivel}</span>
            <span className="text-xs text-slate-600 dark:text-slate-400 truncate">{ultimoDelCliente ? `Escribió ${cuando(ultimoDelCliente)}` : 'Aún no escribe por WhatsApp'}</span>
          </div>
        </section>

        <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="font-extrabold text-slate-900 dark:text-white">Autos de interés</h2>
            {onCotizar && <button type="button" onClick={() => onCotizar(null)} className="text-xs font-bold text-blue-700 dark:text-blue-300 hover:underline">Cotizar otro</button>}
          </div>
          {propios.length ? <ul className="flex flex-col gap-3">{propios.map(fila)}</ul>
            : <p className="text-sm text-slate-500 dark:text-slate-400">Sin auto asignado. Elígelo en «Datos del cliente».</p>}
        </section>

        {sugeridos.length > 0 && (
          <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
            <h2 className="font-extrabold text-slate-900 dark:text-white">Le pueden servir</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">De tu inventario, según lo que busca</p>
            <ul className="flex flex-col gap-3">{sugeridos.map(fila)}</ul>
          </section>
        )}

        {deAliadas.length > 0 && (
          <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
            <h2 className="font-extrabold text-slate-900 dark:text-white">De otras agencias</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Inventario compartido que cumple lo que busca</p>
            <ul className="flex flex-col gap-3">
              {deAliadas.map((m) => {
                const foto = m.vehicle.photoUrls?.[0] || m.vehicle.photoUrl;
                return (
                  <li key={`${m.vehicle.agencyId}_${m.vehicle.id}`} className="flex gap-3 items-center">
                    <div className="w-20 h-14 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-700 shrink-0">
                      {foto ? <img src={foto} alt="" loading="lazy" className="w-full h-full object-cover" /> : <span className="w-full h-full flex items-center justify-center text-slate-300"><CarIcon className="w-6 h-6" /></span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{m.vehicle.year} {m.vehicle.make} {m.vehicle.model}</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400"><b className="text-slate-900 dark:text-white">{pesos(m.vehicle.price || 0)}</b> · {sharingAgencies[m.vehicle.agencyId] || 'Agencia aliada'}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {m.razones.filter((x) => !x.ok).slice(0, 2).map((x, i) => <span key={i} className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-900">! {x.t}</span>)}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className={clsx("grid grid-cols-2 lg:grid-cols-5 gap-3", soloAutos && "hidden")}>
        <Recuadro titulo="Pendiente">
          {proxima ? (
            <>
              <span className="text-sm font-extrabold text-slate-900 dark:text-white line-clamp-2" title={proxima.title}>{proxima.title}</span>
              <span className={clsx('text-xs font-bold', vencidas ? 'text-red-700 dark:text-red-400' : 'text-amber-700 dark:text-amber-400')}>
                {textoDeTarea(proxima)}{pendientes.length > 1 ? ` · ${pendientes.length} tareas` : ''}{vencidas ? ` · ${vencidas} vencida${vencidas > 1 ? 's' : ''}` : ''}
              </span>
            </>
          ) : (
            <span className="text-sm font-bold text-slate-600 dark:text-slate-400">Nada pendiente</span>
          )}
        </Recuadro>

        <Recuadro titulo="Etapa">
          <span className={clsx('text-sm font-extrabold', ganado ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-900 dark:text-white')}>{nombreEtapa}</span>
          {!perdido && etapasDelEmbudo.length > 0 && (
            <div className="flex gap-0.5 mt-1" aria-hidden>
              {etapasDelEmbudo.map((e, i) => (
                <div key={e.id} className={clsx('h-1.5 flex-1 rounded-full', (ganado || i <= indice) ? (ganado ? 'bg-emerald-600' : 'bg-blue-700') : 'bg-slate-200 dark:bg-slate-700')} />
              ))}
            </div>
          )}
        </Recuadro>

        <Recuadro titulo="Vendedor">
          <span className="text-sm font-extrabold text-slate-900 dark:text-white truncate">{vendedor?.name || vendedor?.email || 'Sin asignar'}</span>
        </Recuadro>

        <Recuadro titulo="Cómo llegó">
          <span className="text-sm font-extrabold text-slate-900 dark:text-white truncate">{etiquetaDeFuente(fuenteDelContacto(cliente))}</span>
          {cliente.createdAt && (
            <span className="text-xs text-slate-600 dark:text-slate-400">{cuando(fechaIso(cliente.createdAt)) ? `Llegó ${cuando(fechaIso(cliente.createdAt))}` : ''}</span>
          )}
        </Recuadro>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-3 flex items-center gap-3 col-span-2 lg:col-span-1">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
            style={{ background: `conic-gradient(${interes.color} 0 ${interes.pct}%, #e2e8f0 ${interes.pct}% 100%)` }}
            aria-hidden
          >
            <div className="w-9 h-9 rounded-full bg-white dark:bg-slate-800" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">Interés</span>
            <span className={clsx('text-sm font-extrabold', interes.clase)}>{interes.nivel}</span>
            <span className="text-xs text-slate-600 dark:text-slate-400 truncate">
              {ultimoDelCliente ? `Escribió ${cuando(ultimoDelCliente)}` : 'Aún no escribe'}
            </span>
          </div>
        </div>
      </div>

      {soloAutos && autos.length === 0 && (
        <div className="bg-white dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-8 text-center text-sm text-slate-600 dark:text-slate-400">
          Este cliente todavía no tiene autos de interés. Asígnale uno en «Datos del cliente» o anota qué busca.
        </div>
      )}

      {autos.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
              Autos de interés <span className="text-slate-500 font-semibold">{autos.length}</span>
            </h3>
            {onCotizar && <button type="button" onClick={() => onCotizar(null)} className="text-xs font-bold text-blue-700 hover:underline">Cotizar otro auto</button>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {autos.map(({ v, etiqueta, tipo }) => {
              const foto = v.photoUrls?.[0] || v.photoUrl;
              const liga = whatsapp(v);
              const dInv = diasDesde(v.receivedAt);
              return (
                <article key={v.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden flex flex-col">
                  <div className="relative aspect-[16/9] bg-slate-100 dark:bg-slate-700">
                    {foto ? (
                      <img src={foto} alt={`${v.make} ${v.model}`} loading="lazy" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-300"><CarIcon className="w-10 h-10" /></div>
                    )}
                    <span className={clsx('absolute top-2 left-2 text-[11px] font-extrabold px-2 py-1 rounded-full shadow-sm', estiloEtiqueta(tipo))}>{etiqueta}</span>
                    {v.status === 'sold' && (
                      <span className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/65 text-white text-[11px] rounded font-medium">Vendido</span>
                    )}
                  </div>
                  <div className="p-3 flex flex-col gap-2 flex-1">
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 leading-snug line-clamp-2">{v.year} {v.make} {v.model}</h4>
                      <span className="text-[11px] text-slate-600 dark:text-slate-400">
                        {(v.km || 0).toLocaleString('es-MX')} km{dInv !== null && v.status !== 'sold' ? ` · ${dInv} días en inventario` : ''}
                      </span>
                    </div>
                    <span className="text-lg font-extrabold text-slate-900 dark:text-white">{pesos(v.price || 0)}</span>
                    {v.status !== 'sold' && (
                      <GraficaMercado precio={Number(v.price) || 0} mercado={mercado && v.id in mercado ? mercado[v.id] : undefined} />
                    )}
                    <div className="flex gap-2 mt-auto pt-1">
                      {onAbrirAuto && (
                        <button
                          type="button"
                          onClick={() => onAbrirAuto(v)}
                          className="flex-1 min-h-[36px] rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-700"
                        >
                          Ver auto
                        </button>
                      )}
                      {onCotizar && v.status !== 'sold' && (
                        <button
                          type="button"
                          onClick={() => onCotizar(v)}
                          className="flex-1 min-h-[36px] rounded-lg border border-blue-700 text-blue-800 dark:text-blue-300 bg-white dark:bg-slate-800 text-xs font-bold hover:bg-blue-50"
                        >
                          Cotizar
                        </button>
                      )}
                      {liga && v.status !== 'sold' && (
                        <a
                          href={liga}
                          onClick={alClicWhatsApp}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 min-h-[36px] rounded-lg bg-green-700 hover:bg-green-800 text-white text-xs font-bold flex items-center justify-center gap-1"
                        >
                          <MessageCircle className="w-3.5 h-3.5" /> Mandar por WhatsApp
                        </a>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
