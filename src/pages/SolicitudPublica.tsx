import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router';
import clsx from 'clsx';
import { Check, Download, FileText, Loader2, Lock, Trash2, Upload } from 'lucide-react';
import { DOCUMENTOS_CREDITO, faltantes, seccionesVisibles } from '../lib/creditoCampos';
import { ligaApi, solicitudLlenada, descargarOCompartirArchivos } from '../lib/creditosApi';
import { FormularioSolicitud } from '../components/credito/FormularioSolicitud';

/**
 * Lo que abre el cliente con su liga: llena su solicitud en pasos cortos, sube
 * sus documentos, descarga la solicitud de cada banco ya llenada para
 * firmarla, la sube firmada y autoriza compartirla. Todo se guarda solo.
 */
export function SolicitudPublica() {
  const { token = '' } = useParams();
  const [info, setInfo] = useState<any>(null);
  const [error, setError] = useState('');
  const [datos, setDatos] = useState<any>({});
  const [paso, setPaso] = useState(0);
  const [guardado, setGuardado] = useState<'listo' | 'guardando' | 'error'>('listo');
  const [docs, setDocs] = useState<any[]>([]);
  const [subiendo, setSubiendo] = useState('');
  const [acepta, setAcepta] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [mostrarFaltantes, setMostrarFaltantes] = useState(false);
  const temporizador = useRef<any>(null);
  const primeraVez = useRef(true);

  useEffect(() => {
    ligaApi.ver(token).then((d) => { setInfo(d); setDatos(d.datos || {}); setDocs(d.documentos || []); setEnviado(!!d.terminadoEl); }).catch((e) => setError(e.message));
  }, [token]);

  // Se guarda solo, un momento después de cada cambio.
  useEffect(() => {
    if (!info) return;
    if (primeraVez.current) { primeraVez.current = false; return; }
    setGuardado('guardando');
    clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => {
      ligaApi.guardar(token, datos).then(() => setGuardado('listo')).catch(() => setGuardado('error'));
    }, 900);
    return () => clearTimeout(temporizador.current);
  }, [datos]); // eslint-disable-line react-hooks/exhaustive-deps

  const secciones = useMemo(() => seccionesVisibles(datos), [datos]);
  const bancosConFormato = (info?.bancos || []).filter((b: any) => b.formatoId && b.mapa);
  const pasos = [...secciones.map((s) => ({ id: s.id, titulo: s.titulo })), { id: 'documentos', titulo: 'Tus documentos' }, ...(bancosConFormato.length ? [{ id: 'firmas', titulo: 'Firma tu solicitud' }] : []), { id: 'enviar', titulo: 'Enviar' }];
  const actual = pasos[Math.min(paso, pasos.length - 1)];
  const seccion = secciones.find((s) => s.id === actual?.id);
  const faltaEnPaso = seccion && !seccion.opcional ? faltantes(datos).filter((f) => f.seccion === seccion.id) : [];
  const faltaTodo = faltantes(datos);

  const ir = (n: number) => { setMostrarFaltantes(false); setPaso(Math.max(0, Math.min(pasos.length - 1, n))); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const siguiente = () => { if (faltaEnPaso.length) { setMostrarFaltantes(true); return; } ir(paso + 1); };

  const subir = async (tipo: string, archivos: FileList | null, banco?: string) => {
    if (!archivos?.length) return;
    setSubiendo(tipo + (banco || ''));
    try {
      for (const a of Array.from(archivos)) {
        const d = await ligaApi.subir(token, a, tipo, a.name || `${tipo}.jpg`, banco);
        setDocs((p) => [...p, d]);
      }
    } catch (e: any) { alert(e.message); } finally { setSubiendo(''); }
  };
  const quitar = async (d: any) => {
    if (!confirm(`¿Quitar «${d.nombre}»?`)) return;
    try { await ligaApi.quitar(token, d.id); setDocs((p) => p.filter((x) => x.id !== d.id)); } catch (e: any) { alert(e.message); }
  };

  const descargarSolicitud = async (b: any) => {
    setSubiendo('pdf' + b.clave);
    try {
      const bytes = await ligaApi.pdfFormato(token, b.formatoId);
      const blob = await solicitudLlenada(bytes, { mapa: b.mapa, mayusculas: b.mayusculas }, datos, { operacion: info.operacion, agencia: info.agencia, auto: info.auto });
      await descargarOCompartirArchivos([new File([blob], `Solicitud ${b.nombre}.pdf`, { type: 'application/pdf' })], `Solicitud ${b.nombre}`);
    } catch (e: any) { alert(e.message || 'No se pudo preparar la solicitud.'); } finally { setSubiendo(''); }
  };

  const enviar = async () => {
    if (faltaTodo.length) { alert(`Te faltan ${faltaTodo.length} datos obligatorios. Revisa los pasos marcados.`); return; }
    try { await ligaApi.guardar(token, datos); await ligaApi.enviar(token); setEnviado(true); } catch (e: any) { alert(e.message); }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="max-w-sm bg-white rounded-2xl shadow p-6 text-center">
          <Lock className="w-10 h-10 mx-auto text-slate-400" />
          <p className="mt-3 font-extrabold text-slate-900">No pudimos abrir tu solicitud</p>
          <p className="text-sm text-slate-600 mt-1">{error}</p>
        </div>
      </div>
    );
  }
  if (!info) return <div className="min-h-screen bg-slate-100 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>;

  const docsDe = (tipo: string, banco?: string) => docs.filter((d) => d.tipo === tipo && (!banco || d.banco === banco));
  const vence = new Date(info.vence).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' });

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="bg-slate-900 text-white">
        <div className="max-w-2xl mx-auto px-5 pt-5 pb-4">
          <div className="flex items-center gap-3">
            {info.agencia.logoUrl && <img src={info.agencia.logoUrl} alt="" className="h-9 max-w-[120px] object-contain bg-white rounded p-1" />}
            <div className="min-w-0">
              <p className="text-xs opacity-80">{info.agencia.name}</p>
              <p className="text-lg font-extrabold leading-tight">Solicitud de crédito</p>
              {info.auto && <p className="text-xs opacity-80 truncate">{info.auto}{info.operacion?.precio ? ` · $${Number(info.operacion.precio).toLocaleString('es-MX')}` : ''}</p>}
            </div>
          </div>
          {!enviado && (
            <>
              <div className="flex gap-1 mt-4" aria-hidden>{pasos.map((p, i) => <span key={p.id} className={clsx('h-1.5 flex-1 rounded-full', i < paso ? 'bg-emerald-400' : i === paso ? 'bg-white' : 'bg-white/25')} />)}</div>
              <div className="flex justify-between mt-1.5 text-[11px] opacity-80">
                <span>Paso {paso + 1} de {pasos.length} · {actual?.titulo}</span>
                <span>{guardado === 'guardando' ? 'Guardando…' : guardado === 'error' ? 'Sin conexión: reintenta' : 'Guardado'}</span>
              </div>
            </>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5">
        {enviado ? (
          <div className="bg-white rounded-2xl shadow-sm p-6 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto"><Check className="w-8 h-8" /></div>
            <p className="mt-3 text-xl font-extrabold">¡Listo! Tu asesor ya tiene tu solicitud</p>
            <p className="text-sm text-slate-600 mt-1">Si te pide algo más, puedes volver a esta misma liga hasta el {vence}.</p>
            <button type="button" onClick={() => { setEnviado(false); setPaso(0); }} className="mt-4 text-sm font-bold text-blue-700">Revisar o corregir mis datos</button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h1 className="text-xl font-extrabold">{actual?.titulo}</h1>
            {seccion?.descripcion && <p className="text-sm text-slate-600 mt-0.5">{seccion.descripcion}</p>}

            <div className="mt-4">
              {seccion && <FormularioSolicitud seccion={seccion} datos={datos} onCambio={setDatos} mostrarFaltantes={mostrarFaltantes} grande />}

              {actual?.id === 'documentos' && (
                <div className="flex flex-col gap-2.5">
                  <p className="text-sm text-slate-600">Toma foto o sube el archivo. Que se lea bien y que no tengan más de 3 meses.</p>
                  {DOCUMENTOS_CREDITO.map((t) => {
                    const lista = docsDe(t.tipo);
                    const loTiene = lista.length > 0 || (info.tiposAgencia || []).includes(t.tipo);
                    return (
                      <div key={t.tipo} className={clsx('rounded-xl border p-3', loTiene ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200')}>
                        <div className="flex items-center gap-2">
                          <span className={clsx('w-6 h-6 rounded-full flex items-center justify-center text-xs font-extrabold', loTiene ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500')}>{loTiene ? '✓' : ''}</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm">{t.etiqueta}{t.req && <span className="text-red-600"> *</span>}</p>
                            <p className="text-xs text-slate-500">{t.ayuda}</p>
                          </div>
                          <label className="shrink-0 h-10 px-3 rounded-lg bg-blue-700 text-white text-sm font-bold flex items-center gap-1.5 cursor-pointer">
                            {subiendo === t.tipo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Subir
                            <input type="file" accept="image/*,application/pdf" multiple className="hidden" disabled={!!subiendo} onChange={(e) => { subir(t.tipo, e.target.files); e.target.value = ''; }} />
                          </label>
                        </div>
                        {lista.length > 0 && (
                          <ul className="mt-2 flex flex-col gap-1">
                            {lista.map((d) => (
                              <li key={d.id} className="flex items-center gap-2 text-xs text-slate-700"><FileText className="w-3.5 h-3.5" /><span className="truncate flex-1">{d.nombre}</span>
                                <button type="button" onClick={() => quitar(d)} aria-label={`Quitar ${d.nombre}`} className="p-1 text-slate-500"><Trash2 className="w-3.5 h-3.5" /></button></li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {actual?.id === 'firmas' && (
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-slate-600">Cada banco tiene su formato. Ya lo llenamos con tus datos: <b>descárgalo, imprímelo, fírmalo</b> donde dice «Firma» y <b>súbelo</b> en foto o escaneado. Si no puedes imprimir, avisa a tu asesor y lo firmas en la agencia.</p>
                  {faltaTodo.length > 0 && <p className="text-sm font-semibold text-amber-700 bg-amber-50 rounded-lg p-3">Antes de descargar, completa tus datos: faltan {faltaTodo.length}.</p>}
                  {bancosConFormato.map((b: any) => {
                    const firmadas = docsDe('firmada', b.clave);
                    return (
                      <div key={b.clave} className={clsx('rounded-xl border p-3', firmadas.length ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200')}>
                        <p className="font-extrabold">{b.nombre}</p>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <button type="button" disabled={faltaTodo.length > 0 || !!subiendo} onClick={() => descargarSolicitud(b)} className="h-11 rounded-lg border border-slate-300 text-sm font-bold flex items-center justify-center gap-1.5 disabled:opacity-50">
                            {subiendo === 'pdf' + b.clave ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} 1 · Descargar
                          </button>
                          <label className={clsx('h-11 rounded-lg bg-blue-700 text-white text-sm font-bold flex items-center justify-center gap-1.5 cursor-pointer', !!subiendo && 'opacity-50')}>
                            {subiendo === 'firmada' + b.clave ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} 2 · Subir firmada
                            <input type="file" accept="image/*,application/pdf" multiple className="hidden" disabled={!!subiendo} onChange={(e) => { subir('firmada', e.target.files, b.clave); e.target.value = ''; }} />
                          </label>
                        </div>
                        {firmadas.length > 0 && <p className="text-xs text-emerald-800 font-semibold mt-2">✓ {firmadas.length} {firmadas.length === 1 ? 'archivo subido' : 'archivos subidos'}</p>}
                      </div>
                    );
                  })}
                </div>
              )}

              {actual?.id === 'enviar' && (
                <div className="flex flex-col gap-3">
                  {faltaTodo.length > 0 ? (
                    <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm">
                      <p className="font-bold text-amber-900">Te faltan {faltaTodo.length} datos obligatorios:</p>
                      <ul className="mt-1 text-amber-900 list-disc pl-5">
                        {[...new Set(faltaTodo.map((f) => f.seccion))].map((sid) => {
                          const i = pasos.findIndex((p) => p.id === sid);
                          return <li key={sid}><button type="button" className="underline font-semibold" onClick={() => { ir(i); setMostrarFaltantes(true); }}>{pasos[i]?.titulo}</button> ({faltaTodo.filter((f) => f.seccion === sid).length})</li>;
                        })}
                      </ul>
                    </div>
                  ) : <p className="text-sm text-emerald-800 font-semibold">Tus datos están completos.</p>}
                  <label className="flex gap-2.5 rounded-xl bg-slate-50 border border-slate-200 p-3 text-sm">
                    <input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} className="mt-0.5 w-5 h-5 accent-blue-700 shrink-0" />
                    <span>Declaro que mis datos son verdaderos y autorizo a <b>{info.agencia.name || 'la agencia'}</b> a compartir esta solicitud y mis documentos con {(info.bancos || []).map((b: any) => b.nombre).join(', ')} para evaluar mi crédito, conforme a su aviso de privacidad.</span>
                  </label>
                  <button type="button" disabled={!acepta} onClick={enviar} className="h-12 rounded-xl bg-emerald-600 text-white font-bold disabled:opacity-50">Enviar a la agencia</button>
                </div>
              )}
            </div>

            {mostrarFaltantes && faltaEnPaso.length > 0 && <p className="mt-3 text-sm font-semibold text-red-700">Llena los campos marcados en rojo para seguir.</p>}

            <div className="flex gap-2 mt-5">
              {paso > 0 && <button type="button" onClick={() => ir(paso - 1)} className="h-12 px-4 rounded-xl border border-slate-300 font-bold">Atrás</button>}
              {actual?.id !== 'enviar' && <button type="button" onClick={siguiente} className="flex-1 h-12 rounded-xl bg-blue-700 text-white font-bold">{seccion?.opcional ? 'Siguiente (opcional)' : 'Siguiente'}</button>}
            </div>
          </div>
        )}
        <p className="text-[11px] text-slate-500 text-center mt-4 flex items-center justify-center gap-1"><Lock className="w-3 h-3" /> Tu información viaja cifrada y solo la ve tu asesor. Liga válida hasta el {vence}.</p>
      </main>
    </div>
  );
}
