import { useEffect, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";

/**
 * Lo que hay que atender hoy, tal como lo arma la campanita.
 *
 * La campanita ya junta en un solo sitio los chats sin contestar, las citas, las tareas y los pagos vencidos, los créditos,
 * los tratos sin movimiento... y los ordena por urgencia. Para que la pantalla de Inicio muestre EXACTAMENTE lo mismo (y no
 * una segunda cuenta que se desfase de la primera), la campanita deja aquí su resultado y el Inicio lo lee. No se lee nada
 * extra de la base de datos.
 */

export type Nivel = "ahora" | "hoy" | "seguimiento";

export interface AvisoItem {
  id: string;
  title: string;
  message?: string;
  date: string;
  icon?: ReactNode;
  onClick?: () => void;
}

export interface GrupoDeAvisos {
  grupo: string;
  items: AvisoItem[];
  detalle: string;
}

export type AvisosPorNivel = Record<Nivel, GrupoDeAvisos[]>;

const VACIO: AvisosPorNivel = { ahora: [], hoy: [], seguimiento: [] };
let actual: AvisosPorNivel = VACIO;
const oyentes = new Set<() => void>();

export function publicarAvisosDelDia(valor: AvisosPorNivel) {
  actual = valor;
  oyentes.forEach((o) => o());
}

export function useAvisosDelDia(): AvisosPorNivel {
  return useSyncExternalStore(
    (cb) => { oyentes.add(cb); return () => { oyentes.delete(cb); }; },
    () => actual,
    () => VACIO,
  );
}

/**
 * ¿Ya se puede decir «todo al día»? La campanita carga sus datos poco a poco: en el primer instante la lista sale vacía
 * aunque haya pendientes, y decir «todo al día» ahí sería mentira. Se espera unos segundos desde que la pantalla se abre.
 */
export function useAvisosListos(espera = 2500): boolean {
  const [listo, setListo] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setListo(true), espera);
    return () => clearTimeout(t);
  }, [espera]);
  return listo;
}
