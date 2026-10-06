import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import clsx from 'clsx';
import { doc, updateDoc } from 'firebase/firestore';
import { AlertTriangle, ArrowLeft, Ban, Undo2, BadgeCheck, CalendarClock, CheckCircle2, Loader2, Pencil, Plus, Receipt, Sparkles, X } from 'lucide-react';
import { db } from '../lib/firebase';
import { ventasApi } from '../lib/ventasApi';
import { sanitizeFirestoreData } from '../lib/clientUtils';
import { hoyLocal } from '../lib/fechas';
import {
  cobroSugerido, liquidacionAnticipada, NOMBRE_CONCEPTO, NOMBRE_FORMA, NOMBRE_METODO,
  type EstadoDeCuenta, type Mensualidad, type PagoVenta,
} from '../lib/planDePagos';
import { DealWonModal } from '../components/DealWonModal';
import { aplicacionDelPago } from '../lib/planDePagos';
import { conceptoDelRecibo, folioDeRecibo, generarReciboPdf } from '../lib/reciboPdf';
import { descargarOCompartirArchivos } from '../lib/creditosApi';

/** Recibo de un pago, con lo que cubrió y el saldo que dejó. */
async function hacerRecibo(datos: any, pagoId: string) {
  const v = datos.venta;
  const p: PagoVenta | undefined = v.pagos.find((x: PagoVenta) => x.id === pagoId);
  if (!p) return;
  const ap = aplicacionDelPago(v.plan, v.pagos, pagoId);
  const blob = await generarReciboPdf({
    pago: p, folio: folioDeRecibo(p.id), cliente: v.cliente?.nombre || '', auto: v.auto, agencia: v.agencia,
    concepto: conceptoDelRecibo(p, ap),
    saldoAntes: ap?.saldoAntes ?? 0, saldoDespues: ap?.saldoDespues ?? 0,
    proxima: ap?.proxima ? { n: ap.proxima.n, fecha: ap.proxima.fecha, monto: ap.proxima.monto - ap.proxima.cubierto } : null,
    plazo: ap?.plazo,
  });
  const nombre = `Recibo ${folioDeRecibo(p.id)} ${v.cliente?.nombre || ''}.pdf`.replace(/\s+/g, ' ').trim();
  await descargarOCompartirArchivos([new File([blob], nombre, { type: 'application/pdf' })], `Recibo ${folioDeRecibo(p.id)}`);
}

/**
 * Venta y pagos, en página completa: cuánto se debe, qué está pagado, qué
 * va atrasado y todo el historial. El dinero se registra aquí (y solo pasa
 * por el servidor); las demás pantallas traen aquí.
 */

const pesos = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 }).format(Number(n) || 0);
const fechaCorta = (s: string) => (s ? new Date(`${s.slice(0, 10)}T12:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const campo = 'w-full h-11 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500';

const ESTADO: Record<Mensualidad['estado'], { t: string; c: string }> = {
  pagada: { t: 'Pagada', c: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' },
  parcial: { t: 'Parcial', c: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' },
  atrasada: { t: 'Atrasada', c: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' },
  'por-vencer': { t: 'Por vencer', c: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' },
  pendiente: { t: 'Pendiente', c: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
};

export function VentaPagos() {
  const { dealId = '' } = useParams();
  const navigate = useNavigate();
  const [datos, setDatos] = useState<any>(null);
  const [error, setError] = useState('');
  const [pagando, setPagando] = useState<false | 'pago' | 'devolucion'>(false);
  const [liquidando, setLiquidando] = useState(false);
  const [editando, setEditando] = useState(false);
  const [verTodas, setVerTodas] = useState(false);

  const cargar = useCallback(async () => {
    try { const d = await ventasApi.leer(dealId); setDatos(d); setError(''); return d; } catch (e: any) { setError(e.message); return null; }
  }, [dealId]);
  const recibo = async (d: any, id: string) => {
    try { await hacerRecibo(d, id); } catch (e: any) { alert(`No se pudo hacer el recibo. ${e?.message || ''}`); }
  };
  useEffect(() => { cargar(); }, [cargar]);

  if (error && !datos) {
    return (
      <div className="p-8 text-center flex flex-col items-center gap-3">
        <p className="text-slate-700 dark:text-slate-300">{error}</p>
        <button onClick={() => navigate(-1)} className="h-10 px-4 rounded-lg bg-slate-900 text-white text-sm font-bold">Regresar</button>
      </div>
    );
  }
  if (!datos) return <div className="h-full flex items-center justify-center"><Loader2 className="w-7 h-7 animate-spin text-slate-400" /></div>;

  const v = datos.venta;
  const ec: EstadoDeCuenta = v.cuenta;
  const pagos: PagoVenta[] = v.pagos;
  const puede = datos.puedeCobrar;
  const metodo = NOMBRE_METODO[v.plan?.method] || 'Sin registrar';
  const avance = ec.totalAPagar > 0 ? Math.min(100, ((ec.pagado + ec.descontado) / ec.totalAPagar) * 100) : 0;

  const anular = async (p: PagoVenta) => {
    const motivo = window.prompt(`¿Por qué se anula el pago de ${pesos(p.monto)} del ${fechaCorta(p.fecha)}? (queda en el historial, tachado)`);
    if (!motivo?.trim()) return;
    try { await ventasApi.anular(dealId, p.id, motivo.trim()); await cargar(); } catch (e: any) { alert(e.message); }
  };

  const guardarPlan = async (detalles: any) => {
    // Se reemplaza el plan completo (no se mezcla con el anterior) y el
    // servidor vuelve a poner los pagos y las tareas.
    await ventasApi.reflejar(dealId); // primero se asegura que los pagos estén en su lugar propio
    await updateDoc(doc(db, 'deals', dealId), { saleDetails: sanitizeFirestoreData({ ...detalles, payments: [] }), value: detalles.price, updatedAt: new Date().toISOString() });
    await ventasApi.reflejar(dealId);
    setEditando(false);
    await cargar();
  };

  return (
    <div className="h-full overflow-y-auto bg-slate-100 dark:bg-slate-900">
      <div className="max-w-6xl mx-auto p-3 md:p-5 flex flex-col gap-4">
        {/* Encabezado */}
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <button onClick={() => navigate(-1)} aria-label="Regresar" className="mt-1 p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"><ArrowLeft className="w-4 h-4" /></button>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Venta y pagos</p>
              <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white truncate">{v.cliente?.nombre || 'Cliente'}</h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 flex flex-wrap gap-x-2">
                {v.auto?.nombre && <span>{v.auto.nombre}</span>}
                <span className="font-semibold text-slate-800 dark:text-slate-200">· {metodo}</span>
                {v.vendidoEl && <span>· vendido el {fechaCorta(v.vendidoEl)}</span>}
              </p>
            </div>
          </div>
          {puede && v.tienePlan && (
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setEditando(true)} className="h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-bold flex items-center gap-1.5"><Pencil className="w-4 h-4" /> Editar venta</button>
              {ec.esCredito && !ec.liquidada && <button onClick={() => setLiquidando(true)} className="h-11 px-3 rounded-lg border border-emerald-600 text-emerald-700 dark:text-emerald-400 bg-white dark:bg-slate-800 text-sm font-bold flex items-center gap-1.5"><Sparkles className="w-4 h-4" /> Liquidar</button>}
              {ec.aFavor > 0.5 && <button onClick={() => setPagando('devolucion')} className="h-11 px-4 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold flex items-center gap-1.5"><Undo2 className="w-4 h-4" /> Devolver {pesos(ec.aFavor)}</button>}
              {!ec.liquidada && <button onClick={() => setPagando('pago')} className="h-11 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold flex items-center gap-1.5"><Plus className="w-4 h-4" /> Registrar pago</button>}
            </div>
          )}
        </header>

        {!v.tienePlan && (
          <p className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm text-amber-900 dark:text-amber-200">Esta venta aún no tiene precio ni forma de pago. Regístrala desde el trato con «Trato ganado».</p>
        )}

        {ec.aFavor > 0.5 && (
          <p className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm text-amber-900 dark:text-amber-200 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>El cliente pagó <b>{pesos(ec.aFavor)} de más</b> (por ejemplo, el auto que dejó a cuenta vale más que el que compra). Cuando se lo regreses, registra la <b>devolución</b>: queda con fecha, forma y recibo.</span>
          </p>
        )}

        {/* Números grandes */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Kpi t="Total a pagar" v={pesos(ec.totalAPagar)} s={ec.esCredito ? `Precio ${pesos(ec.precio)} + intereses` : 'Precio de venta'} />
          <Kpi t="Pagado" v={pesos(ec.pagado)} s={ec.descontado ? `+ ${pesos(ec.descontado)} de intereses descontados` : `${pagos.filter((p) => !p.anulado && p.concepto !== 'descuento').length} pagos`} verde />
          <Kpi t="Saldo" v={pesos(ec.saldo)} s={ec.liquidada ? 'Liquidada' : ec.esCredito ? `${ec.mensualidades.length - ec.pagadas} mensualidades por cubrir` : 'Por cobrar'} oscuro />
          {ec.atrasadas > 0
            ? <Kpi t="Atrasado" v={pesos(ec.montoAtrasado)} s={`${ec.atrasadas} ${ec.atrasadas === 1 ? 'mensualidad' : 'mensualidades'} vencida${ec.atrasadas === 1 ? '' : 's'}`} rojo />
            : <Kpi t="Próximo cobro" v={ec.proxima ? pesos(ec.proxima.monto - ec.proxima.cubierto) : ec.liquidada ? '—' : pesos(cobroSugerido(ec).monto)} s={ec.proxima ? `Mensualidad ${ec.proxima.n} · ${fechaCorta(ec.proxima.fecha)}` : ec.liquidada ? 'Nada pendiente' : cobroSugerido(ec).etiqueta} />}
        </section>

        <div className="h-2.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden" aria-label={`Pagado ${Math.round(avance)} %`}>
          <div className="h-full bg-emerald-500" style={{ width: `${avance}%` }} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-4">
          {/* Plan */}
          <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 h-fit flex flex-col gap-2 text-sm">
            <h2 className="font-extrabold text-slate-900 dark:text-white">El plan</h2>
            <Fila t="Forma de venta" v={metodo} />
            <Fila t="Precio" v={pesos(ec.precio)} />
            {ec.esCredito && (
              <>
                <Fila t="Enganche" v={pesos(ec.enganche)} />
                {ec.comision > 0 && <Fila t={`Comisión por apertura (${v.plan.comisionPct || 0}%)`} v={`${pesos(ec.comision)} · ${ec.comisionFinanciada ? 'financiada' : 'de contado'}`} />}
                <Fila t="A financiar" v={pesos(ec.financiado)} />
                <Fila t={`Intereses (${v.plan.interestRate || 0}% mensual)`} v={pesos(ec.interes)} />
                <Fila t="Plazo" v={`${ec.mensualidades.length} meses`} />
                <Fila t="Mensualidad" v={pesos(ec.mensualidad)} fuerte />
                <Fila t="Primera mensualidad" v={fechaCorta(v.plan.firstPaymentDate)} />
                <div className={clsx('mt-1 rounded-lg px-3 py-2 text-xs font-semibold flex items-center gap-2', ec.pagoInicialPagado >= ec.pagoInicial - 0.5 ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300' : 'bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-300')}>
                  {ec.pagoInicialPagado >= ec.pagoInicial - 0.5 ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  Pago inicial: {pesos(ec.pagoInicialPagado)} de {pesos(ec.pagoInicial)}
                </div>
              </>
            )}
            {v.auto?.id && <button onClick={() => navigate(`/inventory/${v.auto.id}`)} className="mt-2 text-left text-xs font-bold text-blue-700 hover:underline">Ver el auto →</button>}
          </section>

          <div className="flex flex-col gap-4 min-w-0">
            {/* Calendario */}
            {ec.esCredito && ec.mensualidades.length > 0 && (
              <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <h2 className="font-extrabold text-slate-900 dark:text-white flex items-center gap-2"><CalendarClock className="w-4 h-4" /> Mensualidades <span className="text-sm font-semibold text-slate-500">{ec.pagadas} de {ec.mensualidades.length} pagadas</span></h2>
                  {ec.mensualidades.length > 12 && <button onClick={() => setVerTodas((x) => !x)} className="text-xs font-bold text-blue-700 hover:underline">{verTodas ? 'Ver menos' : 'Ver todas'}</button>}
                </div>
                <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                  {(verTodas ? ec.mensualidades : alrededor(ec.mensualidades)).map((m) => (
                    <li key={m.n} className={clsx('rounded-lg border px-3 py-2 flex items-center justify-between gap-2', m.estado === 'atrasada' ? 'border-red-300 dark:border-red-800' : 'border-slate-200 dark:border-slate-700')}>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{m.n}. {fechaCorta(m.fecha)}</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400">{pesos(m.monto)}{m.estado === 'parcial' || (m.estado === 'atrasada' && m.cubierto > 0) ? ` · faltan ${pesos(m.monto - m.cubierto)}` : ''}{m.estado === 'atrasada' ? ` · ${m.diasAtraso} días` : ''}</p>
                      </div>
                      <span className={clsx('shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full', ESTADO[m.estado].c)}>{ESTADO[m.estado].t}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Historial */}
            <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <h2 className="font-extrabold text-slate-900 dark:text-white flex items-center gap-2 mb-3"><Receipt className="w-4 h-4" /> Pagos registrados</h2>
              {pagos.length === 0 ? (
                <p className="text-sm text-slate-500">Todavía no hay pagos.{puede && v.tienePlan ? ' Usa «Registrar pago».' : ''}</p>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                  {pagos.map((p) => (
                    <li key={p.id} className={clsx('py-2.5 flex items-start justify-between gap-3', p.anulado && 'opacity-60')}>
                      <div className="min-w-0">
                        <p className={clsx('text-sm font-bold text-slate-900 dark:text-white', p.anulado && 'line-through')}>
                          {p.concepto === 'descuento' ? <span className="text-emerald-700 dark:text-emerald-400">Descuento de intereses</span> : p.concepto === 'devolucion' ? <span className="text-amber-700 dark:text-amber-400">Devolución al cliente</span> : NOMBRE_CONCEPTO[p.concepto] || 'Pago'}
                          <span className="font-normal text-slate-500"> · {fechaCorta(p.fecha)}{p.concepto !== 'descuento' ? ` · ${NOMBRE_FORMA[p.forma] || p.forma}` : ''}</span>
                        </p>
                        {p.nota && <p className="text-xs text-slate-600 dark:text-slate-400">{p.nota}</p>}
                        <p className="text-[11px] text-slate-500">
                          {p.origen === 'migrado' ? 'Registrado antes del sistema nuevo' : `Registró ${p.registradoPorNombre || '—'}`}
                          {p.anulado && <> · <b className="text-red-700 dark:text-red-400">Anulado</b> por {p.anuladoPorNombre}: {p.motivoAnulacion}</>}
                        </p>
                      </div>
                      <div className="shrink-0 text-right flex flex-col items-end gap-1">
                        <span className={clsx('text-sm font-extrabold', p.concepto === 'descuento' ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-900 dark:text-white', p.anulado && 'line-through')}>{p.concepto === 'devolucion' ? '−' : ''}{pesos(p.monto)}</span>
                        {!p.anulado && p.concepto !== 'descuento' && (
                          <button onClick={() => recibo(datos, p.id)} className="text-[11px] font-bold text-blue-700 dark:text-blue-400 hover:underline flex items-center gap-1"><Receipt className="w-3 h-3" /> Recibo</button>
                        )}
                        {puede && !p.anulado && p.concepto !== 'descuento' && (
                          <button onClick={() => anular(p)} className="text-[11px] font-bold text-red-700 dark:text-red-400 hover:underline flex items-center gap-1"><Ban className="w-3 h-3" /> Anular</button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </div>

      {pagando && <RegistrarPago modo={pagando} dealId={dealId} ec={ec} onCerrar={() => setPagando(false)} onListo={async (id) => {
        setPagando(false);
        const d = await cargar();
        if (d && id && window.confirm('Pago registrado. ¿Hacer el recibo?')) await recibo(d, id);
      }} />}
      {liquidando && <Liquidar dealId={dealId} plan={v.plan} pagos={pagos} puedeDescontar={datos.puedeDescontar} onCerrar={() => setLiquidando(false)} onListo={async () => { setLiquidando(false); await cargar(); }} />}
      {editando && (
        <DealWonModal
          client={{ id: v.cliente?.id, name: v.cliente?.nombre, dealValue: v.plan?.price } as any}
          vehicle={null}
          inicial={{ ...v.plan, payments: pagos.filter((p) => !p.anulado) } as any}
          onConfirm={guardarPlan}
          onCancel={() => setEditando(false)}
        />
      )}
    </div>
  );
}

/** En créditos largos se muestran las cercanas: dos antes de la próxima y nueve después. */
function alrededor(ms: Mensualidad[]) {
  if (ms.length <= 12) return ms;
  const i = Math.max(0, ms.findIndex((m) => m.estado !== 'pagada'));
  const desde = Math.max(0, Math.min(i - 2, ms.length - 12));
  return ms.slice(desde, desde + 12);
}

function Kpi({ t, v, s, verde, rojo, oscuro }: { t: string; v: string; s?: string; verde?: boolean; rojo?: boolean; oscuro?: boolean }) {
  return (
    <div className={clsx('rounded-xl p-4 border', oscuro ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900' : rojo ? 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-900' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700')}>
      <p className={clsx('text-[11px] font-bold uppercase tracking-wide', oscuro ? 'opacity-80' : rojo ? 'text-red-700 dark:text-red-300' : 'text-slate-500')}>{t}</p>
      <p className={clsx('text-xl md:text-2xl font-extrabold mt-0.5', verde && 'text-emerald-700 dark:text-emerald-400', rojo && 'text-red-700 dark:text-red-300')}>{v}</p>
      {s && <p className={clsx('text-xs mt-0.5', oscuro ? 'opacity-80' : 'text-slate-600 dark:text-slate-400')}>{s}</p>}
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

function Ventana({ titulo, onCerrar, children }: { titulo: string; onCerrar: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/60" onClick={onCerrar} />
      <div className="relative bg-white dark:bg-slate-800 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
          <h3 className="font-extrabold text-slate-900 dark:text-white">{titulo}</h3>
          <button onClick={onCerrar} aria-label="Cerrar" className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"><X className="w-5 h-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function RegistrarPago({ modo, dealId, ec, onCerrar, onListo }: { modo: 'pago' | 'devolucion'; dealId: string; ec: EstadoDeCuenta; onCerrar: () => void; onListo: (id?: string) => void }) {
  const devolviendo = modo === 'devolucion';
  const sug = useMemo(() => devolviendo ? { concepto: 'devolucion' as const, monto: ec.aFavor, etiqueta: 'Lo que el cliente pagó de más' } : cobroSugerido(ec), [ec, devolviendo]);
  const [concepto, setConcepto] = useState<string>(sug.concepto);
  const [monto, setMonto] = useState(sug.monto ? String(Math.round(sug.monto * 100) / 100) : '');
  const [fecha, setFecha] = useState(hoyLocal());
  const [forma, setForma] = useState('transferencia');
  const [nota, setNota] = useState('');
  const [clave] = useState(ventasApi.nuevaClave());
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const montoN = Number(String(monto).replace(/[^\d.]/g, '')) || 0;
  const conceptos = devolviendo ? ['devolucion'] : ec.esCredito ? ['enganche', 'mensualidad', 'abono', ...(ec.comision > 0 && !ec.comisionFinanciada ? ['comision'] : [])] : ['pago'];

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!(montoN > 0)) return setError('Pon el monto.');
    if (!devolviendo && montoN > ec.saldo + 0.5 && !window.confirm(`El pago (${pesos(montoN)}) es mayor que el saldo (${pesos(ec.saldo)}). ¿Registrarlo así?`)) return;
    setGuardando(true); setError('');
    try { const r = await ventasApi.pagar(dealId, { monto: montoN, fecha, forma, concepto, nota, clave }); onListo(r.id); }
    catch (e: any) { setError(e.message); setGuardando(false); }
  };

  return (
    <Ventana titulo={devolviendo ? 'Devolución al cliente' : 'Registrar pago'} onCerrar={onCerrar}>
      <form onSubmit={guardar} className="p-4 flex flex-col gap-3">
        {sug.etiqueta && <p className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 text-xs px-3 py-2">Sugerido: <b>{sug.etiqueta}</b> por {pesos(sug.monto)}</p>}
        {devolviendo && <p className="text-xs text-slate-600 dark:text-slate-400">Registra el dinero que la agencia le <b>regresa</b> al cliente. Solo se puede devolver lo que pagó de más.</p>}
        {conceptos.length > 1 && (
          <div className="grid grid-cols-2 gap-1.5">
            {conceptos.map((c) => (
              <button key={c} type="button" onClick={() => setConcepto(c)} className={clsx('h-10 rounded-lg border text-xs font-bold', concepto === c ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900' : 'border-slate-300 dark:border-slate-600')}>{NOMBRE_CONCEPTO[c]}</button>
            ))}
          </div>
        )}
        <label className="flex flex-col gap-1"><span className="text-xs font-bold">{devolviendo ? 'Monto que se devuelve' : 'Monto recibido'}</span><input autoFocus value={monto} onChange={(e) => setMonto(e.target.value)} inputMode="decimal" className={clsx(campo, 'text-lg font-bold')} /></label>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1"><span className="text-xs font-bold">Fecha</span><input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={campo} /></label>
          <label className="flex flex-col gap-1"><span className="text-xs font-bold">Forma</span>
            <select value={forma} onChange={(e) => setForma(e.target.value)} className={campo}>{Object.entries(NOMBRE_FORMA).filter(([k]) => !devolviendo || k !== 'auto').map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>
          </label>
        </div>
        <label className="flex flex-col gap-1"><span className="text-xs font-bold">Nota (opcional)</span><input value={nota} onChange={(e) => setNota(e.target.value)} maxLength={300} placeholder="Ej. folio de la transferencia" className={campo} /></label>
        {ec.esCredito && concepto !== 'enganche' && concepto !== 'comision' && <p className="text-[11px] text-slate-500">Se aplica a las mensualidades en orden, empezando por la más antigua sin cubrir.</p>}
        {error && <p className="text-xs font-semibold text-red-700 dark:text-red-400">{error}</p>}
        <button type="submit" disabled={guardando} className="h-12 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold flex items-center justify-center gap-2">
          {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <BadgeCheck className="w-4 h-4" />} {devolviendo ? 'Registrar devolución' : 'Registrar'} {montoN ? pesos(montoN) : ''}
        </button>
      </form>
    </Ventana>
  );
}

function Liquidar({ dealId, plan, pagos, puedeDescontar, onCerrar, onListo }: { dealId: string; plan: any; pagos: PagoVenta[]; puedeDescontar: boolean; onCerrar: () => void; onListo: () => void }) {
  const [fecha, setFecha] = useState(hoyLocal());
  const [forma, setForma] = useState('transferencia');
  const [descontar, setDescontar] = useState(puedeDescontar);
  const [clave] = useState(ventasApi.nuevaClave());
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const l = useMemo(() => liquidacionAnticipada(plan, pagos, fecha), [plan, pagos, fecha]);
  if (!l) return null;
  const monto = descontar ? l.conDescuento : l.sinDescuento;

  const guardar = async () => {
    if (!window.confirm(`¿Registrar la liquidación por ${pesos(monto)}?${descontar && l.interesFuturo > 0 ? ` Se descuentan ${pesos(l.interesFuturo)} de intereses.` : ''}`)) return;
    setGuardando(true); setError('');
    try { await ventasApi.liquidar(dealId, { fecha, forma, descontarIntereses: descontar, montoEsperado: monto, clave }); onListo(); }
    catch (e: any) { setError(e.message); setGuardando(false); }
  };

  return (
    <Ventana titulo="Liquidar el crédito" onCerrar={onCerrar}>
      <div className="p-4 flex flex-col gap-3 text-sm">
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1"><span className="text-xs font-bold">Fecha del pago</span><input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={campo} /></label>
          <label className="flex flex-col gap-1"><span className="text-xs font-bold">Forma</span>
            <select value={forma} onChange={(e) => setForma(e.target.value)} className={campo}>{Object.entries(NOMBRE_FORMA).map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>
          </label>
        </div>
        <div className="rounded-lg bg-slate-50 dark:bg-slate-900/50 p-3 flex flex-col gap-1.5">
          {l.inicialPendiente > 0 && <Fila t="Falta del pago inicial" v={pesos(l.inicialPendiente)} />}
          <Fila t="Capital pendiente" v={pesos(l.capital)} />
          <Fila t="Intereses ya vencidos" v={pesos(l.interesVencido)} />
          <Fila t="Intereses de meses que no han llegado" v={pesos(l.interesFuturo)} />
        </div>
        {puedeDescontar ? (
          <label className="flex items-start gap-2.5 rounded-lg border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 p-3 cursor-pointer">
            <input type="checkbox" checked={descontar} onChange={(e) => setDescontar(e.target.checked)} className="mt-0.5 w-4 h-4 accent-emerald-600" />
            <span><b>Quitar los intereses que no se generaron</b> ({pesos(l.interesFuturo)}). Queda registrado como descuento, con tu nombre.</span>
          </label>
        ) : <p className="text-xs text-slate-500">Para quitar intereses por pago anticipado, pídeselo a un administrador o gerente.</p>}
        <div className="rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-4 py-3">
          <p className="text-[11px] font-bold uppercase opacity-80">Para liquidar paga</p>
          <p className="text-2xl font-extrabold">{pesos(monto)}</p>
          {descontar && l.interesFuturo > 0 && <p className="text-xs opacity-80">En vez de {pesos(l.sinDescuento)}</p>}
        </div>
        {error && <p className="text-xs font-semibold text-red-700 dark:text-red-400">{error}</p>}
        <button onClick={guardar} disabled={guardando} className="h-12 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold flex items-center justify-center gap-2">
          {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Registrar liquidación
        </button>
      </div>
    </Ventana>
  );
}
