import React, { useState } from 'react';
import clsx from 'clsx';
import { FileText, Printer, X } from 'lucide-react';
import type { Vehicle } from '../../types';
import { generarListaPrecios, ordenarParaLista, type OrdenLista } from '../../lib/listaPreciosPdf';
import { descargarOCompartir } from '../../lib/fichaPdf';
import { generarHojasParabrisas } from '../../lib/hojaParabrisasPdf';

/**
 * Antes de hacer la lista de precios: orden, fotos, enganche y si van los
 * apartados. Toma los autos que se ven en el inventario (respeta la búsqueda
 * y los filtros), sin los vendidos.
 */
export function ListaPrecios({ autos, agencia, asesor, onCerrar }: {
  autos: Vehicle[];
  agencia: any;
  asesor: { name?: string; phone?: string };
  onCerrar: () => void;
}) {
  const [tipo, setTipo] = useState<'lista' | 'parabrisas'>('lista');
  const [orden, setOrden] = useState<OrdenLista>('marca');
  const [conFotos, setConFotos] = useState(true);
  const [conCredito, setConCredito] = useState(true);
  const [conApartados, setConApartados] = useState(false);
  const [avance, setAvance] = useState('');

  const elegidos = autos.filter((v) => !(v as any).pendingValidation && v.status !== 'sold' && (v.status !== 'reserved' || conApartados) && Number(v.price) > 0);

  const hacer = async () => {
    setAvance('Preparando…');
    try {
      const fecha = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
      if (tipo === 'parabrisas') {
        const blob = await generarHojasParabrisas({
          autos: ordenarParaLista(elegidos, orden), agencia, asesor, conCredito,
          alAvanzar: (h, t) => setAvance(`Hoja ${h} de ${t}…`),
        });
        await descargarOCompartir(blob, `Hojas para parabrisas ${agencia?.name || ''} ${fecha}.pdf`.replace(/\s+/g, ' ').trim(), 'Hojas para parabrisas');
      } else {
        const blob = await generarListaPrecios({
          autos: elegidos, agencia, asesor, conFotos, conCredito, orden,
          alAvanzar: (h, t) => setAvance(`Cargando fotos ${h} de ${t}…`),
        });
        await descargarOCompartir(blob, `Lista de precios ${agencia?.name || ''} ${fecha}.pdf`.replace(/\s+/g, ' ').trim(), 'Lista de precios');
      }
      onCerrar();
    } catch (e: any) {
      alert(`No se pudo hacer la lista. ${e?.message || ''}`);
      setAvance('');
    }
  };

  const opcion = (etiqueta: string, valor: boolean, cambiar: (v: boolean) => void, ayuda?: string) => (
    <label className="flex items-start gap-2.5 cursor-pointer">
      <input type="checkbox" checked={valor} onChange={(e) => cambiar(e.target.checked)} className="mt-0.5 w-4 h-4 accent-blue-700" />
      <span className="flex flex-col"><span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{etiqueta}</span>{ayuda && <span className="text-xs text-slate-600 dark:text-slate-400">{ayuda}</span>}</span>
    </label>
  );

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-3" role="dialog" aria-modal="true" aria-labelledby="titulo-lista">
      <div className="absolute inset-0 bg-slate-900/50" onClick={avance ? undefined : onCerrar} />
      <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md flex flex-col">
        <div className="flex items-start justify-between gap-3 p-4 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 id="titulo-lista" className="text-lg font-extrabold text-slate-900 dark:text-white">{tipo === 'lista' ? 'Lista de precios' : 'Hojas para el parabrisas'}</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">{tipo === 'lista' ? 'PDF tamaño carta para compartir o imprimir.' : 'Una hoja carta por auto, para pegar por dentro del vidrio.'}</p>
          </div>
          <button type="button" onClick={onCerrar} disabled={!!avance} aria-label="Cerrar" className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 flex flex-col gap-3.5">
          <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-900" role="group" aria-label="Qué hacer">
            {([['lista', 'Lista de precios', FileText], ['parabrisas', 'Hojas parabrisas', Printer]] as const).map(([v, t, Icono]) => (
              <button key={v} type="button" onClick={() => setTipo(v)} aria-pressed={tipo === v}
                className={clsx('rounded-lg py-2 text-sm font-bold flex items-center justify-center gap-1.5', tipo === v ? 'bg-white dark:bg-slate-700 shadow text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400')}>
                <Icono className="w-4 h-4" /> {t}
              </button>
            ))}
          </div>
          <label className="flex flex-col gap-1 text-xs font-bold text-slate-700 dark:text-slate-300">Ordenar por
            <select value={orden} onChange={(e) => setOrden(e.target.value as OrdenLista)} className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm font-normal text-slate-900 dark:text-slate-100">
              <option value="marca">Marca y modelo</option>
              <option value="precio">Precio, de menor a mayor</option>
              <option value="anio">Año, más nuevos primero</option>
              <option value="tipo">Tipo de auto (SUV, sedán, pickup…)</option>
            </select>
          </label>
          {tipo === 'lista' && opcion('Con foto de cada auto', conFotos, setConFotos, 'Sin fotos caben más autos por hoja.')}
          {opcion(tipo === 'lista' ? 'Con enganche desde (crédito)' : 'Con enganche y mensualidad aproximada', conCredito, setConCredito)}
          {opcion('Incluir autos apartados', conApartados, setConApartados, 'Salen marcados como «Apartado».')}
          <p className="text-xs text-slate-600 dark:text-slate-400">Van <b className="text-slate-900 dark:text-white">{elegidos.length} autos</b>: los que se ven en tu inventario con la búsqueda y filtros de ahorita, sin vendidos ni autos sin precio.</p>
        </div>
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2">
          <button type="button" onClick={onCerrar} disabled={!!avance} className="min-h-[40px] px-4 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700">Cancelar</button>
          <button type="button" onClick={hacer} disabled={!!avance || !elegidos.length} className="min-h-[40px] px-4 rounded-lg bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-sm font-bold flex items-center gap-1.5">
            {tipo === 'lista' ? <FileText className="w-4 h-4" /> : <Printer className="w-4 h-4" />} {avance || (tipo === 'lista' ? 'Hacer lista' : `Hacer ${elegidos.length} ${elegidos.length === 1 ? 'hoja' : 'hojas'}`)}
          </button>
        </div>
      </div>
    </div>
  );
}
