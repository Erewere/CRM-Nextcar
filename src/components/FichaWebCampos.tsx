import { useState } from "react";
import { Sparkles } from "lucide-react";
import { auth } from "../lib/firebase";
import type { Vehicle } from "../types";

/**
 * «Datos para la página»: lo que nextcar.erewere.com muestra y el CRM no
 * tenia (combustible, motor, «Lo que nos encanta»...). El boton usa la misma
 * herramienta de IA con la que se llenan los autos cargados a mano en la
 * pagina, y solo llena lo que esta vacio: nunca pisa lo que la agencia escribio.
 */

type Ficha = NonNullable<Vehicle["fichaWeb"]>;

const CAMPOS: { id: keyof Ficha; etiqueta: string; ejemplo: string }[] = [
  { id: "combustible", etiqueta: "Combustible", ejemplo: "Gasolina" },
  { id: "traccion", etiqueta: "Tracción", ejemplo: "Delantera" },
  { id: "motor", etiqueta: "Motor", ejemplo: "2.0L 4 cilindros turbo" },
  { id: "potencia", etiqueta: "Potencia", ejemplo: "150 HP" },
  { id: "rendimiento", etiqueta: "Rendimiento", ejemplo: "15.5 km/l" },
  { id: "ciudad", etiqueta: "Ciudad", ejemplo: "Celaya, Gto" },
];

const clase =
  "w-full px-3 py-2 border rounded bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-sm text-slate-800 dark:text-slate-200";

export function FichaWebCampos({ formData, setFormData, deshabilitado }: {
  formData: Partial<Vehicle>;
  setFormData: (f: Partial<Vehicle>) => void;
  deshabilitado: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [llenando, setLlenando] = useState(false);
  const [aviso, setAviso] = useState("");
  const ficha: Ficha = formData.fichaWeb || {};
  const poner = (cambios: Partial<Ficha>) => setFormData({ ...formData, fichaWeb: { ...ficha, ...cambios } });
  const llenos = CAMPOS.filter((c) => ficha[c.id]).length + (ficha.loQueNosEncanta ? 1 : 0);

  const llenarConIA = async () => {
    if (!formData.make || !formData.model) {
      setAviso("Escribe primero la marca y el modelo.");
      return;
    }
    setLlenando(true);
    setAviso("");
    try {
      const token = await auth.currentUser?.getIdToken();
      const r = await fetch("/api/pagina/ficha-ia", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ marca: formData.make, modelo: formData.model, anio: formData.year }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "No se pudo consultar la IA.");
      const nueva: Ficha = { ...ficha };
      let puestos = 0;
      for (const c of [...CAMPOS.map((x) => x.id), "loQueNosEncanta" as const]) {
        if (!nueva[c] && d.ficha?.[c]) { (nueva as any)[c] = d.ficha[c]; puestos++; }
      }
      const cambios: Partial<Vehicle> = { fichaWeb: nueva };
      if (!(formData as any).descripcionWeb && d.descripcion) { (cambios as any).descripcionWeb = d.descripcion; puestos++; }
      setFormData({ ...formData, ...cambios });
      setAviso(puestos ? `Listo: se llenaron ${puestos} campos. Revísalos antes de guardar.` : "No había campos vacíos que llenar.");
      setAbierto(true);
    } catch (e: any) {
      setAviso(e.message || "No se pudo consultar la IA.");
    } finally {
      setLlenando(false);
    }
  };

  return (
    <div className="border-t border-gray-200 dark:border-slate-700 pt-2">
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={() => setAbierto((v) => !v)} className="text-xs font-semibold text-slate-700 dark:text-slate-200">
          {abierto ? "▾" : "▸"} Datos para la página <span className="font-normal text-slate-500">({llenos} de 7)</span>
        </button>
        {!deshabilitado && (
          <button
            type="button"
            onClick={llenarConIA}
            disabled={llenando}
            className="text-xs font-semibold px-2.5 py-1 rounded border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-60 flex items-center gap-1"
          >
            <Sparkles className="w-3.5 h-3.5" /> {llenando ? "Buscando…" : "Llenar con IA"}
          </button>
        )}
      </div>
      {aviso && <p className="text-xs text-slate-500 mt-1">{aviso}</p>}
      {abierto && (
        <div className="mt-2 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            {CAMPOS.map((c) => (
              <label key={c.id} className="block">
                <span className="block text-[11px] text-slate-500 mb-0.5">{c.etiqueta}</span>
                <input
                  type="text"
                  value={(ficha[c.id] as string) || ""}
                  disabled={deshabilitado}
                  placeholder={c.ejemplo}
                  onChange={(e) => poner({ [c.id]: e.target.value } as Partial<Ficha>)}
                  className={clase}
                />
              </label>
            ))}
            <label className="block">
              <span className="block text-[11px] text-slate-500 mb-0.5">Precio anterior (tachado)</span>
              <input
                type="number"
                inputMode="numeric"
                value={ficha.precioAnterior || ""}
                disabled={deshabilitado}
                placeholder="Opcional"
                onChange={(e) => poner({ precioAnterior: Number(e.target.value) || undefined })}
                className={clase}
              />
            </label>
          </div>
          <label className="block">
            <span className="block text-[11px] text-slate-500 mb-0.5">«Lo que nos encanta» (una idea por renglón)</span>
            <textarea
              rows={3}
              value={ficha.loQueNosEncanta || ""}
              disabled={deshabilitado}
              placeholder={"Cámara de reversa\nAsientos de piel"}
              onChange={(e) => poner({ loQueNosEncanta: e.target.value })}
              className={clase}
            />
          </label>
          <p className="text-[11px] text-slate-500">Lo que dejes vacío, la página lo completa sola al publicar el auto.</p>
        </div>
      )}
    </div>
  );
}
