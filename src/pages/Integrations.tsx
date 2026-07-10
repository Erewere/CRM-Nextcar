import React, { useState, useEffect } from 'react';
import { MessageCircle, ArrowRight, ExternalLink, Save, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
export function Integrations() {
  const { userData } = useAuth();
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

      </div>
    </div>
  );
}
