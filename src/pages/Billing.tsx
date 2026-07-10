import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { CreditCard, Check, AlertCircle, Users } from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

export function Billing() {
  const { userData } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [userCount, setUserCount] = useState(0);

  const PRICE_PER_USER = 9.99;

  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    if (queryParams.get("success")) {
      setSuccess("¡Suscripción completada con éxito!");
    }
    if (queryParams.get("canceled")) {
      setError("El proceso de pago fue cancelado.");
    }

    const fetchUserCount = async () => {
      if (!userData?.agencyId) return;
      try {
        const q = query(
          collection(db, 'users'),
          where('agencyId', '==', userData.agencyId)
        );
        const querySnapshot = await getDocs(q);
        setUserCount(querySnapshot.size);
      } catch (err) {
        console.error("Error fetching user count", err);
      }
    };

    fetchUserCount();
  }, [userData?.agencyId]);

  const handleSubscribe = async () => {
    if (!userData?.agencyId) {
      setError('No agency ID found.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      // In a real app, this priceId would probably come from an env var or database
      const priceId = import.meta.env.VITE_STRIPE_PRICE_ID || 'price_...';
      
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agencyId: userData.agencyId,
          priceId: priceId,
          quantity: Math.max(1, userCount)
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      if (data.url) {
        // En un iframe (como la vista previa), Stripe bloquea la navegación.
        // Se debe abrir en una nueva pestaña.
        window.open(data.url, '_blank');
        
        // Mostrar mensaje indicando que se abrió en otra pestaña
        setSuccess("Se ha abierto la pasarela de pago en una nueva pestaña. Si no la ves, revisa que tu navegador no esté bloqueando ventanas emergentes.");
      }

    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const totalMonthlyCost = (userCount * PRICE_PER_USER).toFixed(2);

  return (
    <div className="p-8 max-w-4xl mx-auto">

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 overflow-hidden shadow-sm">
        <div className="p-8 md:p-12 text-center md:text-left flex flex-col md:flex-row items-center gap-8">
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
              <div className="flex items-center gap-2">
                <Check className="w-5 h-5 text-blue-500" />
                <span>Prueba gratis por 30 días</span>
              </div>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <p className="text-sm">{error}</p>
              </div>
            )}

            {success && (
              <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-lg flex items-start gap-2">
                <Check className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <p className="text-sm">{success}</p>
              </div>
            )}

            <button
              onClick={handleSubscribe}
              disabled={loading}
              className="flex items-center justify-center gap-2 w-full md:w-auto px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <CreditCard className="w-5 h-5" />
              )}
              <span>{loading ? 'Procesando...' : 'Suscribirse Ahora'}</span>
            </button>
          </div>
          
          <div className="md:w-[350px] bg-slate-50 dark:bg-slate-900 p-8 rounded-xl border border-slate-100 dark:border-slate-800 text-center flex flex-col justify-center">
            <div className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">Desglose Mensual</div>
            
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400 mb-2 text-sm border-b border-slate-200 dark:border-slate-700 pb-2">
              <span className="flex items-center gap-1.5"><Users className="w-4 h-4"/> Usuarios ({userCount})</span>
              <span>{userCount} x ${PRICE_PER_USER}</span>
            </div>
            
            <div className="flex justify-between items-center text-slate-900 dark:text-white font-bold text-xl mt-4 mb-2">
              <span>Total a pagar</span>
              <span>${totalMonthlyCost}</span>
            </div>

            <div className="text-xs text-slate-400 dark:text-slate-500 mt-4">
              Facturado mensualmente según la cantidad de usuarios activos en la agencia.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
