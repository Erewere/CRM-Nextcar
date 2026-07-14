import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { CreditCard, Check, AlertCircle, Users, Bot, Zap } from 'lucide-react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Agency } from '../types';

export function Billing() {
  const { userData } = useAuth();
  const [loading, setLoading] = useState(false);
  const [loadingCredits, setLoadingCredits] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [userCount, setUserCount] = useState(0);
  const [agency, setAgency] = useState<Agency | null>(null);
  
  const PRICE_PER_USER = 9.99;

  useEffect(() => {
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
          setAgency({ id: agencySnap.id, ...agencySnap.data() } as Agency);
        }
      } catch (err) {
        console.error("Error fetching data", err);
      }
    };

    fetchData();
  }, [userData?.agencyId]);

  const handleSubscribe = async () => {
    if (!userData?.agencyId) {
      setError('No agency ID found.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const priceId = import.meta.env.VITE_STRIPE_PRICE_ID || 'price_...';
      const token = await auth.currentUser?.getIdToken();
      
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          agencyId: userData.agencyId,
          priceId,
          quantity: userCount || 1,
          mode: 'subscription'
        }),
      });

      const { url, error: apiError } = await response.json();
      
      if (apiError) throw new Error(apiError);
      if (url) {
        if (window !== window.top) {
          window.open(url, '_blank');
        } else {
          window.location.href = url;
        }
      }
    } catch (err: any) {
      setError(err.message || 'Error processing subscription.');
    } finally {
      setLoading(false);
    }
  };

  const handleBuyCredits = async (amount: number, priceId: string) => {
    if (!userData?.agencyId) {
      setError('No agency ID found.');
      return;
    }
    
    // As a simple demo, we will simulate purchasing by calling an internal API or 
    // just redirecting to a Checkout session for a one-time purchase.
    setLoadingCredits(true);
    setError('');
    
    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          agencyId: userData.agencyId,
          priceId: priceId, // e.g. price_123_100_credits
          quantity: 1,
          mode: 'payment',
          metadata: {
            creditsToAdd: amount
          }
        }),
      });

      const { url, error: apiError } = await response.json();
      
      if (apiError) throw new Error(apiError);
      if (url) {
        if (window !== window.top) {
          window.open(url, '_blank');
        } else {
          window.location.href = url;
        }
      }
    } catch (err: any) {
      setError(err.message || 'Error processing purchase.');
    } finally {
      setLoadingCredits(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg flex items-start gap-2 border border-red-100 dark:border-red-900/50">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-lg flex items-start gap-2 border border-green-100 dark:border-green-900/50">
          <Check className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p className="text-sm">{success}</p>
        </div>
      )}

      {/* Plan Base */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 overflow-hidden shadow-sm">
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
              className="flex items-center justify-center gap-2 w-full md:w-auto px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
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

          <div className="w-full md:w-auto min-w-[280px] bg-slate-50 dark:bg-slate-900 p-6 md:p-8 rounded-xl border border-slate-100 dark:border-slate-700 text-center">
            <div className="text-5xl font-extrabold text-slate-900 dark:text-white mb-2">
              ${PRICE_PER_USER}
            </div>
            <div className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-6 uppercase tracking-wider">
              USD / usuario / mes
            </div>
            <div className="flex items-center justify-center gap-2 text-sm text-slate-700 dark:text-slate-300 font-medium bg-white dark:bg-slate-800 py-2 px-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
              <Users className="w-4 h-4 text-blue-500" />
              <span>{userCount} {userCount === 1 ? 'usuario actual' : 'usuarios actuales'}</span>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center font-bold text-slate-900 dark:text-white">
              <span>Total Estimado:</span>
              <span>${(PRICE_PER_USER * userCount).toFixed(2)} USD / mes</span>
            </div>
          </div>
        </div>
      </div>

      {/* AI Credits System */}
      <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-purple-900 rounded-2xl border border-indigo-500/30 overflow-hidden shadow-lg relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 blur-3xl rounded-full -translate-x-1/2 translate-y-1/2" />
        
        <div className="p-6 md:p-8 relative z-10 flex flex-col md:flex-row gap-8">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-indigo-500/20 rounded-lg border border-indigo-500/30 shadow-inner">
                <Bot className="w-6 h-6 text-indigo-300" />
              </div>
              <h2 className="text-2xl font-bold text-white tracking-wide">IA Erewere (SaaS)</h2>
            </div>
            <p className="text-indigo-200/80 mb-6">
              Potencia tus ventas con nuestro asesor de inteligencia artificial. Los créditos se descuentan por cada recomendación o análisis generado. Los créditos se comparten con toda la agencia.
            </p>
            
            <div className="inline-flex flex-col items-start bg-black/20 border border-white/10 rounded-xl p-4 mb-8">
              <span className="text-xs font-semibold text-indigo-300 uppercase tracking-widest mb-1">Saldo Actual</span>
              <div className="flex items-end gap-2">
                <span className="text-4xl font-extrabold text-white">{agency?.aiCredits || 0}</span>
                <span className="text-indigo-200 mb-1 font-medium">créditos</span>
              </div>
            </div>
          </div>

          <div className="w-full md:w-[320px] flex flex-col gap-4">
            <div className="bg-white/5 border border-white/10 p-5 rounded-xl hover:bg-white/10 transition-colors">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-white font-bold text-lg">Pack Básico</h3>
                  <p className="text-indigo-200/70 text-sm">100 créditos</p>
                </div>
                <div className="text-xl font-bold text-white">$5 USD</div>
              </div>
              <button
                onClick={() => handleBuyCredits(100, import.meta.env.VITE_STRIPE_PRICE_AI_BASIC || 'price_ai_basic')}
                disabled={loadingCredits}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors text-sm flex items-center justify-center gap-2"
              >
                <Zap className="w-4 h-4" /> Comprar
              </button>
            </div>
            
            <div className="bg-indigo-500/20 border border-indigo-400/30 p-5 rounded-xl hover:bg-indigo-500/30 transition-colors relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-indigo-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-bl-lg uppercase tracking-wider">
                Popular
              </div>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-white font-bold text-lg">Pack Pro</h3>
                  <p className="text-indigo-200/70 text-sm">500 créditos</p>
                </div>
                <div className="text-xl font-bold text-white">$20 USD</div>
              </div>
              <button
                onClick={() => handleBuyCredits(500, import.meta.env.VITE_STRIPE_PRICE_AI_PRO || 'price_ai_pro')}
                disabled={loadingCredits}
                className="w-full py-2 bg-indigo-500 hover:bg-indigo-400 text-white rounded-lg font-medium transition-colors text-sm flex items-center justify-center gap-2"
              >
                <Zap className="w-4 h-4" /> Comprar
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
