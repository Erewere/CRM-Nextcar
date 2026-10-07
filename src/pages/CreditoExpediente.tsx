import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import clsx from 'clsx';
import { doc, getDoc } from 'firebase/firestore';
import { ChevronLeft, Download, Eye, FileText, Link2, Loader2, Send, Trash2, Upload } from 'lucide-react';
import JSZip from 'jszip';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { avanceDatos, DOCUMENTOS_CREDITO, faltantes, seccionesVisibles } from '../lib/creditoCampos';
import { creditosApi, descargarOCompartirArchivos, solicitudLlenada } from '../lib/creditosApi';
import { abrirWhatsApp, SelectorWhatsApp } from '../lib/whatsappApp';
import { FormularioSolicitud } from '../components/credito/FormularioSolicitud';
import { ESTILO_BANCO, ETAPAS_CREDITO, TEXTO_ESTADO_BANCO } from './Creditos';

const enTelefono = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));
const fecha = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) : '');

export function CreditoExpediente() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { userData } = useAuth();
  const [s, setS] = useState<any>(null);
  const [error, setError] = useState('');
  const [datos, setDatos] = useState<any>({});
  const [pestana, setPestana] = useState('personales');
  const [guardado, setGuardado] = useState<'listo' | 'guardando' | 'error'>('listo');
  const [formatos, setFormatos] = useState<any[]>([]);
  const [agencia, setAgencia] = useState<any>(null);
  const [trabajando, setTrabajando] = useState('');
  const [nota, setNota] = useState('');
  const temporizador = useRef<any>(null);
  const cargado = useRef(false);

  const recargar = () => creditosApi.ver(id).then((x) => { setS(x); setDatos(x.datos || {}); }).catch((e) => setError(e.message));
  useEffect(() => {
    recargar();
    creditosApi.formatos().then(setFormatos).catch(() => {});
    if (userData?.agencyId) getDoc(doc(db, 'agencies', userData.agencyId)).then((d) => setAgencia(d.data() || null)).catch(() => {});
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Los datos se guardan solos, como en la liga del cliente.
  useEffect(() => {
    if (!s) return;
    if (!cargado.current) { cargado.current = true; return; }
    setGuardado('guardando');
    clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => creditosApi.cambiar(id, { datos }).then(() => setGuardado('listo')).catch(() => setGuardado('error')), 1000);
    return () => clearTimeout(temporizador.current);
  }, [datos]); // eslint-disable-line react-hooks/exhaustive-deps

  const secciones = useMemo(() => seccionesVisibles(datos), [datos]);
  const falta = faltantes(datos);
  const cambiar = async (cambios: any) => { try { const x = await creditosApi.cambiar(id, cambios); setS(x); } catch (e: any) { alert(e.message); } };

  if (error) return <div className="p-8 text-center"><p className="font-bold text-red-700">{error}</p><button type="button" onClick={() => navigate('/creditos')} className="mt-3 text-blue-700 font-bold">← Créditos</button></div>;
  if (!s) return <div className="py-20 flex justify-center"><Loader2 className="w-7 h-7 animate-spin text-slate-400" /></div>;

  const docs: any[] = s.documentos || [];
  const ejecutivos = agencia?.ejecutivosCredito || {};
  const aprobado = (s.bancos || []).some((b: any) => b.estado === 'aprobado' || b.estado === 'condiciones');

  // --- Liga del cliente: cada vez se genera una nueva (la anterior deja de servir).
  const mandarLiga = async () => {
    if (s.ligaVence && !confirm('Se generará una liga nueva y la anterior dejará de funcionar. ¿Seguir?')) return;
    setTrabajando('liga');
    try {
      const { url, vence } = await creditosApi.liga(id);
      const nombre = String(s.clienteNombre || '').split(' ')[0];
      const texto = `Hola${nombre ? ` ${nombre}` : ''}, para avanzar con tu crédito${s.auto ? ` del ${s.auto}` : ''}, llena tu solicitud y sube tus documentos aquí: ${url}\nLa liga es personal y vence el ${new Date(vence).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}.`;
      try { await navigator.clipboard.writeText(url); } catch { /* sin permiso */ }
      abrirWhatsApp(s.clienteTelefono, texto);
      await recargar();
    } catch (e: any) { alert(e.message); } finally { setTrabajando(''); }
  };

  // --- Documentos
  const subir = async (tipo: string, archivos: FileList | File[] | null, banco?: string) => {
    if (!archivos?.length) return;
    setTrabajando('sub' + tipo + (banco || ''));
    try { for (const a of Array.from(archivos)) await creditosApi.subir(id, a, tipo, a.name, banco); await recargar(); }
    catch (e: any) { alert(e.message); } finally { setTrabajando(''); }
  };
  const ver = async (d: any) => {
    try { const b = await creditosApi.archivo(id, d.id); const u = URL.createObjectURL(b); window.open(u, '_blank', 'noopener'); setTimeout(() => URL.revokeObjectURL(u), 120_000); }
    catch (e: any) { alert(e.message); }
  };
  const quitar = async (d: any) => { if (!confirm(`¿Quitar «${d.nombre}»?`)) return; try { await creditosApi.quitarArchivo(id, d.id); await recargar(); } catch (e: any) { alert(e.message); } };

  // --- Bancos
  const llenada = async (b: any) => {
    const f = formatos.find((x) => x.id === b.formatoId);
    if (!f) throw new Error('No encontramos el formato de este banco.');
    const bytes = await creditosApi.pdfFormato(f.id);
    return solicitudLlenada(bytes, f, datos, { operacion: s.operacion, agencia, auto: s.auto });
  };
  const descargar = async (b: any) => {
    if (falta.length && !confirm(`Faltan ${falta.length} datos obligatorios. ¿Descargar de todos modos?`)) return;
    setTrabajando('pdf' + b.clave);
    try { await descargarOCompartirArchivos([new File([await llenada(b)], `Solicitud ${b.nombre} - ${s.clienteNombre}.pdf`, { type: 'application/pdf' })], `Solicitud ${b.nombre}`); }
    catch (e: any) { alert(e.message); } finally { setTrabajando(''); }
  };

  /** Arma el paquete para el ejecutivo: solicitud firmada + documentos. */
  const enviarAlEjecutivo = async (b: any, via: 'whatsapp' | 'correo') => {
    const ej = ejecutivos[b.clave] || {};
    const firmadas = docs.filter((d) => d.tipo === 'firmada' && d.banco === b.clave);
    const deCliente = docs.filter((d) => ['ine', 'domicilio', 'ingresos', 'constancia', 'otro'].includes(d.tipo));
    if (!firmadas.length && !confirm('Aún no hay solicitud firmada de este banco. ¿Mandar el paquete sin ella?')) return;
    setTrabajando('env' + b.clave);
    try {
      const archivos: File[] = [];
      for (const d of [...firmadas, ...deCliente]) {
        const blob = await creditosApi.archivo(id, d.id);
        const etiqueta = d.tipo === 'firmada' ? `Solicitud firmada ${b.nombre}` : (DOCUMENTOS_CREDITO.find((t) => t.tipo === d.tipo)?.etiqueta || 'Documento');
        const ext = (d.nombre.match(/\.[a-z0-9]+$/i)?.[0]) || (d.mime === 'application/pdf' ? '.pdf' : '.jpg');
        archivos.push(new File([blob], `${etiqueta} - ${s.clienteNombre}${archivos.length ? ` (${archivos.length + 1})` : ''}${ext}`.replace(/[\\/:*?"<>|]+/g, ''), { type: d.mime }));
      }
      const texto = `Hola${ej.nombre ? ` ${ej.nombre.split(' ')[0]}` : ''}, te comparto la solicitud de crédito de ${s.clienteNombre}${s.auto ? ` para el ${s.auto}` : ''}${s.operacion?.precio ? ` ($${Number(s.operacion.precio).toLocaleString('es-MX')}, enganche $${Number(s.operacion.enganche || 0).toLocaleString('es-MX')}, ${s.operacion.plazo || ''} meses)` : ''}. Van la solicitud firmada y sus documentos.`;
      if (enTelefono() && navigator.canShare?.({ files: archivos })) {
        await descargarOCompartirArchivos(archivos, `Solicitud ${b.nombre}`, texto);
      } else {
        const zip = new JSZip();
        archivos.forEach((a) => zip.file(a.name, a));
        const blob = await zip.generateAsync({ type: 'blob' });
        await descargarOCompartirArchivos([new File([blob], `Solicitud ${b.nombre} - ${s.clienteNombre}.zip`, { type: 'application/zip' })], 'Paquete');
        if (via === 'correo' && ej.correo) window.location.href = `mailto:${ej.correo}?subject=${encodeURIComponent(`Solicitud de crédito - ${s.clienteNombre}`)}&body=${encodeURIComponent(texto + '\n\n(Adjunto el archivo ZIP que se descargó.)')}`;
        else abrirWhatsApp(ej.whatsapp || '', texto + ' (te adjunto el ZIP)');
      }
      if (confirm(`¿Ya lo mandaste al ejecutivo de ${b.nombre}? Si sí, queda marcada como «Enviada».`)) {
        await cambiar({ bancos: s.bancos.map((x: any) => (x.clave === b.clave ? { ...x, estado: 'enviada' } : x)) });
      }
    } catch (e: any) { alert(e.message); } finally { setTrabajando(''); }
  };

  const ponerBanco = (b: any, cambios: any) => cambiar({ bancos: s.bancos.map((x: any) => (x.clave === b.clave ? { ...x, ...cambios } : x)) });
  const bancosFaltantes = [...formatos.filter((f) => !s.bancos.some((b: any) => b.clave === f.clave)).map((f) => ({ clave: f.clave, formatoId: f.id, nombre: f.nombre })), ...(s.bancos.some((b: any) => b.clave === 'casa') ? [] : [{ clave: 'casa', nombre: 'Crédito de la casa' }])];
  const indiceEtapa = ETAPAS_CREDITO.findIndex((e) => e.id === s.etapa);

  return (
    <div className="max-w-[1440px] mx-auto px-3 md:px-6 py-4 flex flex-col gap-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => navigate('/creditos')} className="text-sm font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1"><ChevronLeft className="w-4 h-4" /> Créditos</button>
          <span className="ml-auto text-xs text-slate-500">{guardado === 'guardando' ? 'Guardando…' : guardado === 'error' ? 'No se pudo guardar' : 'Guardado'}</span>
        </div>
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex-1 min-w-[240px]">
            <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white">{s.clienteNombre}{s.auto ? ` · ${s.auto}` : ''}</h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {[s.operacion?.precio ? `$${Number(s.operacion.precio).toLocaleString('es-MX')}` : '', s.operacion?.enganche ? `enganche $${Number(s.operacion.enganche).toLocaleString('es-MX')}` : '', s.operacion?.plazo ? `${s.operacion.plazo} meses` : '', s.vendedorNombre ? `vendedor ${s.vendedorNombre}` : ''].filter(Boolean).join(' · ')}
            </p>
          </div>
          {s.clientId && <button type="button" onClick={() => navigate('/persons', { state: { clientId: s.clientId } })} className="h-9 px-3 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-bold">Ver cliente</button>}
          {s.etapa !== 'cancelada' && <button type="button" onClick={() => {
              // Si el cliente ya abrió su liga o llenó algo, cancelar le tira su trabajo y la solicitud deja de verse en el tablero.
              const empezo = !!s.ligaAbiertaEl || !!s.clienteTerminoEl || (s.documentos || []).length > 0;
              const aviso = empezo
                ? `⚠️ ${s.clienteNombre} YA EMPEZÓ su solicitud (${s.clienteTerminoEl ? 'la terminó y la mandó' : (s.documentos || []).length ? 'ya subió documentos' : 'abrió su liga'}).\n\nSi la cancelas, la solicitud desaparece del tablero (solo se ve con «Ver canceladas»).\n\n¿Seguro que quieres cancelarla?`
                : '¿Cancelar esta solicitud? Se puede reabrir después.';
              if (confirm(aviso)) cambiar({ etapa: 'cancelada' });
            }} className="h-9 px-3 rounded-lg border border-red-200 text-red-700 text-sm font-bold">Cancelar</button>}
        </div>
        <div className="flex gap-0.5 overflow-x-auto">
          {ETAPAS_CREDITO.map((e, i) => (
            <button key={e.id} type="button" onClick={() => e.id !== s.etapa && cambiar({ etapa: e.id })}
              className={clsx('flex-1 min-w-[110px] h-9 px-3 text-xs font-bold truncate', s.etapa === e.id ? 'bg-blue-700 text-white' : i < indiceEtapa ? 'bg-blue-400 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300')}
              style={{ clipPath: i === 0 ? 'polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%)' : 'polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%, 10px 50%)' }}>
              {e.titulo}
            </button>
          ))}
        </div>
        {s.etapa === 'cancelada' && <p className="text-sm font-semibold text-red-700">Solicitud cancelada. Toca una etapa para reabrirla.</p>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px] gap-4 items-start">
        <div className="flex flex-col gap-4 min-w-0">
          {/* Liga */}
          <div className={clsx('rounded-2xl border-2 p-4 flex flex-wrap items-center gap-3', s.clienteTerminoEl ? 'border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-900' : 'border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-900')}>
            <div className="flex-1 min-w-[240px]">
              <p className="text-[11px] font-extrabold uppercase text-slate-600 dark:text-slate-300">Liga para el cliente</p>
              <p className="font-bold text-slate-900 dark:text-white">
                {s.clienteTerminoEl ? `Terminó su solicitud el ${fecha(s.clienteTerminoEl)} y autorizó compartirla.`
                  : s.ligaAbiertaEl ? `La abrió el ${fecha(s.ligaAbiertaEl)}; aún no termina.`
                  : s.ligaVence ? 'Liga enviada; aún no la abre.' : 'Mándale la liga para que llene sus datos y suba sus documentos.'}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400">Datos {avanceDatos(datos)}% · {s.ligaVence ? `liga válida hasta el ${fecha(s.ligaVence)}` : 'sin liga'}</p>
            </div>
            <SelectorWhatsApp />
            <button type="button" onClick={mandarLiga} disabled={!!trabajando} className="h-10 px-3 rounded-lg bg-[#1fa855] text-white text-sm font-bold flex items-center gap-1.5">
              {trabajando === 'liga' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />} {s.ligaVence ? 'Mandar liga nueva' : 'Mandar liga por WhatsApp'}
            </button>
          </div>

          {/* Datos */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
            <div className="flex gap-4 px-4 border-b border-slate-200 dark:border-slate-700 overflow-x-auto" role="tablist">
              {secciones.map((sec) => {
                const f = falta.filter((x) => x.seccion === sec.id).length;
                return (
                  <button key={sec.id} type="button" role="tab" aria-selected={pestana === sec.id} onClick={() => setPestana(sec.id)}
                    className={clsx('py-3 text-sm font-bold border-b-2 whitespace-nowrap', pestana === sec.id ? 'border-blue-700 text-blue-800 dark:text-blue-300' : 'border-transparent text-slate-500')}>
                    {sec.corto} {sec.opcional ? <span className="text-[10px] font-semibold text-slate-400">(opcional)</span> : f ? <span className="text-[10px] text-red-600">· faltan {f}</span> : <span className="text-emerald-600">✓</span>}
                  </button>
                );
              })}
            </div>
            <div className="p-4">
              {secciones.filter((x) => x.id === pestana).map((sec) => <FormularioSolicitud key={sec.id} seccion={sec} datos={datos} onCambio={setDatos} mostrarFaltantes />)}
            </div>
          </div>

          {/* Documentos */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
            <h2 className="font-extrabold mb-3">Documentos</h2>
            <ul className="grid sm:grid-cols-2 gap-2">
              {DOCUMENTOS_CREDITO.map((t) => {
                const lista = docs.filter((d) => d.tipo === t.tipo);
                return (
                  <li key={t.tipo} className={clsx('rounded-lg border px-3 py-2.5', lista.length ? 'border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-900' : t.req ? 'border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900' : 'border-slate-200 dark:border-slate-700')}>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold flex-1">{lista.length ? '✓' : t.req ? '!' : '·'} {t.etiqueta}</span>
                      <label className="text-xs font-bold text-blue-700 dark:text-blue-300 cursor-pointer flex items-center gap-1">
                        {trabajando === 'sub' + t.tipo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} Subir
                        <input type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={(e) => { const elegidos = Array.from(e.target.files || []); e.target.value = ''; subir(t.tipo, elegidos); }} />
                      </label>
                    </div>
                    {lista.map((d) => (
                      <div key={d.id} className="flex items-center gap-2 text-xs mt-1">
                        <FileText className="w-3.5 h-3.5 shrink-0" />
                        <button type="button" onClick={() => ver(d)} className="truncate flex-1 text-left hover:underline">{d.nombre}</button>
                        <span className="text-slate-500 shrink-0">{d.por === 'cliente' ? 'cliente' : d.porNombre}</span>
                        <button type="button" onClick={() => quitar(d)} aria-label={`Quitar ${d.nombre}`} className="p-0.5 text-slate-500"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    ))}
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Historial */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
            <h2 className="font-extrabold mb-3">Historial</h2>
            <div className="flex gap-2 mb-3">
              <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Agregar una nota (lo que dijo el banco, lo que falta…)" className="flex-1 h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm" />
              <button type="button" disabled={!nota.trim()} onClick={async () => { await cambiar({ nota }); setNota(''); }} className="h-10 px-4 rounded-lg bg-slate-900 text-white text-sm font-bold disabled:opacity-40">Anotar</button>
            </div>
            <ol className="flex flex-col gap-1.5 text-sm">
              {(s.historial || []).map((h: any, i: number) => <li key={i}><b className="text-slate-500">{fecha(h.fecha)}</b> · {h.texto}</li>)}
            </ol>
          </div>
        </div>

        {/* Bancos */}
        <aside className="flex flex-col gap-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
            <h2 className="font-extrabold">Bancos</h2>
            <p className="text-xs text-slate-500 mb-3">{falta.length ? `Faltan ${falta.length} datos para que la solicitud salga completa.` : 'Los datos están completos.'}</p>
            <div className="flex flex-col gap-3">
              {s.bancos.map((b: any) => {
                const firmadas = docs.filter((d) => d.tipo === 'firmada' && d.banco === b.clave);
                const ej = ejecutivos[b.clave] || {};
                return (
                  <div key={b.clave} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-extrabold">{b.nombre}</p>
                      <span className={clsx('text-[10px] font-bold rounded-full px-2 py-0.5', ESTILO_BANCO[b.estado])}>{TEXTO_ESTADO_BANCO[b.estado]}</span>
                    </div>
                    {b.formatoId && (
                      <>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <button type="button" onClick={() => descargar(b)} disabled={!!trabajando} className="h-9 rounded-lg bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-1">{trabajando === 'pdf' + b.clave ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} Descargar llenada</button>
                          <label className="h-9 rounded-lg border border-slate-300 dark:border-slate-600 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer">
                            {trabajando === 'subfirmada' + b.clave ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} Subir firmada
                            <input type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={(e) => { const elegidos = Array.from(e.target.files || []); e.target.value = ''; subir('firmada', elegidos, b.clave); }} />
                          </label>
                        </div>
                        {firmadas.map((d) => (
                          <div key={d.id} className="flex items-center gap-1.5 text-xs mt-1.5 text-emerald-800 dark:text-emerald-300"><Eye className="w-3.5 h-3.5" /><button type="button" onClick={() => ver(d)} className="truncate hover:underline">{d.nombre}</button><span className="text-slate-500">({d.por === 'cliente' ? 'la subió el cliente' : d.porNombre})</span></div>
                        ))}
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <button type="button" onClick={() => enviarAlEjecutivo(b, 'whatsapp')} disabled={!!trabajando} className="h-9 rounded-lg bg-[#1fa855] text-white text-xs font-bold flex items-center justify-center gap-1">{trabajando === 'env' + b.clave ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} WhatsApp al ejecutivo</button>
                          <button type="button" onClick={() => enviarAlEjecutivo(b, 'correo')} disabled={!!trabajando || !ej.correo} title={ej.correo ? '' : 'Captura el correo del ejecutivo en «Formatos de bancos»'} className="h-9 rounded-lg bg-slate-900 text-white text-xs font-bold disabled:opacity-40">Correo al ejecutivo</button>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">{ej.nombre || ej.whatsapp || ej.correo ? `Ejecutivo: ${[ej.nombre, ej.whatsapp, ej.correo].filter(Boolean).join(' · ')}` : 'Sin ejecutivo capturado (en «Formatos de bancos»).'}</p>
                      </>
                    )}
                    <label className="flex items-center gap-2 mt-2 text-xs"><span className="text-slate-500">Folio</span>
                      <input defaultValue={b.folio || ''} onBlur={(e) => e.target.value !== (b.folio || '') && ponerBanco(b, { folio: e.target.value })} className="flex-1 h-8 px-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900" />
                    </label>
                    <p className="text-xs font-bold mt-2.5 mb-1">Respuesta {b.clave === 'casa' ? '(la decide un administrador)' : 'del banco'}</p>
                    <div className="grid grid-cols-3 gap-1.5 text-xs font-bold">
                      {([['aprobado', 'Aprobado', 'border-emerald-400 bg-emerald-50 text-emerald-900'], ['condiciones', 'Condiciones', 'border-amber-400 bg-amber-50 text-amber-900'], ['rechazado', 'Rechazado', 'border-red-400 bg-red-50 text-red-900']] as const).map(([e, t, c]) => (
                        <button key={e} type="button" disabled={b.clave === 'casa' && !['admin', 'manager', 'master'].includes(String(userData?.role))}
                          onClick={() => ponerBanco(b, { estado: b.estado === e ? 'enviada' : e })}
                          className={clsx('h-8 rounded-lg border disabled:opacity-40', b.estado === e ? c + ' ring-2 ring-offset-1 ring-current' : 'border-slate-300 dark:border-slate-600')}>{t}</button>
                      ))}
                    </div>
                    <div className="flex justify-end mt-2"><button type="button" onClick={() => confirm(`¿Quitar ${b.nombre} de esta solicitud?`) && cambiar({ bancos: s.bancos.filter((x: any) => x.clave !== b.clave) })} className="text-[11px] text-slate-500 hover:text-red-700">Quitar banco</button></div>
                  </div>
                );
              })}
              {bancosFaltantes.length > 0 && (
                <select value="" onChange={(e) => { const n = bancosFaltantes.find((x) => x.clave === e.target.value); if (n) cambiar({ bancos: [...s.bancos, n] }); }} className="h-9 px-2 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm">
                  <option value="">+ Agregar banco…</option>
                  {bancosFaltantes.map((b) => <option key={b.clave} value={b.clave}>{b.nombre}</option>)}
                </select>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
            <h2 className="font-extrabold mb-1">Al aprobarse</h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">Cierra la venta desde la página del auto («Vender»), con los términos aprobados. Luego marca aquí la solicitud como «Venta cerrada».</p>
            <div className="flex flex-col gap-2">
              <button type="button" disabled={!aprobado || !s.vehicleId} onClick={() => navigate(`/inventory/${s.vehicleId}`)} className="h-10 rounded-lg bg-emerald-600 text-white text-sm font-bold disabled:opacity-40">Ir a vender el auto</button>
              <button type="button" disabled={!aprobado || s.etapa === 'cerrada'} onClick={() => cambiar({ etapa: 'cerrada' })} className="h-10 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-bold disabled:opacity-40">Marcar «Venta cerrada»</button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
