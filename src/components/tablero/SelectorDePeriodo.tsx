import { useEffect, useRef, useState } from "react";
import { CalendarDays, X } from "lucide-react";
import {
  PERIODOS, fechaDeHoy, primeroDelMes, rangoValido, textoDelRango,
  type Periodo, type RangoElegido,
} from "../../lib/periodoTablero";

/**
 * Accesos rapidos de periodo y, al final, «Elegir fechas»: un calendario para
 * poner el dia de inicio y el de fin. El calendario es el del propio
 * navegador (en el iPhone sale el de iOS), asi que no hay nada que aprender.
 */
export function SelectorDePeriodo({
  periodo, elegido, onPeriodo, onRango, compacto = false,
}: {
  periodo: Periodo;
  elegido: RangoElegido | null;
  onPeriodo: (p: Periodo) => void;
  onRango: (r: RangoElegido) => void;
  /** Celular: textos cortos y los botones se acomodan en dos renglones, sin deslizar de lado. */
  compacto?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const caja = useRef<HTMLDivElement>(null);
  const hoy = fechaDeHoy();

  const abrir = () => {
    setDesde(elegido?.desde ?? primeroDelMes());
    setHasta(elegido?.hasta ?? hoy);
    setAbierto((v) => !v);
  };

  // Se cierra al tocar fuera o con Escape.
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent | TouchEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false);
    };
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") setAbierto(false); };
    document.addEventListener("mousedown", fuera);
    document.addEventListener("touchstart", fuera);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("touchstart", fuera);
      document.removeEventListener("keydown", tecla);
    };
  }, [abierto]);

  const aplicar = (r: RangoElegido) => {
    if (!rangoValido(r)) return;
    onRango(r);
    setAbierto(false);
  };

  const hayRango = periodo === "rango" && rangoValido(elegido);
  const invalido = !rangoValido({ desde, hasta });
  const rapido = (dias: number): RangoElegido => ({ desde: fechaDeHoy(dias - 1), hasta: hoy });

  const base = compacto
    ? "grow text-center text-[11px] font-bold px-2.5 py-2 rounded-xl transition-colors whitespace-nowrap"
    : "h-7 px-2.5 rounded-md text-xs font-bold transition-colors whitespace-nowrap";
  const activo = compacto
    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
    : "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm";
  const inactivo = compacto ? "text-slate-500" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200";

  return (
    <div ref={caja} className="relative min-w-0">
      <div
        className={
          compacto
            ? "flex flex-wrap gap-1 bg-white dark:bg-slate-800 ring-1 ring-slate-200/70 dark:ring-slate-700 shadow-sm rounded-2xl p-1"
            : "flex flex-wrap gap-0.5 bg-slate-100 dark:bg-slate-900 p-0.5 rounded-lg"
        }
      >
        {PERIODOS.map((x) => (
          <button key={x.id} onClick={() => { setAbierto(false); onPeriodo(x.id); }} className={`${base} ${periodo === x.id ? activo : inactivo}`}>
            {compacto ? x.corto : x.nombre}
          </button>
        ))}
        <button
          onClick={abrir}
          aria-expanded={abierto}
          title="Elige desde qué día hasta qué día quieres el reporte"
          className={`${base} flex items-center justify-center gap-1.5 ${hayRango ? activo : inactivo}`}
        >
          <CalendarDays className="w-3.5 h-3.5" />
          {hayRango ? textoDelRango(elegido!) : "Elegir fechas"}
        </button>
      </div>

      {abierto && (
        <div className={`absolute z-30 mt-1.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-xl p-3 space-y-3 ${compacto ? "left-0 right-0" : "right-0 w-72 max-w-[calc(100vw-2rem)]"}`}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-slate-900 dark:text-white">Elegir fechas</p>
            <button onClick={() => setAbierto(false)} aria-label="Cerrar" className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="text-[11px] font-semibold text-slate-500">
              Desde
              <input
                type="date" value={desde} max={hasta || hoy} onChange={(e) => setDesde(e.target.value)}
                className="mt-0.5 w-full h-9 px-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white dark:[color-scheme:dark]"
              />
            </label>
            <label className="text-[11px] font-semibold text-slate-500">
              Hasta
              <input
                type="date" value={hasta} min={desde || undefined} max={hoy} onChange={(e) => setHasta(e.target.value)}
                className="mt-0.5 w-full h-9 px-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white dark:[color-scheme:dark]"
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {[{ t: "Hoy", d: 1 }, { t: "Últimos 7 días", d: 7 }, { t: "Últimos 30 días", d: 30 }].map((c) => (
              <button
                key={c.t}
                onClick={() => aplicar(rapido(c.d))}
                className="h-7 px-2.5 rounded-full border border-slate-200 dark:border-slate-600 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                {c.t}
              </button>
            ))}
          </div>

          {invalido && desde && hasta && (
            <p className="text-[11px] text-[#D6402A]">La fecha de inicio no puede ser después de la final.</p>
          )}

          <button
            onClick={() => aplicar({ desde, hasta })}
            disabled={invalido}
            className="w-full h-9 rounded-lg bg-[#D6402A] hover:bg-[#A82A17] disabled:opacity-40 disabled:hover:bg-[#D6402A] text-white text-sm font-bold"
          >
            Ver este periodo
          </button>
        </div>
      )}
    </div>
  );
}
