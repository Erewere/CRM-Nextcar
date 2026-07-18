import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { 
  collection, 
  doc, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  orderBy, 
  getDoc,
  getDocs
} from 'firebase/firestore';
import { MessageSquare, Send, ArrowLeft, Car, Info, ShieldAlert } from 'lucide-react';
import { useLocation } from 'react-router';
import clsx from 'clsx';

interface ChatRoom {
  id: string;
  participants: string[];
  lastMessage: string;
  lastMessageAt: string;
  unreadBy?: Record<string, boolean>;
}

interface Message {
  id: string;
  senderId: string;
  senderAgencyId: string;
  text: string;
  createdAt: string;
  vehicleId?: string;
}

export function Chats() {
  const { userData } = useAuth();
  const location = useLocation();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [chats, setChats] = useState<ChatRoom[]>([]);
  const [activeChat, setActiveChat] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [agencies, setAgencies] = useState<Record<string, { name: string; shareInventory: boolean }>>({});
  const [loading, setLoading] = useState(true);

  // Parse router state to open a chat automatically (from the vehicle modal redirection)
  const incomingChatId = location.state?.activeChatId;

  // Listen to all agencies for real-time name mapping & sharing status
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'agencies'), (snap) => {
      const mapping: Record<string, { name: string; shareInventory: boolean }> = {};
      snap.forEach(doc => {
        const data = doc.data();
        mapping[doc.id] = {
          name: data.name || 'Agencia',
          shareInventory: data.shareInventory === true
        };
      });
      setAgencies(mapping);
    }, (err) => {
      console.error("Error listening to agencies", err);
    });
    return () => unsubscribe();
  }, []);

  // Listen to agency chats where current user's agency is a participant
  useEffect(() => {
    if (!userData?.agencyId) {
      setLoading(false);
      return;
    }

    let qChats;
    if (userData.role === 'master') {
      // Master admin can see all chats
      qChats = query(collection(db, 'agencyChats'), orderBy('lastMessageAt', 'desc'));
    } else {
      // Normal admin/seller sees their agency's chats
      qChats = query(
        collection(db, 'agencyChats'), 
        where('participants', 'array-contains', userData.agencyId)
      );
    }

    const unsubscribe = onSnapshot(qChats, (snapshot) => {
      const list: ChatRoom[] = [];
      snapshot.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() } as ChatRoom);
      });
      
      // Sort by last message date desc in JS because composite indexes on array-contains + orderBy require configuration
      if (userData.role !== 'master') {
        list.sort((a, b) => new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime());
      }

      setChats(list);
      setLoading(false);

      // Handle automatic chat opening if passed in state
      if (incomingChatId) {
        const matched = list.find(c => c.id === incomingChatId);
        if (matched) {
          setActiveChat(matched);
        }
      }
    });

    return () => unsubscribe();
  }, [userData, incomingChatId]);

  // Listen to messages of the active chat
  useEffect(() => {
    if (!activeChat) {
      setMessages([]);
      return;
    }

    const mQuery = query(
      collection(db, 'agencyChats', activeChat.id, 'messages'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(mQuery, (snapshot) => {
      const list: Message[] = [];
      snapshot.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() } as Message);
      });
      setMessages(list);

      // Auto-scroll to bottom
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    });

    // Mark as read
    if (userData?.agencyId && activeChat.unreadBy?.[userData.agencyId]) {
      const chatRef = doc(db, 'agencyChats', activeChat.id);
      updateDoc(chatRef, {
        [`unreadBy.${userData.agencyId}`]: false
      }).catch(err => console.error("Error marking chat read", err));
    }

    return () => unsubscribe();
  }, [activeChat, userData]);

  // Check if any participant in the active chat has disabled inventory sharing
  const activeChatParticipants = activeChat?.participants || [];
  const anyParticipantDisabledSharing = activeChatParticipants.some(pId => {
    const agencyData = agencies[pId];
    return agencyData && agencyData.shareInventory !== true;
  });

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeChat || !userData?.agencyId) return;
    if (anyParticipantDisabledSharing) {
      alert("No se pueden enviar mensajes. Uno de los participantes ha desactivado 'Compartir mi Inventario'.");
      return;
    }

    const messageText = inputText.trim();
    setInputText('');

    try {
      const messagesRef = collection(db, 'agencyChats', activeChat.id, 'messages');
      await addDoc(messagesRef, {
        senderId: userData.uid || userData.email || 'system',
        senderAgencyId: userData.agencyId,
        text: messageText,
        createdAt: new Date().toISOString()
      });

      // Update last message in chat room
      const otherAgencyId = activeChat.participants.find(p => p !== userData.agencyId) || '';
      const chatRef = doc(db, 'agencyChats', activeChat.id);
      await updateDoc(chatRef, {
        lastMessage: messageText,
        lastMessageAt: new Date().toISOString(),
        [`unreadBy.${otherAgencyId}`]: true
      });
    } catch (err) {
      console.error("Error sending message", err);
      alert("Error al enviar el mensaje.");
    }
  };

  // Helper to fetch details about a vehicle in real-time inside messages
  function VehiclePreviewCard({ vehicleId }: { vehicleId: string }) {
    const [vehicle, setVehicle] = useState<any>(null);
    useEffect(() => {
      if (!vehicleId) return;
      const refDoc = doc(db, 'vehicles', vehicleId);
      getDoc(refDoc).then(snap => {
        if (snap.exists()) {
          setVehicle({ id: snap.id, ...snap.data() });
        }
      }).catch(err => console.error("Error fetching vehicle for chat preview", err));
    }, [vehicleId]);

    if (!vehicle) return null;

    return (
      <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl flex gap-3 max-w-sm text-xs">
        {(vehicle.photoUrls?.[0] || vehicle.photoUrl) ? (
          <img
            src={vehicle.photoUrls?.[0] || vehicle.photoUrl}
            alt={vehicle.model}
            className="w-16 h-16 object-cover rounded-lg shrink-0 border border-slate-200 dark:border-slate-700"
          />
        ) : (
          <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-300 dark:text-slate-600 rounded-lg shrink-0">
            <Car className="w-8 h-8" />
          </div>
        )}
        <div className="flex-1 min-w-0 flex flex-col justify-between">
          <div>
            <h5 className="font-extrabold text-slate-800 dark:text-slate-200 truncate">{vehicle.year} {vehicle.make} {vehicle.model}</h5>
            <p className="text-slate-500 dark:text-slate-400 mt-0.5 truncate">{vehicle.color} • {vehicle.transmission}</p>
          </div>
          <p className="text-blue-600 dark:text-blue-400 font-extrabold mt-1 text-sm">${Number(vehicle.price || 0).toLocaleString()}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col md:flex-row bg-slate-50 dark:bg-slate-950 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
      
      {/* Sidebar List of Chats */}
      <div className={clsx(
        "w-full md:w-80 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0 overflow-hidden",
        activeChat && "hidden md:flex"
      )}>
        <div className="p-4 border-b border-slate-100 dark:border-slate-850 bg-slate-50/50 dark:bg-slate-950/20">
          <h2 className="text-lg font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-500" />
            Chats Interagencias
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Platica con otras agencias sobre autos compartidos.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
          {loading ? (
            <div className="p-6 text-center text-sm text-slate-500">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent mx-auto mb-2"></div>
              Cargando conversaciones...
            </div>
          ) : chats.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-400">
              No tienes chats activos aún.
              <p className="text-xs text-slate-500 mt-2">
                Entra a 'Inventario Compartido' y haz clic en 'Iniciar Chat con Agencia' desde cualquier vehículo.
              </p>
            </div>
          ) : (
            chats.map(chat => {
              const otherAgencyId = chat.participants.find(p => p !== userData?.agencyId) || '';
              const otherAgencyName = agencies[otherAgencyId]?.name || otherAgencyId || 'Agencia Externa';
              const isUnread = userData?.agencyId ? chat.unreadBy?.[userData.agencyId] : false;

              // Check if either agency has deactivated sharing
              const otherAgencySharing = agencies[otherAgencyId]?.shareInventory === true;
              const ourAgencySharing = userData?.agencyId ? agencies[userData.agencyId]?.shareInventory === true : true;
              const isChatDisabled = !otherAgencySharing || !ourAgencySharing;

              return (
                <button
                  key={chat.id}
                  onClick={() => setActiveChat(chat)}
                  className={clsx(
                    "w-full text-left p-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors flex items-center gap-3 relative",
                    activeChat?.id === chat.id && "bg-blue-50/50 dark:bg-slate-800/80"
                  )}
                >
                  <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center font-bold text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40 shrink-0">
                    {otherAgencyName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate pr-2 flex items-center gap-1.5">
                        {otherAgencyName}
                        {isChatDisabled && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-full border border-amber-500/20 shrink-0">
                            Inactivo
                          </span>
                        )}
                      </h4>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        {chat.lastMessageAt ? new Date(chat.lastMessageAt).toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''}
                      </span>
                    </div>
                    <p className={clsx(
                      "text-xs truncate",
                      isUnread ? "text-slate-900 dark:text-white font-semibold" : "text-slate-500 dark:text-slate-400"
                    )}>
                      {isChatDisabled ? (
                        <span className="text-amber-600 dark:text-amber-500 font-medium">[Sin Compartir Inventario]</span>
                      ) : (
                        chat.lastMessage || 'Sin mensajes'
                      )}
                    </p>
                  </div>
                  {isUnread && (
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 absolute right-4 top-1/2 -translate-y-1/2 shadow-sm animate-pulse" />
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className={clsx(
        "flex-1 bg-white dark:bg-slate-900 flex flex-col overflow-hidden relative",
        !activeChat && "hidden md:flex"
      )}>
        {activeChat ? (
          <>
            {/* Active Chat Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/20 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => setActiveChat(null)}
                  className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 md:hidden mr-1"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center font-bold text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40 shrink-0">
                  {(agencies[activeChat.participants.find(p => p !== userData?.agencyId) || '']?.name || 'Agencia').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h3 className="font-extrabold text-slate-800 dark:text-slate-100 truncate text-base">
                    {agencies[activeChat.participants.find(p => p !== userData?.agencyId) || '']?.name || 'Agencia Externa'}
                  </h3>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <span className={clsx("w-2 h-2 rounded-full", anyParticipantDisabledSharing ? "bg-amber-500 animate-pulse" : "bg-emerald-500")} />
                    {anyParticipantDisabledSharing ? "Desactivado (Sin compartir)" : "Canal Interno CRM"}
                  </div>
                </div>
              </div>

              {/* Secure Info Alert */}
              <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-lg text-xs font-semibold">
                <Info className="w-3.5 h-3.5 shrink-0" />
                Seguro: Solo visible para administradores autorizados.
              </div>
            </div>

            {/* Message Feed Area */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50/30 dark:bg-slate-950/10 space-y-4">
              {messages.map((message, idx) => {
                const isMe = message.senderAgencyId === userData?.agencyId;

                return (
                  <div
                    key={message.id || idx}
                    className={clsx(
                      "flex flex-col max-w-[85%] md:max-w-[70%]",
                      isMe ? "ml-auto items-end" : "mr-auto items-start"
                    )}
                  >
                    <div className={clsx(
                      "px-4 py-2.5 rounded-2xl shadow-sm text-sm whitespace-pre-line leading-relaxed",
                      isMe 
                        ? "bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-tr-none" 
                        : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-100 dark:border-slate-700 rounded-tl-none"
                    )}>
                      {message.text}
                      {message.vehicleId && (
                        <VehiclePreviewCard vehicleId={message.vehicleId} />
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 px-1">
                      {message.createdAt ? new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Form Input area */}
            {anyParticipantDisabledSharing ? (
              <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-amber-50 dark:bg-amber-950/20 text-amber-850 dark:text-amber-300 flex items-center gap-3 shrink-0 text-sm font-semibold">
                <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 animate-bounce" />
                <span>
                  El chat está inactivo porque una de las agencias participantes ha desactivado 'Compartir mi Inventario'. No se pueden enviar más mensajes.
                </span>
              </div>
            ) : (
              <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex gap-3 shrink-0">
                <input
                  type="text"
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  placeholder="Escribe un mensaje de respuesta..."
                  className="flex-1 px-4 py-2.5 border rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
                <button
                  type="submit"
                  disabled={!inputText.trim()}
                  className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl shadow-md transition-all flex items-center justify-center shrink-0 disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            )}
          </>
        ) : (
          /* Empty Active Chat Fallback */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
            <div className="w-16 h-16 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center mb-4 text-slate-400 border">
              <MessageSquare className="w-8 h-8" />
            </div>
            <h3 className="font-bold text-slate-700 dark:text-slate-300 mb-1">Tus Conversaciones</h3>
            <p className="text-sm text-slate-500 max-w-sm">
              Selecciona una conversación del menú de la izquierda para comenzar a platicar. También puedes iniciar un chat desde cualquier auto de inventario compartido.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
