import React, { useEffect, useState, useRef } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Task, Client, Vehicle } from '../types';
import { Bell, Clock, AlertTriangle, Flame, X, ChevronRight, Minimize2, Maximize2, Sparkles, MessageSquare, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useSharedInventoryMatches } from '../hooks/useSharedInventoryMatches';
import { VehicleDetailModal } from './VehicleDetailModal';
import clsx from 'clsx';

import { checkIsWon, checkIsLost } from '../lib/clientUtils';

export interface ToastAlert {
  id: string;
  type: 'task-overdue' | 'task-today' | 'deal-stale' | 'match-network';
  title: string;
  subtitle: string;
  detail: string;
  daysStale?: number;
  taskId?: string;
  clientId?: string;
  severity: 'high' | 'medium';
  matchVehicle?: Vehicle;
  matchClient?: Client;
  agencyName?: string;
}

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

export function TaskReminders() {
  const { userData } = useAuth();
  const navigate = useNavigate();
  const { matches } = useSharedInventoryMatches();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [pipelineStages, setPipelineStages] = useState<any[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [selectedClientContext, setSelectedClientContext] = useState<Client | null>(null);

  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => {
    try {
      const stored = sessionStorage.getItem('nextcar_dismissed_toasts');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  const [isMinimized, setIsMinimized] = useState(false);
  const notifiedIds = useRef<Set<string>>(new Set());

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

  // Request browser notification permission
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
  }, []);

  // Save dismissed items to sessionStorage and Firestore for matches/stale deals
  const dismissToast = async (alert: ToastAlert) => {
    setDismissedIds(prev => {
      const next = new Set(prev);
      next.add(alert.id);
      try {
        sessionStorage.setItem('nextcar_dismissed_toasts', JSON.stringify(Array.from(next)));
      } catch (e) {
        console.error("Failed to save dismissed toasts:", e);
      }
      return next;
    });

    if (alert.type === 'deal-stale' && alert.clientId) {
      try {
        await updateDoc(doc(db, 'clients', alert.clientId), {
          dismissedStale: true,
          staleDismissedAt: new Date().toISOString()
        });
      } catch (err) {
        console.error("Error setting dismissedStale in Firestore:", err);
      }
    }

    if (alert.type === 'match-network' && alert.matchClient && alert.matchVehicle) {
      try {
        const client = alert.matchClient;
        const dismissed = client.dismissedMatches || [];
        const dismissKey = `${alert.matchVehicle.id}_${alert.matchVehicle.price || 0}`;
        if (!dismissed.includes(dismissKey)) {
          await updateDoc(doc(db, 'clients', client.id), {
            dismissedMatches: [...dismissed, dismissKey]
          });
        }
      } catch (err) {
        console.error("Error persisting dismissed match to Firestore:", err);
      }
    }
  };

  const dismissAllToasts = (alerts: ToastAlert[]) => {
    alerts.forEach(alert => dismissToast(alert));
  };

  // 1. Fetch pending tasks
  useEffect(() => {
    if (!userData?.id || userData.role === 'master' || userData.role === 'unassigned') return;

    let q = query(
      collection(db, 'tasks'),
      where('agencyId', '==', userData.agencyId),
      where('completed', '==', false)
    );

    if (userData.role === 'seller') {
      q = query(
        collection(db, 'tasks'),
        where('agencyId', '==', userData.agencyId),
        where('sellerId', '==', userData.id),
        where('completed', '==', false)
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const taskList = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Task));
      setTasks(taskList);
    }, (error) => {
      console.error("Error listening to tasks for toasts:", error);
    });

    return () => unsubscribe();
  }, [userData]);

  // 2. Fetch active deals/clients
  useEffect(() => {
    if (!userData?.id || userData.role === 'master' || userData.role === 'unassigned') return;

    let q = query(
      collection(db, 'clients'),
      where('agencyId', '==', userData.agencyId)
    );

    if (userData.role === 'seller') {
      q = query(
        collection(db, 'clients'),
        where('agencyId', '==', userData.agencyId),
        where('sellerId', '==', userData.id)
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const clientList = snapshot.docs
        .map(doc => ({ ...doc.data(), id: doc.id } as Client))
        .filter(c => !c.isDeleted && !isClosedStatus(c.status));
      setClients(clientList);
    }, (error) => {
      console.error("Error listening to clients for toasts:", error);
    });

    return () => unsubscribe();
  }, [userData]);

  // Generate Toast Alerts
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const rawAlerts: ToastAlert[] = [];

  // A) Tasks alerts & Credit Payment Reminders
  tasks.forEach(task => {
    if (!task.dueDate || task.completed) return;

    const toastId = `task-${task.id}`;
    if (dismissedIds.has(toastId)) return;

    const isPaymentTask = task.type === 'payment' || 
      task.title?.toLowerCase().includes('pago') || 
      task.title?.toLowerCase().includes('mensualidad') || 
      task.title?.toLowerCase().includes('crédito');

    if (task.dueDate < todayStr) {
      rawAlerts.push({
        id: toastId,
        type: 'task-overdue',
        title: isPaymentTask ? '⚠️ Pago Mensual Faltante' : 'Tarea Vencida',
        subtitle: task.title,
        detail: isPaymentTask
          ? `¡Pago no registrado! Venció el ${task.dueDate}${task.startTime ? ` (${task.startTime})` : ''}`
          : `Venció el ${task.dueDate}${task.startTime ? ` (${task.startTime})` : ''}`,
        taskId: task.id,
        clientId: task.clientId,
        severity: 'high',
      });
    } else {
      // Calculate days difference
      const dueMs = new Date(`${task.dueDate}T12:00:00`).getTime();
      const todayMs = new Date(`${todayStr}T12:00:00`).getTime();
      const diffDays = Math.round((dueMs - todayMs) / (1000 * 60 * 60 * 24));

      if (diffDays >= 0 && diffDays <= 2) {
        if (isPaymentTask) {
          const daysTag = diffDays === 0 ? 'Vence HOY' : diffDays === 1 ? 'Vence MAÑANA' : 'Vence en 2 DÍAS';
          rawAlerts.push({
            id: toastId,
            type: 'task-today',
            title: `⏰ Próximo Pago (${daysTag})`,
            subtitle: task.title,
            detail: `Recordatorio: Mensualidad programada para el ${task.dueDate}. Registra la mensualidad.`,
            taskId: task.id,
            clientId: task.clientId,
            severity: diffDays <= 1 ? 'high' : 'medium',
          });
        } else if (diffDays === 0) {
          rawAlerts.push({
            id: toastId,
            type: 'task-today',
            title: 'Tarea Pendiente Hoy',
            subtitle: task.title,
            detail: task.startTime ? `Programada a las ${task.startTime}` : 'Para atender hoy',
            taskId: task.id,
            clientId: task.clientId,
            severity: 'medium',
          });
        }
      }
    }
  });

  // A.2) Check Client Credit Schedules directly (in case tasks were not created or to ensure no missing payment is overlooked)
  clients.forEach(client => {
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
        const toastId = `credit-schedule-${client.id}-m${i}`;
        if (!dismissedIds.has(toastId)) {
          const dueMs = currentDate.getTime();
          const todayMs = new Date(`${todayStr}T12:00:00`).getTime();
          const diffDays = Math.round((dueMs - todayMs) / (1000 * 60 * 60 * 24));

          if (dateStr < todayStr) {
            // Overdue missing payment!
            rawAlerts.push({
              id: toastId,
              type: 'task-overdue',
              title: '⚠️ Pago Mensual Faltante',
              subtitle: `Mensualidad #${i}/${termMonths} - ${client.name}`,
              detail: `¡Pago de $${monthlyPayment.toLocaleString('es-MX')} sin registrar! Venció el ${dateStr}.`,
              clientId: client.id,
              severity: 'high',
            });
          } else if (diffDays >= 0 && diffDays <= 2) {
            // 2 days or less remaining
            const daysTag = diffDays === 0 ? 'Vence HOY' : diffDays === 1 ? 'Vence MAÑANA' : 'Vence en 2 DÍAS';
            rawAlerts.push({
              id: toastId,
              type: 'task-today',
              title: `⏰ Próximo Pago (${daysTag})`,
              subtitle: `Mensualidad #${i}/${termMonths} - ${client.name}`,
              detail: `Monto: $${monthlyPayment.toLocaleString('es-MX')}. Vence el ${dateStr}.`,
              clientId: client.id,
              severity: diffDays <= 1 ? 'high' : 'medium',
            });
          }
        }
      }

      currentDate.setMonth(currentDate.getMonth() + 1);
    }
  });

  // B) Stale Deals alerts (3+ days without movement)
  clients.forEach(client => {
    if (client.isDeleted || (client as any).dismissedStale || (client as any).isArchived || (client as any).isClosed) return;
    if (isClosedStatus(client.status, pipelineStages) || isClosedStatus((client as any).stageId, pipelineStages)) return;

    const toastId = `deal-${client.id}`;
    if (dismissedIds.has(toastId) || dismissedIds.has(`deal-stale-${client.id}`)) return;

    const lastUpdate = parseDate(client.updatedAt || client.createdAt);
    if (!lastUpdate) return;

    const diffMs = now.getTime() - lastUpdate.getTime();
    if (diffMs < 0) return;

    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays >= 3) {
      const isHighSeverity = diffDays >= 5;
      const dealName = client.dealTitle || client.name || 'Trato sin nombre';
      const vehicleInfo = client.vehicle ? ` (${client.vehicle})` : '';

      rawAlerts.push({
        id: toastId,
        type: 'deal-stale',
        title: isHighSeverity ? 'Trato Estancado' : 'Sin Movimiento Reciente',
        subtitle: `${dealName}${vehicleInfo}`,
        detail: `Sin actividad desde hace ${diffDays} días (${client.status || 'En seguimiento'})`,
        daysStale: diffDays,
        clientId: client.id,
        severity: isHighSeverity ? 'high' : 'medium',
      });
    }
  });

  // C) Network Matches alerts
  matches.forEach(m => {
    const toastId = `match-${m.client.id}-${m.vehicle.id}`;
    if (dismissedIds.has(toastId)) return;

    const isHigh = m.level === 'exact' || m.score >= 80;
    rawAlerts.push({
      id: toastId,
      type: 'match-network',
      title: m.level === 'exact' ? 'Match Perfecto en Red' : `Coincidencia ${m.score}% en Red`,
      subtitle: `${m.vehicle.make} ${m.vehicle.model} (${m.vehicle.year})`,
      detail: `Coincide con cliente: ${m.client.name} • ${m.agencyName}`,
      matchVehicle: m.vehicle,
      matchClient: m.client,
      agencyName: m.agencyName,
      severity: isHigh ? 'high' : 'medium',
    });
  });

  // Sort alerts: high severity first, then stale days / dates
  rawAlerts.sort((a, b) => {
    if (a.severity === 'high' && b.severity !== 'high') return -1;
    if (a.severity !== 'high' && b.severity === 'high') return 1;
    if (a.daysStale && b.daysStale) return b.daysStale - a.daysStale;
    return 0;
  });

  // Desktop Web Notifications triggering
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') return;

    rawAlerts.forEach(alert => {
      if (!notifiedIds.current.has(alert.id)) {
        notifiedIds.current.add(alert.id);
        new Notification(alert.title, {
          body: `${alert.subtitle} - ${alert.detail}`,
          icon: '/favicon.svg',
        });
      }
    });
  }, [rawAlerts]);

  if (rawAlerts.length === 0 && !selectedVehicle) return null;

  const handleAction = (alert: ToastAlert) => {
    if (alert.type === 'match-network' && alert.matchVehicle && alert.matchClient) {
      setSelectedVehicle(alert.matchVehicle);
      setSelectedClientContext(alert.matchClient);
      return;
    }

    if (alert.taskId) {
      navigate(`/tasks?taskId=${alert.taskId}`, { state: { taskId: alert.taskId } });
    } else if (alert.clientId) {
      navigate('/persons', { state: { clientId: alert.clientId } });
    } else {
      navigate('/persons');
    }
  };

  const taskCount = rawAlerts.filter(a => a.type.startsWith('task')).length;
  const dealCount = rawAlerts.filter(a => a.type === 'deal-stale').length;
  const matchCount = rawAlerts.filter(a => a.type === 'match-network').length;

  return (
    <>
      {rawAlerts.length > 0 && (
        isMinimized ? (
          <button
            onClick={() => setIsMinimized(false)}
            className="fixed bottom-4 right-4 z-50 flex items-center gap-2.5 bg-slate-900 text-white dark:bg-slate-800 dark:border dark:border-slate-700 px-4 py-2.5 rounded-full shadow-2xl hover:bg-slate-800 dark:hover:bg-slate-700 transition-all duration-200 animate-in fade-in slide-in-from-bottom-2"
          >
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </span>
            <span className="text-xs font-bold">
              {rawAlerts.length} Alertas
              {taskCount > 0 && ` (${taskCount} tareas)`}
              {dealCount > 0 && ` (${dealCount} tratos)`}
              {matchCount > 0 && ` (${matchCount} matches)`}
            </span>
            <Maximize2 className="w-3.5 h-3.5 text-slate-400 ml-1" />
          </button>
        ) : (
          <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-[92vw] sm:w-96 animate-in slide-in-from-right-6 fade-in duration-300">
            {/* Toast Header */}
            <div className="bg-slate-900/95 dark:bg-slate-800/95 backdrop-blur-md text-white rounded-lg px-3.5 py-2 flex items-center justify-between border border-slate-700 shadow-lg text-xs">
              <div className="flex items-center gap-2 font-bold">
                <Bell className="w-4 h-4 text-amber-400 animate-bounce" />
                <span>Atención Requerida ({rawAlerts.length})</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => dismissAllToasts(rawAlerts)}
                  className="text-slate-400 hover:text-white text-[11px] font-medium underline transition-colors"
                >
                  Descartar todas
                </button>
                <button
                  onClick={() => setIsMinimized(true)}
                  className="text-slate-400 hover:text-white p-0.5 rounded transition-colors"
                  title="Minimizar"
                >
                  <Minimize2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Toast Stack (Shows up to 4 toasts) */}
            <div className="flex flex-col gap-2 max-h-[70vh] overflow-y-auto pr-0.5">
              {rawAlerts.slice(0, 4).map(alert => {
                const isHigh = alert.severity === 'high';
                const isTask = alert.type.startsWith('task');
                const isMatch = alert.type === 'match-network';

                return (
                  <div
                    key={alert.id}
                    className={clsx(
                      "bg-white dark:bg-slate-900 border rounded-xl p-3.5 shadow-xl transition-all duration-200 flex flex-col gap-2 relative group",
                      isHigh
                        ? "border-red-300 dark:border-red-900/60 ring-1 ring-red-500/20"
                        : "border-amber-300 dark:border-amber-900/60 ring-1 ring-amber-500/20"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {/* Icon Badge */}
                      <div
                        className={clsx(
                          "p-2 rounded-lg shrink-0 mt-0.5 flex items-center justify-center",
                          alert.type === 'task-overdue' && "bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-400",
                          alert.type === 'task-today' && "bg-blue-100 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400",
                          alert.type === 'deal-stale' && isHigh && "bg-orange-100 text-orange-600 dark:bg-orange-950/60 dark:text-orange-400",
                          alert.type === 'deal-stale' && !isHigh && "bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400",
                          alert.type === 'match-network' && "bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400"
                        )}
                      >
                        {alert.type === 'task-overdue' && <AlertTriangle className="w-4 h-4" />}
                        {alert.type === 'task-today' && <Clock className="w-4 h-4" />}
                        {alert.type === 'deal-stale' && <Flame className="w-4 h-4" />}
                        {alert.type === 'match-network' && <Sparkles className="w-4 h-4" />}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 pr-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={clsx(
                              "text-[10px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded",
                              isHigh
                                ? "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300"
                                : "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"
                            )}
                          >
                            {alert.title}
                          </span>
                        </div>

                        <h5 className="font-bold text-slate-900 dark:text-slate-100 text-xs mt-1 truncate">
                          {alert.subtitle}
                        </h5>
                        <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-snug mt-0.5">
                          {alert.detail}
                        </p>
                      </div>

                      {/* Dismiss X */}
                      <button
                        onClick={() => dismissToast(alert)}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1 -mr-1 -mt-1 rounded"
                        title="Descartar"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Action Links */}
                    <div className="flex justify-end gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/80">
                      {isMatch && alert.matchClient?.phone && (
                        <a
                          href={`https://wa.me/${alert.matchClient.phone.replace(/[^0-9]/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] font-bold px-2.5 py-1 rounded-md transition-colors flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60"
                        >
                          <MessageSquare className="w-3 h-3" />
                          WhatsApp
                        </a>
                      )}
                      <button
                        onClick={() => handleAction(alert)}
                        className={clsx(
                          "text-[11px] font-bold px-2.5 py-1 rounded-md transition-colors flex items-center gap-1",
                          isTask
                            ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50"
                            : isMatch
                            ? "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50"
                            : "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50"
                        )}
                      >
                        {isTask ? 'Ver Tarea' : isMatch ? 'Ver Auto' : 'Ver Trato'}
                        {isMatch ? <ExternalLink className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                );
              })}

              {rawAlerts.length > 4 && (
                <div className="text-center py-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  + {rawAlerts.length - 4} alertas adicionales pendientes
                </div>
              )}
            </div>
          </div>
        )
      )}

      {/* Vehicle Detail Modal when clicked from a Match alert */}
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
