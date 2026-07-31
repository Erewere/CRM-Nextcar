import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Mail, RefreshCw, AlertCircle, FileText, Send, Plus, X, Reply, Search, CheckCircle2 } from 'lucide-react';
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
  const { googleToken, connectGoogleServices, disconnectGoogleServices, currentUser } = useAuth();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<EmailMessage | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Compose Modal State
  const [showCompose, setShowCompose] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeThreadId, setComposeThreadId] = useState<string | undefined>(undefined);
  const [sending, setSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);

  const fetchEmails = async () => {
    if (!googleToken) return;
    setLoading(true);
    setError(null);
    try {
      // Fetch message list
      const listRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=25&q=in:inbox', {
        headers: { 'Authorization': `Bearer ${googleToken}` }
      });
      if (!listRes.ok) {
        if (listRes.status === 401 || listRes.status === 403) {
           setError('Tu sesión de Google expiró o requiere volver a autenticarte.');
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
                if (!html && subBody.plain) plain = subBody.plain;
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

  const handleOpenCompose = (replyToEmail?: string, replySubject?: string, threadId?: string) => {
    if (replyToEmail) {
      // Extract pure email address if formatted like "John Doe <john@example.com>"
      const match = replyToEmail.match(/<([^>]+)>/);
      const cleanEmail = match ? match[1] : replyToEmail;
      setComposeTo(cleanEmail);
      setComposeSubject(replySubject ? (replySubject.startsWith('Re:') ? replySubject : `Re: ${replySubject}`) : '');
      setComposeThreadId(threadId);
    } else {
      setComposeTo('');
      setComposeSubject('');
      setComposeThreadId(undefined);
    }
    setComposeBody('');
    setSendSuccess(false);
    setShowCompose(true);
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleToken) {
      alert('Debes estar conectado a tu cuenta de Google.');
      return;
    }
    if (!composeTo || !composeSubject) {
      alert('Por favor completa el destinatario y el asunto.');
      return;
    }

    setSending(true);
    try {
      let emailLines = [
        `To: ${composeTo}`,
        `Subject: =?utf-8?B?${btoa(unescape(encodeURIComponent(composeSubject)))}?=`,
        `Content-Type: text/html; charset=utf-8`,
        `MIME-Version: 1.0`,
      ];
      emailLines.push('');
      emailLines.push(composeBody.replace(/\n/g, '<br/>'));

      const emailStr = emailLines.join('\r\n');
      const base64Encoded = btoa(unescape(encodeURIComponent(emailStr)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const payload: any = { raw: base64Encoded };
      if (composeThreadId) {
        payload.threadId = composeThreadId;
      }

      const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${googleToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error?.message || 'No se pudo enviar el correo.');
      }

      setSendSuccess(true);
      setTimeout(() => {
        setShowCompose(false);
        setSendSuccess(false);
        fetchEmails();
      }, 1500);
    } catch (err: any) {
      console.error('Error sending email:', err);
      alert('Error al enviar correo: ' + err.message);
    } finally {
      setSending(false);
    }
  };

  const filteredMessages = messages.filter(m => 
    searchQuery === '' ||
    m.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.from.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.snippet.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-[calc(100vh-8rem)] min-h-[600px] flex flex-col items-stretch overflow-hidden bg-white dark:bg-slate-800 rounded shadow-sm border border-gray-200 dark:border-slate-700">
      {/* Top Bar */}
      <div className="p-4 border-b border-gray-200 dark:border-slate-700 shrink-0 bg-white dark:bg-slate-800 flex items-center justify-between z-10 relative">
        <div className="flex items-center gap-3">
          <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">Bandeja de Entrada - Gmail</h1>
          {googleToken && currentUser?.email && (
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-medium rounded-full border border-emerald-200 dark:border-emerald-800">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              {currentUser.email}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {googleToken && (
             <>
               <button
                 onClick={() => handleOpenCompose()}
                 className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded shadow-sm transition-all focus:ring-2 focus:ring-blue-300"
               >
                 <Plus className="w-4 h-4" />
                 Redactar Correo
               </button>

               <button
                 onClick={fetchEmails}
                 disabled={loading}
                 className="flex items-center justify-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 border border-gray-300 dark:border-slate-600 text-sm font-medium rounded hover:bg-gray-50 dark:hover:bg-slate-700 shadow-sm transition-all focus:ring-2 focus:ring-blue-100 disabled:opacity-50"
                 title="Actualizar bandeja"
               >
                 <RefreshCw className={clsx("w-4 h-4", loading && "animate-spin")} />
                 <span className="hidden md:inline">Actualizar</span>
               </button>

               <button
                 onClick={() => disconnectGoogleServices()}
                 className="flex items-center justify-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 text-red-600 border border-gray-300 dark:border-slate-600 text-sm font-medium rounded hover:bg-red-50 dark:hover:bg-red-900/20 shadow-sm transition-all focus:ring-2 focus:ring-red-100"
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
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-8 max-w-xl w-full my-8">
                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-6 shadow-sm border border-blue-200 dark:border-blue-800/50 mx-auto">
                  <Mail className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-slate-200 mb-3">Sincroniza tu correo de Google</h2>
                <p className="text-gray-600 dark:text-slate-400 text-sm mb-6 leading-relaxed max-w-md mx-auto">
                  Conecta tu cuenta personal de Google para leer y enviar correos de Gmail directamente desde el CRM. Cada usuario administra su propia cuenta de forma privada.
                </p>
                <div className="bg-slate-50 dark:bg-slate-900/60 rounded-lg p-6 border border-gray-200 dark:border-slate-700 flex flex-col items-center text-center max-w-md mx-auto">
                  <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-4">Iniciar sincronización segura</h3>
                  <button 
                    onClick={handleConnect}
                    disabled={googleLoading}
                    className="flex items-center justify-center gap-3 bg-white hover:bg-gray-50 text-gray-700 font-semibold py-3 px-6 rounded border border-gray-300 shadow-sm focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all w-full sm:w-auto mx-auto disabled:opacity-50"
                  >
                    {googleLoading ? (
                      <span className="text-sm">Abriendo ventana de Google...</span>
                    ) : (
                      <>
                        <svg width="20" height="20" viewBox="0 0 48 48">
                          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                          <path fill="none" d="M0 0h48v48H0z"></path>
                        </svg>
                        <span className="text-sm">Conectar con Google</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex overflow-hidden">
               {/* Sidebar (List of correos) */}
               <div className="w-full md:w-[400px] shrink-0 border-r border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col h-full overflow-hidden">
                  {/* Search Bar */}
                  <div className="p-3 border-b border-gray-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                    <div className="relative">
                      <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                      <input 
                        type="text" 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Buscar en correos..."
                        className="w-full pl-9 pr-3 py-1.5 text-sm bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-slate-200"
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="m-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-300 rounded p-3 text-sm flex items-start gap-2 shrink-0">
                      <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                      <div>
                        {error}
                        <button onClick={handleConnect} className="mt-2 text-red-700 dark:text-red-400 underline font-semibold block">
                          Volver a conectar
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex-1 overflow-y-auto">
                    {loading && messages.length === 0 ? (
                      <div className="p-8 flex flex-col items-center justify-center text-center text-gray-400 h-full">
                        <RefreshCw className="w-8 h-8 animate-spin mb-4 text-blue-500" />
                        <p className="text-sm">Cargando tu bandeja de entrada...</p>
                      </div>
                    ) : filteredMessages.length === 0 && !error ? (
                      <div className="p-8 text-center text-gray-500 dark:text-slate-400 flex flex-col items-center">
                        <Mail className="w-12 h-12 text-gray-300 dark:text-slate-600 mb-3" />
                        <p className="text-sm font-medium">No hay mensajes disponibles</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-100 dark:divide-slate-700/50">
                        {filteredMessages.map(msg => {
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
                              key={`msg-${msg.id}`} 
                              onClick={() => setSelectedEmail(msg)}
                              className={clsx(
                                "p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors relative border-l-4",
                                isSelected ? "bg-blue-50/60 dark:bg-slate-700/80 border-blue-600" : "border-transparent",
                                msg.unread ? "font-bold text-gray-900 dark:text-slate-100" : "text-gray-600 dark:text-slate-400"
                              )}
                            >
                              <div className="flex justify-between items-baseline mb-1">
                                <span className={clsx("truncate pr-4 text-sm font-medium", msg.unread && "text-blue-700 dark:text-blue-400")}>{(msg.from || '').split('<')[0].replace(/"/g, '').trim()}</span>
                                <span className={clsx("text-xs shrink-0", msg.unread ? "text-blue-600 dark:text-blue-400 font-semibold" : "text-gray-400")}>{dateFormatted}</span>
                              </div>
                              <h4 className={clsx("text-sm mb-1 truncate font-medium", msg.unread && "text-gray-900 dark:text-slate-100")}>{msg.subject}</h4>
                              <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{decodeHTMLEntities(msg.snippet)}</p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
               </div>
               
               {/* Main Pane (Reading View) */}
               <div className="hidden md:flex flex-1 bg-white dark:bg-slate-800 flex-col overflow-hidden relative">
                  {selectedEmail ? (
                    <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-slate-800">
                      <div className="shrink-0 p-6 border-b border-gray-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800/95 backdrop-blur-sm z-10 flex items-start justify-between gap-4">
                         <div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-2">{selectedEmail.subject}</h2>
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 font-bold uppercase shrink-0 flex items-center justify-center">
                                 {String(selectedEmail.from || '?').charAt(0).toUpperCase()}
                              </div>
                              <div>
                                 <div className="font-semibold text-gray-900 dark:text-slate-100 text-sm">{selectedEmail.from}</div>
                                 <div className="text-xs text-gray-500 dark:text-slate-400">
                                   {selectedEmail.date}
                                 </div>
                              </div>
                            </div>
                         </div>

                         <button
                           onClick={() => handleOpenCompose(selectedEmail.from, selectedEmail.subject, selectedEmail.threadId)}
                           className="flex items-center gap-2 px-3.5 py-2 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded text-sm font-semibold transition-colors shrink-0"
                         >
                           <Reply className="w-4 h-4" />
                           Responder
                         </button>
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
                      <FileText className="w-16 h-16 text-gray-300 dark:text-slate-700 mb-4" />
                      <p className="text-base font-medium text-slate-600 dark:text-slate-400">Selecciona un correo para leerlo</p>
                    </div>
                  )}
               </div>
            </div>
          )}
        </div>
      </div>

      {/* Compose Email Modal */}
      {showCompose && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-gray-200 dark:border-slate-700 w-full max-w-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Send className="w-4 h-4 text-blue-600" />
                {composeThreadId ? 'Responder Correo' : 'Redactar Nuevo Correo'}
              </h3>
              <button 
                onClick={() => setShowCompose(false)} 
                className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSendEmail} className="p-6 flex flex-col gap-4">
              {sendSuccess ? (
                <div className="py-8 text-center flex flex-col items-center justify-center">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-3 animate-bounce" />
                  <p className="text-lg font-bold text-slate-800 dark:text-slate-100">¡Correo enviado con éxito!</p>
                  <p className="text-xs text-slate-500 mt-1">Se ha enviado usando tu cuenta de Gmail.</p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">Para (Destinatario)</label>
                    <input 
                      type="email" 
                      required
                      value={composeTo}
                      onChange={(e) => setComposeTo(e.target.value)}
                      placeholder="correo@ejemplo.com"
                      className="w-full border border-gray-300 dark:border-slate-600 rounded p-2 text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">Asunto</label>
                    <input 
                      type="text" 
                      required
                      value={composeSubject}
                      onChange={(e) => setComposeSubject(e.target.value)}
                      placeholder="Asunto del correo"
                      className="w-full border border-gray-300 dark:border-slate-600 rounded p-2 text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">Mensaje</label>
                    <textarea 
                      required
                      rows={8}
                      value={composeBody}
                      onChange={(e) => setComposeBody(e.target.value)}
                      placeholder="Escribe tu mensaje aquí..."
                      className="w-full border border-gray-300 dark:border-slate-600 rounded p-3 text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-3 mt-2">
                    <button
                      type="button"
                      onClick={() => setShowCompose(false)}
                      className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded text-slate-700 dark:text-slate-300 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 font-medium"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={sending}
                      className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded shadow transition-all"
                    >
                      {sending ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          Enviar Correo
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
