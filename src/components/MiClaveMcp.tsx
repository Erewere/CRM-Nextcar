import { useEffect, useState } from "react";
import { X, Copy, Check, Bot, AlertTriangle } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { NOMBRE_ROL, DESCRIPCION_ROL, type Rol } from "../lib/permissions";

/**
 * La clave con la que cada persona conecta su asistente de IA al CRM.
 *
 * Es personal, no de la agencia. Eso es lo que permite que el asistente quede
 * sujeto a los mismos permisos que la pantalla: quien no ve la cartera de sus
 * compañeros tampoco la ve desde la IA, y quien no ve costos no puede
 * pedirselos por mas que insista. Con una sola clave por agencia no habia a
 * quien atribuirle la peticion, y por eso daba acceso a todo.
 */
export function MiClaveMcp({ onClose }: { onClose: () => void }) {
  const { currentUser, userData } = useAuth();
  const [cargando, setCargando] = useState(true);
  const [info, setInfo] = useState<any>(null);
  const [claveNueva, setClaveNueva] = useState<string | null>(null);
  const [generando, setGenerando] = useState(false);
  const [copiado, setCopiado] = useState<string | null>(null);

  const url = typeof window !== "undefined" ? `${window.location.origin}/mcp` : "";
  const rol = (userData?.role as Rol) || "unassigned";

  const cargar = async () => {
    if (!currentUser) return;
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch("/api/mcp-key/mine", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok) setInfo(data);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { cargar(); }, [currentUser]);

  const generar = async () => {
    if (info?.hasKey && !window.confirm(
      "Se va a generar una clave nueva. La anterior deja de funcionar de inmediato, " +
      "así que tendrás que volver a conectar tu asistente. ¿Continuar?"
    )) return;

    setGenerando(true);
    try {
      const token = await currentUser!.getIdToken();
      const res = await fetch("/api/mcp-key/mine", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "No se pudo generar la clave");
      setClaveNueva(data.mcpApiKey);
      setInfo({ hasKey: true, maskedKey: data.maskedKey });
    } catch (e: any) {
      alert(e.message);
    } finally {
      setGenerando(false);
    }
  };

  const copiar = (texto: string, cual: string) => {
    navigator.clipboard.writeText(texto);
    setCopiado(cual);
    setTimeout(() => setCopiado(null), 2500);
  };

  return (
    <div className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <div className="flex items-start justify-between p-5 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded bg-indigo-100 dark:bg-indigo-900/40">
              <Bot className="w-5 h-5 text-indigo-700 dark:text-indigo-300" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Mi clave para IA</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Conecta tu asistente al CRM
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div className="p-3 rounded border border-gray-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Tu asistente verá <strong>lo mismo que tú</strong>, ni más ni menos.
            </p>
            {rol === "master" && (
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-2">
                Como master operas la plataforma, no una agencia: tu asistente no verá
                inventario ni clientes. Si quieres probar lo que ve un vendedor, usa la
                clave de su usuario.
              </p>
            )}
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Entras como <strong>{NOMBRE_ROL[rol] || "Usuario"}</strong>: {DESCRIPCION_ROL[rol] || ""}
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
              Dirección del servidor
            </label>
            <div className="flex gap-2">
              <code className="flex-1 px-3 py-2 text-sm bg-slate-100 dark:bg-slate-900 rounded text-slate-800 dark:text-slate-200 overflow-x-auto">
                {url}
              </code>
              <button
                onClick={() => copiar(url, "url")}
                className="px-3 py-2 rounded bg-slate-700 hover:bg-slate-800 text-white text-sm shrink-0"
              >
                {copiado === "url" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
              Tu clave
            </label>

            {cargando && <p className="text-sm text-slate-500">Consultando…</p>}

            {!cargando && claveNueva && (
              <>
                <div className="flex gap-2">
                  <code className="flex-1 px-3 py-2 text-sm bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-300 dark:border-emerald-800 rounded text-slate-800 dark:text-slate-200 overflow-x-auto">
                    {claveNueva}
                  </code>
                  <button
                    onClick={() => copiar(claveNueva, "clave")}
                    className="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-sm shrink-0"
                  >
                    {copiado === "clave" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex items-start gap-2 mt-2 text-xs text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Cópiala ahora. Por seguridad no se vuelve a mostrar completa; si la
                    pierdes, generas otra.
                  </span>
                </div>
              </>
            )}

            {!cargando && !claveNueva && info?.hasKey && (
              <p className="px-3 py-2 text-sm bg-slate-100 dark:bg-slate-900 rounded text-slate-600 dark:text-slate-400">
                {info.maskedKey}
                {info.lastUsedAt && (
                  <span className="block text-xs mt-0.5">
                    Último uso: {new Date(info.lastUsedAt).toLocaleString("es-MX")}
                  </span>
                )}
              </p>
            )}

            {!cargando && !claveNueva && !info?.hasKey && (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Todavía no tienes clave.
              </p>
            )}
          </div>

          {info?.resuelve && (
            <div className="p-3 rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900/40">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
                Lo que ve tu asistente con esta clave
              </p>
              <ul className="text-sm text-slate-700 dark:text-slate-300 space-y-1">
                <li>Agencia: <strong>{info.resuelve.agencia}</strong></li>
                <li>Rol: <strong>{NOMBRE_ROL[(info.resuelve.rol as Rol)] || info.resuelve.rol}</strong></li>
                <li className={info.resuelve.autosDisponibles === 0 ? "text-amber-700 dark:text-amber-400" : ""}>
                  Autos disponibles: <strong>{info.resuelve.autosDisponibles ?? "—"}</strong>
                </li>
              </ul>
              {info.resuelve.autosDisponibles === 0 && (
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-2">
                  Si tu agencia sí tiene autos, es que esta clave está resolviendo otra
                  agencia. Avísale a tu administrador.
                </p>
              )}
            </div>
          )}

          <button
            onClick={generar}
            disabled={generando}
            className="w-full px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium text-sm disabled:opacity-50"
          >
            {generando ? "Generando…" : info?.hasKey ? "Generar una clave nueva" : "Generar mi clave"}
          </button>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            La clave es tuya y no la ve nadie más, ni un administrador. Si la compartes,
            quien la tenga podrá consultar tu información del CRM desde su propia IA.
          </p>
        </div>
      </div>
    </div>
  );
}
