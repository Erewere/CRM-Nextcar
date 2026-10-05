import { motion } from "motion/react";
import React, { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { AlertTriangle, Banknote, Building2, FileText, HandCoins, X } from 'lucide-react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { calcularCreditoCasa } from '../lib/planDePagos';
import { Client, SaleDetails, Vehicle } from '../types';

/**
 * Registrar la venta: cómo se vendió y, si es crédito de la casa, el plan.
 *
 * Las cuentas son las mismas de la cotización (calcularCreditoCasa): interés
 * global fijo mensual y comisión por apertura sobre lo que se financia, que
 * puede ir dentro del financiamiento o pagarse de contado con el enganche.
 *
 * Si la venta ya existía, la ventana abre con sus datos. Antes abría siempre
 * en «Contado» y, al guardarla otra vez, el crédito de César Augusto quedó
 * como contado y sin pagos (HHHSeminuevos, 5 oct 2026).
 */

type Forma = 'contado' | 'credito' | 'credito_bancario';

interface Props {
  client: Client;
  vehicle?: Vehicle | null;
  /** La venta que ya estaba registrada, para editarla en vez de empezar de cero. */
  inicial?: SaleDetails | null;
  onConfirm: (details: SaleDetails) => void | Promise<void>;
  onCancel: () => void;
}

const pesos = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 }).format(Number(n) || 0);
const num = (s: string) => Number(String(s).replace(/[^\d.]/g, '')) || 0;
const enUnMes = () => { const d = new Date(); d.setMonth(d.getMonth() + 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const campo = 'w-full h-11 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500';

const FORMAS: { id: Forma; titulo: string; detalle: string; Icono: any }[] = [
  { id: 'contado', titulo: 'Contado', detalle: 'Paga el total (en uno o varios pagos)', Icono: Banknote },
  { id: 'credito', titulo: 'Crédito de la casa', detalle: 'La agencia financia: enganche y mensualidades', Icono: HandCoins },
  { id: 'credito_bancario', titulo: 'Crédito bancario', detalle: 'El banco paga; la agencia recibe el enganche', Icono: Building2 },
];

export function DealWonModal({ client, vehicle, inicial, onConfirm, onCancel }: Props) {
  const previo: any = inicial ?? null;
  const yaHabia = !!previo && !!previo.method;
  const pagosRegistrados = (previo?.payments || []).length;

  const [forma, setForma] = useState<Forma>((previo?.method as Forma) || 'contado');
  const [precio, setPrecio] = useState(String(previo?.price || client.dealValue || vehicle?.price || ''));
  const [enganche, setEnganche] = useState(previo?.downPayment ? String(previo.downPayment) : '');
  const [meses, setMeses] = useState(String(previo?.termMonths || 24));
  const [tasa, setTasa] = useState(String(previo?.interestRate ?? 1.5));
  const [primera, setPrimera] = useState(String(previo?.firstPaymentDate || enUnMes()).slice(0, 10));
  const [comisionPct, setComisionPct] = useState(String(previo?.comisionPct ?? (yaHabia ? 0 : 3)));
  const [comisionFinanciada, setComisionFinanciada] = useState<boolean>(!!previo?.comisionFinanciada);
  const [cotizacion, setCotizacion] = useState<any>(null);

  // La última cotización de este cliente, para cargarla con un clic.
  useEffect(() => {
    const clientId = (client as any).originalClientId || client.id;
    const agencyId = (client as any).agencyId;
    if (!clientId || !agencyId) return;
    getDocs(query(collection(db, 'notes'), where('clientId', '==', clientId), where('agencyId', '==', agencyId)))
      .then((s) => {
        const c = s.docs.map((d) => d.data() as any).filter((n) => n.type === 'cotizacion' && n.cotizacion)
          .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0];
        if (c) setCotizacion({ ...c.cotizacion, fecha: c.createdAt });
      }).catch(() => {});
  }, [client]);

  const usarCotizacion = () => {
    const c = cotizacion;
    if (!c) return;
    setForma(c.forma === 'credito_bancario' ? 'credito_bancario' : c.forma === 'credito' ? 'credito' : 'contado');
    setPrecio(String(c.precioFinal || c.precioLista || precio));
    if (c.engancheTotal) setEnganche(String(c.engancheTotal));
    const plazo = (c.plazos || []).filter((m: number) => m > 0).sort((a: number, b: number) => b - a)[0];
    if (plazo) setMeses(String(plazo));
    if (c.forma === 'credito' && c.tasa) setTasa(String(c.tasa));
    setComisionPct(String(c.comisionPct ?? 0));
    setComisionFinanciada(!!c.comisionFinanciada);
  };

  const precioN = num(precio);
  const originalPrice = Number(vehicle?.price) || 0;
  const cambioDePrecio = originalPrice > 0 && precioN > 0 && precioN !== originalPrice;
  const c = useMemo(() => calcularCreditoCasa({
    precio: precioN, enganche: num(enganche), meses: num(meses), tasaMensual: num(tasa), comisionPct: num(comisionPct), comisionFinanciada,
  }), [precioN, enganche, meses, tasa, comisionPct, comisionFinanciada]);

  const errores: string[] = [];
  if (!(precioN > 0)) errores.push('Pon el precio de venta.');
  if (forma === 'credito') {
    if (num(enganche) >= precioN && precioN > 0) errores.push('El enganche no puede ser todo el precio: entonces es de contado.');
    if (!(num(meses) >= 1 && num(meses) <= 120)) errores.push('El plazo va de 1 a 120 meses.');
    if (!primera) errores.push('Pon la fecha de la primera mensualidad.');
  }
  const cambiaForma = yaHabia && previo.method !== forma;

  const armar = (): SaleDetails => {
    if (forma === 'contado') return { method: 'contado', price: precioN } as any;
    if (forma === 'credito_bancario') return { method: 'credito_bancario', price: precioN, ...(num(enganche) ? { downPayment: num(enganche) } : {}) } as any;
    return {
      method: 'credito',
      price: precioN,
      downPayment: c.enganche,
      termMonths: c.meses,
      interestRate: num(tasa),
      interestType: 'mensual',
      firstPaymentDate: primera,
      comisionPct: num(comisionPct),
      comisionMonto: c.comision,
      comisionFinanciada,
      montoFinanciado: c.financiado,
      calculatedTotalInterest: c.interes,
      calculatedTotalAmount: c.totalFinanciado,
      calculatedMonthlyPayment: c.mensualidad,
    } as any;
  };

  // Un solo envío: guardar tarda unos segundos y un segundo clic duplicaba la venta y sus tareas.
  const enviadoRef = useRef(false);
  const [guardando, setGuardando] = useState(false);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (errores.length || enviadoRef.current) return;
    if (cambiaForma && !window.confirm(`La venta estaba registrada como «${FORMAS.find((f) => f.id === previo.method)?.titulo || previo.method}». ¿Cambiarla a «${FORMAS.find((f) => f.id === forma)?.titulo}»?${pagosRegistrados ? ' Los pagos ya registrados se conservan.' : ''}`)) return;
    enviadoRef.current = true;
    setGuardando(true);
    try {
      await onConfirm(armar());
    } finally {
      enviadoRef.current = false;
      setGuardando(false);
    }
  };

  const auto = vehicle ? `${vehicle.year || ''} ${vehicle.make || ''} ${vehicle.model || ''}`.replace(/\s+/g, ' ').trim() : (client as any).vehicle || '';

  return (
    <div className="fixed inset-0 z-[100] flex items-stretch md:items-center justify-center md:p-4">
      <motion.div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={guardando ? undefined : onCancel} initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
      <motion.form
        onSubmit={handleSubmit}
        className="relative z-10 bg-white dark:bg-slate-900 md:rounded-2xl shadow-2xl w-full max-w-3xl md:max-h-[94vh] flex flex-col"
        initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', damping: 24, stiffness: 300 }}
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="min-w-0">
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">{yaHabia ? 'Editar la venta' : 'Registrar la venta'}</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 truncate">{client.name}{auto ? ` · ${auto}` : ''}</p>
          </div>
          <button type="button" onClick={onCancel} disabled={guardando} aria-label="Cerrar" className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 grid gap-5 md:grid-cols-[minmax(0,1fr)_260px]">
          <div className="flex flex-col gap-4 min-w-0">
            {cotizacion && (
              <button type="button" onClick={usarCotizacion} className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-900 px-3 py-2 text-left text-sm text-blue-900 dark:text-blue-200 flex items-center gap-2 hover:bg-blue-100">
                <FileText className="w-4 h-4 shrink-0" />
                <span>Usar la cotización <b>{cotizacion.folio}</b>{cotizacion.fecha ? ` del ${new Date(cotizacion.fecha).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}` : ''} ({FORMAS.find((f) => f.id === cotizacion.forma)?.titulo || 'contado'}, {pesos(cotizacion.precioFinal || 0)})</span>
              </button>
            )}

            <fieldset>
              <legend className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">¿Cómo se vendió?</legend>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {FORMAS.map((f) => (
                  <button key={f.id} type="button" role="radio" aria-checked={forma === f.id} onClick={() => setForma(f.id)}
                    className={clsx('rounded-xl border-2 p-3 text-left flex flex-col gap-1 transition-colors',
                      forma === f.id ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300')}>
                    <f.Icono className={clsx('w-5 h-5', forma === f.id ? 'text-emerald-700' : 'text-slate-500')} />
                    <span className="text-sm font-extrabold text-slate-900 dark:text-white">{f.titulo}</span>
                    <span className="text-[11px] leading-tight text-slate-600 dark:text-slate-400">{f.detalle}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex justify-between">Precio de venta {originalPrice > 0 && <span className="font-normal text-slate-500">Precio de lista {pesos(originalPrice)}</span>}</span>
              <input value={precio} onChange={(e) => setPrecio(e.target.value)} inputMode="decimal" className={campo} placeholder="$0" />
            </label>
            {cambioDePrecio && (
              <p className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-900 dark:text-amber-200 flex gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" /> Precio distinto al de lista ({precioN > originalPrice ? '+' : ''}{pesos(precioN - originalPrice)}). Si tu usuario no puede cambiar precios, la venta queda pendiente de aprobación.
              </p>
            )}

            {forma === 'credito' && (
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 col-span-2 sm:col-span-1">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Enganche</span>
                  <input value={enganche} onChange={(e) => setEnganche(e.target.value)} inputMode="decimal" className={campo} placeholder="$0" />
                </label>
                <label className="flex flex-col gap-1 col-span-2 sm:col-span-1">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Primera mensualidad</span>
                  <input type="date" value={primera} onChange={(e) => setPrimera(e.target.value)} className={campo} />
                </label>
                <div className="col-span-2 flex flex-col gap-1">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Plazo</span>
                  <div className="flex flex-wrap gap-1.5 items-center">
                    {[12, 18, 24, 36, 48].map((m) => (
                      <button key={m} type="button" onClick={() => setMeses(String(m))}
                        className={clsx('h-10 px-3 rounded-lg border text-sm font-bold', num(meses) === m ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900' : 'border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300')}>{m}</button>
                    ))}
                    <input value={meses} onChange={(e) => setMeses(e.target.value)} inputMode="numeric" aria-label="Meses" className="h-10 w-20 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 text-sm text-center" />
                    <span className="text-xs text-slate-500">meses</span>
                  </div>
                </div>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Interés mensual (%)</span>
                  <input value={tasa} onChange={(e) => setTasa(e.target.value)} inputMode="decimal" className={campo} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Comisión por apertura (%)</span>
                  <input value={comisionPct} onChange={(e) => setComisionPct(e.target.value)} inputMode="decimal" className={campo} />
                </label>
                {num(comisionPct) > 0 && (
                  <div className="col-span-2 flex flex-col gap-1">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">La comisión ({pesos(c.comision)}) se paga</span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {([[true, 'Financiada (en las mensualidades)'], [false, 'De contado (con el enganche)']] as const).map(([v, t]) => (
                        <button key={String(v)} type="button" role="radio" aria-checked={comisionFinanciada === v} onClick={() => setComisionFinanciada(v)}
                          className={clsx('min-h-[40px] px-2 rounded-lg text-xs font-bold border', comisionFinanciada === v ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900' : 'border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300')}>{t}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {forma === 'credito_bancario' && (
              <label className="flex flex-col gap-1">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Enganche que recibe la agencia (opcional)</span>
                <input value={enganche} onChange={(e) => setEnganche(e.target.value)} inputMode="decimal" className={campo} placeholder="$0" />
                <span className="text-[11px] text-slate-500">El resto lo paga el banco. Registra cada depósito como un pago.</span>
              </label>
            )}

            {cambiaForma && (
              <p className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-900 dark:text-amber-200 flex gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" /> Vas a cambiar la forma de venta.{pagosRegistrados ? ` Los ${pagosRegistrados} pagos registrados se conservan.` : ''}
              </p>
            )}
          </div>

          {/* Resumen en vivo */}
          <aside className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-4 flex flex-col gap-2 text-sm h-fit md:sticky md:top-0">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Resumen</p>
            {forma === 'credito' ? (
              <>
                <Fila t="Precio" v={pesos(c.precio)} />
                <Fila t="Enganche" v={pesos(c.enganche)} />
                {c.comision > 0 && <Fila t={`Comisión ${num(comisionPct)}% · ${comisionFinanciada ? 'financiada' : 'de contado'}`} v={pesos(c.comision)} />}
                <Fila t="Pago inicial" v={pesos(c.pagoInicial)} fuerte />
                <hr className="border-slate-200 dark:border-slate-700" />
                <Fila t="A financiar" v={pesos(c.financiado)} />
                <Fila t={`Intereses (${num(tasa)}% × ${c.meses} meses)`} v={pesos(c.interes)} />
                <div className="rounded-lg bg-emerald-600 text-white px-3 py-2.5 my-1">
                  <p className="text-[11px] font-bold uppercase opacity-90">{c.meses} mensualidades de</p>
                  <p className="text-2xl font-extrabold">{pesos(c.mensualidad)}</p>
                </div>
                <Fila t="Total que pagará" v={pesos(c.totalAPagar)} fuerte />
              </>
            ) : (
              <>
                <Fila t="Precio" v={pesos(precioN)} fuerte />
                {forma === 'credito_bancario' && num(enganche) > 0 && <Fila t="Enganche (agencia)" v={pesos(num(enganche))} />}
                {forma === 'credito_bancario' && <Fila t="Paga el banco" v={pesos(Math.max(0, precioN - num(enganche)))} />}
              </>
            )}
          </aside>
        </div>

        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-end">
          {errores[0] && <p className="text-xs font-semibold text-red-700 dark:text-red-400 sm:mr-auto">{errores[0]}</p>}
          <button type="button" onClick={onCancel} disabled={guardando} className="h-11 px-4 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-bold">Cancelar</button>
          <button type="submit" disabled={guardando || errores.length > 0} className="h-11 px-5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-bold">
            {guardando ? 'Guardando…' : yaHabia ? 'Guardar cambios' : 'Registrar venta'}
          </button>
        </div>
      </motion.form>
    </div>
  );
}

function Fila({ t, v, fuerte }: { t: string; v: string; fuerte?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-slate-600 dark:text-slate-400">{t}</span>
      <span className={clsx('text-right', fuerte ? 'font-extrabold text-slate-900 dark:text-white' : 'font-semibold text-slate-800 dark:text-slate-200')}>{v}</span>
    </div>
  );
}
