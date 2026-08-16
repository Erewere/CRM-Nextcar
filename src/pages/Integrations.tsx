import React, { useState, useEffect } from 'react';
import { MessageCircle, ArrowRight, ExternalLink, Save, CheckCircle2, Calendar, Mail, Check, AlertCircle, Copy, Bot, Key, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc, updateDoc, serverTimestamp, collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

export function Integrations() {
  const { userData, googleToken, connectGoogleServices, disconnectGoogleServices, currentUser } = useAuth();
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [hasAccessToken, setHasAccessToken] = useState(false);
  const [maskedAccessToken, setMaskedAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // MCP API Key state
  const [mcpKeyInfo, setMcpKeyInfo] = useState<{ hasKey: boolean; maskedKey: string | null } | null>(null);
  const [newGeneratedKey, setNewGeneratedKey] = useState<string | null>(null);
  const [mcpLoading, setMcpLoading] = useState<boolean>(false);

  // Respaldo completo de la base
  const [backupLoading, setBackupLoading] = useState<boolean>(false);
  const [backupDone, setBackupDone] = useState<boolean>(false);

  // Herramienta temporal de migracion (Fase 1: crear tratos faltantes)
  const [migLoading, setMigLoading] = useState<boolean>(false);
  const [migResult, setMigResult] = useState<any>(null);
  // Revision de contactos repetidos, del administrador sobre su agencia.
  const [dupCargando, setDupCargando] = useState<boolean>(false);
  const [dupResultado, setDupResultado] = useState<any>(null);
  const [fusionResultado, setFusionResultado] = useState<any>(null);
  const [fusionSimulada, setFusionSimulada] = useState<boolean>(false);

  const mcpServerUrl = typeof window !== 'undefined' ? `${window.location.origin}/mcp` : '';
  const isAdminOrMaster = userData?.role === 'master' || userData?.role === 'admin';
  const isMaster = userData?.role === 'master';

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2500);
  };

  useEffect(() => {
    const fetchMcpKeyInfo = async () => {
      if (!userData?.agencyId) return;

      // Try API route first if token is available
      try {
        if (currentUser) {
          const token = await currentUser.getIdToken();
          const res = await fetch(`/api/agencies/mcp-key?agencyId=${userData.agencyId}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const contentType = res.headers.get("content-type") || "";
          if (res.ok && contentType.includes("application/json")) {
            const data = await res.json();
            setMcpKeyInfo(data);
            return;
          }
        }
      } catch (err) {
        console.warn("API route for MCP key unavailable, falling back to Firestore:", err);
      }

      // Fallback: Read directly from Firestore
      try {
        const agencySnap = await getDoc(doc(db, "agencies", userData.agencyId));
        if (agencySnap.exists()) {
          const agencyData = agencySnap.data();
          const apiKey = agencyData?.mcpApiKey || null;
          if (apiKey) {
            setMcpKeyInfo({
              hasKey: true,
              maskedKey: "••••••••" + apiKey.slice(-4)
            });
          } else {
            setMcpKeyInfo({ hasKey: false, maskedKey: null });
          }
        }
      } catch (fsErr) {
        console.error("Error loading MCP key info from Firestore:", fsErr);
      }
    };

    fetchMcpKeyInfo();
  }, [userData, currentUser]);

  const handleGenerateMcpKey = async () => {
    if (!userData?.agencyId) return;
    if (mcpKeyInfo?.hasKey) {
      if (!window.confirm("Generar una nueva clave de acceso invalidará la clave anterior. ¿Deseas continuar?")) {
        return;
      }
    }

    setMcpLoading(true);
    try {
      let generatedKey: string | null = null;
      let maskedKey: string | null = null;

      // Try backend API route first
      if (currentUser) {
        try {
          const token = await currentUser.getIdToken();
          const res = await fetch("/api/agencies/mcp-key", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ agencyId: userData.agencyId })
          });

          const contentType = res.headers.get("content-type") || "";
          if (res.ok && contentType.includes("application/json")) {
            const data = await res.json();
            if (data.mcpApiKey) {
              generatedKey = data.mcpApiKey;
              maskedKey = data.maskedKey;
            }
          }
        } catch (apiErr) {
          console.warn("API route failed, using direct Firestore key generation:", apiErr);
        }
      }

      // Fallback: Generate key client-side and store directly in Firestore
      if (!generatedKey) {
        const randomArray = new Uint8Array(24);
        window.crypto.getRandomValues(randomArray);
        const randomHex = Array.from(randomArray).map(b => b.toString(16).padStart(2, '0')).join('');
        generatedKey = `erewere_mcp_${randomHex}`;
        maskedKey = "••••••••" + generatedKey.slice(-4);

        await updateDoc(doc(db, "agencies", userData.agencyId), {
          mcpApiKey: generatedKey,
          mcpApiKeyCreatedAt: serverTimestamp()
        });
      }

      setNewGeneratedKey(generatedKey);
      setMcpKeyInfo({ hasKey: true, maskedKey });
    } catch (e: any) {
      alert("Error al generar clave MCP: " + (e.message || e));
    } finally {
      setMcpLoading(false);
    }
  };

  useEffect(() => {
    const loadConfig = async () => {
      if (!userData?.agencyId) return;
      try {
        if (currentUser) {
          const token = await currentUser.getIdToken();
          const res = await fetch(`/api/agencies/whatsapp-config?agencyId=${userData.agencyId}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            setPhoneNumberId(data.phoneNumberId || '');
            setAccountId(data.accountId || '');
            setHasAccessToken(!!data.hasAccessToken);
            setMaskedAccessToken(data.maskedAccessToken || null);
          }
        }
        // La misma URL de webhook sirve para todas las agencias: Meta identifica
        // a cuál pertenece cada mensaje según el Phone Number ID configurado abajo.
        const currentDomain = window.location.origin;
        setWebhookUrl(`${currentDomain}/api/meta/webhook`);
      } catch (error) {
        console.error("Error loading whatsapp config:", error);
      }
    };
    loadConfig();
  }, [userData, currentUser]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData?.agencyId || !currentUser) return;

    setLoading(true);
    setSaved(false);

    try {
      const token = await currentUser.getIdToken();
      const res = await fetch('/api/agencies/whatsapp-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          agencyId: userData.agencyId,
          phoneNumberId,
          accountId,
          ...(accessToken ? { accessToken } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar la configuración');

      if (accessToken) {
        setHasAccessToken(true);
        setMaskedAccessToken('••••••••' + accessToken.slice(-4));
        setAccessToken('');
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error: any) {
      console.error("Error saving whatsapp config:", error);
      alert(error.message || "Hubo un error al guardar la configuración.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadBackup = async () => {
    if (!currentUser) {
      alert("No hay una sesión activa. Vuelve a iniciar sesión.");
      return;
    }
    setBackupLoading(true);
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch("/api/admin/backup", {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        let message = `Error ${res.status} generando el respaldo.`;
        try {
          const data = await res.json();
          if (data?.error) message = data.error;
        } catch {
          // La respuesta no era JSON; se conserva el mensaje genérico.
        }
        throw new Error(message);
      }

      const blob = await res.blob();
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:]/g, "-");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `respaldo-crm-${stamp}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setBackupDone(true);
      setTimeout(() => setBackupDone(false), 4000);
    } catch (e: any) {
      alert(e.message || "No se pudo generar el respaldo.");
    } finally {
      setBackupLoading(false);
    }
  };

  const handleRevisionDuplicados = async () => {
    if (!currentUser) {
      alert("No hay una sesión activa. Vuelve a iniciar sesión.");
      return;
    }
    setDupCargando(true);
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch("/api/admin/audit-duplicate-clients", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);
      setDupResultado(data);
    } catch (e: any) {
      alert(e.message || "No se pudo revisar los contactos.");
    } finally {
      setDupCargando(false);
    }
  };

  const handleFusionar = async (apply: boolean) => {
    if (!currentUser) {
      alert("No hay una sesión activa. Vuelve a iniciar sesión.");
      return;
    }
    if (apply && !window.confirm(
      "Se van a BORRAR las copias repetidas, después de pasarle sus tratos, " +
      "tareas y notas al contacto que se queda. Esto NO SE PUEDE DESHACER. " +
      "¿Continuar?"
    )) {
      return;
    }
    setDupCargando(true);
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch("/api/admin/merge-duplicate-clients", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ apply })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);
      setFusionResultado(data);
      setFusionSimulada(!apply);
      if (apply) setDupResultado(null);
    } catch (e: any) {
      alert(e.message || "No se pudo fusionar.");
    } finally {
      setDupCargando(false);
    }
  };

  // Revisa toda la plataforma, no una agencia, y no escribe nada.
  const handleRevision = async (ruta: string) => {
    if (!currentUser) {
      alert("No hay una sesión activa. Vuelve a iniciar sesión.");
      return;
    }
    setMigLoading(true);
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch(`/api/admin/${ruta}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);
      setMigResult(data);
    } catch (e: any) {
      alert(e.message || "No se pudo completar la revisión.");
    } finally {
      setMigLoading(false);
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
                    Esta URL es la misma para todas las agencias — Meta identifica automáticamente a cuál pertenece cada mensaje según el Phone Number ID que configures a la derecha. En la sección "Webhooks" de Meta, usa esta URL de devolución:
                    <div className="mt-2 p-2 bg-[#f4f5f5] dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded text-xs font-mono break-all text-slate-800 dark:text-slate-300 select-all">
                      {webhookUrl || 'Cargando URL...'}
                    </div>
                    Como token de verificación, usa el valor configurado en la variable de entorno <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-xs">META_VERIFY_TOKEN</code> en Hostinger (pídele a tu administrador técnico este valor si no lo tienes).
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
                      required={!hasAccessToken}
                      value={accessToken}
                      onChange={(e) => setAccessToken(e.target.value)}
                      placeholder={hasAccessToken ? 'Dejar en blanco para mantener el token actual' : 'EAAL...'}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm font-mono"
                    />
                    {hasAccessToken && (
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Token guardado: {maskedAccessToken}. Por seguridad no se puede ver completo — solo reemplazarlo.
                      </p>
                    )}
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
                  Servidor MCP (Model Context Protocol)
                  <span className="px-2 py-0.5 text-xs font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-300 rounded-full border border-indigo-300 dark:border-indigo-700">
                    API Key Auth
                  </span>
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Conecta tu CRM Erewere con Gemini, Spark, Claude u otro asistente de IA utilizando el protocolo MCP con Bearer API Key.
                </p>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="mb-6 bg-indigo-50/80 dark:bg-slate-900/60 p-4 rounded-lg border border-indigo-100 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 space-y-2">
              <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5 text-sm">
                <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                ¿Cómo conectar tu CRM a tu Asistente de IA?
              </div>
              <ol className="list-decimal list-inside space-y-1 text-slate-600 dark:text-slate-300">
                <li>Copia la <strong>URL del Servidor MCP</strong> provista abajo.</li>
                <li>Genera tu <strong>Clave de Acceso MCP (API Key)</strong>.</li>
                <li>En la configuración de tu asistente de IA, selecciona autenticación por <strong>Bearer Token / API Key</strong> e ingresa la clave generada.</li>
                <li>¡Listo! Tu IA se comunicará de forma segura y aislada únicamente con los datos de tu agencia.</li>
              </ol>
            </div>

            {newGeneratedKey && (
              <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700 rounded-lg">
                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200 font-bold text-sm mb-1">
                  <Key className="w-4 h-4" /> ¡Nueva Clave de Acceso MCP Generada!
                </div>
                <p className="text-xs text-emerald-700 dark:text-emerald-300 mb-2">
                  Copia esta clave ahora. Por razones de seguridad, <strong>no se volverá a mostrar completa</strong> después de recargar.
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={newGeneratedKey}
                    className="w-full text-xs font-mono px-3 py-2 bg-white dark:bg-slate-900 border border-emerald-400 rounded text-emerald-900 dark:text-emerald-100 font-bold"
                  />
                  <button
                    onClick={() => copyToClipboard(newGeneratedKey, 'mcp_new_key')}
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded flex items-center gap-1 shrink-0 transition-colors"
                  >
                    {copiedField === 'mcp_new_key' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copiedField === 'mcp_new_key' ? 'Copiada' : 'Copiar Clave'}
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* URL del servidor */}
              <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                  URL del Servidor MCP (/mcp o /sse)
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
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                  Transporte SSE alternativo: <code className="text-indigo-600 dark:text-indigo-400 font-mono">{mcpServerUrl.replace('/mcp', '/sse')}</code>
                </p>
              </div>

              {/* MCP API Key Status & Actions */}
              <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                    Clave de Acceso MCP (API Key)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={mcpKeyInfo?.hasKey ? (mcpKeyInfo.maskedKey || '••••••••') : 'Sin clave generada'}
                      className="w-full text-xs font-mono px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded text-slate-800 dark:text-slate-200"
                    />
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  {!isAdminOrMaster ? (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400 italic">
                      Solo administradores de la agencia pueden gestionar la clave MCP.
                    </p>
                  ) : (
                    <button
                      onClick={handleGenerateMcpKey}
                      disabled={mcpLoading}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded flex items-center gap-1.5 transition-colors"
                    >
                      <Key className="w-3.5 h-3.5" />
                      {mcpLoading
                        ? 'Generando...'
                        : mcpKeyInfo?.hasKey
                        ? 'Rotar / Generar Nueva Clave'
                        : 'Generar Clave de Acceso MCP'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Respaldo de la base de datos (exclusivo del rol master) */}
        {userData?.role === 'admin' && (
          <div className="bg-white dark:bg-slate-800 rounded shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden mt-8">
            <div className="p-6 border-b border-gray-200 dark:border-slate-700">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Contactos repetidos
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                El CRM muestra un solo contacto por nombre y esconde los demás. Aquí se
                ven todos, con lo que tiene cada copia. Solo lee, no cambia nada.
              </p>
            </div>
            <div className="p-6">
              <button
                onClick={handleRevisionDuplicados}
                disabled={dupCargando}
                className="px-5 py-2.5 bg-slate-700 hover:bg-slate-800 text-white rounded font-medium text-sm transition-colors disabled:opacity-50"
              >
                {dupCargando ? "Revisando..." : "Revisar contactos"}
              </button>

              {/* Unico paso que escribe. Exige simular antes. */}
              <div className="mt-6 pt-5 border-t border-red-200 dark:border-red-900">
                <h3 className="text-sm font-bold text-red-700 dark:text-red-400 mb-1">
                  Fusionar los repetidos
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                  Se queda la copia que ves hoy en el CRM y se le pasan los tratos,
                  tareas y notas de las demás antes de borrarlas. Sus campos vacíos se
                  completan con lo que tengan las otras; nada de lo que ya tiene se
                  sobrescribe.
                  <strong className="text-red-700 dark:text-red-400"> No se puede deshacer.</strong>
                </p>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => handleFusionar(false)}
                    disabled={dupCargando}
                    className="px-5 py-2.5 bg-slate-700 hover:bg-slate-800 text-white rounded font-medium text-sm transition-colors disabled:opacity-50"
                  >
                    {dupCargando ? "Procesando..." : "1. Simular"}
                  </button>
                  <button
                    onClick={() => handleFusionar(true)}
                    disabled={dupCargando || !fusionSimulada}
                    className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded font-medium text-sm transition-colors disabled:opacity-40"
                  >
                    2. Fusionar
                  </button>
                </div>

                {fusionResultado && (
                  <div className="mt-5 border border-gray-200 dark:border-slate-700 rounded p-4 bg-slate-50 dark:bg-slate-900/50">
                    <p className="text-sm font-bold text-slate-900 dark:text-white mb-3">
                      Modo: {fusionResultado.modo}
                    </p>
                    <ul className="text-sm text-slate-700 dark:text-slate-300 space-y-1 mb-4">
                      <li>Nombres repetidos: <strong>{fusionResultado.resumen.nombresRepetidos}</strong></li>
                      <li className="text-indigo-700 dark:text-indigo-400">
                        Registros reasignados: <strong>{fusionResultado.resumen.registrosReasignados}</strong>
                      </li>
                      <li>Campos completados: <strong>{fusionResultado.resumen.camposCompletados}</strong></li>
                      <li className="text-red-700 dark:text-red-400">
                        Copias borradas: <strong>{fusionResultado.resumen.copiasBorradas}</strong>
                      </li>
                    </ul>
                    <div className="space-y-1">
                      {fusionResultado.detalle.map((d: any, i: number) => (
                        <p key={i} className="text-xs text-slate-600 dark:text-slate-400">
                          <strong className="text-slate-800 dark:text-slate-200">{d.nombre}</strong>
                          {" — "}{d.texto}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {dupResultado && (
                <div className="mt-5">
                  <ul className="text-sm text-slate-700 dark:text-slate-300 space-y-1 mb-4">
                    <li>Contactos totales: <strong>{dupResultado.resumen.contactosTotales}</strong></li>
                    <li>Nombres repetidos: <strong>{dupResultado.resumen.nombresRepetidos}</strong></li>
                    <li>Copias de más: <strong>{dupResultado.resumen.copiasDeMas}</strong></li>
                    <li className={dupResultado.resumen.casosConTratosEnCopiasOcultas > 0 ? "text-amber-700 dark:text-amber-400" : ""}>
                      Nombres con tratos en copias que no ves:{" "}
                      <strong>{dupResultado.resumen.casosConTratosEnCopiasOcultas}</strong>
                    </li>
                  </ul>

                  {dupResultado.repetidos.length === 0 && (
                    <p className="text-sm text-emerald-700 dark:text-emerald-400">
                      No hay contactos repetidos.
                    </p>
                  )}

                  <div className="space-y-4">
                    {dupResultado.repetidos.map((g: any) => (
                      <div key={g.nombre} className="border border-gray-200 dark:border-slate-700 rounded p-4">
                        <p className="font-bold text-slate-900 dark:text-white text-sm mb-1">
                          {g.nombre}{" "}
                          <span className="font-normal text-slate-500">
                            — {g.copias.length} copias
                          </span>
                        </p>
                        {g.tratosOcultos > 0 && (
                          <p className="text-xs text-amber-700 dark:text-amber-400 mb-2">
                            {g.tratosOcultos} trato{g.tratosOcultos === 1 ? '' : 's'} cuelga
                            {g.tratosOcultos === 1 ? '' : 'n'} de copias que no aparecen en el CRM.
                          </p>
                        )}
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs min-w-[520px]">
                            <thead className="text-slate-500 dark:text-slate-400">
                              <tr>
                                <th className="text-left font-medium py-1">Copia</th>
                                <th className="text-left font-medium py-1">Teléfono</th>
                                <th className="text-right font-medium py-1">Tratos</th>
                                <th className="text-right font-medium py-1">Tareas</th>
                                <th className="text-right font-medium py-1">Notas</th>
                              </tr>
                            </thead>
                            <tbody>
                              {g.copias.map((c: any) => (
                                <tr key={c.id} className="border-t border-gray-100 dark:border-slate-800">
                                  <td className="py-1.5 pr-2">
                                    <code className="text-[11px] text-slate-600 dark:text-slate-400">{c.id}</code>
                                    {c.esLaQueVes && (
                                      <span className="ml-2 px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300">
                                        la que ves
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-1.5 pr-2 text-slate-600 dark:text-slate-400">{c.telefono || "—"}</td>
                                  <td className="py-1.5 text-right text-slate-700 dark:text-slate-300">{c.tratos}</td>
                                  <td className="py-1.5 text-right text-slate-700 dark:text-slate-300">{c.tareas}</td>
                                  <td className="py-1.5 text-right text-slate-700 dark:text-slate-300">{c.notas}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {isMaster && (
          <div className="bg-white dark:bg-slate-800 rounded shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden mt-8">
            <div className="p-6 border-b border-gray-200 dark:border-slate-700 flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded flex items-center justify-center shrink-0">
                <ShieldCheck className="w-6 h-6 text-amber-600 dark:text-amber-500" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Respaldo de la información</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Descarga una copia completa de tus contactos, tratos, inventario, gastos, tareas y notas.
                </p>
              </div>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-600 dark:text-slate-300 mb-4 leading-relaxed">
                El archivo se guarda directamente en tu computadora en formato JSON. Conviene descargarlo
                antes de cualquier cambio importante en el sistema. La clave de acceso MCP no se incluye
                en el archivo por seguridad.
              </p>
              <button
                onClick={handleDownloadBackup}
                disabled={backupLoading}
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded font-medium text-sm transition-colors disabled:opacity-50"
              >
                {backupLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Generando respaldo...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    Descargar respaldo
                  </>
                )}
              </button>
              {backupDone && (
                <p className="mt-3 text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                  <Check className="w-4 h-4" /> Respaldo descargado correctamente.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Revisiones de mantenimiento, solo para master. */}
        {isMaster && (
          <div className="bg-white dark:bg-slate-800 rounded shadow-sm border border-dashed border-indigo-300 dark:border-indigo-800 overflow-hidden mt-8">
            <div className="p-6 border-b border-gray-200 dark:border-slate-700">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Revisiones de la plataforma
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Comprobaciones de solo lectura. No modifican nada.
              </p>
            </div>
            <div className="p-6">
              <div className="mb-6 pb-5 border-b border-gray-200 dark:border-slate-700">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
                  Revisar usuarios contra sus cuentas
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                  Compara cada ficha de usuario con la cuenta real con la que se inicia
                  sesión, y señala las que sobran. Solo lee, no cambia nada.
                </p>
                <button
                  onClick={() => handleRevision('audit-users')}
                  disabled={migLoading}
                  className="px-5 py-2.5 bg-slate-700 hover:bg-slate-800 text-white rounded font-medium text-sm transition-colors disabled:opacity-50"
                >
                  {migLoading ? "Procesando..." : "Revisar"}
                </button>
              </div>

              {/* Comprobacion final: cubre todas las agencias de una vez. */}
              <div className="mb-6 pb-5 border-b border-gray-200 dark:border-slate-700">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
                  Revisar que ningún auto guarde su costo
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                  Recorre todas las agencias y señala las que aún tienen el precio de
                  compra dentro del vehículo. Solo lee, no cambia nada.
                </p>
                <button
                  onClick={() => handleRevision('audit-costs')}
                  disabled={migLoading}
                  className="px-5 py-2.5 bg-slate-700 hover:bg-slate-800 text-white rounded font-medium text-sm transition-colors disabled:opacity-50"
                >
                  {migLoading ? "Procesando..." : "Revisar todas"}
                </button>
              </div>


              {migResult && (
                <div className="mt-5 border border-gray-200 dark:border-slate-700 rounded p-4 bg-slate-50 dark:bg-slate-900/50">
                  <p className="text-sm font-bold text-slate-900 dark:text-white mb-3">
                    Modo: {migResult.modo}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                    Alcance: <code>{migResult.agencia}</code>
                  </p>
                  {/* Cada revision describe su resumen a su manera. */}
                  <ul className="text-sm text-slate-700 dark:text-slate-300 space-y-1 mb-4">
                    {Object.entries(migResult.resumen || {}).map(([clave, valor]) => {
                      const etiqueta = clave
                        .replace(/([A-Z])/g, ' $1')
                        .replace(/^./, (c) => c.toUpperCase());
                      const destacado = /porCrear|porCopiar/.test(clave)
                        ? 'text-indigo-700 dark:text-indigo-400'
                        : /creados|copiados/.test(clave)
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : '';
                      return (
                        <li key={clave} className={destacado}>
                          {etiqueta}: <strong>{String(valor)}</strong>
                        </li>
                      );
                    })}
                  </ul>
                  {Array.isArray(migResult.detalle) && migResult.detalle.length > 0 && (
                    <div className="max-h-64 overflow-y-auto border-t border-gray-200 dark:border-slate-700 pt-3">
                      {migResult.detalle.map((d: any, i: number) => (
                        <div key={d.contactoId || i} className="text-xs text-slate-600 dark:text-slate-400 py-1 border-b border-gray-100 dark:border-slate-800 last:border-0">
                          <strong className="text-slate-800 dark:text-slate-200">{d.nombre}</strong>
                          {/* Cada revision describe sus renglones a su manera. */}
                          {d.texto
                            ? <>{" — "}{d.texto}</>
                            : <>{" — "}{d.titulo}{" · "}${Number(d.valor).toLocaleString("es-MX")}{" · "}{d.estado}</>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

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
