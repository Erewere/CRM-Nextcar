import React, { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { Link } from 'react-router';
import { AlertTriangle, FileCheck2, FileText, History, Loader2, Radar, ShieldAlert, ShieldCheck, ShieldQuestion, WifiOff } from 'lucide-react';
import { auth } from '../../lib/firebase';
import { getApiUrl } from '../../lib/api';
import { NOMBRE_FUENTE, TEXTO_VEREDICTO, type EvaluacionPlacas, type VeredictoPlacas } from '../../lib/placasInfo';
import { descargarOCompartir } from '../../lib/fichaPdf';
import { folioDeConstancia, generarConstanciaPlacas, nombreDeConstancia, type DatosConstancia, type VarianteConstancia } from '../../lib/constanciaPlacasPdf';

/**
 * Consulta automática con PlacasInfo: seis fuentes en una sola consulta.
 * Cuesta un crédito, así que pide confirmación y no repite el mismo auto
 * dentro de 24 h salvo que se pida. El resultado también queda como la
 * consulta REPUVE del auto (el aviso rojo de la ficha sale de ahí).
 *
 * Cada consulta deja su constancia: al terminar, el CRM genera la hoja del
 * cliente y la guarda en los Documentos del auto (categoría «Verificación»),
 * para que dentro de un año siga constando qué contestó cada fuente. La hoja
 * del expediente, con la ficha completa del REPUVE, se baja aparte.
 */

interface Constancia { docId: string; nombre?: string; fecha?: string }
interface Consulta { id: string; estado: 'procesando' | 'lista' | 'error'; consultado: string; fecha: string; porNombre: string; evaluacion?: EvaluacionPlacas; error?: string; creditos?: number; constancia?: Constancia }

async function api(ruta: string, init: RequestInit = {}) {
  const token = await auth.currentUser?.getIdToken();
  const r = await fetch(getApiUrl(ruta), { ...init, headers: { ...(init.headers || {}), Authorization: `Bearer ${token}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}) } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.error || `Error ${r.status}`);
  return d;
}

const ESTILO: Record<VeredictoPlacas, { caja: string; Icono: any }> = {
  vigente: { caja: 'bg-red-50 border-red-300 text-red-900 dark:bg-red-950/40 dark:border-red-800 dark:text-red-200', Icono: ShieldAlert },
  antecedente: { caja: 'bg-amber-50 border-amber-300 text-amber-900 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-200', Icono: History },
  limpio: { caja: 'bg-emerald-50 border-emerald-300 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200', Icono: ShieldCheck },
  incompleto: { caja: 'bg-slate-50 border-slate-300 text-slate-900 dark:bg-slate-900/50 dark:border-slate-600 dark:text-slate-200', Icono: ShieldQuestion },
};

const fechaHora = (iso: string) => new Date(iso).toLocaleString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

export function ConsultaPlacasInfo({ autoId, puedeConsultar, auto, agencia }: {
  autoId: string;
  puedeConsultar: boolean;
  auto: { make?: string; model?: string; year?: any; vin?: string; color?: string; km?: any; bodyType?: string; transmission?: string; licensePlate?: string; checklist?: { platesState?: string } };
  agencia?: { name?: string; address?: string; phone?: string; logoUrl?: string } | null;
}) {
  const [activo, setActivo] = useState(false);
  // Consultas que le quedan a la agencia (null = usa la cuenta propia, sin límite).
  const [saldo, setSaldo] = useState<number | null>(null);
  const [consultas, setConsultas] = useState<Consulta[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [haciendo, setHaciendo] = useState<VarianteConstancia | ''>('');
  const vivo = useRef(true);
  const guardadas = useRef(new Set<string>());

  const cargar = async () => {
    try { const d = await api(`/api/autos/${autoId}/placasinfo`); if (vivo.current) setConsultas(d.consultas || []); } catch { /* se ve al reintentar */ }
  };

  useEffect(() => {
    vivo.current = true;
    api('/api/placasinfo/disponible').then((d) => { if (vivo.current && d.activo) { setActivo(true); setSaldo(typeof d.saldo === 'number' ? d.saldo : null); cargar(); } }).catch(() => {});
    return () => { vivo.current = false; };
  }, [autoId]); // eslint-disable-line react-hooks/exhaustive-deps

  const ultima = consultas[0];

  // Al terminar una consulta, su constancia queda guardada en el auto. El
  // servidor anota cuál se guardó, así que dos pantallas abiertas no dejan dos.
  useEffect(() => {
    if (!ultima || ultima.estado !== 'lista' || !ultima.evaluacion || ultima.constancia) return;
    if (guardadas.current.has(ultima.id)) return;
    guardadas.current.add(ultima.id);
    guardarEnElAuto(ultima)
      .then((constancia) => { if (vivo.current) setConsultas((cs) => cs.map((c) => (c.id === ultima.id ? { ...c, constancia } : c))); })
      .catch(() => { /* sin permiso de documentos, o falló: quedan los botones */ });
  }, [ultima?.id, ultima?.estado, ultima?.constancia?.docId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mientras haya una en proceso, preguntar cada 4 s.
  useEffect(() => {
    if (ultima?.estado !== 'procesando') return;
    const t = setInterval(cargar, 4000);
    return () => clearInterval(t);
  }, [ultima?.id, ultima?.estado]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Constancia de la consulta
  const datosDe = (c: Consulta, variante: VarianteConstancia): DatosConstancia => ({
    variante,
    evaluacion: c.evaluacion!,
    consulta: { id: c.id, consultado: c.consultado, fecha: c.fecha, porNombre: c.porNombre },
    auto: {
      make: auto.make, model: auto.model, year: auto.year, vin: auto.vin, color: auto.color, km: auto.km,
      bodyType: auto.bodyType, transmission: auto.transmission,
      licensePlate: auto.licensePlate, platesState: auto.checklist?.platesState,
    },
    agencia,
    anteriores: consultas
      .filter((x) => x.id !== c.id && x.estado === 'lista')
      .map((x) => ({ fecha: x.fecha, veredicto: x.evaluacion ? TEXTO_VEREDICTO[x.evaluacion.veredicto] : undefined, porNombre: x.porNombre })),
  });

  const bajar = async (c: Consulta, variante: VarianteConstancia) => {
    if (!c.evaluacion) return;
    setHaciendo(variante); setError('');
    try {
      const d = datosDe(c, variante);
      const blob = await generarConstanciaPlacas(d);
      await descargarOCompartir(blob, nombreDeConstancia(d), 'Constancia de verificación');
    } catch (e: any) { setError(e?.message || 'No se pudo hacer la constancia.'); }
    finally { setHaciendo(''); }
  };

  /**
   * Guarda la constancia en los documentos del auto. Se llama sola al terminar
   * una consulta. Archivarla pide ser administrador o gerente, igual que ver
   * los documentos: si quien consultó solo maneja el inventario, el servidor
   * dice que no y aquí no se enseña ningún error — el resultado se ve igual y
   * la hoja se puede bajar con los botones.
   */
  const guardarEnElAuto = async (c: Consulta): Promise<Constancia> => {
    const d = datosDe(c, 'cliente');
    const nombre = nombreDeConstancia(d);
    const blob = await generarConstanciaPlacas(d);
    const token = await auth.currentUser?.getIdToken();
    const r = await fetch(getApiUrl(`/api/autos/${autoId}/placasinfo/${c.id}/constancia`), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/pdf', 'X-Nombre': encodeURIComponent(nombre) },
      body: blob,
    });
    if (!r.ok) throw new Error(`constancia ${r.status}`);
    return (await r.json()).constancia as Constancia;
  };

  if (!activo) return null;

  const consultar = async (forzar = false) => {
    if (!confirm(forzar
      ? `Este auto ya se consultó hace poco. ¿Consultarlo otra vez? ${saldo !== null ? `Se descuenta 1 de tus ${saldo} consultas.` : 'Se usa un crédito de PlacasInfo.'}`
      : `Se consultará REPUVE, Fiscalías, aseguradoras, avisos ministeriales y robo en EE. UU./Canadá. ${saldo !== null ? `Se descuenta 1 de tus ${saldo} consultas.` : 'Se usa un crédito de PlacasInfo.'} ¿Continuar?`)) return;
    setEnviando(true); setError('');
    try {
      const d = await api(`/api/autos/${autoId}/placasinfo`, { method: 'POST', body: JSON.stringify({ forzar }) });
      setConsultas((c) => [d.consulta, ...c.filter((x) => x.id !== d.consulta.id)]);
      if (saldo !== null && !d.repetida) setSaldo(Math.max(0, saldo - 1));
    } catch (e: any) { setError(e.message); }
    finally { setEnviando(false); }
  };

  const ev = ultima?.estado === 'lista' ? ultima.evaluacion : undefined;
  const est = ev ? ESTILO[ev.veredicto] : null;
  const reciente = ultima && Date.now() - Date.parse(ultima.fecha) < 24 * 3600 * 1000 && ultima.estado === 'lista' && ev?.veredicto !== 'incompleto';
  const ficha = ev?.ficha;
  const fichaNoCoincide = ficha && ((ficha.marca && auto.make && !ficha.marca.toUpperCase().includes(String(auto.make).toUpperCase().slice(0, 4)) && !String(auto.make).toUpperCase().includes(ficha.marca.toUpperCase().slice(0, 4)))
    || (ficha.anio && auto.year && String(ficha.anio) !== String(auto.year)));

  return (
    <div className="rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50/40 dark:bg-blue-950/20 p-3 flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5"><Radar className="w-4 h-4 text-blue-700" /> Consulta automática</p>
        <span className="text-[11px] text-slate-500">PlacasInfo · 6 fuentes</span>
      </div>

      {ultima?.estado === 'procesando' && (
        <p className="text-sm font-semibold text-blue-900 dark:text-blue-200 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Consultando {ultima.consultado}… suele tardar de 5 a 20 segundos.</p>
      )}
      {ultima?.estado === 'error' && (
        <p className="text-sm font-semibold text-red-700 dark:text-red-400 flex items-center gap-1.5"><WifiOff className="w-4 h-4" /> {ultima.error || 'La consulta falló.'}</p>
      )}

      {ev && est && (
        <div className={clsx('rounded-lg border px-3 py-2.5 flex items-start gap-2.5', est.caja)}>
          <est.Icono className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="text-sm min-w-0 flex flex-col gap-1">
            <p className="font-extrabold">{TEXTO_VEREDICTO[ev.veredicto]}</p>
            {ev.alertas.map((a, i) => <p key={`a${i}`} className="text-xs font-bold flex gap-1.5"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />{a}</p>)}
            {ev.historial.map((a, i) => <p key={`h${i}`} className="text-xs">• {a}</p>)}
            {ev.fuentesCaidas.length > 0 && (
              <p className="text-xs opacity-90">
                No respondió: {ev.fuentesCaidas.map((f) => NOMBRE_FUENTE[f] || f).join(', ')}.
                {ev.veredicto === 'incompleto' ? ' No es un resultado limpio: repite la consulta.' : ' (Es una fuente complementaria que falla seguido; no detiene la operación.)'}
              </p>
            )}
            {ficha && (
              <p className="text-xs opacity-90">REPUVE: {[ficha.marca, ficha.modelo, ficha.anio].filter(Boolean).join(' ')}{ficha.entidad ? ` · emplacado en ${ficha.entidad}` : ''}{ficha.placa ? ` · placas ${ficha.placa}` : ''}</p>
            )}
            {fichaNoCoincide && <p className="text-xs font-bold">Ojo: la ficha del REPUVE no coincide con la marca o el año capturados. Revisa el NIV.</p>}
            <p className="text-[11px] opacity-80">{ultima!.consultado} · {fechaHora(ultima!.fecha)} · {ultima!.porNombre}</p>
          </div>
        </div>
      )}

      {ev && ultima && (
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!!haciendo}
              onClick={() => bajar(ultima, 'cliente')}
              className="min-h-[36px] px-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5"
            >
              {haciendo === 'cliente' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileCheck2 className="w-3.5 h-3.5" />}
              Constancia para el cliente
            </button>
            <button
              type="button"
              disabled={!!haciendo}
              onClick={() => bajar(ultima, 'interna')}
              className="min-h-[36px] px-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5"
            >
              {haciendo === 'interna' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
              Hoja para el expediente
            </button>
          </div>
          <p className="text-[11px] text-slate-500">
            {ultima.constancia
              ? `Guardada en los documentos del auto como «${ultima.constancia.nombre || folioDeConstancia(ultima.id)}», en Verificación.`
              : 'Al terminar la consulta, la constancia se guarda sola en los documentos del auto (la archiva un administrador o gerente).'}
          </p>
        </div>
      )}

      {puedeConsultar && (
        <button
          type="button"
          disabled={enviando || ultima?.estado === 'procesando'}
          onClick={() => consultar(!!reciente)}
          className="min-h-[40px] px-4 rounded-lg bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-sm font-bold flex items-center justify-center gap-1.5"
        >
          {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radar className="w-4 h-4" />}
          {ultima ? 'Consultar de nuevo' : 'Consultar ahora'}
        </button>
      )}
      {error && <p className="text-xs font-semibold text-red-700 dark:text-red-400">{error}{/Facturaci/.test(error) && <> <Link to="/billing" className="underline">Ir a Facturación</Link></>}</p>}
      {saldo !== null && <p className="text-[11px] text-slate-500">{saldo === 0 ? 'Ya no te quedan consultas.' : `Te ${saldo === 1 ? 'queda 1 consulta' : `quedan ${saldo} consultas`}.`} <Link to="/billing" className="underline">Comprar más</Link></p>}

      {consultas.length > 1 && (
        <details className="text-xs text-slate-600 dark:text-slate-400">
          <summary className="cursor-pointer font-semibold">Consultas anteriores ({consultas.length - 1})</summary>
          <ul className="mt-1.5 flex flex-col gap-1">
            {consultas.slice(1).map((c) => (
              <li key={c.id} className="flex flex-wrap items-baseline gap-x-1.5">
                <span>{fechaHora(c.fecha)} · <b>{c.evaluacion ? TEXTO_VEREDICTO[c.evaluacion.veredicto] : c.estado === 'error' ? 'Falló' : 'En proceso'}</b> · {c.porNombre}</span>
                {c.evaluacion && (
                  <button type="button" disabled={!!haciendo} onClick={() => bajar(c, 'cliente')} className="font-bold text-blue-700 dark:text-blue-400 hover:underline disabled:opacity-50">
                    constancia
                  </button>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
