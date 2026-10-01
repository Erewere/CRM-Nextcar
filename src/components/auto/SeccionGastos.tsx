import React, { useState } from 'react';
import clsx from 'clsx';
import { collection, deleteDoc, doc, setDoc, updateDoc } from 'firebase/firestore';
import { Pencil, Printer, Trash2 } from 'lucide-react';
import { db } from '../../lib/firebase';
import { hoyLocal } from '../../lib/fechas';
import { guardarCosto } from '../../hooks/useVehicleFinancials';
import { CampoEditable } from './CampoEditable';
import type { Vehicle } from '../../types';

/**
 * Costos y gastos del auto, todo en la página: el resumen de lo que deja, la
 * captura de gastos (agregar, corregir, quitar) y el reporte para socios, que
 * se imprime o se guarda en PDF desde el navegador.
 *
 * Los gastos viven en la colección vehicleExpenses. Algunos autos viejos traen
 * además una copia dentro del vehículo (`expenses`); al quitar un gasto se
 * quita de los dos lados, si no, reaparecía.
 */

const pesos = (n: number) => `$${Math.round(Number(n) || 0).toLocaleString('es-MX')}`;
const fechaCorta = (f?: string) => {
  if (!f) return '';
  const d = new Date(f.length <= 10 ? `${f}T12:00:00` : f);
  return isNaN(d.getTime()) ? f : d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
};

interface Props {
  auto: Vehicle;
  gastos: any[];
  costo: number;
  puedeVerCostos: boolean;
  puedeCapturar: boolean;
  puedePrecio: boolean;
  usuarioId?: string;
  dias: number | null;
  onPrecio: (v: any) => Promise<void>;
  onCambioGastos: () => void;
}

export function SeccionGastos({ auto, gastos, costo, puedeVerCostos, puedeCapturar, puedePrecio, usuarioId, dias, onPrecio, onCambioGastos }: Props) {
  const [fecha, setFecha] = useState(hoyLocal());
  const [concepto, setConcepto] = useState('');
  const [monto, setMonto] = useState('');
  const [editando, setEditando] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const totalGastos = gastos.reduce((s, g) => s + (Number(g.amount) || 0), 0);
  const precioVenta = auto.status === 'sold' && auto.saleDetails?.price ? auto.saleDetails.price : Number(auto.price) || 0;
  const inversion = costo + totalGastos;
  const utilidad = precioVenta - inversion;
  const margen = precioVenta > 0 && costo ? (utilidad / precioVenta) * 100 : null;
  const retorno = inversion > 0 && costo ? (utilidad / inversion) * 100 : null;
  const consignacion = auto.ownership === 'consignacion';

  const limpiar = () => { setConcepto(''); setMonto(''); setFecha(hoyLocal()); setEditando(null); };

  const guardarGasto = async () => {
    const cantidad = Number(String(monto).replace(/[^\d.]/g, ''));
    if (!concepto.trim() || !cantidad) return;
    setGuardando(true);
    try {
      const destino = editando ? doc(db, 'vehicleExpenses', editando) : doc(collection(db, 'vehicleExpenses'));
      await setDoc(destino, {
        vehicleId: auto.id,
        description: concepto.trim(),
        amount: cantidad,
        date: fecha || hoyLocal(),
        addedBy: usuarioId || '',
        agencyId: auto.agencyId,
      }, { merge: true });
      // Si el gasto también vivía dentro del auto (autos viejos), se corrige ahí.
      const copia = ((auto as any).expenses || []) as any[];
      if (editando && copia.some((g) => g.id === editando)) {
        await updateDoc(doc(db, 'vehicles', auto.id), {
          expenses: copia.map((g) => g.id === editando ? { ...g, description: concepto.trim(), amount: cantidad, date: fecha } : g),
        });
      }
      limpiar();
      onCambioGastos();
    } catch (e: any) {
      alert(`No se pudo guardar el gasto. ${e?.message || ''}`);
    } finally {
      setGuardando(false);
    }
  };

  const quitarGasto = async (g: any) => {
    if (!window.confirm(`¿Quitar el gasto «${g.description}» de ${pesos(g.amount)}?`)) return;
    try {
      if (g.id) await deleteDoc(doc(db, 'vehicleExpenses', g.id)).catch(() => {});
      const copia = ((auto as any).expenses || []) as any[];
      if (copia.length) {
        const resto = copia.filter((x) => (g.id ? x.id !== g.id : !(x.description === g.description && x.amount === g.amount && x.date === g.date)));
        if (resto.length !== copia.length) await updateDoc(doc(db, 'vehicles', auto.id), { expenses: resto });
      }
      if (editando === g.id) limpiar();
      onCambioGastos();
    } catch (e: any) {
      alert(`No se pudo quitar el gasto. ${e?.message || ''}`);
    }
  };

  const fila = (etiqueta: string, valor: React.ReactNode, clase?: string) => (
    <div className="flex justify-between items-baseline gap-3 py-1.5 border-b border-slate-100 dark:border-slate-700 last:border-0">
      <span className="text-sm text-slate-700 dark:text-slate-300">{etiqueta}</span>
      <span className={clsx('text-sm font-bold', clase)}>{valor}</span>
    </div>
  );

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-3" id="reporte-socios">
      {/* Resumen de lo que deja el auto */}
      <section className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex flex-col gap-3 print:border-0">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-extrabold">Resumen financiero</h2>
          {puedeVerCostos && (
            <button type="button" onClick={() => {
              // Solo se imprime este reporte, no el resto del CRM (ver index.css).
              document.body.classList.add('imprimir-socios');
              const quitar = () => { document.body.classList.remove('imprimir-socios'); window.removeEventListener('afterprint', quitar); };
              window.addEventListener('afterprint', quitar);
              window.print();
            }} className="print:hidden text-xs font-bold text-blue-700 hover:underline flex items-center gap-1">
              <Printer className="w-3.5 h-3.5" /> Reporte para socios (PDF)
            </button>
          )}
        </div>
        <div className="hidden print:block">
          <h1 className="text-xl font-extrabold">{auto.year} {auto.make} {auto.model}</h1>
          <p className="text-sm">{(auto.km || 0).toLocaleString('es-MX')} km · {auto.color} · VIN {auto.vin || '—'}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <CampoEditable etiqueta={auto.status === 'sold' ? 'Precio de venta (vendido)' : 'Precio de venta'} valor={precioVenta} tipo="numero" mostrar={pesos} puedeEditar={puedePrecio} onGuardar={onPrecio} claseValor="!text-lg" />
          {puedeVerCostos && (
            <CampoEditable
              etiqueta={consignacion ? 'Se le paga al dueño' : 'Costo de compra'}
              valor={costo || ''}
              tipo="numero"
              mostrar={pesos}
              marcarSiFalta
              puedeEditar={puedeCapturar}
              onGuardar={async (v) => { await guardarCosto(auto.id, auto.agencyId, v); }}
              claseValor="!text-lg"
            />
          )}
        </div>

        <div className="flex flex-col">
          {puedeVerCostos && fila(consignacion ? 'Pago al dueño' : 'Costo de compra', costo ? `− ${pesos(costo)}` : 'Falta', costo ? 'text-red-700 dark:text-red-400' : 'text-amber-700')}
          {fila(`Gastos (${gastos.length})`, `− ${pesos(totalGastos)}`, 'text-red-700 dark:text-red-400')}
          {puedeVerCostos && fila('Inversión total', pesos(inversion))}
          {puedeVerCostos && (
            <div className="flex justify-between items-baseline gap-3 pt-2.5 mt-1 border-t-2 border-slate-200 dark:border-slate-600">
              <span className="text-base font-extrabold">Utilidad {auto.status === 'sold' ? '' : 'proyectada'}</span>
              <span className={clsx('text-2xl font-extrabold', !costo ? 'text-slate-400' : utilidad >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700')}>{costo ? pesos(utilidad) : '—'}</span>
            </div>
          )}
        </div>

        {puedeVerCostos && costo > 0 && (
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-slate-50 dark:bg-slate-900/50 p-2.5 flex flex-col"><span className="text-[11px] text-slate-600 dark:text-slate-400">Margen</span><span className="text-base font-extrabold">{margen === null ? '—' : `${margen.toFixed(1)} %`}</span></div>
            <div className="rounded-lg bg-slate-50 dark:bg-slate-900/50 p-2.5 flex flex-col"><span className="text-[11px] text-slate-600 dark:text-slate-400">Retorno sobre lo invertido</span><span className="text-base font-extrabold">{retorno === null ? '—' : `${retorno.toFixed(1)} %`}</span></div>
            <div className="rounded-lg bg-slate-50 dark:bg-slate-900/50 p-2.5 flex flex-col"><span className="text-[11px] text-slate-600 dark:text-slate-400">Días en inventario</span><span className="text-base font-extrabold">{dias ?? '—'}</span></div>
          </div>
        )}
        {!puedeVerCostos && <p className="text-xs text-slate-600 dark:text-slate-400">El costo de compra y la utilidad solo los ven administradores y gerentes.</p>}
      </section>

      {/* Gastos */}
      <section className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex flex-col gap-3 print:border-0">
        <h2 className="text-sm font-extrabold">Gastos <span className="text-slate-500 font-semibold">{gastos.length} · {pesos(totalGastos)}</span></h2>

        {puedeCapturar && (
          <form
            onSubmit={(e) => { e.preventDefault(); guardarGasto(); }}
            className={clsx('print:hidden grid grid-cols-1 sm:grid-cols-[130px_minmax(0,1fr)_120px_auto] gap-2 items-end p-2.5 rounded-lg border', editando ? 'border-blue-400 bg-blue-50/50 dark:bg-blue-950/20' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40')}
          >
            <label className="flex flex-col gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-400">Fecha
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="px-2 py-1.5 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-normal text-slate-900 dark:text-slate-100" />
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-400">Concepto
              <input value={concepto} onChange={(e) => setConcepto(e.target.value)} placeholder="Pintura, llantas, verificación…" className="px-2 py-1.5 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-normal text-slate-900 dark:text-slate-100" />
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-400">Monto
              <input value={monto} onChange={(e) => setMonto(e.target.value)} inputMode="decimal" placeholder="$0" className="px-2 py-1.5 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-normal text-slate-900 dark:text-slate-100" />
            </label>
            <div className="flex gap-1.5">
              <button type="submit" disabled={guardando || !concepto.trim() || !monto} className="min-h-[36px] px-3 rounded-md bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-sm font-bold whitespace-nowrap">
                {editando ? 'Guardar' : 'Agregar'}
              </button>
              {editando && <button type="button" onClick={limpiar} className="min-h-[36px] px-3 rounded-md bg-slate-200 dark:bg-slate-700 text-sm font-semibold">Cancelar</button>}
            </div>
          </form>
        )}

        {gastos.length === 0 ? (
          <p className="text-sm text-slate-600 dark:text-slate-400">Sin gastos registrados.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-slate-600 dark:text-slate-400">
                <th className="py-1.5 font-bold">Fecha</th><th className="py-1.5 font-bold">Concepto</th><th className="py-1.5 font-bold text-right">Monto</th><th className="print:hidden" />
              </tr>
            </thead>
            <tbody>
              {gastos.map((g, i) => (
                <tr key={g.id || i} className={clsx('border-t border-slate-100 dark:border-slate-700', editando === g.id && 'bg-blue-50 dark:bg-blue-950/30')}>
                  <td className="py-1.5 whitespace-nowrap text-slate-600 dark:text-slate-400">{fechaCorta(g.date)}</td>
                  <td className="py-1.5">{g.description || 'Gasto'}</td>
                  <td className="py-1.5 text-right font-bold">{pesos(g.amount)}</td>
                  <td className="py-1.5 text-right whitespace-nowrap print:hidden">
                    {puedeCapturar && g.id && (
                      <button type="button" aria-label="Corregir gasto" onClick={() => { setEditando(g.id); setConcepto(g.description || ''); setMonto(String(g.amount || '')); setFecha(g.date || hoyLocal()); }} className="p-1 rounded text-slate-500 hover:text-blue-700 hover:bg-slate-100 dark:hover:bg-slate-700"><Pencil className="w-3.5 h-3.5" /></button>
                    )}
                    {puedeCapturar && (
                      <button type="button" aria-label="Quitar gasto" onClick={() => quitarGasto(g)} className="p-1 rounded text-slate-500 hover:text-red-700 hover:bg-slate-100 dark:hover:bg-slate-700"><Trash2 className="w-3.5 h-3.5" /></button>
                    )}
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-slate-200 dark:border-slate-600">
                <td colSpan={2} className="py-1.5 font-extrabold">Total</td>
                <td className="py-1.5 text-right font-extrabold">{pesos(totalGastos)}</td>
                <td className="print:hidden" />
              </tr>
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
