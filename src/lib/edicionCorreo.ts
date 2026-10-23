/**
 * La «edición» de la semana de los correos de los lunes.
 *
 * Un correo igual cada lunes se lee como plantilla y se deja de abrir. Así que cada semana cambia: qué va primero (las
 * cifras, lo nuevo o el consejo), cómo se dicen el título y el asunto, y, cuando toca, una línea del momento del mes
 * (arranque o cierre). Todo sale solo de la fecha, así que el correo del sábado que ve Luis es EXACTAMENTE el del lunes;
 * y si quiere cambiar algo, puede fijar la estructura o escribir una nota para esa semana desde el panel.
 *
 * La semana se cuenta por el LUNES en que sale, en hora de México. Del jueves al domingo «la semana» ya es la siguiente.
 */

export type Estructura = "numeros" | "novedades" | "consejo";

export interface AjusteEdicion {
  /** Lunes (AAAA-MM-DD) al que aplica; si ya pasó, el ajuste no vale. */
  semana: string;
  estructura?: Estructura | "auto";
  nota?: string;
}

export interface Edicion {
  semana: string;
  estructura: Estructura;
  /** Semilla de las frases: cambia cada semana. */
  variante: number;
  nota?: string;
  contexto: "inicio-de-mes" | "cierre-de-mes" | null;
}

const DIA = 86_400_000;
const ESTRUCTURAS: Estructura[] = ["numeros", "novedades", "consejo"];

/** El lunes (AAAA-MM-DD, hora de México) en que sale el correo de la semana a la que pertenece `ts`. */
export function lunesDeLaEdicion(ts: number): string {
  const mx = new Date(ts - 6 * 3_600_000);
  const dia = mx.getUTCDay(); // 0 dom … 6 sáb
  // Lunes a miércoles: ese lunes. Jueves a domingo: el que viene.
  const atras = dia >= 1 && dia <= 3 ? dia - 1 : -((8 - dia) % 7 || 7);
  return new Date(Date.UTC(mx.getUTCFullYear(), mx.getUTCMonth(), mx.getUTCDate() - atras)).toISOString().slice(0, 10);
}

/** Qué estructura tocaría esta semana sin ningún ajuste. */
export function estructuraAutomatica(semana: string): Estructura {
  const w = Math.floor(Date.parse(`${semana}T12:00:00Z`) / (7 * DIA));
  return ESTRUCTURAS[(w + 1) % ESTRUCTURAS.length];
}

export function edicionDeLaSemana(ts: number, ajuste?: AjusteEdicion | null): Edicion {
  const semana = lunesDeLaEdicion(ts);
  const vale = ajuste && ajuste.semana === semana ? ajuste : null;
  const w = Math.floor(Date.parse(`${semana}T12:00:00Z`) / (7 * DIA));
  const dia = Number(semana.slice(8, 10));
  const proximo = new Date(Date.parse(`${semana}T12:00:00Z`) + 7 * DIA);
  const contexto = dia <= 7 ? "inicio-de-mes" : proximo.getUTCMonth() !== new Date(`${semana}T12:00:00Z`).getUTCMonth() || dia >= 24 ? "cierre-de-mes" : null;
  const estructura = vale?.estructura && vale.estructura !== "auto" ? vale.estructura : estructuraAutomatica(semana);
  return { semana, estructura, variante: w, nota: vale?.nota?.trim() ? vale.nota.trim().slice(0, 600) : undefined, contexto };
}

/** Una frase de la lista, distinta cada semana; `salto` evita que todas las listas giren al mismo paso. */
export const elegir = <T,>(lista: T[], e: Edicion, salto = 0): T => lista[(e.variante + salto) % lista.length];

export const LINEA_DE_CONTEXTO: Record<"inicio-de-mes" | "cierre-de-mes", { admin: string; vendedor: string }> = {
  "inicio-de-mes": {
    admin: "Arranca el mes: buen momento para ponerle una meta de ventas a tu equipo y revisar qué quedó pendiente del mes pasado.",
    vendedor: "Arranca el mes: ponte una meta de ventas y revisa a quién le debías una llamada desde el mes pasado.",
  },
  "cierre-de-mes": {
    admin: "Estamos en el cierre de mes: revisa los tratos que están por cerrarse y los pagos que faltan por cobrar.",
    vendedor: "Estamos en el cierre de mes: busca los tratos que están a punto de cerrarse y dales el último empujón.",
  },
};
