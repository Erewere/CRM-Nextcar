import React, { useCallback, useEffect, useState } from 'react';
import { Bell, BellOff, Loader2, Share, SquarePlus } from 'lucide-react';
import { activarPush, desactivarPush, estadoPush, probarPush, type EstadoPush } from '../lib/push';

/**
 * «Avisos al celular»: activar o apagar los avisos en este dispositivo y mandarse uno de prueba.
 * Los avisos llegan cuando entra un prospecto nuevo o un cliente escribe por WhatsApp o Messenger.
 */
export function AvisosAlCelular() {
  const [e, setE] = useState<EstadoPush | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tono: 'ok' | 'error'; texto: string } | null>(null);

  const cargar = useCallback(() => estadoPush().then(setE).catch(() => {}), []);
  useEffect(() => { cargar(); }, [cargar]);

  const correr = async (f: () => Promise<string | void>) => {
    setTrabajando(true); setMensaje(null);
    try { const t = await f(); if (t) setMensaje({ tono: 'ok', texto: t }); }
    catch (err: any) { setMensaje({ tono: 'error', texto: err?.message || 'No se pudo completar.' }); }
    finally { setTrabajando(false); cargar(); }
  };

  if (!e) return null;
  return (
    <div className="mb-5 rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-left">
      <p className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
        {e.esteDispositivo ? <Bell className="w-4 h-4 text-emerald-600" /> : <BellOff className="w-4 h-4 text-slate-400" />}
        Avisos al celular
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Te avisamos cuando entra un prospecto nuevo o un cliente te escribe, aunque tengas el CRM cerrado. El aviso dice quién fue, nunca lo que escribió.</p>

      {!e.soportado && !e.necesitaGuardarla && <p className="text-xs text-amber-700 dark:text-amber-400 mt-2">Este navegador no recibe avisos.</p>}

      {e.necesitaGuardarla && (
        <div className="mt-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 text-xs text-amber-900 dark:text-amber-200 space-y-1.5">
          <p className="font-bold">En iPhone hay que guardar el CRM como app:</p>
          <p className="flex items-center gap-1.5">1. En Safari toca <Share className="w-3.5 h-3.5 inline" /> Compartir.</p>
          <p className="flex items-center gap-1.5">2. Elige <SquarePlus className="w-3.5 h-3.5 inline" /> «Agregar a pantalla de inicio».</p>
          <p>3. Abre «Nextcar CRM» desde esa pantalla de inicio, inicia sesión y vuelve aquí a activar los avisos.</p>
        </div>
      )}

      {e.soportado && !e.necesitaGuardarla && (
        <div className="mt-3 flex flex-wrap gap-2">
          {e.esteDispositivo ? (
            <>
              <button disabled={trabajando} onClick={() => correr(async () => { const r = await probarPush(); return r.entregados > 0 ? 'Aviso de prueba enviado. Debe llegarte en unos segundos.' : `No se pudo entregar la prueba${r.fallos[0]?.estado ? ` (error ${r.fallos[0].estado})` : ''}. Intenta apagar y volver a activar los avisos.`; })} className="h-9 px-3 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 flex items-center gap-2">
                {trabajando && <Loader2 className="w-4 h-4 animate-spin" />} Mandarme un aviso de prueba
              </button>
              <button disabled={trabajando} onClick={() => correr(async () => { await desactivarPush(); return 'Avisos apagados en este dispositivo.'; })} className="h-9 px-3 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50">Apagar</button>
            </>
          ) : (
            <button disabled={trabajando || e.permiso === 'denied'} onClick={() => correr(async () => { await activarPush(); return 'Avisos activados en este dispositivo.'; })} className="h-9 px-3 rounded-lg bg-slate-900 dark:bg-white dark:text-slate-900 text-white text-sm font-bold disabled:opacity-50 flex items-center gap-2">
              {trabajando && <Loader2 className="w-4 h-4 animate-spin" />} Activar avisos en este dispositivo
            </button>
          )}
        </div>
      )}
      {e.permiso === 'denied' && !e.esteDispositivo && <p className="text-xs text-amber-700 dark:text-amber-400 mt-2">Bloqueaste los avisos para el CRM. Cámbialo en Ajustes del teléfono → Notificaciones → Nextcar CRM.</p>}
      {e.dispositivos > 0 && <p className="text-[11px] text-slate-400 mt-2">{e.dispositivos} dispositivo{e.dispositivos === 1 ? '' : 's'} con avisos activos en tu cuenta.</p>}
      {mensaje && <p className={`text-xs mt-2 font-semibold ${mensaje.tono === 'ok' ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600'}`}>{mensaje.texto}</p>}
    </div>
  );
}
