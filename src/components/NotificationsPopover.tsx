import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import { collection, query, where, onSnapshot, doc, updateDoc, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Task, Vehicle, Client } from "../types";
import { Bell, Calendar, CreditCard, X, AlertTriangle, Flame, Sparkles, ChevronRight, ChevronDown, Check, Phone, Building2, MessageCircle, FileWarning, ShieldCheck, Clock, Landmark } from "lucide-react";
import { useNavigate } from "react-router";
import clsx from "clsx";
import { isBefore, addDays, startOfDay, isAfter } from "date-fns";
import { useSharedInventoryMatches } from "../hooks/useSharedInventoryMatches";
import { useChatsPendientes } from "../contexts/ChatsPendientesContext";
import { VehicleDetailModal } from "./VehicleDetailModal";

import { checkIsWon, checkIsLost } from "../lib/clientUtils";
import { useAvisosDescartados, descartarAviso, idDeMatch } from "../lib/avisosDescartados";
import { deFormaVieja, estadoDeCuenta } from '../lib/planDePagos';
import { creditosApi } from "../lib/creditosApi";

const parseDate = (val: any): Date | null => {
  if (!val) return null;
  if (typeof val?.toDate === 'function') return val.toDate();
  if (val instanceof Date) return val;
  if (typeof val === 'string' || typeof val === 'number') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
};

const isClosedStatus = (status: string | undefined, pipelineStages: any[] = []) => {
  if (!status) return false;
  if (checkIsWon(status, pipelineStages) || checkIsLost(status, pipelineStages)) return true;
  const s = status.toLowerCase().trim();
  const closedKeywords = [
    'won', 'lost', 'ganad', 'perdid', 'cerrad', 'vendid', 'archiv', 
    'cancelad', 'completad', 'entregad', 'finalizad', 'pagad', 'exito', 'éxito',
    'trash', 'deleted', 'rechazad', 'fallid', 'abandonad'
  ];
  if (closedKeywords.some(k => s.includes(k))) return true;

  if (pipelineStages && pipelineStages.length > 0) {
    const stage = pipelineStages.find(st => st.id === status);
    if (stage) {
      const stageTitle = (stage.title || "").toLowerCase();
      const stageId = (stage.id || "").toLowerCase();
      if (closedKeywords.some(k => stageTitle.includes(k) || stageId.includes(k))) {
        return true;
      }
    }
  }

  return false;
};

type Nivel = "ahora" | "hoy" | "seguimiento";

/** A qué grupo y qué tan urgente es cada tipo de aviso. */
const CLASE: Record<string, { grupo: string; nivel: Nivel }> = {
  "chat-pendiente": { grupo: "chats", nivel: "ahora" },
  "task-now": { grupo: "citas", nivel: "ahora" },
  "task-overdue": { grupo: "tareas-vencidas", nivel: "ahora" },
  "payment-overdue": { grupo: "pagos-vencidos", nivel: "ahora" },
  "payment-missing": { grupo: "pagos-vencidos", nivel: "ahora" },
  "admin-approval": { grupo: "aprobaciones", nivel: "ahora" },
  billing: { grupo: "suscripcion", nivel: "ahora" },
  "credito-ahora": { grupo: "creditos", nivel: "ahora" },
  "credito-hoy": { grupo: "creditos-hoy", nivel: "hoy" },
  "credito-seguimiento": { grupo: "creditos-seguimiento", nivel: "seguimiento" },
  "task-soon": { grupo: "tareas-pronto", nivel: "hoy" },
  "payment-soon": { grupo: "pagos-pronto", nivel: "hoy" },
  "payment-upcoming": { grupo: "pagos-pronto", nivel: "hoy" },
  "deal-stale": { grupo: "estancados", nivel: "seguimiento" },
  "vehicle-checklist": { grupo: "docs", nivel: "seguimiento" },
  "match-network": { grupo: "red", nivel: "seguimiento" },
  "config-pendiente": { grupo: "config", nivel: "seguimiento" },
};

const GRUPOS: Record<string, { titulo: (n: number) => string; Icono: any; color: string; ruta?: string; verTodas?: string; recientesPrimero?: boolean }> = {
  chats: { titulo: (n) => (n === 1 ? "Cliente esperando respuesta" : "Clientes esperando respuesta"), Icono: MessageCircle, color: "text-green-600", ruta: "/chats", verTodas: "Ir a Chats" },
  citas: { titulo: (n) => (n === 1 ? "Cita en este momento" : "Citas en este momento"), Icono: Calendar, color: "text-emerald-600", ruta: "/tasks", verTodas: "Ver agenda" },
  "tareas-vencidas": { titulo: (n) => `${n === 1 ? "Tarea vencida" : "Tareas vencidas"}`, Icono: Clock, color: "text-red-600", ruta: "/tasks", verTodas: "Ver todas en Tareas", recientesPrimero: true },
  "pagos-vencidos": { titulo: (n) => (n === 1 ? "Cliente con pagos atrasados" : "Clientes con pagos atrasados"), Icono: CreditCard, color: "text-red-600", ruta: "/payments", verTodas: "Ver Pagos", recientesPrimero: true },
  creditos: { titulo: (n) => (n === 1 ? "Solicitud de crédito por atender" : "Solicitudes de crédito por atender"), Icono: Landmark, color: "text-blue-600", ruta: "/creditos", verTodas: "Ir a Créditos" },
  "creditos-hoy": { titulo: (n) => (n === 1 ? "Crédito para dar seguimiento" : "Créditos para dar seguimiento"), Icono: Landmark, color: "text-blue-600", ruta: "/creditos", verTodas: "Ir a Créditos" },
  "creditos-seguimiento": { titulo: (n) => (n === 1 ? "Crédito a medias" : "Créditos a medias"), Icono: Landmark, color: "text-slate-500", ruta: "/creditos", verTodas: "Ir a Créditos" },
  aprobaciones: { titulo: (n) => (n === 1 ? "Aprobación pendiente" : "Aprobaciones pendientes"), Icono: ShieldCheck, color: "text-amber-600", ruta: "/inventory", verTodas: "Ir a Inventario" },
  suscripcion: { titulo: () => "Suscripción", Icono: CreditCard, color: "text-blue-600", ruta: "/billing", verTodas: "Ver suscripción" },
  "tareas-pronto": { titulo: (n) => (n === 1 ? "Tarea por vencer (48 h)" : "Tareas por vencer (48 h)"), Icono: Calendar, color: "text-amber-600", ruta: "/tasks", verTodas: "Ver Tareas" },
  "pagos-pronto": { titulo: (n) => (n === 1 ? "Mensualidad por vencer" : "Mensualidades por vencer"), Icono: CreditCard, color: "text-amber-600", ruta: "/payments", verTodas: "Ver Pagos" },
  estancados: { titulo: (n) => (n === 1 ? "Trato sin movimiento" : "Tratos sin movimiento"), Icono: Flame, color: "text-orange-600", ruta: "/kanban", verTodas: "Ver el embudo" },
  docs: { titulo: (n) => (n === 1 ? "Auto con documentos faltantes" : "Autos con documentos faltantes"), Icono: FileWarning, color: "text-amber-600", ruta: "/inventory", verTodas: "Ir a Inventario" },
  red: { titulo: (n) => (n === 1 ? "Coincidencia en la red" : "Coincidencias en la red"), Icono: Sparkles, color: "text-amber-600" },
  config: { titulo: () => "Por configurar", Icono: Building2, color: "text-blue-600" },
};

/** Qué va primero dentro de cada nivel: el dinero y los créditos antes que lo demás. */
const ORDEN_GRUPOS = ["pagos-vencidos", "creditos", "aprobaciones", "chats", "citas", "tareas-vencidas", "suscripcion", "pagos-pronto", "creditos-hoy", "tareas-pronto", "creditos-seguimiento", "estancados", "docs", "red", "config"];

const NIVELES: { id: Nivel; titulo: string; punto: string }[] = [
  { id: "ahora", titulo: "Atiende ahora", punto: "bg-red-500" },
  { id: "hoy", titulo: "Hoy y mañana", punto: "bg-amber-500" },
  { id: "seguimiento", titulo: "Seguimiento", punto: "bg-slate-400" },
];

export function NotificationsPopover() {
  const { userData, agencyData } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [pipelineStages, setPipelineStages] = useState<any[]>([]);
  // La lista de descartados vive en un solo sitio para todo el CRM, para que
  // descartar aquí también descarte en el aviso flotante de coincidencias.
  const dismissedIds = useAvisosDescartados();
  /**
   * Que avisos de configuracion ya se pospusieron en la pantalla.
   *
   * Aqui solo aparecen los pospuestos: mostrarlos desde el principio seria
   * decir la misma cosa dos veces a la vez, y el recuadro de la pantalla ya
   * lo dice mejor, con su boton para arreglarlo.
   */
  const [avisosPospuestos, setAvisosPospuestos] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('crm_avisos_descartados') || '[]'); } catch { return []; }
  });
  useEffect(() => {
    const releer = () => {
      try { setAvisosPospuestos(JSON.parse(localStorage.getItem('crm_avisos_descartados') || '[]')); } catch {}
    };
    window.addEventListener('crm-avisos-cambiaron', releer);
    return () => window.removeEventListener('crm-avisos-cambiaron', releer);
  }, []);

  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [selectedClientContext, setSelectedClientContext] = useState<Client | null>(null);
  // Un «pop» cuando llega algo urgente nuevo mientras el CRM está abierto.
  const [popNuevo, setPopNuevo] = useState(false);
  const urgentesAntes = useRef<number | null>(null);
  // Solicitudes de crédito (viven en el servidor): se revisan al abrir y cada 3 minutos.
  const [creditos, setCreditos] = useState<any[]>([]);
  useEffect(() => {
    if (!userData || !["admin", "manager", "seller"].includes(String(userData.role))) return;
    let vivo = true;
    const leer = () => creditosApi.lista().then((l) => { if (vivo) setCreditos(l || []); }).catch(() => {});
    leer();
    const t = setInterval(leer, 3 * 60 * 1000);
    return () => { vivo = false; clearInterval(t); };
  }, [userData?.id, userData?.role]);
  // Cómo se ve el panel: qué pestaña y qué grupos están abiertos.
  const [pestana, setPestana] = useState<"todo" | "ahora" | "hoy" | "seguimiento">("todo");
  const [abiertos, setAbiertos] = useState<Record<string, boolean>>({});
  const [verMas, setVerMas] = useState<Record<string, boolean>>({});
  // Nombres de los asesores (solo el administrador los necesita: ve las tareas de todos).
  const [nombres, setNombres] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!userData?.agencyId || (userData.role !== "admin" && userData.role !== "master")) return;
    getDocs(query(collection(db, "users"), where("agencyId", "==", userData.agencyId)))
      .then((s) => setNombres(Object.fromEntries(s.docs.map((d) => [d.id, String(d.data().name || d.data().email || "").split(" ")[0]]))))
      .catch(() => {});
  }, [userData?.agencyId, userData?.role]);

  const { matches, ownAgencySharing } = useSharedInventoryMatches();
  const popoverRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { pendientes: chatsPendientes } = useChatsPendientes();

  /**
   * Un reloj que avanza cada minuto.
   *
   * Antes la lista solo se recalculaba cuando Firestore mandaba un cambio, asi
   * que una cita agendada por la manana no se volvia a revisar en todo el dia y
   * el aviso no llegaba nunca. Con el reloj, las cuentas de "cuanto falta" se
   * rehacen cada minuto aunque nadie toque nada.
   */
  const [ahora, setAhora] = useState(() => new Date());
  useEffect(() => {
    const reloj = setInterval(() => setAhora(new Date()), 60 * 1000);
    return () => clearInterval(reloj);
  }, []);

  // Listen to agency pipeline stages
  useEffect(() => {
    if (!userData?.agencyId) return;
    const unsubscribeAgency = onSnapshot(doc(db, "agencies", userData.agencyId), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.pipelineStages && Array.isArray(data.pipelineStages)) {
          setPipelineStages(data.pipelineStages);
        }
      }
    });
    return () => unsubscribeAgency();
  }, [userData?.agencyId]);

  useEffect(() => {
    if (!userData) return;

    const isSeller = userData.role === "seller" || (userData.role === "admin" && (userData as any).adminMobileViewAllContacts === false);

    // 1. Listen to tasks
    let qTasks = query(
      collection(db, "tasks"),
      where("agencyId", "==", userData.agencyId),
      where("completed", "==", false)
    );

    if (isSeller) {
      qTasks = query(
        collection(db, "tasks"),
        where("agencyId", "==", userData.agencyId),
        where("sellerId", "==", userData.id),
        where("completed", "==", false)
      );
    }

    const unsubscribeT = onSnapshot(qTasks, (snapshot) => {
      const fetchedTasks = snapshot.docs.map(
        (doc) => ({ ...doc.data(), id: doc.id } as Task)
      );
      setTasks(fetchedTasks);
    });
    
    // 2. Listen to vehicles
    const vq = query(
      collection(db, "vehicles"),
      where("agencyId", "==", userData.agencyId)
    );
    const unsubscribeV = onSnapshot(vq, (snapshot) => {
      const fetchedVehicles = snapshot.docs.map(
        (doc) => ({ ...doc.data(), id: doc.id } as Vehicle)
      );
      setVehicles(fetchedVehicles);
    });

    // 3. Listen to clients (for stale deals)
    let qClients = query(
      collection(db, "clients"),
      where("agencyId", "==", userData.agencyId)
    );

    if (isSeller) {
      qClients = query(
        collection(db, "clients"),
        where("agencyId", "==", userData.agencyId),
        where("sellerId", "==", userData.id)
      );
    }

    const unsubscribeC = onSnapshot(qClients, (snapshot) => {
      const clientList = snapshot.docs
        .map((doc) => ({ ...doc.data(), id: doc.id } as Client));
      setClients(clientList);
    });

    return () => {
      unsubscribeT();
      unsubscribeV();
      unsubscribeC();
    };
  }, [userData]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleDismissNotif = async (notif: { id: string; type: string; clientId?: string }) => {
    descartarAviso(notif.id);

    if (notif.type === "deal-stale" && notif.clientId) {
      try {
        await updateDoc(doc(db, "clients", notif.clientId), {
          dismissedStale: true,
          staleDismissedAt: new Date().toISOString(),
        });
      } catch (err) {
        console.error("Error setting dismissedStale in Firestore:", err);
      }
    }
  };

  const notifications: Array<{
    id: string;
    type: string;
    title: string;
    message: string;
    date: string;
    icon: React.ReactNode;
    clientId?: string;
    asesorId?: string;
    onClick: () => void;
  }> = [];

  const now = ahora;
  const isSellerNotif = userData?.role === "seller" || (userData?.role === "admin" && (userData as any)?.adminMobileViewAllContacts === false);

  // 1. Task & Payment Notifications
  tasks.forEach((task) => {
    if (isSellerNotif && task.sellerId && task.sellerId !== userData?.id) return;
    if (!task.dueDate) return;
    
    let taskDateTime;
    if (task.startTime) {
      let [time, period] = task.startTime.split(' ');
      if (time && period) {
         let [hoursStr, minutesStr] = time.split(':');
         let hours = parseInt(hoursStr, 10);
         const minutes = parseInt(minutesStr, 10);
         if (period.toLowerCase() === 'p.m.' && hours < 12) hours += 12;
         if (period.toLowerCase() === 'a.m.' && hours === 12) hours = 0;
         taskDateTime = new Date(`${task.dueDate}T${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`);
      } else {
         taskDateTime = new Date(`${task.dueDate}T${task.startTime}:00`);
      }
    } else {
      taskDateTime = new Date(`${task.dueDate}T23:59:59`);
    }
    
    const diffInMinutes = (taskDateTime.getTime() - now.getTime()) / 60000;
    // «Pago 3/24 - Crédito de…» las crea el sistema y el aviso por cliente de
    // más abajo ya las cubre, con el monto real: dos avisos por lo mismo no.
    if (task.type === 'payment' && /^Pago \d+\/\d+ /.test(String(task.title || '')) && clients.some((c) => c.id === task.clientId && (c as any).saleDetails?.method === 'credito')) return;
    const quienEs = (clients.find((c) => c.id === task.clientId)?.name || "").trim();
    const conDetalle = (texto: string) => `${texto}${quienEs ? ` · ${quienEs}` : ""}`;
    const isPaymentTask = task.type === 'payment' || 
      task.title?.toLowerCase().includes('pago') || 
      task.title?.toLowerCase().includes('mensualidad') || 
      task.title?.toLowerCase().includes('crédito');
    
    // Una cita que empieza dentro de un rato, o que acaba de empezar, no es ni
    // "vencida" ni "por vencer": es ahora. Merece su propio aviso, y es el que
    // sale al escritorio. Solo aplica a actividades con hora: las que no la
    // tienen ocupan el dia entero y no hay momento al que avisar.
    if (!isPaymentTask && task.startTime && diffInMinutes >= -15 && diffInMinutes <= 30) {
      const notifId = `task-now-${task.id}`;
      if (dismissedIds.has(notifId)) return;
      notifications.push({
        id: notifId,
        type: "task-now",
        title: diffInMinutes <= 0 ? "🔔 Es la hora" : "🔔 En menos de 30 minutos",
        message: conDetalle(task.title),
        asesorId: task.sellerId,
        date: taskDateTime.toISOString(),
        icon: <Calendar className="w-5 h-5 text-emerald-500 shrink-0 animate-pulse" />,
        onClick: () => {
          navigate(`/tasks?taskId=${task.id}`, { state: { taskId: task.id } });
        },
      });
    } else if (diffInMinutes < 0) {
      const notifId = `task-overdue-${task.id}`;
      if (dismissedIds.has(notifId)) return;
      notifications.push({
        id: notifId,
        type: isPaymentTask ? "payment-overdue" : "task-overdue",
        title: isPaymentTask ? "⚠️ Pago Mensual Faltante" : task.title || "Tarea vencida",
        message: isPaymentTask ? `¡Pago no registrado! ${task.title}` : `${quienEs ? `${quienEs} · ` : ""}venció ${Math.max(0, Math.floor(-diffInMinutes / 1440)) === 0 ? "hoy" : `hace ${Math.floor(-diffInMinutes / 1440)} día${Math.floor(-diffInMinutes / 1440) === 1 ? "" : "s"}`}`,
        asesorId: task.sellerId,
        date: taskDateTime.toISOString(),
        icon: isPaymentTask ? <CreditCard className="w-5 h-5 text-red-500 shrink-0 animate-pulse" /> : <Calendar className="w-5 h-5 text-red-500 shrink-0" />,
        onClick: () => {
          navigate(`/tasks?taskId=${task.id}`, { state: { taskId: task.id } });
        },
      });
    } else if (diffInMinutes >= 0 && diffInMinutes <= 2880) { // Within 2 days (48 hrs = 2880 mins)
      const notifId = `task-soon-${task.id}`;
      if (dismissedIds.has(notifId)) return;

      const hoursLeft = Math.round(diffInMinutes / 60);
      const daysText = hoursLeft <= 24 ? "vence en 24h" : "vence en 2 días";

      notifications.push({
        id: notifId,
        type: isPaymentTask ? "payment-soon" : "task-soon",
        title: isPaymentTask ? `⏰ Próximo Pago (${daysText})` : "Tarea por Vencer",
        message: conDetalle(task.title),
        asesorId: task.sellerId,
        date: taskDateTime.toISOString(),
        icon: <CreditCard className="w-5 h-5 text-amber-500 shrink-0" />,
        onClick: () => {
          navigate(`/tasks?taskId=${task.id}`, { state: { taskId: task.id } });
        },
      });
    }
  });

  // 1.2. Client Credit Schedules Direct Notifications
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  clients.forEach((client) => {
    if (isSellerNotif && client.sellerId && client.sellerId !== userData?.id) return;
    const sDetails = client.saleDetails;
    if (!sDetails || sDetails.method !== 'credito' || !sDetails.termMonths || !sDetails.firstPaymentDate) return;

    // Misma regla que «Venta y pagos»: una mensualidad está cubierta si hay
    // dinero que la cubra, no si algún pago trae su número.
    const ec = estadoDeCuenta(sDetails as any, (sDetails.payments || []).map((p: any) => ({ ...deFormaVieja(p, true), id: String(p.id) })), todayStr);
    const ventaId = (client as any).ventaDealId;
    const abrir = () => { if (ventaId) navigate(`/venta/${ventaId}`); else navigate("/persons", { state: { clientId: client.id } }); };
    const pesosMx = (n: number) => `$${Math.round(n).toLocaleString('es-MX')}`;
    const atrasadas = ec.mensualidades.filter((m) => m.estado === 'atrasada');
    if (atrasadas.length) {
      // Un solo aviso por cliente: «3 mensualidades atrasadas», no tres avisos.
      const notifId = `pago-atraso-${client.id}-${atrasadas.length}`;
      if (!dismissedIds.has(notifId)) {
        const debe = atrasadas.reduce((t, m) => t + (m.monto - m.cubierto), 0);
        const viejo = atrasadas[0];
        notifications.push({
          id: notifId,
          type: "payment-missing",
          title: `${client.name}: ${atrasadas.length === 1 ? `mensualidad #${viejo.n} atrasada` : `${atrasadas.length} mensualidades atrasadas`}`,
          message: `Debe ${pesosMx(debe)}. La más vieja venció el ${viejo.fecha} (${viejo.diasAtraso} día${viejo.diasAtraso === 1 ? '' : 's'}).`,
          date: new Date(`${viejo.fecha}T12:00:00`).toISOString(),
          icon: <CreditCard className="w-5 h-5 text-red-500 shrink-0" />,
          clientId: client.id,
          asesorId: client.sellerId,
          onClick: abrir,
        });
      }
    }
    const proxima = ec.mensualidades.find((m) => m.estado !== 'pagada' && m.estado !== 'atrasada');
    if (proxima) {
      const diffDays = Math.round((Date.parse(`${proxima.fecha}T12:00:00`) - Date.parse(`${todayStr}T12:00:00`)) / 86400000);
      const notifId = `pago-proximo-${client.id}-m${proxima.n}`;
      if (diffDays >= 0 && diffDays <= 2 && !dismissedIds.has(notifId)) {
        notifications.push({
          id: notifId,
          type: "payment-upcoming",
          title: `${client.name}: mensualidad #${proxima.n} ${diffDays === 0 ? 'vence HOY' : diffDays === 1 ? 'vence mañana' : 'vence en 2 días'}`,
          message: `${pesosMx(proxima.monto - proxima.cubierto)} · ${proxima.fecha}.`,
          date: new Date(`${proxima.fecha}T12:00:00`).toISOString(),
          icon: <CreditCard className="w-5 h-5 text-amber-500 shrink-0" />,
          clientId: client.id,
          asesorId: client.sellerId,
          onClick: abrir,
        });
      }
    }
  });

  // 1.3. Solicitudes de crédito: lo que el cliente hizo y lo que respondió el banco.
  creditos.forEach((c: any) => {
    if (["cerrada", "cancelada"].includes(c.etapa)) return;
    const quien = c.clienteNombre || "Cliente";
    const abrir = () => navigate(`/creditos/${c.id}`);
    const base = { icon: <Landmark className="w-5 h-5 text-blue-600 shrink-0" />, asesorId: c.vendedorId, clientId: c.clientId, onClick: abrir };
    const bancos: any[] = c.bancos || [];
    const aprobo = bancos.filter((b) => b.estado === "aprobado");
    const condiciones = bancos.filter((b) => b.estado === "condiciones");
    const dias = (iso?: string) => (iso ? Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 86400000)) : 0);
    const poner = (idTipo: string, type: string, title: string, message: string, date?: string) => {
      const id = `credito-${c.id}-${idTipo}`;
      if (!dismissedIds.has(id)) notifications.push({ id, type, title, message, date: date || c.actualizadoEl || new Date().toISOString(), ...base });
    };
    if (aprobo.length) {
      poner("aprobado", "credito-ahora", `${aprobo.map((b) => b.nombre).join(" y ")} aprobó el crédito de ${quien}`, "Avísale al cliente y coordina la compra.");
    } else if (condiciones.length) {
      poner("condiciones", "credito-ahora", `${condiciones[0].nombre} respondió con condiciones: ${quien}`, "Revisa las condiciones y habla con el cliente.");
    } else if (c.clienteTerminoEl && ["recibida", "datos"].includes(c.etapa)) {
      poner("termino", "credito-ahora", `${quien} terminó su solicitud de crédito`, "Revísala y envíala a los bancos.", c.clienteTerminoEl);
    } else if (c.origen === "pagina" && c.etapa === "recibida" && !c.ligaVence) {
      poner("nueva-pagina", "credito-ahora", `Nueva solicitud de crédito desde la página: ${quien}`, "Mándale su liga para que la llene.", c.creadoEl);
    } else if (bancos.length && bancos.every((b) => b.estado === "rechazado")) {
      poner("rechazado", "credito-hoy", `Los bancos rechazaron el crédito de ${quien}`, "Habla con el cliente: ¿otra opción o crédito de la casa?");
    } else if (c.ligaVence && !c.ligaAbiertaEl && dias(c.creadoEl) >= 2) {
      poner("sin-abrir", "credito-hoy", `${quien} no ha abierto su liga de crédito`, `Se la mandaste hace ${dias(c.creadoEl)} días: recuérdale por WhatsApp.`, c.creadoEl);
    } else if (c.ligaAbiertaEl && !c.clienteTerminoEl && ["recibida", "datos"].includes(c.etapa) && dias(c.actualizadoEl) >= 3) {
      poner("a-medias", "credito-seguimiento", `${quien} dejó a medias su solicitud`, `Lleva ${dias(c.actualizadoEl)} días sin avanzar. Anímalo a terminarla.`);
    }
  });

  // 2. Stale Deals Notifications (3+ days)
  clients.forEach((client) => {
    if (isSellerNotif && client.sellerId && client.sellerId !== userData?.id) return;
    if (client.isDeleted || (client as any).dismissedStale || (client as any).isArchived || (client as any).isClosed) return;
    if (isClosedStatus(client.status, pipelineStages) || isClosedStatus((client as any).stageId, pipelineStages)) return;

    // Solo tratos de verdad: un contacto importado de Google o Excel, o uno sin
    // etapa del embudo de la agencia, no es un trato y no se «estanca». Antes
    // un administrador de Mmotors recibía 571 avisos de estos.
    if (["google_contacts", "excel_import"].includes(String((client as any).origin || ""))) return;
    if (!client.status || (pipelineStages.length > 0 && !pipelineStages.some((st) => st.id === client.status))) return;

    const notifId = `deal-stale-${client.id}`;
    if (dismissedIds.has(notifId) || dismissedIds.has(`deal-${client.id}`)) return;

    const lastUpdate = parseDate(client.updatedAt || client.createdAt);
    if (!lastUpdate) return;

    const diffMs = now.getTime() - lastUpdate.getTime();
    if (diffMs < 0) return;

    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays >= 3) {
      const dealName = client.dealTitle || client.name || "Trato sin nombre";
      notifications.push({
        id: notifId,
        type: "deal-stale",
        title: `Trato Estancado (${diffDays}d)`,
        message: `${dealName}: Sin actividad desde hace ${diffDays} días`,
        date: lastUpdate.toISOString(),
        icon: <Flame className="w-5 h-5 text-orange-500 shrink-0" />,
        clientId: client.id,
        asesorId: client.sellerId,
        onClick: () => {
          navigate("/persons", { state: { clientId: client.id } });
        },
      });
    }
  });

  // 3. Network Inventory Matches
  if (ownAgencySharing) {
    matches.forEach((m) => {
      if (isSellerNotif && m.client.sellerId && m.client.sellerId !== userData?.id) return;
      const notifId = idDeMatch(m.client.id, m.vehicle.id);
      if (dismissedIds.has(notifId)) return;
      notifications.push({
        id: notifId,
        type: "match-network",
        title: m.level === "exact" ? "Match Perfecto en Red" : `Match en Red (${m.score}%)`,
        message: `${m.vehicle.make} ${m.vehicle.model} (${m.vehicle.year}) coincide con cliente ${m.client.name}`,
        date: new Date().toISOString(),
        icon: <Sparkles className="w-5 h-5 text-amber-500 shrink-0 animate-pulse" />,
        onClick: () => {
          setSelectedVehicle(m.vehicle);
          setSelectedClientContext(m.client);
        },
      });
    });
  }

  // 4. Vehicles Checklist Documents Missing
  vehicles.forEach((v) => {
    if (isSellerNotif) {
      const isMine = (v as any).sellerId === userData?.id || (v as any).createdById === userData?.id || (v as any).userId === userData?.id || clients.some(c => c.vehicleId === v.id && c.sellerId === userData?.id);
      if (!isMine) return;
    }
    if (v.checklist?.remindMissing) {
      const notifId = `vehicle-checklist-${v.id}`;
      if (dismissedIds.has(notifId)) return;
      const missing = [];
      if (!v.checklist.originalInvoice) missing.push("Factura Original");
      if (!v.checklist.taxes) missing.push("Tenencias");
      if (!v.checklist.deregistration) missing.push("Baja");
      if (!v.checklist.ineOrId) missing.push("INE/ID");
      if (!v.checklist.duplicateKeys) missing.push("Llaves");
      
      if (missing.length > 0) {
        notifications.push({
          id: notifId,
          type: "vehicle-checklist",
          title: `Docs Faltantes (${v.make} ${v.model})`,
          message: `Falta: ${missing.slice(0, 3).join(", ")}${missing.length > 3 ? "..." : ""}`,
          date: new Date().toISOString(),
          icon: <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />,
          onClick: () => {
            navigate("/inventory", { state: { vehicleId: v.id } });
          },
        });
      }
    }
  });

  /**
   * Datos de configuracion que faltan.
   *
   * Estos avisos empiezan como un recuadro dentro de la pantalla, con un
   * «mas tarde». Cuando alguien lo pospone, reaparecen aqui y ya no se pueden
   * descartar: se van solos cuando el dato se llena, que es de lo que se
   * trata. Por eso no consultan `dismissedIds` como los demas.
   */
  if (avisosPospuestos.includes("telefono") && userData && (userData.role === "seller" || userData.role === "admin") && !(userData as any).phone) {
    notifications.push({
      id: "config-telefono",
      type: "config-pendiente",
      title: "Falta tu teléfono",
      message: "Sin él, las fichas que compartes no dicen a quién llamarle. Ponlo en tu perfil.",
      date: new Date().toISOString(),
      icon: <Phone className="w-5 h-5 text-blue-500 shrink-0" />,
      onClick: () => {},
    });
  }

  if (avisosPospuestos.includes("agencia") && userData?.role === "admin" && agencyData && /^Agencia de /i.test(agencyData.name || "")) {
    notifications.push({
      id: "config-agencia",
      type: "config-pendiente",
      title: "Tu agencia todavía no tiene nombre",
      message: `Aparece como «${agencyData.name}» en las fichas de tus autos y en los correos a tu equipo.`,
      date: new Date().toISOString(),
      icon: <Building2 className="w-5 h-5 text-amber-500 shrink-0" />,
      onClick: () => {},
    });
  }

  // 5. Pending Admin Approvals (Vehicles & Clients)
  if (userData?.role === "admin" || userData?.role === "master") {
    // A) Vehicle pending validations
    vehicles.forEach((v) => {
      const pv = (v as any).pendingValidation;
      if (pv && pv.requestedAt) {
        const notifId = `approval-vehicle-${v.id}`;
        if (dismissedIds.has(notifId)) return;

        const typeLabel = pv.type === "sold" ? "Venta" : pv.type === "reserved" ? "Reserva" : "Aprobación";
        const requestedBy = pv.requestedByName || "Un vendedor";
        const clientName = pv.clientName ? ` (Cliente: ${pv.clientName})` : "";

        // Estas solicitudes antes se borraban solas a las 1 dia y la venta se
        // perdia en silencio. Ahora esperan, y cuanto mas llevan esperando mas
        // claro se dice: mientras no se apruebe, el auto sigue disponible.
        const diasEsperando = Math.floor((now.getTime() - new Date(pv.requestedAt).getTime()) / 86400000);
        const espera =
          diasEsperando >= 1 ? ` Lleva ${diasEsperando} ${diasEsperando === 1 ? "día" : "días"} sin aprobarse y el auto sigue apareciendo como disponible.` : "";

        notifications.push({
          id: notifId,
          type: "admin-approval",
          title: `${diasEsperando >= 1 ? "⚠️ " : ""}Aprobación Pendiente: ${v.make} ${v.model}`,
          message: `${requestedBy} solicitó marcar como ${typeLabel}${clientName}.${espera}`,
          date: pv.requestedAt || new Date().toISOString(),
          icon: <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />,
          onClick: () => {
            navigate("/inventory", { state: { pendingVehicleId: v.id, vehicleId: v.id } });
          },
        });
      }
    });

    // B) Client / Deal pending validations
    clients.forEach((client) => {
      const pv = (client as any).pendingValidation;
      if (pv && pv.requestedAt && !client.isDeleted) {
        const notifId = `approval-client-${client.id}`;
        if (dismissedIds.has(notifId)) return;

        const requestedBy = pv.requestedByName || "Un vendedor";
        const statusLabel = pv.type === "won" || pv.type === "sold" ? "Ganado / Vendido" : pv.type === "lost" ? "Perdido" : pv.type;

        notifications.push({
          id: notifId,
          type: "admin-approval",
          title: `Aprobación Pendiente: ${client.name || "Cliente"}`,
          message: `${requestedBy} solicitó cambiar estado a "${statusLabel}".`,
          date: pv.requestedAt || new Date().toISOString(),
          icon: <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />,
          onClick: () => {
            navigate("/persons", { state: { clientId: client.id } });
          },
        });
      }
    });
  }

  // 6. Billing Notification
  const today = startOfDay(new Date());
  if (userData && (userData.role === "master" || userData.role === "admin")) {
    const createdAt = userData.createdAt instanceof Date ? userData.createdAt : ((userData.createdAt as any)?.toDate ? (userData.createdAt as any).toDate() : new Date(userData.createdAt || Date.now()));
    const trialEnd = addDays(createdAt, 30);
    const billingWarningDate = addDays(today, 5);

    if (isBefore(trialEnd, billingWarningDate) && isAfter(trialEnd, today)) {
       const notifId = `billing-warning`;
       if (!dismissedIds.has(notifId)) {
         notifications.push({
          id: notifId,
          type: "billing",
          title: "Suscripción por Vencer",
          message: "Tu prueba gratis está por terminar. Haz tu pago pronto.",
          date: trialEnd.toISOString(),
          icon: <CreditCard className="w-5 h-5 text-blue-500 shrink-0" />,
          onClick: () => navigate("/billing"),
        });
       }
    } else if (isBefore(trialEnd, today)) {
       const notifId = `billing-expired`;
       if (!dismissedIds.has(notifId)) {
         notifications.push({
          id: notifId,
          type: "billing",
          title: "Suscripción Vencida",
          message: "Realiza tu pago para seguir disfrutando de todas las funciones.",
          date: trialEnd.toISOString(),
          icon: <CreditCard className="w-5 h-5 text-red-500 shrink-0" />,
          onClick: () => navigate("/billing"),
        });
       }
    }
  }

  // El orden ahora lo da el grupo: lo urgente arriba, lo demás agrupado y con menos ruido.

  // Clientes esperando respuesta: siempre arriba de todo, porque un lead sin
  // contestar es lo mas caro que hay. No se descarta: se va sola cuando
  // alguien contesta, que es de lo que se trata.
  if (chatsPendientes.length > 0) {
    const n = chatsPendientes.length;
    const primero = chatsPendientes[0];
    notifications.unshift({
      id: "chats-pendientes",
      type: "chat-pendiente",
      title: n === 1 ? `${primero.nombre} espera tu respuesta` : `${n} clientes esperan respuesta`,
      message:
        n === 1
          ? primero.ultimoTexto || "Mensaje sin contestar"
          : chatsPendientes.slice(0, 3).map((p) => p.nombre).join(", ") + (n > 3 ? "…" : ""),
      date: primero.ultimoEntranteAt || new Date().toISOString(),
      icon: <MessageCircle className="w-5 h-5 text-green-600 shrink-0" />,
      onClick: () =>
        navigate("/chats", {
          state: n === 1 ? { abrirConversacion: primero.clientId } : { filtroChats: "sin-responder" },
        }),
    });
  }

  // ---- Grupos: lo urgente primero, agrupado por tipo y con quién es cada uno
  const clasificar = (n: { type: string; id: string }) => {
    const c = CLASE[n.type] || { grupo: "red", nivel: "seguimiento" as Nivel };
    // Faltan días para que venza la suscripción: avisa, pero no es urgente todavía.
    if (n.type === "billing" && n.id === "billing-warning") return { grupo: "suscripcion", nivel: "hoy" as Nivel };
    return c;
  };
  const esAdmin = userData?.role === "admin" || userData?.role === "master";
  const diasDesde = (iso: string) => Math.max(0, Math.floor((ahora.getTime() - new Date(iso).getTime()) / 86400000));
  const porNivel: Record<Nivel, { grupo: string; items: typeof notifications; detalle: string }[]> = { ahora: [], hoy: [], seguimiento: [] };
  const mapaGrupos = new Map<string, { nivel: Nivel; items: typeof notifications }>();
  for (const n of notifications) {
    const c = clasificar(n);
    const g = mapaGrupos.get(c.grupo) || { nivel: c.nivel, items: [] as typeof notifications };
    g.items.push(n);
    mapaGrupos.set(c.grupo, g);
  }
  for (const [grupo, g] of mapaGrupos) {
    const recientes = GRUPOS[grupo]?.recientesPrimero;
    g.items.sort((x, y) => (recientes ? new Date(y.date).getTime() - new Date(x.date).getTime() : new Date(x.date).getTime() - new Date(y.date).getTime()));
    // Qué decir debajo del título: quién y qué tan viejo.
    const partes: string[] = [];
    if (esAdmin && ["tareas-vencidas", "tareas-pronto", "pagos-vencidos", "pagos-pronto", "estancados"].includes(grupo)) {
      const cuenta: Record<string, number> = {};
      g.items.forEach((x) => { const k = nombres[x.asesorId || ""] || (x.asesorId ? "Otro asesor" : "Sin asesor"); cuenta[k] = (cuenta[k] || 0) + 1; });
      const lista = Object.entries(cuenta).sort((a, b) => b[1] - a[1]);
      if (lista.length > 1) partes.push(lista.slice(0, 4).map(([k, v]) => `${k} ${v}`).join(" · "));
    }
    if (recientes && g.items.length > 3) partes.push(`la más vieja lleva ${diasDesde(g.items[g.items.length - 1].date)} días`);
    porNivel[g.nivel].push({ grupo, items: g.items, detalle: partes.join(" — ") });
  }
  (Object.keys(porNivel) as Nivel[]).forEach((k) => porNivel[k].sort((a, b) => ORDEN_GRUPOS.indexOf(a.grupo) - ORDEN_GRUPOS.indexOf(b.grupo)));
  const conteo = { ahora: porNivel.ahora.reduce((s, g) => s + g.items.length, 0), hoy: porNivel.hoy.reduce((s, g) => s + g.items.length, 0), seguimiento: porNivel.seguimiento.reduce((s, g) => s + g.items.length, 0) };

  useEffect(() => {
    if (urgentesAntes.current !== null && conteo.ahora > urgentesAntes.current) {
      setPopNuevo(true);
      const t = setTimeout(() => setPopNuevo(false), 1200);
      urgentesAntes.current = conteo.ahora;
      return () => clearTimeout(t);
    }
    urgentesAntes.current = conteo.ahora;
  }, [conteo.ahora]);

  /**
   * Avisos en el escritorio.
   *
   * La campanita solo se ve si el usuario tiene el CRM delante. Estos avisos los
   * saca el navegador aunque este en otra pestana o con la ventana tapada, que
   * es justo cuando hacen falta.
   *
   * No sale todo: solo lo que no puede esperar -- la cita que empieza ya y lo
   * que se paso de fecha. El resto se queda en la campanita.
   *
   * Lo ya avisado se apunta en el navegador con la fecha del dia. Asi recargar
   * la pagina no repite el mismo aviso, y al dia siguiente la lista se tira
   * entera en vez de crecer para siempre.
   */
  const urgentes = notifications.filter(
    (n) => n.type === "task-now" || n.type === "task-overdue" || n.type === "payment-overdue" || n.type === "payment-missing" || n.type === "credito-ahora"
  );
  const firmaUrgentes = urgentes.map((n) => n.id).join(",");

  useEffect(() => {
    if (!firmaUrgentes) return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;

    const hoy = new Date().toISOString().slice(0, 10);
    const clave = `crm_avisos_enviados_${hoy}`;

    let yaAvisados: string[] = [];
    try {
      yaAvisados = JSON.parse(localStorage.getItem(clave) || "[]");
    } catch {
      yaAvisados = [];
    }

    const nuevos = urgentes.filter((n) => !yaAvisados.includes(n.id));
    if (nuevos.length === 0) return;

    for (const aviso of nuevos) {
      try {
        // El `tag` hace que un aviso repetido sustituya al anterior en lugar de
        // apilarse: si la misma cita vuelve a avisar, no quedan dos.
        new Notification(aviso.title, {
          body: aviso.message,
          tag: aviso.id,
          icon: "/favicon.svg",
        });
      } catch {
        // Si el navegador se niega, la campanita sigue mostrandolo igual.
      }
    }

    try {
      localStorage.setItem(clave, JSON.stringify([...yaAvisados, ...nuevos.map((n) => n.id)]));
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && k.startsWith("crm_avisos_enviados_") && k !== clave) localStorage.removeItem(k);
      }
    } catch {
      // Sin sitio donde apuntarlo el aviso puede repetirse; no es motivo para fallar.
    }
    // Depende solo de la firma: `urgentes` se lee del render que la produjo.
  }, [firmaUrgentes]);

  return (
    <>
      <div className="relative" ref={popoverRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 relative"
          aria-label="Notificaciones"
        >
          <Bell className={clsx("w-[22px] h-[22px]", conteo.ahora > 0 && !isOpen && "campana-viva text-red-500")} />
          {(conteo.ahora > 0 || conteo.hoy > 0) && (
            <span className={clsx("absolute top-1 right-0.5 flex h-[18px] min-w-[18px] px-1 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-sm ring-2 ring-white dark:ring-slate-900", conteo.ahora > 0 ? "bg-red-500 insignia-viva" : "bg-amber-500", popNuevo && "insignia-nueva")}>
              {(conteo.ahora > 0 ? conteo.ahora : conteo.hoy) > 99 ? "99+" : conteo.ahora > 0 ? conteo.ahora : conteo.hoy}
            </span>
          )}
        </button>

        {isOpen && (
          <>
            <div className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40 sm:hidden" onClick={() => setIsOpen(false)} />
            <div className="fixed inset-x-3 top-16 sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[26rem] bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden z-50 origin-top-right flex flex-col max-h-[80vh]">
              <div className="px-4 pt-3 pb-2 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-base">Pendientes</h3>
                  <button onClick={() => setIsOpen(false)} aria-label="Cerrar" className="sm:hidden text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"><X className="w-4 h-4" /></button>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {notifications.length === 0 ? "Todo al día." : [conteo.ahora && `${conteo.ahora} por atender ahora`, conteo.hoy && `${conteo.hoy} para hoy y mañana`, conteo.seguimiento && `${conteo.seguimiento} de seguimiento`].filter(Boolean).join(" · ")}
                </p>
                {notifications.length > 0 && (
                  <div className="flex gap-1 mt-2.5 -mb-px">
                    {([["todo", "Todo", notifications.length], ["ahora", "Ahora", conteo.ahora], ["hoy", "Hoy", conteo.hoy], ["seguimiento", "Seguimiento", conteo.seguimiento]] as const).map(([id, t, n]) => (
                      <button key={id} onClick={() => setPestana(id)} className={clsx("h-8 px-3 rounded-t-lg text-xs font-bold border-b-2 transition-colors", pestana === id ? "border-slate-900 dark:border-white text-slate-900 dark:text-white" : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200")}>
                        {t} <span className={clsx("ml-0.5 text-[11px]", id === "ahora" && n > 0 ? "text-red-600 dark:text-red-400" : "text-slate-400")}>{n}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                    <Check className="w-8 h-8 mx-auto mb-3 text-emerald-500" />
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">No tienes pendientes</p>
                    <p className="text-xs mt-0.5">Cuando haya algo que atender, aparecerá aquí.</p>
                  </div>
                ) : (
                  NIVELES.filter((nv) => (pestana === "todo" || pestana === nv.id) && porNivel[nv.id].length > 0).map((nv) => (
                    <div key={nv.id}>
                      {pestana === "todo" && (
                        <p className="px-4 pt-3 pb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 flex items-center gap-1.5">
                          <span className={clsx("w-2 h-2 rounded-full", nv.punto)} /> {nv.titulo}
                        </p>
                      )}
                      {porNivel[nv.id].map((g) => {
                        const cfg = GRUPOS[g.grupo];
                        const abierto = abiertos[g.grupo] ?? nv.id === "ahora";
                        const todos = verMas[g.grupo];
                        const visibles = abierto ? g.items.slice(0, todos ? 20 : 3) : [];
                        return (
                          <div key={g.grupo} className="border-t border-slate-100 dark:border-slate-700/60 first:border-t-0">
                            <button onClick={() => setAbiertos({ ...abiertos, [g.grupo]: !abierto })} className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/40 text-left" aria-expanded={abierto}>
                              <cfg.Icono className={clsx("w-4 h-4 shrink-0", cfg.color)} />
                              <span className="flex-1 min-w-0">
                                <span className="block text-sm font-extrabold text-slate-900 dark:text-slate-100 truncate">{g.items.length} · {cfg.titulo(g.items.length)}</span>
                                {g.detalle && <span className="block text-[11px] text-slate-500 dark:text-slate-400 truncate">{g.detalle}</span>}
                              </span>
                              {abierto ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                            </button>
                            {visibles.map((notif) => (
                              <div key={`notif-${notif.id}`} className="flex items-start gap-2 pl-10 pr-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/40 group">
                                <button onClick={() => { setIsOpen(false); notif.onClick(); }} className="flex-1 min-w-0 text-left">
                                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{notif.title}</p>
                                  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug line-clamp-2">{notif.message}</p>
                                </button>
                                {notif.type !== "config-pendiente" && notif.type !== "chat-pendiente" && (
                                  <button onClick={(e) => { e.stopPropagation(); handleDismissNotif(notif); }} title="Descartar" aria-label="Descartar" className="shrink-0 p-1 text-slate-300 hover:text-red-500 rounded sm:opacity-0 group-hover:opacity-100"><X className="w-3.5 h-3.5" /></button>
                                )}
                              </div>
                            ))}
                            {abierto && (
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pl-10 pr-4 pb-2.5 text-[11px] font-bold">
                                {g.items.length > 3 && !todos && <button onClick={() => setVerMas({ ...verMas, [g.grupo]: true })} className="text-blue-700 dark:text-blue-400 hover:underline">Ver {Math.min(g.items.length, 20) - 3} más</button>}
                                {cfg.ruta && <button onClick={() => { setIsOpen(false); navigate(cfg.ruta!); }} className="text-blue-700 dark:text-blue-400 hover:underline">{cfg.verTodas || "Ver todo"} →</button>}
                                {g.grupo !== "chats" && g.grupo !== "config" && g.items.length > 1 && (
                                  <button onClick={() => { if (window.confirm(`¿Descartar los ${g.items.length} avisos de «${cfg.titulo(g.items.length)}»? Volverán a salir si aparece uno nuevo.`)) g.items.forEach((x) => descartarAviso(x.id)); }} className="text-slate-500 hover:text-red-600 ml-auto">Descartar todos</button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Vehicle Detail Modal when clicked from a Match notification in Bell */}
      {selectedVehicle && selectedClientContext && (
        <VehicleDetailModal
          vehicle={selectedVehicle}
          clientContext={selectedClientContext}
          onClose={() => {
            setSelectedVehicle(null);
            setSelectedClientContext(null);
          }}
        />
      )}
    </>
  );
}

