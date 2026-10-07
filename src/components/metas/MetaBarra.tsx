import clsx from "clsx";
import { avanceDeMeta, TEXTO_ESTADO } from "../../lib/metas";

/** Barra de avance de una meta, con su estado en palabras. */
export function MetaBarra({ ventas, meta, mes, unidad = "autos", oscuro = false, compacta = false, formato }: {
  ventas: number; meta: number; mes: string; unidad?: string; oscuro?: boolean; compacta?: boolean; formato?: (n: number) => string;
}) {
  const f = formato || ((n: number) => String(n));
  const a = avanceDeMeta(ventas, meta, mes);
  const e = TEXTO_ESTADO[a.estado];
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2">
        <p className={clsx("font-extrabold", compacta ? "text-sm" : "text-base", oscuro ? "text-white" : "text-slate-900 dark:text-white")}>
          {f(ventas)}<span className={clsx("font-semibold", oscuro ? "text-white/60" : "text-slate-500")}> de {meta ? f(meta) : "—"} {unidad}</span>
        </p>
        {meta > 0 && <span className={clsx("text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0", e.chip)}>{e.t}</span>}
      </div>
      <div className={clsx("rounded-full overflow-hidden mt-1.5", compacta ? "h-1.5" : "h-2", oscuro ? "bg-white/15" : "bg-slate-200 dark:bg-slate-700")}>
        <div className={clsx("h-full transition-all", e.barra)} style={{ width: `${a.pct}%` }} />
      </div>
      {!compacta && meta > 0 && (
        <p className={clsx("text-[11px] mt-1", oscuro ? "text-white/60" : "text-slate-500")}>
          {a.estado === "cumplida" ? "¡Meta cumplida!" : a.diasRestantes === 0 ? `Faltaron ${f(a.falta)}` : `Faltan ${f(a.falta)} · quedan ${a.diasRestantes} día${a.diasRestantes === 1 ? "" : "s"}`}
          {a.proyeccion != null && a.estado !== "cumplida" && a.diasRestantes > 0 ? ` · a este ritmo cierras en ${formato ? f(Math.round(a.proyeccion)) : a.proyeccion}` : ""}
        </p>
      )}
    </div>
  );
}
