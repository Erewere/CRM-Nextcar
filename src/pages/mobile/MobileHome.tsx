import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Task, Client, PipelineStage, Vehicle } from "../../types";
import { format, isBefore, startOfToday } from "date-fns";
import { es } from "date-fns/locale";
import { 
  CheckCircle, Circle, Clock, Phone, Calendar, MessageCircle, FileText, 
  AlertCircle, TrendingUp, Star, Zap, ChevronRight, Activity, Flame, Car,
  DollarSign, Award, ShieldAlert, UserCheck, BarChart2, ArrowUpRight, Users, Target, Briefcase, Sparkles,
  ExternalLink, MessageSquare, BadgeCheck
} from "lucide-react";
import clsx from "clsx";
import { AiAdvisorPanel } from "../../components/AiAdvisorPanel";
import { getClientMatches } from "../../services/matchingEngine";
import { useSharedInventoryMatches } from "../../hooks/useSharedInventoryMatches";
import { VehicleDetailModal } from "../../components/VehicleDetailModal";

const getWantedTitle = (c: Client) => {
  if (c.wantedVehicle && (c.wantedVehicle.make || c.wantedVehicle.model || (c.wantedVehicle.bodyType && c.wantedVehicle.bodyType !== 'Cualquiera'))) {
    return [c.wantedVehicle.make, c.wantedVehicle.model, c.wantedVehicle.bodyType !== 'Cualquiera' ? c.wantedVehicle.bodyType : ''].filter(Boolean).join(" ");
  }
  return c.vehicle || c.dealTitle || "Auto no especificado";
};

interface MobileHomeProps {
  userName: string;
  agencyId: string;
  agencyName?: string;
  clients: Client[];
  activeContacts: Client[];
  buscanAutoClients?: Client[];
  tasks: Task[];
  pipelineStages: PipelineStage[];
  onSelectClient: (client: Client) => void;
  userRole?: string;
  clientsWithScores?: any[];
  sellerPerformance?: any[];
  conversionRate?: number;
  totalWonAmount?: number;
  totalProfit?: number;
  inactiveAlerts?: any[];
  allClientMatches?: number;
  vehicles?: any[];
}

const typeIcons: Record<string, any> = {
  call: Phone,
  meeting: Calendar,
  whatsapp: MessageCircle,
  email: FileText,
  other: Clock,
};

export function MobileHome({ 
  userName, 
  agencyId, 
  agencyName, 
  clients = [], 
  activeContacts = [], 
  buscanAutoClients = [],
  tasks = [], 
  pipelineStages = [],
  onSelectClient,
  userRole = "seller",
  clientsWithScores = [],
  sellerPerformance = [],
  conversionRate = 0,
  totalWonAmount = 0,
  totalProfit = 0,
  inactiveAlerts = [],
  allClientMatches = 0,
  vehicles = []
}: MobileHomeProps) {
  
  const navigate = useNavigate();
  const [currentTime] = useState(new Date());
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  // Shared matches state
  const { ownAgencySharing, matches, loading: matchesLoading } = useSharedInventoryMatches();
  const [selectedSharedVehicle, setSelectedSharedVehicle] = useState<Vehicle | null>(null);
  const [selectedSharedClient, setSelectedSharedClient] = useState<Client | null>(null);

  const greeting = useMemo(() => {
    const hour = currentTime.getHours();
    if (hour < 12) return "Buenos días";
    if (hour < 19) return "Buenas tardes";
    return "Buenas noches";
  }, [currentTime]);

  const formattedDate = format(currentTime, "EEEE, d 'de' MMMM", { locale: es });

  const isAdmin = userRole === "admin";

  const {
    todayFollowUps,
    todayMeetings,
    overdueTasks,
  } = useMemo(() => {
    const todayStr = format(currentTime, "yyyy-MM-dd");
    const todayDate = startOfToday();

    const pendingTasks = tasks.filter(t => !t.completed && t.clientId);
    
    // Tareas de hoy (seguimientos) - excluye meetings
    const followUps = pendingTasks.filter(t => t.dueDate === todayStr && t.type !== "meeting");
    
    // Citas de hoy
    const meetings = pendingTasks.filter(t => t.dueDate === todayStr && t.type === "meeting");

    // Tareas vencidas
    const overdue = pendingTasks.filter(t => t.dueDate && isBefore(new Date(t.dueDate + "T00:00:00"), todayDate));

    return {
      todayFollowUps: followUps,
      todayMeetings: meetings,
      overdueTasks: overdue,
    };
  }, [tasks, currentTime]);

  const availableVehicles = useMemo(() => {
    return (vehicles || []).filter(v => v.status === "available");
  }, [vehicles]);

  const getClientName = (clientId?: string) => {
    if (!clientId) return "";
    const client = clients.find(c => c.id === clientId);
    return client ? client.name : "";
  };

  const handleTaskClick = (clientId?: string) => {
    if (!clientId) return;
    const client = clients.find(c => c.id === clientId);
    if (client) {
      onSelectClient(client);
    }
  };

  // Funnel calculated dynamically
  const funnelData = useMemo(() => {
    const total = clients.length;
    const active = activeContacts.length;
    const closing = activeContacts.filter((c) => {
      const st = String(c.status || "").toLowerCase();
      return st.includes("propuesta") || st.includes("demostracion") || st.includes("negociacion");
    }).length;
    const won = clients.filter(c => c.status === "won" || c.status === "Ganado").length;

    const maxVal = Math.max(total, 1);

    return [
      { name: 'Prospectos', value: total, percent: Math.round((total / maxVal) * 100), color: 'bg-blue-500' },
      { name: 'En Seguimiento', value: active, percent: Math.round((active / maxVal) * 100), color: 'bg-indigo-500' },
      { name: 'En Cierre', value: closing, percent: Math.round((closing / maxVal) * 100), color: 'bg-amber-500' },
      { name: 'Cerrados', value: won, percent: Math.round((won / maxVal) * 100), color: 'bg-emerald-500' },
    ];
  }, [clients, activeContacts]);

  return (
    <div className="flex flex-col h-full overflow-y-auto pb-24 bg-slate-50 dark:bg-slate-900">
      {/* Dynamic Role-Based Header */}
      <div className="px-5 pt-6 pb-4 bg-slate-900 text-white shadow-md sticky top-0 z-20 border-b border-slate-850">
        <div className="flex justify-between items-center">
          <div>
            <span className={clsx(
              "text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full border",
              isAdmin 
                ? "bg-indigo-950/80 border-indigo-900 text-indigo-400" 
                : "bg-emerald-950/80 border-emerald-900 text-emerald-400"
            )}>
              {isAdmin ? "Panel Consolidado • Admin" : "Asesor Comercial"}
            </span>
            <h1 className="text-xl font-black text-white tracking-tight mt-1">
              {greeting}, <span className={clsx(isAdmin ? "text-indigo-400" : "text-emerald-400")}>{userName.split(' ')[0]}</span>
            </h1>
          </div>
          <div className="flex items-center gap-1 bg-slate-800 border border-slate-700/50 rounded-full px-3 py-1">
            <Activity className={clsx("w-3 h-3 animate-pulse", isAdmin ? "text-indigo-400" : "text-emerald-400")} />
            <span className="text-[10px] font-bold text-slate-300">Vivo</span>
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-1 capitalize font-medium">
          {formattedDate} {agencyName ? ` • ${agencyName}` : ''}
        </p>
      </div>

      <div className="p-4 space-y-6">
        
        {isAdmin ? (
          /* ========================================================================= */
          /* 1. ADMINISTRATOR MOBILE VIEW                                              */
          /* ========================================================================= */
          <div className="space-y-6">
            
            {/* Admin Metrics Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center mb-2">
                    <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Ingresos Totales</p>
                  <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 mt-1 truncate">
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(totalWonAmount)}
                  </h3>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center mb-2">
                    <TrendingUp className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Utilidad Bruta</p>
                  <h3 className="text-sm font-black text-indigo-600 dark:text-indigo-400 mt-1 truncate">
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(totalProfit)}
                  </h3>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center mb-2">
                    <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Leads Totales</p>
                  <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 mt-1">
                    {clients.length} <span className="text-[10px] text-slate-400 font-normal">leads</span>
                  </h3>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="w-7 h-7 rounded-lg bg-orange-50 dark:bg-orange-950/30 flex items-center justify-center mb-2">
                    <Target className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                  </div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tasa Cierre</p>
                  <h3 className="text-sm font-black text-orange-600 dark:text-orange-400 mt-1">
                    {conversionRate}%
                  </h3>
                </div>
              </div>
            </div>

            {/* Advisor Performance Mobile List */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-indigo-500" />
                <h2 className="text-base font-black text-slate-800 dark:text-white">Rendimiento de Asesores</h2>
              </div>
              <div className="space-y-2.5">
                {sellerPerformance.map((seller) => (
                  <div key={seller.id} className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
                    <div className="flex items-center gap-3">
                      {seller.photoURL ? (
                        <img src={seller.photoURL} alt={seller.name} className="w-9 h-9 rounded-full object-cover border border-slate-200" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 text-white font-bold flex items-center justify-center text-xs shadow-inner">
                          {seller.name.substring(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <h4 className="font-extrabold text-slate-900 dark:text-white text-sm">{seller.name}</h4>
                        <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Tasa Cierre: {seller.conversionRate}%</span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2 pt-2.5 border-t border-slate-100 dark:border-slate-750 text-center">
                      <div>
                        <p className="text-[9px] text-slate-400 font-bold uppercase">Cierres</p>
                        <p className="text-xs font-black text-slate-800 dark:text-slate-200 mt-0.5">{seller.wonClients} de {seller.totalClients}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-slate-400 font-bold uppercase">Ventas</p>
                        <p className="text-xs font-black text-slate-900 dark:text-slate-100 mt-0.5 truncate">
                          {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(seller.revenue)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] text-slate-400 font-bold uppercase">Utilidad</p>
                        <p className="text-xs font-black text-indigo-500 mt-0.5 truncate">
                          {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(seller.profit)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
                {sellerPerformance.length === 0 && (
                  <p className="text-xs text-slate-400 italic text-center py-4">No hay asesores en la agencia.</p>
                )}
              </div>
            </section>

            {/* Embudo Comercial Horizontal Progress */}
            <section className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-1.5">
                  <BarChart2 className="w-4 h-4 text-indigo-500" />
                  Embudo Comercial Consolidador
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Distribución proporcional de leads por etapa</p>
              </div>

              <div className="space-y-3">
                {funnelData.map((stage, idx) => (
                  <div key={`stage-${idx}`} className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="font-bold text-slate-700 dark:text-slate-300">{stage.name}</span>
                      <span className="font-black text-slate-900 dark:text-slate-100">{stage.value} leads <span className="text-[10px] text-slate-400">({stage.percent}%)</span></span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2">
                      <div className={clsx("h-2 rounded-full", stage.color)} style={{ width: `${stage.percent}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Admin Lead Intelligence (Scores Across Agency) */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-indigo-500 fill-indigo-500/10" />
                <h2 className="text-base font-black text-slate-800 dark:text-white">Lead Intelligence General</h2>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm divide-y divide-slate-100 dark:divide-slate-750">
                {clientsWithScores.slice(0, 5).map((client) => {
                  const sellerObj = sellerPerformance.find(s => s.id === client.sellerId);
                  return (
                    <div 
                      key={`admin-lead-${client.id}`}
                      onClick={() => onSelectClient(client)}
                      className="p-4 flex items-center justify-between active:bg-slate-50 dark:active:bg-slate-700/50 cursor-pointer"
                    >
                      <div className="min-w-0 flex-1 pr-3">
                        <div className="flex items-center gap-1.5">
                          <span className={clsx("w-2 h-2 rounded-full shrink-0", 
                            client.leadScore >= 75 ? "bg-emerald-500" : client.leadScore >= 45 ? "bg-amber-500" : "bg-slate-400"
                          )} />
                          <h4 className="font-extrabold text-slate-900 dark:text-white text-sm truncate">{client.name}</h4>
                        </div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1 truncate">
                          {getWantedTitle(client)}
                        </p>
                        <p className="text-[9px] text-slate-400 mt-1">
                          Asesor: <span className="font-bold text-slate-600 dark:text-slate-300">{sellerObj?.name || "Sin Asignar"}</span>
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className={clsx(
                          "inline-block font-black text-xs px-2 py-0.5 rounded-full text-white",
                          client.leadScore >= 75 ? "bg-emerald-500" : client.leadScore >= 45 ? "bg-amber-500" : "bg-slate-400"
                        )}>
                          Score: {client.leadScore}
                        </span>
                        <span className="block text-[8px] font-black uppercase text-slate-400 tracking-wider mt-1">
                          Prob. {client.probabilityCategory}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {clientsWithScores.length === 0 && (
                  <p className="text-xs text-slate-400 italic text-center py-6">No hay prospectos activos con Lead Score calculado.</p>
                )}
              </div>
            </section>

            {/* Admin Inactivity Alerts */}
            {inactiveAlerts.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-red-500" />
                  <h2 className="text-base font-black text-slate-800 dark:text-white">Alertas de Inactividad</h2>
                </div>
                <div className="space-y-2">
                  {inactiveAlerts.slice(0, 4).map((alert, index) => {
                    const sellerObj = sellerPerformance.find(s => s.id === alert.task.sellerId);
                    return (
                      <div key={`admin-alert-${alert.task.id}-${index}`} className="p-3 bg-red-50/50 dark:bg-red-950/10 border border-red-100 dark:border-red-900/30 rounded-2xl flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-black text-slate-900 dark:text-slate-200 line-clamp-1">{alert.task.title}</p>
                          <p className="text-[10px] text-slate-500 mt-1">
                            Cliente: <span className="font-bold text-slate-700 dark:text-slate-300">{alert.client?.name || "N/A"}</span>
                          </p>
                          <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/50 text-[9px] text-slate-400">
                            <span>Vence: {alert.task.dueDate}</span>
                            <span className="font-bold text-red-600 dark:text-red-400">Asesor: {sellerObj?.name || "Asesor"}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

          </div>
        ) : (
          /* ========================================================================= */
          /* 2. ADVISOR / SELLER MOBILE VIEW                                           */
          /* ========================================================================= */
          <div className="space-y-6">
            
            {/* Advisor Metrics Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center mb-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Mis Cierres</p>
                  <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 mt-1">
                    {clients.filter(c => c.status === "won" || c.status === "Ganado").length}
                  </h3>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center mb-2">
                    <DollarSign className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Mis Ventas</p>
                  <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 mt-1 truncate">
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(totalWonAmount)}
                  </h3>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center mb-2">
                    <Target className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Prospectos Activos</p>
                  <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 mt-1">
                    {activeContacts.length}
                  </h3>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="w-7 h-7 rounded-lg bg-orange-50 dark:bg-orange-950/30 flex items-center justify-center mb-2">
                    <Sparkles className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                  </div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Coincidencias</p>
                  <h3 className="text-xl font-black text-orange-600 dark:text-orange-400 mt-1">
                    {allClientMatches}
                  </h3>
                </div>
              </div>
            </div>

            {/* Lead Intelligence (Mis Prospectos Calientes - Accordion list with detailed score factor visualizer) */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-indigo-500 fill-indigo-500/10" />
                <h2 className="text-base font-black text-slate-800 dark:text-white">Mis Prospectos Calientes</h2>
              </div>
              
              <div className="space-y-3">
                {clientsWithScores.slice(0, 5).map((client) => {
                  const isSelected = selectedLeadId === client.id;
                  return (
                    <div 
                      key={`seller-lead-${client.id}`} 
                      className={clsx(
                        "bg-white dark:bg-slate-800 rounded-2xl border transition-all duration-250 shadow-sm",
                        isSelected 
                          ? "border-indigo-500 dark:border-indigo-500 ring-2 ring-indigo-500/10" 
                          : "border-slate-200 dark:border-slate-700 hover:border-slate-300"
                      )}
                    >
                      {/* Main Summary Header of Card */}
                      <div 
                        onClick={() => setSelectedLeadId(isSelected ? null : client.id)}
                        className="p-4 flex items-center justify-between cursor-pointer"
                      >
                        <div className="min-w-0 flex-1 pr-3">
                          <div className="flex items-center gap-1.5">
                            <span className={clsx(
                              "w-2 h-2 rounded-full shrink-0",
                              client.leadScore >= 75 ? "bg-emerald-500 animate-pulse" : client.leadScore >= 45 ? "bg-amber-500" : "bg-slate-400"
                            )} />
                            <h4 className="font-extrabold text-slate-900 dark:text-white text-sm truncate">{client.name}</h4>
                          </div>
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1 truncate">
                            Busca: <span className="text-slate-800 dark:text-slate-200 font-extrabold">{getWantedTitle(client)}</span>
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-right">
                            <span className={clsx(
                              "inline-block font-black text-xs px-2.5 py-1 rounded-full text-white shadow-sm",
                              client.leadScore >= 75 ? "bg-emerald-500" : client.leadScore >= 45 ? "bg-amber-500" : "bg-slate-400"
                            )}>
                              {client.leadScore} Pts
                            </span>
                          </div>
                          <ChevronRight className={clsx(
                            "w-4 h-4 text-slate-400 transition-transform",
                            isSelected && "rotate-95 text-indigo-500"
                          )} />
                        </div>
                      </div>

                      {/* Expanded Factor Score Details */}
                      {isSelected && (
                        <div className="px-4 pb-4 pt-2 border-t border-slate-100 dark:border-slate-750 space-y-3 bg-slate-50/50 dark:bg-slate-850/30 rounded-b-2xl animate-fadeIn">
                          <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Factores del Lead Score:</div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                            <div className="space-y-1">
                              <div className="flex justify-between text-[10px] text-slate-500">
                                <span>Perfil Completo</span>
                                <span className="font-bold text-slate-700 dark:text-slate-300">{client.scoreDetails?.factors.profileCompleteness || 0}/25</span>
                              </div>
                              <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                                <div className="bg-blue-500 h-full rounded-full" style={{ width: `${((client.scoreDetails?.factors.profileCompleteness || 0)/25)*100}%` }} />
                              </div>
                            </div>

                            <div className="space-y-1">
                              <div className="flex justify-between text-[10px] text-slate-500">
                                <span>Presupuesto</span>
                                <span className="font-bold text-slate-700 dark:text-slate-300">{client.scoreDetails?.factors.budget || 0}/20</span>
                              </div>
                              <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                                <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${((client.scoreDetails?.factors.budget || 0)/20)*100}%` }} />
                              </div>
                            </div>

                            <div className="space-y-1">
                              <div className="flex justify-between text-[10px] text-slate-500">
                                <span>Fase Pipeline</span>
                                <span className="font-bold text-slate-700 dark:text-slate-300">{client.scoreDetails?.factors.urgency || 0}/25</span>
                              </div>
                              <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                                <div className="bg-amber-500 h-full rounded-full" style={{ width: `${((client.scoreDetails?.factors.urgency || 0)/25)*100}%` }} />
                              </div>
                            </div>

                            <div className="space-y-1">
                              <div className="flex justify-between text-[10px] text-slate-500">
                                <span>Seguimiento</span>
                                <span className="font-bold text-slate-700 dark:text-slate-300">{client.scoreDetails?.factors.activity || 0}/30</span>
                              </div>
                              <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                                <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${((client.scoreDetails?.factors.activity || 0)/30)*100}%` }} />
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-2 pt-2.5 border-t border-slate-100 dark:border-slate-750">
                            <button
                              onClick={() => onSelectClient(client)}
                              className="flex-1 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 transition-all"
                            >
                              Atender Lead
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {clientsWithScores.length === 0 && (
                  <p className="text-xs text-slate-400 italic text-center py-6">No tienes prospectos activos en este momento.</p>
                )}
              </div>
            </section>

            {/* High-Affinity Inventory Matches */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-indigo-500" />
                <h2 className="text-base font-black text-slate-800 dark:text-white">Matches de Alta Afinidad</h2>
              </div>
              
              <div className="space-y-3">
                {clientsWithScores.slice(0, 4).filter(c => c.leadScore >= 45).map((client) => {
                  const matchedVehicles = getClientMatches(client as Client, availableVehicles);
                  if (matchedVehicles.length === 0) return null;
                  
                  return (
                    <div 
                      key={`seller-match-${client.id}`} 
                      className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm space-y-3"
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-slate-400">PROPUESTA DE NEGOCIO</span>
                        <span className="text-[10px] font-black uppercase bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded border border-indigo-100 dark:border-indigo-900/30">
                          {matchedVehicles[0].level === 'exact' ? 'Coincidencia Exacta' : 'Afinidad Alta'}
                        </span>
                      </div>
                      
                      <div>
                        <p className="text-xs text-slate-500">Para el prospecto:</p>
                        <p className="font-extrabold text-slate-900 dark:text-white text-sm mt-0.5">{client.name}</p>
                      </div>

                      <div className="flex items-start gap-3 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-100 dark:border-slate-750">
                        <Car className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Auto Disponible en Inventario:</p>
                          <p className="text-xs font-black text-slate-800 dark:text-slate-200 mt-1">
                            {matchedVehicles[0].vehicle.make} {matchedVehicles[0].vehicle.model} ({matchedVehicles[0].vehicle.year})
                          </p>
                          <p className="text-xs font-black text-indigo-600 mt-0.5">
                            ${matchedVehicles[0].vehicle.price.toLocaleString()}
                          </p>
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <button
                          onClick={() => onSelectClient(client)}
                          className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl hover:bg-slate-200 flex items-center gap-1 transition-colors"
                        >
                          Ver Detalles
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* AI Advisor Panel (Specific context for active seller) */}
            <div className="relative">
              <AiAdvisorPanel 
                userName={userName}
                agencyId={agencyId}
                activeContacts={activeContacts}
                tasks={tasks}
                pipelineStages={pipelineStages}
              />
            </div>

            {/* Today's Action Center */}
            <section className="space-y-4">
              {/* Today's Meetings */}
              {todayMeetings.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar className="w-4.5 h-4.5 text-blue-500" />
                    <h3 className="text-sm font-black text-slate-800 dark:text-white">Citas Agendadas Hoy</h3>
                  </div>
                  <div className="space-y-2">
                    {todayMeetings.map((task, idx) => (
                      <div 
                        key={`${task.id}-${idx}`}
                        onClick={() => handleTaskClick(task.clientId)}
                        className="bg-white dark:bg-slate-800 rounded-xl p-3 shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-between active:scale-[0.98] transition-transform cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-blue-700 dark:text-blue-300">
                              {task.startTime || "--:--"}
                            </span>
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-white text-xs">{task.title}</p>
                            <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                              <UserCheck className="w-3 h-3" />
                              {getClientName(task.clientId)}
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pending Follow-ups */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Activity className="w-4.5 h-4.5 text-amber-500" />
                  <h3 className="text-sm font-black text-slate-800 dark:text-white">Seguimientos Pendientes Hoy</h3>
                </div>
                {todayFollowUps.length === 0 ? (
                  <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 text-center shadow-sm">
                    <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-600 dark:text-slate-300">¡Seguimientos al día!</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {todayFollowUps.map((task, idx) => {
                      const Icon = typeIcons[task.type] || Clock;
                      return (
                        <div 
                          key={`${task.id}-${idx}`}
                          onClick={() => handleTaskClick(task.clientId)}
                          className="bg-white dark:bg-slate-800 rounded-xl p-3 shadow-sm border border-slate-200 dark:border-slate-700 flex items-center gap-3 active:scale-[0.98] transition-transform cursor-pointer"
                        >
                          <div className="w-8 h-8 rounded-full bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                            <Icon className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-slate-900 dark:text-white text-xs truncate">{task.title}</p>
                            <p className="text-[10px] text-slate-500 truncate">{getClientName(task.clientId)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Overdue Tasks */}
              {overdueTasks.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <AlertCircle className="w-4.5 h-4.5 text-rose-500" />
                    <h3 className="text-sm font-black text-slate-800 dark:text-white">Tareas Vencidas</h3>
                  </div>
                  <div className="space-y-2">
                    {overdueTasks.map((task, idx) => {
                      const Icon = typeIcons[task.type] || Clock;
                      return (
                        <div 
                          key={`${task.id}-${idx}`}
                          onClick={() => handleTaskClick(task.clientId)}
                          className="bg-white dark:bg-slate-800 rounded-xl p-3 shadow-sm border border-rose-200 dark:border-rose-900/40 flex items-center gap-3 active:scale-[0.98] transition-transform cursor-pointer"
                        >
                          <div className="w-8 h-8 rounded-full bg-rose-50 dark:bg-rose-900/30 flex items-center justify-center shrink-0">
                            <Icon className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-slate-900 dark:text-white text-xs truncate">{task.title}</p>
                            <p className="text-[10px] text-rose-500 font-bold truncate">
                              Venció: {task.dueDate} - {getClientName(task.clientId)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>

          </div>
        )}

        {/* Matches de Inventario Compartido Mobile */}
        <section className="space-y-3 mt-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500 animate-pulse" />
              <h2 className="text-base font-black text-slate-800 dark:text-white">Matches de Inventario Compartido</h2>
            </div>
            {matches.length > 0 && (
              <span className="bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 text-[10px] font-black px-2.5 py-0.5 rounded-full">
                {matches.length} Matches
              </span>
            )}
          </div>

          {!ownAgencySharing ? (
            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-900/60 flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                Para ver los autos de la red Nextcar, debes activar <strong>Compartir mi Inventario</strong> en la configuración de la Agencia.
              </p>
            </div>
          ) : matches.length === 0 ? (
            <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 text-center py-6">
              <Car className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-1.5" />
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">No hay coincidencias en red en este momento.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {matches.map((match, idx) => (
                <div key={`mob-shared-${idx}`} className="bg-white dark:bg-slate-800 rounded-2xl p-3.5 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between">
                  <div className="flex justify-between items-start mb-2.5">
                    <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full border border-amber-200/20">
                      Match {match.score}%
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 max-w-[120px] truncate">
                      {match.agencyName}
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5 bg-slate-50 dark:bg-slate-900/40 p-2 rounded-xl border border-slate-100 dark:border-slate-800 mb-3">
                    <div className="w-10 h-10 rounded bg-slate-200 dark:bg-slate-850 flex items-center justify-center shrink-0 overflow-hidden">
                      {match.vehicle.photoUrl ? (
                        <img src={match.vehicle.photoUrl} alt="auto" className="w-full h-full object-cover rounded" referrerPolicy="no-referrer" />
                      ) : (
                        <Car className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-[11px] font-extrabold text-slate-800 dark:text-slate-200 truncate">
                        {match.vehicle.make} {match.vehicle.model}
                      </h4>
                      <p className="text-[9px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {match.vehicle.year} • ${match.vehicle.price?.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-600 dark:text-slate-400 mb-3 leading-snug">
                    <span className="font-extrabold text-slate-900 dark:text-white">{match.client.name}</span> busca:{" "}
                    <span className="italic">
                      {match.client.wantedVehicle?.make || "Cualquiera"} {match.client.wantedVehicle?.model || ""}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2.5 border-t border-slate-100 dark:border-slate-700/60">
                    <button
                      onClick={() => {
                        setSelectedSharedVehicle(match.vehicle);
                        setSelectedSharedClient(match.client);
                      }}
                      className="py-1.5 px-2 bg-slate-100 dark:bg-slate-700 hover:bg-amber-500 hover:text-white dark:hover:bg-amber-600 text-[10px] font-bold rounded-lg text-slate-700 dark:text-slate-200 transition-colors flex items-center justify-center gap-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Ver Auto
                    </button>
                    <a
                      href={`https://wa.me/${match.client.phone?.replace(/[^0-9]/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-1.5 px-2 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-500 hover:text-white text-[10px] font-bold rounded-lg text-emerald-700 dark:text-emerald-300 transition-colors flex items-center justify-center gap-1"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      WhatsApp
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>

      {/* Shared Matches Modal for Mobile */}
      {selectedSharedVehicle && selectedSharedClient && (
        <VehicleDetailModal
          vehicle={selectedSharedVehicle}
          clientContext={selectedSharedClient}
          onClose={() => {
            setSelectedSharedVehicle(null);
            setSelectedSharedClient(null);
          }}
        />
      )}
    </div>
  );
}
