import { useState } from "react";
import type { Vehicle } from "../types";

/**
 * «Datos para la página»: lo que nextcar.erewere.com muestra y el CRM no
 * tenia (combustible, motor, «Lo que nos encanta»...). Se llenan a mano; lo que
 * quede vacio lo completa la pagina al publicar el auto.
 *
 * Sin boton de IA a proposito (decision de Luis, 22 sep 2026): el Aviso de
 * Privacidad promete que el CRM no envia nada a ningun servicio de
 * inteligencia artificial, y en eso se apoyo la verificacion de Google. La IA
 * vive en la pagina, que es otro servicio.
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
  const ficha: Ficha = formData.fichaWeb || {};
  const poner = (cambios: Partial<Ficha>) => setFormData({ ...formData, fichaWeb: { ...ficha, ...cambios } });
  const llenos = CAMPOS.filter((c) => ficha[c.id]).length + (ficha.loQueNosEncanta ? 1 : 0) + (ficha.precioAnterior ? 1 : 0);

  return (
    <div className="border-t border-gray-200 dark:border-slate-700 pt-2">
      <button type="button" onClick={() => setAbierto((v) => !v)} className="text-xs font-semibold text-slate-700 dark:text-slate-200">
        {abierto ? "▾" : "▸"} Datos para la página <span className="font-normal text-slate-500">({llenos} de 8, opcional)</span>
      </button>
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
                  placeholder={c.id === "motor" && Number(formData.liters) > 0
                    ? `${Number(formData.liters).toFixed(1)}L${Number(formData.cylinders) > 1 ? ` ${formData.cylinders} cilindros` : ""} (de Litros y Cilindros)`
                    : c.ejemplo}
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
          <p className="text-[11px] text-slate-500">Lo que dejes vacío, la página de Nextcar lo completa sola al publicar el auto.</p>
        </div>
      )}
    </div>
  );
}
