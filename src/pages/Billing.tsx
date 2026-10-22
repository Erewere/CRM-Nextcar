import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { CreditCard, Check, AlertCircle, Users, Bot, Zap } from 'lucide-react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Agency } from '../types';
import { getApiUrl } from '../lib/api';
import { PRECIO_POR_USUARIO, PRECIO_PREMIUM_POR_USUARIO } from '../lib/subscription';
import { INCLUYE_PREMIUM, NOMBRE_PLAN, planDeAgencia, type Plan } from '../lib/planes';

export function Billing() {
  const { userData } = useAuth();
  const [loading, setLoading] = useState(false);
  const [loadingCredits, setLoadingCredits] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [userCount, setUserCount] = useState(0);
  const [agency, setAgency] = useState<Agency | null>(null);
  
  const PRICE_PER_USER = PRECIO_POR_USUARIO;

  useEffect(() => {
    // Clean up any legacy localStorage override
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('custom_api_url');
    }

    const queryParams = new URLSearchParams(window.location.search);
    if (queryParams.get("success")) {
      setSuccess("¡Suscripción o compra completada con éxito!");
    }
    if (queryParams.get("canceled")) {
      setError("El proceso de pago fue cancelado.");
    }

    const fetchData = async () => {
      if (!userData?.agencyId) return;
      try {
        const q = query(
          collection(db, 'users'),
          where('agencyId', '==', userData.agencyId)
        );
        const querySnapshot = await getDocs(q);
        setUserCount(querySnapshot.size);
        
        const agencyRef = doc(db, 'agencies', userData.agencyId);
        const agencySnap = await getDoc(agencyRef);
        if (agencySnap.exists()) {
          setAgency({ ...agencySnap.data(), id: agencySnap.id } as Agency);
        }
      } catch (err) {
        console.error("Error fetching data", err);
      }
    };

    fetchData();
  }, [userData?.agencyId]);

  const handleSubscribe = async (plan: Plan) => {
    if (!userData?.agencyId) {
      setError('No se encontró el ID de la agencia.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const priceId = import.meta.env.VITE_STRIPE_PRICE_ID || 'price_...';
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        throw new Error('No hay una sesión activa de usuario. Por favor, vuelve a iniciar sesión.');
      }
      
      const response = await fetch(getApiUrl('/api/create-checkout-session'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          agencyId: userData.agencyId,
          priceId,
          plan,
          quantity: userCount || 1,
          mode: 'subscription'
        }),
      });

      let data: any = {};
      const contentType = response.headers.get("content-type") || "";

      if (contentType.includes("application/json")) {
        data = await response.json();
      } else {
        throw new Error('No se pudo establecer comunicación con el servidor de pagos. Por favor, intenta más tarde.');
      }
      
      if (!response.ok || data.error) {
        throw new Error(data.error || `Error (${response.status}) procesando la suscripción.`);
      }

      if (data.url) {
        if (window !== window.top) {
          window.open(data.url, '_blank');
        } else {
          window.location.href = data.url;
        }
      }
    } catch (err: any) {
      if (err.message === 'Failed to fetch' || err.name === 'TypeError') {
        setError('No se pudo conectar con el servidor de pagos. Por favor, intenta de nuevo.');
      } else {
        setError(err.message || 'Error procesando la suscripción.');
      }
    } finally {
      setLoading(false);
    }
  };


  const handleCambiarPlan = async (destino: Plan) => {
    const precio = destino === 'premium' ? PRECIO_PREMIUM_POR_USUARIO : PRECIO_POR_USUARIO;
    const aviso = destino === 'premium'
      ? `Te cambiarás a Premium: ${new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(precio)} por usuario al mes. Stripe cobra ahora solo la diferencia de lo que falta del mes. ¿Continuar?`
      : `Volverás al plan Básico (${new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(precio)} por usuario al mes). Dejarás de tener cotizar autos, la revisión de precios y el cotizador de financiamiento. ¿Continuar?`;
    if (!window.confirm(aviso)) return;
    setLoading(true); setError(''); setSuccess('');
    try {
      const token = await auth.currentUser?.getIdToken();
      const r = await fetch(getApiUrl('/api/cambiar-plan'), { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ plan: destino }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'No se pudo cambiar de plan.');
      setAgency((a) => (a ? ({ ...a, plan: destino } as Agency) : a));
      setSuccess(`Listo: tu agencia está en el plan ${NOMBRE_PLAN[destino]}. Recarga la aplicación para ver el cambio en todas las pantallas.`);
    } catch (e: any) {
      setError(e.message || 'No se pudo cambiar de plan.');
    } finally {
      setLoading(false);
    }
  };

  const isInactive = agency && !agency.hasFreeAccess && agency.subscriptionStatus !== 'active';

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {isInactive && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-400 rounded flex items-start gap-3 border border-amber-200 dark:border-amber-900/50 shadow-sm animate-pulse">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-600 dark:text-amber-500" />
          <div>
            <p className="font-semibold text-sm">Suscripción Inactiva o Periodo de Prueba Vencido</p>
            <p className="text-xs mt-1 leading-relaxed text-amber-700 dark:text-amber-500/90">
              La suscripción de tu agencia se encuentra suspendida o inactiva. Por favor, elige un plan y suscríbete a continuación para restablecer de forma inmediata el acceso completo para todos los usuarios de la agencia.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded flex items-start gap-2 border border-red-100 dark:border-red-900/50">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded flex items-start gap-2 border border-green-100 dark:border-green-900/50">
          <Check className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p className="text-sm">{success}</p>
        </div>
      )}

      {/* Planes */}
      {agency?.hasFreeAccess ? (
        <div className="bg-white dark:bg-slate-800 rounded border border-gray-200 dark:border-slate-700 p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">Acceso de cortesía</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Tu agencia tiene acceso gratuito e incluye todo lo del plan Premium. No necesitas suscribirte.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {(['basico', 'premium'] as Plan[]).map((p) => {
            const precio = p === 'premium' ? PRECIO_PREMIUM_POR_USUARIO : PRICE_PER_USER;
            const activa = agency?.subscriptionStatus === 'active';
            const actual = planDeAgencia(agency) === p && activa;
            const dinero = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);
            return (
              <div key={p} className={`bg-white dark:bg-slate-800 rounded-xl border p-6 shadow-sm flex flex-col ${p === 'premium' ? 'border-amber-300 dark:border-amber-700 ring-1 ring-amber-200 dark:ring-amber-900/40' : 'border-gray-200 dark:border-slate-700'}`}>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">Plan {NOMBRE_PLAN[p]}</h2>
                  {actual && <span className="text-[11px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">Tu plan</span>}
                  {!activa && agency?.subscriptionStatus === 'trialing' && p === 'premium' && <span className="text-[11px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">En tu prueba</span>}
                </div>
                <p className="text-3xl font-extrabold text-slate-900 dark:text-white">{dinero(precio)} <span className="text-sm font-medium text-slate-500">por usuario al mes</span></p>
                <p className="text-xs text-slate-500 mb-4">{userCount} {userCount === 1 ? 'usuario' : 'usuarios'} · {dinero(precio * userCount)} al mes</p>
                <ul className="flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-300 mb-5 flex-1">
                  <li className="flex items-start gap-2"><Check className="w-4 h-4 mt-0.5 text-blue-500 shrink-0" /> {p === 'basico' ? 'El CRM completo: inventario, embudo, tareas, chats y pagos' : 'Todo lo del plan Básico'}</li>
                  {p === 'premium' && INCLUYE_PREMIUM.map((t) => <li key={t} className="flex items-start gap-2"><Check className="w-4 h-4 mt-0.5 text-amber-500 shrink-0" /> {t}</li>)}
                </ul>
                {actual ? (
                  <p className="text-sm text-slate-500">Es el plan que tienes ahora.</p>
                ) : activa ? (
                  <button onClick={() => handleCambiarPlan(p)} disabled={loading} className="h-11 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50">
                    {p === 'premium' ? 'Cambiar a Premium' : 'Volver a Básico'}
                  </button>
                ) : (
                  <button onClick={() => handleSubscribe(p)} disabled={loading} className={`h-11 rounded-lg text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-50 ${p === 'premium' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                    {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><CreditCard className="w-4 h-4" /> Suscribirme a {NOMBRE_PLAN[p]}</>}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
