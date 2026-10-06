import React, { useMemo, useState } from 'react';
import clsx from 'clsx';
import { collection, doc, setDoc, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { FileText, MessageCircle, Plus, Settings, Trash2, X } from 'lucide-react';
import { db, storage } from '../lib/firebase';
import { calcularCotizacion, folioCotizacion, LEYENDA_COTIZACION, type DatosCotizacion, type FormaCotizacion } from '../lib/cotizacion';
import { generarCotizacionPdf } from '../lib/cotizacionPdf';
import { descargarOCompartir, planDeCredito } from '../lib/fichaPdf';
import { abrirWhatsApp, SelectorWhatsApp } from '../lib/whatsappApp';
import type { Vehicle } from '../types';

/**
 * Cotizar un auto a un cliente: contado o crédito, con toma a cuenta y
 * hasta cuatro plazos para comparar. Sale en PDF (para mandarlo) y, si el
 * cliente está en el CRM, queda como nota en su historial con su folio.
 */

const pesos = (n: number) => `$${Math.round(Number(n) || 0).toLocaleString('es-MX')}`;
const num = (v: string) => Number(String(v).replace(/[^\d.]/g, '')) || 0;
const PLAZOS = [12, 18, 24, 36, 48, 60, 72];

interface ClienteCot { id?: string; name?: string; phone?: string }
/** Un banco con convenio: sus botones llenan la tasa y la comisión de la cotización. */
interface BancoCot { id: string; nombre: string; tasa: number; comision: number }

export function Cotizador({ auto: autoInicial, autos, cliente: clienteInicial, clientes, agencia, asesor, userData, dealId, onCerrar }: {
  auto?: Vehicle | null;
  /** Para elegir el auto cuando se cotiza desde el cliente. */
  autos?: Vehicle[];
  cliente?: ClienteCot | null;
  /** Para elegir al cliente cuando se cotiza desde el auto. */
  clientes?: ClienteCot[];
  agencia: any;
  asesor: { name?: string; phone?: string; email?: string };
  userData: any;
  /** El trato del cliente, si se cotiza desde su ficha: ahí queda el PDF. */
  dealId?: string;
  onCerrar: () => void;
}) {
  const [autoId, setAutoId] = useState(autoInicial?.id || autos?.[0]?.id || '');
  const auto = autoInicial || autos?.find((a) => a.id === autoId) || null;
  const [clienteId, setClienteId] = useState(clienteInicial?.id || '');
  const [nombreLibre, setNombreLibre] = useState(clienteInicial?.name || '');
  const cliente: ClienteCot = clienteInicial || clientes?.find((c) => c.id === clienteId) || { name: nombreLibre };

  const plan = auto ? planDeCredito(Number(auto.year), Number(auto.price)) : null;
  const [forma, setForma] = useState<FormaCotizacion>('credito');
  const [precio, setPrecio] = useState(String(auto?.price || ''));
  const [descuento, setDescuento] = useState('');
  const [conToma, setConToma] = useState(false);
  const [tomaDesc, setTomaDesc] = useState('');
  const [tomaValor, setTomaValor] = useState('');
  const [enganche, setEnganche] = useState(String(Math.round((auto?.price || 0) * 0.2) || ''));
  const [plazos, setPlazos] = useState<number[]>([24, 36, 48]);
  const [tasaPropio, setTasaPropio] = useState('1.5');
  const [tasaBanco, setTasaBanco] = useState(plan ? plan.tasa.replace('%', '') : '15.99');
  const [comisionPct, setComisionPct] = useState('3');
  const [comisionFinanciada, setComisionFinanciada] = useState(false);
  const [vigencia, setVigencia] = useState(7);
  const [notas, setNotas] = useState('');
  const [trabajando, setTrabajando] = useState('');

  // Bancos con convenio de la agencia (los configura un administrador o gerente).
  const agenciaId: string = agencia?.id || userData?.agencyId || '';
  const puedeConfigurarBancos = ['admin', 'manager', 'master'].includes(String(userData?.role));
  const [bancos, setBancos] = useState<BancoCot[]>(Array.isArray(agencia?.bancosCotizacion) ? agencia.bancosCotizacion : []);
  const [bancoId, setBancoId] = useState('');
  const [configurando, setConfigurando] = useState(false);
  const elegirBanco = (b: BancoCot) => {
    setBancoId(b.id); setTasaBanco(String(b.tasa)); setComisionPct(String(b.comision));
  };
  const guardarBancos = async (lista: BancoCot[]) => {
    const limpia = lista.filter((b) => b.nombre.trim()).map((b) => ({ id: b.id, nombre: b.nombre.trim().slice(0, 30), tasa: Number(b.tasa) || 0, comision: Number(b.comision) || 0 }));
    try { await updateDoc(doc(db, 'agencies', agenciaId), { bancosCotizacion: limpia }); } catch (e: any) { alert(`No se pudieron guardar los bancos. ${e?.message || ''}`); }
  };
  const bancoElegido = forma === 'credito_bancario' ? bancos.find((b) => b.id === bancoId) : undefined;

  // Al cambiar de auto, su precio y su enganche sugerido.
  const cambiarAuto = (id: string) => {
    setAutoId(id);
    const a = autos?.find((x) => x.id === id);
    if (a) { setPrecio(String(a.price || '')); setEnganche(String(Math.round((a.price || 0) * 0.2) || '')); }
  };

  const datos: DatosCotizacion = {
    forma,
    precioLista: num(precio),
    descuento: num(descuento),
    tomaACuenta: conToma ? num(tomaValor) : 0,
    tomaDescripcion: conToma ? tomaDesc.trim() : '',
    enganche: num(enganche),
    plazos: plazos.slice(0, 4),
    tasa: forma === 'credito' ? num(tasaPropio) : num(tasaBanco),
    comisionPct: num(comisionPct),
    comisionFinanciada: forma === 'credito' && comisionFinanciada,
    ...(bancoElegido ? { banco: bancoElegido.nombre } : {}),
    vigenciaDias: vigencia,
    notas,
  };
  const r = useMemo(() => calcularCotizacion(datos), [JSON.stringify(datos)]);

  const ponerPctEnganche = (pct: number) => {
    const precioFinal = Math.max(0, num(precio) - num(descuento));
    const toma = conToma ? num(tomaValor) : 0;
    setEnganche(String(Math.max(0, Math.round(precioFinal * pct / 100 - toma))));
  };

  const tocarPlazo = (m: number) => setPlazos((p) => p.includes(m) ? p.filter((x) => x !== m) : p.length >= 4 ? p : [...p, m].sort((a, b) => a - b));

  const resumenTexto = (folio: string) => {
    const t = auto ? `${auto.year} ${auto.make} ${auto.model}` : '';
    const lineas = [`Cotización ${folio}`, t, `Precio: ${pesos(r.precio)}${num(descuento) ? ` (con ${pesos(num(descuento))} de descuento)` : ''}`];
    if (r.toma) lineas.push(`A cuenta: ${tomaDesc || 'su auto'} ${pesos(r.toma)}`);
    if (forma === 'contado') lineas.push(`De contado: ${pesos(r.saldoContado)}`);
    else {
      lineas.push(`Enganche: ${pesos(r.engancheTotal)}`);
      if (r.comision) lineas.push(`Comisión por apertura (${datos.comisionPct}%): ${pesos(r.comision)} ${r.comisionFinanciada ? '(incluida en el financiamiento)' : '(de contado)'}`);
      lineas.push(`Pago inicial: ${pesos(r.pagoInicial)} · A financiar: ${pesos(r.financiar)}`);
      r.opciones.forEach((o) => lineas.push(`${o.meses} meses: ${pesos(o.mensualidad)} al mes`));
      lineas.push(forma === 'credito' ? `Interés ${datos.tasa}% mensual` : `${datos.banco ? `${datos.banco} · ` : ''}Tasa anual de referencia ${datos.tasa}% (estimado)`);
    }
    lineas.push(`Vigente ${vigencia} días.`);
    if (forma !== 'contado') lineas.push(LEYENDA_COTIZACION);
    if (notas.trim()) lineas.push(`Notas: ${notas.trim()}`);
    return lineas.filter(Boolean).join('\n');
  };

  /** Deja la cotización en el historial del cliente, si está en el CRM. */
  const guardarEnHistorial = async (folio: string) => {
    if (!cliente.id || !auto) return;
    const n: Record<string, any> = {
      agencyId: userData?.agencyId || auto.agencyId,
      sellerId: userData?.id || '',
      clientId: cliente.id,
      content: resumenTexto(folio),
      type: 'cotizacion',
      createdAt: new Date().toISOString(),
      createdByName: userData?.name || '',
      cotizacion: { folio, vehicleId: auto.id, ...datos, precioFinal: r.precio, engancheTotal: r.engancheTotal, comision: Math.round(r.comision), pagoInicial: Math.round(r.pagoInicial), financiar: r.financiar, opciones: r.opciones.map((o) => ({ meses: o.meses, mensualidad: Math.round(o.mensualidad) })) },
    };
    await setDoc(doc(collection(db, 'notes')), JSON.parse(JSON.stringify(n))).catch((e) => console.error('Cotización en historial:', e));
  };

  /**
   * El PDF queda en los archivos del cliente y de su trato (el mismo lugar
   * donde la ficha guarda lo que se sube a mano), para volver a abrirlo o
   * mandarlo sin rehacerlo. Si falla, la cotización sale igual.
   */
  const guardarPdfEnTrato = async (blob: Blob, folio: string) => {
    if (!cliente.id || !userData?.id) return;
    try {
      const nombre = `Cotización ${folio} ${auto?.make || ''} ${auto?.model || ''}.pdf`.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();
      const destino = ref(storage, `users/${userData.id}/clients/${cliente.id}/${nombre}`);
      await uploadBytes(destino, blob, { contentType: 'application/pdf' });
      const url = await getDownloadURL(destino);
      const f: Record<string, any> = {
        agencyId: userData?.agencyId || auto?.agencyId || '', clientId: cliente.id, userId: userData.id,
        filename: nombre, url, uploadedAt: new Date().toISOString(), tipo: 'cotizacion', folio,
        ...(dealId ? { dealId } : {}),
      };
      await setDoc(doc(collection(db, 'files')), f);
    } catch (e) { console.error('Cotización en el trato:', e); }
  };

  const hacerPdf = async () => {
    if (!auto) return;
    setTrabajando('Preparando…');
    const folio = folioCotizacion();
    try {
      const blob = await generarCotizacionPdf({ folio, auto, cliente, datos, agencia, asesor });
      await guardarEnHistorial(folio);
      await guardarPdfEnTrato(blob, folio);
      await descargarOCompartir(blob, `Cotización ${folio} ${auto.make || ''} ${auto.model || ''}.pdf`.replace(/\s+/g, ' ').trim(), `Cotización ${folio}`);
      onCerrar();
    } catch (e: any) {
      alert(`No se pudo hacer la cotización. ${e?.message || ''}`);
    } finally {
      setTrabajando('');
    }
  };

  const telCliente = String(cliente.phone || '').replace(/\D/g, '');
  const mandarWhatsApp = async () => {
    if (!auto || telCliente.length < 10) return;
    const folio = folioCotizacion();
    // Primero se abre WhatsApp (justo tras el clic, si no el navegador lo bloquea) y luego se anota.
    abrirWhatsApp(cliente.phone, `Hola${cliente.name ? ` ${String(cliente.name).split(' ')[0]}` : ''}, te comparto la cotización:\n\n${resumenTexto(folio)}`);
    await guardarEnHistorial(folio);
    onCerrar();
  };

  const campo = 'w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100';
  const etiqueta = 'flex flex-col gap-1 text-xs font-bold text-slate-700 dark:text-slate-300';

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-2 md:p-4" role="dialog" aria-modal="true" aria-labelledby="titulo-cotizacion">
      <div className="absolute inset-0 bg-slate-900/50" onClick={trabajando ? undefined : onCerrar} />
      <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[94vh] flex flex-col">
        <div className="flex items-start justify-between gap-3 p-4 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 id="titulo-cotizacion" className="text-lg font-extrabold text-slate-900 dark:text-white">Cotización</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">Arma la propuesta y mándala en PDF o por WhatsApp. Queda en el historial del cliente.</p>
          </div>
          <button type="button" onClick={onCerrar} disabled={!!trabajando} aria-label="Cerrar" className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          {/* Formulario */}
          <div className="p-4 flex flex-col gap-3.5 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-700">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {clienteInicial ? (
                <div className={etiqueta}>Cliente<span className="text-sm font-bold text-slate-900 dark:text-white py-2">{clienteInicial.name}</span></div>
              ) : (
                <label className={etiqueta}>Cliente
                  <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} className={campo}>
                    <option value="">Otro (escribir nombre)…</option>
                    {(clientes || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  {!clienteId && <input value={nombreLibre} onChange={(e) => setNombreLibre(e.target.value)} placeholder="Nombre del cliente" className={clsx(campo, 'mt-1.5')} />}
                </label>
              )}
              {autoInicial ? (
                <div className={etiqueta}>Auto<span className="text-sm font-bold text-slate-900 dark:text-white py-2">{autoInicial.year} {autoInicial.make} {autoInicial.model}</span></div>
              ) : (
                <label className={etiqueta}>Auto
                  <select value={autoId} onChange={(e) => cambiarAuto(e.target.value)} className={campo}>
                    {(autos || []).map((a) => <option key={a.id} value={a.id}>{a.year} {a.make} {a.model} · {pesos(a.price)}</option>)}
                  </select>
                </label>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Forma de pago</span>
              <div className="grid grid-cols-3 gap-1.5" role="radiogroup">
                {([['contado', 'Contado'], ['credito', 'Crédito propio'], ['credito_bancario', 'Crédito bancario']] as const).map(([id, t]) => (
                  <button key={id} type="button" role="radio" aria-checked={forma === id} onClick={() => setForma(id)}
                    className={clsx('min-h-[40px] rounded-lg text-sm font-bold border', forma === id ? 'bg-blue-700 border-blue-700 text-white' : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300')}>{t}</button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className={etiqueta}>Precio<input value={precio} onChange={(e) => setPrecio(e.target.value)} inputMode="decimal" className={campo} /></label>
              <label className={etiqueta}>Descuento (opcional)<input value={descuento} onChange={(e) => setDescuento(e.target.value)} inputMode="decimal" placeholder="$0" className={campo} /></label>
            </div>

            <label className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200 cursor-pointer">
              <input type="checkbox" checked={conToma} onChange={(e) => setConToma(e.target.checked)} className="w-4 h-4 accent-blue-700" />
              Deja su auto a cuenta
            </label>
            {conToma && (
              <div className="grid grid-cols-2 gap-3">
                <label className={etiqueta}>¿Qué auto?<input value={tomaDesc} onChange={(e) => setTomaDesc(e.target.value)} placeholder="Mini Cooper 2017" className={campo} /></label>
                <label className={etiqueta}>Se le toma en<input value={tomaValor} onChange={(e) => setTomaValor(e.target.value)} inputMode="decimal" placeholder="$0" className={campo} /></label>
              </div>
            )}

            {forma !== 'contado' && (
              <>
                <div className="grid grid-cols-2 gap-3 items-end">
                  <label className={etiqueta}>Enganche en efectivo{conToma ? ' (además de su auto)' : ''}<input value={enganche} onChange={(e) => setEnganche(e.target.value)} inputMode="decimal" className={campo} /></label>
                  <div className="flex gap-1">
                    {[20, 30, 40, 50].map((p) => (
                      <button key={p} type="button" onClick={() => ponerPctEnganche(p)} className="flex-1 min-h-[38px] rounded-lg border border-slate-300 dark:border-slate-600 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">{p}%</button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Plazos a comparar (hasta 4)</span>
                  <div className="flex flex-wrap gap-1.5">
                    {PLAZOS.map((m) => (
                      <button key={m} type="button" aria-pressed={plazos.includes(m)} onClick={() => tocarPlazo(m)}
                        className={clsx('min-h-[36px] px-3 rounded-full text-sm font-bold border', plazos.includes(m) ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900' : 'border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300')}>{m} meses</button>
                    ))}
                  </div>
                </div>
                {forma === 'credito_bancario' && (
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Banco con convenio</span>
                      {puedeConfigurarBancos && <button type="button" onClick={() => setConfigurando((x) => !x)} className="text-xs font-bold text-blue-700 hover:underline flex items-center gap-1"><Settings className="w-3 h-3" /> {configurando ? 'Listo' : 'Configurar bancos'}</button>}
                    </div>
                    {bancos.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {bancos.map((b) => (
                          <button key={b.id} type="button" aria-pressed={bancoId === b.id} onClick={() => elegirBanco(b)}
                            className={clsx('min-h-[38px] px-3 rounded-lg text-sm font-bold border', bancoId === b.id ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700')}>
                            {b.nombre}<span className="ml-1.5 text-[11px] font-semibold opacity-80">{b.tasa}% · {b.comision}%</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-600 dark:text-slate-400">{puedeConfigurarBancos ? 'Aún no hay bancos. Con «Configurar bancos» agrega los de tu convenio y sus botones llenan la tasa y la comisión solos.' : 'Tu administrador puede agregar aquí los bancos con convenio.'}</p>
                    )}
                    {configurando && (
                      <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-2.5 flex flex-col gap-2 bg-slate-50 dark:bg-slate-900/40">
                        <div className="grid grid-cols-[minmax(0,1fr)_70px_70px_32px] gap-1.5 text-[10px] font-bold uppercase text-slate-500"><span>Banco</span><span>Tasa anual %</span><span>Comisión %</span><span /></div>
                        {bancos.map((b) => (
                          <div key={b.id} className="grid grid-cols-[minmax(0,1fr)_70px_70px_32px] gap-1.5">
                            <input value={b.nombre} onChange={(e) => setBancos((l) => l.map((x) => x.id === b.id ? { ...x, nombre: e.target.value } : x))} onBlur={() => guardarBancos(bancos)} maxLength={30} className={campo} />
                            <input value={b.tasa} inputMode="decimal" onChange={(e) => setBancos((l) => l.map((x) => x.id === b.id ? { ...x, tasa: num(e.target.value) } : x))} onBlur={() => { guardarBancos(bancos); if (bancoId === b.id) elegirBanco(b); }} className={campo} />
                            <input value={b.comision} inputMode="decimal" onChange={(e) => setBancos((l) => l.map((x) => x.id === b.id ? { ...x, comision: num(e.target.value) } : x))} onBlur={() => { guardarBancos(bancos); if (bancoId === b.id) elegirBanco(b); }} className={campo} />
                            <button type="button" aria-label={`Quitar ${b.nombre}`} onClick={() => { const l = bancos.filter((x) => x.id !== b.id); setBancos(l); if (bancoId === b.id) setBancoId(''); guardarBancos(l); }} className="rounded-lg text-slate-500 hover:text-red-700 flex items-center justify-center"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        ))}
                        {bancos.length < 8 && <button type="button" onClick={() => setBancos((l) => [...l, { id: Math.random().toString(36).slice(2, 10), nombre: '', tasa: 0, comision: 3 }])} className="self-start text-xs font-bold text-blue-700 hover:underline flex items-center gap-1"><Plus className="w-3 h-3" /> Agregar banco</button>}
                        <p className="text-[11px] text-slate-500">Se guardan para toda la agencia. Pon la tasa anual de referencia y la comisión por apertura que maneja cada banco.</p>
                      </div>
                    )}
                  </div>
                )}
                <label className={etiqueta}>
                  {forma === 'credito' ? 'Interés mensual (%) — el mismo que usas al cerrar la venta' : 'Tasa anual de referencia (%)'}
                  <input value={forma === 'credito' ? tasaPropio : tasaBanco} onChange={(e) => { if (forma === 'credito') setTasaPropio(e.target.value); else { setTasaBanco(e.target.value); setBancoId(''); } }} inputMode="decimal" className={clsx(campo, 'sm:max-w-[200px]')} />
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-[160px_minmax(0,1fr)] gap-3 items-end">
                  <label className={etiqueta}>Comisión por apertura (%)
                    <input value={comisionPct} onChange={(e) => { setComisionPct(e.target.value); setBancoId(''); }} inputMode="decimal" className={campo} />
                  </label>
                  {forma === 'credito' ? (
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">La comisión se paga</span>
                      <div className="grid grid-cols-2 gap-1.5" role="radiogroup">
                        {([[false, 'De contado, con el enganche'], [true, 'Dentro del financiamiento']] as const).map(([v, t]) => (
                          <button key={String(v)} type="button" role="radio" aria-checked={comisionFinanciada === v} onClick={() => setComisionFinanciada(v)}
                            className={clsx('min-h-[38px] px-2 rounded-lg text-xs font-bold border', comisionFinanciada === v ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900' : 'border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300')}>{t}</button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-600 dark:text-slate-400 pb-2">En crédito bancario la comisión se paga siempre de contado, junto con el enganche.</p>
                  )}
                </div>
              </>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-[150px_minmax(0,1fr)] gap-3">
              <label className={etiqueta}>Vigencia
                <select value={vigencia} onChange={(e) => setVigencia(Number(e.target.value))} className={campo}>
                  {[3, 7, 15, 30].map((d) => <option key={d} value={d}>{d} días</option>)}
                </select>
              </label>
              <label className={etiqueta}>Notas para el cliente (opcional)<textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} placeholder="Incluye verificación y cambio de propietario…" className={campo} /></label>
            </div>
          </div>

          {/* Vista previa */}
          <div className="p-4 bg-slate-50 dark:bg-slate-900/40 flex flex-col gap-3">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Así queda</h3>
            {auto && (
              <div className="flex gap-3 items-center">
                {(auto.photoUrls?.[0] || auto.photoUrl) && <img src={auto.photoUrls?.[0] || auto.photoUrl} alt="" className="w-24 h-18 object-cover rounded-lg" />}
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-900 dark:text-white truncate">{auto.year} {auto.make} {auto.model}</div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">Para {cliente.name || '—'}</div>
                </div>
              </div>
            )}
            <div className="flex flex-col text-sm">
              {num(descuento) > 0 && <div className="flex justify-between py-1"><span className="text-slate-600 dark:text-slate-400">Precio de lista</span><span>{pesos(num(precio))}</span></div>}
              <div className="flex justify-between py-1 font-bold"><span>Precio{num(descuento) > 0 ? ' especial' : ''}</span><span>{pesos(r.precio)}</span></div>
              {r.toma > 0 && <div className="flex justify-between py-1 text-emerald-700 dark:text-emerald-400"><span>A cuenta ({tomaDesc || 'su auto'})</span><span>− {pesos(r.toma)}</span></div>}
              {forma === 'contado' ? (
                <div className="flex justify-between items-baseline pt-2 mt-1 border-t border-slate-200 dark:border-slate-700"><span className="font-bold">{r.toma ? 'Diferencia' : 'Total de contado'}</span><span className="text-2xl font-extrabold">{pesos(r.saldoContado)}</span></div>
              ) : (
                <>
                  <div className="flex justify-between py-1"><span className="text-slate-600 dark:text-slate-400">Enganche total{r.toma ? ' (con su auto)' : ''}</span><span className="font-bold">{pesos(r.engancheTotal)}</span></div>
                  {r.comision > 0 && (
                    <div className="flex justify-between py-1"><span className="text-slate-600 dark:text-slate-400">Comisión por apertura ({datos.comisionPct}%) · {r.comisionFinanciada ? 'financiada' : 'de contado'}</span><span className="font-bold">{pesos(r.comision)}</span></div>
                  )}
                  <div className="flex justify-between py-1"><span className="text-slate-600 dark:text-slate-400">Pago inicial en efectivo</span><span className="font-bold">{pesos(r.pagoInicial)}</span></div>
                  <div className="flex justify-between py-1"><span className="text-slate-600 dark:text-slate-400">A financiar</span><span className="font-bold">{pesos(r.financiar)}</span></div>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {r.opciones.map((o) => (
                      <div key={o.meses} className="rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2.5 text-center">
                        <div className="text-[11px] font-extrabold text-slate-600 dark:text-slate-400 uppercase">{o.meses} meses</div>
                        <div className="text-lg font-extrabold text-slate-900 dark:text-white">{pesos(o.mensualidad)}</div>
                        <div className="text-[11px] text-slate-600 dark:text-slate-400">al mes · total {pesos(o.total)}</div>
                      </div>
                    ))}
                    {!r.opciones.length && <p className="col-span-2 text-xs text-amber-700">Elige al menos un plazo.</p>}
                  </div>
                </>
              )}
            </div>
            {forma !== 'contado' && <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 rounded-lg px-2.5 py-2">{LEYENDA_COTIZACION}</p>}
            {!cliente.id && <p className="text-xs text-slate-600 dark:text-slate-400">Este cliente no está en el CRM: la cotización no se guardará en ningún historial.</p>}
          </div>
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-end gap-2">
          {telCliente.length >= 10 && <SelectorWhatsApp className="mr-auto" />}
          <button type="button" onClick={onCerrar} disabled={!!trabajando} className="min-h-[40px] px-4 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700">Cancelar</button>
          {telCliente.length >= 10 && (
            <button type="button" onClick={mandarWhatsApp} disabled={!!trabajando || !auto || (forma !== 'contado' && !r.opciones.length)} className="min-h-[40px] px-4 rounded-lg bg-green-700 hover:bg-green-800 disabled:opacity-60 text-white text-sm font-bold flex items-center gap-1.5">
              <MessageCircle className="w-4 h-4" /> Mandar resumen por WhatsApp
            </button>
          )}
          <button type="button" onClick={hacerPdf} disabled={!!trabajando || !auto || !r.precio || (forma !== 'contado' && !r.opciones.length)} className="min-h-[40px] px-4 rounded-lg bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-sm font-bold flex items-center gap-1.5">
            <FileText className="w-4 h-4" /> {trabajando || 'Hacer cotización en PDF'}
          </button>
        </div>
      </div>
    </div>
  );
}
