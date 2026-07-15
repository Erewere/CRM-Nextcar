import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Task, Client, PipelineStage } from "../../types";
import { format, isBefore, startOfToday } from "date-fns";
import { es } from "date-fns/locale";
import { 
  CheckCircle, Circle, Clock, Phone, Calendar, MessageCircle, FileText, 
  User, AlertCircle, TrendingUp, Star, Zap, ChevronRight, Activity, Flame
} from "lucide-react";
import clsx from "clsx";
import { AiAdvisorPanel } from "../../components/AiAdvisorPanel";
import { calculateLeadScore } from "../../services/leadScoring";

interface MobileHomeProps {
  userName: string;
  agencyId: string;
  agencyName?: string;
  clients: Client[];
  activeContacts: Client[];
  tasks: Task[];
  pipelineStages: PipelineStage[];
  onSelectClient: (client: Client) => void;
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
  clients, 
  activeContacts, 
  tasks, 
  pipelineStages,
  onSelectClient
}: MobileHomeProps) {
  
  const navigate = useNavigate();
  const [currentTime] = useState(new Date());

  const greeting = useMemo(() => {
    const hour = currentTime.getHours();
    if (hour < 12) return "Buenos días";
    if (hour < 19) return "Buenas tardes";
    return "Buenas noches";
  }, [currentTime]);

  const formattedDate = format(currentTime, "EEEE, d 'de' MMMM", { locale: es });

  const {
    todayFollowUps,
    todayMeetings,
    overdueTasks,
    priorityClients,
    topLeadScore
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

    // Calculate scores for all active contacts
    const scoredContacts = activeContacts.map(c => ({
      ...c,
      calculatedScore: calculateLeadScore(c, pipelineStages)
    }));

    // Clientes prioritarios (Etapa avanzada o score alto)
    const priority = scoredContacts.filter(c => {
      const stageIndex = pipelineStages.findIndex(s => s.id === c.status);
      const isAdvanced = stageIndex >= pipelineStages.length - 2 && pipelineStages.length > 2; // Últimas dos etapas
      return isAdvanced || c.calculatedScore >= 70;
    }).slice(0, 5);

    // Lead score alto
    const topScores = [...scoredContacts]
      .sort((a, b) => b.calculatedScore - a.calculatedScore)
      .slice(0, 5);

    return {
      todayFollowUps: followUps,
      todayMeetings: meetings,
      overdueTasks: overdue,
      priorityClients: priority,
      topLeadScore: topScores
    };
  }, [tasks, activeContacts, pipelineStages, currentTime]);

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

  return (
    <div className="flex flex-col h-full overflow-y-auto pb-24 bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <div className="px-5 pt-6 pb-4 bg-white dark:bg-slate-800 shadow-sm sticky top-0 z-10">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
          {greeting}, <span className="text-blue-600 dark:text-blue-400">{userName.split(' ')[0]}</span>
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 capitalize">
          {formattedDate} {agencyName ? ` • ${agencyName}` : ''}
        </p>
      </div>

      <div className="p-4 space-y-6">
        {/* Overview Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div 
            onClick={() => navigate('/tasks', { state: { filterDate: 'overdue', filterStatus: 'pending' } })}
            className="bg-rose-50 dark:bg-rose-900/20 rounded-2xl p-3 border border-rose-100 dark:border-rose-800/30 flex flex-col items-center justify-center text-center cursor-pointer active:scale-95 transition-transform"
          >
            <span className="text-2xl font-black text-rose-600 dark:text-rose-400">{overdueTasks.length}</span>
            <span className="text-[10px] font-semibold text-rose-800 dark:text-rose-300 uppercase tracking-wider mt-1">Vencidas</span>
          </div>
          <div 
            onClick={() => navigate('/tasks', { state: { filterDate: 'today', filterType: 'meeting', filterStatus: 'pending' } })}
            className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-3 border border-blue-100 dark:border-blue-800/30 flex flex-col items-center justify-center text-center cursor-pointer active:scale-95 transition-transform"
          >
            <span className="text-2xl font-black text-blue-600 dark:text-blue-400">{todayMeetings.length}</span>
            <span className="text-[10px] font-semibold text-blue-800 dark:text-blue-300 uppercase tracking-wider mt-1">Citas</span>
          </div>
          <div 
            onClick={() => navigate('/tasks', { state: { filterDate: 'today', filterStatus: 'pending' } })}
            className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl p-3 border border-amber-100 dark:border-amber-800/30 flex flex-col items-center justify-center text-center cursor-pointer active:scale-95 transition-transform"
          >
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400">{todayFollowUps.length}</span>
            <span className="text-[10px] font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-wider mt-1">Seguimientos</span>
          </div>
        </div>

        {/* AI Recommendations */}
        <div className="relative">
          <AiAdvisorPanel 
            userName={userName}
            agencyId={agencyId}
            activeContacts={activeContacts}
            tasks={tasks}
            pipelineStages={pipelineStages}
          />
        </div>

        {/* Today's Meetings */}
        {todayMeetings.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-5 h-5 text-blue-500" />
              <h2 className="text-lg font-bold text-slate-800 dark:text-white">Citas del Día</h2>
            </div>
            <div className="space-y-2">
              {todayMeetings.map(task => (
                <div 
                  key={task.id}
                  onClick={() => handleTaskClick(task.clientId)}
                  className="bg-white dark:bg-slate-800 rounded-xl p-3 shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-between active:scale-[0.98] transition-transform"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-blue-700 dark:text-blue-300">
                        {task.startTime || "--:--"}
                      </span>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white text-sm">{task.title}</p>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <User className="w-3 h-3" />
                        {getClientName(task.clientId)}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400" />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Priority Clients */}
        {priorityClients.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Flame className="w-5 h-5 text-orange-500 fill-orange-500" />
              <h2 className="text-lg font-bold text-slate-800 dark:text-white">Clientes Prioritarios</h2>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
              {priorityClients.map((client, idx) => (
                <div 
                  key={client.id}
                  onClick={() => onSelectClient(client)}
                  className={clsx(
                    "p-3 flex items-center justify-between active:bg-slate-50 dark:active:bg-slate-700/50",
                    idx !== priorityClients.length - 1 && "border-b border-slate-100 dark:border-slate-700"
                  )}
                >
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white text-sm">{client.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{client.vehicle || 'Sin vehículo'}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Pending Follow-ups */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-bold text-slate-800 dark:text-white">Seguimientos Hoy</h2>
          </div>
          {todayFollowUps.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 text-center shadow-sm">
              <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">¡Todo al día!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {todayFollowUps.map(task => {
                const Icon = typeIcons[task.type] || Clock;
                return (
                  <div 
                    key={task.id}
                    onClick={() => handleTaskClick(task.clientId)}
                    className="bg-white dark:bg-slate-800 rounded-xl p-3 shadow-sm border border-slate-200 dark:border-slate-700 flex items-center gap-3 active:scale-[0.98] transition-transform"
                  >
                    <div className="w-8 h-8 rounded-full bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 dark:text-white text-sm truncate">{task.title}</p>
                      <p className="text-xs text-slate-500 truncate">{getClientName(task.clientId)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Top Lead Score */}
        {topLeadScore.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-5 h-5 text-yellow-500 fill-yellow-500" />
              <h2 className="text-lg font-bold text-slate-800 dark:text-white">Mayor Lead Score</h2>
            </div>
            <div className="flex overflow-x-auto gap-3 pb-2 -mx-4 px-4 snap-x">
              {topLeadScore.map(client => (
                <div 
                  key={client.id}
                  onClick={() => onSelectClient(client)}
                  className="bg-white dark:bg-slate-800 rounded-xl p-3 shadow-sm border border-slate-200 dark:border-slate-700 min-w-[140px] snap-center active:scale-95 transition-transform shrink-0"
                >
                  <div className="flex items-center gap-1 mb-2">
                    <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                    <span className="font-bold text-sm text-slate-700 dark:text-slate-300">{client.calculatedScore}</span>
                  </div>
                  <p className="font-semibold text-slate-900 dark:text-white text-sm truncate">{client.name}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Overdue Tasks */}
        {overdueTasks.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="w-5 h-5 text-rose-500" />
              <h2 className="text-lg font-bold text-slate-800 dark:text-white">Tareas Vencidas</h2>
            </div>
            <div className="space-y-2">
              {overdueTasks.map(task => {
                const Icon = typeIcons[task.type] || Clock;
                return (
                  <div 
                    key={task.id}
                    onClick={() => handleTaskClick(task.clientId)}
                    className="bg-white dark:bg-slate-800 rounded-xl p-3 shadow-sm border border-rose-200 dark:border-rose-900/50 flex items-center gap-3 active:scale-[0.98] transition-transform"
                  >
                    <div className="w-8 h-8 rounded-full bg-rose-50 dark:bg-rose-900/30 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 dark:text-white text-sm truncate">{task.title}</p>
                      <p className="text-xs text-rose-500 font-medium truncate">
                        Venció: {task.dueDate} - {getClientName(task.clientId)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

      </div>
    </div>
  );
}
