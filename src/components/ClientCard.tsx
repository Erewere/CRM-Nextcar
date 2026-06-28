import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Client } from '../types';
import { MessageCircle, Phone, ChevronRight, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';

interface Props {
  client: Client;
  tasks?: { clientId: string; dueDate: string; completed: boolean }[];
  onClick?: () => void;
  key?: React.Key;
}

export function ClientCard({ client, tasks = [], onClick }: Props) {
  const getTaskStatusInfo = () => {
    const pendingTasks = tasks.filter(t => !t.completed);
    if (pendingTasks.length === 0) {
      return {
        colorClass: 'text-amber-500 border-amber-200 bg-amber-50 hover:bg-amber-100 hover:text-amber-600 hover:border-amber-300',
        title: 'Trato sin tareas asignadas',
        hasNoTasks: true
      };
    }
    
    const todayStr = new Date().toISOString().split('T')[0];
    const hasOverdue = pendingTasks.some(t => {
      if (!t.dueDate) return true; // Tasks without due dates are considered overdue/pending action
      return t.dueDate < todayStr;
    });
    
    if (hasOverdue) {
      return {
        colorClass: 'text-red-500 border-red-200 bg-red-50 hover:bg-red-100 hover:text-red-600 hover:border-red-300',
        title: 'Tarea vencida',
        hasNoTasks: false
      };
    }
    
    const hasToday = pendingTasks.some(t => t.dueDate === todayStr);
    if (hasToday) {
      return {
        colorClass: 'text-blue-500 border-blue-200 bg-blue-50 hover:bg-blue-100 hover:text-blue-600 hover:border-blue-300',
        title: 'Tarea para hoy',
        hasNoTasks: false
      };
    }

    return {
      colorClass: 'text-green-500 border-green-200 bg-green-50 hover:bg-green-100 hover:text-green-600 hover:border-green-300',
      title: 'Tarea programada a futuro',
      hasNoTasks: false
    };
  };

  const { colorClass: statusColorClass, title: statusTitle, hasNoTasks } = getTaskStatusInfo();

  return (
    <div 
      onClick={onClick}
      className={clsx(
        "group bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm transition-all hover:shadow-md cursor-grab active:cursor-grabbing text-left relative overflow-hidden",
        client.origin === 'whatsapp' && "border-l-4 border-l-green-400"
      )}
    >
      {/* Activity indicator border top (optional, could be dynamically colored based on tasks) */}
      <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-blue-500 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      <div className="p-3 pb-2.5">
        <div className="flex justify-between items-start gap-2 mb-0.5">
          <h4 className="text-[13px] font-bold text-slate-800 dark:text-slate-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            {client.dealTitle || (client.name ? `${client.name} deal` : 'Deal')}
          </h4>
          {client.dealValue ? (
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded border border-emerald-100 dark:border-emerald-800/50">
              ${new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 }).format(client.dealValue)}
            </span>
          ) : null}
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mb-3 font-medium">
          {client.name} {client.vehicle && client.vehicle !== 'Otro pendiente' ? ` • ${client.vehicle}` : ''}
        </p>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/40 dark:to-blue-800/40 flex items-center justify-center text-[10px] font-bold text-blue-700 dark:text-blue-300 shadow-sm border border-blue-200/50 dark:border-blue-700/50">
              {String(client.name || 'U').charAt(0).toUpperCase()}
            </div>
            
            {client.origin === 'whatsapp' ? (
              <span className="rounded bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 px-1.5 py-0.5 text-[9px] font-bold text-green-700 dark:text-green-400 border border-green-100 dark:border-green-800/50 flex items-center gap-1 shadow-sm">
                <MessageCircle className="w-2.5 h-2.5" /> WA WP
              </span>
            ) : (
              <span className="rounded bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-800 dark:to-slate-800 px-1.5 py-0.5 text-[9px] font-bold text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 flex items-center gap-1 shadow-sm">
                <Phone className="w-2.5 h-2.5" /> {client.phone || 'Tel'}
              </span>
            )}
          </div>
          
          <div 
            className={clsx("w-[24px] h-[24px] rounded-full flex items-center justify-center transition-all cursor-pointer hover:scale-110 hover:shadow-md", statusColorClass)}
            title={statusTitle}
          >
            {hasNoTasks ? (
              <AlertTriangle className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-4 h-4 ml-0.5" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SortableClientCard({ client, tasks, onClick }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: client.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
  };

  if (isDragging) {
    return (
      <div 
        ref={setNodeRef} 
        style={style} 
        className="rounded-xl border-2 border-dashed border-blue-400 opacity-60 transition-all duration-300"
      >
        <div className="w-full pointer-events-none">
          <ClientCard client={client} tasks={tasks} />
        </div>
      </div>
    );
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <ClientCard client={client} tasks={tasks} onClick={onClick} />
    </div>
  );
}
