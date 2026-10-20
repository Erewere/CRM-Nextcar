import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { auth } from '../../lib/firebase';
import { getApiUrl } from '../../lib/api';
import { ANIO_MINIMO_GUIA } from '../../lib/guiaPrecios';
import { LineaGuia, type GuiaVista } from '../inventario/LineaGuia';

/**
 * «Consultar precio» al capturar un auto: marca, modelo y año -> venta y
 * compra de la guía de Autocosmos. Nada se escribe en el formulario hasta que
 * la persona toca «Usar como precio de venta».
 */
export function ConsultarPrecio({ marca, modelo, anio, km, precio, onUsarVenta }: {
  marca: string; modelo: string; anio: number; km?: number; precio?: number; onUsarVenta: (venta: number) => void;
}) {
  const [cargando, setCargando] = useState(false);
  const [guia, setGuia] = useState<GuiaVista | null | undefined>(undefined);
  const [aviso, setAviso] = useState('');

  const listo = marca.trim() && modelo.trim() && anio >= 1980;

  const consultar = async () => {
    setCargando(true);
    setAviso('');
    setGuia(undefined);
    try {
      const token = await auth.currentUser?.getIdToken();
      const qs = new URLSearchParams({ marca: marca.trim(), modelo: modelo.trim(), anio: String(anio) });
      if (km && km > 0) qs.set('km', String(km));
      const r = await fetch(getApiUrl(`/api/guia/consultar?${qs}`), { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setAviso(d?.error || 'No se pudo consultar la guía.'); return; }
      if (!d.guia) { setGuia(null); setAviso(d.motivo || 'No hay guía para este auto.'); return; }
      setGuia(d.guia);
    } catch {
      setAviso('No se pudo consultar la guía. Revisa tu conexión.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-sm font-bold">¿Cuánto vale?</span>
          <span className="text-xs text-slate-600 dark:text-slate-400">
            Consulta la guía de Autocosmos con la marca, modelo, año y kilometraje.{anio < ANIO_MINIMO_GUIA ? ' (No hay guía de 2014 o anteriores.)' : ''}
            {!(km && km > 0) && !!anio && anio >= ANIO_MINIMO_GUIA ? ' Escribe el kilometraje para un precio más exacto.' : ''}
          </span>
        </div>
        <button
          type="button"
          onClick={consultar}
          disabled={!listo || cargando}
          className="min-h-[40px] px-4 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-bold flex items-center gap-1.5 disabled:opacity-50"
        >
          <Search className="w-4 h-4" /> {cargando ? 'Consultando…' : 'Consultar precio'}
        </button>
      </div>
      {aviso && <p role="status" className="text-xs font-semibold text-amber-800 dark:text-amber-300">{aviso}</p>}
      {guia && (
        <div className="flex flex-col gap-2">
          <LineaGuia guia={guia} precio={precio} />
          {guia.confianza !== 'baja' && !!guia.venta && (
            <button
              type="button"
              onClick={() => onUsarVenta(guia.venta!)}
              className="self-start min-h-[36px] px-3 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold"
            >
              Usar como precio de venta
            </button>
          )}
          <p className="text-[10px] text-slate-500 dark:text-slate-400">Es una referencia, no un avalúo: no cuenta el estado del auto.</p>
        </div>
      )}
    </div>
  );
}
