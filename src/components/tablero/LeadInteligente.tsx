import { useMemo, useState } from "react";
import clsx from "clsx";
import { ChevronDown, ChevronRight, Flame, Snowflake, Sparkles, TrendingDown, UserX, Clock3, Car } from "lucide-react";
import { resumenDeProspectos, type ProspectoInteligente, type Temperatura } from "../../lib/prospectosInteligentes";

/**
 * Lead Intelligence: a quién atender hoy, por qué y qué decirle.
 * Cada recomendación trae sus motivos en palabras (sin números mágicos) y se
 * calcula en el navegador con los datos de la agencia: no sale a ninguna IA.
 */

type Filtro = "hoy" | "calientes" | "enfrian" | "sinpaso" | "autovendido";

const TEMP: Record<Temperatura, { t: string; chip: string; barra: string; Icono: typeof Flame }> = {
  caliente: { t: "Caliente", chip: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300", barra: "bg-red-500", Icono: Flame },
  "se-enfria": { t: "Se enfría", chip: "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-300", barra: "bg-amber-500", Icono: TrendingDown },
  tibio: { t: "Tibio", chip: "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300", barra: "bg-sky-500", Icono: Sparkles },
  frio: { t: "Frío", chip: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300", barra: "bg-slate-400", Icono: Snowflake },
};

export function LeadInteligente({ prospectos, onAbrir }: { prospectos: ProspectoInteligente[]; onAbrir: (c: any) => void }) {
  const [filtro, setFiltro] = useState<Filtro>("hoy");
  const [cuantos, setCuantos] = useState(6);
  const [abierto, setAbierto] = useState<string | null>(null);
  const r = useMemo(() => resumenDeProspectos(prospectos), [prospectos]);

  const lista = useMemo(() => {
    const base = prospectos.filter((x) => {
      if (filtro === "hoy") return x.temperatura !== "frio" || x.etiquetas.includes("tarea-vencida") || x.etiquetas.includes("auto-vendido");
      if (filtro === "calientes") return x.temperatura === "caliente";
      if (filtro === "enfrian") return x.temperatura === "se-enfria";
      if (filtro === "sinpaso") return x.etiquetas.includes("sin-paso") && x.temperatura !== "frio";
      return x.etiquetas.includes("auto-vendido");
    });
    return base;
  }, [prospectos, filtro]);

  const filtros: { id: Filtro; texto: string; n: number; Icono: typeof Flame }[] = [
    { id: "hoy", texto: "Para hoy", n: prospectos.filter((x) => x.temperatura !== "frio" || x.etiquetas.includes("tarea-vencida") || x.etiquetas.includes("auto-vendido")).length, Icono: Sparkles },
    { id: "calientes", texto: "Calientes", n: r.calientes, Icono: Flame },
    { id: "enfrian", texto: "Se enfrían", n: r.seEnfrian, Icono: TrendingDown },
    { id: "sinpaso", texto: "Sin siguiente paso", n: r.sinPaso, Icono: Clock3 },
    { id: "autovendido", texto: "Su auto ya no está", n: r.autoVendido, Icono: Car },
  ];

  return (
    <section className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#A82A17] dark:text-[#F2705B] uppercase tracking-[0.14em]">
            <Sparkles className="w-3.5 h-3.5" /> Lead Intelligence
          </span>
          <h2 className="text-lg font-extrabold text-slate-900 dark:text-white mt-0.5">A quién atender hoy</h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 max-w-xl">
            Ordenados por interés real y por el tiempo que llevan sin contacto, no solo por el avance del embudo. Cada uno dice por qué y qué hacer.
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-extrabold text-slate-900 dark:text-white leading-none">{r.calientes + r.seEnfrian}</p>
          <p className="text-[11px] text-slate-500">calientes o por rescatar<br />de {r.total} abiertos</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mt-4">
        {filtros.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={filtro === f.id}
            onClick={() => { setFiltro(f.id); setCuantos(6); }}
            className={clsx(
              "h-9 px-3 rounded-lg text-xs font-bold border flex items-center gap-1.5 transition-colors",
              filtro === f.id
                ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white"
                : "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700",
            )}
          >
            <f.Icono className="w-3.5 h-3.5" /> {f.texto}
            <span className={clsx("rounded-full px-1.5 text-[11px]", filtro === f.id ? "bg-white/20" : "bg-slate-100 dark:bg-slate-700")}>{f.n}</span>
          </button>
        ))}
      </div>

      {lista.length === 0 ? (
        <p className="text-sm text-slate-500 py-8 text-center">
          {r.total === 0 ? "No hay prospectos abiertos en el embudo." : "Nada en esta lista: buena señal."}
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-700/60">
          {lista.slice(0, cuantos).map((x) => {
            const T = TEMP[x.temperatura];
            const abre = abierto === x.id;
            return (
              <li key={x.id} className="py-3">
                <div className="flex items-start gap-3">
                  <div className={clsx("w-9 h-9 rounded-full flex items-center justify-center text-sm font-extrabold shrink-0", T.chip)}>
                    {x.nombre.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <button type="button" onClick={() => onAbrir(x.cliente)} className="text-sm font-extrabold text-slate-900 dark:text-white hover:underline truncate max-w-[16rem] text-left">{x.nombre}</button>
                      <span className={clsx("text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1", T.chip)}><T.Icono className="w-3 h-3" /> {T.t}</span>
                      {x.diasSinContacto !== null && x.diasSinContacto >= 7 && <span className="text-[11px] text-slate-500 flex items-center gap-1"><UserX className="w-3 h-3" /> {x.diasSinContacto} días sin contacto</span>}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {[x.auto, x.etapa, x.asesor && `Asesor: ${x.asesor}`].filter(Boolean).join(" · ")}
                    </p>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 mt-1.5">{x.accion}</p>
                    <button type="button" onClick={() => setAbierto(abre ? null : x.id)} className="mt-1 text-[11px] font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center gap-1">
                      {abre ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />} Por qué
                    </button>
                    {abre && (
                      <ul className="mt-1.5 flex flex-wrap gap-1.5">
                        {x.motivos.map((m, i) => (
                          <li key={i} className={clsx("text-[11px] px-2 py-1 rounded-md leading-tight", m.tono === "malo" ? "bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-300" : "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300")}>
                            {m.tono === "malo" ? "− " : "+ "}{m.texto}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="w-14 shrink-0 text-right">
                    <p className="text-lg font-extrabold text-slate-900 dark:text-white leading-none">{x.puntos}</p>
                    <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 mt-1.5 overflow-hidden"><div className={clsx("h-full", T.barra)} style={{ width: `${x.puntos}%` }} /></div>
                    <p className="text-[10px] text-slate-400 mt-0.5">de 100</p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {lista.length > cuantos && (
        <button type="button" onClick={() => setCuantos((n) => n + 8)} className="mt-2 w-full h-10 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">
          Ver {Math.min(8, lista.length - cuantos)} más ({lista.length - cuantos} restantes)
        </button>
      )}

      <details className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">
        <summary className="cursor-pointer font-semibold">Cómo se calcula</summary>
        <p className="mt-1.5 leading-relaxed">
          Suma lo que indica interés real: qué tan avanzado va, si ya se le cotizó, si pidió crédito o tiene prueba de manejo, si su auto sigue disponible y qué tan bien convierte, en tu agencia, el canal por el que llegó.
          Resta el silencio (de 7 días en adelante pesa cada vez más), la falta de un siguiente paso, las tareas vencidas y las objeciones que quedaron en las notas.
          «Se enfría» es alguien con buen interés que lleva callado una semana o más. Todo se calcula aquí, con tus datos; no sale a ningún servicio de IA.
        </p>
      </details>
    </section>
  );
}
