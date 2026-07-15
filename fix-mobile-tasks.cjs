const fs = require('fs');

const code = `import { useEffect, useState, useMemo, useRef } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { Task, Client } from "../../types";
import { NewActivityModal } from "../../components/NewActivityModal";
import { Search, Plus, CalendarIcon, Menu } from "lucide-react";
import clsx from "clsx";
import { format, addDays, isSameDay, parseISO } from "date-fns";
import { es } from "date-fns/locale";

export function MobileTasks() {
  const { userData } = useAuth();
  const [tasks, setTasks] = useState<{ task: Task; client?: Client }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  const scrollRef = useRef<HTMLDivElement>(null);

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
        .map(t => ({
          task: t,
          client: t.clientId ? clientsMap.get(t.clientId) : undefined
        }));
      
      setTasks(combined);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const days = useMemo(() => {
    const today = new Date();
    // Generate -15 to +15 days
    return Array.from({ length: 31 }).map((_, i) => addDays(today, i - 15));
  }, []);

  // Auto-scroll to selected day on mount
  useEffect(() => {
    if (scrollRef.current) {
      const selectedEl = scrollRef.current.querySelector('[data-selected="true"]');
      if (selectedEl) {
        selectedEl.scrollIntoView({ behavior: "instant", inline: "center", block: "nearest" });
      }
    }
  }, []);

  const selectedTasks = useMemo(() => {
    return tasks.filter(t => {
      if (!t.task.date) return false;
      const tDate = parseISO(t.task.date);
      return isSameDay(tDate, selectedDate);
    });
  }, [tasks, selectedDate]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-6 bg-slate-50 dark:bg-slate-900">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  const hours = Array.from({ length: 24 }).map((_, i) => i);

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 relative overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <button className="p-2 -ml-2 text-slate-700 dark:text-slate-300">
          <Menu className="w-6 h-6" />
        </button>
        <h2 className="text-xl font-bold uppercase tracking-widest text-slate-900 dark:text-white">
          {format(selectedDate, 'MMM', { locale: es })}
        </h2>
        <div className="flex items-center gap-3">
          <button className="p-2 text-slate-700 dark:text-slate-300">
            <Search className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setSelectedDate(new Date())}
            className="w-7 h-7 border-[1.5px] border-slate-700 dark:border-slate-300 rounded flex items-center justify-center text-xs font-bold text-slate-900 dark:text-white"
          >
             {format(new Date(), 'd')}
          </button>
        </div>
      </div>

      {/* Days Scroller */}
      <div 
        ref={scrollRef}
        className="flex overflow-x-auto hide-scrollbar px-4 py-2 gap-3 snap-x shrink-0 border-b border-slate-200 dark:border-slate-800"
      >
        {days.map(day => {
           const isSelected = isSameDay(day, selectedDate);
           const isToday = isSameDay(day, new Date());
           
           // Check if there are tasks for this day
           const hasTasks = tasks.some(t => {
             if (!t.task.date) return false;
             return isSameDay(parseISO(t.task.date), day) && t.task.status === "pending";
           });

           return (
              <button
                 key={day.toISOString()}
                 data-selected={isSelected}
                 onClick={() => setSelectedDate(day)}
                 className={clsx(
                   "flex flex-col items-center min-w-[50px] snap-center rounded-2xl py-2 px-1 transition-all relative",
                   isSelected ? "bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 shadow-sm" : "border border-transparent"
                 )}
              >
                <span className={clsx("text-[10px] uppercase font-semibold mb-1", isSelected ? "text-slate-700 dark:text-slate-300" : "text-slate-400")}>
                  {format(day, 'EEE', { locale: es }).substring(0, 3)}
                </span>
                <span className={clsx(
                  "text-lg font-bold w-9 h-9 flex items-center justify-center rounded-full transition-colors",
                  isToday 
                    ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900" 
                    : isSelected 
                      ? "text-slate-900 dark:text-white"
                      : "text-slate-600 dark:text-slate-400"
                )}>
                  {format(day, 'd')}
                </span>
                {hasTasks && (
                  <div className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-blue-500" />
                )}
              </button>
           );
        })}
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto relative bg-slate-50 dark:bg-slate-950 pb-32">
        <div className="relative pt-4">
          {hours.map(hour => {
            let label = "";
            let subLabel = "";
            if (hour === 0) { label = "12"; subLabel = "A.M."; }
            else if (hour < 12) { label = \`\${hour}\`; }
            else if (hour === 12) { label = "12"; subLabel = "P.M."; }
            else { label = \`\${hour - 12}\`; }

            return (
              <div key={hour} className="flex h-20 relative px-2">
                <div className="w-12 shrink-0 text-center flex flex-col pt-[-10px]">
                  <span className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-none">
                    {label}
                  </span>
                  {subLabel && (
                    <span className="text-[10px] text-slate-400 mt-0.5 leading-none">
                      {subLabel}
                    </span>
                  )}
                </div>
                <div className="flex-1 border-t border-slate-200 dark:border-slate-800 border-dotted mt-2" />
              </div>
            );
          })}
          
          {/* Tasks Overlay */}
          {selectedTasks.map(({ task, client }) => {
             let top = 0;
             if (task.time) {
               const [h, m] = task.time.split(':').map(Number);
               // pt-4 adds 16px offset. Each hour is 80px.
               top = 16 + (h * 80) + (m / 60) * 80;
             }
             
             const isCompleted = task.status === "completed";

             return (
               <div 
                 key={task.id} 
                 className={clsx(
                   "absolute left-[60px] right-4 rounded-xl p-3 shadow-sm z-10 border-l-4 overflow-hidden",
                   isCompleted 
                     ? "bg-slate-200 dark:bg-slate-800 border-slate-400 opacity-60" 
                     : "bg-blue-100 dark:bg-blue-900/40 border-blue-500"
                 )}
                 style={{ top: \`\${top}px\`, minHeight: '50px' }}
               >
                 <h4 className={clsx("text-sm font-bold leading-tight", isCompleted ? "text-slate-600 dark:text-slate-400 line-through" : "text-blue-900 dark:text-blue-100")}>
                   {task.title}
                 </h4>
                 {client && (
                   <p className={clsx("text-xs mt-1", isCompleted ? "text-slate-500" : "text-blue-700 dark:text-blue-300")}>
                     {client.name}
                   </p>
                 )}
                 <p className={clsx("text-[10px] mt-1 font-medium", isCompleted ? "text-slate-500" : "text-blue-600 dark:text-blue-400")}>
                   {task.time} {task.type}
                 </p>
               </div>
             );
          })}
        </div>
      </div>

      {/* Floating Action Button */}
      <button
        onClick={() => setShowNewTaskModal(true)}
        className="fixed bottom-[85px] left-1/2 -translate-x-1/2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xl rounded-full px-5 py-3 flex items-center gap-3 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 transition-colors z-40"
      >
        <span className="text-sm font-medium whitespace-nowrap">
          Añadir el {format(selectedDate, "d MMM", { locale: es })}
        </span>
        <Plus className="w-5 h-5" />
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
`;
fs.writeFileSync('src/pages/mobile/MobileTasks.tsx', code);
