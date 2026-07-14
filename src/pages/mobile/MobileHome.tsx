import { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { Task, Client } from "../../types";
import {
  CheckCircle,
  Circle,
  Clock,
  Phone,
  Calendar,
  MessageCircle,
  FileText,
  User,
} from "lucide-react";
import clsx from "clsx";

const typeIcons: Record<string, any> = {
  call: Phone,
  meeting: Calendar,
  whatsapp: MessageCircle,
  email: FileText,
  other: Clock,
};

export function MobileHome() {
  const { userData } = useAuth();
  const [tasks, setTasks] = useState<{ task: Task; client?: Client }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userData || userData.role === "master") return;

    const fetchTodayTasks = async () => {
      try {
        const today = new Date().toISOString().split("T")[0];
        const q = query(
          collection(db, "tasks"),
          where("agencyId", "==", userData.agencyId),
          where("sellerId", "==", userData.id),
          where("date", "==", today)
        );

        const snap = await getDocs(q);
        const taskList = snap.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as Task
        );

        // Fetch clients for these tasks
        const clientIds = [...new Set(taskList.map((t) => t.clientId).filter(Boolean))];
        const clientsMap = new Map<string, Client>();
        
        if (clientIds.length > 0) {
          // Batch fetch clients if less than 30 (Firestore limitation is 30 for 'in')
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

        const combined = taskList.map(t => ({
          task: t,
          client: t.clientId ? clientsMap.get(t.clientId) : undefined
        }));

        // Sort by time
        combined.sort((a, b) => (a.task.time || "").localeCompare(b.task.time || ""));

        setTasks(combined);
      } catch (err) {
        console.error("Error fetching today's tasks:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchTodayTasks();
  }, [userData]);

  const toggleTaskStatus = async (task: Task) => {
    try {
      const newStatus = task.status === "completed" ? "pending" : "completed";
      await updateDoc(doc(db, "tasks", task.id!), { status: newStatus });
      setTasks(tasks.map(t => 
        t.task.id === task.id ? { ...t, task: { ...t.task, status: newStatus } } : t
      ));
    } catch (error) {
      console.error("Error updating task status:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  const pendingCount = tasks.filter(t => t.task.status === "pending").length;

  return (
    <div className="flex flex-col h-full overflow-y-auto pb-20">
      <div className="mb-6 mt-2">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
          Mis Pendientes de Hoy
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {pendingCount} {pendingCount === 1 ? 'tarea pendiente' : 'tareas pendientes'} para hoy
        </p>
      </div>

      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 px-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm text-center">
          <CheckCircle className="w-16 h-16 text-green-400 mb-4" />
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">
            ¡Todo al día!
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No tienes pendientes programados para hoy. Disfruta tu día.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map(({ task, client }) => {
            const Icon = typeIcons[task.type] || Clock;
            const isCompleted = task.status === "completed";

            return (
              <div 
                key={task.id}
                className={clsx(
                  "bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border transition-all",
                  isCompleted 
                    ? "border-slate-100 dark:border-slate-700/50 opacity-60" 
                    : "border-slate-200 dark:border-slate-700 border-l-4 border-l-blue-500"
                )}
              >
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => toggleTaskStatus(task)}
                    className="mt-1 shrink-0 text-slate-400 hover:text-blue-500 transition-colors"
                  >
                    {isCompleted ? (
                      <CheckCircle className="w-6 h-6 text-green-500" />
                    ) : (
                      <Circle className="w-6 h-6" />
                    )}
                  </button>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1 gap-2">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                        <Icon className="w-3.5 h-3.5" />
                        <span className="capitalize">{task.type}</span>
                      </div>
                      {task.time && (
                        <div className="flex items-center gap-1 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700/50 px-2 py-0.5 rounded-full">
                          <Clock className="w-3 h-3" />
                          {task.time}
                        </div>
                      )}
                    </div>
                    
                    <h4 className={clsx(
                      "text-sm font-semibold mb-1",
                      isCompleted ? "text-slate-500 line-through" : "text-slate-900 dark:text-white"
                    )}>
                      {task.title}
                    </h4>
                    
                    {client && (
                      <div className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-medium">
                        <User className="w-3.5 h-3.5" />
                        <span className="truncate">{client.name}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
