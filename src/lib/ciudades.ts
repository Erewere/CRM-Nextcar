import { useCallback, useEffect, useState } from "react";
import { auth } from "./firebase";
import { getApiUrl } from "./api";

/**
 * Ciudades en las que hay agencias. La lista vive en el servidor
 * (plataforma/ciudades) y la administra el master: ahí se van agregando
 * conforme llegan agencias de otras ciudades.
 */
async function pedir(ruta: string, init: RequestInit = {}) {
  const token = await auth.currentUser?.getIdToken();
  const r = await fetch(getApiUrl(ruta), { ...init, headers: { ...(init.headers || {}), Authorization: `Bearer ${token}`, ...(init.body ? { "Content-Type": "application/json" } : {}) } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.error || `Error ${r.status}`);
  return d;
}

export const ciudadesApi = {
  lista: async () => (await pedir("/api/ciudades")).ciudades as string[],
  agregar: async (nombre: string) => (await pedir("/api/admin/ciudades", { method: "POST", body: JSON.stringify({ agregar: nombre }) })).ciudades as string[],
  quitar: async (nombre: string) => (await pedir("/api/admin/ciudades", { method: "POST", body: JSON.stringify({ quitar: nombre }) })).ciudades as string[],
};

let cache: string[] | null = null;

export function useCiudades() {
  const [ciudades, setCiudades] = useState<string[]>(cache || []);
  const recargar = useCallback(async () => {
    try { cache = await ciudadesApi.lista(); setCiudades(cache); } catch { /* sin lista: el selector queda vacío */ }
  }, []);
  useEffect(() => { if (!cache) recargar(); }, [recargar]);
  return { ciudades, recargar, ponerLista: (l: string[]) => { cache = l; setCiudades(l); } };
}
