import { getAuth } from "firebase/auth";
import React, { useState, useEffect } from 'react';
import { Bot, Phone, FileText, CheckCircle, Clock, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { Client, Task, PipelineStage } from '../types';
import { auth } from "../lib/firebase";
import { Link } from 'react-router';
import { generateRecommendations } from '../services/recommendations';

interface AiAdvisorPanelProps {
  userName: string;
  agencyId: string;
  activeContacts: Client[]; 
  tasks: Task[];
  pipelineStages: PipelineStage[];
}

export function AiAdvisorPanel({ userName, agencyId, activeContacts, tasks, pipelineStages }: AiAdvisorPanelProps) {
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleAnalyzeWithAI = async () => {
    if (activeContacts.length === 0) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/ai-advisor", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          agencyId,
          activeContacts: activeContacts.slice(0, 10),
          tasks,
          pipelineStages
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error calling AI');
      }
      const data = await res.json();
      
      if (data.recommendations && Array.isArray(data.recommendations)) {
        const aiMapped = data.recommendations.map((rec: any) => {
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
        }).slice(0, 8);
        
        if (aiMapped.length > 0) {
          setRecommendations(aiMapped);
        }
      } else {
        setErrorMsg("Respuesta inválida de AI.");
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Generate initial fast recommendations locally
    const rawRecs = generateRecommendations(activeContacts, tasks, pipelineStages);
    const mapped = rawRecs.map(rec => {
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
    
    setRecommendations(mapped);
  }, [activeContacts, tasks, pipelineStages, agencyId]);

  if (recommendations.length === 0) {
    return (
      <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-purple-900 rounded-lg shadow border border-indigo-500/30 overflow-hidden text-white mb-4">
        <div 
        className="p-2 sm:p-3 flex items-center justify-between bg-black/20 cursor-pointer hover:bg-black/30 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
          <div className="flex items-center gap-3">
            <div className="p-1 sm:p-1.5 bg-indigo-500/20 rounded-md border border-indigo-500/30 shadow-inner">
              <Bot className="w-4 h-4 text-indigo-300" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">IA Erewere</h3>
              <p className="text-[10px] text-indigo-200/80">Asesor: <span className="text-indigo-100 font-medium">{userName.split(' ')[0]}</span> • {activeContacts.length} activos</p>
            </div>
          </div>
        </div>
        {isExpanded && (<div className="p-5 flex flex-col items-center justify-center text-center py-8">
          <Bot className="w-12 h-12 text-indigo-300/50 mb-3" />
          <p className="text-indigo-200 font-medium">Agrega prospectos para recibir recomendaciones de la IA.</p>
        </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-purple-900 rounded-lg shadow border border-indigo-500/30 overflow-hidden text-white mb-4">
      <div 
        className="p-2 sm:p-3 flex items-center justify-between bg-black/20 cursor-pointer hover:bg-black/30 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="p-1 sm:p-1.5 bg-indigo-500/20 rounded-md border border-indigo-500/30 shadow-inner">
            <Bot className="w-4 h-4 text-indigo-300" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide">IA Erewere</h3>
            <p className="text-[10px] text-indigo-200/80">Asesor: <span className="text-indigo-100 font-medium">{userName.split(' ')[0]}</span> • {activeContacts.length} activos</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isLoading ? (
            <div className="hidden sm:flex items-center gap-2 text-[10px] sm:text-xs bg-indigo-500/20 border border-indigo-500/30 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-indigo-200">
              <Loader2 className="w-3 h-3 animate-spin text-indigo-300" /> Analizando...
            </div>
          ) : (
            <button 
              onClick={(e) => { e.stopPropagation(); handleAnalyzeWithAI(); setIsExpanded(true); }} 
              className="hidden sm:flex items-center gap-2 text-[10px] sm:text-xs bg-indigo-600 hover:bg-indigo-500 border border-indigo-400/50 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-white transition-colors cursor-pointer shadow-sm"
            >
              <Bot className="w-3 h-3" /> Analizar con Gemini
            </button>
          )}
          {isExpanded ? <ChevronUp className="w-5 h-5 text-indigo-300 ml-2" /> : <ChevronDown className="w-5 h-5 text-indigo-300 ml-2" />}</div>
      </div>
      
      {isExpanded && errorMsg && (
        <div className="p-3 bg-rose-900/40 border-b border-rose-500/30 text-rose-200 text-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-rose-400">Atención:</span>
            <span>{errorMsg}</span>
          </div>
          <Link to="/billing" className="whitespace-nowrap px-3 py-1.5 bg-rose-600 hover:bg-rose-500 rounded text-xs font-medium text-white transition-colors shadow-sm">
            Recargar Créditos
          </Link>
        </div>
      )}
      
      {isExpanded && (
      <div className="p-3 sm:p-5 border-t border-white/10">
        <h4 className="text-xs font-bold text-indigo-300 mb-3 uppercase tracking-widest">IA Recomienda:</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {recommendations.map((rec, idx) => (
            <Link 
              to="/persons" 
              state={{ clientId: rec.clientId }} 
              key={`${rec.clientId}-${idx}`} 
              className="bg-white/5 hover:bg-white/10 transition-colors border border-white/10 rounded-lg p-4 flex flex-col justify-between group relative overflow-hidden cursor-pointer"
            >
              <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-white/5 to-transparent rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
              
              <div className="flex items-start gap-3 mb-4 relative z-10">
                <div className="mt-0.5 p-2 bg-black/20 rounded-lg shrink-0 border border-white/5 shadow-inner">
                  {rec.icon}
                </div>
                <div>
                  <div className="mb-1">
                    <p className="text-xs font-bold text-indigo-300 truncate">
                      {rec.clientName}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-white leading-tight pr-2 group-hover:text-indigo-200 transition-colors">
                    {rec.actionText}
                  </p>
                  <p className="text-[10px] text-indigo-200/70 mt-1 line-clamp-2">{rec.reason}</p>
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
      )}
    </div>
  );
}
