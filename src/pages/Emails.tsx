import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Mail, Settings, RefreshCw, AlertCircle, FileText, ChevronRight, Inbox, Search } from 'lucide-react';
import clsx from 'clsx';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface EmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  subject: string;
  from: string;
  date: string;
  unread: boolean;
  bodyHtml?: string;
  bodyPlain?: string;
}

export function Emails() {
  const { googleToken, connectGoogleServices, disconnectGoogleServices } = useAuth();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<EmailMessage | null>(null);

  const fetchEmails = async () => {
    if (!googleToken) return;
    setLoading(true);
    setError(null);
    try {
      // Fetch message list
      const listRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20&q=in:inbox', {
        headers: { 'Authorization': `Bearer ${googleToken}` }
      });
      if (!listRes.ok) {
        if (listRes.status === 401 || listRes.status === 403) {
           setError('Necesitas volver a conectar Google Workspace para dar permisos de Gmail.');
           setLoading(false);
           return;
        }
        throw new Error('Error fetching message list');
      }
      
      const listData = await listRes.json();
      if (!listData.messages) {
        setMessages([]);
        setLoading(false);
        return;
      }

      // Fetch message details
      const msgs: EmailMessage[] = [];
      for (const msg of listData.messages) {
        const msgRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`, {
           headers: { 'Authorization': `Bearer ${googleToken}` }
        });
        if (msgRes.ok) {
          const msgData = await msgRes.json();
          const headers = msgData.payload?.headers || [];
          const subjectHeader = headers.find((h: any) => (h.name || '').toLowerCase() === 'subject');
          const fromHeader = headers.find((h: any) => (h.name || '').toLowerCase() === 'from');
          const dateHeader = headers.find((h: any) => (h.name || '').toLowerCase() === 'date');
          
          const getBody = (payload: any): { html?: string, plain?: string } => {
            let html = '';
            let plain = '';
            if (payload?.mimeType === 'text/plain' && payload?.body?.data) {
              plain = atob(String(payload.body.data).replace(/-/g, '+').replace(/_/g, '/'));
            } else if (payload?.mimeType === 'text/html' && payload?.body?.data) {
              html = atob(String(payload.body.data).replace(/-/g, '+').replace(/_/g, '/'));
            } else if (payload?.parts) {
              for (const part of payload.parts) {
                const subBody = getBody(part);
                if (subBody.html) html = subBody.html;
                if (!html && subBody.plain) plain = subBody.plain; // Prefer html
              }
            }
            return { html, plain };
          };

          const bodyContent = getBody(msgData.payload);

          msgs.push({
            id: msgData.id,
            threadId: msgData.threadId,
            snippet: msg.snippet || msgData.snippet,
            subject: subjectHeader ? subjectHeader.value : '(Sin asunto)',
            from: fromHeader ? fromHeader.value : 'Desconocido',
            date: dateHeader ? dateHeader.value : '',
            unread: msgData.labelIds?.includes('UNREAD') || false,
            bodyHtml: bodyContent.html,
            bodyPlain: bodyContent.plain,
          });
        }
      }
      setMessages(msgs);
    } catch (err: any) {
      console.error(err);
      setError('Ocurrió un error al cargar los correos. Intenta conectarte de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (googleToken) {
      fetchEmails();
    }
  }, [googleToken]);

  const handleConnect = async () => {
    setGoogleLoading(true);
    try {
      await connectGoogleServices();
      // token sync will trigger useEffect
    } catch (error: any) {
      console.error("Connect Google Services Error:", error);
      alert("Error conectando cuenta: " + error.message);
    } finally {
      setGoogleLoading(false);
    }
  };

  const decodeHTMLEntities = (text: string) => {
    const textArea = document.createElement('textarea');
    textArea.innerHTML = text;
    return textArea.value;
  };

  return (
    <div className="h-[calc(100vh-8rem)] min-h-[600px] flex flex-col items-stretch overflow-hidden bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
      <div className="p-4 border-b border-gray-200 dark:border-slate-700 shrink-0 bg-white dark:bg-slate-800 flex items-center justify-end z-10 relative">
        <div className="flex items-center gap-3">
          {googleToken && (
             <>
               <button
                 onClick={fetchEmails}
                 disabled={loading}
                 className="flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 border border-gray-300 font-medium rounded-lg hover:bg-gray-50 dark:bg-slate-900 shadow-sm transition-all focus:ring-2 focus:ring-blue-100 disabled:opacity-50"
               >
                 <RefreshCw className={clsx("w-4 h-4", loading && "animate-spin")} />
                 Actualizar
               </button>
               <button
                 onClick={() => disconnectGoogleServices()}
                 className="flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 text-red-600 border border-gray-300 font-medium rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 shadow-sm transition-all focus:ring-2 focus:ring-red-100"
               >
                 Desconectar
               </button>
             </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative">
        <div className="absolute inset-0 bg-gray-50 dark:bg-slate-900 flex items-stretch">
          {!googleToken ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-4 overflow-y-auto">
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-8 max-w-xl w-full my-8">
                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mb-6 shadow-sm border border-blue-200 dark:border-blue-800/50 mx-auto">
                  <Mail className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-slate-200 mb-3">Integración de Correos (Gmail / Workspace)</h2>
                <p className="text-gray-600 dark:text-slate-400 text-sm mb-8 leading-relaxed max-w-md mx-auto">
                  Al conectar tu cuenta de Google mediante inicio de sesión seguro (OAuth), el CRM podrá acceder a tus correos y enviar mensajes en tu nombre. No necesitamos conocer tu contraseña.
                </p>
                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-6 border border-slate-200 dark:border-slate-700 flex flex-col items-center text-center max-w-md mx-auto">
                  <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-6">Conectar cuenta de Google</h3>
                  <button 
                    onClick={handleConnect}
                    disabled={googleLoading}
                    className="flex items-center justify-center gap-3 bg-white border border-gray-300 text-gray-700 font-medium py-3 px-6 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors shadow-sm w-full sm:w-auto mx-auto disabled:opacity-50"
                  >
                    {googleLoading ? (
                      <span className="text-sm">Conectando...</span>
                    ) : (
                      <>
                        <svg width="20" height="20" viewBox="0 0 48 48">
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
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex overflow-hidden">
               {/* Sidebar (List of correos) */}
               <div className="w-[450px] shrink-0 border-r border-gray-200 bg-white dark:bg-slate-800 flex flex-col h-full overflow-hidden">
                  {error && (
                    <div className="m-4 bg-red-50 border border-red-200 text-red-600 rounded-lg p-3 text-sm flex items-start gap-2 shrink-0">
                      <AlertCircle className="w-5 h-5 shrink-0" />
                      <div>
                        {error}
                        <button onClick={handleConnect} className="mt-2 text-red-700 underline font-medium block">
                          Volver a conectar
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex-1 overflow-y-auto">
                    {loading && messages.length === 0 ? (
                      <div className="p-8 flex flex-col items-center justify-center text-center text-gray-400 h-full">
                        <RefreshCw className="w-8 h-8 animate-spin mb-4 text-blue-500" />
                        <p>Cargando bandeja de entrada...</p>
                      </div>
                    ) : messages.length === 0 && !error ? (
                      <div className="p-8 text-center text-gray-500 dark:text-slate-400 flex flex-col items-center">
                        <Inbox className="w-12 h-12 text-gray-300 mb-3" />
                        <p>Tu bandeja está vacía</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-100">
                        {messages.map(msg => {
                          const isSelected = selectedEmail?.id === msg.id;
                          let dateFormatted = '';
                          try {
                            const dateObj = new Date(msg.date);
                            if (!isNaN(dateObj.getTime())) {
                              dateFormatted = format(dateObj, "dd MMM", { locale: es });
                            } else {
                              dateFormatted = msg.date || '';
                            }
                          } catch (e) {
                            dateFormatted = msg.date.slice(0, 10);
                          }
                          return (
                            <div 
                              key={msg.id} 
                              onClick={() => setSelectedEmail(msg)}
                              className={clsx(
                                "p-4 cursor-pointer hover:bg-gray-50 dark:bg-slate-900 transition-colors relative border-l-4",
                                isSelected ? "bg-blue-50/50 border-blue-500" : "border-transparent",
                                msg.unread ? "font-bold text-gray-900 dark:text-slate-100" : "text-gray-600 dark:text-slate-400"
                              )}
                            >
                              <div className="flex justify-between items-baseline mb-1">
                                <span className={clsx("truncate pr-4 text-sm", msg.unread && "text-blue-700")}>{(msg.from || '').split('<')[0].replace(/"/g, '').trim()}</span>
                                <span className={clsx("text-xs shrink-0", msg.unread ? "text-blue-600" : "text-gray-400")}>{dateFormatted}</span>
                              </div>
                              <h4 className={clsx("text-sm mb-1 truncate", msg.unread && "text-gray-900 dark:text-slate-100")}>{msg.subject}</h4>
                              <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{decodeHTMLEntities(msg.snippet)}</p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
               </div>
               
               {/* Main Pane (Reading View) */}
               <div className="flex-1 bg-white dark:bg-slate-800 flex flex-col overflow-hidden relative">
                 {selectedEmail ? (
                   <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-slate-800">
                     <div className="shrink-0 p-6 border-b border-gray-100 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800/95 backdrop-blur-sm z-10">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-4">{selectedEmail.subject}</h2>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold uppercase shrink-0">
                               {String(selectedEmail.from || '?').charAt(0).toUpperCase()}
                            </div>
                            <div>
                               <div className="font-medium text-gray-900 dark:text-slate-100 text-sm">{selectedEmail.from}</div>
                               <div className="text-xs text-gray-500 dark:text-slate-400">
                                 {selectedEmail.date}
                               </div>
                            </div>
                          </div>
                        </div>
                     </div>
                     <div className="flex-1 overflow-y-auto p-8 relative isolate">
                        {selectedEmail.bodyHtml ? (
                          <div 
                            className="text-sm text-gray-800 dark:text-slate-200 leading-relaxed max-w-4xl prose prose-blue prose-sm marker:text-gray-400 prose-a:text-blue-600 hover:prose-a:text-blue-700" 
                            dangerouslySetInnerHTML={{ __html: selectedEmail.bodyHtml }} 
                          />
                        ) : selectedEmail.bodyPlain ? (
                          <div className="text-sm text-gray-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap font-sans max-w-4xl">
                            {selectedEmail.bodyPlain}
                          </div>
                        ) : (
                          <div className="flex items-center justify-center h-40 text-gray-400 italic">
                            (No se pudo cargar el cuerpo del correo)
                          </div>
                        )}
                     </div>
                   </div>
                 ) : (
                   <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-gray-50 dark:bg-slate-900/50">
                     <FileText className="w-16 h-16 text-gray-200 mb-4" />
                     <p className="text-lg">Selecciona un correo para leerlo</p>
                   </div>
                 )}
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
