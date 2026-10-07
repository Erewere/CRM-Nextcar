/** Metas de ventas por mes (servidor: src/servidor/metas.ts). */

export interface MetaNum { autos: number; ingresos: number }
export interface AsesorMeta { id: string; nombre: string; meta: MetaNum; ventas: number; monto: number }
export interface MetaMes {
  mes: string;                       // AAAA-MM
  puedeFijar: boolean;
  equipo: { meta: MetaNum; ventas: number; monto: number };
  asesores: AsesorMeta[];            // el asesor recibe solo el suyo; el administrador, todos
  sugerida: { equipo: MetaNum; vendedores: Record<string, MetaNum> } | null;   // la del mes anterior
  definida: boolean;
}

const MX = 6 * 3_600_000;

/** Mes válido «AAAA-MM»; si no viene uno bueno, el actual (hora de México). */
export function mesDeMetas(x?: string, ahora = Date.now()) {
  if (x && /^\d{4}-(0[1-9]|1[0-2])$/.test(x)) return x;
  return new Date(ahora - MX).toISOString().slice(0, 7);
}

export const mesActual = () => mesDeMetas();
export function sumarMes(mes: string, n: number) {
  const [a, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1 + n, 1)).toISOString().slice(0, 7);
}
export function nombreDelMes(mes: string) {
  const [a, m] = mes.split("-").map(Number);
  const t = new Date(Date.UTC(a, m - 1, 15)).toLocaleDateString("es-MX", { month: "long", year: "numeric", timeZone: "UTC" });
  return t.charAt(0).toUpperCase() + t.slice(1).replace(/ de /, " de ");
}

export type EstadoMeta = "sin-meta" | "cumplida" | "a-tiempo" | "justa" | "atrasada" | "cerrado-sin-cumplir";

/**
 * Cómo va una meta: el avance contra lo que toca llevar a esta altura del mes.
 * «A tiempo» = lleva al menos lo proporcional a los días transcurridos;
 * «justa» = va un poco abajo (hasta 25 %); «atrasada» = más abajo que eso.
 */
export function avanceDeMeta(ventas: number, meta: number, mes: string, ahora = Date.now()) {
  const [a, m] = mes.split("-").map(Number);
  const dias = new Date(Date.UTC(a, m, 0)).getUTCDate();
  const inicio = Date.UTC(a, m - 1, 1) + MX, fin = Date.UTC(a, m, 1) + MX;
  const transcurrido = Math.min(1, Math.max(0, (ahora - inicio) / (fin - inicio)));
  const diasRestantes = ahora >= fin ? 0 : Math.max(0, Math.ceil((fin - ahora) / 86_400_000));
  const pct = meta > 0 ? Math.min(100, Math.round((ventas / meta) * 100)) : 0;
  const falta = Math.max(0, meta - ventas);
  const esperado = meta * transcurrido;
  let estado: EstadoMeta = "sin-meta";
  if (meta > 0) {
    if (ventas >= meta) estado = "cumplida";
    else if (ahora >= fin) estado = "cerrado-sin-cumplir";
    else if (ventas >= esperado - 0.01) estado = "a-tiempo";
    else if (ventas >= esperado * 0.75) estado = "justa";
    else estado = "atrasada";
  }
  const proyeccion = transcurrido > 0.05 ? Math.round((ventas / transcurrido) * 10) / 10 : null;
  return { pct, falta, estado, dias, diasRestantes, esperado: Math.round(esperado * 10) / 10, proyeccion };
}

export const TEXTO_ESTADO: Record<EstadoMeta, { t: string; chip: string; barra: string }> = {
  "sin-meta": { t: "Sin meta", chip: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300", barra: "bg-slate-400" },
  cumplida: { t: "Meta cumplida", chip: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300", barra: "bg-emerald-500" },
  "a-tiempo": { t: "Va a tiempo", chip: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300", barra: "bg-emerald-500" },
  justa: { t: "Va justo", chip: "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-300", barra: "bg-amber-500" },
  atrasada: { t: "Va atrasado", chip: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300", barra: "bg-red-500" },
  "cerrado-sin-cumplir": { t: "No se cumplió", chip: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300", barra: "bg-red-500" },
};
