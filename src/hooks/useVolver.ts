import { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';

/**
 * Regresar a donde estaba la persona, no a un lugar fijo.
 *
 * Antes cada pantalla tenía su botón «Volver» con una dirección escrita a mano
 * (la ficha de un auto siempre mandaba al Inventario, aunque se hubiera abierto
 * desde un cliente o desde el tablero). Aquí: si la persona llegó navegando dentro
 * del CRM, «regresar» hace lo mismo que el botón de atrás del navegador; si entró
 * directo a esa liga (no hay a dónde regresar), va a la pantalla de respaldo.
 */
export function useVolver(rutaDeRespaldo: string) {
  const navigate = useNavigate();
  return useCallback(() => {
    // React Router guarda en `history.state.idx` cuántas pantallas hay detrás de esta.
    const hayAtras = Number((window.history.state as any)?.idx ?? 0) > 0;
    if (hayAtras) navigate(-1);
    else navigate(rutaDeRespaldo, { replace: true });
  }, [navigate, rutaDeRespaldo]);
}

/**
 * Que el botón de atrás (y el gesto de deslizar desde la orilla del iPhone) CIERRE una
 * ventana en lugar de salirse de la pantalla donde está. Se usa dentro de una ventana
 * que solo existe mientras está abierta: al montarse deja una marca en el historial
 * (con la misma dirección, así que la pantalla no cambia) y al retroceder se cierra.
 * Si se cierra con su propio botón, quita la marca para no dejar «pasos de más».
 */
export function useCerrarConAtras(alCerrar: () => void) {
  const cerrar = useRef(alCerrar);
  cerrar.current = alCerrar;
  useEffect(() => {
    const id = Math.random().toString(36).slice(2);
    let consumido = false;
    window.history.pushState({ ...(window.history.state || {}), ventanaAtras: id }, '');
    const alRetroceder = () => {
      // Si seguimos (o volvimos) en nuestra marca, no es un «atrás» para esta ventana.
      if ((window.history.state as any)?.ventanaAtras === id) return;
      consumido = true;
      cerrar.current();
    };
    window.addEventListener('popstate', alRetroceder);
    return () => {
      window.removeEventListener('popstate', alRetroceder);
      // Cerrada por su botón: si nuestra marca sigue arriba, se quita. Si ya hubo otra
      // navegación encima (p. ej. «Ver auto»), no se toca el historial.
      if (!consumido && (window.history.state as any)?.ventanaAtras === id) window.history.back();
    };
  }, []);
}
