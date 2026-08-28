import { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import imageCompression from "browser-image-compression";
import { db, storage } from "../lib/firebase";
import { Agency } from "../types";
import { Building2, X, Upload, Loader2 } from "lucide-react";

/**
 * Los datos de la agencia: como se llama, donde esta y su logo.
 *
 * Hasta ahora la agencia se creaba sola al registrarse, con el nombre «Agencia
 * de [quien sea]». Ese nombre aparece en la cabecera, en los correos que salen
 * al equipo y en la ficha de cada auto, asi que el CRM se presentaba con un
 * nombre que nadie eligio.
 *
 * La misma ventana sirve para las dos cosas: pedir los datos la primera vez y
 * dejarlos cambiar despues. En el primer caso no se puede cerrar sin poner al
 * menos el nombre; en el segundo se cierra cuando se quiera.
 */
export function DatosDeAgenciaModal({
  agencia,
  uid,
  primeraVez = false,
  onCerrar,
}: {
  agencia: Agency;
  /** Quien sube el logo; define la carpeta permitida en el almacenamiento. */
  uid: string;
  primeraVez?: boolean;
  onCerrar: () => void;
}) {
  // El nombre puesto por el sistema no es un nombre: en la primera vez se
  // arranca en blanco para que no lo den por bueno de un vistazo.
  const nombreAutomatico = /^Agencia de /i.test(agencia.name || "");
  const [nombre, setNombre] = useState(nombreAutomatico ? "" : agencia.name || "");
  const [direccion, setDireccion] = useState(agencia.address || "");
  const [telefono, setTelefono] = useState(agencia.phone || "");
  const [logo, setLogo] = useState(agencia.logoUrl || "");
  const [subiendo, setSubiendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const subirLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    setError("");
    setSubiendo(true);
    try {
      // Un logo sale de Canva o de una foto del celular y puede pesar varios
      // megas. Comprimido carga rapido en cada pantalla donde aparece.
      const comprimido = await imageCompression(archivo, {
        maxSizeMB: 0.3,
        maxWidthOrHeight: 600,
        useWebWorker: true,
      });
      // Sube a la carpeta del propio usuario y no a una de la agencia: las
      // reglas de almacenamiento viven en la consola de Firebase, fuera de
      // este repositorio, y lo unico que se sabe permitido es `users/{uid}`
      // -- por ahi entran los avatares y las fotos de los autos. Una ruta
      // nueva se habria quedado bloqueada al subir, sin forma de saberlo desde
      // aqui. La direccion final se guarda en la agencia igual.
      const destino = ref(storage, `users/${uid}/agency-logo/${Date.now()}_${archivo.name}`);
      const tarea = uploadBytesResumable(destino, comprimido);
      await new Promise<void>((listo, falla) => {
        tarea.on("state_changed", () => {}, falla, () => listo());
      });
      setLogo(await getDownloadURL(tarea.snapshot.ref));
    } catch (err) {
      console.error("Logo", err);
      setError("No se pudo subir la imagen. Intenta con otra.");
    } finally {
      setSubiendo(false);
    }
  };

  const guardar = async () => {
    if (!nombre.trim()) {
      setError("Ponle nombre a tu agencia — es lo único que hace falta.");
      return;
    }
    setGuardando(true);
    setError("");
    try {
      await updateDoc(doc(db, "agencies", agencia.id), {
        name: nombre.trim(),
        address: direccion.trim(),
        phone: telefono.trim(),
        logoUrl: logo || "",
        datosCompletadosAt: new Date().toISOString(),
      });
      onCerrar();
    } catch (err: any) {
      console.error("Guardar agencia", err);
      setError("No se pudo guardar. " + (err?.message || ""));
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end md:items-center justify-center p-0 md:p-4">
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        // La primera vez no se cierra tocando fuera: sin nombre, el CRM se
        // queda presentandose como «Agencia de alguien».
        onClick={primeraVez ? undefined : onCerrar}
      />

      <div className="relative z-10 w-full max-w-lg bg-white dark:bg-slate-800 rounded-t-3xl md:rounded-2xl shadow-2xl max-h-[92dvh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                {primeraVez ? "¿Cómo se llama tu agencia?" : "Datos de tu agencia"}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {primeraVez
                  ? "Con esto tu CRM deja de llamarse «Agencia de…»"
                  : "Puedes cambiarlos cuando quieras"}
              </p>
            </div>
          </div>
          {!primeraVez && (
            <button
              onClick={onCerrar}
              className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 shrink-0"
              aria-label="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="px-5 pb-5 space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">
              Nombre de la agencia
            </label>
            <input
              autoFocus
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Autos del Bajío"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-[15px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
              Así te verán tus vendedores y así saldrá en las fichas de tus autos.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">
                Dirección <span className="font-medium normal-case text-slate-400">(opcional)</span>
              </label>
              <input
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
                placeholder="Calle, número, ciudad"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-[15px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">
                Teléfono <span className="font-medium normal-case text-slate-400">(opcional)</span>
              </label>
              <input
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="461 123 4567"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-[15px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">
              Logo <span className="font-medium normal-case text-slate-400">(opcional)</span>
            </label>
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-xl border border-dashed border-gray-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 flex items-center justify-center overflow-hidden shrink-0">
                {logo ? (
                  <img src={logo} alt="" className="w-full h-full object-contain" />
                ) : (
                  <Building2 className="w-6 h-6 text-slate-300 dark:text-slate-500" />
                )}
              </div>
              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-600 text-sm font-semibold text-slate-700 dark:text-slate-200 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-95 transition-all">
                {subiendo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {subiendo ? "Subiendo…" : logo ? "Cambiar" : "Subir imagen"}
                <input type="file" accept="image/*" className="hidden" onChange={subirLogo} disabled={subiendo} />
              </label>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
              Aparecerá arriba a la izquierda de tu CRM y en la ficha de tus autos.
            </p>
          </div>

          {error && (
            <p className="text-sm font-medium text-rose-600 dark:text-rose-400">{error}</p>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={guardar}
              disabled={guardando || subiendo}
              className="flex-1 inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold px-4 py-3 rounded-xl shadow-sm active:scale-95 transition-all"
            >
              {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {primeraVez ? "Guardar y empezar" : "Guardar cambios"}
            </button>
            {!primeraVez && (
              <button
                onClick={onCerrar}
                className="px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-semibold active:scale-95 transition-all"
              >
                Cancelar
              </button>
            )}
          </div>

          {primeraVez && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center">
              Solo el nombre es obligatorio. Lo demás lo puedes llenar después desde tu perfil.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
