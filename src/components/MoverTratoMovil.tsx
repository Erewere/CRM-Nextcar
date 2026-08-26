import { Client, PipelineStage } from "../types";
import { checkIsWon, checkIsLost } from "../lib/clientUtils";
import { X, Check, Trophy, XCircle, ArrowRight } from "lucide-react";
import clsx from "clsx";

/**
 * Mover un trato de etapa en el telefono, tocando.
 *
 * En el escritorio se arrastra la tarjeta a la columna. En un telefono ese
 * gesto no funciona: la columna de destino esta fuera de la pantalla, asi que
 * habria que arrastrar y desplazar a la vez con un solo dedo, y el sistema no
 * sabe cual de las dos cosas se pretende. El resultado practico era que no se
 * podia mover casi nada.
 *
 * Aqui se elige la etapa de una lista. Un toque, con el pulgar, sin pelearse
 * con el desplazamiento. Las etapas terminales se marcan porque no son un
 * cambio a secas: ganado pide los datos de la venta y perdido el motivo.
 */
export function MoverTratoMovil({
  client,
  columnas,
  onElegir,
  onCerrar,
}: {
  client: Client;
  columnas: PipelineStage[];
  onElegir: (etapaId: string) => void;
  onCerrar: () => void;
}) {
  const actual = client.status;
  const titulo = (client as any).dealTitle || client.name || "este trato";

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center md:hidden">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onCerrar} />

      <div className="relative w-full bg-white dark:bg-slate-800 rounded-t-3xl shadow-2xl max-h-[80dvh] flex flex-col animate-in slide-in-from-bottom duration-200">
        {/* El tirador de siempre, para que se lea como una hoja que se cierra. */}
        <div className="pt-3 pb-1 flex justify-center shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
        </div>

        <div className="px-5 pb-3 flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Mover a…</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{titulo}</p>
          </div>
          <button
            onClick={onCerrar}
            className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 shrink-0"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {columnas.map((col) => {
            const esActual = col.id === actual;
            const ganado = checkIsWon(col.id, [col]);
            const perdido = checkIsLost(col.id, [col]);

            return (
              <button
                key={col.id}
                disabled={esActual}
                onClick={() => onElegir(col.id)}
                className={clsx(
                  "w-full flex items-center gap-3 px-3 py-3.5 rounded text-left transition-colors",
                  esActual
                    ? "bg-slate-100 dark:bg-slate-700/50 cursor-default"
                    : "hover:bg-slate-100 dark:hover:bg-slate-700 active:bg-slate-200 dark:active:bg-slate-600"
                )}
              >
                <span
                  className={clsx(
                    "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                    ganado
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                      : perdido
                        ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                        : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                  )}
                >
                  {ganado ? (
                    <Trophy className="w-4 h-4" />
                  ) : perdido ? (
                    <XCircle className="w-4 h-4" />
                  ) : (
                    <ArrowRight className="w-4 h-4" />
                  )}
                </span>

                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                    {col.title}
                  </span>
                  {(ganado || perdido) && !esActual && (
                    <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                      {ganado ? "Te pedirá los datos de la venta" : "Te pedirá el motivo"}
                    </span>
                  )}
                </span>

                {esActual && (
                  <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 shrink-0">
                    <Check className="w-3.5 h-3.5" /> aquí está
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
