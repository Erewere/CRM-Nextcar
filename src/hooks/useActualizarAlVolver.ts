import { useEffect, useRef } from "react";

/**
 * Vuelve a pedir los datos de una pantalla cuando el usuario regresa a la
 * pestaña, y (opcional) cada cierto tiempo mientras la tiene a la vista.
 *
 * - Nunca corre con la pestaña oculta: nadie la está mirando.
 * - `minimoMs` evita recargar si se acaba de cargar (cambiar de pestaña varias
 *   veces seguidas no multiplica las lecturas a Firebase).
 */
export function useActualizarAlVolver(recargar: () => void, opciones: { minimoMs?: number; cadaMs?: number } = {}) {
  const { minimoMs = 60_000, cadaMs } = opciones;
  const ultima = useRef(Date.now());
  const fn = useRef(recargar);
  fn.current = recargar;

  useEffect(() => {
    const correr = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - ultima.current < minimoMs) return;
      ultima.current = Date.now();
      fn.current();
    };
    document.addEventListener("visibilitychange", correr);
    window.addEventListener("focus", correr);
    const t = cadaMs ? setInterval(correr, cadaMs) : null;
    return () => {
      document.removeEventListener("visibilitychange", correr);
      window.removeEventListener("focus", correr);
      if (t) clearInterval(t);
    };
  }, [minimoMs, cadaMs]);
}
