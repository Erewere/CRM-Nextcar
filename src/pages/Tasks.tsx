import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs, updateDoc, doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Task, Client, Deal } from '../types';
import { ClientDetailModal } from '../components/ClientDetailModal';
import { NewActivityModal } from '../components/NewActivityModal';
import { 
  CheckCircle, Circle, User, Calendar as CalendarIcon, 
  List as ListIcon, Phone, Video, CalendarDays, Flag,
  Mail, Coffee, ChevronLeft, ChevronRight, X, AlertCircle, ChevronDown, Filter, Car, PenTool
} from 'lucide-react';
import clsx from 'clsx';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addDays, getDay, isSameDay, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';

export function Tasks() {
  const { userData, connectGoogleServices, googleToken } = useAuth();
  const [tasks, setTasks] = useState<{task: Task, client: Client | null}[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [calendarMode, setCalendarMode] = useState<'week' | 'month'>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState<'all'|'pending'|'completed'>('all');
  const [filterDate, setFilterDate] = useState<'all'|'overdue'|'today'|'tomorrow'|'week'>('all');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [showSyncBanner, setShowSyncBanner] = useState(true);

  // New task form
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDate, setNewTaskDate] = useState('');
  const [newTaskClientId, setNewTaskClientId] = useState('');

  useEffect(() => {
    if (!userData || userData.role === 'master') return;

    const fetchTasksAndClients = async () => {
      let q = query(collection(db, 'tasks'), where('agencyId', '==', userData.agencyId));
      if (userData.role === 'seller') {
        q = query(collection(db, 'tasks'), where('agencyId', '==', userData.agencyId), where('sellerId', '==', userData.id));
      }

      try {
        const snap = await getDocs(q);
        const taskList = snap.docs.map(d => ({ id: d.id, ...d.data() } as Task));
        
        let cq = query(collection(db, 'clients'), where('agencyId', '==', userData.agencyId));
        let dq = query(collection(db, 'deals'), where('agencyId', '==', userData.agencyId));
        if (userData.role === 'seller') {
          cq = query(collection(db, 'clients'), where('agencyId', '==', userData.agencyId), where('sellerId', '==', userData.id));
          dq = query(collection(db, 'deals'), where('agencyId', '==', userData.agencyId), where('sellerId', '==', userData.id)); // Assuming deals have sellerId if restricted
        }
        
        const cSnap = await getDocs(cq);
        const cMap = new Map();
        cSnap.docs.forEach(d => cMap.set(d.id, { id: d.id, ...d.data() } as Client));
        setClients(Array.from(cMap.values()) as Client[]);

        try {
          const dSnap = await getDocs(dq);
          setDeals(dSnap.docs.map(d => ({ id: d.id, ...d.data() } as Deal)));
        } catch (e) {
          // If deals collection doesn't exist yet, it's fine, it will just be empty
          setDeals([]);
        }

        const combined = taskList.map(t => ({ task: t, client: t.clientId ? cMap.get(t.clientId) : null }));
        combined.sort((a,b) => new Date(a.task.dueDate).getTime() - new Date(b.task.dueDate).getTime());
        setTasks(combined);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchTasksAndClients();
  }, [userData]);

  const toggleTask = async (taskId: string, current: boolean) => {
    try {
      await updateDoc(doc(db, 'tasks', taskId), { completed: !current });
      setTasks(prev => prev.map(t => t.task.id === taskId ? { ...t, task: { ...t.task, completed: !current } } : t));
    } catch(e) {
      console.error(e);
    }
  };

  const nextPeriod = () => {
    if (calendarMode === 'week') {
      setCurrentDate(addDays(currentDate, 7));
    } else {
      setCurrentDate(addMonths(currentDate, 1));
    }
  };

  const prevPeriod = () => {
    if (calendarMode === 'week') {
      setCurrentDate(addDays(currentDate, -7));
    } else {
      setCurrentDate(subMonths(currentDate, 1));
    }
  };

  const today = new Date();
  
  // Calendar data calculation
  const start = calendarMode === 'week' ? startOfWeek(currentDate, { weekStartsOn: 1 }) : startOfMonth(currentDate);
  const end = calendarMode === 'week' ? endOfWeek(currentDate, { weekStartsOn: 1 }) : endOfMonth(currentDate);
  const days = eachDayOfInterval({ start, end });

  // Add padding for month view
  let calendarDays = [...days];
  if (calendarMode === 'month') {
    const startDayOfWeek = getDay(start);
    const prefixDays = Array(startDayOfWeek === 0 ? 6 : startDayOfWeek - 1).fill(null);
    calendarDays = [...prefixDays, ...calendarDays];
  }

  const getTaskIcon = (title: string = '') => {
    const t = (title || '').toLowerCase();
    if (t.includes('llama')) return <Phone className="w-3.5 h-3.5" />;
    if (t.includes('cita') || t.includes('reunió') || t.includes('junta') || t.includes('meet')) return <User className="w-3.5 h-3.5" />;
    if (t.includes('prueba') || t.includes('manejo') || t.includes('test')) return <Car className="w-3.5 h-3.5" />;
    if (t.includes('firma') || t.includes('contrato')) return <PenTool className="w-3.5 h-3.5" />;
    return <CalendarDays className="w-3.5 h-3.5" />;
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle || !newTaskDate || !newTaskClientId || !userData) return;
    
    try {
      const newRef = doc(collection(db, 'tasks'));
      const t = {
        agencyId: userData.agencyId,
        sellerId: userData.id,
        clientId: newTaskClientId,
        title: newTaskTitle,
        dueDate: newTaskDate,
        completed: false,
        createdAt: new Date().toISOString()
      };
      await updateDoc(doc(db, 'clients', newTaskClientId), { updatedAt: new Date().toISOString() }); // Just to trigger some update if needed, normally we do setDoc
      // Actually we just set instead of update for a new document
    } catch (e) {
      // ignore
    }
  };

  const handleSyncCalendar = async () => {
    const token = await connectGoogleServices();
    if (token) {
      alert("¡Calendario sincronizado con éxito!");
      setShowSyncBanner(false);
    }
  };

  const filteredTasks = tasks.filter(({ task }) => {
    // 1. Status Filter
    if (filterStatus === 'pending' && task.completed) return false;
    if (filterStatus === 'completed' && !task.completed) return false;

    // 2. Date Filter
    if (filterDate !== 'all' && task.dueDate) {
      const taskDate = new Date(task.dueDate + 'T00:00:00'); // Assuming YYYY-MM-DD
      taskDate.setHours(0, 0, 0, 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const tomorrow = addDays(today, 1);
      
      if (filterDate === 'overdue') {
        if (taskDate >= today || task.completed) return false;
      } else if (filterDate === 'today') {
        if (taskDate.getTime() !== today.getTime()) return false;
      } else if (filterDate === 'tomorrow') {
        if (taskDate.getTime() !== tomorrow.getTime()) return false;
      } else if (filterDate === 'week') {
        const weekStart = startOfWeek(today, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
        if (taskDate < weekStart || taskDate > weekEnd) return false;
      }
    } else if (filterDate !== 'all' && !task.dueDate) {
      return false; // exclude tasks without a due date if we filter by date
    }

    // 3. Type Filter
    if (filterType === 'all') return true;
    
    // Very basic filter logic based on title string matching (since Tasks don't have an explicit 'type' field yet)
    const t = (task.title || '').toLowerCase();
    switch (filterType) {
      case 'call': return t.includes('llama');
      case 'appointment': return t.includes('cita') || t.includes('reunió') || t.includes('junta') || t.includes('meet');
      case 'test_drive': return t.includes('prueba') || t.includes('manejo') || t.includes('test');
      case 'signature': return t.includes('firma') || t.includes('contrato');
      case 'task': return !t.includes('llama') && !t.includes('cita') && !t.includes('prueba') && !t.includes('firma') && !t.includes('reunió'); // Default task
      default: return true;
    }
  });

  if (loading) return <div className="flex h-screen items-center justify-center">Cargando...</div>;

  return (
    <div className="flex flex-col h-full bg-[#f4f5f5]">
      {/* Header and filters */}
      <div className="px-6 py-4 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-800 dark:text-slate-200">Acciones</h1>
            <AlertCircle className="w-4 h-4 text-gray-400" />
          </div>
        </div>

        {/* Sync alert mock removed for now */}

        {/* Controls bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            
            <div className="flex items-center bg-white dark:bg-slate-800 border border-gray-300 rounded shadow-sm overflow-hidden h-8 shrink-0">
              <button 
                onClick={() => setView('list')}
                className={clsx("px-3 h-full flex items-center justify-center", view === 'list' ? 'bg-gray-100 text-blue-600' : 'text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:bg-slate-900')}
              >
                <ListIcon className="w-4 h-4" />
              </button>
              <div className="w-px h-full bg-gray-300" />
              <button 
                onClick={() => setView('calendar')}
                className={clsx("px-3 h-full flex items-center justify-center", view === 'calendar' ? 'bg-gray-100 text-blue-600' : 'text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:bg-slate-900')}
              >
                <CalendarIcon className="w-4 h-4" />
              </button>
            </div>

            <div 
              onClick={() => setShowNewTaskModal(true)}
              className="flex items-center p-0.5 bg-green-600 text-white rounded text-sm font-semibold cursor-pointer hover:bg-green-700 shadow-sm shrink-0"
            >
               <div className="px-3 flex items-center gap-1 border-r border-green-500"><span className="text-lg leading-none mb-0.5">+</span> Actividad</div>
               <div className="px-1.5"><ChevronDown className="w-4 h-4" /></div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
             <span className="text-xs font-semibold text-gray-500 dark:text-slate-400">{tasks.length} actividades</span>
             <span className="text-[10px] font-bold text-red-500 border border-red-200 bg-red-50 px-2 py-0.5 rounded-full uppercase">Sincronización Inactiva</span>
             <div className="relative">
               <button 
                 onClick={() => setShowFilterMenu(!showFilterMenu)}
                 className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold border border-gray-300 rounded hover:bg-gray-50 dark:bg-slate-900 shadow-sm text-gray-700 dark:text-slate-300 ml-auto sm:ml-0"
               >
                 <Filter className="w-3.5 h-3.5" /> Filtro
               </button>
               {showFilterMenu && (
                 <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded shadow-lg border border-gray-200 dark:border-slate-700 z-50 p-2 text-sm text-gray-700 dark:text-slate-300">
                   <div className="font-bold text-xs uppercase text-gray-500 dark:text-slate-400 mb-2 px-2">Estado</div>
                   <div className={clsx("px-2 py-1.5 rounded cursor-pointer hover:bg-blue-50", filterStatus === 'all' && "bg-blue-50 text-blue-600 font-medium")} onClick={() => setFilterStatus('all')}>Todos los estados</div>
                   <div className={clsx("px-2 py-1.5 rounded cursor-pointer hover:bg-blue-50", filterStatus === 'pending' && "bg-blue-50 text-blue-600 font-medium")} onClick={() => setFilterStatus('pending')}>Pendientes</div>
                   <div className={clsx("px-2 py-1.5 rounded cursor-pointer hover:bg-blue-50", filterStatus === 'completed' && "bg-blue-50 text-blue-600 font-medium")} onClick={() => setFilterStatus('completed')}>Completadas</div>
                   
                   <div className="border-t border-gray-100 dark:border-slate-700 my-2"></div>
                   
                   <div className="font-bold text-xs uppercase text-gray-500 dark:text-slate-400 mb-2 px-2">Fecha</div>
                   <div className={clsx("px-2 py-1.5 rounded cursor-pointer hover:bg-blue-50", filterDate === 'all' && "bg-blue-50 text-blue-600 font-medium")} onClick={() => setFilterDate('all')}>Todas las fechas</div>
                   <div className={clsx("px-2 py-1.5 rounded cursor-pointer hover:bg-blue-50", filterDate === 'overdue' && "bg-blue-50 text-blue-600 font-medium")} onClick={() => setFilterDate('overdue')}>Vencidas</div>
                   <div className={clsx("px-2 py-1.5 rounded cursor-pointer hover:bg-blue-50", filterDate === 'today' && "bg-blue-50 text-blue-600 font-medium")} onClick={() => setFilterDate('today')}>Hoy</div>
                   <div className={clsx("px-2 py-1.5 rounded cursor-pointer hover:bg-blue-50", filterDate === 'tomorrow' && "bg-blue-50 text-blue-600 font-medium")} onClick={() => setFilterDate('tomorrow')}>Mañana</div>
                   <div className={clsx("px-2 py-1.5 rounded cursor-pointer hover:bg-blue-50", filterDate === 'week' && "bg-blue-50 text-blue-600 font-medium")} onClick={() => setFilterDate('week')}>Esta semana</div>
                 </div>
               )}
             </div>
          </div>
        </div>

        {/* Action types filters */}
        <div className="flex items-center gap-3 mt-4 overflow-x-auto pb-1 text-xs font-bold scrollbar-hide">
           <span className={clsx("shrink-0 cursor-pointer px-2 py-1 rounded", filterType === 'all' ? "text-blue-600 bg-blue-50" : "text-gray-700 dark:text-slate-300")} onClick={() => setFilterType('all')}>Todos</span>
           <span className={clsx("shrink-0 px-2 py-1 flex items-center gap-1 cursor-pointer rounded", filterType === 'call' ? "text-blue-600 bg-blue-100" : "text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:bg-slate-900")} onClick={() => setFilterType('call')}><Phone className="w-3 h-3" /> Llamada</span>
           <span className={clsx("shrink-0 px-2 py-1 flex items-center gap-1 cursor-pointer rounded", filterType === 'appointment' ? "text-blue-600 bg-blue-100" : "text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:bg-slate-900")} onClick={() => setFilterType('appointment')}><User className="w-3 h-3" /> Cita</span>
           <span className={clsx("shrink-0 px-2 py-1 flex items-center gap-1 cursor-pointer rounded", filterType === 'test_drive' ? "text-blue-600 bg-blue-100" : "text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:bg-slate-900")} onClick={() => setFilterType('test_drive')}><Car className="w-3 h-3" /> Prueba de manejo</span>
           <span className={clsx("shrink-0 px-2 py-1 flex items-center gap-1 cursor-pointer rounded", filterType === 'signature' ? "text-blue-600 bg-blue-100" : "text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:bg-slate-900")} onClick={() => setFilterType('signature')}><PenTool className="w-3 h-3" /> Firma</span>
           <span className={clsx("shrink-0 px-2 py-1 flex items-center gap-1 cursor-pointer rounded", filterType === 'task' ? "text-blue-600 bg-blue-100" : "text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:bg-slate-900")} onClick={() => setFilterType('task')}><CalendarDays className="w-3 h-3" /> Tarea</span>
           
           <div className="md:ml-auto flex shrink-0 gap-3 text-xs text-gray-500 dark:text-slate-400 border-l border-gray-200 dark:border-slate-700 pl-3">
             <span className={clsx("cursor-pointer", filterStatus === 'pending' ? "text-blue-600 border-b-2 border-blue-600 pb-0.5" : "hover:text-gray-800 dark:text-slate-200")} onClick={() => setFilterStatus(filterStatus === 'pending' ? 'all' : 'pending')}>Pendientes</span>
             <span className={clsx("cursor-pointer hidden sm:inline", filterDate === 'overdue' ? "text-blue-600 border-b-2 border-blue-600 pb-0.5" : "hover:text-gray-800 dark:text-slate-200")} onClick={() => setFilterDate(filterDate === 'overdue' ? 'all' : 'overdue')}>Vencidas</span>
             <span className={clsx("cursor-pointer hidden sm:inline", filterDate === 'today' ? "text-blue-600 border-b-2 border-blue-600 pb-0.5" : "hover:text-gray-800 dark:text-slate-200")} onClick={() => setFilterDate(filterDate === 'today' ? 'all' : 'today')}>Hoy</span>
           </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto bg-white dark:bg-slate-800">
        {view === 'list' && (
          <table className="w-full text-left border-collapse text-sm text-gray-800 dark:text-slate-200">
            <thead className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 text-xs text-gray-700 dark:text-slate-300 font-bold">
              <tr>
                <th className="px-4 py-2 border-r border-gray-200 dark:border-slate-700 w-10 text-center">
                  <input type="checkbox" className="rounded border-gray-300 dark:border-slate-600 dark:bg-slate-700 bg-white dark:checked:bg-blue-500" />
                </th>
                <th className="px-4 py-2 border-r border-gray-200 dark:border-slate-700">Finalizada</th>
                <th className="px-4 py-2 border-r border-gray-200 dark:border-slate-700 w-1/4">Asunto</th>
                <th className="px-4 py-2 border-r border-gray-200 dark:border-slate-700 w-1/5">Trato</th>
                <th className="px-4 py-2 border-r border-gray-200 dark:border-slate-700">Prioridad</th>
                <th className="px-4 py-2 border-r border-gray-200 dark:border-slate-700">Persona de contacto</th>
                <th className="px-4 py-2 border-r border-gray-200 dark:border-slate-700">Correo electrónico</th>
                <th className="px-4 py-2">Teléfono</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800">
              {filteredTasks.map(({ task, client }) => (
                <tr key={task.id} className="border-b border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:bg-slate-900 flex-col md:table-row group">
                  <td className="px-4 py-2 text-center border-r border-gray-100 dark:border-slate-700 text-gray-300">
                    <input type="checkbox" className="rounded border-gray-300 dark:border-slate-600 dark:bg-slate-700 bg-white dark:checked:bg-blue-500 group-hover:border-blue-500" />
                  </td>
                  <td className="px-4 py-2 border-r border-gray-100 dark:border-slate-700 text-center">
                    <button onClick={(e) => { e.stopPropagation(); toggleTask(task.id, task.completed); }} className={clsx("transition-colors", task.completed ? "text-green-500" : "text-gray-300 hover:text-green-500")}>
                      {task.completed ? <CheckCircle className="w-5 h-5 mx-auto" /> : <Circle className="w-5 h-5 mx-auto" />}
                    </button>
                  </td>
                  <td className="px-4 py-2 border-r border-gray-100 dark:border-slate-700 font-bold truncate cursor-pointer hover:text-blue-600" onClick={() => client && setSelectedClient(client)}>
                     <span className={clsx("flex items-center gap-2", task.completed && "line-through text-gray-500 dark:text-slate-400")}>
                       {getTaskIcon(task.title)} {task.title}
                     </span>
                  </td>
                  <td className="px-4 py-2 border-r border-gray-100 dark:border-slate-700 text-blue-600 truncate hover:underline cursor-pointer" onClick={() => client && setSelectedClient(client)}>
                    {client?.name || 'Desconocido'}
                  </td>
                  <td className="px-4 py-2 border-r border-gray-100 dark:border-slate-700">
                    {/* Empty priority for mock */}
                  </td>
                  <td className="px-4 py-2 border-r border-gray-100 dark:border-slate-700 truncate hover:underline cursor-pointer text-gray-600 dark:text-slate-400 border border-gray-200 dark:border-slate-700 rounded px-2 m-1 inline-block">
                    {client?.name || 'Desconocido'}
                  </td>
                  <td className="px-4 py-2 border-r border-gray-100 dark:border-slate-700 truncate text-blue-600 hover:underline cursor-pointer">
                    {client?.email || ''}
                  </td>
                  <td className="px-4 py-2 truncate text-gray-600 dark:text-slate-400 hover:text-blue-600 cursor-pointer">
                    {client?.phone || ''}
                  </td>
                </tr>
              ))}
              {filteredTasks.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-sm font-medium text-gray-500 dark:text-slate-400">
                    No hay actividades para mostrar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {view === 'calendar' && (
          <div className="flex flex-col h-full border-t border-gray-200 dark:border-slate-700">
            {/* Calendar Controls */}
            <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900">
               <div className="flex items-center gap-3">
                 <button 
                  onClick={() => setCalendarMode(calendarMode === 'week' ? 'month' : 'week')}
                  className="px-3 py-1.5 text-xs font-bold border border-gray-300 rounded bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 shadow-sm"
                 >
                   Ver {calendarMode === 'week' ? 'Mes' : 'Semana'}
                 </button>
                 <div className="flex items-center">
                   <button onClick={prevPeriod} className="p-1 border border-r-0 border-gray-300 bg-white dark:bg-slate-800 rounded-l hover:bg-gray-50 dark:bg-slate-900"><ChevronLeft className="w-4 h-4" /></button>
                   <button onClick={() => setCurrentDate(new Date())} className="px-3 py-[3px] text-xs font-bold border border-gray-300 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:bg-slate-900">Hoy</button>
                   <button onClick={nextPeriod} className="p-1 border border-l-0 border-gray-300 bg-white dark:bg-slate-800 rounded-r hover:bg-gray-50 dark:bg-slate-900"><ChevronRight className="w-4 h-4" /></button>
                 </div>
               </div>
               <div className="font-bold text-gray-800 dark:text-slate-200 text-sm">
                 {calendarMode === 'week' ? (
                   `${format(start, "MMM d", {locale: es})} - ${format(end, "MMM d, yyyy", {locale: es})}`
                 ) : (
                   format(start, "MMMM yyyy", {locale: es})
                 )}
               </div>
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-[500px]">
                {/* Calendar Grid Header */}
                <div className="grid grid-cols-7 border-b border-gray-200 bg-white dark:bg-slate-800 shadow-sm z-10 sticky top-0">
                   {['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'].map((d, i) => (
                     <div key={d} className="px-1 md:px-2 py-2 text-[10px] md:text-[11px] font-bold text-gray-500 dark:text-slate-400 border-r border-gray-200 dark:border-slate-700 text-center">
                       {d}
                     </div>
                   ))}
                </div>

                {/* Calendar Grid Body */}
                <div className={clsx("grid grid-cols-7 flex-1 border-r border-gray-200 bg-white dark:bg-slate-800", calendarMode === 'month' && "grid-rows-5")}>
                  {calendarDays.map((day, i) => {
                    const isValidDay = day instanceof Date;
                    const dateStr = isValidDay ? format(day, "yyyy-MM-dd") : '';
                    const dayTasks = filteredTasks.filter(t => t.task.dueDate === dateStr);
                    const isToday = isValidDay && isSameDay(day, today);

                    return (
                      <div key={i} className={clsx("border-b border-l border-gray-200 dark:border-slate-700 p-1 min-h-[100px] md:min-h-[120px] transition-colors relative", !isValidDay && "bg-gray-50 dark:bg-slate-900", isValidDay && "hover:bg-blue-50/20")}>
                        {isValidDay && (
                          <div className="flex flex-col h-full relative">
                            <div className={clsx("text-right text-xs font-bold mb-1 p-1", isToday ? "text-blue-600 bg-blue-100 w-6 h-6 rounded-full flex items-center justify-center ml-auto" : "text-gray-500 dark:text-slate-400")}>
                              {format(day, 'd')}
                            </div>
                            <div className="flex flex-col gap-1 overflow-y-auto max-h-[150px] scrollbar-hide">
                              {dayTasks.map(({task, client}) => (
                                <div 
                                  key={task.id} 
                                  onClick={() => client && setSelectedClient(client)}
                                  className={clsx("text-[9px] md:text-[10px] p-1 rounded truncate font-medium flex items-center gap-1 shadow-sm border", task.completed ? "bg-gray-100 text-gray-500 dark:text-slate-400 border-gray-200 dark:border-slate-700 line-through hover:border-gray-300" : "bg-blue-50 text-blue-700 border-blue-200 cursor-pointer hover:bg-blue-100 hover:border-blue-300")}
                                >
                                   {task.title}
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
          </div>
        )}
      </div>

      {/* New Activity Modal */}
      {showNewTaskModal && (
        <NewActivityModal 
          onClose={() => setShowNewTaskModal(false)}
          clients={clients}
          deals={deals}
          currentUser={userData}
          onSave={async (taskData) => {
            if (!taskData.title || !taskData.dueDate || !userData) {
              if (!taskData.title) alert('El título es requerido');
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
                  alert(err.message || "Error al conectar con Google. Actividad no guardada.");
                  return;
                }
                if (!token) return; // User cancelled popup
              }

              // Create deal if title is provided but it doesn't match an existing one
              if (taskData.dealTitle && !finalDealId) {
                const dealRef = doc(collection(db, 'deals'));
                const newDeal = {
                  id: dealRef.id,
                  agencyId: userData.agencyId || '',
                  clientId: finalClientId || '',
                  title: taskData.dealTitle,
                  status: 'open',
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString()
                };
                await setDoc(dealRef, newDeal);
                finalDealId = dealRef.id;
                setDeals(prev => [...prev, newDeal as Deal]);
              }

              // Update client with new organization if needed
              if (finalClientId && taskData.organization) {
                const c = clients.find(cl => cl.id === finalClientId);
                if (c && c.organization !== taskData.organization) {
                   await updateDoc(doc(db, 'clients', finalClientId), { organization: taskData.organization });
                   setClients(prev => prev.map(cl => cl.id === finalClientId ? { ...cl, organization: taskData.organization } : cl));
                }
              }

              const newRef = doc(collection(db, 'tasks'));
              const tempTask: Task = {
                id: newRef.id,
                agencyId: userData.agencyId || '',
                sellerId: userData.id || '',
                clientId: finalClientId || '',
                dealId: finalDealId || '',
                title: taskData.title,
                dueDate: taskData.dueDate,
                completed: taskData.completed || false,
                createdAt: new Date().toISOString()
              };
              await setDoc(newRef, tempTask);

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

                  try {
                    await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
                      method: 'POST',
                      headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                      },
                      body: JSON.stringify(event)
                    });
                    alert("¡Actividad guardada y evento agregado a tu Calendario de Google con éxito!");
                  } catch (calendarError) {
                    console.error("Error syncing to calendar", calendarError);
                    alert("Actividad guardada, pero ocurrió un error al sincronizar con Google Calendar.");
                  }
                }

              const cl = clients.find(c => c.id === finalClientId) || null;
              setTasks(prev => [...prev, { task: tempTask, client: cl }]);
              setShowNewTaskModal(false);
            } catch (e) {
              console.error("Error creating task", e);
            }
          }}
        />
      )}

      {/* Client Detail Modal when clicking on a task */}
      {selectedClient && (
        <ClientDetailModal
          client={selectedClient}
          onClose={() => setSelectedClient(null)}
        />
      )}
    </div>
  );
}

