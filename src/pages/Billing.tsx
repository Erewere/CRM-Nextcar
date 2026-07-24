import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { CreditCard, Check, AlertCircle, Users, Bot, Zap } from 'lucide-react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Agency } from '../types';
import { getApiUrl } from '../lib/api';

export function Billing() {
  const { userData } = useAuth();
  const [loading, setLoading] = useState(false);
  const [loadingCredits, setLoadingCredits] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [userCount, setUserCount] = useState(0);
  const [agency, setAgency] = useState<Agency | null>(null);
  const [apiUrlInput, setApiUrlInput] = useState(() => localStorage.getItem('custom_api_url') || '');
  const [showApiInput, setShowApiInput] = useState(false);
  
  const PRICE_PER_USER = 9.99;

  const handleSaveApiUrl = () => {
    if (apiUrlInput.trim()) {
      localStorage.setItem('custom_api_url', apiUrlInput.trim());
    } else {
      localStorage.removeItem('custom_api_url');
    }
    setError('');
    setSuccess('URL de Backend guardada. Vuelve a intentar el pago.');
    setShowApiInput(false);
  };

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
        const text = await response.text();
        if (text.trim().toLowerCase().startsWith("<!doctype") || text.trim().toLowerCase().startsWith("<html")) {
          throw new Error(
            "El servidor web devolvió HTML en lugar de conectar con el backend de pagos. " +
            "Si estás usando un dominio personalizado (como crm.erewere.com) o hosting estático (Vercel/Firebase/Nginx), " +
            "asegúrate de redirigir la ruta '/api/*' hacia el servidor backend Express o configurar la variable 'VITE_API_URL'."
          );
        }
        throw new Error(`Respuesta no esperada del servidor (${response.status}): ${text.substring(0, 100)}`);
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
        setError('No se pudo conectar con el servidor backend (Failed to fetch). Verifica que la URL del backend sea válida y use HTTPS.');
      } else {
        setError(err.message || 'Error procesando la suscripción.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBuyCredits = async (amount: number, priceId: string) => {
    if (!userData?.agencyId) {
      setError('No se encontró el ID de la agencia.');
      return;
    }
    
    setLoadingCredits(true);
    setError('');
    
    try {
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
          priceId: priceId,
          quantity: 1,
          mode: 'payment',
          metadata: {
            creditsToAdd: amount
          }
        }),
      });

      let data: any = {};
      const contentType = response.headers.get("content-type") || "";

      if (contentType.includes("application/json")) {
        data = await response.json();
      } else {
        const text = await response.text();
        if (text.trim().toLowerCase().startsWith("<!doctype") || text.trim().toLowerCase().startsWith("<html")) {
          throw new Error(
            "El servidor web devolvió HTML en lugar de conectar con el backend de pagos. " +
            "Si estás usando un dominio personalizado (como crm.erewere.com) o hosting estático (Vercel/Firebase/Nginx), " +
            "asegúrate de redirigir la ruta '/api/*' hacia el servidor backend Express o configurar la variable 'VITE_API_URL'."
          );
        }
        throw new Error(`Respuesta no esperada del servidor (${response.status}): ${text.substring(0, 100)}`);
      }
      
      if (!response.ok || data.error) {
        throw new Error(data.error || `Error (${response.status}) procesando la compra.`);
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
        setError('No se pudo conectar con el servidor backend (Failed to fetch). Verifica que la URL del backend sea válida y use HTTPS.');
      } else {
        setError(err.message || 'Error procesando la compra.');
      }
    } finally {
      setLoadingCredits(false);
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
        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded flex flex-col gap-3 border border-red-100 dark:border-red-900/50">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p className="text-sm font-medium">{error}</p>
          </div>

          <div className="mt-2 p-3 bg-white dark:bg-slate-800 rounded border border-red-200 dark:border-red-800/50 text-slate-800 dark:text-slate-200 text-xs flex flex-col gap-2">
            <p className="font-semibold text-slate-900 dark:text-white">
              Configuración de la URL del Servidor Backend
            </p>
            <p className="text-slate-600 dark:text-slate-400">
              Si tu sitio en <code className="bg-slate-100 dark:bg-slate-700 px-1 py-0.5 rounded">crm.erewere.com</code> no reenvía las peticiones <code className="bg-slate-100 dark:bg-slate-700 px-1 py-0.5 rounded">/api/*</code> a tu backend Express, ingresa aquí la URL directa de tu backend (debe iniciar con <strong>https://</strong>):
            </p>
            <div className="flex flex-col sm:flex-row gap-2 mt-1">
              <input
                type="text"
                placeholder="https://ais-dev-i4c3rqv55o5jzhkjgqnmiw-171595729037.us-west2.run.app"
                value={apiUrlInput}
                onChange={(e) => setApiUrlInput(e.target.value)}
                className="flex-1 px-3 py-1.5 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <button
                onClick={handleSaveApiUrl}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium text-xs transition-colors"
              >
                Guardar y Probar
              </button>
            </div>
            {apiUrlInput && (
              <button
                onClick={() => {
                  setApiUrlInput('');
                  localStorage.removeItem('custom_api_url');
                  setError('');
                  setSuccess('URL de Backend reseteada a ruta relativa (/api).');
                }}
                className="text-left text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1"
              >
                Limpiar y volver a la ruta relativa por defecto (/api)
              </button>
            )}
          </div>
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
              ${PRICE_PER_USER}
            </div>
            <div className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-6 uppercase tracking-wider">
              USD / usuario / mes
            </div>
            <div className="flex items-center justify-center gap-2 text-sm text-slate-700 dark:text-slate-300 font-medium bg-white dark:bg-slate-800 py-2 px-4 rounded shadow-sm border border-gray-200 dark:border-slate-700">
              <Users className="w-4 h-4 text-blue-500" />
              <span>{userCount} {userCount === 1 ? 'usuario actual' : 'usuarios actuales'}</span>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-slate-700 flex justify-between items-center font-bold text-slate-900 dark:text-white">
              <span>Total Estimado:</span>
              <span>${(PRICE_PER_USER * userCount).toFixed(2)} USD / mes</span>
            </div>
          </div>
        </div>
      </div>

      {/* AI Credits System */}
      <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-purple-900 rounded border border-indigo-500/30 overflow-hidden shadow-sm relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 blur-3xl rounded-full -translate-x-1/2 translate-y-1/2" />
        
        <div className="p-6 md:p-8 relative z-10 flex flex-col md:flex-row gap-8">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-indigo-500/20 rounded border border-indigo-500/30 shadow-inner">
                <Bot className="w-6 h-6 text-indigo-300" />
              </div>
              <h2 className="text-2xl font-bold text-white tracking-wide">IA Erewere (SaaS)</h2>
            </div>
            <p className="text-indigo-200/80 mb-6">
              Potencia tus ventas con nuestro asesor de inteligencia artificial. Los créditos se descuentan por cada recomendación o análisis generado. Los créditos se comparten con toda la agencia.
            </p>
            
            <div className="inline-flex flex-col items-start bg-black/20 border border-white/10 rounded p-4 mb-8">
              <span className="text-xs font-semibold text-indigo-300 uppercase tracking-widest mb-1">Saldo Actual</span>
              <div className="flex items-end gap-2">
                <span className="text-4xl font-extrabold text-white">{agency?.aiCredits || 0}</span>
                <span className="text-indigo-200 mb-1 font-medium">créditos</span>
              </div>
            </div>
          </div>

          <div className="w-full md:w-[320px] flex flex-col gap-4">
            <div className="bg-white/5 border border-white/10 p-5 rounded hover:bg-white/10 transition-colors">
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
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-medium transition-colors text-sm flex items-center justify-center gap-2"
              >
                <Zap className="w-4 h-4" /> Comprar
              </button>
            </div>
            
            <div className="bg-indigo-500/20 border border-indigo-400/30 p-5 rounded hover:bg-indigo-500/30 transition-colors relative overflow-hidden">
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
                className="w-full py-2 bg-indigo-500 hover:bg-indigo-400 text-white rounded font-medium transition-colors text-sm flex items-center justify-center gap-2"
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
