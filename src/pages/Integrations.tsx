import React, { useState, useEffect } from 'react';
import { MessageCircle, ArrowRight, ExternalLink, Save, CheckCircle2, Mail } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export function Integrations() {
  const [googleLoading, setGoogleLoading] = useState(false);
  const { userData, connectGoogleServices, googleToken } = useAuth();

  const handleGoogleConnect = async () => {
    setGoogleLoading(true);
    try {
      await connectGoogleServices();
      alert("Cuenta conectada exitosamente!");
    } catch (err: any) {
      alert("Error conectando cuenta: " + err.message);
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    // Note: Disconnection logic goes here if implemented in AuthContext, 
    // for now we just show an alert or handle it via a new function if needed
    alert("Para desconectar, revoca el acceso desde tu cuenta de Google.");
  };
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');

  useEffect(() => {
    const loadConfig = async () => {
      if (!userData?.agencyId) return;
      try {
        const docRef = doc(db, 'agencies', userData.agencyId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.whatsappConfig) {
            setPhoneNumberId(data.whatsappConfig.phoneNumberId || '');
            setAccountId(data.whatsappConfig.accountId || '');
            setAccessToken(data.whatsappConfig.accessToken || '');
          }
        }
        // Generate a webhook URL specific to this agency for them to configure in Meta
        const currentDomain = window.location.origin;
        setWebhookUrl(`${currentDomain}/api/whatsapp/webhook/${userData.agencyId}`);
      } catch (error) {
        console.error("Error loading whatsapp config:", error);
      }
    };
    loadConfig();
  }, [userData]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData?.agencyId) return;
    
    setLoading(true);
    setSaved(false);
    
    try {
      const docRef = doc(db, 'agencies', userData.agencyId);
      await updateDoc(docRef, {
        whatsappConfig: {
          phoneNumberId,
          accountId,
          accessToken,
          updatedAt: new Date().toISOString()
        }
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error("Error saving whatsapp config:", error);
      alert("Hubo un error al guardar la configuración.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#f4f5f5] dark:bg-slate-900 overflow-y-auto">
      <div className="px-4 md:px-6 py-6 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-200">Integraciones</h1>
        <p className="text-gray-500 dark:text-slate-400 mt-1">Conecta tus herramientas favoritas al CRM.</p>
      </div>

      <div className="p-4 md:p-6 max-w-4xl mx-auto w-full">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center shrink-0">
                <MessageCircle className="w-6 h-6 text-green-600 dark:text-green-500" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">WhatsApp Cloud API</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Conecta tu número oficial de WhatsApp Business directamente al CRM.</p>
              </div>
            </div>
          </div>

          <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Instrucciones */}
            <div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4 text-lg">Instrucciones de Conexión</h3>
              <p className="text-slate-600 dark:text-slate-400 mb-6 text-sm">
                Sigue estos pasos en <a href="https://developers.facebook.com/" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Meta for Developers</a> para obtener tus credenciales.
              </p>

              <div className="space-y-5">
                <div className="flex gap-3 text-sm">
                  <div className="shrink-0 w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 font-bold text-xs border border-slate-200 dark:border-slate-700">1</div>
                  <div className="text-slate-600 dark:text-slate-400">
                    <strong className="text-slate-800 dark:text-slate-200 block mb-0.5">Crea una Aplicación</strong>
                    En Meta for Developers, crea una aplicación tipo "Negocios".
                  </div>
                </div>

                <div className="flex gap-3 text-sm">
                  <div className="shrink-0 w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 font-bold text-xs border border-slate-200 dark:border-slate-700">2</div>
                  <div className="text-slate-600 dark:text-slate-400">
                    <strong className="text-slate-800 dark:text-slate-200 block mb-0.5">Agrega WhatsApp</strong>
                    Añade el producto "WhatsApp" a tu aplicación.
                  </div>
                </div>

                <div className="flex gap-3 text-sm">
                  <div className="shrink-0 w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 font-bold text-xs border border-slate-200 dark:border-slate-700">3</div>
                  <div className="text-slate-600 dark:text-slate-400">
                    <strong className="text-slate-800 dark:text-slate-200 block mb-0.5">Copia las Credenciales</strong>
                    Ve a "Configuración de la API" en WhatsApp y copia el ID del número, ID de la cuenta y genera un token permanente. Pégalos en el formulario.
                  </div>
                </div>

                <div className="flex gap-3 text-sm">
                  <div className="shrink-0 w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 font-bold text-xs border border-slate-200 dark:border-slate-700">4</div>
                  <div className="text-slate-600 dark:text-slate-400">
                    <strong className="text-slate-800 dark:text-slate-200 block mb-0.5">Configura el Webhook</strong>
                    En la sección "Webhooks" de Meta, usa esta URL de devolución y el token <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-xs">CRM_VERIFY_TOKEN</code>:
                    <div className="mt-2 p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs font-mono break-all text-slate-800 dark:text-slate-300 select-all">
                      {webhookUrl || 'Cargando URL...'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Formulario */}
            <div>
              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
                <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4">Credenciales de WhatsApp</h3>
                <form onSubmit={handleSave} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Identificador del Número de Teléfono (Phone Number ID)
                    </label>
                    <input
                      type="text"
                      required
                      value={phoneNumberId}
                      onChange={(e) => setPhoneNumberId(e.target.value)}
                      placeholder="Ej. 104234567890123"
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Identificador de la Cuenta (Account ID)
                    </label>
                    <input
                      type="text"
                      required
                      value={accountId}
                      onChange={(e) => setAccountId(e.target.value)}
                      placeholder="Ej. 103456789012345"
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Token de Acceso Permanente
                    </label>
                    <input
                      type="password"
                      required
                      value={accessToken}
                      onChange={(e) => setAccessToken(e.target.value)}
                      placeholder="EAAL..."
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm font-mono"
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-70 text-sm"
                    >
                      {loading ? 'Guardando...' : (
                        <>
                          <Save className="w-4 h-4" />
                          Guardar Configuración
                        </>
                      )}
                    </button>
                    
                    {saved && (
                      <p className="mt-3 text-sm text-green-600 dark:text-green-400 flex items-center justify-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> Configuración guardada correctamente
                      </p>
                    )}
                  </div>
                </form>
              </div>
            </div>

          </div>
        </div>

        {/* Email Integration (OAuth Secure Flow) */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden mt-6">
          <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center shrink-0">
                <Mail className="w-6 h-6 text-blue-600 dark:text-blue-500" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Integración de Correos (Gmail / Workspace)</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Conecta tu cuenta de Google mediante inicio de sesión seguro (OAuth) para leer y enviar correos.</p>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-6 border border-slate-200 dark:border-slate-700 flex flex-col items-center text-center max-w-xl mx-auto">
              <Mail className="w-12 h-12 text-blue-500 mb-4" />
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-2">Conectar cuenta de Google</h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm mb-6">
                Al conectar tu cuenta, el CRM podrá acceder a tus correos y enviar mensajes en tu nombre de forma totalmente segura. No necesitamos conocer tu contraseña.
              </p>
              
              {googleToken ? (
                <div className="flex flex-col items-center">
                  <div className="bg-green-100 text-green-800 px-4 py-2 rounded-full font-medium flex items-center gap-2 mb-4 text-sm">
                    <CheckCircle2 className="w-4 h-4" /> Cuenta de Google Conectada
                  </div>
                  <button
                    onClick={handleDisconnectGoogle}
                    className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 underline"
                  >
                    Desconectar o cambiar cuenta
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleGoogleConnect}
                  disabled={googleLoading}
                  className="flex items-center justify-center gap-3 bg-white border border-gray-300 text-gray-700 font-medium py-2 px-6 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors shadow-sm w-full sm:w-auto"
                >
                  {googleLoading ? (
                    <span className="text-sm">Conectando...</span>
                  ) : (
                    <>
                      <svg width="18" height="18" viewBox="0 0 48 48">
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                        <path fill="none" d="M0 0h48v48H0z"></path>
                      </svg>
                      <span className="text-sm">Sign in with Google</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
