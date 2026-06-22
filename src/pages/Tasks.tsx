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
  Mail, Coffee, ChevronLeft, ChevronRight, X, AlertCircle, ChevronDown, Filter
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

  const getTaskIcon = (title: string) => {
    const t = title.toLowerCase();
    if (t.includes('llama')) return <Phone className="w-3.5 h-3.5" />;
    if (t.includes('reunió')) return <Video className="w-3.5 h-3.5" />;
    if (t.includes('correo')) return <Mail className="w-3.5 h-3.5" />;
    if (t.includes('comida')) return <Coffee className="w-3.5 h-3.5" />;
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
    if (filterType === 'all') return true;
    
    // Very basic filter logic based on title string matching (since Tasks don't have an explicit 'type' field yet)
    const t = task.title.toLowerCase();
    switch (filterType) {
      case 'call': return t.includes('llama');
      case 'meeting': return t.includes('reunió') || t.includes('junta') || t.includes('meet');
      case 'email': return t.includes('correo') || t.includes('email');
      case 'lunch': return t.includes('comida') || t.includes('almuerzo');
      case 'deadline': return t.includes('plazo') || t.includes('deadline');
      case 'task': return !t.includes('llama') && !t.includes('reunió') && !t.includes('correo') && !t.includes('comida') && !t.includes('plazo'); // Default task
      default: return true;
    }
  });

  if (loading) return <div className="flex h-screen items-center justify-center">Cargando...</div>;

  return (
    <div className="flex flex-col h-full bg-[#f4f5f5]">
      {/* Header and filters */}
      <div className="px-6 py-4 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-800">Acciones</h1>
            <AlertCircle className="w-4 h-4 text-gray-400" />
          </div>
        </div>

        {/* Sync alert mock removed for now */}

        {/* Controls bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            
            <div className="flex items-center bg-white border border-gray-300 rounded shadow-sm overflow-hidden h-8 shrink-0">
              <button 
                onClick={() => setView('list')}
                className={clsx("px-3 h-full flex items-center justify-center", view === 'list' ? 'bg-gray-100 text-blue-600' : 'text-gray-500 hover:bg-gray-50')}
              >
                <ListIcon className="w-4 h-4" />
              </button>
              <div className="w-px h-full bg-gray-300" />
              <button 
                onClick={() => setView('calendar')}
                className={clsx("px-3 h-full flex items-center justify-center", view === 'calendar' ? 'bg-gray-100 text-blue-600' : 'text-gray-500 hover:bg-gray-50')}
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
             <span className="text-xs font-semibold text-gray-500">{tasks.length} actividades</span>
             <span className="text-[10px] font-bold text-red-500 border border-red-200 bg-red-50 px-2 py-0.5 rounded-full uppercase">Sincronización Inactiva</span>
             <button className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold border border-gray-300 rounded hover:bg-gray-50 shadow-sm text-gray-700 ml-auto sm:ml-0">
               <Filter className="w-3.5 h-3.5" /> Filtro
             </button>
          </div>
        </div>

        {/* Action types filters */}
        <div className="flex items-center gap-3 mt-4 overflow-x-auto pb-1 text-xs font-bold scrollbar-hide">
           <span className={clsx("shrink-0 cursor-pointer px-2 py-1 rounded", filterType === 'all' ? "text-blue-600 bg-blue-50" : "text-gray-700")} onClick={() => setFilterType('all')}>Todos</span>
           <span className={clsx("shrink-0 px-2 py-1 flex items-center gap-1 cursor-pointer rounded", filterType === 'call' ? "text-blue-600 bg-blue-100" : "text-gray-600 hover:bg-gray-50")} onClick={() => setFilterType('call')}><Phone className="w-3 h-3" /> Llamada</span>
           <span className={clsx("shrink-0 px-2 py-1 flex items-center gap-1 cursor-pointer rounded", filterType === 'meeting' ? "text-blue-600 bg-blue-100" : "text-gray-600 hover:bg-gray-50")} onClick={() => setFilterType('meeting')}><Video className="w-3 h-3" /> Reunión</span>
           <span className={clsx("shrink-0 px-2 py-1 flex items-center gap-1 cursor-pointer rounded", filterType === 'task' ? "text-blue-600 bg-blue-100" : "text-gray-600 hover:bg-gray-50")} onClick={() => setFilterType('task')}><CalendarDays className="w-3 h-3" /> Tarea</span>
           <span className={clsx("shrink-0 px-2 py-1 flex items-center gap-1 cursor-pointer rounded", filterType === 'deadline' ? "text-blue-600 bg-blue-100" : "text-gray-600 hover:bg-gray-50")} onClick={() => setFilterType('deadline')}><Flag className="w-3 h-3" /> Plazo</span>
           <span className={clsx("shrink-0 px-2 py-1 flex items-center gap-1 cursor-pointer rounded", filterType === 'email' ? "text-blue-600 bg-blue-100" : "text-gray-600 hover:bg-gray-50")} onClick={() => setFilterType('email')}><Mail className="w-3 h-3" /> Correo</span>
           <span className={clsx("shrink-0 px-2 py-1 flex items-center gap-1 cursor-pointer rounded", filterType === 'lunch' ? "text-blue-600 bg-blue-100" : "text-gray-600 hover:bg-gray-50")} onClick={() => setFilterType('lunch')}><Coffee className="w-3 h-3" /> Comida</span>
           
           <div className="md:ml-auto flex shrink-0 gap-3 text-xs text-gray-500 border-l border-gray-200 pl-3">
             <span className="text-blue-600 border-b-2 border-blue-600 pb-0.5 cursor-pointer">Pendientes</span>
             <span className="hover:text-gray-800 cursor-pointer hidden sm:inline">Vencidas</span>
             <span className="hover:text-gray-800 cursor-pointer hidden sm:inline">Hoy</span>
           </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto bg-white">
        {view === 'list' && (
          <table className="w-full text-left border-collapse text-sm text-gray-800">
            <thead className="bg-white border-b border-gray-200 text-xs text-gray-700 font-bold">
              <tr>
                <th className="px-4 py-2 border-r border-gray-200 w-10 text-center">
                  <input type="checkbox" className="rounded border-gray-300" />
                </th>
                <th className="px-4 py-2 border-r border-gray-200">Finalizada</th>
                <th className="px-4 py-2 border-r border-gray-200 w-1/4">Asunto</th>
                <th className="px-4 py-2 border-r border-gray-200 w-1/5">Trato</th>
                <th className="px-4 py-2 border-r border-gray-200">Prioridad</th>
                <th className="px-4 py-2 border-r border-gray-200">Persona de contacto</th>
                <th className="px-4 py-2 border-r border-gray-200">Correo electrónico</th>
                <th className="px-4 py-2">Teléfono</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {filteredTasks.map(({ task, client }) => (
                <tr key={task.id} className="border-b border-gray-100 hover:bg-gray-50 flex-col md:table-row group">
                  <td className="px-4 py-2 text-center border-r border-gray-100 text-gray-300">
                    <input type="checkbox" className="rounded border-gray-300 group-hover:border-blue-500" />
                  </td>
                  <td className="px-4 py-2 border-r border-gray-100 text-center">
                    <button onClick={(e) => { e.stopPropagation(); toggleTask(task.id, task.completed); }} className={clsx("transition-colors", task.completed ? "text-green-500" : "text-gray-300 hover:text-green-500")}>
                      {task.completed ? <CheckCircle className="w-5 h-5 mx-auto" /> : <Circle className="w-5 h-5 mx-auto" />}
                    </button>
                  </td>
                  <td className="px-4 py-2 border-r border-gray-100 font-bold truncate cursor-pointer hover:text-blue-600" onClick={() => client && setSelectedClient(client)}>
                     <span className={clsx("flex items-center gap-2", task.completed && "line-through text-gray-500")}>
                       {getTaskIcon(task.title)} {task.title}
                     </span>
                  </td>
                  <td className="px-4 py-2 border-r border-gray-100 text-blue-600 truncate hover:underline cursor-pointer" onClick={() => client && setSelectedClient(client)}>
                    {client?.name || 'Desconocido'}
                  </td>
                  <td className="px-4 py-2 border-r border-gray-100">
                    {/* Empty priority for mock */}
                  </td>
                  <td className="px-4 py-2 border-r border-gray-100 truncate hover:underline cursor-pointer text-gray-600 border border-gray-200 rounded px-2 m-1 inline-block">
                    {client?.name || 'Desconocido'}
                  </td>
                  <td className="px-4 py-2 border-r border-gray-100 truncate text-blue-600 hover:underline cursor-pointer">
                    {client?.email || ''}
                  </td>
                  <td className="px-4 py-2 truncate text-gray-600 hover:text-blue-600 cursor-pointer">
                    {client?.phone || ''}
                  </td>
                </tr>
              ))}
              {filteredTasks.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-sm font-medium text-gray-500">
                    No hay actividades para mostrar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {view === 'calendar' && (
          <div className="flex flex-col h-full border-t border-gray-200">
            {/* Calendar Controls */}
            <div className="flex items-center justify-between p-3 border-b border-gray-200 bg-gray-50">
               <div className="flex items-center gap-3">
                 <button 
                  onClick={() => setCalendarMode(calendarMode === 'week' ? 'month' : 'week')}
                  className="px-3 py-1.5 text-xs font-bold border border-gray-300 rounded bg-white hover:bg-gray-100 shadow-sm"
                 >
                   Ver {calendarMode === 'week' ? 'Mes' : 'Semana'}
                 </button>
                 <div className="flex items-center">
                   <button onClick={prevPeriod} className="p-1 border border-r-0 border-gray-300 bg-white rounded-l hover:bg-gray-50"><ChevronLeft className="w-4 h-4" /></button>
                   <button onClick={() => setCurrentDate(new Date())} className="px-3 py-[3px] text-xs font-bold border border-gray-300 bg-white hover:bg-gray-50">Hoy</button>
                   <button onClick={nextPeriod} className="p-1 border border-l-0 border-gray-300 bg-white rounded-r hover:bg-gray-50"><ChevronRight className="w-4 h-4" /></button>
                 </div>
               </div>
               <div className="font-bold text-gray-800 text-sm">
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
                <div className="grid grid-cols-7 border-b border-gray-200 bg-white shadow-sm z-10 sticky top-0">
                   {['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'].map((d, i) => (
                     <div key={d} className="px-1 md:px-2 py-2 text-[10px] md:text-[11px] font-bold text-gray-500 border-r border-gray-200 text-center">
                       {d}
                     </div>
                   ))}
                </div>

                {/* Calendar Grid Body */}
                <div className={clsx("grid grid-cols-7 flex-1 border-r border-gray-200 bg-white", calendarMode === 'month' && "grid-rows-5")}>
                  {calendarDays.map((day, i) => {
                    const isValidDay = day instanceof Date;
                    const dateStr = isValidDay ? format(day, "yyyy-MM-dd") : '';
                    const dayTasks = filteredTasks.filter(t => t.task.dueDate === dateStr);
                    const isToday = isValidDay && isSameDay(day, today);

                    return (
                      <div key={i} className={clsx("border-b border-l border-gray-200 p-1 min-h-[100px] md:min-h-[120px] transition-colors relative", !isValidDay && "bg-gray-50", isValidDay && "hover:bg-blue-50/20")}>
                        {isValidDay && (
                          <div className="flex flex-col h-full relative">
                            <div className={clsx("text-right text-xs font-bold mb-1 p-1", isToday ? "text-blue-600 bg-blue-100 w-6 h-6 rounded-full flex items-center justify-center ml-auto" : "text-gray-500")}>
                              {format(day, 'd')}
                            </div>
                            <div className="flex flex-col gap-1 overflow-y-auto max-h-[150px] scrollbar-hide">
                              {dayTasks.map(({task, client}) => (
                                <div 
                                  key={task.id} 
                                  onClick={() => client && setSelectedClient(client)}
                                  className={clsx("text-[9px] md:text-[10px] p-1 rounded truncate font-medium flex items-center gap-1 shadow-sm border", task.completed ? "bg-gray-100 text-gray-500 border-gray-200 line-through hover:border-gray-300" : "bg-blue-50 text-blue-700 border-blue-200 cursor-pointer hover:bg-blue-100 hover:border-blue-300")}
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

              if (taskData.syncToCalendar) {
                let token = googleToken;
                if (!token) {
                  token = await connectGoogleServices();
                }
                
                if (token) {
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

