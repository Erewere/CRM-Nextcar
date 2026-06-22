import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Client } from '../types';
import { MessageCircle, Phone, ChevronRight } from 'lucide-react';
import clsx from 'clsx';

interface Props {
  client: Client;
  tasks?: { clientId: string; dueDate: string; completed: boolean }[];
  onClick?: () => void;
  key?: React.Key;
}

export function ClientCard({ client, tasks = [], onClick }: Props) {
  const getTaskStatusColor = () => {
    const pendingTasks = tasks.filter(t => !t.completed);
    if (pendingTasks.length === 0) return 'text-slate-400 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 group-hover:bg-slate-100 dark:bg-slate-700 group-hover:text-slate-600 dark:text-slate-400';
    
    // Check if any is overdue (before today)
    const todayStr = new Date().toISOString().split('T')[0];
    const hasOverdue = pendingTasks.some(t => {
      if (!t.dueDate) return true; // Tasks without due dates are considered overdue/pending action
      return t.dueDate < todayStr;
    });
    
    if (hasOverdue) return 'text-red-500 border-red-200 bg-red-50 hover:bg-red-100 hover:text-red-600 hover:border-red-300';
    return 'text-green-500 border-green-200 bg-green-50 hover:bg-green-100 hover:text-green-600 hover:border-green-300';
  };

  const statusColorClass = getTaskStatusColor();

  return (
    <div 
      onClick={onClick}
      className={clsx(
        "group bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm transition-all hover:shadow-md cursor-grab active:cursor-grabbing text-left relative",
        client.origin === 'whatsapp' && "border-l-4 border-l-green-400"
      )}
    >
      {/* Activity indicator border top (optional, could be dynamically colored based on tasks) */}
      <div className="absolute top-0 left-0 w-full h-[3px] bg-transparent group-hover:bg-slate-200 transition-colors" />
      
      <div className="p-3 pb-2.5">
        <h4 className="text-[13px] font-bold text-blue-900 truncate mb-0.5">
          {client.dealTitle || (client.name ? `${client.name} deal` : 'Deal')}
        </h4>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mb-3 font-medium">
          {client.name} {client.vehicle && client.vehicle !== 'Otro pendiente' ? ` • ${client.vehicle}` : ''}
        </p>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-700">
              {(client.name || 'U').charAt(0).toUpperCase()}
            </div>
            
            {client.origin === 'whatsapp' ? (
              <span className="rounded bg-green-50 px-1.5 py-0.5 text-[9px] font-bold text-green-600 flex items-center gap-1">
                <MessageCircle className="w-2.5 h-2.5" /> WA WP
              </span>
            ) : (
              <span className="rounded bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 text-[9px] font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                <Phone className="w-2.5 h-2.5" /> {client.phone || 'Tel'}
              </span>
            )}
          </div>
          
          <div className={clsx("w-[22px] h-[22px] rounded-full border flex items-center justify-center transition-all cursor-pointer hover:scale-110 hover:shadow-sm", statusColorClass)}>
            <ChevronRight className="w-4 h-4 ml-0.5" />
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
        className="rounded-xl border-2 border-dashed border-blue-400 bg-blue-50/20 overflow-hidden relative flex transition-all duration-300"
      >
        <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_8px,#bfdbfe_8px,#bfdbfe_16px)] opacity-20 animate-[pulse_2s_ease-in-out_infinite]" />
        <div className="opacity-40 w-full pointer-events-none">
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
