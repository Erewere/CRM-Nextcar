import { useEffect, useState } from 'react';

// Una lista de "ya lo vi" guardada en este navegador.
//
// Es distinta de la lista de avisos descartados: descartar dice "no me
// interesa, nunca más"; "visto" dice "ya lo miré", y solo sirve para apagar
// los puntitos y marcas de "nuevo". Lo visto sigue existiendo donde siempre
// (el match sigue en el inventario, el trato sigue en el embudo).

export interface ListaDeVistos {
  marcar: (ids: string[]) => void;
  usar: () => Set<string>;
}

export function crearListaDeVistos(clave: string): ListaDeVistos {
  const leer = (): Set<string> => {
    try {
      const guardado = localStorage.getItem(clave);
      return guardado ? new Set(JSON.parse(guardado)) : new Set();
    } catch {
      return new Set();
    }
  };

  let actual = leer();
  const suscritos = new Set<(ids: Set<string>) => void>();
  const avisar = () => suscritos.forEach((fn) => fn(actual));

  const marcar = (ids: string[]) => {
    const nuevos = ids.filter((id) => !actual.has(id));
    if (nuevos.length === 0) return;
    actual = new Set(actual);
    nuevos.forEach((id) => actual.add(id));
    // Crece sin parar si no se recorta: se queda con lo más reciente.
    const lista = Array.from(actual).slice(-2000);
    actual = new Set(lista);
    try {
      localStorage.setItem(clave, JSON.stringify(lista));
    } catch (e) {
      console.error('No se pudo guardar lo visto', e);
    }
    avisar();
  };

  const usar = (): Set<string> => {
    const [ids, setIds] = useState<Set<string>>(actual);
    useEffect(() => {
      suscritos.add(setIds);
      setIds(actual);
      const desdeOtraPestana = (e: StorageEvent) => {
        if (e.key !== clave) return;
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
  };

  return { marcar, usar };
}

export const matchesVistos = crearListaDeVistos('crm_matches_vistos');
export const leadsVistos = crearListaDeVistos('crm_leads_vistos');
