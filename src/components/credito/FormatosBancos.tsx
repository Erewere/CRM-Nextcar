import React, { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { Eye, Hash, Loader2, Plus, Upload, X } from 'lucide-react';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { creditosApi, solicitudLlenada } from '../../lib/creditosApi';
import { abrirPdf, catalogo, DATOS_DE_MUESTRA, type FormatoCredito, type MapeoCampo } from '../../lib/creditoCampos';

/**
 * Formatos de los bancos. Cuando un banco cambia su solicitud, aquí se sube la
 * nueva: los campos que se llamen igual conservan su dato y los nuevos se
 * acomodan en la tabla. «Mapa numerado» abre el PDF con un número en cada
 * campo para saber cuál es cuál; «Vista previa» lo llena con datos de prueba.
 */

function abrirBlob(b: Blob) {
  const url = URL.createObjectURL(b);
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 120_000);
}

async function mapaNumerado(bytes: ArrayBuffer, f: FormatoCredito) {
  const lib: any = await import('@cantoo/pdf-lib');
  const pdf: any = await abrirPdf(bytes);
  // Primero se fijan los campos y luego se dibujan los números encima (si no, las casillas los tapan).
  try { pdf.getForm().flatten({ updateFieldAppearances: false }); } catch { /* sin campos que fijar */ }
  const fuente = await pdf.embedFont(lib.StandardFonts.HelveticaBold);
  const paginas = pdf.getPages();
  const etiqueta = (p: any, t: string, x: number, yArriba: number, conDato: boolean) => {
    const tam = 6.5;
    const ancho = fuente.widthOfTextAtSize(t, tam) + 2;
    p.drawRectangle({ x, y: yArriba - tam - 1, width: ancho, height: tam + 1, color: conDato ? lib.rgb(0.1, 0.45, 0.2) : lib.rgb(0.85, 0.1, 0.1), opacity: 0.85 });
    p.drawText(t, { x: x + 1, y: yArriba - tam, size: tam, font: fuente, color: lib.rgb(1, 1, 1) });
  };
  f.campos.forEach((c, i) => {
    if (c.tipo === 'otro') return;
    const conDato = !!f.mapa[c.nombre];
    // En las casillas, cada una lleva su valor: «19·0», «19·1»…
    if (c.cajas?.length) c.cajas.forEach((k) => { const p = paginas[k.pagina - 1]; if (p) etiqueta(p, `${i + 1}·${k.valor}`, k.x, k.y, conDato); });
    else { const p = paginas[c.pagina - 1]; if (p) etiqueta(p, String(i + 1), c.x, c.y + c.h, conDato); }
  });
  return new Blob([await pdf.save()], { type: 'application/pdf' });
}

export function FormatosBancos({ onCerrar }: { onCerrar: () => void }) {
  const { userData } = useAuth();
  const [formatos, setFormatos] = useState<FormatoCredito[] | null>(null);
  const [editando, setEditando] = useState<FormatoCredito | null>(null);
  const [trabajando, setTrabajando] = useState('');
  const [aviso, setAviso] = useState('');
  const [ejecutivos, setEjecutivos] = useState<Record<string, any>>({});
  const esMaster = userData?.role === 'master';

  const cargar = () => creditosApi.formatos().then(setFormatos).catch((e) => setAviso(e.message));
  useEffect(() => {
    cargar();
    if (userData?.agencyId) getDoc(doc(db, 'agencies', userData.agencyId)).then((s) => setEjecutivos((s.data() as any)?.ejecutivosCredito || {})).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const subir = async (archivo: File | undefined, f?: FormatoCredito) => {
    if (!archivo) return;
    let nombre = f?.nombre || '';
    if (!f) { nombre = prompt('¿De qué banco es este formato?', '') || ''; if (!nombre.trim()) return; }
    setTrabajando(f?.id || 'nuevo'); setAviso('');
    try {
      const r = await creditosApi.subirFormato(archivo, nombre, f?.id, esMaster && !f);
      setAviso(`${r.formato.nombre}: versión ${r.formato.version} guardada. ${f ? `Se conservaron ${r.conservados} campos.` : ''} ${r.sinAcomodar ? `${r.sinAcomodar} campos sin dato: acomódalos.` : ''}`);
      await cargar();
      setEditando(r.formato);
    } catch (e: any) { setAviso(e.message); } finally { setTrabajando(''); }
  };

  const vista = async (f: FormatoCredito, tipo: 'muestra' | 'numeros') => {
    setTrabajando(f.id + tipo);
    try {
      const bytes = await creditosApi.pdfFormato(f.id);
      abrirBlob(tipo === 'muestra'
        ? await solicitudLlenada(bytes, f, DATOS_DE_MUESTRA, { operacion: { precio: 389000, enganche: 77800, plazo: 48 }, agencia: { name: 'Agencia de prueba' }, auto: '2021 VW Taigun' })
        : await mapaNumerado(bytes, f));
    } catch (e: any) { alert(e.message); } finally { setTrabajando(''); }
  };

  const guardarEjecutivo = async (clave: string, campo: string, valor: string) => {
    const nuevo = { ...ejecutivos, [clave]: { ...(ejecutivos[clave] || {}), [campo]: valor } };
    setEjecutivos(nuevo);
    if (userData?.agencyId) await updateDoc(doc(db, 'agencies', userData.agencyId), { ejecutivosCredito: nuevo }).catch(() => {});
  };

  if (editando) return <EditorMapa formato={editando} onCerrar={() => { setEditando(null); cargar(); }} onVista={vista} trabajando={trabajando} />;

  return (
    <div className="fixed inset-0 z-[110] flex items-stretch md:items-center justify-center md:p-4" role="dialog" aria-modal="true" aria-labelledby="titulo-formatos">
      <div className="absolute inset-0 bg-slate-900/60" onClick={onCerrar} />
      <div className="relative bg-white dark:bg-slate-800 md:rounded-2xl shadow-2xl w-full max-w-3xl md:max-h-[92vh] flex flex-col">
        <div className="flex items-start justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 id="titulo-formatos" className="text-lg font-extrabold">Formatos de bancos</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">Si un banco cambia su solicitud, sube aquí la nueva. Lo que se llame igual se conserva.</p>
          </div>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {aviso && <p className="text-sm font-semibold text-blue-900 bg-blue-50 rounded-lg p-3">{aviso}</p>}
          {!formatos && <Loader2 className="w-6 h-6 animate-spin text-slate-400 mx-auto" />}
          {formatos?.map((f) => {
            const conDato = f.campos.filter((c) => c.tipo !== 'otro' && f.mapa[c.nombre]).length;
            const total = f.campos.filter((c) => c.tipo !== 'otro').length;
            const ej = ejecutivos[f.clave] || {};
            return (
              <div key={f.id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-extrabold text-slate-900 dark:text-white">{f.nombre} <span className="text-xs font-semibold text-slate-500">versión {f.version}{f.agencyId ? ' · de tu agencia' : ''}</span></p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">{conDato} de {total} campos con dato · actualizado {f.actualizadoEl ? new Date(f.actualizadoEl).toLocaleDateString('es-MX') : '—'}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button type="button" onClick={() => vista(f, 'muestra')} disabled={!!trabajando} className="h-9 px-3 rounded-lg border border-slate-300 dark:border-slate-600 text-xs font-bold flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> {trabajando === f.id + 'muestra' ? 'Preparando…' : 'Vista previa'}</button>
                    <button type="button" onClick={() => setEditando(f)} className="h-9 px-3 rounded-lg border border-slate-300 dark:border-slate-600 text-xs font-bold">Acomodar campos</button>
                    <label className="h-9 px-3 rounded-lg bg-blue-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer">
                      {trabajando === f.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} Subir nueva versión
                      <input type="file" accept="application/pdf" className="hidden" disabled={!!trabajando} onChange={(e) => { subir(e.target.files?.[0], f); e.target.value = ''; }} />
                    </label>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3">
                  {([['nombre', 'Ejecutivo'], ['whatsapp', 'WhatsApp del ejecutivo'], ['correo', 'Correo del ejecutivo']] as const).map(([k, t]) => (
                    <label key={k} className="flex flex-col gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-400">{t}
                      <input defaultValue={ej[k] || ''} onBlur={(e) => e.target.value !== (ej[k] || '') && guardarEjecutivo(f.clave, k, e.target.value.trim())} className="h-9 px-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm font-normal text-slate-900 dark:text-slate-100" />
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
          <label className="rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 p-4 text-center cursor-pointer hover:border-blue-500">
            <span className="text-sm font-bold flex items-center justify-center gap-1.5">{trabajando === 'nuevo' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Agregar otro banco</span>
            <span className="text-xs text-slate-500">Sube su solicitud en PDF «rellenable» (con casillas para escribir).</span>
            <input type="file" accept="application/pdf" className="hidden" disabled={!!trabajando} onChange={(e) => { subir(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
        </div>
      </div>
    </div>
  );
}

function EditorMapa({ formato, onCerrar, onVista, trabajando }: { formato: FormatoCredito; onCerrar: () => void; onVista: (f: FormatoCredito, t: 'muestra' | 'numeros') => void; trabajando: string }) {
  const [mapa, setMapa] = useState<Record<string, MapeoCampo>>(formato.mapa || {});
  const [soloSinDato, setSoloSinDato] = useState(true);
  const [busca, setBusca] = useState('');
  const [guardando, setGuardando] = useState(false);
  const cat = useMemo(() => catalogo(), []);
  const grupos = useMemo(() => [...new Set(cat.map((c) => c.grupo))], [cat]);
  const campos = formato.campos.map((c, i) => ({ ...c, n: i + 1 })).filter((c) => c.tipo !== 'otro')
    .filter((c) => !soloSinDato || !mapa[c.nombre])
    .filter((c) => !busca.trim() || `${c.n} ${c.nombre}`.toLowerCase().includes(busca.toLowerCase()));

  const poner = (nombre: string, m: MapeoCampo | null) => setMapa((p) => { const n = { ...p }; if (m) n[nombre] = m; else delete n[nombre]; return n; });
  const guardar = async () => {
    setGuardando(true);
    try { await creditosApi.guardarFormato(formato.id, { mapa }); onCerrar(); } catch (e: any) { alert(e.message); } finally { setGuardando(false); }
  };
  const actual = { ...formato, mapa };

  return (
    <div className="fixed inset-0 z-[110] bg-white dark:bg-slate-900 flex flex-col" role="dialog" aria-modal="true" aria-labelledby="titulo-editor">
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[220px]">
          <h2 id="titulo-editor" className="text-lg font-extrabold">Acomodar campos · {formato.nombre}</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">Abre el «mapa numerado» para ver dónde está cada número; luego elige qué dato del cliente lleva.</p>
        </div>
        <button type="button" onClick={() => onVista(actual, 'numeros')} className="h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-bold flex items-center gap-1.5"><Hash className="w-4 h-4" /> {trabajando === formato.id + 'numeros' ? 'Preparando…' : 'Mapa numerado'}</button>
        <button type="button" onClick={() => onVista(actual, 'muestra')} className="h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-bold flex items-center gap-1.5"><Eye className="w-4 h-4" /> Vista previa</button>
        <button type="button" onClick={onCerrar} disabled={guardando} className="h-10 px-3 rounded-lg text-sm font-semibold">Cancelar</button>
        <button type="button" onClick={guardar} disabled={guardando} className="h-10 px-4 rounded-lg bg-blue-700 text-white text-sm font-bold">{guardando ? 'Guardando…' : 'Guardar'}</button>
      </div>
      <div className="px-4 py-2 flex flex-wrap items-center gap-3 border-b border-slate-200 dark:border-slate-700">
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar número o nombre…" className="h-9 px-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm" />
        <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={soloSinDato} onChange={(e) => setSoloSinDato(e.target.checked)} /> Solo los que no tienen dato</label>
        <span className="text-xs text-slate-500">{formato.campos.filter((c) => c.tipo !== 'otro' && mapa[c.nombre]).length} de {formato.campos.filter((c) => c.tipo !== 'otro').length} con dato</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 text-xs text-slate-600 dark:text-slate-300">
            <tr><th className="text-left p-2 w-14">#</th><th className="text-left p-2">Campo del PDF</th><th className="text-left p-2">Dato del cliente</th></tr>
          </thead>
          <tbody>
            {campos.map((c) => {
              const m = mapa[c.nombre] || {};
              const def = cat.find((x) => x.clave === m.clave);
              return (
                <tr key={c.nombre} className="border-t border-slate-100 dark:border-slate-800 align-top">
                  <td className="p-2 font-extrabold">{c.n}</td>
                  <td className="p-2"><p className="font-mono text-xs break-all">{c.nombre}</p><p className="text-[11px] text-slate-500">Hoja {c.pagina} · {c.tipo === 'opcion' ? `casilla (${(c.valores || []).join(', ')})` : 'texto'}</p></td>
                  <td className="p-2">
                    <select
                      value={m.fijo !== undefined ? '__fijo' : (m.clave || '')}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (!v) poner(c.nombre, null);
                        else if (v === '__fijo') poner(c.nombre, { fijo: '', ...(c.tipo === 'opcion' ? { opciones: {} } : {}) });
                        else poner(c.nombre, { clave: v, ...(c.tipo === 'opcion' ? { opciones: m.clave === v ? m.opciones : {} } : {}) });
                      }}
                      className="w-full max-w-md h-9 px-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
                    >
                      <option value="">— Sin dato (se queda vacío) —</option>
                      <option value="__fijo">Siempre el mismo valor…</option>
                      {grupos.map((g) => (
                        <optgroup key={g} label={g}>
                          {cat.filter((x) => x.grupo === g && (c.tipo === 'texto' || x.ops)).map((x) => <option key={x.clave} value={x.clave}>{x.etiqueta}</option>)}
                        </optgroup>
                      ))}
                    </select>
                    {m.fijo !== undefined && c.tipo === 'texto' && (
                      <input value={m.fijo} onChange={(e) => poner(c.nombre, { fijo: e.target.value })} placeholder="Texto que siempre lleva" className="mt-1.5 w-full max-w-md h-9 px-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900" />
                    )}
                    {m.fijo !== undefined && c.tipo === 'opcion' && (
                      <select value={m.opciones?.si || ''} onChange={(e) => poner(c.nombre, { fijo: 'si', opciones: e.target.value ? { si: e.target.value } : {} })} className="mt-1.5 h-9 px-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900">
                        <option value="">Ninguna casilla</option>
                        {(c.valores || []).map((v) => <option key={v} value={v}>Marcar la casilla «{v}»</option>)}
                      </select>
                    )}
                    {c.tipo === 'opcion' && def?.ops && m.fijo === undefined && (
                      <div className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-1">
                        {def.ops.map(([val, txt]) => (
                          <label key={val} className="flex items-center gap-2 text-xs">
                            <span className="w-40 truncate">{txt}</span>
                            <select value={m.opciones?.[val] || ''} onChange={(e) => poner(c.nombre, { clave: m.clave, opciones: { ...(m.opciones || {}), [val]: e.target.value } })} className={clsx('h-8 px-1 rounded border bg-white dark:bg-slate-900', m.opciones?.[val] ? 'border-emerald-400' : 'border-slate-300 dark:border-slate-600')}>
                              <option value="">ninguna</option>
                              {(c.valores || []).map((v) => <option key={v} value={v}>casilla «{v}»</option>)}
                            </select>
                          </label>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {!campos.length && <tr><td colSpan={3} className="p-8 text-center text-slate-500">{soloSinDato ? 'Todos los campos tienen dato. Quita «Solo los que no tienen dato» para revisarlos.' : 'Sin resultados.'}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
