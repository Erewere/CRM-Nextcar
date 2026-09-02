import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { getApiUrl } from '../lib/api';
import { MessageCircle, Send, ArrowLeft, Clock, AlertCircle } from 'lucide-react';
import clsx from 'clsx';

interface WaMessage {
  id: string;
  clientId: string;
  direction: 'inbound' | 'outbound';
  text: string;
  createdAt: string;
  status?: string;
  sentByName?: string;
}

interface ClientLite {
  id: string;
  name?: string;
  phone?: string;
  sellerId?: string;
  lastWhatsappInboundAt?: string;
  isDeleted?: boolean;
}

// Meta only delivers free-form replies within 24 h of the customer's last
// message. Outside it the send is rejected, so the composer has to know.
const WINDOW_MS = 24 * 60 * 60 * 1000;

function hoursLeft(lastInboundAt?: string): number | null {
  if (!lastInboundAt) return null;
  const left = new Date(lastInboundAt).getTime() + WINDOW_MS - Date.now();
  return left > 0 ? left / 3600000 : 0;
}

export function WhatsAppChat() {
  const { userData, currentUser } = useAuth();
  const [messages, setMessages] = useState<WaMessage[]>([]);
  const [clients, setClients] = useState<Record<string, ClientLite>>({});
  const [activeClientId, setActiveClientId] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const feedEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userData?.agencyId) return;
    const q = query(collection(db, 'whatsappMessages'), where('agencyId', '==', userData.agencyId));
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() } as WaMessage)));
      setLoading(false);
    }, (err) => {
      console.error('Error cargando mensajes de WhatsApp:', err);
      setLoading(false);
    });
    return () => unsub();
  }, [userData?.agencyId]);

  useEffect(() => {
    if (!userData?.agencyId) return;
    const q = query(collection(db, 'clients'), where('agencyId', '==', userData.agencyId));
    const unsub = onSnapshot(q, (snap) => {
      const map: Record<string, ClientLite> = {};
      snap.docs.forEach(d => { map[d.id] = { id: d.id, ...d.data() } as ClientLite; });
      setClients(map);
    }, (err) => console.error('Error cargando contactos:', err));
    return () => unsub();
  }, [userData?.agencyId]);

  // A seller only follows up their own clients; admins and master see everything.
  const visibleMessages = useMemo(() => {
    if (userData?.role !== 'seller') return messages;
    return messages.filter(m => clients[m.clientId]?.sellerId === userData.id);
  }, [messages, clients, userData]);

  const conversations = useMemo(() => {
    const byClient: Record<string, WaMessage[]> = {};
    visibleMessages.forEach(m => {
      if (!byClient[m.clientId]) byClient[m.clientId] = [];
      byClient[m.clientId].push(m);
    });
    return Object.entries(byClient)
      .map(([clientId, msgs]) => {
        const sorted = [...msgs].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        return { clientId, messages: sorted, last: sorted[sorted.length - 1] };
      })
      .sort((a, b) => new Date(b.last.createdAt).getTime() - new Date(a.last.createdAt).getTime());
  }, [visibleMessages]);

  const activeConversation = conversations.find(c => c.clientId === activeClientId) || null;
  const activeClient = activeClientId ? clients[activeClientId] : null;
  const windowLeft = hoursLeft(activeClient?.lastWhatsappInboundAt);
  const windowOpen = windowLeft !== null && windowLeft > 0;

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConversation?.messages.length, activeClientId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeClientId || !currentUser) return;
    setSending(true);
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch(getApiUrl('/api/meta/send-message'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ clientId: activeClientId, text: inputText.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al enviar el mensaje');
      setInputText('');
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'Error al enviar el mensaje');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="h-full flex flex-col md:flex-row overflow-hidden">
      {/* Lista de conversaciones */}
      <div className={clsx(
        "w-full md:w-80 bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 flex flex-col shrink-0 overflow-hidden",
        activeClientId && "hidden md:flex"
      )}>
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
          {loading ? (
            <div className="p-6 text-center text-sm text-slate-500">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-green-500 border-t-transparent mx-auto mb-2" />
              Cargando conversaciones...
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-400">
              Aún no hay conversaciones de WhatsApp.
              <p className="text-xs text-slate-500 mt-2">
                Aparecerán aquí en cuanto un cliente escriba al número del negocio.
              </p>
            </div>
          ) : (
            conversations.map(conv => {
              const c = clients[conv.clientId];
              const nombre = c?.name || 'Contacto';
              const left = hoursLeft(c?.lastWhatsappInboundAt);
              return (
                <button
                  key={conv.clientId}
                  onClick={() => setActiveClientId(conv.clientId)}
                  className={clsx(
                    "w-full text-left p-4 hover:bg-[#f4f5f5] dark:hover:bg-slate-800/40 transition-colors flex items-center gap-3",
                    activeClientId === conv.clientId && "bg-green-50/60 dark:bg-slate-800/80"
                  )}
                >
                  <div className="w-10 h-10 rounded-full bg-green-50 dark:bg-green-950/50 flex items-center justify-center font-bold text-green-600 dark:text-green-400 border border-green-100 dark:border-green-900/40 shrink-0">
                    {nombre.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate pr-2">{nombre}</h4>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        {new Date(conv.last.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    <p className="text-xs truncate text-slate-500 dark:text-slate-400">
                      {conv.last.direction === 'outbound' ? 'Tú: ' : ''}{conv.last.text}
                    </p>
                    {left !== null && left > 0 && (
                      <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                        <Clock className="w-3 h-3" /> {Math.floor(left)} h para responder
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Conversación activa */}
      <div className={clsx(
        "flex-1 bg-white dark:bg-slate-900 flex flex-col overflow-hidden",
        !activeClientId && "hidden md:flex"
      )}>
        {activeConversation && activeClient ? (
          <>
            <div className="p-4 border-b border-gray-200 dark:border-slate-800 flex items-center gap-3 bg-[#f4f5f5]/50 dark:bg-slate-950/20 shrink-0">
              <button onClick={() => setActiveClientId(null)} className="p-1 text-slate-400 hover:text-slate-700 md:hidden">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="w-10 h-10 rounded-full bg-green-50 dark:bg-green-950/50 flex items-center justify-center font-bold text-green-600 dark:text-green-400 border border-green-100 dark:border-green-900/40 shrink-0">
                {(activeClient.name || 'C').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <h3 className="font-extrabold text-slate-800 dark:text-slate-100 truncate text-base">
                  {activeClient.name || 'Contacto'}
                </h3>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <span className={clsx("w-2 h-2 rounded-full", windowOpen ? "bg-emerald-500" : "bg-amber-500")} />
                  {activeClient.phone || 'Sin teléfono'} · WhatsApp
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-[#f4f5f5]/30 dark:bg-slate-950/10 space-y-4">
              {activeConversation.messages.map(m => {
                const isMine = m.direction === 'outbound';
                return (
                  <div key={m.id} className={clsx("flex flex-col max-w-[85%] md:max-w-[70%]", isMine ? "ml-auto items-end" : "mr-auto items-start")}>
                    <div className={clsx(
                      "px-4 py-2.5 rounded shadow-sm text-sm whitespace-pre-line leading-relaxed break-words [word-break:break-word]",
                      isMine
                        ? "bg-green-600 text-white rounded-tr-none"
                        : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-gray-200 dark:border-slate-700 rounded-tl-none"
                    )}>
                      {m.text}
                    </div>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 px-1">
                      {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {isMine && m.sentByName ? ` · ${m.sentByName}` : ''}
                    </span>
                  </div>
                );
              })}
              <div ref={feedEndRef} />
            </div>

            {windowOpen ? (
              <form onSubmit={handleSend} className="p-4 border-t border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                    disabled={sending}
                    placeholder="Escribe tu respuesta..."
                    className="flex-1 px-4 py-2.5 border rounded bg-[#f4f5f5] dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={!inputText.trim() || sending}
                    className="px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded shadow-sm transition-all flex items-center justify-center shrink-0 disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Quedan {Math.floor(windowLeft || 0)} horas para responder con texto libre.
                </p>
              </form>
            ) : (
              <div className="p-4 border-t border-gray-200 dark:border-slate-800 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 flex items-start gap-3 shrink-0 text-sm">
                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <span>
                  Pasaron más de 24 horas desde el último mensaje del cliente. WhatsApp solo permite
                  responder con texto libre dentro de ese plazo; para retomar la conversación hay que
                  enviarle una plantilla aprobada (por ejemplo, compartiéndole un vehículo desde Inventario).
                </span>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
            <div className="w-16 h-16 rounded bg-[#f4f5f5] dark:bg-slate-800 flex items-center justify-center mb-4 text-green-500 border">
              <MessageCircle className="w-8 h-8" />
            </div>
            <h3 className="font-bold text-slate-700 dark:text-slate-300 mb-1">Conversaciones de WhatsApp</h3>
            <p className="text-sm text-slate-500 max-w-sm">
              Selecciona un contacto de la izquierda para ver la conversación y darle seguimiento.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
