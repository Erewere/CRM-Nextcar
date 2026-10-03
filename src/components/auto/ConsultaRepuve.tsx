import React, { useState } from 'react';
import clsx from 'clsx';
import { AlertTriangle, CheckCircle2, ExternalLink, Info, ShieldAlert, ShieldCheck, ShieldQuestion } from 'lucide-react';
import type { Vehicle } from '../../types';
import { revisarNiv, TEXTO_RESULTADO, URL_REPUVE, type ConsultaRepuve, type ResultadoRepuve } from '../../lib/niv';

/**
 * Consulta REPUVE: el sitio oficial pide resolver un captcha, así que el CRM
 * no consulta solo (ni debe intentarlo). Lo que hace: revisa el NIV antes,
 * lo copia, abre la página oficial y guarda lo que salió, con fecha y quién
 * lo consultó. Si sale con reporte de robo, la página del auto lo marca en rojo.
 */

const fechaCorta = (iso: string) => new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });

export function estiloResultado(r?: ResultadoRepuve) {
  return r === 'con_reporte'
    ? { caja: 'bg-red-50 border-red-300 text-red-900 dark:bg-red-950/40 dark:border-red-800 dark:text-red-200', Icono: ShieldAlert }
    : r === 'sin_reporte'
      ? { caja: 'bg-emerald-50 border-emerald-300 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200', Icono: ShieldCheck }
      : { caja: 'bg-amber-50 border-amber-300 text-amber-900 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-200', Icono: ShieldQuestion };
}

export function ConsultaRepuveAuto({ auto, puedeRegistrar, usuario, onGuardar }: {
  auto: Vehicle;
  puedeRegistrar: boolean;
  usuario: { id?: string; name?: string; email?: string };
  onGuardar: (consulta: ConsultaRepuve, historial: ConsultaRepuve[]) => Promise<void>;
}) {
  const rev = revisarNiv(auto.vin, Number(auto.year) || undefined);
  const placa = String((auto as any).licensePlate || '').trim();
  const ultima: ConsultaRepuve | undefined = (auto as any).repuve;
  const historial: ConsultaRepuve[] = (auto as any).repuveHistorial || [];
  const [abierta, setAbierta] = useState(false);   // ya abrió el sitio: pedir el resultado
  const [nota, setNota] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [copiado, setCopiado] = useState('');

  const consultar = async () => {
    const texto = rev.completo ? rev.niv : placa;
    try { if (texto) { await navigator.clipboard.writeText(texto); setCopiado(texto); } } catch { /* sin permiso: se ve en pantalla */ }
    window.open(URL_REPUVE, '_blank', 'noopener');
    setAbierta(true);
  };

  const registrar = async (resultado: ResultadoRepuve) => {
    if (resultado === 'con_reporte' && !confirm('¿Confirmas que el REPUVE muestra REPORTE DE ROBO para este auto? Quedará marcado en rojo.')) return;
    setGuardando(true);
    try {
      const c: ConsultaRepuve = {
        resultado,
        fecha: new Date().toISOString(),
        por: usuario.id || '',
        porNombre: usuario.name || usuario.email || 'Usuario',
        niv: rev.niv || placa,
        ...(nota.trim() ? { nota: nota.trim() } : {}),
      };
      await onGuardar(c, [c, ...historial].slice(0, 10));
      setAbierta(false); setNota('');
    } catch (e: any) {
      alert(`No se pudo guardar. ${e?.message || ''}`);
    } finally {
      setGuardando(false);
    }
  };

  const est = estiloResultado(ultima?.resultado);
  const nivCambio = ultima && rev.niv && ultima.niv && ultima.niv !== rev.niv && ultima.niv !== placa;

  return (
    <section className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-extrabold text-slate-900 dark:text-white">Consulta REPUVE</h3>
          <p className="text-xs text-slate-600 dark:text-slate-400">Revisa si el auto tiene reporte de robo antes de comprarlo o venderlo.</p>
        </div>
      </div>

      {/* Última consulta */}
      {ultima ? (
        <div className={clsx('rounded-lg border px-3 py-2.5 flex items-start gap-2.5', est.caja)}>
          <est.Icono className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="text-sm min-w-0">
            <p className="font-extrabold">{TEXTO_RESULTADO[ultima.resultado]}</p>
            <p className="text-xs opacity-90">Consultado el {fechaCorta(ultima.fecha)} por {ultima.porNombre}{ultima.nota ? ` · ${ultima.nota}` : ''}</p>
            {nivCambio && <p className="text-xs font-bold mt-1">El NIV cambió desde esa consulta: vuelve a consultar.</p>}
          </div>
        </div>
      ) : (
        <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5"><ShieldQuestion className="w-4 h-4" /> Aún no se consulta.</p>
      )}

      {/* Revisión del NIV */}
      <div className="rounded-lg bg-slate-50 dark:bg-slate-900/50 px-3 py-2.5 flex flex-col gap-1.5">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">NIV</span>
          <span className="font-mono text-sm font-bold text-slate-900 dark:text-white tracking-wider break-all">{rev.niv || '—'}</span>
          {placa && <><span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Placas</span><span className="font-mono text-sm font-bold">{placa}</span></>}
        </div>
        {rev.completo && (
          <p className="text-xs text-slate-700 dark:text-slate-300 flex flex-wrap gap-x-3">
            <span>Hecho en <b>{rev.pais}</b></span>
            {rev.anioModelo && <span>Modelo <b>{rev.anioModelo}</b> según el NIV</span>}
            {rev.digitoOk && <span className="text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Dígito verificador correcto</span>}
          </p>
        )}
        {rev.avisos.map((a, i) => (
          <p key={i} className={clsx('text-xs flex items-start gap-1.5',
            a.tipo === 'error' ? 'text-red-700 dark:text-red-400 font-semibold' : a.tipo === 'alerta' ? 'text-amber-800 dark:text-amber-300 font-semibold' : 'text-slate-600 dark:text-slate-400')}>
            {a.tipo === 'info' ? <Info className="w-3.5 h-3.5 shrink-0 mt-px" /> : <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />} {a.texto}
          </p>
        ))}
      </div>

      {/* Consultar y registrar */}
      <button
        type="button"
        onClick={consultar}
        disabled={!rev.completo && !placa}
        className="min-h-[40px] px-4 rounded-lg bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-sm font-bold flex items-center justify-center gap-1.5"
      >
        <ExternalLink className="w-4 h-4" /> {ultima ? 'Volver a consultar en el REPUVE' : 'Consultar en el REPUVE'}
      </button>
      {copiado && <p className="text-xs text-slate-600 dark:text-slate-400 -mt-1.5">Copiamos <b className="font-mono">{copiado}</b>: pégalo en la página del REPUVE, resuelve el código de verificación y dale «Buscar».</p>}

      {(abierta || (!ultima && puedeRegistrar && (rev.completo || placa))) && puedeRegistrar && (
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 flex flex-col gap-2">
          <p className="text-sm font-bold text-slate-900 dark:text-white">¿Qué salió en el REPUVE?</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button type="button" disabled={guardando} onClick={() => registrar('sin_reporte')} className="min-h-[40px] px-3 rounded-lg border border-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 text-sm font-bold disabled:opacity-50">Sin reporte de robo</button>
            <button type="button" disabled={guardando} onClick={() => registrar('con_reporte')} className="min-h-[40px] px-3 rounded-lg border border-red-400 bg-red-50 dark:bg-red-950/40 text-red-900 dark:text-red-200 text-sm font-bold disabled:opacity-50">Con reporte de robo</button>
            <button type="button" disabled={guardando} onClick={() => registrar('no_aparece')} className="min-h-[40px] px-3 rounded-lg border border-amber-400 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 text-sm font-bold disabled:opacity-50">No aparece</button>
          </div>
          <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Nota opcional (ej. folio de la consulta)" maxLength={200}
            className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm" />
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Consejo: guarda una captura de pantalla del resultado en «Documentos».</p>
        </div>
      )}

      {historial.length > 1 && (
        <details className="text-xs text-slate-600 dark:text-slate-400">
          <summary className="cursor-pointer font-semibold">Consultas anteriores ({historial.length - 1})</summary>
          <ul className="mt-1.5 flex flex-col gap-1">
            {historial.slice(1).map((c, i) => (
              <li key={i}>{fechaCorta(c.fecha)} · <b>{TEXTO_RESULTADO[c.resultado]}</b> · {c.porNombre}{c.nota ? ` · ${c.nota}` : ''}</li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
