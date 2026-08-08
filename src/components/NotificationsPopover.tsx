import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import { collection, query, where, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Task, Vehicle, Client } from "../types";
import { Bell, Calendar, CreditCard, X, AlertTriangle, Flame, Sparkles, ChevronRight, Check } from "lucide-react";
import { useNavigate } from "react-router";
import clsx from "clsx";
import { isBefore, addDays, startOfDay, isAfter } from "date-fns";
import { useSharedInventoryMatches } from "../hooks/useSharedInventoryMatches";
import { VehicleDetailModal } from "./VehicleDetailModal";

import { checkIsWon, checkIsLost } from "../lib/clientUtils";

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

export function NotificationsPopover() {
  const { userData } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [pipelineStages, setPipelineStages] = useState<any[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("crm_dismissed_notifications");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [selectedClientContext, setSelectedClientContext] = useState<Client | null>(null);

  const { matches, ownAgencySharing } = useSharedInventoryMatches();
  const popoverRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

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

    // 1. Listen to tasks
    let qTasks = query(
      collection(db, "tasks"),
      where("agencyId", "==", userData.agencyId),
      where("completed", "==", false)
    );

    if (userData.role === "seller") {
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

    if (userData.role === "seller") {
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
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(notif.id);
      try {
        localStorage.setItem("crm_dismissed_notifications", JSON.stringify(Array.from(next)));
      } catch (e) {
        console.error("Failed to save dismissed notification", e);
      }
      return next;
    });

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
    onClick: () => void;
  }> = [];

  const now = new Date();

  // 1. Task & Payment Notifications
  tasks.forEach((task) => {
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
    const isPaymentTask = task.type === 'payment' || 
      task.title?.toLowerCase().includes('pago') || 
      task.title?.toLowerCase().includes('mensualidad') || 
      task.title?.toLowerCase().includes('crédito');
    
    if (diffInMinutes < 0) {
      const notifId = `task-overdue-${task.id}`;
      if (dismissedIds.has(notifId)) return;
      notifications.push({
        id: notifId,
        type: isPaymentTask ? "payment-overdue" : "task-overdue",
        title: isPaymentTask ? "⚠️ Pago Mensual Faltante" : "Tarea Vencida",
        message: isPaymentTask ? `¡Pago no registrado! ${task.title}` : task.title,
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
        message: task.title,
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
    const sDetails = client.saleDetails;
    if (!sDetails || sDetails.method !== 'credito' || !sDetails.termMonths || !sDetails.firstPaymentDate) return;

    const termMonths = sDetails.termMonths;
    const monthlyPayment = sDetails.calculatedMonthlyPayment || 0;
    const existingPayments = sDetails.payments || [];

    let currentDate = new Date(sDetails.firstPaymentDate);
    currentDate.setHours(12, 0, 0, 0);

    for (let i = 1; i <= termMonths; i++) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const isPaid = existingPayments.some(p => p.installmentNumber === i);

      if (!isPaid) {
        const notifId = `notif-credit-sched-${client.id}-m${i}`;
        if (!dismissedIds.has(notifId)) {
          const dueMs = currentDate.getTime();
          const todayMs = new Date(`${todayStr}T12:00:00`).getTime();
          const diffDays = Math.round((dueMs - todayMs) / (1000 * 60 * 60 * 24));

          if (dateStr < todayStr) {
            notifications.push({
              id: notifId,
              type: "payment-missing",
              title: `⚠️ Mensualidad #${i} Faltante (${client.name})`,
              message: `Monto de $${monthlyPayment.toLocaleString('es-MX')} venció el ${dateStr} y no está registrado.`,
              date: currentDate.toISOString(),
              icon: <CreditCard className="w-5 h-5 text-red-500 shrink-0 animate-bounce" />,
              clientId: client.id,
              onClick: () => {
                navigate("/persons", { state: { clientId: client.id } });
              },
            });
          } else if (diffDays >= 0 && diffDays <= 2) {
            const tag = diffDays === 0 ? "Vence HOY" : diffDays === 1 ? "Vence MAÑANA" : "Vence en 2 días";
            notifications.push({
              id: notifId,
              type: "payment-upcoming",
              title: `⏰ Próxima Mensualidad #${i} (${tag})`,
              message: `${client.name}: $${monthlyPayment.toLocaleString('es-MX')} vence el ${dateStr}.`,
              date: currentDate.toISOString(),
              icon: <CreditCard className="w-5 h-5 text-amber-500 shrink-0" />,
              clientId: client.id,
              onClick: () => {
                navigate("/persons", { state: { clientId: client.id } });
              },
            });
          }
        }
      }

      currentDate.setMonth(currentDate.getMonth() + 1);
    }
  });

  // 2. Stale Deals Notifications (3+ days)
  clients.forEach((client) => {
    if (client.isDeleted || (client as any).dismissedStale || (client as any).isArchived || (client as any).isClosed) return;
    if (isClosedStatus(client.status, pipelineStages) || isClosedStatus((client as any).stageId, pipelineStages)) return;

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
        onClick: () => {
          navigate("/persons", { state: { clientId: client.id } });
        },
      });
    }
  });

  // 3. Network Inventory Matches
  if (ownAgencySharing) {
    matches.forEach((m) => {
      const notifId = `match-${m.client.id}-${m.vehicle.id}`;
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

        notifications.push({
          id: notifId,
          type: "admin-approval",
          title: `Aprobación Pendiente: ${v.make} ${v.model}`,
          message: `${requestedBy} solicitó marcar como ${typeLabel}${clientName}.`,
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

  // Sort by urgency / date
  notifications.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <>
      <div className="relative" ref={popoverRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 relative"
          aria-label="Notificaciones"
        >
          <Bell className="w-[22px] h-[22px]" />
          {notifications.length > 0 && (
            <span className="absolute top-1.5 right-1.5 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-white dark:ring-slate-900">
              {notifications.length > 9 ? "9+" : notifications.length}
            </span>
          )}
        </button>

        {isOpen && (
          <>
            <div 
              className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40 sm:hidden" 
              onClick={() => setIsOpen(false)} 
            />
            <div className="fixed inset-x-3 top-16 sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-200 dark:border-slate-700 overflow-hidden z-50 origin-top-right transition-all">
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-amber-500" />
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Notificaciones Centro</h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 py-1 px-2.5 rounded-full">
                    {notifications.length} pendientes
                  </span>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="sm:hidden text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

            <div className="max-h-[420px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                  <Bell className="w-8 h-8 mx-auto mb-3 opacity-20" />
                  <p className="text-sm font-medium">No tienes notificaciones pendientes</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {notifications.map((notif) => (
                    <div
                      key={`notif-${notif.id}`}
                      className="w-full flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group relative"
                    >
                      <button
                        onClick={() => {
                          setIsOpen(false);
                          notif.onClick();
                        }}
                        className="flex-1 flex items-start gap-3 min-w-0 text-left"
                      >
                        <div className="mt-0.5 shrink-0 p-2 bg-slate-100 dark:bg-slate-700/60 rounded-lg group-hover:bg-white dark:group-hover:bg-slate-600 transition-colors shadow-sm">
                          {notif.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                              {notif.title}
                            </h4>
                            <ChevronRight className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity ml-1" />
                          </div>
                          <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 leading-snug line-clamp-2">
                            {notif.message}
                          </p>
                        </div>
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDismissNotif(notif);
                        }}
                        title="Descartar notificación"
                        className="shrink-0 ml-2 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors opacity-80 sm:opacity-0 group-hover:opacity-100 flex items-center gap-1 text-[10px] font-medium"
                      >
                        <X className="w-4 h-4" />
                        <span className="hidden sm:inline">Descartar</span>
                      </button>
                    </div>
                  ))}
                </div>
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

