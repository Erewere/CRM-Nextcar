import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Client, Task } from '../types';
import { MessageCircle, Phone, ChevronRight, AlertTriangle, Lock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import clsx from 'clsx';
import { getVehicleOfInterestText } from '../lib/clientUtils';

interface Props {
  client: Client;
  tasks?: import('../types').Task[];
  onClick?: () => void;
  key?: React.Key;
  disabled?: boolean;
}

export function ClientCard({ client, tasks = [], onClick, disabled }: Props) {
  const getTaskStatusInfo = () => {
    const pendingTasks = tasks.filter(t => !t.completed);
    if (pendingTasks.length === 0) {
      return {
        colorClass: 'text-amber-500 border-amber-200 bg-amber-50 hover:bg-amber-100 hover:text-amber-600 hover:border-amber-300',
        title: 'Trato sin tareas asignadas',
        hasNoTasks: true
      };
    }
    
    // Sort tasks by date to get the next one
    const sortedTasks = [...pendingTasks].sort((a, b) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    });
    
    const nextTask = sortedTasks[0];

    const d = new Date();
    const todayStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    
    const hasOverdue = pendingTasks.some(t => {
      if (!t.dueDate) return true; // Tasks without due dates are considered overdue/pending action
      return t.dueDate < todayStr;
    });
    
    const getDisplayTitle = (task) => {
      if (!task) return '';
      let txt = task.title || '';
      if (task.notes) txt += ' - ' + task.notes;
      return txt || 'Tarea asignada';
    };

    if (hasOverdue) {
      return {
        colorClass: 'text-red-500 border-red-200 bg-red-50 hover:bg-red-100 hover:text-red-600 hover:border-red-300',
        title: getDisplayTitle(nextTask),
        hasNoTasks: false
      };
    }
    
    const hasToday = pendingTasks.some(t => t.dueDate === todayStr);
    if (hasToday) {
      return {
        colorClass: 'text-blue-500 border-blue-200 bg-blue-50 hover:bg-blue-100 hover:text-blue-600 hover:border-blue-300',
        title: getDisplayTitle(nextTask),
        hasNoTasks: false
      };
    }

    return {
      colorClass: 'text-green-500 border-green-200 bg-green-50 hover:bg-green-100 hover:text-green-600 hover:border-green-300',
      title: getDisplayTitle(nextTask),
      hasNoTasks: false
    };
  };

  const { colorClass: statusColorClass, title: statusTitle, hasNoTasks } = getTaskStatusInfo();
  // console.log("ClientCard for", client.name, "tasks:", tasks, "statusTitle:", statusTitle);

  return (
    <div 
      onClick={onClick}
      className={clsx(
        "group bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded shadow-sm transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] hover:-translate-y-1 hover:bg-white/60 dark:hover:bg-slate-800/60 hover:backdrop-blur-xl text-left relative overflow-hidden",
        disabled ? "cursor-pointer" : "cursor-grab active:cursor-grabbing",
        client.origin === 'whatsapp' && "border-l-4 border-l-green-400"
      )}
    >
      {/* Modern water-drop / glass highlight effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-400/0 via-blue-300/5 to-indigo-400/10 dark:from-blue-500/0 dark:via-blue-400/5 dark:to-indigo-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none mix-blend-overlay" />
      <div className="absolute -inset-full top-0 left-0 bg-gradient-to-r from-transparent via-white/20 to-transparent dark:via-white/5 opacity-0 group-hover:opacity-100 group-hover:-translate-x-full duration-1000 transition-all ease-out pointer-events-none" />
      
      <div className="p-3 pb-2.5">
        <div className="flex justify-between items-start gap-2 mb-0.5">
          <h4 className="text-[13px] font-bold text-slate-800 dark:text-slate-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors flex items-center gap-1">
            {client.dealTitle || (client.name ? `${client.name} deal` : 'Deal')}
            {disabled && (
              <span title="Solo lectura (Asignado a otro vendedor)"><Lock className="w-3 h-3 text-slate-400 shrink-0" /></span>
            )}
          </h4>
          {client.dealValue ? (
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded border border-emerald-100 dark:border-emerald-800/50">
              ${new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 }).format(client.dealValue)}
            </span>
          ) : null}
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mb-3 font-medium">
          {getVehicleOfInterestText(client)}
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
              <span className="rounded bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-800 dark:to-slate-800 px-1.5 py-0.5 text-[9px] font-bold text-slate-600 dark:text-slate-400 border border-gray-200 dark:border-slate-700 flex items-center gap-1 shadow-sm">
                <Phone className="w-2.5 h-2.5" /> {client.phone || 'Tel'}
              </span>
            )}
          </div>
          
          <div 
            className={clsx("group/tooltip relative w-[24px] h-[24px] rounded-full flex items-center justify-center transition-all cursor-pointer hover:scale-110 hover:shadow-sm", statusColorClass)}
          >
            {hasNoTasks ? (
              <AlertTriangle className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-4 h-4 ml-0.5" />
            )}
            <div className="absolute bottom-full mb-2 right-0 z-50 w-max max-w-[200px] bg-slate-800 dark:bg-slate-700 text-white text-[10px] px-2 py-1 rounded shadow-sm opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-none pointer-events-none whitespace-normal text-right">
              {statusTitle}
              <div className="absolute top-full right-2 -mt-[1px] border-4 border-transparent border-t-slate-800 dark:border-t-slate-700"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SortableClientCard({ client, tasks, onClick }: Props) {
  const { userData } = useAuth();
  
  const canModify = !client.id ||
    (client.creatorId === userData?.id) ||
    (client.createdByAdmin === true) ||
    (!client.creatorId && (client.sellerId === userData?.id || !client.sellerId));
  const isDragDisabled = userData?.role === "admin" && !canModify;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: client.id,
    disabled: isDragDisabled
  });

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
        className="rounded border-2 border-dashed border-blue-400 opacity-60 transition-all duration-300"
      >
        <div className="w-full pointer-events-none">
          <ClientCard client={client} tasks={tasks} disabled={isDragDisabled} />
        </div>
      </div>
    );
  }

  return (
    <div ref={setNodeRef} style={style} {...(isDragDisabled ? {} : attributes)} {...(isDragDisabled ? {} : listeners)}>
      <ClientCard client={client} tasks={tasks} onClick={onClick} disabled={isDragDisabled} />
    </div>
  );
}
