import { useEffect, useState } from "react";

/**
 * Qué inventario de otras agencias puede ver una agencia.
 *
 * Una regla en un solo lugar: la usan la pantalla de Inventario, el celular y
 * las coincidencias de la campanita y del tablero.
 *
 *  - Hay que compartir el propio inventario para ver el de las demás
 *    (reciprocidad, igual que antes).
 *  - De la misma ciudad: se ve siempre que la otra agencia también comparta.
 *    Si a alguna de las dos todavía no se le puso ciudad, se trata como la misma
 *    ciudad: así a nadie se le quita lo que ya veía mientras se les asigna.
 *  - De otra ciudad: solo si las DOS agencias aceptaron compartir con todas las
 *    ciudades Y el usuario encendió «Incluir otras ciudades».
 *
 * `shareScope` vacío se lee como «todas»: las agencias que ya compartían antes
 * de existir las ciudades siguen igual. Las que activan el compartir ahora
 * arrancan en «solo mi ciudad».
 */
import { puedoVer, alcanceDe, type AgenciaCompartir } from "./reglaCompartir";
export { puedoVer, alcanceDe };
export type { AgenciaCompartir };

/** Lo que el usuario eligió en este navegador (para pedirle al servidor). */
export const leerOtrasCiudades = () => { try { return localStorage.getItem("inventario_otras_ciudades") === "1"; } catch { return false; } };

const CLAVE = "inventario_otras_ciudades";
const EVENTO = "otras-ciudades-cambio";

/** La preferencia de cada usuario: ver también las agencias de otras ciudades. */
export function useOtrasCiudades(): [boolean, (v: boolean) => void] {
  const leer = () => { try { return localStorage.getItem(CLAVE) === "1"; } catch { return false; } };
  const [valor, setValor] = useState(leer);
  useEffect(() => {
    const alCambiar = () => setValor(leer());
    window.addEventListener(EVENTO, alCambiar);
    return () => window.removeEventListener(EVENTO, alCambiar);
  }, []);
  const poner = (v: boolean) => {
    try { localStorage.setItem(CLAVE, v ? "1" : "0"); } catch { /* sin almacenamiento */ }
    window.dispatchEvent(new Event(EVENTO));
  };
  return [valor, poner];
}
