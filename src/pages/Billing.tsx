import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { CreditCard, Check, AlertCircle, Users, Bot, Zap } from 'lucide-react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Agency } from '../types';
import { getApiUrl } from '../lib/api';
import { PRECIO_POR_USUARIO } from '../lib/subscription';

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

  const handleSubscribe = async () => {
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


  const isInactive = agency && !agency.hasFreeAccess && agency.subscriptionStatus !== 'active';

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {isInactive && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-400 rounded flex items-start gap-3 border border-amber-200 dark:border-amber-900/50 shadow-sm animate-pulse">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-600 dark:text-amber-500" />
          <div>
            <p className="font-semibold text-sm">Suscripción Inactiva o Periodo de Prueba Vencido</p>
            <p className="text-xs mt-1 leading-relaxed text-amber-700 dark:text-amber-500/90">
              La suscripción Pro de tu agencia se encuentra suspendida o inactiva. Por favor, haz clic en <strong>"Actualizar Suscripción"</strong> a continuación para restablecer de forma inmediata el acceso completo para todos los usuarios de la agencia.
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

      {/* Plan Base */}
      <div className="bg-white dark:bg-slate-800 rounded border border-gray-200 dark:border-slate-700 overflow-hidden shadow-sm">
        <div className="p-6 md:p-8 flex flex-col md:flex-row items-center gap-8">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Plan Pro - Mensual</h2>
            <p className="text-slate-500 dark:text-slate-400 mb-6">
              Acceso completo a todas las funciones del CRM para tu agencia, incluyendo gestión de inventario y embudos de ventas.
            </p>
            
            <div className="flex flex-col gap-3 mb-8 text-sm text-slate-600 dark:text-slate-300">
              <div className="flex items-center gap-2">
                <Check className="w-5 h-5 text-blue-500" />
                <span>Precio por cada usuario en tu agencia</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-5 h-5 text-blue-500" />
                <span>Inventario ilimitado de vehículos</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-5 h-5 text-blue-500" />
                <span>Leads ilimitados</span>
              </div>
            </div>

            <button
              onClick={handleSubscribe}
              disabled={loading}
              className="flex items-center justify-center gap-2 w-full md:w-auto px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition-colors disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <CreditCard className="w-5 h-5" />
                  Actualizar Suscripción
                </>
              )}
            </button>
          </div>

          <div className="w-full md:w-auto min-w-[280px] bg-[#f4f5f5] dark:bg-slate-900 p-6 md:p-8 rounded border border-gray-200 dark:border-slate-700 text-center">
            <div className="text-5xl font-extrabold text-slate-900 dark:text-white mb-2">
              {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(PRICE_PER_USER)}
            </div>
            <div className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-6 uppercase tracking-wider">
              MXN / usuario / mes
            </div>
            <div className="flex items-center justify-center gap-2 text-sm text-slate-700 dark:text-slate-300 font-medium bg-white dark:bg-slate-800 py-2 px-4 rounded shadow-sm border border-gray-200 dark:border-slate-700">
              <Users className="w-4 h-4 text-blue-500" />
              <span>{userCount} {userCount === 1 ? 'usuario actual' : 'usuarios actuales'}</span>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-slate-700 flex justify-between items-center font-bold text-slate-900 dark:text-white">
              <span>Total Estimado:</span>
              <span>{new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(PRICE_PER_USER * userCount)} / mes</span>
            </div>
          </div>
        </div>
      </div>


    </div>
  );
}
