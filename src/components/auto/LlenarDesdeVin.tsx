import React, { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { AlertTriangle, CheckCircle2, Loader2, Radar, ShieldAlert, ShieldCheck, ShieldQuestion, History } from 'lucide-react';
import { auth } from '../../lib/firebase';
import { getApiUrl } from '../../lib/api';
import { revisarNiv } from '../../lib/niv';
import { TEXTO_VEREDICTO, type EvaluacionPlacas, type VeredictoPlacas } from '../../lib/placasInfo';

/**
 * Alta de un auto desde el VIN: una consulta a PlacasInfo trae la ficha del
 * REPUVE (marca, modelo, año, motor, placas…) y, de paso, revisa si tiene
 * reporte de robo antes de comprarlo. Al guardar el auto, la consulta queda
 * en su ficha; no se vuelve a cobrar.
 */

async function api(ruta: string, init: RequestInit = {}) {
  const token = await auth.currentUser?.getIdToken();
  const r = await fetch(getApiUrl(ruta), { ...init, headers: { ...(init.headers || {}), Authorization: `Bearer ${token}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}) } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.error || `Error ${r.status}`);
  return d;
}

export const NOMBRE_CAMPO: Record<string, string> = {
  make: 'Marca', model: 'Modelo', year: 'Año', liters: 'Motor', cylinders: 'Cilindros', transmission: 'Transmisión',
  bodyType: 'Carrocería', licensePlate: 'Placas', platesState: 'Estado de placas',
};

const ICONO: Record<VeredictoPlacas, any> = { vigente: ShieldAlert, antecedente: History, limpio: ShieldCheck, incompleto: ShieldQuestion };
const CAJA: Record<VeredictoPlacas, string> = {
  vigente: 'bg-red-50 border-red-300 text-red-900 dark:bg-red-950/40 dark:border-red-800 dark:text-red-200',
  antecedente: 'bg-amber-50 border-amber-300 text-amber-900 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-200',
  limpio: 'bg-emerald-50 border-emerald-300 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200',
  incompleto: 'bg-slate-50 border-slate-300 text-slate-900 dark:bg-slate-900/50 dark:border-slate-600 dark:text-slate-200',
};

export function LlenarDesdeVin({ vin, onVin, anio, onDatos, onConsulta, campoClase }: {
  vin: string;
  onVin: (v: string) => void;
  anio?: number;
  /** Devuelve los nombres de los campos que sí se llenaron (los que el usuario no había tocado). */
  onDatos: (datos: Record<string, string>) => string[];
  onConsulta: (id: string) => void;
  campoClase: string;
}) {
  const [activo, setActivo] = useState(false);
  const [estado, setEstado] = useState<'' | 'enviando' | 'esperando'>('');
  const [error, setError] = useState('');
  const [ev, setEv] = useState<EvaluacionPlacas | null>(null);
  const [llenados, setLlenados] = useState<string[]>([]);
  const [creditos, setCreditos] = useState<number | null>(null);
  const vivo = useRef(true);
  const rev = revisarNiv(vin, anio);
  const listo = vin.replace(/[^A-Za-z0-9]/g, '').length === 17;

  useEffect(() => {
    vivo.current = true;
    api('/api/placasinfo/disponible').then((d) => { if (vivo.current) setActivo(!!d.activo); }).catch(() => {});
    return () => { vivo.current = false; };
  }, []);

  const terminar = (d: any) => {
    const c = d.consulta;
    if (typeof c?.creditos === 'number') setCreditos(c.creditos);
    if (c?.estado === 'error') { setError(c.error || 'La consulta falló.'); setEstado(''); return true; }
    if (c?.estado !== 'lista') return false;
    setEv(c.evaluacion || null);
    setLlenados(onDatos(d.alta || {}));
    setEstado('');
    return true;
  };

  const consultar = async () => {
    if (!confirm('Se consultará el VIN en PlacasInfo: llena los datos del auto y revisa si tiene reporte de robo. Se usa un crédito. ¿Continuar?')) return;
    setEstado('enviando'); setError(''); setEv(null); setLlenados([]);
    try {
      const d = await api('/api/placasinfo/vin', { method: 'POST', body: JSON.stringify({ vin }) });
      onConsulta(d.consulta.id);
      if (terminar(d)) return;
      setEstado('esperando');
      const inicio = Date.now();
      while (vivo.current && Date.now() - inicio < 3 * 60 * 1000) {
        await new Promise((r) => setTimeout(r, 3000));
        const r = await api(`/api/placasinfo/consulta/${d.consulta.id}`).catch(() => null);
        if (r && terminar(r)) return;
      }
      if (vivo.current) { setError('PlacasInfo está tardando. Guarda el auto: el resultado aparecerá en su ficha cuando llegue.'); setEstado(''); }
    } catch (e: any) { setError(e.message); setEstado(''); }
  };

  const Icono = ev ? ICONO[ev.veredicto] : null;

  return (
    <div className="rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20 p-3 flex flex-col gap-2">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
        <label className="flex-1 flex flex-col gap-1 text-xs font-bold text-slate-700 dark:text-slate-300">
          <span>VIN {activo && <span className="font-semibold text-slate-500">· escríbelo primero y llenamos lo demás</span>}</span>
          <input value={vin} onChange={(e) => onVin(e.target.value)} maxLength={20} className={clsx(campoClase, 'uppercase font-mono tracking-wider')} placeholder="17 caracteres" />
        </label>
        {activo && (
          <button
            type="button"
            onClick={consultar}
            disabled={!listo || !!estado}
            className="min-h-[38px] px-4 rounded-lg bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-sm font-bold flex items-center justify-center gap-1.5 shrink-0"
          >
            {estado ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radar className="w-4 h-4" />}
            {estado === 'esperando' ? 'Consultando…' : 'Llenar con el VIN'}
          </button>
        )}
      </div>

      {vin && !listo && <p className="text-[11px] text-slate-500">Lleva {vin.replace(/[^A-Za-z0-9]/g, '').length} de 17 caracteres.</p>}
      {listo && rev.avisos.filter((a) => a.tipo !== 'info').map((a, i) => (
        <p key={i} className={clsx('text-xs flex items-start gap-1.5 font-semibold', a.tipo === 'error' ? 'text-red-700 dark:text-red-400' : 'text-amber-800 dark:text-amber-300')}><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" /> {a.texto}</p>
      ))}
      {estado === 'esperando' && <p className="text-xs text-blue-900 dark:text-blue-200">Revisando REPUVE, Fiscalías y aseguradoras… suele tardar de 5 a 20 segundos.</p>}
      {error && <p className="text-xs font-semibold text-red-700 dark:text-red-400">{error}</p>}

      {ev && Icono && (
        <div className={clsx('rounded-lg border px-3 py-2 flex items-start gap-2', CAJA[ev.veredicto])}>
          <Icono className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="text-sm min-w-0 flex flex-col gap-0.5">
            <p className="font-extrabold">{ev.veredicto === 'vigente' ? 'Reporte de robo vigente: no lo compres' : TEXTO_VEREDICTO[ev.veredicto]}</p>
            {ev.alertas.map((a, i) => <p key={i} className="text-xs font-bold">{a}</p>)}
            {ev.historial.map((a, i) => <p key={i} className="text-xs">• {a}</p>)}
            {ev.veredicto === 'incompleto' && <p className="text-xs">Al guardar, vuelve a consultar desde la ficha del auto antes de cerrar la compra.</p>}
          </div>
        </div>
      )}
      {ev && (
        <p className="text-xs text-slate-700 dark:text-slate-300 flex items-start gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-px text-emerald-600" />
          {llenados.length
            ? <span>Llenamos: <b>{llenados.map((k) => NOMBRE_CAMPO[k] || k).join(', ')}</b>. Revísalos y agrega la versión en «Modelo y versión».</span>
            : <span>No llenamos nada: esos datos ya los habías escrito, o el REPUVE no los trae.</span>}
        </p>
      )}
      {creditos !== null && <p className="text-[11px] text-slate-500">Quedan {creditos} créditos en PlacasInfo.</p>}
    </div>
  );
}
