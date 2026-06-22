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
  const { googleToken, connectGoogleServices } = useAuth();
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
          const headers = msgData.payload.headers;
          const subjectHeader = headers.find((h: any) => h.name.toLowerCase() === 'subject');
          const fromHeader = headers.find((h: any) => h.name.toLowerCase() === 'from');
          const dateHeader = headers.find((h: any) => h.name.toLowerCase() === 'date');
          
          const getBody = (payload: any): { html?: string, plain?: string } => {
            let html = '';
            let plain = '';
            if (payload.mimeType === 'text/plain' && payload.body.data) {
              plain = atob(payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
            } else if (payload.mimeType === 'text/html' && payload.body.data) {
              html = atob(payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
            } else if (payload.parts) {
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
    try {
      const gToken = await connectGoogleServices();
      // token sync will trigger useEffect
    } catch (error) {
      console.error("Connect Google Services Error:", error);
    }
  };

  const decodeHTMLEntities = (text: string) => {
    const textArea = document.createElement('textarea');
    textArea.innerHTML = text;
    return textArea.value;
  };

  return (
    <div className="flex-1 flex flex-col items-stretch overflow-hidden bg-white">
      <div className="px-8 py-6 border-b border-gray-200 shrink-0 bg-white shadow-sm flex items-center justify-between z-10 relative">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Mail className="w-8 h-8 text-blue-600" />
            Correos Electrónicos
          </h1>
          <p className="text-gray-500 mt-1 flex items-center gap-2">
            Gestiona tu bandeja de entrada sincronizada.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {googleToken && (
             <button
               onClick={fetchEmails}
               disabled={loading}
               className="flex items-center justify-center gap-2 px-4 py-2 bg-white text-gray-700 border border-gray-300 font-medium rounded-lg hover:bg-gray-50 shadow-sm transition-all focus:ring-2 focus:ring-blue-100 disabled:opacity-50"
             >
               <RefreshCw className={clsx("w-4 h-4", loading && "animate-spin")} />
               Actualizar
             </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative">
        <div className="absolute inset-0 bg-gray-50 flex items-stretch">
          {!googleToken ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
              <div className="w-20 h-20 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center mb-6 shadow-sm border border-blue-100">
                <Mail className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-3">Conecta tu cuenta de Gmail</h2>
              <p className="text-gray-500 max-w-md mx-auto mb-8 leading-relaxed">
                Para poder leer y enviar correos, debes sincronizar tu cuenta de Google Workspace para conceder permisos de acceso a Gmail.
              </p>
              <button 
                onClick={handleConnect}
                className="bg-[#4285F4] hover:bg-[#3367d6] text-white px-6 py-3 rounded-lg font-medium shadow-md transition-all flex items-center gap-3"
              >
                <svg className="w-5 h-5 bg-white rounded-full p-0.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/><path d="M1 1h22v22H1z" fill="none"/></svg>
                Conectar Workspace
              </button>
            </div>
          ) : (
            <div className="flex-1 flex overflow-hidden">
               {/* Sidebar (List of correos) */}
               <div className="w-[450px] shrink-0 border-r border-gray-200 bg-white flex flex-col h-full overflow-hidden">
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
                      <div className="p-8 text-center text-gray-500 flex flex-col items-center">
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
                            dateFormatted = format(dateObj, "dd MMM", { locale: es });
                          } catch (e) {
                            dateFormatted = msg.date.slice(0, 10);
                          }
                          return (
                            <div 
                              key={msg.id} 
                              onClick={() => setSelectedEmail(msg)}
                              className={clsx(
                                "p-4 cursor-pointer hover:bg-gray-50 transition-colors relative border-l-4",
                                isSelected ? "bg-blue-50/50 border-blue-500" : "border-transparent",
                                msg.unread ? "font-bold text-gray-900" : "text-gray-600"
                              )}
                            >
                              <div className="flex justify-between items-baseline mb-1">
                                <span className={clsx("truncate pr-4 text-sm", msg.unread && "text-blue-700")}>{msg.from.split('<')[0].replace(/"/g, '').trim()}</span>
                                <span className={clsx("text-xs shrink-0", msg.unread ? "text-blue-600" : "text-gray-400")}>{dateFormatted}</span>
                              </div>
                              <h4 className={clsx("text-sm mb-1 truncate", msg.unread && "text-gray-900")}>{msg.subject}</h4>
                              <p className="text-xs text-gray-500 truncate">{decodeHTMLEntities(msg.snippet)}</p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
               </div>
               
               {/* Main Pane (Reading View) */}
               <div className="flex-1 bg-white flex flex-col overflow-hidden relative">
                 {selectedEmail ? (
                   <div className="flex-1 flex flex-col overflow-hidden bg-white">
                     <div className="shrink-0 p-6 border-b border-gray-100 sticky top-0 bg-white/95 backdrop-blur-sm z-10">
                        <h2 className="text-xl font-bold text-gray-900 mb-4">{selectedEmail.subject}</h2>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold uppercase shrink-0">
                               {selectedEmail.from.charAt(0)}
                            </div>
                            <div>
                               <div className="font-medium text-gray-900 text-sm">{selectedEmail.from}</div>
                               <div className="text-xs text-gray-500">
                                 {selectedEmail.date}
                               </div>
                            </div>
                          </div>
                        </div>
                     </div>
                     <div className="flex-1 overflow-y-auto p-8 relative isolate">
                        {selectedEmail.bodyHtml ? (
                          <div 
                            className="text-sm text-gray-800 leading-relaxed max-w-4xl prose prose-blue prose-sm marker:text-gray-400 prose-a:text-blue-600 hover:prose-a:text-blue-700" 
                            dangerouslySetInnerHTML={{ __html: selectedEmail.bodyHtml }} 
                          />
                        ) : selectedEmail.bodyPlain ? (
                          <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap font-sans max-w-4xl">
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
                   <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-gray-50/50">
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
