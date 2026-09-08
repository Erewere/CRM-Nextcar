import { useEffect, useState } from 'react';

// Una sola lista de avisos descartados para todo el CRM.
//
// En agosto había dos sistemas de avisos, cada uno con su propia lista de
// descartados en localStorage. No se hablaban: descartar en un sitio no
// descartaba en el otro, y el aviso volvía a salir por el otro lado. Se
// resolvió dejando un solo sistema, pero el problema de fondo era la lista
// duplicada, no la segunda pantalla.
//
// Este módulo es la lista, una sola vez. Cualquier pantalla que muestre avisos
// lee de aquí y escribe aquí, y todas se enteran en el momento — dentro de esta
// pestaña por suscripción, y entre pestañas por el evento "storage" del
// navegador.

const CLAVE = 'crm_dismissed_notifications';

function leer(): Set<string> {
  try {
    const guardado = localStorage.getItem(CLAVE);
    return guardado ? new Set(JSON.parse(guardado)) : new Set();
  } catch {
    // Ventana privada, almacenamiento lleno o bloqueado: se sigue sin recordar
    // lo descartado, que es molesto pero no rompe nada.
    return new Set();
  }
}

let actual: Set<string> = leer();
const suscritos = new Set<(ids: Set<string>) => void>();

function avisar() {
  suscritos.forEach((fn) => fn(actual));
}

export function descartarAviso(id: string) {
  if (actual.has(id)) return;
  actual = new Set(actual).add(id);
  try {
    localStorage.setItem(CLAVE, JSON.stringify(Array.from(actual)));
  } catch (e) {
    console.error('No se pudo guardar el aviso descartado', e);
  }
  avisar();
}

/** Los avisos descartados, al día. Se vuelve a pintar solo cuando cambian. */
export function useAvisosDescartados(): Set<string> {
  const [ids, setIds] = useState<Set<string>>(actual);

  useEffect(() => {
    suscritos.add(setIds);
    // Otra pestaña del mismo CRM también puede descartar.
    const desdeOtraPestana = (e: StorageEvent) => {
      if (e.key !== CLAVE) return;
      actual = leer();
      avisar();
    };
    window.addEventListener('storage', desdeOtraPestana);
    return () => {
      suscritos.delete(setIds);
      window.removeEventListener('storage', desdeOtraPestana);
    };
  }, []);

  return ids;
}

/** El identificador de un match de la red. Debe ser el mismo en todas partes. */
export function idDeMatch(clientId: string, vehicleId: string) {
  return `match-${clientId}-${vehicleId}`;
}
