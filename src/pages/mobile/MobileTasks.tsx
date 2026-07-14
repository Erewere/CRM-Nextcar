import { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { Task, Client } from "../../types";
import { NewActivityModal } from "../../components/NewActivityModal";
import { Calendar, Plus, Clock, User, Phone, MessageCircle, FileText, CheckCircle } from "lucide-react";
import clsx from "clsx";
import { format, isAfter, isBefore, startOfDay, endOfDay, addDays } from "date-fns";

export function MobileTasks() {
  const { userData } = useAuth();
  const [tasks, setTasks] = useState<{ task: Task; client?: Client }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);

  useEffect(() => {
    fetchTasks();
  }, [userData]);

  const fetchTasks = async () => {
    if (!userData || userData.role === "master") return;
    setLoading(true);
    try {
      const q = query(
        collection(db, "tasks"),
        where("agencyId", "==", userData.agencyId),
        where("sellerId", "==", userData.id),
        // orderBy("date", "asc")
      );

      const snap = await getDocs(q);
      const taskList = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Task);
      
      const clientIds = [...new Set(taskList.map(t => t.clientId).filter(Boolean))];
      const clientsMap = new Map<string, Client>();
      
      if (clientIds.length > 0) {
        const chunks = [];
        for (let i = 0; i < clientIds.length; i += 30) {
          chunks.push(clientIds.slice(i, i + 30));
        }
        for (const chunk of chunks) {
          const cq = query(
            collection(db, "clients"),
            where("agencyId", "==", userData.agencyId),
            where("__name__", "in", chunk)
          );
          const cSnap = await getDocs(cq);
          cSnap.forEach(d => {
            clientsMap.set(d.id, { id: d.id, ...d.data() } as Client);
          });
        }
      }

      const combined = taskList
        .filter(t => t.status === "pending")
        .map(t => ({
          task: t,
          client: t.clientId ? clientsMap.get(t.clientId) : undefined
        }))
        .sort((a, b) => {
          const dateA = new Date(`${a.task.date}T${a.task.time || "00:00"}`);
          const dateB = new Date(`${b.task.date}T${b.task.time || "00:00"}`);
          return dateA.getTime() - dateB.getTime();
        });

      setTasks(combined);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  const getIcon = (type: string) => {
    switch (type) {
      case "call": return Phone;
      case "whatsapp": return MessageCircle;
      case "meeting": return Calendar;
      case "email": return FileText;
      default: return Clock;
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto pb-24 relative">
      <div className="mb-6 mt-2 px-1">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
          Próximas Citas
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {tasks.length} actividades programadas
        </p>
      </div>

      <div className="space-y-4 px-1">
        {tasks.map(({ task, client }) => {
          const Icon = getIcon(task.type);
          return (
            <div 
              key={task.id} 
              className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-700"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-base font-semibold text-slate-900 dark:text-white mb-1">
                    {task.title}
                  </h4>
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="flex items-center gap-1 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700/50 px-2 py-0.5 rounded-full">
                      <Calendar className="w-3 h-3" />
                      {task.date}
                    </span>
                    {task.time && (
                      <span className="flex items-center gap-1 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700/50 px-2 py-0.5 rounded-full">
                        <Clock className="w-3 h-3" />
                        {task.time}
                      </span>
                    )}
                  </div>
                  {client && (
                    <div className="flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 font-medium">
                      <User className="w-4 h-4" />
                      <span className="truncate">{client.name}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {tasks.length === 0 && (
           <div className="text-center py-10 text-slate-500">No hay citas pendientes.</div>
        )}
      </div>

      <button
        onClick={() => setShowNewTaskModal(true)}
        className="fixed bottom-20 right-4 w-14 h-14 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-xl hover:bg-blue-700 active:scale-95 transition-all z-40"
      >
        <Plus className="w-6 h-6" />
      </button>

      {showNewTaskModal && (
        <NewActivityModal
          onClose={() => setShowNewTaskModal(false)}
          onSave={fetchTasks}
        />
      )}
    </div>
  );
}
