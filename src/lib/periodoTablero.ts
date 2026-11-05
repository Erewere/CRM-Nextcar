import { useState } from "react";

/**
 * El periodo del tablero del administrador. Hay accesos rapidos (este mes,
 * mes pasado, 3 meses, este año, 12 meses) y un rango libre que el usuario
 * elige con el calendario. Lo comparten el tablero de escritorio y el del
 * celular, y se acuerda de lo ultimo que se eligio.
 */

export type Periodo = "mes" | "mespasado" | "3m" | "anio" | "12m" | "rango";

/** Rango elegido a mano: fechas «AAAA-MM-DD» en hora de Mexico, ambas incluidas. */
export interface RangoElegido {
  desde: string;
  hasta: string;
}

/** Los accesos rapidos, en el orden en que se ven. «rango» tiene su propio boton. */
export const PERIODOS: { id: Exclude<Periodo, "rango">; nombre: string; corto: string }[] = [
  { id: "mes", nombre: "Este mes", corto: "Este mes" },
  { id: "mespasado", nombre: "Mes pasado", corto: "Mes pasado" },
  { id: "3m", nombre: "Últimos 3 meses", corto: "3 meses" },
  { id: "anio", nombre: "Este año", corto: "Este año" },
  { id: "12m", nombre: "Últimos 12 meses", corto: "12 meses" },
];

const DIA = 86_400_000;
export const MX = 6 * 3_600_000; // Mexico, UTC-6, sin horario de verano desde 2022

const TODOS: readonly Periodo[] = [...PERIODOS.map((x) => x.id), "rango"];
const CLAVE_PERIODO = "tablero_periodo";
const CLAVE_RANGO = "tablero_rango";

export const leer = <T extends string>(clave: string, validos: readonly T[], def: T): T => {
  try {
    const v = localStorage.getItem(clave) as T | null;
    return v && validos.includes(v) ? v : def;
  } catch {
    return def;
  }
};
export const guardar = (clave: string, v: string) => {
  try {
    localStorage.setItem(clave, v);
  } catch {
    /* sin almacenamiento: se queda en memoria */
  }
};

const FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;

/** «AAAA-MM-DD» -> medianoche de ese dia en Mexico, en milisegundos. null si no es una fecha de verdad. */
function inicioDelDia(ymd: string): number | null {
  const m = FECHA.exec(ymd);
  if (!m) return null;
  const y = Number(m[1]), mes = Number(m[2]) - 1, d = Number(m[3]);
  const ms = Date.UTC(y, mes, d);
  const check = new Date(ms);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mes || check.getUTCDate() !== d) return null;
  return ms + MX;
}

/** Hoy (o hace `atras` dias) como «AAAA-MM-DD» en hora de Mexico. */
export function fechaDeHoy(atras = 0, ahora = Date.now()): string {
  return new Date(ahora - MX - atras * DIA).toISOString().slice(0, 10);
}

export function primeroDelMes(ahora = Date.now()): string {
  return fechaDeHoy(0, ahora).slice(0, 8) + "01";
}

/** Un rango sirve si las dos fechas existen y la de inicio no es posterior a la de fin. */
export function rangoValido(r: RangoElegido | null | undefined): r is RangoElegido {
  if (!r) return false;
  const a = inicioDelDia(r.desde), b = inicioDelDia(r.hasta);
  return a != null && b != null && a <= b;
}

export function rangoDelPeriodo(p: Periodo, ahora: number, elegido?: RangoElegido | null) {
  const local = new Date(ahora - MX);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth();
  if (p === "mes") return { desde: Date.UTC(y, m, 1) + MX, hasta: ahora };
  if (p === "mespasado") return { desde: Date.UTC(y, m - 1, 1) + MX, hasta: Date.UTC(y, m, 1) + MX };
  if (p === "anio") return { desde: Date.UTC(y, 0, 1) + MX, hasta: ahora };
  if (p === "3m") return { desde: ahora - 91 * DIA, hasta: ahora };
  if (p === "rango" && rangoValido(elegido)) {
    const desde = inicioDelDia(elegido.desde)!;
    // «hasta» es exclusivo en el calculo: se cuenta el dia final completo, sin pasar de este momento.
    return { desde, hasta: Math.min(ahora, inicioDelDia(elegido.hasta)! + DIA) };
  }
  return { desde: ahora - 365 * DIA, hasta: ahora };
}

const corta = (ymd: string, conAnio: boolean) =>
  new Date(inicioDelDia(ymd)! - MX).toLocaleDateString("es-MX", {
    day: "numeric", month: "short", ...(conAnio ? { year: "numeric" } : {}), timeZone: "UTC",
  }).replace(/\./g, "");

/** «5 oct – 31 oct 2026», o «5 oct 2026» si es un solo dia. */
export function textoDelRango(r: RangoElegido): string {
  if (r.desde === r.hasta) return corta(r.desde, true);
  const mismoAnio = r.desde.slice(0, 4) === r.hasta.slice(0, 4);
  return `${corta(r.desde, !mismoAnio)} – ${corta(r.hasta, true)}`;
}

export function nombreDelPeriodo(p: Periodo, elegido?: RangoElegido | null): string {
  if (p === "rango" && rangoValido(elegido)) return textoDelRango(elegido);
  return (PERIODOS.find((x) => x.id === p) ?? PERIODOS[PERIODOS.length - 1]).nombre;
}

function leerRango(): RangoElegido | null {
  try {
    const r = JSON.parse(localStorage.getItem(CLAVE_RANGO) || "null");
    return rangoValido(r) ? { desde: r.desde, hasta: r.hasta } : null;
  } catch {
    return null;
  }
}

/** Estado del periodo del tablero: cual esta elegido, el rango a mano, y como sacar los milisegundos que cubre. */
export function usePeriodoTablero() {
  const [guardado, setGuardado] = useState<Periodo>(() => leer<Periodo>(CLAVE_PERIODO, TODOS, "12m"));
  const [elegido, setElegido] = useState<RangoElegido | null>(leerRango);
  // Si quedo «rango» guardado sin fechas buenas, se vuelve a 12 meses en vez de mostrar ceros.
  const periodo: Periodo = guardado === "rango" && !rangoValido(elegido) ? "12m" : guardado;

  const setPeriodo = (x: Periodo) => { setGuardado(x); guardar(CLAVE_PERIODO, x); };
  const setRango = (r: RangoElegido) => {
    if (!rangoValido(r)) return;
    setElegido(r);
    guardar(CLAVE_RANGO, JSON.stringify(r));
    setGuardado("rango");
    guardar(CLAVE_PERIODO, "rango");
  };

  // Una funcion y no un valor guardado: «hasta» es el momento de calcular, y asi una venta nueva no se queda fuera.
  const rangoEn = (ahora: number) => rangoDelPeriodo(periodo, ahora, elegido);

  return { periodo, elegido, setPeriodo, setRango, rangoEn, nombre: nombreDelPeriodo(periodo, elegido) };
}
