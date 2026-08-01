import React, { useState, useEffect } from 'react';
import { MessageCircle, ArrowRight, ExternalLink, Save, CheckCircle2, Calendar, Mail, Check, AlertCircle, Copy, Bot, Key, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export function Integrations() {
  const { userData, googleToken, connectGoogleServices, disconnectGoogleServices, currentUser } = useAuth();
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const mcpServerUrl = typeof window !== 'undefined' ? `${window.location.origin}/mcp` : '';
  const agencyOrUserId = (userData?.agencyId && userData.agencyId !== 'unassigned') 
    ? userData.agencyId 
    : (userData?.id || 'default');

  const mcpClientId = `erewere_agency_${agencyOrUserId}`;
  const mcpClientSecret = `secret_${agencyOrUserId.substring(0, 10)}`;

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2500);
  };

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
        <div className="bg-white dark:bg-slate-800 rounded shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded flex items-center justify-center shrink-0">
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
                  <div className="shrink-0 w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 font-bold text-xs border border-gray-200 dark:border-slate-700">1</div>
                  <div className="text-slate-600 dark:text-slate-400">
                    <strong className="text-slate-800 dark:text-slate-200 block mb-0.5">Crea una Aplicación</strong>
                    En Meta for Developers, crea una aplicación tipo "Negocios".
                  </div>
                </div>

                <div className="flex gap-3 text-sm">
                  <div className="shrink-0 w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 font-bold text-xs border border-gray-200 dark:border-slate-700">2</div>
                  <div className="text-slate-600 dark:text-slate-400">
                    <strong className="text-slate-800 dark:text-slate-200 block mb-0.5">Agrega WhatsApp</strong>
                    Añade el producto "WhatsApp" a tu aplicación.
                  </div>
                </div>

                <div className="flex gap-3 text-sm">
                  <div className="shrink-0 w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 font-bold text-xs border border-gray-200 dark:border-slate-700">3</div>
                  <div className="text-slate-600 dark:text-slate-400">
                    <strong className="text-slate-800 dark:text-slate-200 block mb-0.5">Copia las Credenciales</strong>
                    Ve a "Configuración de la API" en WhatsApp y copia el ID del número, ID de la cuenta y genera un token permanente. Pégalos en el formulario.
                  </div>
                </div>

                <div className="flex gap-3 text-sm">
                  <div className="shrink-0 w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 font-bold text-xs border border-gray-200 dark:border-slate-700">4</div>
                  <div className="text-slate-600 dark:text-slate-400">
                    <strong className="text-slate-800 dark:text-slate-200 block mb-0.5">Configura el Webhook</strong>
                    En la sección "Webhooks" de Meta, usa esta URL de devolución y el token <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-xs">CRM_VERIFY_TOKEN</code>:
                    <div className="mt-2 p-2 bg-[#f4f5f5] dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded text-xs font-mono break-all text-slate-800 dark:text-slate-300 select-all">
                      {webhookUrl || 'Cargando URL...'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Formulario */}
            <div>
              <div className="bg-[#f4f5f5] dark:bg-slate-900/50 rounded p-5 border border-gray-200 dark:border-slate-700">
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
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
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
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
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
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm font-mono"
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition-colors disabled:opacity-70 text-sm"
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


        {/* Google Workspace Integration */}
        <div className="bg-white dark:bg-slate-800 rounded shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden mb-8">
          <div className="p-6 border-b border-gray-200 dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded flex items-center justify-center shrink-0">
                <Calendar className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Google Workspace (Calendario, Gmail, Contactos, Tasks)</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Sincroniza tu cuenta personal de Google para administrar tus correos, citas y tareas de forma individual y privada.
                </p>
              </div>
            </div>

            <div>
              {googleToken ? (
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-semibold rounded-full border border-emerald-200 dark:border-emerald-800">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    Conectado ({currentUser?.email})
                  </span>
                  <button
                    onClick={() => disconnectGoogleServices()}
                    className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold rounded border border-red-200 transition-colors"
                  >
                    Desconectar
                  </button>
                </div>
              ) : (
                <button
                  onClick={async () => {
                    setGoogleLoading(true);
                    try {
                      await connectGoogleServices();
                    } catch (e: any) {
                      alert("Error conectando Google: " + e.message);
                    } finally {
                      setGoogleLoading(false);
                    }
                  }}
                  disabled={googleLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded shadow transition-colors"
                >
                  <Calendar className="w-4 h-4" />
                  {googleLoading ? "Conectando..." : "Conectar cuenta de Google"}
                </button>
              )}
            </div>
          </div>

          <div className="p-6 bg-slate-50 dark:bg-slate-900/40 text-xs text-slate-600 dark:text-slate-400 flex flex-col md:flex-row gap-6">
            <div className="flex items-start gap-2">
              <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <strong className="text-slate-800 dark:text-slate-200 block">Privacidad Individual</strong>
                Cada usuario sincroniza su propia cuenta personal sin que otros vendedores o administradores puedan ver sus correos o eventos privados.
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <strong className="text-slate-800 dark:text-slate-200 block">Sincronización Bidireccional</strong>
                Las actividades programadas en el CRM se enviarán automáticamente a tu Google Calendar y Google Tasks.
              </div>
            </div>
          </div>
        </div>

        {/* MCP Server Integration for Gemini / Spark / Claude */}
        <div className="bg-white dark:bg-slate-800 rounded shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden mb-8">
          <div className="p-6 border-b border-gray-200 dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/40 rounded flex items-center justify-center shrink-0">
                <Bot className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  Servidor MCP (Model Context Protocol) & OAuth
                  <span className="px-2 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 rounded-full border border-emerald-300 dark:border-emerald-700">
                    Activo
                  </span>
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Conecta tu CRM Erewere con Gemini, Spark, Claude u otro asistente de IA utilizando el protocolo MCP con OAuth 2.0.
                </p>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="mb-6 bg-indigo-50/80 dark:bg-slate-900/60 p-4 rounded-lg border border-indigo-100 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 space-y-2">
              <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5 text-sm">
                <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                ¿Cómo conectar tu CRM a Gemini o Spark?
              </div>
              <ol className="list-decimal list-inside space-y-1 text-slate-600 dark:text-slate-300">
                <li>En la ventana de conexión MCP de Gemini/Spark, pega la <strong>URL del Servidor MCP</strong>.</li>
                <li>Si la plataforma solicita credenciales OAuth, ingresa el <strong>ID de cliente</strong> y el <strong>Secreto del cliente</strong> provistos abajo.</li>
                <li>¡Listo! Tu IA podrá consultar autos en inventario, ver clientes y crear nuevos leads automáticamente.</li>
              </ol>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* URL del servidor */}
              <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                  URL del Servidor MCP
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={mcpServerUrl}
                    className="w-full text-xs font-mono px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded text-slate-800 dark:text-slate-200"
                  />
                  <button
                    onClick={() => copyToClipboard(mcpServerUrl, 'url')}
                    title="Copiar URL"
                    className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded flex items-center gap-1 shrink-0 transition-colors"
                  >
                    {copiedField === 'url' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* ID de Cliente */}
              <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                  ID de cliente de OAuth
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={mcpClientId}
                    className="w-full text-xs font-mono px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded text-indigo-600 dark:text-indigo-400 font-semibold"
                  />
                  <button
                    onClick={() => copyToClipboard(mcpClientId, 'client_id')}
                    title="Copiar ID de cliente"
                    className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded flex items-center gap-1 shrink-0 transition-colors"
                  >
                    {copiedField === 'client_id' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Secreto del Cliente */}
              <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                  Secreto de cliente de OAuth
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={mcpClientSecret}
                    className="w-full text-xs font-mono px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded text-indigo-600 dark:text-indigo-400 font-semibold"
                  />
                  <button
                    onClick={() => copyToClipboard(mcpClientSecret, 'client_secret')}
                    title="Copiar Secreto de cliente"
                    className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded flex items-center gap-1 shrink-0 transition-colors"
                  >
                    {copiedField === 'client_secret' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Virtual Assistants API */}
        <div className="bg-white dark:bg-slate-800 rounded shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden mt-8">
          <div className="p-6 border-b border-gray-200 dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded flex items-center justify-center shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-600 dark:text-purple-500"><path d="M12 2v20"></path><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">API para Asistentes Virtuales</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Endpoints públicos para consultar inventario y capturar leads desde tu bot de IA.</p>
              </div>
            </div>
          </div>
          <div className="p-6">
             <div className="mb-4">
               <span className="font-semibold text-sm text-slate-800 dark:text-slate-200">ID de Agencia: </span>
               <code className="bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded text-sm text-purple-600">{userData?.agencyId || '...'}</code>
             </div>
             
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
               <div className="border border-gray-200 dark:border-slate-700 rounded p-4 bg-[#f4f5f5] dark:bg-slate-900/50">
                 <div className="flex items-center gap-2 mb-3">
                   <span className="bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded text-xs uppercase">GET</span>
                   <span className="font-mono text-sm font-semibold">/api/public/v1/inventory</span>
                 </div>
                 <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">Obtiene la lista de vehículos disponibles.</p>
                 <div className="bg-slate-800 text-slate-300 p-3 rounded text-xs font-mono overflow-x-auto">
                   curl {window.location.origin}/api/public/v1/inventory?agencyId={userData?.agencyId}
                 </div>
               </div>

               <div className="border border-gray-200 dark:border-slate-700 rounded p-4 bg-[#f4f5f5] dark:bg-slate-900/50">
                 <div className="flex items-center gap-2 mb-3">
                   <span className="bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded text-xs uppercase">POST</span>
                   <span className="font-mono text-sm font-semibold">/api/public/v1/leads</span>
                 </div>
                 <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">Crea un nuevo prospecto (Lead) en el CRM.</p>
                 <div className="bg-slate-800 text-slate-300 p-3 rounded text-xs font-mono overflow-x-auto">
                   {`curl -X POST ${window.location.origin}/api/public/v1/leads \
  -H "Content-Type: application/json" \
  -d '{"agencyId": "${userData?.agencyId}", "name": "Juan Perez", "phone": "5551234567"}'`}
                 </div>
               </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
