import { useCallback, useEffect, useState } from "react";
import { auth } from "./firebase";
import { getApiUrl } from "./api";
import { mesDeMetas, type MetaMes } from "./metas";

async function pedir(ruta: string, cuerpo?: any) {
  const token = await auth.currentUser?.getIdToken();
  const r = await fetch(getApiUrl(ruta), {
    method: cuerpo ? "PUT" : "GET",
    headers: { Authorization: `Bearer ${token}`, ...(cuerpo ? { "Content-Type": "application/json" } : {}) },
    ...(cuerpo ? { body: JSON.stringify(cuerpo) } : {}),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.error || `Error ${r.status}`);
  return d;
}

export const metasApi = {
  leer: (mes: string) => pedir(`/api/metas?mes=${encodeURIComponent(mes)}`) as Promise<MetaMes>,
  guardar: (cuerpo: { mes: string; equipo: { autos: number; ingresos: number }; vendedores: Record<string, { autos: number; ingresos: number }> }) => pedir("/api/metas", cuerpo),
};

/** Las metas de un mes (el actual por omisión) y su avance. */
export function useMetas(mes?: string) {
  const m = mesDeMetas(mes);
  const [datos, setDatos] = useState<MetaMes | null>(null);
  const [error, setError] = useState("");
  const recargar = useCallback(async () => {
    try { setDatos(await metasApi.leer(m)); setError(""); } catch (e: any) { setError(e.message || "No se pudieron leer las metas."); }
  }, [m]);
  useEffect(() => { setDatos(null); recargar(); }, [recargar]);
  return { datos, error, recargar, mes: m };
}
