import { Link } from 'react-router';
import { Check, Lock, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { INCLUYE_PREMIUM, tienePremium } from '../lib/planes';
import { PRECIO_PREMIUM_POR_USUARIO } from '../lib/subscription';
import { Cotizador } from './Cotizador';

/**
 * Lo que ve una agencia con plan Básico al tocar algo del plan Premium: qué incluye y cómo pasarse. Nunca un botón muerto.
 * El candado de verdad está en el servidor; esto solo lo explica.
 */

export function usePremium() {
  const { agencyData } = useAuth();
  return tienePremium(agencyData);
}

const pesos = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

function Contenido({ titulo }: { titulo: string }) {
  const { userData } = useAuth();
  const esAdmin = userData?.role === 'admin';
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <span className="w-11 h-11 rounded-2xl bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0"><Lock className="w-5 h-5" /></span>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber-700 dark:text-amber-300">Plan Premium</p>
          <h2 className="text-lg font-extrabold text-slate-900 dark:text-white leading-tight">{titulo}</h2>
        </div>
      </div>
      <ul className="space-y-2">
        {INCLUYE_PREMIUM.map((t) => (
          <li key={t} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300"><Check className="w-4 h-4 mt-0.5 text-emerald-600 shrink-0" /> {t}</li>
        ))}
      </ul>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        {pesos(PRECIO_PREMIUM_POR_USUARIO)} al mes por usuario.{' '}
        {esAdmin ? 'Puedes cambiarte en cualquier momento; Stripe cobra solo la diferencia del mes.' : 'Pídele al administrador de tu agencia que lo active en Facturación.'}
      </p>
      {esAdmin && <Link to="/billing" className="inline-flex h-11 items-center px-5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold">Ver planes y cambiar a Premium</Link>}
    </div>
  );
}

/** Pantalla completa, en lugar de una pantalla Premium. */
export function AvisoPremium({ titulo }: { titulo: string }) {
  return (
    <div className="h-full overflow-y-auto bg-[#f4f5f5] dark:bg-slate-900">
      <div className="max-w-xl mx-auto p-4 md:p-8">
        <div className="rounded-3xl bg-white dark:bg-slate-800 shadow-sm ring-1 ring-slate-200/70 dark:ring-slate-700 p-6"><Contenido titulo={titulo} /></div>
      </div>
    </div>
  );
}

/** Ventana, en lugar de una ventana Premium. */
export function AvisoPremiumVentana({ titulo, onCerrar }: { titulo: string; onCerrar: () => void }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center bg-black/50 md:p-4" onClick={onCerrar}>
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl md:rounded-3xl p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] relative" onClick={(e) => e.stopPropagation()}>
        <button onClick={onCerrar} aria-label="Cerrar" className="absolute top-4 right-4 h-9 w-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center"><X className="w-5 h-5 text-slate-500" /></button>
        <Contenido titulo={titulo} />
      </div>
    </div>
  );
}

/** El cotizador de financiamiento solo se abre con Premium; si no, explica qué es el plan. */
export function CotizadorConPlan(props: React.ComponentProps<typeof Cotizador>) {
  const premium = usePremium();
  if (!premium) return <AvisoPremiumVentana titulo="El cotizador de financiamiento es del plan Premium" onCerrar={props.onCerrar} />;
  return <Cotizador {...props} />;
}
