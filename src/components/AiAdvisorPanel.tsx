import React, { useMemo } from 'react';
import { Bot, Phone, FileText, CheckCircle, Clock } from 'lucide-react';
import { Client, Task, PipelineStage } from '../types';
import { Link } from 'react-router';
import { generateRecommendations } from '../services/recommendations';

interface AiAdvisorPanelProps {
  userName: string;
  activeContacts: Client[]; 
  tasks: Task[];
  pipelineStages: PipelineStage[];
}

export function AiAdvisorPanel({ userName, activeContacts, tasks, pipelineStages }: AiAdvisorPanelProps) {
  
  const recommendations = useMemo(() => {
    const rawRecs = generateRecommendations(activeContacts, tasks, pipelineStages);
    
    // map icons
    return rawRecs.map(rec => {
      let icon = null;
      switch (rec.type) {
        case 'overdue': icon = <Phone className="w-4 h-4 text-rose-400" />; break;
        case 'proposal': icon = <FileText className="w-4 h-4 text-purple-400" />; break;
        case 'followup': icon = <Clock className="w-4 h-4 text-amber-400" />; break;
        case 'new': icon = <Phone className="w-4 h-4 text-blue-400" />; break;
        case 'closing': icon = <CheckCircle className="w-4 h-4 text-emerald-400" />; break;
        case 'meeting': icon = <Phone className="w-4 h-4 text-indigo-400" />; break;
        default: icon = <Phone className="w-4 h-4 text-slate-400" />;
      }
      return { ...rec, icon };
    }).slice(0, 6);
  }, [activeContacts, tasks, pipelineStages]);

  if (recommendations.length === 0) {
    return (
      <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-purple-900 rounded-xl shadow-lg border border-indigo-500/30 overflow-hidden text-white mb-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-black/20">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 rounded-lg border border-indigo-500/30 shadow-inner">
              <Bot className="w-5 h-5 text-indigo-300" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-wide">IA Asesor</h3>
              <p className="text-xs text-indigo-200/80">Asesor: <span className="text-indigo-100 font-medium">{userName.split(' ')[0]}</span> • Prospectos activos: {activeContacts.length}</p>
            </div>
          </div>
        </div>
        <div className="p-5 flex flex-col items-center justify-center text-center py-8">
          <Bot className="w-12 h-12 text-indigo-300/50 mb-3" />
          <p className="text-indigo-200 font-medium">Agrega prospectos para recibir recomendaciones de la IA.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-purple-900 rounded-xl shadow-lg border border-indigo-500/30 overflow-hidden text-white mb-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="p-4 border-b border-white/10 flex items-center justify-between bg-black/20">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/20 rounded-lg border border-indigo-500/30 shadow-inner">
            <Bot className="w-5 h-5 text-indigo-300" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-wide">IA Asesor</h3>
            <p className="text-xs text-indigo-200/80">Asesor: <span className="text-indigo-100 font-medium">{userName.split(' ')[0]}</span> • Prospectos activos: {activeContacts.length}</p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs bg-indigo-500/20 border border-indigo-500/30 px-3 py-1.5 rounded-full text-indigo-200">
          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
          Recomendaciones en tiempo real
        </div>
      </div>
      
      <div className="p-5">
        <h4 className="text-xs font-bold text-indigo-300 mb-3 uppercase tracking-widest">IA Recomienda:</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {recommendations.map((rec, idx) => (
            <Link 
              to="/persons" 
              state={{ clientId: rec.clientId }} 
              key={rec.clientId} 
              className="bg-white/5 hover:bg-white/10 transition-colors border border-white/10 rounded-lg p-4 flex flex-col justify-between group relative overflow-hidden cursor-pointer"
            >
              <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-white/5 to-transparent rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
              
              <div className="flex items-start gap-3 mb-4 relative z-10">
                <div className="mt-0.5 p-2 bg-black/20 rounded-lg shrink-0 border border-white/5 shadow-inner">
                  {rec.icon}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white leading-tight pr-2 group-hover:text-indigo-200 transition-colors">
                    {idx + 1}. {rec.actionText}
                  </p>
                  <p className="text-xs text-indigo-200/70 mt-1">{rec.reason}</p>
                </div>
              </div>
              <div className="mt-auto pt-3 border-t border-white/10 flex items-center justify-between relative z-10">
                <span className="text-[11px] text-indigo-300/80 uppercase tracking-wider font-semibold">Probabilidad cierre</span>
                <span className={`text-sm font-black ${rec.probability > 75 ? 'text-emerald-400' : rec.probability > 50 ? 'text-amber-400' : 'text-blue-400'} drop-shadow-md`}>
                  {rec.probability}%
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
