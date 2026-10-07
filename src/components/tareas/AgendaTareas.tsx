import React, { useMemo, useState } from "react";
import clsx from "clsx";
import { addDays, differenceInCalendarDays, format, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarClock, Check, ChevronDown, ChevronRight, MessageCircle, Phone, Trash2, User } from "lucide-react";
import type { Client, Task } from "../../types";

/**
 * La agenda: las tareas agrupadas por día, lo atrasado arriba y lo de hoy
 * resaltado. En cada renglón se resuelve lo común sin abrir nada: palomear,
 * mover la fecha, llamar o abrir al cliente.
 */

export interface ItemTarea { task: Task; client: Client | null }

interface Props {
  items: ItemTarea[];
  esAdmin: boolean;
  nombres: Record<string, string>;
  seleccionadas: string[];
  onSeleccionar: (id: string) => void;
  onAlternar: (id: string, actual: boolean) => void;
  onAbrir: (t: Task) => void;
  onAbrirCliente: (c: Client) => void;
  onReprogramar: (ids: string[], fecha: string) => void;
  onBorrar: (id: string) => void;
  icono: (t: Task) => React.ReactNode;
  /** Mostrar abierta la lista de completadas (cuando se filtra por ellas). */
  verCompletadas?: boolean;
}

const iso = (d: Date) => format(d, "yyyy-MM-dd");
const fechaDe = (t: Task) => (t.dueDate ? new Date(`${t.dueDate}T00:00:00`) : null);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** «10:30 a.m.» → minutos desde la medianoche, para ordenar el día. */
function minutos(t: Task): number {
  const s = String(t.startTime || "").trim().toLowerCase();
  const m = /^(\d{1,2}):(\d{2})\s*([ap])?/.exec(s);
  if (!m) return 24 * 60;
  let h = Number(m[1]);
  if (m[3] === "p" && h < 12) h += 12;
  if (m[3] === "a" && h === 12) h = 0;
  return h * 60 + Number(m[2]);
}

export function AgendaTareas(p: Props) {
  const hoy = startOfDay(new Date());
  const [cerrados, setCerrados] = useState<Record<string, boolean>>({});
  const [verTodo, setVerTodo] = useState<Record<string, boolean>>({});
  const [menu, setMenu] = useState<string | null>(null);

  const grupos = useMemo(() => {
    const g: { id: string; titulo: string; sub?: string; tono: "rojo" | "verde" | "azul" | "gris"; items: ItemTarea[]; abiertoPorOmision: boolean; acciones?: boolean }[] = [];
    const pendientes = p.items.filter((x) => !x.task.completed);
    const hechas = p.items.filter((x) => x.task.completed);
    const dias = (x: ItemTarea) => { const f = fechaDe(x.task); return f ? differenceInCalendarDays(f, hoy) : null; };
    const orden = (a: ItemTarea, b: ItemTarea) => minutos(a.task) - minutos(b.task) || String(a.task.title).localeCompare(String(b.task.title));

    const vencidas = pendientes.filter((x) => (dias(x) ?? 0) < 0 && dias(x) !== null)
      .sort((a, b) => (fechaDe(b.task)!.getTime() - fechaDe(a.task)!.getTime()) || orden(a, b));
    if (vencidas.length) g.push({ id: "vencidas", titulo: "Atrasadas", sub: vencidas.length > 3 ? `la más vieja lleva ${-(dias(vencidas[vencidas.length - 1]) as number)} días` : undefined, tono: "rojo", items: vencidas, abiertoPorOmision: true, acciones: true });
    const deHoy = pendientes.filter((x) => dias(x) === 0).sort(orden);
    if (deHoy.length) g.push({ id: "hoy", titulo: "Hoy", sub: cap(format(hoy, "EEEE d 'de' MMMM", { locale: es })), tono: "verde", items: deHoy, abiertoPorOmision: true });
    for (let n = 1; n <= 6; n++) {
      const lista = pendientes.filter((x) => dias(x) === n).sort(orden);
      if (!lista.length) continue;
      const f = addDays(hoy, n);
      g.push({ id: `d${n}`, titulo: n === 1 ? "Mañana" : cap(format(f, "EEEE", { locale: es })), sub: cap(format(f, "d 'de' MMMM", { locale: es })), tono: "azul", items: lista, abiertoPorOmision: true });
    }
    const luego = pendientes.filter((x) => (dias(x) ?? 0) > 6 && dias(x) !== null).sort((a, b) => fechaDe(a.task)!.getTime() - fechaDe(b.task)!.getTime() || orden(a, b));
    if (luego.length) g.push({ id: "luego", titulo: "Más adelante", tono: "gris", items: luego, abiertoPorOmision: true });
    const sinFecha = pendientes.filter((x) => dias(x) === null);
    if (sinFecha.length) g.push({ id: "sinfecha", titulo: "Sin fecha", tono: "gris", items: sinFecha, abiertoPorOmision: true });
    if (hechas.length) g.push({ id: "hechas", titulo: "Completadas", tono: "gris", items: hechas.sort((a, b) => String(b.task.dueDate).localeCompare(String(a.task.dueDate))), abiertoPorOmision: !!p.verCompletadas });
    return g;
  }, [p.items, p.verCompletadas]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!grupos.length) {
    return (
      <div className="py-16 text-center text-slate-500">
        <Check className="w-10 h-10 mx-auto mb-3 text-emerald-500" />
        <p className="text-base font-extrabold text-slate-800 dark:text-slate-100">Nada pendiente con estos filtros</p>
        <p className="text-sm mt-1">Cuando agendes una actividad aparecerá aquí, ordenada por día.</p>
      </div>
    );
  }

  const opciones = (ids: string[]) => {
    const l = (n: number) => iso(addDays(hoy, n));
    const lunes = iso(addDays(hoy, ((8 - hoy.getDay()) % 7) || 7));
    return [
      { t: "Hoy", f: l(0) },
      { t: "Mañana", f: l(1) },
      { t: "En 2 días", f: l(2) },
      { t: "Próxima semana", f: lunes },
    ].map((o) => (
      <button key={o.t} onClick={() => { p.onReprogramar(ids, o.f); setMenu(null); }} className="w-full text-left px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md">
        {o.t}
      </button>
    ));
  };

  return (
    <div className="space-y-3 p-3 md:p-4">
      {grupos.map((g) => {
        const abierto = cerrados[g.id] === undefined ? g.abiertoPorOmision : !cerrados[g.id];
        const visibles = abierto ? g.items.slice(0, verTodo[g.id] ? 500 : 25) : [];
        const color = g.tono === "rojo" ? "text-red-700 dark:text-red-400" : g.tono === "verde" ? "text-emerald-700 dark:text-emerald-400" : g.tono === "azul" ? "text-blue-700 dark:text-blue-400" : "text-slate-600 dark:text-slate-300";
        return (
          <section key={g.id} className={clsx("rounded-xl border bg-white dark:bg-slate-800 overflow-visible", g.tono === "rojo" ? "border-red-200 dark:border-red-900/60" : g.tono === "verde" ? "border-emerald-200 dark:border-emerald-900/60" : "border-slate-200 dark:border-slate-700")}>
            <div className="flex items-center gap-2 px-4 py-2.5">
              <button onClick={() => setCerrados({ ...cerrados, [g.id]: abierto })} className="flex-1 min-w-0 flex items-center gap-2 text-left" aria-expanded={abierto}>
                {abierto ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                <span className={clsx("text-sm font-extrabold", color)}>{g.titulo}</span>
                <span className="text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-700 rounded-full px-2">{g.items.length}</span>
                {g.sub && <span className="text-xs text-slate-500 truncate">{g.sub}</span>}
              </button>
              {g.acciones && (
                <div className="relative">
                  <button onClick={() => setMenu(menu === `g-${g.id}` ? null : `g-${g.id}`)} className="h-8 px-3 rounded-lg border border-slate-300 dark:border-slate-600 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-1.5">
                    <CalendarClock className="w-3.5 h-3.5" /> Reprogramar todas
                  </button>
                  {menu === `g-${g.id}` && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setMenu(null)} />
                      <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-40 p-1">{opciones(g.items.map((x) => x.task.id))}</div>
                    </>
                  )}
                </div>
              )}
            </div>

            {visibles.length > 0 && (
              <ul className="divide-y divide-slate-100 dark:divide-slate-700/60 border-t border-slate-100 dark:border-slate-700/60">
                {visibles.map(({ task, client }) => {
                  const f = fechaDe(task);
                  const atraso = f && !task.completed ? differenceInCalendarDays(hoy, f) : 0;
                  const sel = p.seleccionadas.includes(task.id);
                  const asesor = p.esAdmin ? p.nombres[task.sellerId] || "" : "";
                  const telefono = String(client?.phone || "").replace(/\D/g, "");
                  return (
                    <li key={task.id} className={clsx("group flex items-start gap-3 px-3 md:px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/30", sel && "bg-blue-50 dark:bg-blue-950/30")}>
                      <button
                        onClick={() => p.onAlternar(task.id, !!task.completed)}
                        aria-label={task.completed ? "Marcar como pendiente" : "Marcar como hecha"}
                        title={task.completed ? "Marcar como pendiente" : "Marcar como hecha"}
                        className={clsx("mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors", task.completed ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-300 dark:border-slate-500 hover:border-emerald-500 hover:bg-emerald-50 text-transparent hover:text-emerald-500")}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>

                      <button onClick={() => p.onAbrir(task)} className="flex-1 min-w-0 text-left">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={clsx("shrink-0", task.completed ? "text-slate-400" : "text-slate-500 dark:text-slate-400")}>{p.icono(task)}</span>
                          <span className={clsx("text-sm font-bold truncate", task.completed ? "line-through text-slate-400" : "text-slate-900 dark:text-slate-100")}>{task.title}</span>
                          {task.startTime && <span className="shrink-0 text-[11px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded px-1.5 py-0.5">{task.startTime}</span>}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                          {client?.name && <span className="flex items-center gap-1 min-w-0"><User className="w-3 h-3 shrink-0" /><span className="truncate">{client.name}</span></span>}
                          {(client as any)?.vehicle && <span className="truncate">{(client as any).vehicle}</span>}
                          {asesor && <span className="font-semibold text-slate-600 dark:text-slate-300">· {asesor}</span>}
                          {atraso > 0 && <span className="font-bold text-red-600 dark:text-red-400">venció hace {atraso} día{atraso === 1 ? "" : "s"}</span>}
                          {g.id === "luego" && f && <span>{cap(format(f, "EEE d 'de' MMM", { locale: es }))}</span>}
                          {g.id === "hechas" && f && <span>{cap(format(f, "d 'de' MMM", { locale: es }))}</span>}
                        </div>
                      </button>

                      <div className={clsx("flex items-center gap-0.5 shrink-0", sel ? "opacity-100" : "sm:opacity-0 group-hover:opacity-100 focus-within:opacity-100")}>
                        {telefono.length >= 8 && <a href={`tel:${telefono}`} title="Llamar" aria-label="Llamar" className="p-1.5 rounded-md text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"><Phone className="w-4 h-4" /></a>}
                        {telefono.length >= 10 && <a href={`https://wa.me/${telefono.length === 10 ? "52" : ""}${telefono}`} target="_blank" rel="noreferrer" title="WhatsApp" aria-label="WhatsApp" className="p-1.5 rounded-md text-slate-500 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950/30"><MessageCircle className="w-4 h-4" /></a>}
                        {client && <button onClick={() => p.onAbrirCliente(client)} title="Abrir al cliente" aria-label="Abrir al cliente" className="p-1.5 rounded-md text-slate-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30"><User className="w-4 h-4" /></button>}
                        {!task.completed && (
                          <div className="relative">
                            <button onClick={() => setMenu(menu === task.id ? null : task.id)} title="Mover de fecha" aria-label="Mover de fecha" className="p-1.5 rounded-md text-slate-500 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30"><CalendarClock className="w-4 h-4" /></button>
                            {menu === task.id && (
                              <>
                                <div className="fixed inset-0 z-30" onClick={() => setMenu(null)} />
                                <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-40 p-1">{opciones([task.id])}</div>
                              </>
                            )}
                          </div>
                        )}
                        <button onClick={() => p.onBorrar(task.id)} title="Borrar" aria-label="Borrar" className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"><Trash2 className="w-4 h-4" /></button>
                        <input type="checkbox" checked={sel} onChange={() => p.onSeleccionar(task.id)} aria-label="Seleccionar" className="ml-1 w-4 h-4 rounded border-slate-300 accent-blue-600 cursor-pointer" />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            {abierto && g.items.length > 25 && !verTodo[g.id] && (
              <button onClick={() => setVerTodo({ ...verTodo, [g.id]: true })} className="w-full py-2.5 text-xs font-bold text-blue-700 dark:text-blue-400 border-t border-slate-100 dark:border-slate-700/60 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                Ver las otras {g.items.length - 25}
              </button>
            )}
          </section>
        );
      })}
    </div>
  );
}
