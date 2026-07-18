import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Task } from "../types";
import { Bell, Calendar, CreditCard, Mail, X } from "lucide-react";
import { useNavigate } from "react-router";
import clsx from "clsx";
import { isBefore, addDays, startOfDay, parseISO, isAfter } from "date-fns";

export function NotificationsPopover() {
  const { userData } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const popoverRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!userData) return;

    let q = query(
      collection(db, "tasks"),
      where("agencyId", "==", userData.agencyId),
      where("completed", "==", false)
    );

    if (userData.role === "seller") {
      q = query(
        collection(db, "tasks"),
        where("agencyId", "==", userData.agencyId),
        where("sellerId", "==", userData.id),
        where("completed", "==", false)
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedTasks = snapshot.docs.map(
        (doc) => ({ ...doc.data(), id: doc.id } as Task)
      );
      setTasks(fetchedTasks);
    }, (error) => {
      console.error("Error listening to notification tasks:", error);
    });

    return () => unsubscribe();
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

  const notifications = [];

  // 1. Task Notifications
  const now = new Date();

  tasks.forEach((task) => {
    if (!task.dueDate) return;
    
    // Parse task date and time
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
      // If no specific time, set to end of day so it doesn't show as overdue prematurely
      taskDateTime = new Date(`${task.dueDate}T23:59:59`);
    }
    
    const diffInMinutes = (taskDateTime.getTime() - now.getTime()) / 60000;
    
    if (diffInMinutes < 0) {
      notifications.push({
        id: `task-overdue-${task.id}`,
        type: "task-overdue",
        title: "Tarea Vencida",
        message: task.title,
        date: taskDateTime.toISOString(),
        icon: <Calendar className="w-5 h-5 text-red-500" />,
        onClick: () => {
          if (task.clientId) {
            navigate("/persons", { state: { clientId: task.clientId } });
          } else {
            navigate(`/tasks?taskId=${task.id}`);
          }
        },
      });
    } else if (diffInMinutes >= 0 && diffInMinutes <= 15) {
      notifications.push({
        id: `task-soon-${task.id}`,
        type: "task-soon",
        title: "Tarea por Vencer (15 min)",
        message: task.title,
        date: taskDateTime.toISOString(),
        icon: <Calendar className="w-5 h-5 text-amber-500" />,
        onClick: () => {
          if (task.clientId) {
            navigate("/persons", { state: { clientId: task.clientId } });
          } else {
            navigate(`/tasks?taskId=${task.id}`);
          }
        },
      });
    }
  });

  // 2. Billing Notification (mock based on user creation date for trial)
  const today = startOfDay(new Date());
  if (userData && (userData.role === "master" || userData.role === "admin")) {
    const createdAt = userData.createdAt instanceof Date ? userData.createdAt : (userData.createdAt?.toDate ? userData.createdAt.toDate() : new Date(userData.createdAt || Date.now()));
    const trialEnd = addDays(createdAt, 30);
    const billingWarningDate = addDays(today, 5); // 5 days warning

    if (isBefore(trialEnd, billingWarningDate) && isAfter(trialEnd, today)) {
       notifications.push({
        id: `billing-warning`,
        type: "billing",
        title: "Suscripción por Vencer",
        message: "Tu prueba gratis está por terminar. Haz tu pago pronto.",
        date: trialEnd.toISOString(),
        icon: <CreditCard className="w-5 h-5 text-blue-500" />,
        onClick: () => navigate("/billing"),
      });
    } else if (isBefore(trialEnd, today)) {
       notifications.push({
        id: `billing-expired`,
        type: "billing",
        title: "Suscripción Vencida",
        message: "Realiza tu pago para seguir disfrutando de todas las funciones.",
        date: trialEnd.toISOString(),
        icon: <CreditCard className="w-5 h-5 text-red-500" />,
        onClick: () => navigate("/billing"),
      });
    }
  }

  // Sort by date (most urgent first)
  notifications.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 relative"
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
        <div className="absolute right-0 mt-2 w-80 md:w-96 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden z-50 origin-top-right transition-all">
          <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/50">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100">Notificaciones</h3>
            <span className="text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 py-1 px-2 rounded-full">
              {notifications.length} pendientes
            </span>
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                <Bell className="w-8 h-8 mx-auto mb-3 opacity-20" />
                <p className="text-sm">No tienes notificaciones pendientes</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {notifications.map((notif) => (
                  <button
                    key={`notif-${notif.id}`}
                    onClick={() => {
                      setIsOpen(false);
                      notif.onClick();
                    }}
                    className="w-full flex items-start gap-3 p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left group"
                  >
                    <div className="mt-1 shrink-0 p-2 bg-slate-100 dark:bg-slate-800 rounded-full group-hover:bg-white dark:group-hover:bg-slate-700 transition-colors shadow-sm">
                      {notif.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {notif.title}
                      </h4>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">
                        {notif.message}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
