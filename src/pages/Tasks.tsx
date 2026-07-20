import React, { useEffect, useState, useMemo } from "react";
import { useLocation } from "react-router";
import { AnimatePresence } from "motion/react";
import { onSnapshot } from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  updateDoc,
  doc,
  setDoc,
  deleteDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { Task, Client, Deal } from "../types";
import { deduplicateClients } from "../lib/clientUtils";
import { ClientDetailModal } from "../components/ClientDetailModal";
import { MobileTasks } from "./mobile/MobileTasks";
import { useIsMobile } from "../hooks/useIsMobile";
import { NewActivityModal } from "../components/NewActivityModal";
import {
  CheckCircle,
  Circle,
  User,
  Briefcase,
  Calendar as CalendarIcon,
  List as ListIcon,
  Phone,
  Video,
  CalendarDays,
  Flag,
  Mail,
  Coffee,
  ChevronLeft,
  ChevronRight,
  X,
  AlertCircle,
  ChevronDown,
  Filter,
  Car,
  PenTool,
  Settings,
  Trash2,
  Clock,
  DollarSign,
} from "lucide-react";
import clsx from "clsx";
import {
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addDays,
  getDay,
  isSameDay,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
  startOfDay,
  endOfDay,
  startOfYear,
  endOfYear,
  addYears,
  subYears,
  eachMonthOfInterval,
  isAfter,
  parseISO,
  isSameMonth,
} from "date-fns";
import { es } from "date-fns/locale";

export function Tasks() {
  const { userData, connectGoogleServices, googleToken } = useAuth();
    const location = useLocation();
  const [tasks, setTasks] = useState<{ task: Task; client: Client | null }[]>(
    [],
  );
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "calendar">("list");
  const [calendarMode, setCalendarMode] = useState<
    "day" | "week" | "month" | "year"
  >("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [miniCalendarDate, setMiniCalendarDate] = useState(new Date());
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState<
    "all" | "pending" | "completed"
  >("pending");
  const [filterDate, setFilterDate] = useState<string>("all");
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  } | null>(null);

  const handleSort = (key: string) => {
    let direction: "asc" | "desc" = "desc";
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "desc") {
      direction = "asc";
    }
    setSortConfig({ key, direction });
  };

  const [visibleColumns, setVisibleColumns] = useState({
    status: true,
    title: true,
    deal: true,
    dueDate: true,
    contact: true,
    email: true,
    phone: true,
  });
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [showPostponeMenu, setShowPostponeMenu] = useState(false);
  const [showRightSidebar, setShowRightSidebar] = useState(true);

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({
    checkbox: 40,
    status: 90,
    title: 250,
    deal: 150,
    dueDate: 120,
    contact: 150,
    email: 200,
    phone: 150,
  });

  const handleMouseDown = (e: React.MouseEvent, columnKey: string) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = columnWidths[columnKey];

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.max(50, startWidth + (moveEvent.clientX - startX));
      setColumnWidths((prev) => ({ ...prev, [columnKey]: newWidth }));
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [newTaskPrefill, setNewTaskPrefill] = useState<any>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const handleTaskClick = (task: Task) => {
    setEditingTask(task);
    if (task.dueDate) {
      const taskDate = new Date(task.dueDate + "T00:00:00");
      setCurrentDate(taskDate);
      setMiniCalendarDate(taskDate);
      setFilterDate(task.dueDate);
    }
  };

  const [showSyncBanner, setShowSyncBanner] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // New task form
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDate, setNewTaskDate] = useState("");
  const [newTaskClientId, setNewTaskClientId] = useState("");
  const [businessHours, setBusinessHours] = useState({ start: 8, end: 20 });

  useEffect(() => {
    if (!userData || userData.role === "master") return;
    const urlParams = new URLSearchParams(window.location.search);
    const taskIdParam = urlParams.get('taskId');
    if (taskIdParam && tasks.length > 0) {
      const taskObj = tasks.find((t) => t.task.id === taskIdParam);
      if (taskObj && !editingTask) {
        setEditingTask(taskObj.task);
        
        // Remove param from url to prevent reopening on reload
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }
    }
  }, [tasks, userData, editingTask]);

  useEffect(() => {
    if (!userData || userData.role === "master") return;

    const fetchTasksAndClients = async () => {
      try {
        const agencyRef = doc(db, "agencies", userData.agencyId);
        const agencySnap = await getDoc(agencyRef);
        if (agencySnap.exists() && agencySnap.data().businessHours) {
          const bh = agencySnap.data().businessHours;
          setBusinessHours({
            start: parseInt(bh.start.split(":")[0], 10),
            end: parseInt(bh.end.split(":")[0], 10)
          });
        }
      } catch(e) { console.error("Error fetching agency config:", e); }
      let q = query(
        collection(db, "tasks"),
        where("agencyId", "==", userData.agencyId),
      );
      if (userData.role === "seller") {
        q = query(
          collection(db, "tasks"),
          where("agencyId", "==", userData.agencyId),
          where("sellerId", "==", userData.id),
        );
      }

      try {
        const snap = await getDocs(q);
        const taskList = snap.docs.map(
          (d) => ({ ...d.data(), id: d.id }) as Task,
        );

        let cq = query(
          collection(db, "clients"),
          where("agencyId", "==", userData.agencyId),
        );
        let dq = query(
          collection(db, "deals"),
          where("agencyId", "==", userData.agencyId),
        );
        if (userData.role === "seller") {
          cq = query(
            collection(db, "clients"),
            where("agencyId", "==", userData.agencyId),
            where("sellerId", "==", userData.id),
          );
          dq = query(
            collection(db, "deals"),
            where("agencyId", "==", userData.agencyId),
            where("sellerId", "==", userData.id),
          ); // Assuming deals have sellerId if restricted
        }

        const cSnap = await getDocs(cq);
        const list = cSnap.docs.map(d => ({ ...d.data(), id: d.id } as Client)).filter((c) => !c.isDeleted);
        setClients(deduplicateClients(list));

        try {
          const dSnap = await getDocs(dq);
          setDeals(dSnap.docs.map((d) => ({ ...d.data(), id: d.id }) as Deal).filter((d) => !d.isDeleted));
        } catch (e) {
          // If deals collection doesn't exist yet, it's fine, it will just be empty
          setDeals([]);
        }

        const combined = taskList.map((t) => ({
          task: t,
          client: t.clientId ? list.find((c) => c.id === t.clientId) || null : null,
        }));
        combined.sort((a, b) => {
          const aTime = a.task.dueDate ? new Date(a.task.dueDate).getTime() : 0;
          const bTime = b.task.dueDate ? new Date(b.task.dueDate).getTime() : 0;
          return aTime - bTime;
        });
        setTasks(combined);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchTasksAndClients();
  }, [userData, refreshKey]);

  const toggleTask = async (taskId: string, current: boolean) => {
    try {
      await updateDoc(doc(db, "tasks", taskId), { completed: !current });
      
      const updatedTasks = tasks.map((t) =>
        t.task.id === taskId
          ? { ...t, task: { ...t.task, completed: !current } }
          : t
      );
      
      setTasks(updatedTasks);

      if (!current) {
        const completedTaskInfo = tasks.find((t) => t.task.id === taskId);
        if (completedTaskInfo) {
          const dealId = completedTaskInfo.task.dealId;
          const clientId = completedTaskInfo.task.clientId;
          if (dealId || clientId) {
             const hasPending = updatedTasks.some(t => 
               !t.task.completed && 
               t.task.id !== taskId && 
               ((dealId && t.task.dealId === dealId) || (!dealId && clientId && t.task.clientId === clientId))
             );
             if (!hasPending) {
                setNewTaskPrefill({
                   clientId: clientId || "",
                   clientName: completedTaskInfo.client?.name || "",
                   dealId: dealId || "",
                   dealTitle: completedTaskInfo.deal?.title || ""
                });
                setShowNewTaskModal(true);
             }
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const toggleTaskSelection = (taskId: string) => {
    setSelectedTaskIds((prev) =>
      prev.includes(taskId)
        ? prev.filter((id) => id !== taskId)
        : [...prev, taskId],
    );
  };

  const toggleSelectAllTasks = (filteredIds: string[]) => {
    if (
      selectedTaskIds.length === filteredIds.length &&
      filteredIds.length > 0
    ) {
      setSelectedTaskIds([]);
    } else {
      setSelectedTaskIds(filteredIds);
    }
  };

  const [taskToDelete, setTaskToDelete] = useState<string | "multiple" | null>(
    null,
  );

  const confirmDelete = async () => {
    if (!taskToDelete) return;
    try {
      if (taskToDelete === "multiple") {
        for (const id of selectedTaskIds) {
          await deleteDoc(doc(db, "tasks", id));
        }
        setTasks((prev) =>
          prev.filter((t) => !selectedTaskIds.includes(t.task.id)),
        );
        setSelectedTaskIds([]);
      } else {
        await deleteDoc(doc(db, "tasks", taskToDelete));
        setTasks((prev) => prev.filter((t) => t.task.id !== taskToDelete));
        setSelectedTaskIds((prev) => prev.filter((id) => id !== taskToDelete));
      }
    } catch (e) {
      console.error("Error al eliminar:", e);
    } finally {
      setTaskToDelete(null);
    }
  };

  const handleDeleteSelectedTasks = () => {
    setTaskToDelete("multiple");
  };

  const handlePostponeSelectedTasks = async (daysToPostpone: number) => {
    if (!selectedTaskIds.length) return;

    try {
      const batch = writeBatch(db);
      for (const taskId of selectedTaskIds) {
        const taskObj = tasks.find((t) => t.id === taskId);
        if (taskObj && taskObj.dueDate) {
          const currentDate = new Date(taskObj.dueDate + "T00:00:00");
          const newDate = addDays(currentDate, daysToPostpone);
          batch.update(doc(db, "tasks", taskId), {
            dueDate: format(newDate, "yyyy-MM-dd"),
            updatedAt: new Date(),
          });
        }
      }
      await batch.commit();
      setSelectedTaskIds([]);
    } catch (error) {
      console.error("Error postponing tasks:", error);
      alert("Error al posponer las tareas");
    }
  };

  const handleDeleteSingleTask = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setTaskToDelete(taskId);
  };

  const nextPeriod = () => {
    if (calendarMode === "day") {
      setCurrentDate(addDays(currentDate, 1));
    } else if (calendarMode === "week") {
      setCurrentDate(addDays(currentDate, 7));
    } else if (calendarMode === "month") {
      setCurrentDate(addMonths(currentDate, 1));
    } else {
      setCurrentDate(addYears(currentDate, 1));
    }
  };

  const prevPeriod = () => {
    if (calendarMode === "day") {
      setCurrentDate(addDays(currentDate, -1));
    } else if (calendarMode === "week") {
      setCurrentDate(addDays(currentDate, -7));
    } else if (calendarMode === "month") {
      setCurrentDate(subMonths(currentDate, 1));
    } else {
      setCurrentDate(subYears(currentDate, 1));
    }
  };

  const today = new Date();

  // Calendar data calculation
  const start =
    calendarMode === "day"
      ? startOfDay(currentDate)
      : calendarMode === "week"
        ? startOfWeek(currentDate, { weekStartsOn: 1 })
        : calendarMode === "month"
          ? startOfMonth(currentDate)
          : startOfYear(currentDate);
  const end =
    calendarMode === "day"
      ? endOfDay(currentDate)
      : calendarMode === "week"
        ? endOfWeek(currentDate, { weekStartsOn: 1 })
        : calendarMode === "month"
          ? endOfMonth(currentDate)
          : endOfYear(currentDate);

  let days: Date[] = [];
  if (calendarMode !== "year") {
    days = eachDayOfInterval({ start, end });
  }

  // Add padding for month view
  let calendarDays = [...days];
  if (calendarMode === "month") {
    const startDayOfWeek = getDay(start);
    const prefixDays = Array(
      startDayOfWeek === 0 ? 6 : startDayOfWeek - 1,
    ).fill(null);
    calendarDays = [...prefixDays, ...calendarDays];
  }

  useEffect(() => {
    if (location.state?.filterStatus) {
      setFilterStatus(location.state.filterStatus);
    }
    if (location.state?.filterDate) {
      setFilterDate(location.state.filterDate);
    }
    if (location.state?.filterType) {
      setFilterType(location.state.filterType);
    }
  }, [location.state]);

  // --- Drag & Drop for Calendar ---
  const [dragState, setDragState] = useState<{


    taskId: string;
    type: "move" | "resize";
    startY: number;
    startX: number;
    originalTop: number;
    originalHeight: number;
    originalDate: string;
    currentTop: number;
    currentHeight: number;
    currentDate: string;
    originalStartStr: string;
    originalEndStr: string | undefined;
    hasMoved: boolean;
  } | null>(null);
  const calendarGridRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dragState) return;

    const handlePointerMove = (e: PointerEvent) => {
      e.preventDefault();
      setDragState((prev) => {
        if (!prev) return prev;
        const deltaY = e.clientY - prev.startY;
        const deltaX = e.clientX - prev.startX;

        if (!prev.hasMoved && Math.abs(deltaY) < 5 && Math.abs(deltaX) < 5) {
          return prev;
        }

        let newTop = prev.originalTop;
        let newHeight = prev.originalHeight;
        let newDate = prev.originalDate;

        if (prev.type === "move") {
          newTop = Math.max(0, prev.originalTop + deltaY);
          // Find which column we are in
          if (calendarGridRef.current) {
            const rect = calendarGridRef.current.getBoundingClientRect();
            // Using time column width 64px (w-16)
            const timeColumnWidth = 64;
            const gridX = e.clientX - rect.left - timeColumnWidth;
            const gridWidth = rect.width - timeColumnWidth;
            if (gridX >= 0 && gridWidth > 0) {
              const colWidth = gridWidth / calendarDays.length;
              const colIndex = Math.floor(gridX / colWidth);
              if (colIndex >= 0 && colIndex < calendarDays.length) {
                newDate = format(calendarDays[colIndex], "yyyy-MM-dd");
              }
            }
          }
        } else if (prev.type === "resize") {
          newHeight = Math.max(20, prev.originalHeight + deltaY);
        }

        return {
          ...prev,
          currentTop: newTop,
          currentHeight: newHeight,
          currentDate: newDate,
          hasMoved: true,
        };
      });
    };

    const handlePointerUp = async (e: PointerEvent) => {
      if (dragState) {
        if (!dragState.hasMoved) {
          setDragState(null);
          return;
        }

        // Calculate final times
        let newStartTime = dragState.originalStartStr;
        let newEndTime = dragState.originalEndStr;
        let newDate = dragState.currentDate;

        if (dragState.type === "move") {
          const top = dragState.currentTop;
          const startHour = Math.floor(top / 96) + businessHours.start;
          const startMin = Math.floor(((top % 96) / 96) * 60);
          // Snap to 15 mins
          const snappedStartMin = Math.round(startMin / 15) * 15;
          let finalStartHour = startHour;
          let finalStartMin = snappedStartMin;
          if (finalStartMin >= 60) {
            finalStartHour += 1;
            finalStartMin -= 60;
          }
          finalStartHour = Math.max(0, Math.min(23, finalStartHour));
          newStartTime = `${finalStartHour.toString().padStart(2, "0")}:${finalStartMin.toString().padStart(2, "0")}`;

          if (dragState.originalEndStr) {
            // shift end time by the same duration
            const oldStartHour = parseInt(
              dragState.originalStartStr.split(":")[0] || "0",
            );
            const oldStartMin = parseInt(
              dragState.originalStartStr.split(":")[1] || "0",
            );
            const oldEndHour = parseInt(
              dragState.originalEndStr.split(":")[0] || "0",
            );
            const oldEndMin = parseInt(
              dragState.originalEndStr.split(":")[1] || "0",
            );

            let oldTotalStart = oldStartHour * 60 + oldStartMin;
            let oldTotalEnd = oldEndHour * 60 + oldEndMin;
            if (oldTotalEnd < oldTotalStart) oldTotalEnd += 24 * 60;
            const duration = oldTotalEnd - oldTotalStart;

            let newTotalEnd = finalStartHour * 60 + finalStartMin + duration;
            let finalEndHour = Math.floor(newTotalEnd / 60) % 24;
            let finalEndMin = newTotalEnd % 60;
            newEndTime = `${finalEndHour.toString().padStart(2, "0")}:${finalEndMin.toString().padStart(2, "0")}`;
          }
        } else if (dragState.type === "resize") {
          // keep original start time, update end time based on height
          const startHour = parseInt(
            dragState.originalStartStr.split(":")[0] || "0",
          );
          const startMin = parseInt(
            dragState.originalStartStr.split(":")[1] || "0",
          );

          const height = dragState.currentHeight;
          const durationMins = (height / 96) * 60;
          const totalMins = startHour * 60 + startMin + durationMins;

          // Snap end time to 15 mins
          const snappedTotalMins = Math.round(totalMins / 15) * 15;
          let finalEndHour = Math.floor(snappedTotalMins / 60) % 24;
          let finalEndMin = snappedTotalMins % 60;

          newEndTime = `${finalEndHour.toString().padStart(2, "0")}:${finalEndMin.toString().padStart(2, "0")}`;
        }

        // Apply changes
        setDragState(null);
        try {
          const updateData: any = {
            dueDate: newDate,
            updatedAt: new Date().toISOString(),
          };
          if (newStartTime !== undefined) updateData.startTime = newStartTime;
          if (newEndTime !== undefined) updateData.endTime = newEndTime;
          else updateData.endTime = "";

          await updateDoc(doc(db, "tasks", dragState.taskId), updateData);
          setTasks((prev) =>
            prev.map((t) =>
              t.task.id === dragState.taskId
                ? {
                    ...t,
                    task: {
                      ...t.task,
                      dueDate: newDate,
                      startTime: newStartTime,
                      endTime: newEndTime,
                    },
                  }
                : t,
            ),
          );
        } catch (error) {
          console.error("Error updating task drag:", error);
        }
      }
    };

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);

    return () => {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
    };
  }, [dragState, calendarDays]);

  const renderMiniCalendar = () => {
    const start = startOfWeek(startOfMonth(miniCalendarDate), {
      weekStartsOn: 1,
    });
    const end = endOfWeek(endOfMonth(miniCalendarDate), { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start, end });

    return (
      <div className="p-4 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setMiniCalendarDate((prev) => subMonths(prev, 1))}
            className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded text-gray-500 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="text-sm font-bold text-slate-800 dark:text-slate-200 capitalize">
            {format(miniCalendarDate, "MMMM yyyy", { locale: es })}
          </div>
          <button
            onClick={() => setMiniCalendarDate((prev) => addMonths(prev, 1))}
            className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded text-gray-500 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {["L", "M", "X", "J", "V", "S", "D"].map((day) => (
            <div
              key={day}
              className="text-center text-[10px] font-bold text-gray-400 py-1"
            >
              {day}
            </div>
          ))}
          {days.map((day, i) => {
            const isCurrentMonth = isSameMonth(day, miniCalendarDate);
            const isToday = isSameDay(day, new Date());
            const hasTasks = baseFilteredTasks.some(
              (t) =>
                t.task.dueDate === format(day, "yyyy-MM-dd") &&
                !t.task.completed,
            );

            return (
              <div
                key={i}
                onClick={() => {
                  const newDateStr = format(day, "yyyy-MM-dd");
                  setFilterDate(newDateStr);
                  setCurrentDate(day);
                }}
                className={clsx(
                  "h-8 flex flex-col items-center justify-center rounded text-xs cursor-pointer transition-all relative",
                  isToday
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold shadow-sm shadow-blue-500/20"
                    : isCurrentMonth
                      ? "text-slate-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 font-medium"
                      : "text-gray-300 dark:text-slate-600",
                  filterDate === format(day, "yyyy-MM-dd") &&
                    !isToday &&
                    "ring-2 ring-blue-500 ring-inset",
                )}
              >
                <span>{format(day, "d")}</span>
                {hasTasks && (
                  <div
                    className={clsx(
                      "w-1 h-1 rounded-full absolute bottom-1",
                      isToday ? "bg-white" : "bg-blue-500",
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
        
        {/* Day Tasks under Mini Calendar */}
        {filterDate && filterDate !== "all" && filterDate !== "overdue" && filterDate !== "today" && filterDate !== "tomorrow" && filterDate !== "week" && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-700/50 flex flex-col gap-2">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
              Actividades {format(parseISO(filterDate), "MMM d", { locale: es })}
            </div>
            {sortedTasks
              .filter(t => t.task.dueDate === filterDate)
              .sort((a, b) => {
                 const timeA = a.task.startTime ? a.task.startTime : "24:00";
                 const timeB = b.task.startTime ? b.task.startTime : "24:00";
                 return timeA.localeCompare(timeB);
              })
              .map(({task, client}) => (
                <div
                  key={`task-${task.id}`}
                  onClick={() => handleTaskClick(task)}
                  className="flex gap-2 items-start p-2 rounded hover:bg-gray-50 dark:hover:bg-slate-700/50 cursor-pointer"
                >
                  <div className="text-[10px] font-bold text-gray-400 shrink-0 mt-0.5 w-8">
                    {task.startTime || "-"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={clsx("text-xs font-medium text-slate-700 dark:text-slate-300 line-clamp-1 flex items-center gap-1", task.completed && "line-through text-gray-400")}>
                      {task.title}
                      {task.type === "payment" && client && (
                        <span 
                          className="px-1 py-0.5 rounded text-[8px] bg-emerald-100 text-emerald-700 hover:bg-emerald-200 cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedClient(client);
                          }}
                        >
                          Ver Venta
                        </span>
                      )}
                    </div>
                    {client && (
                      <div className="text-[10px] text-blue-500 truncate">
                        {client.name}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {sortedTasks.filter(t => t.task.dueDate === filterDate).length === 0 && (
                <div className="text-center text-xs text-gray-400 py-4">
                  No hay actividades
                </div>
              )}
          </div>
        )}
      </div>
    );
  };

  const getTaskIcon = (task: Task) => {
    if (task.type === "payment") return <DollarSign className="w-3.5 h-3.5" />;
    const t = String(task.title || "").toLowerCase();
    if (t.includes("llama")) return <Phone className="w-3.5 h-3.5" />;
    if (
      t.includes("cita") ||
      t.includes("reunió") ||
      t.includes("junta") ||
      t.includes("meet")
    )
      return <User className="w-3.5 h-3.5" />;
    if (t.includes("prueba") || t.includes("manejo") || t.includes("test"))
      return <Car className="w-3.5 h-3.5" />;
    if (t.includes("firma") || t.includes("contrato"))
      return <PenTool className="w-3.5 h-3.5" />;
    return <CalendarDays className="w-3.5 h-3.5" />;
  };

  const getTaskColorClass = (task: Task) => {
    if (task.completed) return "text-gray-500 dark:text-slate-400";
    if (!task.dueDate) return "text-gray-800 dark:text-slate-200";

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const taskDate = new Date(task.dueDate + "T00:00:00");

    if (taskDate.getTime() === today.getTime()) {
      return "text-green-600 dark:text-green-400";
    } else if (taskDate < today) {
      return "text-red-600 dark:text-red-400";
    } else {
      return "text-gray-800 dark:text-slate-200";
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData) return;
    
    if (!newTaskTitle) {
      alert("El título de la tarea es requerido.");
      return;
    }
    if (!newTaskDate) {
      alert("La fecha de la tarea es requerida.");
      return;
    }
    if (!newTaskClientId) {
      alert("Debes seleccionar un cliente para la tarea.");
      return;
    }

    try {
      const newRef = doc(collection(db, "tasks"));
      const t = {
        agencyId: userData.agencyId,
        sellerId: userData.id,
        clientId: newTaskClientId,
        title: newTaskTitle,
        dueDate: newTaskDate,
        completed: false,
        createdAt: new Date().toISOString(),
      };
      await setDoc(newRef, t);
      
      const newClient = clients.find(c => c.id === newTaskClientId) || null;
      setTasks(prev => [{ task: { id: newRef.id, ...t } as Task, client: newClient }, ...prev]);
      
      setNewTaskTitle("");
      setNewTaskDate("");
      setNewTaskClientId("");

      await setDoc(doc(db, "clients", newTaskClientId), {
        updatedAt: new Date().toISOString(),
      }, { merge: true }).catch(() => {}); // Just to trigger some update if needed
    } catch (e) {
      console.error("Error creating task:", e);
      alert("Error al crear la tarea.");
    }
  };

  const handleSyncCalendar = async () => {
    setIsSyncing(true);
    try {
      const token = await connectGoogleServices();
      if (!token) {
        setIsSyncing(false);
        return;
      }

      let syncedCount = 0;
      for (const { task } of tasks) {
        if (task.googleEventId) {
          try {
            const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${task.googleEventId}`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            if (res.status === 404) {
              await deleteDoc(doc(db, "tasks", task.id));
              syncedCount++;
            } else if (res.ok) {
              const data = await res.json();
              if (data.status === 'cancelled') {
                await deleteDoc(doc(db, "tasks", task.id));
                syncedCount++;
              }
            }
          } catch (e) {
            console.error("Error fetching event", e);
          }
        }
        if (task.googleTaskId && !task.completed) {
          try {
            const res = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/@default/tasks/${task.googleTaskId}`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            if (res.status === 200) {
              const data = await res.json();
              if (data.status === 'completed') {
                await updateDoc(doc(db, "tasks", task.id), { completed: true });
                syncedCount++;
              }
            } else if (res.status === 404) {
              await deleteDoc(doc(db, "tasks", task.id));
              syncedCount++;
            }
          } catch (e) {
            console.error("Error fetching task", e);
          }
        }

        if (!task.completed && !task.googleEventId && !task.googleTaskId) {
          const eventPayload = {
            summary: task.title,
            description: task.notes || "",
            start: {
              dateTime: `${task.dueDate}T${task.startTime || "09:00"}:00`,
              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
            end: {
              dateTime: `${task.dueDate}T${task.endTime || task.startTime || "10:00"}:00`,
              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
          };
          const taskPayload = {
            title: task.title,
            notes: task.notes || "",
            due: new Date(`${task.dueDate}T${task.startTime || '00:00'}:00`).toISOString()
          };
          try {
            const [calRes, taskRes] = await Promise.all([
              fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
                method: "POST",
                headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify(eventPayload),
              }),
              fetch("https://tasks.googleapis.com/tasks/v1/lists/@default/tasks", {
                method: "POST",
                headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify(taskPayload),
              })
            ]);

            let updates: any = {};
            if (calRes.ok) {
              const calData = await calRes.json();
              updates.googleEventId = calData.id;
            }
            if (taskRes.ok) {
              const taskData = await taskRes.json();
              updates.googleTaskId = taskData.id;
            }

            if (Object.keys(updates).length > 0) {
              await updateDoc(doc(db, "tasks", task.id), updates);
              syncedCount++;
            }
          } catch (e) {
            console.error("Error creating Google items", e);
          }
        }
      }

      alert(syncedCount > 0 ? `¡Sincronización completada! ${syncedCount} elementos actualizados.` : "¡Calendario conectado! Todo está al día.");
      setShowSyncBanner(false);
    } catch (error: any) {
      alert("Error al sincronizar: " + (error.message || "Error desconocido"));
    } finally {
      setIsSyncing(false);
    }
  };

  const baseFilteredTasks = tasks.filter(({ task }) => {
    // 1. Status Filter
    if (filterStatus === "pending" && task.completed) return false;
    if (filterStatus === "completed" && !task.completed) return false;

    // 2. Type Filter
    if (filterType === "all") return true;

    // Very basic filter logic based on title string matching (since Tasks don't have an explicit 'type' field yet)
    const t = String(task.title || "").toLowerCase();
    switch (filterType) {
      case "payment":
        return task.type === "payment";
      case "call":
        return t.includes("llama");
      case "appointment":
        return (
          t.includes("cita") ||
          t.includes("reunió") ||
          t.includes("junta") ||
          t.includes("meet")
        );
      case "test_drive":
        return (
          t.includes("prueba") || t.includes("manejo") || t.includes("test")
        );
      case "signature":
        return t.includes("firma") || t.includes("contrato");
      case "task":
        return (
          task.type !== "payment" &&
          !t.includes("llama") &&
          !t.includes("cita") &&
          !t.includes("prueba") &&
          !t.includes("firma") &&
          !t.includes("reunió")
        ); // Default task
      default:
        return true;
    }
  });

  const filteredTasks = baseFilteredTasks.filter(({ task }) => {
    // Date Filter
    if (filterDate !== "all" && task.dueDate) {
      const taskDate = new Date(task.dueDate + "T00:00:00"); // Assuming YYYY-MM-DD
      if (isNaN(taskDate.getTime())) return false; // Invalid date
      taskDate.setHours(0, 0, 0, 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const tomorrow = addDays(today, 1);

      if (filterDate === "overdue") {
        if (taskDate >= today || task.completed) return false;
      } else if (filterDate === "today") {
        if (taskDate.getTime() !== today.getTime()) return false;
      } else if (filterDate === "tomorrow") {
        if (taskDate.getTime() !== tomorrow.getTime()) return false;
      } else if (filterDate === "week") {
        const weekStart = startOfWeek(today, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
        if (taskDate < weekStart || taskDate > weekEnd) return false;
      } else {
        // Specific date format like "yyyy-MM-dd"
        if (task.dueDate !== filterDate) return false;
      }
    } else if (filterDate !== "all" && !task.dueDate) {
      return false; // exclude tasks without a due date if we filter by date
    }

    return true;
  });

  const sortedTasks = useMemo(() => {
    let sortableTasks = [...filteredTasks];
    
    sortableTasks.sort((a, b) => {
      // If a sortConfig is applied, use it
      if (sortConfig) {
        let aValue: any = null;
        let bValue: any = null;

        switch (sortConfig.key) {
          case 'status':
            aValue = a.task.completed ? 1 : 0;
            bValue = b.task.completed ? 1 : 0;
            break;
          case 'title':
            aValue = a.task.title || '';
            bValue = b.task.title || '';
            break;
          case 'deal':
            aValue = a.client?.dealTitle || a.client?.name || '';
            bValue = b.client?.dealTitle || b.client?.name || '';
            break;
          case 'dueDate':
            aValue = a.task.dueDate ? new Date(a.task.dueDate).getTime() : 0;
            bValue = b.task.dueDate ? new Date(b.task.dueDate).getTime() : 0;
            break;
          case 'contact':
            aValue = a.client?.name || '';
            bValue = b.client?.name || '';
            break;
          case 'email':
            aValue = a.client?.email || '';
            bValue = b.client?.email || '';
            break;
          case 'phone':
            aValue = a.client?.phone || '';
            bValue = b.client?.phone || '';
            break;
        }

        if (aValue < bValue) {
          return sortConfig.direction === "asc" ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === "asc" ? 1 : -1;
        }
      }

      // Default secondary sorting: by due date
      const dateA = a.task.dueDate ? new Date(a.task.dueDate).getTime() : Infinity;
      const dateB = b.task.dueDate ? new Date(b.task.dueDate).getTime() : Infinity;
      return dateA - dateB;
    });

    return sortableTasks;
  }, [filteredTasks, sortConfig]);

  if (loading)
    return (
      <div className="flex h-screen items-center justify-center">
        Cargando...
      </div>
    );

  return (
    <div className="flex flex-col h-full bg-[#f4f5f5] relative">

      {/* Header and filters */}
      <div className="p-2 md:p-4 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">

        {/* Sync alert mock removed for now */}

        {/* Controls bar */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center bg-white dark:bg-slate-800 border border-gray-300 rounded shadow-sm overflow-hidden h-8 shrink-0">
              <button
                onClick={() => setView("list")}
                className={clsx(
                  "px-3 h-full flex items-center justify-center",
                  view === "list"
                    ? "bg-gray-100 text-blue-600"
                    : "text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:bg-slate-900",
                )}
              >
                <ListIcon className="w-4 h-4" />
              </button>
              <div className="w-px h-full bg-gray-300" />
              <button
                onClick={() => setView("calendar")}
                className={clsx(
                  "px-3 h-full flex items-center justify-center",
                  view === "calendar"
                    ? "bg-gray-100 text-blue-600"
                    : "text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:bg-slate-900",
                )}
              >
                <CalendarIcon className="w-4 h-4" />
              </button>
            </div>

            <div
              onClick={() => setShowNewTaskModal(true)}
              className="hidden md:flex items-center p-0.5 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded text-sm font-semibold cursor-pointer hover:bg-green-700 shadow-sm shrink-0"
            >
              <div className="px-3 flex items-center gap-1 border-r border-green-500">
                <span className="text-lg leading-none mb-0.5">+</span> Actividad
              </div>
              <div className="px-1.5">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden md:inline text-xs font-semibold text-gray-500 dark:text-slate-400">
              {tasks.length} actividades
            </span>
            {googleToken ? (
              <button
                onClick={handleSyncCalendar}
                disabled={isSyncing}
                className="text-[10px] font-bold text-green-600 border border-green-200 bg-green-50 hover:bg-green-100 px-2 py-0.5 rounded-full uppercase cursor-pointer transition-colors"
              >
                {isSyncing ? 'Sincronizando...' : 'Sincronización Activa (Actualizar)'}
              </button>
            ) : null}

            {view === "list" && (
              <div className="relative flex items-center gap-2 ml-auto sm:ml-0">
                {selectedTaskIds.length > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <button
                        onClick={() => setShowPostponeMenu(!showPostponeMenu)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded shadow-sm transition-colors"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        Posponer ({selectedTaskIds.length})
                      </button>
                      {showPostponeMenu && (
                        <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-slate-800 rounded shadow-sm border border-gray-200 dark:border-slate-700 z-50 p-1">
                          <button
                            onClick={() => {
                              handlePostponeSelectedTasks(1);
                              setShowPostponeMenu(false);
                            }}
                            className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded"
                          >
                            1 día (Mañana)
                          </button>
                          <button
                            onClick={() => {
                              handlePostponeSelectedTasks(2);
                              setShowPostponeMenu(false);
                            }}
                            className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded"
                          >
                            2 días
                          </button>
                          <button
                            onClick={() => {
                              handlePostponeSelectedTasks(7);
                              setShowPostponeMenu(false);
                            }}
                            className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded"
                          >
                            1 semana
                          </button>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={handleDeleteSelectedTasks}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded shadow-sm transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Borrar ({selectedTaskIds.length})
                    </button>
                  </div>
                )}
                <div className="relative">
                  <button
                    onClick={() => setShowColumnSettings(!showColumnSettings)}
                    className="flex items-center justify-center p-1.5 border border-gray-300 rounded hover:bg-gray-50 dark:bg-slate-900 shadow-sm text-gray-700 dark:text-slate-300"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                  {showColumnSettings && (
                    <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowColumnSettings(false)} />
                    <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded shadow-sm border border-gray-200 dark:border-slate-700 z-50 p-3 text-sm">
                    <div className="font-bold text-xs uppercase text-gray-500 dark:text-slate-400 mb-3">
                      Columnas Visibles
                    </div>
                    <div className="space-y-2">
                      {Object.entries({
                        status: "Finalizada",
                        title: "Asunto",
                        deal: "Trato",
                        dueDate: "Vencimiento",
                        contact: "Persona de contacto",
                        email: "Correo electrónico",
                        phone: "Teléfono",
                      }).map(([key, label]) => (
                        <label
                          key={key}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={
                              visibleColumns[key as keyof typeof visibleColumns]
                            }
                            onChange={(e) =>
                              setVisibleColumns((prev) => ({
                                ...prev,
                                [key]: e.target.checked,
                              }))
                            }
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-gray-700 dark:text-slate-300 text-sm">
                            {label}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                  </>
                )}
                </div>
              </div>
            )}

            <div className="relative">
              <button
                onClick={() => setShowFilterMenu(!showFilterMenu)}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold border border-gray-300 rounded hover:bg-gray-50 dark:bg-slate-900 shadow-sm text-gray-700 dark:text-slate-300 ml-auto sm:ml-0"
              >
                <Filter className="w-3.5 h-3.5" /> Filtro
              </button>
              {showFilterMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded shadow-sm border border-gray-200 dark:border-slate-700 z-50 p-2 text-sm text-gray-700 dark:text-slate-300">
                  <div className="font-bold text-xs uppercase text-gray-500 dark:text-slate-400 mb-2 px-2">
                    Estado
                  </div>
                  <div
                    className={clsx(
                      "px-2 py-1.5 rounded cursor-pointer hover:bg-blue-50",
                      filterStatus === "all" &&
                        "bg-blue-50 text-blue-600 font-medium",
                    )}
                    onClick={() => setFilterStatus("all")}
                  >
                    Todos los estados
                  </div>
                  <div
                    className={clsx(
                      "px-2 py-1.5 rounded cursor-pointer hover:bg-blue-50",
                      filterStatus === "pending" &&
                        "bg-blue-50 text-blue-600 font-medium",
                    )}
                    onClick={() => setFilterStatus("pending")}
                  >
                    Pendientes
                  </div>
                  <div
                    className={clsx(
                      "px-2 py-1.5 rounded cursor-pointer hover:bg-blue-50",
                      filterStatus === "completed" &&
                        "bg-blue-50 text-blue-600 font-medium",
                    )}
                    onClick={() => setFilterStatus("completed")}
                  >
                    Completadas
                  </div>

                  <div className="border-t border-gray-100 dark:border-slate-700 my-2"></div>

                  <div className="font-bold text-xs uppercase text-gray-500 dark:text-slate-400 mb-2 px-2">
                    Fecha
                  </div>
                  <div
                    className={clsx(
                      "px-2 py-1.5 rounded cursor-pointer hover:bg-blue-50",
                      filterDate === "all" &&
                        "bg-blue-50 text-blue-600 font-medium",
                    )}
                    onClick={() => setFilterDate("all")}
                  >
                    Todas las fechas
                  </div>
                  <div
                    className={clsx(
                      "px-2 py-1.5 rounded cursor-pointer hover:bg-blue-50",
                      filterDate === "overdue" &&
                        "bg-blue-50 text-blue-600 font-medium",
                    )}
                    onClick={() => setFilterDate("overdue")}
                  >
                    Vencidas
                  </div>
                  <div
                    className={clsx(
                      "px-2 py-1.5 rounded cursor-pointer hover:bg-blue-50",
                      filterDate === "today" &&
                        "bg-blue-50 text-blue-600 font-medium",
                    )}
                    onClick={() => setFilterDate("today")}
                  >
                    Hoy
                  </div>
                  <div
                    className={clsx(
                      "px-2 py-1.5 rounded cursor-pointer hover:bg-blue-50",
                      filterDate === "tomorrow" &&
                        "bg-blue-50 text-blue-600 font-medium",
                    )}
                    onClick={() => setFilterDate("tomorrow")}
                  >
                    Mañana
                  </div>
                  <div
                    className={clsx(
                      "px-2 py-1.5 rounded cursor-pointer hover:bg-blue-50",
                      filterDate === "week" &&
                        "bg-blue-50 text-blue-600 font-medium",
                    )}
                    onClick={() => setFilterDate("week")}
                  >
                    Esta semana
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action types filters */}
        <div className="hidden md:flex items-center gap-3 mt-4 overflow-x-auto pb-1 text-xs font-bold scrollbar-hide">
          <span
            className={clsx(
              "shrink-0 cursor-pointer px-2 py-1 rounded",
              filterType === "all"
                ? "text-blue-600 bg-blue-50"
                : "text-gray-700 dark:text-slate-300",
            )}
            onClick={() => setFilterType("all")}
          >
            Todos
          </span>
          <span
            className={clsx(
              "shrink-0 px-2 py-1 flex items-center gap-1 cursor-pointer rounded",
              filterType === "call"
                ? "text-blue-600 bg-blue-100"
                : "text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:bg-slate-900",
            )}
            onClick={() => setFilterType("call")}
          >
            <Phone className="w-3 h-3" /> Llamada
          </span>
          <span
            className={clsx(
              "shrink-0 px-2 py-1 flex items-center gap-1 cursor-pointer rounded",
              filterType === "appointment"
                ? "text-blue-600 bg-blue-100"
                : "text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:bg-slate-900",
            )}
            onClick={() => setFilterType("appointment")}
          >
            <User className="w-3 h-3" /> Cita
          </span>
          <span
            className={clsx(
              "shrink-0 px-2 py-1 flex items-center gap-1 cursor-pointer rounded",
              filterType === "test_drive"
                ? "text-blue-600 bg-blue-100"
                : "text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:bg-slate-900",
            )}
            onClick={() => setFilterType("test_drive")}
          >
            <Car className="w-3 h-3" /> Prueba de manejo
          </span>
          <span
            className={clsx(
              "shrink-0 px-2 py-1 flex items-center gap-1 cursor-pointer rounded",
              filterType === "signature"
                ? "text-blue-600 bg-blue-100"
                : "text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:bg-slate-900",
            )}
            onClick={() => setFilterType("signature")}
          >
            <PenTool className="w-3 h-3" /> Firma
          </span>
          <span
            className={clsx(
              "shrink-0 px-2 py-1 flex items-center gap-1 cursor-pointer rounded",
              filterType === "payment"
                ? "text-emerald-600 bg-emerald-100"
                : "text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:bg-slate-900",
            )}
            onClick={() => setFilterType("payment")}
          >
            <DollarSign className="w-3 h-3" /> Pago
          </span>
          <span
            className={clsx(
              "shrink-0 px-2 py-1 flex items-center gap-1 cursor-pointer rounded",
              filterType === "task"
                ? "text-blue-600 bg-blue-100"
                : "text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:bg-slate-900",
            )}
            onClick={() => setFilterType("task")}
          >
            <CalendarDays className="w-3 h-3" /> Tarea
          </span>

          <div className="md:ml-auto flex shrink-0 gap-3 text-xs text-gray-500 dark:text-slate-400 border-l border-gray-200 dark:border-slate-700 pl-3">
            <span
              className={clsx(
                "cursor-pointer",
                filterStatus === "all"
                  ? "text-blue-600 border-b-2 border-blue-600 pb-0.5"
                  : "hover:text-gray-800 dark:text-slate-200",
              )}
              onClick={() => setFilterStatus("all")}
            >
              Todas
            </span>
            <span
              className={clsx(
                "cursor-pointer",
                filterStatus === "pending"
                  ? "text-blue-600 border-b-2 border-blue-600 pb-0.5"
                  : "hover:text-gray-800 dark:text-slate-200",
              )}
              onClick={() => setFilterStatus("pending")}
            >
              Pendientes
            </span>
            <span
              className={clsx(
                "cursor-pointer",
                filterStatus === "completed"
                  ? "text-blue-600 border-b-2 border-blue-600 pb-0.5"
                  : "hover:text-gray-800 dark:text-slate-200",
              )}
              onClick={() => setFilterStatus("completed")}
            >
              Completadas
            </span>
            <span
              className="mx-2 text-gray-300 dark:text-slate-600"
            >
              |
            </span>
            <span
              className={clsx(
                "cursor-pointer hidden sm:inline",
                filterDate === "overdue"
                  ? "text-blue-600 border-b-2 border-blue-600 pb-0.5"
                  : "hover:text-gray-800 dark:text-slate-200",
              )}
              onClick={() =>
                setFilterDate(filterDate === "overdue" ? "all" : "overdue")
              }
            >
              Vencidas
            </span>
            <span
              className={clsx(
                "cursor-pointer hidden sm:inline",
                filterDate === "today"
                  ? "text-blue-600 border-b-2 border-blue-600 pb-0.5"
                  : "hover:text-gray-800 dark:text-slate-200",
              )}
              onClick={() =>
                setFilterDate(filterDate === "today" ? "all" : "today")
              }
            >
              Hoy
            </span>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 flex overflow-hidden bg-white dark:bg-slate-800">
        <div className="flex-1 overflow-auto bg-white dark:bg-slate-800 flex flex-col">
          {view === "list" && (
            <>
            <table className="hidden md:table w-full text-left border-collapse text-sm text-gray-800 dark:text-slate-200 table-fixed min-w-[800px]">
              <thead className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 text-xs text-gray-700 dark:text-slate-300 font-bold">
                <tr>
                  <th
                    className="px-4 py-2 border-r border-gray-200 dark:border-slate-700 text-center relative"
                    style={{ width: columnWidths.checkbox }}
                  >
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 dark:border-slate-600 dark:bg-slate-700 bg-white dark:checked:bg-blue-500 cursor-pointer"
                      checked={
                        selectedTaskIds.length === sortedTasks.length &&
                        sortedTasks.length > 0
                      }
                      onChange={() =>
                        toggleSelectAllTasks(
                          sortedTasks.map((t) => t.task.id),
                        )
                      }
                    />
                    <div
                      className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 z-10"
                      onMouseDown={(e) => handleMouseDown(e, "checkbox")}
                    />
                  </th>
                  {visibleColumns.status && (
                    <th
                      className="px-4 py-2 border-r border-gray-200 dark:border-slate-700 relative cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50"
                      style={{ width: columnWidths.status }}
                      onClick={() => handleSort('status')}
                    >
                      Finalizada
                      {sortConfig?.key === 'status' && (
                        <span className="ml-1 inline-block">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                      )}
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 z-10"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          handleMouseDown(e, "status");
                        }}
                      />
                    </th>
                  )}
                  {visibleColumns.title && (
                    <th
                      className="px-4 py-2 border-r border-gray-200 dark:border-slate-700 relative cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50"
                      style={{ width: columnWidths.title }}
                      onClick={() => handleSort('title')}
                    >
                      Asunto
                      {sortConfig?.key === 'title' && (
                        <span className="ml-1 inline-block">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                      )}
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 z-10"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          handleMouseDown(e, "title");
                        }}
                      />
                    </th>
                  )}
                  {visibleColumns.deal && (
                    <th
                      className="px-4 py-2 border-r border-gray-200 dark:border-slate-700 relative cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50"
                      style={{ width: columnWidths.deal }}
                      onClick={() => handleSort('deal')}
                    >
                      Trato
                      {sortConfig?.key === 'deal' && (
                        <span className="ml-1 inline-block">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                      )}
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 z-10"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          handleMouseDown(e, "deal");
                        }}
                      />
                    </th>
                  )}
                  {visibleColumns.dueDate && (
                    <th
                      className="px-4 py-2 border-r border-gray-200 dark:border-slate-700 relative cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50"
                      style={{ width: columnWidths.dueDate }}
                      onClick={() => handleSort('dueDate')}
                    >
                      Vencimiento
                      {sortConfig?.key === 'dueDate' && (
                        <span className="ml-1 inline-block">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                      )}
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 z-10"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          handleMouseDown(e, "dueDate");
                        }}
                      />
                    </th>
                  )}
                  {visibleColumns.contact && (
                    <th
                      className="px-4 py-2 border-r border-gray-200 dark:border-slate-700 relative cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50"
                      style={{ width: columnWidths.contact }}
                      onClick={() => handleSort('contact')}
                    >
                      Persona de contacto
                      {sortConfig?.key === 'contact' && (
                        <span className="ml-1 inline-block">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                      )}
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 z-10"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          handleMouseDown(e, "contact");
                        }}
                      />
                    </th>
                  )}
                  {visibleColumns.email && (
                    <th
                      className="px-4 py-2 border-r border-gray-200 dark:border-slate-700 relative cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50"
                      style={{ width: columnWidths.email }}
                      onClick={() => handleSort('email')}
                    >
                      Correo electrónico
                      {sortConfig?.key === 'email' && (
                        <span className="ml-1 inline-block">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                      )}
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 z-10"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          handleMouseDown(e, "email");
                        }}
                      />
                    </th>
                  )}
                  {visibleColumns.phone && (
                    <th
                      className="px-4 py-2 relative border-r border-gray-200 dark:border-slate-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50"
                      style={{ width: columnWidths.phone }}
                      onClick={() => handleSort('phone')}
                    >
                      Teléfono
                      {sortConfig?.key === 'phone' && (
                        <span className="ml-1 inline-block">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                      )}
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 z-10"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          handleMouseDown(e, "phone");
                        }}
                      />
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-800">
                {sortedTasks.map(({ task, client }) => (
                  <tr
                    key={`task-${task.id}`}
                    className={clsx(
                      "border-b border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:bg-slate-900 flex-col md:table-row group",
                      selectedTaskIds.includes(task.id) &&
                        "bg-blue-50 dark:bg-slate-700",
                    )}
                  >
                    <td className="px-4 py-2 text-center border-r border-gray-100 dark:border-slate-700 text-gray-300 relative">
                      <div className="flex items-center justify-center py-2">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 dark:border-slate-600 dark:bg-slate-700 bg-white dark:checked:bg-blue-500 cursor-pointer"
                          checked={selectedTaskIds.includes(task.id)}
                          onChange={() => toggleTaskSelection(task.id)}
                        />
                      </div>
                    </td>
                    {visibleColumns.status && (
                      <td className="px-4 py-2 border-r border-gray-100 dark:border-slate-700 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleTask(task.id, task.completed);
                          }}
                          className={clsx(
                            "transition-colors",
                            task.completed
                              ? "text-green-500"
                              : "text-gray-300 hover:text-green-500",
                          )}
                        >
                          {task.completed ? (
                            <CheckCircle className="w-5 h-5 mx-auto" />
                          ) : (
                            <Circle className="w-5 h-5 mx-auto" />
                          )}
                        </button>
                      </td>
                    )}
                    {visibleColumns.title && (
                      <td
                        className="px-4 py-2 border-r border-gray-100 dark:border-slate-700 font-bold truncate cursor-pointer hover:text-blue-600"
                        onClick={() => handleTaskClick(task)}
                      >
                        <span
                          className={clsx(
                            "flex items-center gap-2",
                            task.completed && "line-through",
                            getTaskColorClass(task),
                          )}
                        >
                          {getTaskIcon(task)} {task.title}
                          {task.type === "payment" && client && (
                            <span 
                              className="ml-2 px-2 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedClient(client);
                              }}
                            >
                              Ver Venta
                            </span>
                          )}
                        </span>
                      </td>
                    )}
                    {visibleColumns.deal && (
                      <td
                        className="px-4 py-2 border-r border-gray-100 dark:border-slate-700 text-blue-600 truncate hover:underline cursor-pointer"
                        onClick={() =>
                          client
                            ? setSelectedClient(client)
                            : handleTaskClick(task)
                        }
                      >
                        {client?.name || "Desconocido"}
                      </td>
                    )}
                    {visibleColumns.dueDate && (
                      <td
                        className={clsx(
                          "px-4 py-2 border-r border-gray-100 dark:border-slate-700 font-medium",
                          getTaskColorClass(task),
                        )}
                      >
                        {task.dueDate
                          ? format(
                              new Date(task.dueDate + "T00:00:00"),
                              "dd MMM yyyy",
                              { locale: es },
                            )
                          : ""}
                      </td>
                    )}
                    {visibleColumns.contact && (
                      <td className="px-4 py-2 border-r border-gray-100 dark:border-slate-700 truncate hover:underline cursor-pointer text-gray-600 dark:text-slate-400">
                        <span className="border border-gray-200 dark:border-slate-700 rounded px-2 inline-block">
                          {client?.name || "Desconocido"}
                        </span>
                      </td>
                    )}
                    {visibleColumns.email && (
                      <td className="px-4 py-2 border-r border-gray-100 dark:border-slate-700 truncate text-blue-600 hover:underline cursor-pointer">
                        {client?.email || ""}
                      </td>
                    )}
                    {visibleColumns.phone && (
                      <td className="px-4 py-2 truncate text-gray-600 dark:text-slate-400 hover:text-blue-600 cursor-pointer">
                        {client?.phone || ""}
                      </td>
                    )}
                  </tr>
                ))}
                {sortedTasks.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="p-8 text-center text-sm font-medium text-gray-500 dark:text-slate-400"
                    >
                      No hay actividades para mostrar.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Mobile List View */}
            <div className="md:hidden flex flex-col bg-white dark:bg-[#111] min-h-full pb-24">
              {/* Add Task Row (Mobile) */}
              <div 
                className="flex items-center justify-between gap-4 p-4 border-b border-gray-100 dark:border-[#222] cursor-pointer"
                onClick={() => setShowNewTaskModal(true)}
              >
                <div className="flex items-center gap-4">
                  <div className="text-blue-500 shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path>
                      <path d="M12 8v8"></path>
                      <path d="M8 12h8"></path>
                    </svg>
                  </div>
                  <span className="text-[15px] font-medium tracking-wide text-blue-500">
                    Agregar una tarea
                  </span>
                </div>
                <button className="text-gray-400">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
                </button>
              </div>

              {sortedTasks.map(({ task, client }) => (
                <div key={`task-${task.id}`} className="flex items-start gap-4 p-4 border-b border-gray-100 dark:border-[#222]" onClick={() => handleTaskClick(task)}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleTask(task.id, task.completed);
                    }}
                    className={clsx(
                      "mt-1 shrink-0 transition-colors",
                      task.completed
                        ? "text-green-500"
                        : "text-gray-400 hover:text-green-500"
                    )}
                  >
                    {task.completed ? (
                      <CheckCircle className="w-6 h-6" />
                    ) : (
                      <Circle className="w-6 h-6" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0 flex flex-col gap-1">
                    <span className={clsx("text-[15px] font-normal tracking-wide text-slate-900 dark:text-slate-100", task.completed && "line-through text-gray-500 dark:text-slate-400")}>
                      {task.title}
                    </span>
                    
                    <div className="flex flex-col gap-0.5 mt-0.5">
                      {task.dealId && deals && (
                         <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                           <Briefcase className="w-3.5 h-3.5 opacity-70" />
                           <span className="truncate">{deals.find(d => d.id === task.dealId)?.title || "Trato"}</span>
                         </div>
                      )}
                      {client && (
                         <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                           <User className="w-3.5 h-3.5 opacity-70" />
                           <span className="truncate">{client.name}</span>
                         </div>
                      )}
                    </div>

                    {task.dueDate && (
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <div className={clsx(
                          "flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border",
                          isAfter(startOfDay(new Date()), parseISO(task.dueDate)) && !task.completed
                            ? "text-rose-500 border-rose-200 bg-rose-50 dark:bg-rose-900/20 dark:border-rose-800"
                            : "text-slate-600 border-slate-300 dark:text-slate-300 dark:border-slate-600"
                        )}>
                          <Clock className="w-3.5 h-3.5" />
                          {format(parseISO(task.dueDate), "eee, d MMM", { locale: es })}
                          {task.startTime && ` • ${task.startTime}`}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {sortedTasks.length === 0 && (
                <div className="p-8 text-center text-sm font-medium text-gray-500 dark:text-slate-400">
                  No hay actividades para mostrar.
                </div>
              )}
            </div>
            </>
          )}

          {view === "calendar" && (
            <div className="flex flex-col h-full border-t border-gray-200 dark:border-slate-700">
              {/* Calendar Controls */}
              <div className="flex items-center justify-between p-1.5 md:p-3 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900">
                <div className="flex items-center gap-3">
                  <select
                    value={calendarMode}
                    onChange={(e) => setCalendarMode(e.target.value as any)}
                    className="px-3 py-1.5 text-xs font-bold border border-gray-300 rounded bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 shadow-sm outline-none"
                  >
                    <option value="day">Día</option>
                    <option value="week">Semana</option>
                    <option value="month">Mes</option>
                    <option value="year">Año</option>
                  </select>
                  <div className="flex items-center">
                    <button
                      onClick={prevPeriod}
                      className="p-1 border border-r-0 border-gray-300 bg-white dark:bg-slate-800 rounded-l hover:bg-gray-50 dark:bg-slate-900"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setCurrentDate(new Date())}
                      className="px-3 py-[3px] text-xs font-bold border border-gray-300 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:bg-slate-900"
                    >
                      Hoy
                    </button>
                    <button
                      onClick={nextPeriod}
                      className="p-1 border border-l-0 border-gray-300 bg-white dark:bg-slate-800 rounded-r hover:bg-gray-50 dark:bg-slate-900"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="font-bold text-gray-800 dark:text-slate-200 text-[10px] md:text-sm capitalize truncate max-w-[120px] md:max-w-none text-right">
                  {calendarMode === "day"
                    ? format(start, "EEEE d 'de' MMMM, yyyy", { locale: es })
                    : calendarMode === "week"
                      ? `${format(start, "MMM d", { locale: es })} - ${format(end, "MMM d, yyyy", { locale: es })}`
                      : calendarMode === "month"
                        ? format(start, "MMMM yyyy", { locale: es })
                        : format(start, "yyyy", { locale: es })}
                </div>
              </div>

              {calendarMode === "month" && (
                <div className="overflow-x-auto flex-1">
                  <div className="min-w-full md:min-w-[500px] h-full flex flex-col">
                    {/* Calendar Grid Header */}
                    <div className="grid grid-cols-7 border-b border-gray-200 bg-white dark:bg-slate-800 shadow-sm z-10 sticky top-0 shrink-0">
                      {["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"].map(
                        (d) => (
                          <div
                            key={d}
                            className="px-1 md:px-2 py-2 text-[10px] md:text-[11px] font-bold text-gray-500 dark:text-slate-400 border-r border-gray-200 dark:border-slate-700 text-center"
                          >
                            {d}
                          </div>
                        ),
                      )}
                    </div>

                    {/* Calendar Grid Body */}
                    <div className="grid grid-cols-7 flex-1 border-r border-gray-200 bg-white dark:bg-slate-800 grid-rows-5">
                      {calendarDays.map((day, i) => {
                        const isValidDay = day instanceof Date;
                        const dateStr = isValidDay
                          ? format(day, "yyyy-MM-dd")
                          : "";
                        const dayTasks = baseFilteredTasks.filter(
                          (t) => t.task.dueDate === dateStr,
                        );
                        const isToday = isValidDay && isSameDay(day, today);

                        return (
                          <div
                            key={i}
                            className={clsx(
                              "border-b border-l border-gray-200 dark:border-slate-700 p-1 min-h-[100px] md:min-h-[120px] transition-colors relative",
                              !isValidDay && "bg-gray-50 dark:bg-slate-900",
                              isValidDay && "hover:bg-blue-50/20",
                            )}
                          >
                            {isValidDay && (
                              <div className="flex flex-col h-full relative">
                                <div
                                  className={clsx(
                                    "text-right text-xs font-bold mb-1 p-1",
                                    isToday
                                      ? "text-blue-600 bg-blue-100 w-6 h-6 rounded-full flex items-center justify-center ml-auto"
                                      : "text-gray-500 dark:text-slate-400",
                                  )}
                                >
                                  {format(day, "d")}
                                </div>
                                <div className="flex flex-col gap-1 overflow-y-auto max-h-[150px] scrollbar-hide">
                                  {dayTasks.map(({ task, client }, idx) => (
                                    <div
                                      key={`${task.id}-${idx}`}
                                      onClick={() => handleTaskClick(task)}
                                      className={clsx(
                                        "text-[9px] md:text-[10px] p-1 rounded truncate font-medium flex items-center gap-1 shadow-sm border group",
                                        task.completed
                                          ? "bg-gray-100 text-gray-500 dark:text-slate-400 border-gray-200 dark:border-slate-700 line-through hover:border-gray-300"
                                          : "bg-blue-50 text-blue-700 border-blue-200 cursor-pointer hover:bg-blue-100 hover:border-blue-300",
                                      )}
                                    >
                                      <span className="truncate flex-1">{task.title}</span>
                                      {task.type === "payment" && client && (
                                        <span 
                                          className="hidden group-hover:inline-block shrink-0 px-1 py-0.5 rounded text-[8px] bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedClient(client);
                                          }}
                                        >
                                          Ver Venta
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {(calendarMode === "week" || calendarMode === "day") && (
                <div
                  className="flex flex-1 overflow-auto bg-white dark:bg-slate-800 relative"
                  ref={calendarGridRef}
                >
                  {/* Time Column */}
                  <div className="w-10 md:w-16 shrink-0 border-r border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 sticky left-0 z-20">
                    <div className="h-16 border-b border-gray-200 dark:border-slate-700 sticky top-0 bg-gray-50 dark:bg-slate-900 z-30" />
                    {Array.from({ length: businessHours.end - businessHours.start + 1 }, (_, i) => {
                      const hour = i + businessHours.start;
                      return (
                        <div
                          key={hour}
                          className="h-24 border-b border-gray-200 dark:border-slate-700 text-[10px] text-gray-500 dark:text-slate-400 text-right pr-1 md:pr-2 pt-1 font-medium leading-[1.1]"
                        >
                          {hour.toString().padStart(2, "0")}
                          <span className="hidden md:inline">:00</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Days Columns */}
                  <div
                    className={clsx(
                      "flex-1 flex",
                      calendarMode === "week" && "min-w-full md:min-w-[700px]",
                    )}
                  >
                    {calendarDays.map((day, i) => {
                      const dateStr = format(day, "yyyy-MM-dd");
                      const dayTasks = baseFilteredTasks.filter((t) => {
                        if (dragState && dragState.taskId === t.task.id) {
                          return dragState.currentDate === dateStr;
                        }
                        return t.task.dueDate === dateStr;
                      });

                      return (
                        <div
                          key={i}
                          className="flex-1 flex flex-col border-r border-gray-200 dark:border-slate-700 min-w-0 md:min-w-[100px]"
                        >
                          {/* Day Header */}
                          <div className="h-12 md:h-16 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 sticky top-0 z-10 flex flex-col items-center justify-center shrink-0">
                            <span className="text-[8px] md:text-[10px] uppercase text-gray-500 dark:text-slate-400 font-bold mb-0.5 md:mb-1">
                              {format(day, "eee", { locale: es })}
                            </span>
                            <span
                              className={clsx(
                                "text-sm md:text-lg font-bold w-6 h-6 md:w-8 md:h-8 flex items-center justify-center rounded-full",
                                isSameDay(day, today)
                                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm shadow-blue-500/20"
                                  : "text-gray-900 dark:text-slate-100",
                              )}
                            >
                              {format(day, "d")}
                            </span>
                          </div>

                          {/* Hour Cells */}
                          <div className="relative flex-1">
                            {Array.from({ length: businessHours.end - businessHours.start + 1 }, (_, h) => (
                              <div
                                key={h}
                                className="h-24 border-b border-gray-100 dark:border-slate-800/50"
                              />
                            ))}

                            {/* Render Tasks Absolute */}
                            {dayTasks.map(({ task, client }, idx) => {
                              const startHour = task.startTime
                                ? parseInt(task.startTime.split(":")[0])
                                : 12;
                              const startMin = task.startTime
                                ? parseInt(task.startTime.split(":")[1])
                                : 0;
                              // Cell height is 96px (h-24 = 6rem = 96px)
                              // Do not render tasks outside business hours
                              if (startHour < businessHours.start || startHour > businessHours.end) {
                                return null;
                              }
                              const top = (startHour - businessHours.start) * 96 + (startMin / 60) * 96;

                              let height = 44;
                              if (task.endTime) {
                                const endHour = parseInt(
                                  task.endTime.split(":")[0],
                                );
                                const endMin = parseInt(
                                  task.endTime.split(":")[1],
                                );
                                let endTotalMinutes = endHour * 60 + endMin;
                                let startTotalMinutes =
                                  startHour * 60 + startMin;
                                if (endTotalMinutes < startTotalMinutes) {
                                  endTotalMinutes += 24 * 60; // Next day fallback
                                }
                                const durationMinutes =
                                  endTotalMinutes - startTotalMinutes;
                                height = Math.max(
                                  44,
                                  (durationMinutes / 60) * 96 - 4,
                                ); // -4 for padding/border adjustments
                              }

                              const isDragging = dragState?.taskId === task.id;
                              const displayTop = isDragging
                                ? dragState.currentTop
                                : top;
                              const displayHeight = isDragging
                                ? dragState.currentHeight
                                : height;

                              return (
                                <div
                                  key={`${task.id}-${idx}`}
                                  onPointerUp={(e) => {
                                    if (!dragState || !dragState.hasMoved) {
                                      handleTaskClick(task);
                                    }
                                  }}
                                  onPointerDown={(e) => {
                                    e.stopPropagation();
                                    setDragState({
                                      taskId: task.id,
                                      type: "move",
                                      startY: e.clientY,
                                      startX: e.clientX,
                                      originalTop: top,
                                      originalHeight: height,
                                      originalDate: task.dueDate,
                                      currentTop: top,
                                      currentHeight: height,
                                      currentDate: task.dueDate,
                                      originalStartStr:
                                        task.startTime || "12:00",
                                      originalEndStr: task.endTime,
                                      hasMoved: false,
                                    });
                                  }}
                                  className={clsx(
                                    "absolute left-1 right-1 rounded border p-1.5 shadow-sm overflow-hidden cursor-pointer flex flex-col z-10 transition-all group",
                                    isDragging
                                      ? "z-50 opacity-90 shadow-xl ring-2 ring-blue-500 scale-[1.02] select-none"
                                      : "hover:z-20",
                                    task.completed
                                      ? "bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-slate-400 border-gray-200 dark:border-slate-700 line-through opacity-80"
                                      : "bg-blue-50/95 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700/50 hover:bg-blue-100 dark:hover:bg-blue-900/80 shadow-blue-900/5",
                                  )}
                                  style={{
                                    top: `${displayTop + 2}px`,
                                    minHeight: "44px",
                                    height:
                                      task.endTime || isDragging
                                        ? `${displayHeight}px`
                                        : undefined,
                                    touchAction: "none",
                                  }}
                                >
                                  <div className="font-bold text-[11px] leading-tight group-hover:text-blue-800 dark:group-hover:text-blue-200 line-clamp-2">
                                    {task.title}
                                  </div>
                                  {task.type === "payment" && client && (
                                    <span 
                                      className="hidden group-hover:inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] bg-emerald-100 text-emerald-700 hover:bg-emerald-200 w-fit"
                                      onPointerDown={(e) => {
                                        e.stopPropagation();
                                      }}
                                      onPointerUp={(e) => {
                                        e.stopPropagation();
                                        setSelectedClient(client);
                                      }}
                                    >
                                      Ver Venta
                                    </span>
                                  )}
                                  {task.startTime && (
                                    <div className="text-[10px] mt-0.5 opacity-80 flex items-center gap-1">
                                      <CalendarIcon className="w-2 h-2" />
                                      {task.startTime}{" "}
                                      {task.endTime && `- ${task.endTime}`}
                                    </div>
                                  )}
                                  {/* Resize Handle */}
                                  <div
                                    className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-blue-500/20 active:bg-blue-500/40"
                                    onPointerDown={(e) => {
                                      e.stopPropagation();
                                      setDragState({
                                        taskId: task.id,
                                        type: "resize",
                                        startY: e.clientY,
                                        startX: e.clientX,
                                        originalTop: top,
                                        originalHeight: height,
                                        originalDate: task.dueDate,
                                        currentTop: top,
                                        currentHeight: height,
                                        currentDate: task.dueDate,
                                        originalStartStr:
                                          task.startTime || "12:00",
                                        originalEndStr: task.endTime,
                                        hasMoved: false,
                                      });
                                    }}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {calendarMode === "year" && (
                <div className="flex-1 overflow-auto p-4 md:p-6 bg-white dark:bg-slate-800">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {eachMonthOfInterval({ start, end }).map((monthDate) => {
                      const monthStart = startOfMonth(monthDate);
                      const monthEnd = endOfMonth(monthDate);
                      const monthDays = eachDayOfInterval({
                        start: monthStart,
                        end: monthEnd,
                      });
                      const startDayOfWeek = getDay(monthStart);
                      const prefix = Array(
                        startDayOfWeek === 0 ? 6 : startDayOfWeek - 1,
                      ).fill(null);
                      const allDays = [...prefix, ...monthDays];

                      return (
                        <div
                          key={monthDate.toISOString()}
                          className="border border-gray-200 dark:border-slate-700 rounded p-3"
                        >
                          <div className="font-bold text-sm text-gray-800 dark:text-slate-200 mb-3 capitalize text-center">
                            {format(monthDate, "MMMM", { locale: es })}
                          </div>
                          <div className="grid grid-cols-7 gap-1 text-center mb-2">
                            {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
                              <div
                                key={i}
                                className="text-[10px] font-bold text-gray-400"
                              >
                                {d}
                              </div>
                            ))}
                          </div>
                          <div className="grid grid-cols-7 gap-1 text-center">
                            {allDays.map((d, i) => {
                              if (!d) return <div key={i} />;
                              const hasTasks = baseFilteredTasks.some(
                                (t) =>
                                  t.task.dueDate === format(d, "yyyy-MM-dd"),
                              );
                              return (
                                <div
                                  key={i}
                                  className={clsx(
                                    "w-6 h-6 mx-auto flex items-center justify-center text-[10px] rounded-full",
                                    isSameDay(d, today) &&
                                      "bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold",
                                    !isSameDay(d, today) &&
                                      hasTasks &&
                                      "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 font-bold",
                                    !isSameDay(d, today) &&
                                      !hasTasks &&
                                      "text-gray-700 dark:text-slate-300",
                                  )}
                                >
                                  {format(d, "d")}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Sidebar */}
        {showRightSidebar ? (
          <div className="hidden md:flex w-80 shrink-0 border-l border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex-col overflow-hidden transition-all duration-300">
            <div
              className="p-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-800 z-10 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-900 transition-colors"
              onClick={() => setShowRightSidebar(false)}
              title="Ocultar panel"
            >
              <div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                  {view === "calendar" ? "TASKS" : "CALENDAR"}
                </div>
                <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-bold text-sm">
                  <span>
                    {view === "calendar" ? "Mis tareas" : "Calendario"}
                  </span>
                </div>
              </div>
              <button className="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-500 transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {view === "calendar" ? (
              <>
                <div className="p-2 border-b border-gray-100 dark:border-slate-700/50">
                  <button
                    onClick={() => setShowNewTaskModal(true)}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700/50 rounded transition-colors"
                  >
                    <div className="w-6 h-6 rounded-full flex items-center justify-center bg-blue-100/50 text-blue-600 shrink-0">
                      <span className="text-lg leading-none mt-[-2px]">+</span>
                    </div>
                    Agregar una tarea
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-1">
                  {sortedTasks
                    .filter((t) => !t.task.completed)
                    .map(({ task, client }) => (
                      <div
                        key={`task-${task.id}`}
                        className="group flex gap-3 p-3 rounded hover:bg-gray-50 dark:hover:bg-slate-800/50 cursor-pointer border border-transparent hover:border-gray-100 dark:hover:border-slate-700/30 transition-all"
                        onClick={() => handleTaskClick(task)}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleTask(task.id, task.completed);
                          }}
                          className="mt-0.5 shrink-0 text-gray-300 dark:text-slate-500 hover:text-green-500 transition-colors"
                        >
                          <Circle className="w-5 h-5" />
                        </button>
                        <div className="flex-1 min-w-0 flex flex-col gap-1">
                          <span className="text-[14px] font-medium text-slate-800 dark:text-slate-200 line-clamp-2 leading-tight">
                            {task.title}
                          </span>

                          <div className="flex flex-col gap-0.5">
                            {task.dealId && deals && (
                              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                                <Briefcase className="w-3 h-3 opacity-70" />
                                <span className="truncate">{deals.find(d => d.id === task.dealId)?.title || "Trato"}</span>
                              </div>
                            )}
                            {client && (
                              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                                <User className="w-3 h-3 opacity-70" />
                                <span className="truncate">{client.name}</span>
                              </div>
                            )}
                          </div>

                          {task.dueDate && (
                            <div className="mt-1 flex items-center">
                              <span
                                className={clsx(
                                  "text-[10px] font-medium flex items-center gap-1 px-2 py-0.5 rounded-full border",
                                  isAfter(
                                    startOfDay(new Date()),
                                    parseISO(task.dueDate),
                                  ) && !task.completed
                                    ? "text-rose-500 border-rose-200 bg-rose-50 dark:bg-rose-900/20 dark:border-rose-800"
                                    : "text-slate-600 border-gray-200 dark:text-slate-300 dark:border-slate-700/60 dark:bg-slate-800"
                                )}
                              >
                                <Clock className="w-3 h-3" />
                                {format(parseISO(task.dueDate), "eee, d MMM", {
                                  locale: es,
                                })}
                                {task.startTime && ` • ${task.startTime}`}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}

                  {sortedTasks.filter((t) => !t.task.completed).length ===
                    0 && (
                    <div className="text-center p-6 text-gray-400 dark:text-slate-500 text-sm">
                      No tienes tareas pendientes. ¡Buen trabajo!
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 overflow-y-auto">
                {renderMiniCalendar()}
              </div>
            )}
          </div>
        ) : (
          <div
            className="hidden md:flex w-12 shrink-0 border-l border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 flex-col items-center py-4 transition-all duration-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800 border-l-4 border-l-blue-500"
            onClick={() => setShowRightSidebar(true)}
            title={
              view === "calendar"
                ? "Mostrar panel de tareas"
                : "Mostrar calendario"
            }
          >
            <button className="p-1.5 rounded-md bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 shadow-sm transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="mt-8 relative h-32 w-full flex items-center justify-center">
              <span className="absolute -rotate-90 whitespace-nowrap text-xs font-bold text-gray-500 tracking-widest uppercase">
                {view === "calendar" ? "Mis tareas" : "Calendario"}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {taskToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded shadow-xl w-full max-w-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
            <div className="p-5">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                Confirmar eliminación
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {taskToDelete === "multiple"
                  ? `¿Estás seguro que deseas eliminar las ${selectedTaskIds.length} tareas seleccionadas?`
                  : "¿Estás seguro que deseas eliminar esta tarea?"}
                Esta acción no se puede deshacer.
              </p>
            </div>
            <div className="p-4 bg-[#f4f5f5] dark:bg-slate-800/50 border-t border-gray-200 dark:border-slate-700 flex justify-end gap-3">
              <button
                onClick={() => setTaskToDelete(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New/Edit Activity Modal */}
      <AnimatePresence>
        {(showNewTaskModal || editingTask) && (
          <NewActivityModal
          onClose={() => {
            setShowNewTaskModal(false);
            setEditingTask(null);
            setNewTaskPrefill(null);
          }}
          clients={clients}
          tasks={tasks}
          deals={deals}
          currentUser={userData}
          initialData={editingTask || newTaskPrefill}
            onSave={async (taskData) => {
            if (!taskData.title || !taskData.dueDate || !userData) {
              if (!taskData.title) alert("El título es requerido");
              return;
            }

            try {
              let finalDealId = taskData.dealId;
              let finalClientId = taskData.clientId;

              // Request Google Token directly on user gesture before async database operations
              let token = googleToken;
              if (taskData.syncToCalendar && !token) {
                try {
                  token = await connectGoogleServices();
                } catch (err: any) {
                  alert(
                    err.message ||
                      "Error al conectar con Google. Actividad no guardada.",
                  );
                  return;
                }
                if (!token) return; // User cancelled popup
              }

              // Try to find existing client by name if ID is missing
              if (taskData.clientName && !finalClientId) {
                const existingClient = clients.find(
                  (c) =>
                    String(c.name || "")
                      .toLowerCase()
                      .trim() ===
                    String(taskData.clientName).toLowerCase().trim(),
                );
                if (existingClient) {
                  finalClientId = existingClient.id;
                } else {
                  const clientRef = doc(collection(db, "clients"));
                  const newClient = {
                    id: clientRef.id,
                    agencyId: userData.agencyId || "",
                    sellerId: userData.id || "",
                    name: taskData.clientName,
                    organization: taskData.organization || "",
                    status: taskData.clientStatus || "new",
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  };
                  await setDoc(clientRef, newClient);
                  finalClientId = clientRef.id;
                  setClients((prev) => [...prev, newClient as Client]);
                }
              }

              // Try to find existing deal by title if ID is missing
              if (taskData.dealTitle && !finalDealId) {
                const existingDeal = deals.find(
                  (d) =>
                    String(d.title || "")
                      .toLowerCase()
                      .trim() ===
                    String(taskData.dealTitle).toLowerCase().trim(),
                );
                if (existingDeal) {
                  finalDealId = existingDeal.id;
                } else {
                  const dealRef = doc(collection(db, "deals"));
                  const newDeal = {
                    id: dealRef.id,
                    agencyId: userData.agencyId || "",
                    clientId: finalClientId || "",
                    title: taskData.dealTitle,
                    status: "open",
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  };
                  await setDoc(dealRef, newDeal);
                  finalDealId = dealRef.id;
                  setDeals((prev) => [...prev, newDeal as Deal]);
                }
              }

              // Inherit clientId from the deal if missing
              if (!finalClientId && finalDealId) {
                const matchedDeal = deals.find((d) => d.id === finalDealId);
                if (matchedDeal && matchedDeal.clientId) {
                  finalClientId = matchedDeal.clientId;
                }
              }

              // Update deal with clientId if the deal was missing it but the task has one
              if (finalClientId && finalDealId) {
                const matchedDeal = deals.find((d) => d.id === finalDealId);
                if (matchedDeal && !matchedDeal.clientId) {
                  await setDoc(doc(db, "deals", finalDealId), {
                    clientId: finalClientId,
                  }, { merge: true });
                  setDeals((prev) =>
                    prev.map((d) =>
                      d.id === finalDealId
                        ? { ...d, clientId: finalClientId }
                        : d,
                    ),
                  );
                }
              }

              // Update client with new organization if needed
              if (finalClientId && taskData.organization) {
                const c = clients.find((cl) => cl.id === finalClientId);
                if (c && c.organization !== taskData.organization) {
                  await setDoc(doc(db, "clients", finalClientId), {
                    organization: taskData.organization,
                  }, { merge: true });
                  setClients((prev) =>
                    prev.map((cl) =>
                      cl.id === finalClientId
                        ? { ...cl, organization: taskData.organization }
                        : cl,
                    ),
                  );
                }
              }

              const newRef = editingTask
                ? doc(db, "tasks", editingTask.id)
                : doc(collection(db, "tasks"));
              const tempTask: Partial<Task> = {
                agencyId: userData.agencyId || "",
                sellerId: userData.id || "",
                clientId: finalClientId || "",
                dealId: finalDealId || "",
                title: taskData.title,
                type: taskData.type || "call",
                notes: taskData.notes || "",
                dueDate: taskData.dueDate,
                startTime: taskData.startTime,
                endTime: taskData.endTime,
                completed: taskData.completed || false,
                updatedAt: new Date().toISOString(),
              };

              // Remove undefined fields to avoid Firebase errors
              Object.keys(tempTask).forEach(
                (k) =>
                  tempTask[k as keyof typeof tempTask] === undefined &&
                  delete tempTask[k as keyof typeof tempTask],
              );

              if (!editingTask) {
                tempTask.createdAt = new Date().toISOString();
                await setDoc(newRef, tempTask);
              } else {
                await updateDoc(newRef, tempTask);
              }

              if (taskData.syncToCalendar && token) {
                const event = {
                  summary: taskData.title,
                  description: taskData.notes,
                  start: {
                    dateTime: `${taskData.dueDate}T${taskData.startTime}:00`,
                    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                  },
                  end: {
                    dateTime: `${taskData.dueDate}T${taskData.endTime || taskData.startTime}:00`,
                    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                  },
                };

                const taskPayload = {
                  title: taskData.title,
                  notes: taskData.notes,
                  due: new Date(`${taskData.dueDate}T${taskData.startTime || '00:00'}:00`).toISOString()
                };

                try {
                  const [calRes, taskRes] = await Promise.all([
                    fetch(
                      "https://www.googleapis.com/calendar/v3/calendars/primary/events",
                      {
                        method: "POST",
                        headers: {
                          Authorization: `Bearer ${token}`,
                          "Content-Type": "application/json",
                        },
                        body: JSON.stringify(event),
                      }
                    ),
                    fetch(
                      "https://tasks.googleapis.com/tasks/v1/lists/@default/tasks",
                      {
                        method: "POST",
                        headers: {
                          Authorization: `Bearer ${token}`,
                          "Content-Type": "application/json",
                        },
                        body: JSON.stringify(taskPayload),
                      }
                    )
                  ]);

                  let updates: any = {};
                  if (calRes.ok) {
                    const calData = await calRes.json();
                    updates.googleEventId = calData.id;
                  }
                  if (taskRes.ok) {
                    const taskData = await taskRes.json();
                    updates.googleTaskId = taskData.id;
                  }

                  if (Object.keys(updates).length > 0) {
                    await updateDoc(newRef, updates);
                  }

                  alert(
                    "¡Actividad guardada y evento agregado a tu Calendario y Tareas de Google con éxito!",
                  );
                } catch (calendarError) {
                  console.error("Error syncing to calendar/tasks", calendarError);
                  alert(
                    "Actividad guardada, pero ocurrió un error al sincronizar con Google.",
                  );
                }
              }

              const cl = clients.find((c) => c.id === finalClientId) || null;
              if (editingTask) {
                setTasks((prev) =>
                  prev.map((t) =>
                    t.task.id === editingTask.id
                      ? { task: { ...t.task, ...tempTask } as Task, client: cl }
                      : t,
                  ),
                );
              } else {
                setTasks((prev) => [
                  { task: { id: newRef.id, ...tempTask } as Task, client: cl },
                  ...prev,
                ]);
              }
              setShowNewTaskModal(false);
              setEditingTask(null);
            } catch (e) {
              console.error("Error creating task", e);
            }
          }}
          />
        )}
      </AnimatePresence>

      {/* Client Detail Modal when clicking on a task */}
      {selectedClient && (
        <ClientDetailModal
          client={selectedClient}
          onClose={() => setSelectedClient(null)}
          onUpdated={() => setRefreshKey(prev => prev + 1)}
        />
      )}
    </div>
  );
}
