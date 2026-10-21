import { useState } from "react";
import { useNavigate } from "react-router";
import { CheckCircle2, ChevronRight, ChevronDown } from "lucide-react";
import clsx from "clsx";
import { useAvisosDelDia, useAvisosListos, type GrupoDeAvisos, type Nivel } from "../../lib/avisosDelDia";
import { GRUPOS } from "../NotificationsPopover";

/**
 * «Lo de hoy»: lo primero que ve cada persona al abrir el CRM en el celular. Es la misma lista que la campanita (urgente
 * primero), pero a la vista y con un toque para ir directo a atenderlo. Sirve igual para el administrador que para el
 * vendedor: cada quien ve lo que le toca, porque la campanita ya filtra por rol.
 */

const NIVELES: { id: Nivel; titulo: string; punto: string; pastilla: string }[] = [
  { id: "ahora", titulo: "Atiende ahora", punto: "bg-red-500", pastilla: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300" },
  { id: "hoy", titulo: "Hoy y mañana", punto: "bg-amber-500", pastilla: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" },
];

const total = (gs: GrupoDeAvisos[]) => gs.reduce((s, g) => s + g.items.length, 0);

export function resumenDeHoy(ahora: number, hoy: number) {
  if (!ahora && !hoy) return "Todo al día. No tienes pendientes urgentes.";
  const partes = [ahora && `${ahora} ${ahora === 1 ? "cosa" : "cosas"} por atender ahora`, hoy && `${hoy} para hoy y mañana`].filter(Boolean);
  return partes.join(" · ");
}

function Grupo({ g, nivel, abierto, alternar }: { g: GrupoDeAvisos; nivel: Nivel; abierto: boolean; alternar: () => void }) {
  const navigate = useNavigate();
  const def = GRUPOS[g.grupo];
  if (!def) return null;
  const { Icono } = def;
  const n = g.items.length;
  const urgente = nivel === "ahora";
  // Un toque en el título va a la pantalla de ese tema; si no tiene (p. ej. coincidencias), abre el primero.
  const ir = () => { if (def.ruta) navigate(def.ruta); else g.items[0]?.onClick?.(); };
  return (
    <div className={clsx("rounded-2xl bg-white dark:bg-slate-800 shadow-sm ring-1 overflow-hidden", urgente ? "ring-red-200/70 dark:ring-red-900/50" : "ring-slate-200/70 dark:ring-slate-700")}>
      <div className="flex items-center">
        <button onClick={ir} className="flex-1 min-w-0 flex items-center gap-3 px-3.5 py-3 text-left active:bg-slate-50 dark:active:bg-slate-700/40">
          <span className={clsx("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", urgente ? "bg-red-50 dark:bg-red-950/40" : "bg-amber-50 dark:bg-amber-950/30")}>
            <Icono className={clsx("w-5 h-5", def.color)} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-bold leading-tight text-slate-900 dark:text-white">
              <span className="tabular-nums">{n}</span> · {def.titulo(n)}
            </span>
            {g.detalle && <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{g.detalle}</span>}
          </span>
          <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
        </button>
        {n > 0 && (
          <button
            onClick={alternar}
            aria-expanded={abierto}
            aria-label={abierto ? "Ocultar detalle" : "Ver el detalle"}
            className="h-full px-3 self-stretch border-l border-slate-100 dark:border-slate-700 text-slate-400 active:bg-slate-50 dark:active:bg-slate-700/40"
          >
            <ChevronDown className={clsx("w-4 h-4 transition-transform", abierto && "rotate-180")} />
          </button>
        )}
      </div>
      {abierto && (
        <ul className="border-t border-slate-100 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
          {g.items.slice(0, 5).map((it) => (
            <li key={it.id}>
              <button onClick={() => it.onClick?.()} disabled={!it.onClick} className="w-full text-left px-4 py-2.5 active:bg-slate-50 dark:active:bg-slate-700/40">
                <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100 line-clamp-1">{it.title}</p>
                {it.message && <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">{it.message}</p>}
              </button>
            </li>
          ))}
          {n > 5 && def.ruta && (
            <li><button onClick={ir} className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300">{def.verTodas || "Ver todos"} ({n}) →</button></li>
          )}
        </ul>
      )}
    </div>
  );
}

export function HoyMovil() {
  const por = useAvisosDelDia();
  const listo = useAvisosListos();
  // Lo urgente se abre solo para ver de qué se trata; lo demás, cerrado.
  const [abiertos, setAbiertos] = useState<Record<string, boolean>>({});
  const [verSeguimiento, setVerSeguimiento] = useState(false);
  const nAhora = total(por.ahora);
  const nHoy = total(por.hoy);
  const nSeg = total(por.seguimiento);

  return (
    <section aria-label="Lo de hoy" className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">Lo de hoy</h2>
        {(nAhora > 0 || nHoy > 0) && <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{nAhora + nHoy} en total</span>}
      </div>

      {nAhora === 0 && nHoy === 0 && !listo && (
        <div className="rounded-2xl bg-white dark:bg-slate-800 ring-1 ring-slate-200/70 dark:ring-slate-700 px-4 py-4 text-sm text-slate-500">Revisando lo de hoy…</div>
      )}

      {nAhora === 0 && nHoy === 0 && listo && (
        <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 ring-1 ring-emerald-200/70 dark:ring-emerald-900/50 px-4 py-4 flex items-center gap-3">
          <CheckCircle2 className="w-8 h-8 text-emerald-500 shrink-0" />
          <div>
            <p className="text-[15px] font-bold text-emerald-900 dark:text-emerald-200">Todo al día</p>
            <p className="text-xs text-emerald-800/80 dark:text-emerald-300/80">No tienes nada urgente. Buen momento para dar seguimiento a tus prospectos.</p>
          </div>
        </div>
      )}

      {NIVELES.map((nv) => {
        const gs = por[nv.id];
        if (!gs.length) return null;
        return (
          <div key={nv.id} className="space-y-2">
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
              <span className={clsx("w-2 h-2 rounded-full", nv.punto)} /> {nv.titulo}
            </p>
            {gs.map((g) => (
              <Grupo
                key={g.grupo}
                g={g}
                nivel={nv.id}
                abierto={abiertos[g.grupo] ?? (nv.id === "ahora" && g.items.length <= 2)}
                alternar={() => setAbiertos((a) => ({ ...a, [g.grupo]: !(a[g.grupo] ?? (nv.id === "ahora" && g.items.length <= 2)) }))}
              />
            ))}
          </div>
        );
      })}

      {nSeg > 0 && (
        <div className="space-y-2">
          <button onClick={() => setVerSeguimiento((v) => !v)} aria-expanded={verSeguimiento} className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
            <span className="w-2 h-2 rounded-full bg-slate-400" /> Seguimiento ({nSeg})
            <ChevronDown className={clsx("w-3.5 h-3.5 transition-transform", verSeguimiento && "rotate-180")} />
          </button>
          {verSeguimiento && por.seguimiento.map((g) => (
            <Grupo
              key={g.grupo}
              g={g}
              nivel="seguimiento"
              abierto={!!abiertos[g.grupo]}
              alternar={() => setAbiertos((a) => ({ ...a, [g.grupo]: !a[g.grupo] }))}
            />
          ))}
        </div>
      )}
    </section>
  );
}
