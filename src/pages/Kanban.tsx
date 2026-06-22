import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs, updateDoc, doc, onSnapshot, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Client, PipelineStage } from '../types';
import confetti from 'canvas-confetti';
import { DndContext, DragOverlay, closestCorners, KeyboardSensor, PointerSensor, useSensor, useSensors, useDroppable } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { KanbanColumn } from '../components/KanbanColumn';
import { ClientCard, SortableClientCard } from '../components/ClientCard';
import { ClientDetailModal } from '../components/ClientDetailModal';
import { PipelineSettingsModal } from '../components/PipelineSettingsModal';
import { Settings, ChevronUp, ChevronDown, Archive, X } from 'lucide-react';
import clsx from 'clsx';

const DEFAULT_COLUMNS: PipelineStage[] = [
  { id: 'new', title: 'Nuevos' },
  { id: 'contacted', title: 'Contactados' },
  { id: 'negotiation', title: 'Negociación' },
  { id: 'won', title: 'Ganados' },
  { id: 'lost', title: 'Perdidos' },
];

function isTerminalColumn(col: PipelineStage) {
  const t = col.title.toLowerCase();
  const id = col.id.toLowerCase();
  return id === 'won' || id === 'lost' || t.includes('ganad') || t.includes('vendid') || t.includes('perdid') || t.includes('closed') || t.includes('cerrad');
}

function TerminalDropBar({ columns, activeId }: { columns: PipelineStage[], activeId: string | null }) {
  if (!activeId) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex gap-2 w-[calc(100%-2rem)] max-w-lg">
      <div className="bg-slate-800 backdrop-blur-md shadow-2xl rounded-2xl flex items-center justify-center p-2 border border-slate-700 w-full overflow-x-auto gap-2">
        {columns.map(col => (
          <TerminalDropZone key={col.id} column={col} />
        ))}
      </div>
    </div>
  );
}

function TerminalDropZone({ column }: { column: PipelineStage; key?: string | number }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  let Icon = null;
  const t = column.title.toLowerCase();
  if (t.includes('ganad') || t.includes('won')) Icon = '🎉';
  else if (t.includes('perdid') || t.includes('lost')) Icon = '🗑️';

  return (
    <div 
      ref={setNodeRef}
      className={clsx(
        "flex flex-col items-center justify-center flex-1 min-w-[100px] shrink-0 h-16 md:h-20 rounded-xl transition-all duration-300 border-2",
        isOver ? "border-blue-400 bg-blue-500/20 scale-105" : "border-transparent bg-slate-700/50 text-slate-300 hover:bg-slate-700",
      )}
    >
      <span className="text-lg md:text-xl md:mb-1">{Icon}</span>
      <span className={clsx("font-bold text-[10px] md:text-xs uppercase tracking-wider text-center px-1 truncate w-full", isOver ? "text-blue-400" : "text-slate-300")}>
        {column.title}
      </span>
    </div>
  );
}

function ArchivedClientsModal({ 
  onClose, terminalColumns, filteredClients, tasks, onClientClick
}: { 
  onClose: () => void, 
  terminalColumns: PipelineStage[], 
  filteredClients: Client[],
  tasks: any[],
  onClientClick: (c: Client) => void
}) {
  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex justify-end">
      <div className="w-[800px] max-w-full h-full bg-slate-50 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Archive className="w-5 h-5 text-slate-500" />
            Contactos Archivados
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex-1 overflow-x-auto p-6 flex gap-6">
          {terminalColumns.map(col => {
             const columnClients = filteredClients.filter(c => c.status === col.id);
             return (
               <div key={col.id} className="flex-1 flex flex-col min-w-[320px] max-w-[400px]">
                 <h3 className="font-bold text-slate-700 flex justify-between items-center bg-white p-3 rounded-lg shadow-sm mb-4 border border-slate-200">
                   {col.title}
                   <span className="bg-slate-100 px-2.5 py-0.5 rounded-full text-xs text-slate-600 font-semibold">{columnClients.length}</span>
                 </h3>
                 <div className="flex-1 overflow-y-auto pr-2 space-y-3 pb-20">
                   {columnClients.map(client => (
                     <div key={client.id} onClick={() => { onClientClick(client); onClose(); }} className="cursor-pointer">
                        <ClientCard client={client} tasks={tasks.filter(t => t.clientId === client.id)} />
                     </div>
                   ))}
                   {columnClients.length === 0 && (
                     <div className="bg-white/50 border border-dashed border-slate-300 rounded-lg p-8 text-center text-slate-400 text-sm">
                       No hay contactos en esta etapa
                     </div>
                   )}
                 </div>
               </div>
             )
          })}
        </div>
      </div>
    </div>
  )
}

export function Kanban() {
  const { userData } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [columns, setColumns] = useState<PipelineStage[]>(DEFAULT_COLUMNS);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedSellerId, setSelectedSellerId] = useState<string>('all');
  const [showArchived, setShowArchived] = useState(false);

  const [tasks, setTasks] = useState<{ clientId: string; dueDate: string; completed: boolean }[]>([]);

  useEffect(() => {
    if (!userData || userData.role === 'master' || !userData.agencyId) return;

    const unsubscribeAgency = onSnapshot(doc(db, 'agencies', userData.agencyId), (doc) => {
      let stagesFromBackend = null;
      if (doc.exists()) {
        const data = doc.data();
        if (data.pipelineStages && Array.isArray(data.pipelineStages) && data.pipelineStages.length > 0) {
          stagesFromBackend = data.pipelineStages;
        }
      }
      setColumns(stagesFromBackend || DEFAULT_COLUMNS);
    });

    let unsubscribeUsers = () => {};
    if (userData.role === 'admin' || userData.role === 'master') {
      const uq = query(collection(db, 'users'), where('agencyId', '==', userData.agencyId));
      unsubscribeUsers = onSnapshot(uq, (snapshot) => {
        const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        setUsers(data);
      });
    }

    let q = query(collection(db, 'clients'), where('agencyId', '==', userData.agencyId));
    let tq = query(collection(db, 'tasks'), where('agencyId', '==', userData.agencyId));
    if (userData.role === 'seller') {
      q = query(collection(db, 'clients'), where('agencyId', '==', userData.agencyId), where('sellerId', '==', userData.id));
      tq = query(collection(db, 'tasks'), where('agencyId', '==', userData.agencyId), where('sellerId', '==', userData.id));
    }

    const unsubscribeClients = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Client));
      setClients(data);
    }, (error) => {
      console.error("Error with snapshot", error);
    });

    const unsubscribeTasks = onSnapshot(tq, (snapshot) => {
      const data = snapshot.docs.map(d => {
         const t = d.data();
         return {
            clientId: t.clientId,
            dueDate: t.dueDate,
            completed: t.completed,
         };
      });
      setTasks(data);
    });

    return () => {
      unsubscribeAgency();
      unsubscribeClients();
      unsubscribeTasks();
      unsubscribeUsers();
    };
  }, [userData]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = (event: any) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = async (event: any) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const clientId = active.id;
    const overColumnId = over.data?.current?.sortable?.containerId || over.id;

    if (!columns.find(c => c.id === overColumnId)) return;

    const client = clients.find(c => c.id === clientId);
    if (client && client.status !== overColumnId) {
      setClients(prev => prev.map(c => c.id === clientId ? { ...c, status: overColumnId as any } : c));
      
      try {
        await updateDoc(doc(db, 'clients', clientId), {
          status: overColumnId,
          updatedAt: new Date().toISOString()
        });

        // Trigger vehicle status pending validation if moved to "won"
        const isWon = overColumnId === 'won' || overColumnId.toLowerCase().includes('ganado') || overColumnId.toLowerCase().includes('vendido');
        if (isWon && client.vehicleId) {
          await updateDoc(doc(db, 'vehicles', client.vehicleId), {
            pendingValidation: {
              type: 'sold',
              requestedBy: userData?.id,
              requestedByName: userData?.name || userData?.email,
              clientId: client.id,
              clientName: client.name,
              requestedAt: new Date().toISOString()
            }
          });
        }
      } catch (e) {
        console.error("Status update error", e);
        setClients(prev => [...prev]);
      }
      
      if (overColumnId === 'won' || overColumnId.toLowerCase().includes('ganado') || overColumnId.toLowerCase().includes('vendido')) {
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#E4002B', '#25D366', '#000000']
        });
      }
    }
  };

  const activeClient = activeId ? clients.find(c => c.id === activeId) : null;

  const filteredClients = selectedSellerId === 'all' 
    ? clients 
    : clients.filter(c => c.sellerId === selectedSellerId);

  const activeColumns = columns.filter(c => !isTerminalColumn(c));
  const terminalColumns = columns.filter(c => isTerminalColumn(c));

  return (
    <div className="h-full flex flex-col">
      <div className="mb-6 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-lg font-bold text-slate-800">Pipeline de Ventas</h1>
            <p className="text-sm text-slate-500">Arrastra los prospectos para avanzar su proceso</p>
          </div>
          {userData?.role === 'admin' && (
            <button 
              onClick={() => setShowSettings(true)}
              className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 rounded-lg transition-colors ml-2"
              title="Configurar Etapas del Pipeline"
            >
              <Settings className="w-5 h-5" />
            </button>
          )}
          <button 
            onClick={() => setShowArchived(true)}
            className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 rounded-lg transition-colors ml-2"
            title="Ver Ganados y Perdidos"
          >
            <Archive className="w-5 h-5" />
          </button>
          {['admin', 'master'].includes(userData?.role || '') && users.length > 0 && (
            <div className="ml-4">
              <select
                value={selectedSellerId}
                onChange={(e) => setSelectedSellerId(e.target.value)}
                className="text-sm border-slate-200 rounded-md py-1.5 pl-3 pr-8 text-slate-700 focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                <option value="all">Todos los vendedores</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name || u.email}</option>
                ))}
              </select>
            </div>
          )}
        </div>
        <button 
          onClick={() => setSelectedClient({} as Client)}
          className="bg-blue-600 hover:bg-blue-700 transition-colors text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md shadow-blue-200"
        >
          + NUEVO LEAD
        </button>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        <DndContext 
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex-1 flex overflow-x-auto items-start bg-white border border-slate-200 rounded-lg">
            {activeColumns.map(col => {
              const columnClients = filteredClients.filter(c => c.status === col.id);
              return (
                <KanbanColumn key={col.id} column={col} clients={columnClients} onClientClick={setSelectedClient} tasks={tasks} />
              );
            })}
          </div>

          <TerminalDropBar columns={terminalColumns} activeId={activeId} />

          <DragOverlay zIndex={50} dropAnimation={null}>
            {activeClient ? <div className="w-[250px] shadow-2xl opacity-100 rotate-1"><ClientCard client={activeClient} tasks={tasks.filter(t => t.clientId === activeClient.id)} /></div> : null}
          </DragOverlay>
        </DndContext>
      </div>

      {selectedClient !== null && (
        <ClientDetailModal 
          client={selectedClient}
          initialStatus={columns.length > 0 ? columns[0].id : 'new'}
          onClose={() => setSelectedClient(null)} 
        />
      )}
      
      {showSettings && (
        <PipelineSettingsModal 
          onClose={() => setShowSettings(false)} 
          currentStages={columns} 
        />
      )}

      {showArchived && (
        <ArchivedClientsModal 
          onClose={() => setShowArchived(false)}
          terminalColumns={terminalColumns}
          filteredClients={filteredClients}
          tasks={tasks}
          onClientClick={setSelectedClient}
        />
      )}
    </div>
  );
}
