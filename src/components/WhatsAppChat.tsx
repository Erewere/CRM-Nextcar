import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { useLocation, useNavigate } from 'react-router';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { getApiUrl } from '../lib/api';
import { can } from '../lib/permissions';
import {
  useChatsPendientes,
  OPCIONES_DE_RECORDATORIO,
} from '../contexts/ChatsPendientesContext';
import {
  MessageCircle, Send, ArrowLeft, Clock, AlertCircle, UserCheck, ExternalLink, PanelRight,
  Search, Archive, ArchiveRestore, Trash2, CheckCheck, Settings2, Volume2, VolumeX,
  ListChecks, X, RotateCcw,
} from 'lucide-react';
import clsx from 'clsx';
import { ChatClientPanel } from './ChatClientPanel';

type Canal = 'whatsapp' | 'messenger';
/** Sin responder · Todos · Archivados · Papelera. */
type Vista = 'sin-responder' | 'activos' | 'archivados' | 'papelera';

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
  // Estado del chat. Lo escribe solo el servidor: ver "Chats: pendientes,
  // archivar, borrar" en server.ts.
  chatEstado?: 'activo' | 'archivado' | 'borrado';
  chatPendiente?: boolean;
  chatSinResponder?: number;
  chatBorradoAt?: string;
}

// Meta only delivers free-form replies within 24 h of the customer's last
// message. Outside it the send is rejected, so the composer has to know.
const WINDOW_MS = 24 * 60 * 60 * 1000;
// Igual que el servidor: un chat sin respuesta de hace mas de 30 dias ya no
// cuenta como pendiente.
const PENDIENTE_HASTA_MS = 30 * 24 * 60 * 60 * 1000;

function hoursLeft(lastInboundAt?: string): number | null {
  if (!lastInboundAt) return null;
  const left = new Date(lastInboundAt).getTime() + WINDOW_MS - Date.now();
  return left > 0 ? left / 3600000 : 0;
}

/** "hace 12 min", "hace 3 h", "hace 2 d". */
function hace(iso?: string): string {
  if (!iso) return '';
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} d`;
}

export function WhatsAppChat() {
  const { userData, currentUser, agencyData } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { setConversacionAbierta, sonido, setSonido, recordatorioMin } = useChatsPendientes();
  const [messages, setMessages] = useState<WaMessage[]>([]);
  const [clients, setClients] = useState<Record<string, ClientLite>>({});
  const [activeClientId, setActiveClientId] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sellers, setSellers] = useState<{ id: string; name?: string }[]>([]);
  const [assigning, setAssigning] = useState(false);
  const [filtro, setFiltro] = useState<'todos' | Canal>('todos');
  const [vista, setVista] = useState<Vista>('activos');
  const [busqueda, setBusqueda] = useState('');
  const [filtroVendedor, setFiltroVendedor] = useState<string>('todos');
  const [seleccionando, setSeleccionando] = useState(false);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [borrando, setBorrando] = useState<string[] | null>(null);
  const [quitarContacto, setQuitarContacto] = useState(false);
  const [accionando, setAccionando] = useState(false);
  const [aviso, setAviso] = useState<{ tono: 'ok' | 'mal'; texto: string } | null>(null);
  const [ajustesAbiertos, setAjustesAbiertos] = useState(false);
  // En pantallas anchas la ficha se ve siempre; en las angostas se abre y cierra
  // para no comerse la conversación.
  const [fichaAbierta, setFichaAbierta] = useState(false);
  const feedEndRef = useRef<HTMLDivElement>(null);
  const sincronizado = useRef(false);
  const isAdmin = userData?.role === 'admin' || userData?.role === 'master';
  // El vendedor atiende solo sus chats; el administrador y el gerente, todos.
  const veTodo = userData?.role !== 'seller';
  // Mismo permiso que borrar un trato: un vendedor no borra conversaciones.
  const puedeBorrar = can(userData?.role, 'tratos.eliminar');

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

  // Desde un aviso, la campanita o una notificacion: abrir ese chat, o la
  // lista de los que esperan respuesta.
  const ultimaLlegada = useRef<string | null>(null);
  useEffect(() => {
    const estado: any = location.state || {};
    if (ultimaLlegada.current === location.key) return;
    ultimaLlegada.current = location.key;
    if (estado.abrirConversacion) {
      setVista('activos');
      setActiveClientId(estado.abrirConversacion);
    } else if (estado.filtroChats === 'sin-responder') {
      setVista('sin-responder');
    }
  }, [location.key, location.state]);

  // El vigilante no suena por el chat que se esta viendo.
  useEffect(() => {
    setConversacionAbierta(activeClientId);
  }, [activeClientId, setConversacionAbierta]);
  useEffect(() => () => setConversacionAbierta(null), [setConversacionAbierta]);

  const pedir = async (ruta: string, cuerpo: any) => {
    if (!currentUser) throw new Error('No hay una sesión activa.');
    const token = await currentUser.getIdToken();
    const res = await fetch(getApiUrl(ruta), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(cuerpo),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
    return data;
  };

  const handleAssign = async (sellerId: string) => {
    if (!activeClientId || !currentUser) return;
    setAssigning(true);
    try {
      await pedir('/api/clients/assign-seller', { clientId: activeClientId, sellerId });
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'Error al asignar la conversación');
    } finally {
      setAssigning(false);
    }
  };

  // A seller only follows up their own clients; admins and master see everything.
  const visibleMessages = useMemo(() => {
    if (veTodo) return messages;
    return messages.filter(m => clients[m.clientId]?.sellerId === userData?.id);
  }, [messages, clients, userData, veTodo]);

  const conversations = useMemo(() => {
    const byClient: Record<string, WaMessage[]> = {};
    visibleMessages.forEach(m => {
      if (!byClient[m.clientId]) byClient[m.clientId] = [];
      byClient[m.clientId].push(m);
    });
    return Object.entries(byClient)
      .map(([clientId, todos]) => {
        const c = clients[clientId];
        const estado = c?.chatEstado || 'activo';
        const ordenados = [...todos].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        // Borrar un chat oculta lo que habia hasta ese momento, como en
        // WhatsApp. En la papelera se ve todo, para decidir si restaurarlo.
        const desde = c?.chatBorradoAt && estado !== 'borrado' ? c.chatBorradoAt : null;
        const sorted = desde ? ordenados.filter(m => m.createdAt > desde) : ordenados;
        if (sorted.length === 0) return null;
        const last = sorted[sorted.length - 1];

        // Pendiente: lo que lleva el servidor. Para los chats de antes de que
        // existiera, se calcula aqui mientras el servidor los pone al dia.
        let sinResponder = 0;
        let ultimoEntrante: WaMessage | null = null;
        for (const m of sorted) {
          if (m.direction === 'inbound') { sinResponder++; ultimoEntrante = m; } else sinResponder = 0;
        }
        const conEstado = c?.chatEstado !== undefined;
        const pendiente = conEstado
          ? !!c?.chatPendiente
          : sinResponder > 0 && !!ultimoEntrante && Date.now() - new Date(ultimoEntrante.createdAt).getTime() < PENDIENTE_HASTA_MS;
        return {
          clientId,
          messages: sorted,
          last,
          canal: (last.channel || 'whatsapp') as Canal,
          estado,
          pendiente,
          sinResponder: pendiente ? (conEstado ? c?.chatSinResponder || sinResponder || 1 : sinResponder) : 0,
          esperaDesde: ultimoEntrante?.createdAt || last.createdAt,
          conEstado,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => new Date(b.last.createdAt).getTime() - new Date(a.last.createdAt).getTime());
  }, [visibleMessages, clients]);

  // Los chats de antes de este cambio no traen estado: el servidor los pone
  // al dia una vez, para que el globo del menu los cuente.
  useEffect(() => {
    if (sincronizado.current || loading || !currentUser) return;
    if (!conversations.some(c => !c.conEstado)) return;
    sincronizado.current = true;
    pedir('/api/chats/sincronizar', {}).catch(err => console.error('Chats: sincronizar', err));
  }, [conversations, loading, currentUser]);

  const coincide = (conv: (typeof conversations)[number]) => {
    if (filtro !== 'todos' && conv.canal !== filtro) return false;
    if (veTodo && filtroVendedor !== 'todos') {
      const s = clients[conv.clientId]?.sellerId || '';
      if (s !== filtroVendedor) return false;
    }
    const q = busqueda.trim().toLowerCase();
    if (q) {
      const c = clients[conv.clientId];
      const texto = `${c?.name || ''} ${c?.phone || ''} ${conv.last.text || ''}`.toLowerCase();
      if (!texto.includes(q)) return false;
    }
    return true;
  };

  const porVista = (v: Vista) => conversations.filter(c =>
    v === 'sin-responder' ? c.estado === 'activo' && c.pendiente
      : v === 'activos' ? c.estado === 'activo'
      : v === 'archivados' ? c.estado === 'archivado'
      : c.estado === 'borrado');

  const conteoVista = useMemo(() => ({
    'sin-responder': porVista('sin-responder').filter(coincide).length,
    activos: porVista('activos').filter(coincide).length,
    archivados: porVista('archivados').filter(coincide).length,
    papelera: porVista('papelera').filter(coincide).length,
  }), [conversations, filtro, filtroVendedor, busqueda]);

  const conversacionesVisibles = useMemo(() => {
    const lista = porVista(vista).filter(coincide);
    // Sin responder: primero quien mas lleva esperando.
    if (vista === 'sin-responder') {
      return [...lista].sort((a, b) => new Date(a.esperaDesde).getTime() - new Date(b.esperaDesde).getTime());
    }
    return lista;
  }, [conversations, vista, filtro, filtroVendedor, busqueda]);

  const conteoCanal = useMemo(() => {
    const base = porVista(vista);
    return {
      todos: base.length,
      whatsapp: base.filter(c => c.canal === 'whatsapp').length,
      messenger: base.filter(c => c.canal === 'messenger').length,
    };
  }, [conversations, vista]);

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
      const ruta = canalActivo === 'messenger' ? '/api/meta/send-messenger' : '/api/meta/send-message';
      await pedir(ruta, { clientId: activeClientId, text: texto.trim() });
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

  /** Atendido, archivar, desarchivar, borrar o restaurar, a uno o a varios. */
  const accionChat = async (accion: string, ids: string[], opciones: { quitarContacto?: boolean } = {}) => {
    if (ids.length === 0) return;
    setAccionando(true);
    setAviso(null);
    try {
      const r = await pedir('/api/chats/accion', { accion, clientIds: ids, quitarContacto: !!opciones.quitarContacto });
      const n = r.hechos || 0;
      const que: Record<string, string> = {
        atendido: 'marcado como atendido',
        archivar: 'archivado',
        desarchivar: 'devuelto a la bandeja',
        borrar: 'borrado',
        restaurar: 'restaurado',
      };
      let texto = n === 1 ? `Chat ${que[accion]}.` : `${n} chats: ${que[accion]}.`;
      if (r.tratosQuitados > 0) texto += r.tratosQuitados === 1 ? ' Se quitó 1 trato del embudo.' : ` Se quitaron ${r.tratosQuitados} tratos del embudo.`;
      if (r.tratosRespetados?.length > 0) {
        const n = r.tratosRespetados.length;
        texto += `${n === 1 ? ' Se dejó 1 trato' : ` Se dejaron ${n} tratos`} con venta o pagos: ${r.tratosRespetados.slice(0, 3).join(', ')}.`;
      }
      if (r.omitidos > 0) texto += ` ${r.omitidos} no se tocaron (no son tuyos).`;
      setAviso({ tono: 'ok', texto });
      setSeleccion(new Set());
      setSeleccionando(false);
      if (activeClientId && ids.includes(activeClientId) && accion !== 'atendido') setActiveClientId(null);
    } catch (err: any) {
      setAviso({ tono: 'mal', texto: err?.message || 'No se pudo completar.' });
    } finally {
      setAccionando(false);
    }
  };

  const confirmarBorrado = async () => {
    if (!borrando) return;
    const ids = borrando;
    setBorrando(null);
    await accionChat('borrar', ids, { quitarContacto });
    setQuitarContacto(false);
  };

  const cambiarRecordatorio = async (min: number) => {
    if (!userData?.agencyId) return;
    try {
      await updateDoc(doc(db, 'agencies', userData.agencyId), { chatsRecordatorioMin: min });
    } catch (err: any) {
      alert('No se pudo guardar: ' + (err?.message || err));
    }
  };

  const marcar = (id: string) => setSeleccion(prev => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  // El saludo que pide los datos. Existe porque en Messenger Meta no da telefono
  // ni nombre real y el vendedor los tiene que pedir en cada conversacion: sin
  // esto, los teclea a mano cada vez y cada quien pregunta distinto.
  const SALUDO = '¡Hola! Gracias por escribirnos 🚗 Para poder ayudarte mejor, ' +
    '¿me compartes tu nombre completo, tu teléfono y tu correo? Con esos datos te ' +
    'paso la información del auto que te interese.';

  const vistas: { id: Vista; etiqueta: string; solo?: boolean }[] = [
    { id: 'sin-responder', etiqueta: 'Sin responder' },
    { id: 'activos', etiqueta: 'Todos' },
    { id: 'archivados', etiqueta: 'Archivados' },
    { id: 'papelera', etiqueta: 'Papelera', solo: true },
  ];

  const botonAccion = 'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-semibold border transition-colors disabled:opacity-50';

  return (
    <div className="h-full flex flex-col md:flex-row overflow-hidden relative">
      {/* Lista de conversaciones */}
      <div className={clsx(
        "w-full md:w-80 bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 flex flex-col shrink-0 overflow-hidden",
        activeClientId && "hidden md:flex"
      )}>
        {/* Vistas */}
        <div className="flex gap-1 px-2 pt-2 shrink-0 overflow-x-auto">
          {vistas.filter(v => !v.solo || puedeBorrar).map(v => (
            <button
              key={v.id}
              onClick={() => { setVista(v.id); setSeleccion(new Set()); }}
              className={clsx(
                "px-2.5 py-1.5 rounded text-xs font-bold whitespace-nowrap flex items-center gap-1.5 transition-colors",
                vista === v.id
                  ? v.id === 'sin-responder' ? "bg-green-600 text-white" : "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900"
                  : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
            >
              {v.id === 'papelera' ? <Trash2 className="w-3.5 h-3.5" /> : null}
              {v.id === 'papelera' ? '' : v.etiqueta}
              {conteoVista[v.id] > 0 && (
                <span className={clsx(
                  "text-[10px] px-1.5 rounded-full",
                  vista === v.id ? "bg-white/25" : v.id === 'sin-responder' ? "bg-green-600 text-white" : "bg-slate-200 dark:bg-slate-700"
                )}>
                  {conteoVista[v.id]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Buscar, seleccionar y ajustes */}
        <div className="flex items-center gap-1.5 p-2 shrink-0">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar nombre, teléfono o texto"
              className="w-full pl-8 pr-2 py-1.5 text-xs border border-gray-200 dark:border-slate-700 rounded bg-[#f4f5f5] dark:bg-slate-800 text-slate-700 dark:text-slate-200 outline-none focus:ring-1 focus:ring-green-500"
            />
          </div>
          <button
            onClick={() => { setSeleccionando(s => !s); setSeleccion(new Set()); }}
            className={clsx("p-1.5 rounded border", seleccionando ? "bg-slate-800 text-white border-slate-800" : "border-gray-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800")}
            title="Seleccionar varios"
          >
            <ListChecks className="w-4 h-4" />
          </button>
          <button
            onClick={() => setAjustesAbiertos(a => !a)}
            className={clsx("p-1.5 rounded border", ajustesAbiertos ? "bg-slate-800 text-white border-slate-800" : "border-gray-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800")}
            title="Avisos y sonido"
          >
            <Settings2 className="w-4 h-4" />
          </button>
        </div>

        {ajustesAbiertos && (
          <div className="mx-2 mb-2 p-3 rounded border border-gray-200 dark:border-slate-700 bg-[#f4f5f5] dark:bg-slate-800 space-y-3 shrink-0">
            <button
              onClick={() => setSonido(!sonido)}
              className="w-full flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-200"
            >
              <span className="flex items-center gap-2">
                {sonido ? <Volume2 className="w-4 h-4 text-green-600" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
                Sonido al llegar un mensaje
              </span>
              <span className={clsx("px-2 py-0.5 rounded-full text-[10px]", sonido ? "bg-green-600 text-white" : "bg-slate-300 text-slate-700")}>
                {sonido ? 'Encendido' : 'Apagado'}
              </span>
            </button>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Recordar chats sin responder
              </label>
              {isAdmin ? (
                <select
                  value={recordatorioMin}
                  onChange={e => cambiarRecordatorio(Number(e.target.value))}
                  className="w-full text-xs px-2 py-1.5 border border-gray-200 dark:border-slate-700 rounded bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"
                >
                  {OPCIONES_DE_RECORDATORIO.map(m => (
                    <option key={m} value={m}>{m === 0 ? 'Nunca' : `Cada ${m} minutos`}</option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-slate-500">
                  {recordatorioMin === 0 ? 'Apagado' : `Cada ${recordatorioMin} minutos`} · lo decide el administrador
                </p>
              )}
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                {isAdmin ? 'Aplica a todo tu equipo. ' : ''}Mientras un cliente espera, el CRM vuelve a avisar, aunque estés en otra pantalla.
              </p>
            </div>
          </div>
        )}

        {/* Canal y vendedor */}
        <div className="flex items-center gap-1 px-2 pb-2 border-b border-gray-200 dark:border-slate-800 shrink-0 overflow-x-auto">
          {([
            { id: 'todos', etiqueta: 'Todos' },
            { id: 'whatsapp', etiqueta: 'WhatsApp' },
            { id: 'messenger', etiqueta: 'Messenger' },
          ] as const).map(op => (
            <button
              key={op.id}
              onClick={() => setFiltro(op.id)}
              className={clsx(
                "px-2 py-1 rounded text-[11px] font-semibold transition-colors whitespace-nowrap",
                filtro === op.id
                  ? "bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-white"
                  : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
            >
              {op.etiqueta}{conteoCanal[op.id] > 0 ? ` ${conteoCanal[op.id]}` : ''}
            </button>
          ))}
          {veTodo && (
            <select
              value={filtroVendedor}
              onChange={e => setFiltroVendedor(e.target.value)}
              className="ml-auto text-[11px] px-1.5 py-1 border border-gray-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 max-w-[120px]"
              title="Filtrar por vendedor"
            >
              <option value="todos">Todo el equipo</option>
              <option value="">Sin asignar</option>
              {sellers.map(v => <option key={v.id} value={v.id}>{v.name || v.id}</option>)}
            </select>
          )}
        </div>

        {/* Acciones para varios */}
        {seleccionando && (
          <div className="flex items-center gap-1.5 px-2 py-2 border-b border-gray-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 shrink-0 flex-wrap">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 mr-auto">
              {seleccion.size} seleccionado{seleccion.size === 1 ? '' : 's'}
            </span>
            {vista === 'papelera' ? (
              <button disabled={seleccion.size === 0 || accionando} onClick={() => accionChat('restaurar', [...seleccion])} className={clsx(botonAccion, "border-slate-300 text-slate-700 dark:text-slate-200")}>
                <RotateCcw className="w-3.5 h-3.5" /> Restaurar
              </button>
            ) : (
              <>
                <button
                  disabled={seleccion.size === 0 || accionando}
                  onClick={() => accionChat(vista === 'archivados' ? 'desarchivar' : 'archivar', [...seleccion])}
                  className={clsx(botonAccion, "border-slate-300 text-slate-700 dark:text-slate-200")}
                >
                  {vista === 'archivados' ? <><ArchiveRestore className="w-3.5 h-3.5" /> Sacar</> : <><Archive className="w-3.5 h-3.5" /> Archivar</>}
                </button>
                {puedeBorrar && (
                  <button disabled={seleccion.size === 0 || accionando} onClick={() => setBorrando([...seleccion])} className={clsx(botonAccion, "border-red-200 text-red-700 dark:text-red-400")}>
                    <Trash2 className="w-3.5 h-3.5" /> Borrar
                  </button>
                )}
              </>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
          {loading ? (
            <div className="p-6 text-center text-sm text-slate-500">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-green-500 border-t-transparent mx-auto mb-2" />
              Cargando conversaciones...
            </div>
          ) : conversacionesVisibles.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-400">
              {vista === 'sin-responder'
                ? '¡Todo contestado! No hay clientes esperando respuesta.'
                : vista === 'archivados'
                ? 'No hay chats archivados.'
                : vista === 'papelera'
                ? 'La papelera está vacía.'
                : busqueda || filtroVendedor !== 'todos' || filtro !== 'todos'
                ? 'Ningún chat con esos filtros.'
                : 'Aún no hay conversaciones.'}
              {vista === 'activos' && !busqueda && (
                <p className="text-xs text-slate-500 mt-2">
                  Aparecerán aquí en cuanto un cliente escriba al número o a la página del negocio.
                </p>
              )}
            </div>
          ) : (
            conversacionesVisibles.map(conv => {
              const c = clients[conv.clientId];
              const nombre = c?.name || 'Contacto';
              const left = hoursLeft(
                conv.canal === 'messenger' ? c?.lastMessengerInboundAt : c?.lastWhatsappInboundAt
              );
              const esMessenger = conv.canal === 'messenger';
              const marcado = seleccion.has(conv.clientId);
              return (
                <button
                  key={conv.clientId}
                  onClick={() => seleccionando ? marcar(conv.clientId) : setActiveClientId(conv.clientId)}
                  className={clsx(
                    "w-full text-left p-4 hover:bg-[#f4f5f5] dark:hover:bg-slate-800/40 transition-colors flex items-center gap-3",
                    activeClientId === conv.clientId && !seleccionando && "bg-green-50/60 dark:bg-slate-800/80",
                    marcado && "bg-slate-100 dark:bg-slate-800"
                  )}
                >
                  {seleccionando && (
                    <input type="checkbox" readOnly checked={marcado} className="rounded shrink-0 pointer-events-none" />
                  )}
                  <div className={clsx(
                    "w-10 h-10 rounded-full flex items-center justify-center font-bold border shrink-0",
                    esMessenger
                      ? "bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900/40"
                      : "bg-green-50 dark:bg-green-950/50 text-green-600 dark:text-green-400 border-green-100 dark:border-green-900/40"
                  )}>
                    {nombre.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-0.5 gap-2">
                      <h4 className={clsx("text-sm truncate", conv.pendiente ? "font-extrabold text-slate-900 dark:text-white" : "font-bold text-slate-800 dark:text-slate-100")}>
                        {nombre}
                      </h4>
                      <span className={clsx("text-[10px] shrink-0", conv.pendiente ? "text-green-700 dark:text-green-400 font-bold" : "text-slate-400")}>
                        {conv.pendiente ? hace(conv.esperaDesde) : new Date(conv.last.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className={clsx("text-xs truncate flex-1", conv.pendiente ? "text-slate-700 dark:text-slate-200 font-medium" : "text-slate-500 dark:text-slate-400")}>
                        {conv.last.direction === 'outbound' ? 'Tú: ' : ''}{conv.last.text}
                      </p>
                      {conv.pendiente && (
                        <span className="shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-green-600 text-white text-[11px] font-bold flex items-center justify-center" title="Mensajes sin responder">
                          {conv.sinResponder}
                        </span>
                      )}
                    </div>
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
                    {left !== null && left > 0 && conv.estado === 'activo' && (
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

            {/* Que hacer con este chat */}
            <div className="px-4 py-2 border-b border-gray-200 dark:border-slate-800 flex items-center gap-2 flex-wrap shrink-0 bg-white dark:bg-slate-900">
              {activeConversation.estado === 'borrado' ? (
                <>
                  <span className="text-xs text-red-700 dark:text-red-400 font-semibold mr-auto">En la papelera</span>
                  <button disabled={accionando} onClick={() => accionChat('restaurar', [activeConversation.clientId])} className={clsx(botonAccion, "border-slate-300 text-slate-700 dark:text-slate-200")}>
                    <RotateCcw className="w-3.5 h-3.5" /> Restaurar
                  </button>
                </>
              ) : (
                <>
                  {activeConversation.pendiente ? (
                    <span className="text-xs text-green-700 dark:text-green-400 font-semibold mr-auto">
                      Esperando respuesta {hace(activeConversation.esperaDesde)}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400 mr-auto">
                      {activeConversation.estado === 'archivado' ? 'Archivado' : 'Al día'}
                    </span>
                  )}
                  {activeConversation.pendiente && (
                    <button
                      disabled={accionando}
                      onClick={() => accionChat('atendido', [activeConversation.clientId])}
                      className={clsx(botonAccion, "border-green-300 text-green-700 dark:text-green-400")}
                      title="Ya lo atendiste por otro lado, o no hace falta contestar"
                    >
                      <CheckCheck className="w-3.5 h-3.5" /> Atendido
                    </button>
                  )}
                  <button
                    disabled={accionando}
                    onClick={() => accionChat(activeConversation.estado === 'archivado' ? 'desarchivar' : 'archivar', [activeConversation.clientId])}
                    className={clsx(botonAccion, "border-slate-300 text-slate-700 dark:text-slate-200")}
                  >
                    {activeConversation.estado === 'archivado'
                      ? <><ArchiveRestore className="w-3.5 h-3.5" /> Sacar del archivo</>
                      : <><Archive className="w-3.5 h-3.5" /> Archivar</>}
                  </button>
                  {puedeBorrar && (
                    <button
                      disabled={accionando}
                      onClick={() => setBorrando([activeConversation.clientId])}
                      className={clsx(botonAccion, "border-red-200 text-red-700 dark:text-red-400")}
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Borrar
                    </button>
                  )}
                </>
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

            {activeConversation.estado === 'borrado' ? (
              <div className="p-4 border-t border-gray-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-sm text-slate-600 dark:text-slate-300 shrink-0">
                Este chat está en la papelera. Restáuralo para volver a contestarle.
              </div>
            ) : windowOpen ? (
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

      {/* Resultado de la ultima accion */}
      {aviso && (
        <div className={clsx(
          "absolute left-1/2 -translate-x-1/2 bottom-4 z-30 max-w-[92%] md:max-w-md flex items-start gap-2 px-4 py-2.5 rounded-lg shadow-lg text-sm",
          aviso.tono === 'ok' ? "bg-slate-900 text-white" : "bg-red-600 text-white"
        )}>
          <span className="flex-1">{aviso.texto}</span>
          <button onClick={() => setAviso(null)} className="opacity-70 hover:opacity-100"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Borrar: oculta como WhatsApp, y pregunta si tambien quitar el
          contacto y su trato (decision de Luis: preguntar cada vez). */}
      {borrando && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" onClick={() => setBorrando(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
              Borrar {borrando.length === 1 ? 'este chat' : `${borrando.length} chats`}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-4 leading-relaxed">
              Desaparece{borrando.length === 1 ? '' : 'n'} de la lista de la agencia. Si esa persona vuelve a
              escribir, el chat reaparece solo con lo nuevo. Si te equivocas, lo recuperas desde la papelera.
            </p>
            <label className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/40">
              <input type="checkbox" checked={quitarContacto} onChange={e => setQuitarContacto(e.target.checked)} className="mt-0.5 rounded" />
              <span className="text-sm">
                <span className="font-semibold text-slate-900 dark:text-white block">
                  Quitar también el contacto y su trato del embudo
                </span>
                <span className="text-slate-500 dark:text-slate-400">
                  Para spam, números equivocados o gente que no era cliente. Un trato ganado o con pagos no se quita.
                </span>
              </span>
            </label>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => { setBorrando(null); setQuitarContacto(false); }} className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700">
                Cancelar
              </button>
              <button onClick={confirmarBorrado} className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 hover:bg-red-700 text-white">
                Borrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
