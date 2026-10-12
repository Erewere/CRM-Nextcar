/**
 * La regla de qué inventario de otras agencias puede ver una agencia. Sin
 * dependencias del navegador: la usa la pantalla y también el servidor, que es
 * quien de verdad la hace cumplir. Ver compartir.ts para el detalle.
 */
export interface AgenciaCompartir {
  id: string;
  shareInventory?: boolean;
  shareScope?: string;
  ciudad?: string;
}

export const alcanceDe = (a?: AgenciaCompartir | null): "ciudad" | "todas" => (a?.shareScope === "ciudad" ? "ciudad" : "todas");

const sin = (s?: string) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
const mismaCiudad = (a?: string, b?: string) => !sin(a) || !sin(b) || sin(a) === sin(b);

export function puedoVer(yo: AgenciaCompartir | null | undefined, otra: AgenciaCompartir, incluirOtrasCiudades: boolean): boolean {
  if (!yo || otra.id === yo.id) return false;
  if (!yo.shareInventory || !otra.shareInventory) return false;
  if (mismaCiudad(yo.ciudad, otra.ciudad)) return true;
  return incluirOtrasCiudades && alcanceDe(yo) === "todas" && alcanceDe(otra) === "todas";
}

