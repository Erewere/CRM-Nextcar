import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Client, Vehicle, Task, User } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, PieChart, Pie, Legend } from 'recharts';
import { Users, Car, Target, CheckCircle, TrendingUp, Calendar, Clock, AlertCircle, Filter } from 'lucide-react';
import { isToday, isThisWeek, parseISO, isAfter, startOfDay } from 'date-fns';

import { MasterDashboard } from '../components/MasterDashboard';

export function Dashboard() {
  const { userData } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterSeller, setFilterSeller] = useState<string>('all');
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  // For interactive stage selection
  const [selectedStage, setSelectedStage] = useState<string | null>(null);

  useEffect(() => {
    if (!userData || userData.role === 'master' || userData.id === 'vxFIfZ5bdQSzaekW5d5c1TbNVCO2' || userData.role === 'unassigned') {
      setLoading(false);
      return;
    }

    const fetchStats = async () => {
      try {
        const agencyQuery = where('agencyId', '==', userData.agencyId);
        
        let clientsQ = query(collection(db, 'clients'), agencyQuery);
        let tasksQ = query(collection(db, 'tasks'), agencyQuery);
        let vehiclesQ = query(collection(db, 'vehicles'), agencyQuery);
        let usersQ = query(collection(db, 'users'), agencyQuery);

        if (userData.role === 'seller') {
          clientsQ = query(collection(db, 'clients'), agencyQuery, where('sellerId', '==', userData.id));
          tasksQ = query(collection(db, 'tasks'), agencyQuery, where('sellerId', '==', userData.id));
        }

        const [clientsSnap, vehiclesSnap, tasksSnap, usersSnap] = await Promise.all([
          getDocs(clientsQ),
          getDocs(vehiclesQ),
          getDocs(tasksQ),
          getDocs(usersQ)
        ]);

        setClients(clientsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)));
        setVehicles(vehiclesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Vehicle)));
        setTasks(tasksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task)));
        setUsers(usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as User)));
      } catch (e) {
        console.error("Error fetching dashboard data", e);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [userData]);

  // --- Process Data With Filters ---

  const filteredClients = useMemo(() => {
    return clients.filter(c => {
      if (filterSeller !== 'all' && c.sellerId !== filterSeller) return false;
      
      if (filterStartDate) {
        const clientDate = c.createdAt?.toDate ? c.createdAt.toDate() : new Date(c.createdAt || Date.now());
        if (isAfter(startOfDay(new Date(filterStartDate)), clientDate)) return false;
      }
      if (filterEndDate) {
        const clientDate = c.createdAt?.toDate ? c.createdAt.toDate() : new Date(c.createdAt || Date.now());
        if (isAfter(clientDate, startOfDay(new Date(filterEndDate)))) return false;
      }
      
      if (filterCategory !== 'all') {
        const clientVehicle = vehicles.find(v => v.id === c.vehicleId);
        if (clientVehicle?.bodyType !== filterCategory) return false;
      }
      
      return true;
    });
  }, [clients, filterSeller, filterStartDate, filterEndDate, filterCategory, vehicles]);

  const filteredVehicles = useMemo(() => {
    return vehicles.filter(v => {
      if (filterCategory !== 'all' && v.bodyType !== filterCategory) return false;
      return true;
    });
  }, [vehicles, filterCategory]);

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (filterSeller !== 'all' && t.sellerId !== filterSeller) return false;
      return true;
    });
  }, [tasks, filterSeller]);

  if (loading) return <div>Cargando dashboard...</div>;

  if (userData?.role === 'master' || userData?.id === 'vxFIfZ5bdQSzaekW5d5c1TbNVCO2') {
    return <MasterDashboard />;
  }

  if (userData?.role === 'unassigned') {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 text-center h-[60vh]">
        <Users className="w-16 h-16 text-slate-300 mb-4" />
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">Cuenta en Revisión</h2>
        <p className="text-slate-500 dark:text-slate-400 max-w-sm">
          Tu cuenta ha sido creada exitosamente y se encuentra a la espera de que el administrador principal o la cuenta maestra asigne tu rol y agencia.
        </p>
      </div>
    );
  }
  
  // Contacts
  const wonKeywords = ['ganado', 'won', 'vendid', 'cerrad'];
  const lostKeywords = ['perdid', 'lost'];
  
  const isWon = (status: string = '') => wonKeywords.some(k => (status || '').toLowerCase().includes(k));
  const isLost = (status: string = '') => lostKeywords.some(k => (status || '').toLowerCase().includes(k));
  const isActive = (status: string) => !isWon(status) && !isLost(status);

  const activeContacts = filteredClients.filter(c => isActive(c.status));
  const wonContacts = filteredClients.filter(c => isWon(c.status));
  
  // Inventory
  const availableVehicles = filteredVehicles.filter(v => v.status === 'available' || !v.status);
  
  // Pipeline Stats
  const statusCounts = activeContacts.reduce((acc, c) => {
    acc[c.status] = (acc[c.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const pipelineData = Object.keys(statusCounts).map(status => ({
    name: status,
    total: statusCounts[status]
  })).sort((a, b) => b.total - a.total); // Sort highest first

  // Tasks Insights
  const todayTasks = filteredTasks.filter(t => !t.completed && t.dueDate && isToday(parseISO(t.dueDate)));
  const thisWeekTasks = filteredTasks.filter(t => !t.completed && t.dueDate && isThisWeek(parseISO(t.dueDate)));
  const overdueTasks = filteredTasks.filter(t => !t.completed && t.dueDate && isAfter(startOfDay(new Date()), parseISO(t.dueDate)) && !isToday(parseISO(t.dueDate)));

  // "Hot" leads (Probability of sale in week/month) 
  // Let's assume contacts in advanced stages (e.g. 'propuesta', 'demostracion') or with tasks this week are higher probability.
  const hotLeads = activeContacts.filter(c => {
    const hasActiveTask = thisWeekTasks.some(t => t.clientId === c.id);
    const inAdvancedStage = c.status ? (c.status.toLowerCase().includes('propuest') || c.status.toLowerCase().includes('demostra') || c.status.toLowerCase().includes('negocia')) : false;
    return hasActiveTask || inAdvancedStage;
  });

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#64748b'];

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-200 tracking-tight">Resumen Ejecutivo</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Métricas clave y estado de tus ventas</p>
        </div>

        {/* Dynamic Filters */}
        <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center gap-2 pl-2 border-r border-slate-200 dark:border-slate-700 pr-3">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">Filtros</span>
          </div>

          {userData?.role === 'admin' && (
            <select 
              className="px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm rounded-md focus:outline-none focus:border-blue-500 text-slate-700 dark:text-slate-300"
              value={filterSeller}
              onChange={e => setFilterSeller(e.target.value)}
            >
              <option value="all">Todos los vendedores</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          )}

          <select 
            className="px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm rounded-md focus:outline-none focus:border-blue-500 text-slate-700 dark:text-slate-300 max-w-[180px] truncate"
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
          >
            <option value="all">Todas las categorías</option>
            {Array.from(new Set(vehicles.map(v => v.bodyType).filter(Boolean))).map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>

          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1">
            <span className="text-xs text-slate-400 font-medium">Desde</span>
            <input 
              type="date"
              className="bg-transparent text-sm focus:outline-none text-slate-700 dark:text-slate-300"
              value={filterStartDate}
              onChange={e => setFilterStartDate(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1">
            <span className="text-xs text-slate-400 font-medium">Hasta</span>
            <input 
              type="date"
              className="bg-transparent text-sm focus:outline-none text-slate-700 dark:text-slate-300"
              value={filterEndDate}
              onChange={e => setFilterEndDate(e.target.value)}
            />
          </div>
          
          {(filterSeller !== 'all' || filterCategory !== 'all' || filterStartDate || filterEndDate) && (
            <button 
              onClick={() => {
                setFilterSeller('all');
                setFilterCategory('all');
                setFilterStartDate('');
                setFilterEndDate('');
              }}
              className="text-xs underline text-slate-400 hover:text-slate-600 dark:text-slate-400 px-2"
            >
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Primary KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between hover:border-blue-300 transition-colors">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Contactos Abiertos</p>
            <p className="text-3xl font-bold text-slate-800 dark:text-slate-200">{activeContacts.length}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
            <Users className="w-5 h-5 text-blue-600" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between hover:border-emerald-300 transition-colors">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Inventario Disponible</p>
            <p className="text-3xl font-bold text-slate-800 dark:text-slate-200">{availableVehicles.length}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
            <Car className="w-5 h-5 text-emerald-600" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between hover:border-amber-300 transition-colors">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Oportunidades ('Hot')</p>
            <p className="text-3xl font-bold text-slate-800 dark:text-slate-200">{hotLeads.length}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center">
            <Target className="w-5 h-5 text-amber-600" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between hover:border-green-300 transition-colors">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Ventas Cerradas</p>
            <p className="text-3xl font-bold text-slate-800 dark:text-slate-200">{wonContacts.length}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-green-600" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Embudo de Ventas Interactivo */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Contactos por Etapa Activa</h3>
            {selectedStage && (
              <button 
                onClick={() => setSelectedStage(null)}
                className="text-xs text-blue-600 bg-blue-50 px-3 py-1 rounded-full font-medium hover:bg-blue-100"
              >
                Ver Todas
              </button>
            )}
          </div>
          <div className="flex-1 min-h-[300px]">
            {pipelineData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pipelineData} onClick={(data: any) => {
                  if (data && data.activePayload && data.activePayload.length > 0) {
                    setSelectedStage(data.activePayload[0].payload.name);
                  }
                }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                  <Tooltip 
                    cursor={{fill: '#f8fafc'}} 
                    contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} 
                  />
                  <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                    {pipelineData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={selectedStage === entry.name || !selectedStage ? COLORS[index % COLORS.length] : '#cbd5e1'} 
                        className="cursor-pointer transition-all duration-300"
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400">
                No hay contactos activos.
              </div>
            )}
          </div>
        </div>

        {/* Action Center (Tasks) */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col overflow-hidden">
          <div className="p-5 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600" />
              Centro de Atención
            </h3>
          </div>
          <div className="p-5 flex-1 space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-rose-50 border border-rose-100">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-rose-500" />
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Tareas Atrasadas</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Requieren atención urgente</p>
                </div>
              </div>
              <span className="text-rose-600 font-black text-xl">{overdueTasks.length}</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50 border border-blue-100">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-blue-500" />
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Para Hoy</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Actividades programadas</p>
                </div>
              </div>
              <span className="text-blue-600 font-black text-xl">{todayTasks.length}</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Esta Semana</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Tareas futuras próximas</p>
                </div>
              </div>
              <span className="text-slate-600 dark:text-slate-400 font-black text-xl">{thisWeekTasks.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Drill-down view if a stage is selected */}
      {selectedStage && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-blue-200 shadow-md">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
             Prospectos en la etapa: <span className="text-blue-600">"{selectedStage}"</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeContacts.filter(c => c.status === selectedStage).map(client => (
              <div key={client.id} className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg hover:shadow-sm transition-shadow">
                <p className="font-bold text-slate-800 dark:text-slate-200">{client.name}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{client.vehicle || 'Sin vehículo de interés'}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-slate-400">{client.origin}</span>
                  <button className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded font-medium">Cerrar trato</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

