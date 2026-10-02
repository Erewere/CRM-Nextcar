import React, { useState } from 'react';

/**
 * Con qué app se abren los mensajes que el vendedor manda desde su propio
 * WhatsApp (cotización, compartir auto, interesados). Muchos vendedores
 * tienen WhatsApp y WhatsApp Business en el mismo teléfono, y la liga normal
 * (wa.me) siempre abre el primero. Se guarda en cada aparato: el teléfono y
 * la computadora pueden tener su propia preferencia.
 *
 * - Android: se puede abrir la app exacta (intent con el paquete de cada una).
 * - iPhone: Apple no deja elegir la app desde una liga; con «Business» se abre
 *   el menú de compartir del teléfono, donde aparece WhatsApp Business (ahí
 *   se elige el contacto).
 * - Computadora: «WhatsApp Web» abre web.whatsapp.com, donde puede estar
 *   abierta la cuenta Business.
 */

export type AppWhatsApp = 'whatsapp' | 'business' | 'web';
const CLAVE = 'nc.whatsapp.app';

export function appPreferida(): AppWhatsApp {
  try {
    const v = localStorage.getItem(CLAVE);
    if (v === 'business' || v === 'web' || v === 'whatsapp') return v;
  } catch { /* sin almacenamiento: la normal */ }
  return 'whatsapp';
}

function guardarApp(v: AppWhatsApp) {
  try { localStorage.setItem(CLAVE, v); } catch { /* nada */ }
}

const esAndroid = () => /Android/i.test(navigator.userAgent);
const esIphone = () => /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));

/** Número para WhatsApp: solo dígitos y con 52 si viene de 10. */
export function numeroParaWhatsApp(tel?: string) {
  const n = String(tel || '').replace(/\D/g, '');
  if (!n) return '';
  return n.length === 10 ? `52${n}` : n;
}

/** Abre el chat con el mensaje escrito, en la app que eligió el vendedor. */
export function abrirWhatsApp(tel: string | undefined, texto: string) {
  const num = numeroParaWhatsApp(tel);
  const app = appPreferida();
  const t = encodeURIComponent(texto);

  if (app === 'web') {
    window.open(`https://web.whatsapp.com/send?${num ? `phone=${num}&` : ''}text=${t}`, '_blank');
    return;
  }
  if (esAndroid()) {
    const paquete = app === 'business' ? 'com.whatsapp.w4b' : 'com.whatsapp';
    const respaldo = encodeURIComponent(`https://wa.me/${num}?text=${t}`);
    window.location.href = `intent://send/?${num ? `phone=${num}&` : ''}text=${t}#Intent;scheme=whatsapp;package=${paquete};S.browser_fallback_url=${respaldo};end`;
    return;
  }
  if (app === 'business' && esIphone() && navigator.share) {
    navigator.share({ text: texto }).catch(() => { /* lo cerraron */ });
    return;
  }
  window.open(`https://wa.me/${num}?text=${t}`, '_blank');
}

/** Selector chico «Abrir con…», para poner junto a los botones de WhatsApp. */
export function SelectorWhatsApp({ className = '' }: { className?: string }) {
  const [app, setApp] = useState<AppWhatsApp>(appPreferida());
  return (
    <label className={`flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 ${className}`}>
      Abrir con
      <select
        value={app}
        onChange={(e) => { const v = e.target.value as AppWhatsApp; setApp(v); guardarApp(v); }}
        className="px-1.5 py-1 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-200"
      >
        <option value="whatsapp">WhatsApp</option>
        <option value="business">WhatsApp Business</option>
        <option value="web">WhatsApp Web</option>
      </select>
    </label>
  );
}

/** Para ligas wa.me ya armadas: al hacer clic, abrir en la app preferida. */
export function alClicWhatsApp(e: React.MouseEvent<HTMLAnchorElement>) {
  try {
    const u = new URL(e.currentTarget.href);
    if (u.hostname !== 'wa.me') return;
    e.preventDefault();
    abrirWhatsApp(u.pathname.replace(/\//g, ''), u.searchParams.get('text') || '');
  } catch { /* se deja la liga normal */ }
}
