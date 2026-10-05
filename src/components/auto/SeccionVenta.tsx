import React, { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { doc, getDoc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { Trash2 } from 'lucide-react';
import { db } from '../../lib/firebase';
import { hoyLocal } from '../../lib/fechas';
import { sanitizeFirestoreData } from '../../lib/clientUtils';
import { createPaymentTasks } from '../../lib/paymentTasks';
import { puedeVenderSinAprobacion, vehiculoVendido } from '../../lib/ventaDeVehiculo';
import { avisoDeVentaDuplicada, ventaYaRegistrada } from '../../lib/ventas';
import { SeleccionarTratoVenta } from '../SeleccionarTratoVenta';
import { DealWonModal } from '../DealWonModal';
import { useNavigate } from 'react-router';
import { ventasApi } from '../../lib/ventasApi';
import type { Client, Vehicle } from '../../types';

/**
 * Vender el auto y llevar sus pagos, sin salir de su página.
 *
 * Vender: 1) a qué trato pertenece la venta (el mismo selector de siempre),
 * 2) precio y forma de pago (la misma ventanita que al cerrar desde el
 * cliente). El dinero queda en el trato; el contacto guarda la referencia; el
 * auto, su estado. Quien no puede vender sin aprobación (vendedores, gerentes)
 * deja la solicitud pendiente, como en la ficha del cliente.
 *
 * Pagos: los del trato de la venta más los que solo quedaron en el auto
 * (mismo criterio que la ficha del auto tenía antes).
 */

const pesos = (n: number) => `$${Math.round(Number(n) || 0).toLocaleString('es-MX')}`;
const claveDePago = (p: any) => `${p.date || ''}|${Number(p.amount) || 0}|${p.method || ''}|${p.installmentNumber ?? ''}`;

export function SeccionVenta({ auto, userData, abrirVenta, onAbrirVentaAtendido }: {
  auto: Vehicle;
  userData: any;
  /** Viene del botón «Vender» de la página o del inventario. */
  abrirVenta: boolean;
  onAbrirVentaAtendido: () => void;
}) {
  const navigate = useNavigate();
  const [paso, setPaso] = useState<'' | 'trato' | 'detalles'>('');
  const [trato, setTrato] = useState<{ id: string; etiqueta: string; datos: any; cliente: any } | null>(null);
  const [tratoVenta, setTratoVenta] = useState<any>(null);
  const [pagando, setPagando] = useState(false);
  const [trabajando, setTrabajando] = useState(false);
  const titulo = `${auto.year || ''} ${auto.make || ''} ${auto.model || ''}`.trim();
  const pendiente = (auto as any).pendingValidation;
  const vendido = auto.status === 'sold';
  const soldDealId = (auto as any).soldDealId as string | undefined;

  useEffect(() => {
    if (abrirVenta && !vendido && !pendiente) setPaso('trato');
    if (abrirVenta) onAbrirVentaAtendido();
  }, [abrirVenta]);

  // El trato de la venta, en vivo: ahí vive el dinero.
  useEffect(() => {
    if (!soldDealId) { setTratoVenta(null); return; }
    return onSnapshot(doc(db, 'deals', soldDealId), (s) => setTratoVenta(s.exists() ? { ...s.data(), id: s.id } : null), () => setTratoVenta(null));
  }, [soldDealId]);

  const venta = useMemo(() => {
    const delTrato = tratoVenta?.saleDetails;
    const delAuto = auto.saleDetails;
    const base: any = delTrato || delAuto;
    if (!base) return null;
    const fusion = new Map<string, any[]>();
    [delTrato?.payments, delAuto?.payments].forEach((lista: any[] | undefined) => {
      const grupos = new Map<string, any[]>();
      (lista || []).forEach((p) => { if (p) grupos.set(claveDePago(p), [...(grupos.get(claveDePago(p)) || []), p]); });
      grupos.forEach((ps, k) => { if (ps.length > (fusion.get(k)?.length || 0)) fusion.set(k, ps); });
    });
    const pagos = Array.from(fusion.values()).flat().sort((a: any, b: any) => String(a.date || '').localeCompare(String(b.date || '')));
    return { ...base, price: base.price || auto.price, payments: pagos };
  }, [tratoVenta, auto]);

  const pagado = (venta?.payments || []).reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
  const saldo = Math.max(0, (Number(venta?.price) || 0) - pagado);

  // --- Vender
  const elegirTrato = async (id: string, etiqueta: string) => {
    try {
      const d = await getDoc(doc(db, 'deals', id));
      const datos: any = d.exists() ? d.data() : {};
      const c = datos.clientId ? await getDoc(doc(db, 'clients', datos.clientId)).catch(() => null) : null;
      setTrato({ id, etiqueta, datos, cliente: c && c.exists() ? { ...c.data(), id: c.id } : null });
      setPaso('detalles');
    } catch (e: any) {
      alert(`No se pudo leer el trato. ${e?.message || ''}`);
    }
  };

  const confirmarVenta = async (saleDetails: any) => {
    if (!trato) return;
    setTrabajando(true);
    try {
      const conflicto = await ventaYaRegistrada(auto.id, auto.agencyId, trato.id);
      if (conflicto) { alert(avisoDeVentaDuplicada(conflicto)); return; }

      const precio = Number(saleDetails?.price) || Number(auto.price) || 0;
      const detalles = sanitizeFirestoreData({ ...saleDetails, price: precio });
      const hoy = hoyLocal();
      const clientId = trato.datos.clientId || null;
      const clientName = trato.cliente?.name || trato.datos.title || '';

      // El trato registra la venta y el dinero.
      await updateDoc(doc(db, 'deals', trato.id), sanitizeFirestoreData({
        status: 'won',
        soldAt: hoy,
        saleDetails: detalles,
        value: precio,
        vehicleId: auto.id,
        vehicle: titulo,
        updatedAt: new Date().toISOString(),
      }));
      // El contacto, la referencia.
      if (clientId) {
        await setDoc(doc(db, 'clients', clientId), { status: 'won', soldAt: hoy, ventaDealId: trato.id, vehicleId: auto.id, vehicle: titulo, updatedAt: new Date().toISOString() }, { merge: true });
      }
      // El auto, su estado (o la solicitud, si hace falta aprobación).
      if (puedeVenderSinAprobacion(userData?.role)) {
        await updateDoc(doc(db, 'vehicles', auto.id), vehiculoVendido({ clientId, clientName, dealId: trato.id, precio, saleDetails: detalles }));
      } else {
        await updateDoc(doc(db, 'vehicles', auto.id), {
          pendingValidation: {
            type: 'sold',
            requestedBy: userData?.id,
            requestedByName: userData?.name || userData?.email,
            clientId,
            dealId: trato.id,
            clientName,
            originalPrice: Number(auto.price) || 0,
            proposedPrice: precio,
            hasPriceChange: Number(auto.price) > 0 && Number(auto.price) !== precio,
            saleDetails: detalles,
            vehicle: titulo,
            requestedAt: new Date().toISOString(),
          },
        });
      }
      // Pagos ya registrados y tareas de cobro según el plan (en el servidor).
      await ventasApi.reflejar(trato.id);
      setPaso('');
      setTrato(null);
      if (!puedeVenderSinAprobacion(userData?.role)) alert('Listo: la venta quedó pendiente de aprobación de un administrador.');
    } catch (e: any) {
      alert(`No se pudo registrar la venta. ${e?.message || ''}`);
    } finally {
      setTrabajando(false);
    }
  };

  // --- Pagos (mismo destino que la ficha del auto: auto, trato y, si es su venta vigente, el contacto)
  const escribirPagos = async (nuevos: any[]) => {
    const detalles = sanitizeFirestoreData({ ...(venta || { price: auto.price, method: 'contado' }), payments: nuevos });
    const cambio = { saleDetails: detalles, updatedAt: new Date().toISOString() };
    const errores: string[] = [];
    try { await setDoc(doc(db, 'vehicles', auto.id), cambio, { merge: true }); } catch { errores.push('auto'); }
    if (soldDealId) { try { await updateDoc(doc(db, 'deals', soldDealId), cambio); } catch { errores.push('trato'); } }
    const clientId = (auto as any).soldToClientId || (auto as any).buyerId;
    if (clientId) {
      try {
        const c = await getDoc(doc(db, 'clients', clientId));
        const vigente = c.data()?.ventaDealId;
        if (c.exists() && (!soldDealId || !vigente || vigente === soldDealId)) await updateDoc(doc(db, 'clients', clientId), cambio);
      } catch { errores.push('contacto'); }
    }
    if (errores.length) alert(`El pago no se guardó completo (${errores.join(', ')}). Revisa tu conexión e inténtalo de nuevo.`);
  };

  const registrarPago = async (p: any) => {
    setPagando(false);
    const nuevo: any = {
      amount: Number(p.amount) || 0,
      date: p.date || hoyLocal(),
      method: p.method || 'efectivo',
      notes: p.notes || '',
      id: Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString(),
    };
    if (p.installmentNumber !== undefined && p.installmentNumber !== null) nuevo.installmentNumber = p.installmentNumber;
    await escribirPagos([...(venta?.payments || []), nuevo]);
    if (p.taskIdToComplete) await updateDoc(doc(db, 'tasks', p.taskIdToComplete), { completed: true, completedAt: new Date().toISOString() }).catch(() => {});
  };

  const quitarPago = async (p: any) => {
    if (!window.confirm(`¿Quitar el pago de ${pesos(p.amount)} del ${p.date}?`)) return;
    let quitado = false;
    await escribirPagos((venta?.payments || []).filter((x: any) => {
      if (quitado) return true;
      if ((p.id && x.id === p.id) || claveDePago(x) === claveDePago(p)) { quitado = true; return false; }
      return true;
    }));
  };

  const puedePagos = userData?.role !== 'seller';
  const metodo = (m?: string) => m === 'credito' ? 'Crédito propio' : m === 'credito_bancario' ? 'Crédito bancario' : 'Contado';

  return (
    <section className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex flex-col gap-3">
      <h2 className="text-sm font-extrabold">Venta</h2>

      {vendido ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="flex flex-col"><span className="text-[11px] text-slate-600 dark:text-slate-400">Comprador</span><span className="text-sm font-bold">{(auto as any).buyerName || '—'}</span></div>
            <div className="flex flex-col"><span className="text-[11px] text-slate-600 dark:text-slate-400">Fecha</span><span className="text-sm font-bold">{auto.soldAt || '—'}</span></div>
            <div className="flex flex-col"><span className="text-[11px] text-slate-600 dark:text-slate-400">Precio</span><span className="text-sm font-bold">{pesos(venta?.price || auto.price)}</span></div>
            <div className="flex flex-col"><span className="text-[11px] text-slate-600 dark:text-slate-400">Forma de pago</span><span className="text-sm font-bold">{metodo(venta?.method)}</span></div>
            <div className="flex flex-col"><span className="text-[11px] text-slate-600 dark:text-slate-400">Trato</span><span className="text-sm font-bold truncate">{tratoVenta?.title || (soldDealId ? '…' : 'Sin trato')}</span></div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-sm"><span className="font-bold">{pesos(pagado)} pagado de {pesos(venta?.price || 0)}</span><span className={clsx('font-extrabold', saldo ? 'text-amber-700' : 'text-emerald-700')}>{saldo ? `Saldo ${pesos(saldo)}` : 'Liquidado'}</span></div>
            <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden"><div className="h-full bg-emerald-600" style={{ width: `${venta?.price ? Math.min(100, (pagado / venta.price) * 100) : 0}%` }} /></div>
          </div>

          {soldDealId ? (
            <button type="button" onClick={() => navigate(`/venta/${soldDealId}`)} className="self-start min-h-[40px] px-4 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold">
              Ver venta y pagos{(venta?.payments || []).length ? ` (${(venta?.payments || []).length})` : ''}
            </button>
          ) : (
            <p className="text-xs text-slate-600 dark:text-slate-400">Esta venta no está ligada a un trato: los pagos se llevan desde la ficha del cliente.</p>
          )}
        </>
      ) : pendiente ? (
        <p className="text-sm text-amber-800 dark:text-amber-300">
          Hay una solicitud de {pendiente.type === 'sold' ? 'venta' : 'apartado'}{pendiente.clientName ? ` para ${pendiente.clientName}` : ''} esperando que un administrador la apruebe en Inventario.
        </p>
      ) : (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-slate-600 dark:text-slate-400">Este auto sigue disponible. Al venderlo eliges el trato y la forma de pago.</p>
          <button type="button" disabled={trabajando} onClick={() => setPaso('trato')} className="min-h-[38px] px-4 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-sm font-bold">Vender</button>
        </div>
      )}

      {paso === 'trato' && (
        <SeleccionarTratoVenta
          vehicleId={auto.id}
          vehiculoNombre={titulo}
          agencyId={auto.agencyId}
          sellerId={userData?.id}
          onElegido={elegirTrato}
          onCerrar={() => setPaso('')}
        />
      )}
      {paso === 'detalles' && trato && (
        <DealWonModal
          client={{ ...(trato.cliente || {}), id: trato.datos.clientId, dealValue: trato.datos.value || auto.price, vehicleId: auto.id } as Client}
          vehicle={auto}
          inicial={trato.datos.saleDetails || null}
          onConfirm={confirmarVenta}
          onCancel={() => { setPaso(''); setTrato(null); }}
        />
      )}
    </section>
  );
}
