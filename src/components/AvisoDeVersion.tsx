import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

/**
 * Avisa cuando hay una versión nueva del CRM y deja actualizar con un toque.
 *
 * En el celular, sobre todo instalado en la pantalla de inicio, no hay botón de recargar: la app se quedaba con la versión
 * vieja hasta que alguien la cerraba por completo. Aquí se compara el archivo principal con el que el servidor publica ahora;
 * si cambió, sale este aviso. No recarga sola: podrías estar a media captura.
 */
const archivoActual = () => document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/index-"]')?.getAttribute("src") || "";

async function archivoPublicado(): Promise<string> {
  const r = await fetch(`/?v=${Date.now()}`, { cache: "no-store", headers: { Accept: "text/html" } });
  if (!r.ok) return "";
  const html = await r.text();
  return html.match(/\/assets\/index-[A-Za-z0-9_-]+\.js/)?.[0] || "";
}

export function AvisoDeVersion() {
  const [hayNueva, setHayNueva] = useState(false);
  const miArchivo = useRef(archivoActual());
  const ultima = useRef(0);

  useEffect(() => {
    // En desarrollo no hay archivo con huella: no hay nada que comparar.
    if (!miArchivo.current) return;
    const revisar = async () => {
      if (document.visibilityState !== "visible" || Date.now() - ultima.current < 60_000) return;
      ultima.current = Date.now();
      try {
        const nuevo = await archivoPublicado();
        if (nuevo && nuevo !== miArchivo.current) setHayNueva(true);
      } catch { /* sin red: se vuelve a intentar luego */ }
    };
    revisar();
    document.addEventListener("visibilitychange", revisar);
    window.addEventListener("focus", revisar);
    const t = setInterval(revisar, 5 * 60_000);
    return () => { document.removeEventListener("visibilitychange", revisar); window.removeEventListener("focus", revisar); clearInterval(t); };
  }, []);

  if (!hayNueva) return null;
  return (
    <div role="status" className="fixed inset-x-3 top-[calc(env(safe-area-inset-top,0px)+0.5rem)] z-[300] md:left-auto md:right-6 md:max-w-sm rounded-2xl bg-slate-900 text-white shadow-2xl px-4 py-3 flex items-center gap-3">
      <RefreshCw className="w-5 h-5 shrink-0 text-emerald-400" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold leading-tight">Hay una versión nueva del CRM</p>
        <p className="text-xs text-slate-300">Actualiza para ver los cambios.</p>
      </div>
      <button onClick={() => window.location.reload()} className="h-10 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-900 text-sm font-extrabold shrink-0 active:scale-95 transition-transform">Actualizar</button>
    </div>
  );
}
