import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { getApiUrl } from '../lib/api';
import { MessageCircle, Send, ArrowLeft, Clock, AlertCircle, UserCheck, ExternalLink, PanelRight } from 'lucide-react';
import clsx from 'clsx';
import { ChatClientPanel } from './ChatClientPanel';

type Canal = 'whatsapp' | 'messenger';

interface WaMessage {
  id: string;
  clientId: string;
  direction: 'inbound' | 'outbound';
  text: string;
  createdAt: string;
  status?: string;
  sentByName?: string;
  // Los mensajes guardados antes de que existiera Messenger no traen canal:
  // todos eran de WhatsApp.
  channel?: Canal;
}

interface ClientLite {
  id: string;
  name?: string;
  phone?: string;
  sellerId?: string;
  lastWhatsappInboundAt?: string;
  lastMessengerInboundAt?: string;
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
  const [sellers, setSellers] = useState<{ id: string; name?: string }[]>([]);
  const [assigning, setAssigning] = useState(false);
  const [filtro, setFiltro] = useState<'todos' | Canal>('todos');
  // En pantallas anchas la ficha se ve siempre; en las angostas se abre y cierra
  // para no comerse la conversación.
  const [fichaAbierta, setFichaAbierta] = useState(false);
  const feedEndRef = useRef<HTMLDivElement>(null);
  const isAdmin = userData?.role === 'admin' || userData?.role === 'master';

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

  useEffect(() => {
    if (!userData?.agencyId || !isAdmin) return;
    const q = query(collection(db, 'users'), where('agencyId', '==', userData.agencyId));
    const unsub = onSnapshot(q, (snap) => {
      setSellers(snap.docs
        .map(d => ({ id: d.id, ...(d.data() as any) }))
        .filter((u: any) => u.role === 'seller')
        .map((u: any) => ({ id: u.id, name: u.name || u.email })));
    }, (err) => console.error('Error cargando vendedores:', err));
    return () => unsub();
  }, [userData?.agencyId, isAdmin]);

  const handleAssign = async (sellerId: string) => {
    if (!activeClientId || !currentUser) return;
    setAssigning(true);
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch(getApiUrl('/api/clients/assign-seller'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ clientId: activeClientId, sellerId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al asignar');
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'Error al asignar la conversación');
    } finally {
      setAssigning(false);
    }
  };

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
        const last = sorted[sorted.length - 1];
        return { clientId, messages: sorted, last, canal: (last.channel || 'whatsapp') as Canal };
      })
      .sort((a, b) => new Date(b.last.createdAt).getTime() - new Date(a.last.createdAt).getTime());
  }, [visibleMessages]);

  const conteo = useMemo(() => ({
    todos: conversations.length,
    whatsapp: conversations.filter(c => c.canal === 'whatsapp').length,
    messenger: conversations.filter(c => c.canal === 'messenger').length,
  }), [conversations]);

  const conversacionesVisibles = useMemo(
    () => filtro === 'todos' ? conversations : conversations.filter(c => c.canal === filtro),
    [conversations, filtro]
  );

  const activeConversation = conversations.find(c => c.clientId === activeClientId) || null;
  const activeClient = activeClientId ? clients[activeClientId] : null;
  const canalActivo = activeConversation?.canal || 'whatsapp';
  // Cada canal tiene su propia ventana de 24 h: que el cliente escriba por
  // WhatsApp no reabre la de Messenger ni al revés.
  const windowLeft = hoursLeft(
    canalActivo === 'messenger' ? activeClient?.lastMessengerInboundAt : activeClient?.lastWhatsappInboundAt
  );
  const windowOpen = windowLeft !== null && windowLeft > 0;

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConversation?.messages.length, activeClientId]);

  // Cada canal tiene su propia API: WhatsApp le habla a un numero, Messenger a
  // la pagina. Quien escribe no tiene por que saberlo.
  const enviarTexto = async (texto: string) => {
    if (!texto.trim() || !activeClientId || !currentUser) return;
    setSending(true);
    try {
      const token = await currentUser.getIdToken();
      const ruta = canalActivo === 'messenger' ? '/api/meta/send-messenger' : '/api/meta/send-message';
      const res = await fetch(getApiUrl(ruta), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ clientId: activeClientId, text: texto.trim() }),
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

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    await enviarTexto(inputText);
  };

  // El saludo que pide los datos. Existe porque en Messenger Meta no da telefono
  // ni nombre real y el vendedor los tiene que pedir en cada conversacion: sin
  // esto, los teclea a mano cada vez y cada quien pregunta distinto.
  const SALUDO = '¡Hola! Gracias por escribirnos 🚗 Para poder ayudarte mejor, ' +
    '¿me compartes tu nombre completo, tu teléfono y tu correo? Con esos datos te ' +
    'paso la información del auto que te interese.';

  return (
    <div className="h-full flex flex-col md:flex-row overflow-hidden">
      {/* Lista de conversaciones */}
      <div className={clsx(
        "w-full md:w-80 bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 flex flex-col shrink-0 overflow-hidden",
        activeClientId && "hidden md:flex"
      )}>
        {/* Filtro por canal, al estilo del buzón de Meta: la misma lista, pero
            pudiendo ver solo WhatsApp o solo Messenger. */}
        <div className="flex gap-1 p-2 border-b border-gray-200 dark:border-slate-800 shrink-0">
          {([
            { id: 'todos', etiqueta: 'Todos' },
            { id: 'whatsapp', etiqueta: 'WhatsApp' },
            { id: 'messenger', etiqueta: 'Messenger' },
          ] as const).map(op => (
            <button
              key={op.id}
              onClick={() => setFiltro(op.id)}
              className={clsx(
                "px-2.5 py-1.5 rounded text-xs font-bold transition-colors flex items-center gap-1.5",
                filtro === op.id
                  ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900"
                  : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
            >
              {op.etiqueta}
              {conteo[op.id] > 0 && (
                <span className={clsx(
                  "text-[10px] px-1.5 rounded-full",
                  filtro === op.id ? "bg-white/20 dark:bg-slate-900/20" : "bg-slate-200 dark:bg-slate-700"
                )}>
                  {conteo[op.id]}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
          {loading ? (
            <div className="p-6 text-center text-sm text-slate-500">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-green-500 border-t-transparent mx-auto mb-2" />
              Cargando conversaciones...
            </div>
          ) : conversacionesVisibles.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-400">
              Aún no hay conversaciones{filtro !== 'todos' ? ` de ${filtro === 'whatsapp' ? 'WhatsApp' : 'Messenger'}` : ''}.
              <p className="text-xs text-slate-500 mt-2">
                Aparecerán aquí en cuanto un cliente escriba al número o a la página del negocio.
              </p>
            </div>
          ) : (
            conversacionesVisibles.map(conv => {
              const c = clients[conv.clientId];
              const nombre = c?.name || 'Contacto';
              const left = hoursLeft(
                conv.canal === 'messenger' ? c?.lastMessengerInboundAt : c?.lastWhatsappInboundAt
              );
              const esMessenger = conv.canal === 'messenger';
              return (
                <button
                  key={conv.clientId}
                  onClick={() => setActiveClientId(conv.clientId)}
                  className={clsx(
                    "w-full text-left p-4 hover:bg-[#f4f5f5] dark:hover:bg-slate-800/40 transition-colors flex items-center gap-3",
                    activeClientId === conv.clientId && "bg-green-50/60 dark:bg-slate-800/80"
                  )}
                >
                  <div className={clsx(
                    "w-10 h-10 rounded-full flex items-center justify-center font-bold border shrink-0",
                    esMessenger
                      ? "bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900/40"
                      : "bg-green-50 dark:bg-green-950/50 text-green-600 dark:text-green-400 border-green-100 dark:border-green-900/40"
                  )}>
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
                    {filtro === 'todos' && (
                      <span className={clsx(
                        "inline-flex items-center mt-1 mr-2 text-[10px] font-semibold",
                        esMessenger ? "text-blue-600 dark:text-blue-400" : "text-green-600 dark:text-green-400"
                      )}>
                        {esMessenger ? 'Messenger' : 'WhatsApp'}
                      </span>
                    )}
                    {!c?.sellerId && (
                      <span className="inline-flex items-center gap-1 mt-1 mr-2 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                        <UserCheck className="w-3 h-3" /> Sin asignar
                      </span>
                    )}
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
        !activeClientId && "hidden md:flex",
        fichaAbierta && "hidden xl:flex"
      )}>
        {activeConversation && activeClient ? (
          <>
            <div className="p-4 border-b border-gray-200 dark:border-slate-800 flex items-center gap-3 bg-[#f4f5f5]/50 dark:bg-slate-950/20 shrink-0">
              <button onClick={() => setActiveClientId(null)} className="p-1 text-slate-400 hover:text-slate-700 md:hidden">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className={clsx(
                "w-10 h-10 rounded-full flex items-center justify-center font-bold border shrink-0",
                canalActivo === 'messenger'
                  ? "bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900/40"
                  : "bg-green-50 dark:bg-green-950/50 text-green-600 dark:text-green-400 border-green-100 dark:border-green-900/40"
              )}>
                {(activeClient.name || 'C').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <h3 className="font-extrabold text-slate-800 dark:text-slate-100 truncate text-base">
                  {activeClient.name || 'Contacto'}
                </h3>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <span className={clsx("w-2 h-2 rounded-full", windowOpen ? "bg-emerald-500" : "bg-amber-500")} />
                  {canalActivo === 'messenger'
                    ? (activeClient.phone || 'Sin teléfono aún') + ' · Messenger'
                    : (activeClient.phone || 'Sin teléfono') + ' · WhatsApp'}
                </div>
              </div>

              <button
                onClick={() => setFichaAbierta(true)}
                className="ml-auto p-2 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 xl:hidden shrink-0"
                title="Ver la ficha del contacto"
              >
                <PanelRight className="w-5 h-5" />
              </button>

              {isAdmin && (
                <div className="flex items-center gap-2 shrink-0 xl:ml-auto">
                  <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:inline">Atiende:</span>
                  <select
                    value={activeClient.sellerId || ''}
                    disabled={assigning}
                    onChange={(e) => handleAssign(e.target.value)}
                    className="text-xs px-2 py-1.5 border border-gray-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-50"
                  >
                    <option value="">Sin asignar</option>
                    {sellers.map(v => (
                      <option key={v.id} value={v.id}>{v.name || v.id}</option>
                    ))}
                  </select>
                </div>
              )}
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
                {/* Un clic en vez de teclear el mismo saludo en cada conversación. */}
                <button
                  type="button"
                  onClick={() => enviarTexto(SALUDO)}
                  disabled={sending}
                  className="mb-3 px-3 py-1.5 rounded-full border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:border-green-500 hover:text-green-700 dark:hover:text-green-400 disabled:opacity-50"
                >
                  👋 Saludar y pedir sus datos
                </button>
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
                {canalActivo === 'messenger' ? (
                  <span>
                    Pasaron más de 24 horas desde su último mensaje y Messenger no permite
                    retomarlo desde aquí — no hay plantillas como en WhatsApp. Si tienes su
                    teléfono, escríbele por WhatsApp desde la ficha; si no, queda esperar a que
                    él escriba.{' '}
                    <a
                      href="https://business.facebook.com/latest/inbox/messenger"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold underline inline-flex items-center gap-1"
                    >
                      Abrir el buzón de Meta <ExternalLink className="w-3 h-3" />
                    </a>
                  </span>
                ) : (
                  <span>
                    Pasaron más de 24 horas desde el último mensaje del cliente. WhatsApp solo permite
                    responder con texto libre dentro de ese plazo; para retomar la conversación hay que
                    enviarle una plantilla aprobada — el botón <strong>Escribirle por WhatsApp</strong> de
                    la ficha te ofrece las tuyas.
                  </span>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
            <div className="w-16 h-16 rounded bg-[#f4f5f5] dark:bg-slate-800 flex items-center justify-center mb-4 text-green-500 border">
              <MessageCircle className="w-8 h-8" />
            </div>
            <h3 className="font-bold text-slate-700 dark:text-slate-300 mb-1">Conversaciones con clientes</h3>
            <p className="text-sm text-slate-500 max-w-sm">
              Selecciona un contacto de la izquierda para ver la conversación y darle seguimiento.
            </p>
          </div>
        )}
      </div>

      {/* Ficha del contacto: se captura el teléfono, se le asigna el auto y se
          convierte en trato sin salir de la conversación. */}
      {activeClientId && (
        <div className={clsx(
          "w-full md:w-80 border-l border-gray-200 dark:border-slate-800 shrink-0 overflow-hidden",
          fichaAbierta ? "flex" : "hidden xl:flex"
        )}>
          <ChatClientPanel
            clientId={activeClientId}
            canal={canalActivo}
            onCerrar={() => setFichaAbierta(false)}
          />
        </div>
      )}
    </div>
  );
}
