import React, { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useReadOnly } from "../hooks/useReadOnly";
import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  onSnapshot,
  getDoc, setDoc,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { Client, PipelineStage, Task, Deal } from "../types";
import { deduplicateClients } from "../lib/clientUtils";
import confetti from "canvas-confetti";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { KanbanColumn } from "../components/KanbanColumn";
import { SortableKanbanColumn } from "../components/SortableKanbanColumn";
import { ClientCard, SortableClientCard } from "../components/ClientCard";
import { ClientDetailModal } from "../components/ClientDetailModal";
import { PipelineSettingsModal } from "../components/PipelineSettingsModal";
import { DealWonModal } from "../components/DealWonModal";
import { LostReasonModal } from "../components/LostReasonModal";
import { checkIsWon, checkIsLost } from "../lib/clientUtils";
import { createPaymentTasks } from "../lib/paymentTasks";
import { Settings, ChevronUp, ChevronDown, Archive, X } from "lucide-react";
import clsx from "clsx";

const DEFAULT_COLUMNS: PipelineStage[] = [
  { id: "new", title: "Nuevos" },
  { id: "contacted", title: "Contactados" },
  { id: "negotiation", title: "Negociación" },
  { id: "won", title: "Ganados" },
  { id: "lost", title: "Perdidos" },
];

function isTerminalColumn(col: PipelineStage) {
  return checkIsWon(col.id, [col]) || checkIsLost(col.id, [col]);
}

function TerminalDropBar({
  columns,
  activeId,
}: {
  columns: PipelineStage[];
  activeId: string | null;
}) {
  if (!activeId) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex gap-2 w-[calc(100%-2rem)] max-w-lg">
      <div className="bg-slate-800 backdrop-blur-md shadow-2xl rounded flex items-center justify-center p-2 border border-slate-700 w-full overflow-x-auto gap-2">
        {columns.map((col) => (
          <TerminalDropZone key={`col-${col.id}`} column={col} />
        ))}
      </div>
    </div>
  );
}

function TerminalDropZone({
  column,
}: {
  column: PipelineStage;
  key?: string | number;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  let Icon: React.ReactNode = null;
  const t = String(column.title || "").toLowerCase();
  if (t.includes("ganad") || t.includes("won")) Icon = "🎉";
  else if (t.includes("perdid") || t.includes("lost")) Icon = "🗑️";
  else Icon = "➡️";

  return (
    <div
      ref={setNodeRef}
      className={clsx(
        "flex flex-col items-center justify-center flex-1 min-w-[70px] md:min-w-[90px] shrink-0 h-16 md:h-20 rounded transition-all duration-300 border-2",
        isOver
          ? "border-blue-400 bg-blue-500/20 scale-105"
          : "border-transparent bg-slate-700/50 text-slate-300 hover:bg-slate-700",
      )}
    >
      <span className="text-sm md:text-xl md:mb-1">{Icon}</span>
      <span
        className={clsx(
          "font-bold text-[9px] md:text-xs uppercase tracking-wider text-center px-1 truncate w-full",
          isOver ? "text-blue-400" : "text-slate-300",
        )}
      >
        {column.title}
      </span>
    </div>
  );
}

function ArchivedClientsModal({
  onClose,
  terminalColumns,
  filteredClients,
  tasks,
  onClientClick,
}: {
  onClose: () => void;
  terminalColumns: PipelineStage[];
  filteredClients: Client[];
  tasks: any[];
  onClientClick: (c: Client) => void;
}) {
  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex justify-end">
      <div className="w-[800px] max-w-full h-full bg-[#f4f5f5] dark:bg-slate-900 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white dark:bg-slate-800">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <Archive className="w-5 h-5 text-slate-500 dark:text-slate-400" />
            Contactos Archivados
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:bg-slate-700 rounded text-slate-500 dark:text-slate-400 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-x-auto p-6 flex gap-6">
          {terminalColumns.map((col) => {
            const columnClients = filteredClients.filter(
              (c) => c.status === col.id,

            );
            return (
              <div
                key={`col-${col.id}`}
                className="flex-1 flex flex-col min-w-[320px] max-w-[400px]"
              >
                <h3 className="font-bold text-slate-700 dark:text-slate-300 flex justify-between items-center bg-white dark:bg-slate-800 p-3 rounded shadow-sm mb-4 border border-gray-200 dark:border-slate-700">
                  {col.title}
                  <span className="bg-slate-100 dark:bg-slate-700 px-2.5 py-0.5 rounded-full text-xs text-slate-600 dark:text-slate-400 font-semibold">
                    {columnClients.length}
                  </span>
                </h3>
                <div className="flex-1 overflow-y-auto pr-2 space-y-3 pb-20">
                  {columnClients.map((client, idx) => {
                    const clientIdToUse = (client as any).originalClientId || client.id;
                    return (
                      <div
                        key={`${client.id}-${idx}`}
                        onClick={() => {
                          onClientClick(client);
                          onClose();
                        }}
                        className="cursor-pointer"
                      >
                        <ClientCard
                          client={client}
                          tasks={tasks.filter((t) => t.clientId === clientIdToUse || (t as any).dealId === client.id)}
                        />
                      </div>
                    );
                  })}
                  {columnClients.length === 0 && (
                    <div className="bg-white dark:bg-slate-800/50 border border-dashed border-slate-300 dark:border-slate-600 rounded p-8 text-center text-slate-400 text-sm">
                      No hay contactos en esta etapa
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function Kanban() {
  const { userData } = useAuth();
  const isReadOnly = useReadOnly();
  const [clients, setClients] = useState<Client[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [columns, setColumns] = useState<PipelineStage[]>(DEFAULT_COLUMNS);
  const [newColumnId, setNewColumnId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientToMarkWon, setClientToMarkWon] = useState<{ client: Client, originalStatus: string } | null>(null);
  const [clientToMarkLost, setClientToMarkLost] = useState<{ client: Client, originalStatus: string, overColumnId: string } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedSellerId, setSelectedSellerId] = useState<string>(() => {
    return localStorage.getItem("kanban_filterSeller") || "all";
  });
  const [showArchived, setShowArchived] = useState(false);

  const [tasks, setTasks] = useState<
    { clientId: string; dueDate: string; completed: boolean }[]
  >([]);

  useEffect(() => {
    if (!userData || userData.role === "master" || !userData.agencyId) return;

    const unsubscribeAgency = onSnapshot(
      doc(db, "agencies", userData.agencyId),
      (doc) => {
        let stagesFromBackend = null;
        if (doc.exists()) {
          const data = doc.data();
          if (
            data.pipelineStages &&
            Array.isArray(data.pipelineStages) &&
            data.pipelineStages.length > 0
          ) {
            stagesFromBackend = data.pipelineStages;
          }
        }
        setColumns(stagesFromBackend || DEFAULT_COLUMNS);
      },
    );

    let unsubscribeUsers = () => {};
    if (userData.role === "admin" || userData.role === "master") {
      const uq = query(
        collection(db, "users"),
        where("agencyId", "==", userData.agencyId),
      );
      unsubscribeUsers = onSnapshot(uq, (snapshot) => {
        const data = snapshot.docs.map((d) => ({ ...d.data(), id: d.id }));
        setUsers(data);
      });
    }

    let q = query(
      collection(db, "clients"),
      where("agencyId", "==", userData.agencyId),
    );
    let tq = query(
      collection(db, "tasks"),
      where("agencyId", "==", userData.agencyId),
    );

    const unsubscribeClients = onSnapshot(
      q,
      (snapshot) => {
        let data = snapshot.docs.map(
          (d) => ({ ...d.data(), id: d.id }) as Client,
        ).filter(c => !c.isDeleted);
        
        data = deduplicateClients(data);

        if (userData.role === "seller") {
          data = data.filter(
            (c) => c.sellerId === userData.id || c.visibility === "all",
          );
        }
        setClients(data);
      },
      (error) => {
        console.error("Error with snapshot", error);
      },
    );
    const unsubscribeDeals = onSnapshot(
      query(collection(db, "deals"), where("agencyId", "==", userData.agencyId)),
      (snapshot) => {
        let data = snapshot.docs.map((d) => ({ ...d.data(), id: d.id }) as Deal);
        if (userData.role === "seller") {
          data = data.filter((d) => d.sellerId === userData.id);
        }
        setDeals(data);
      }
    );

    const unsubscribeTasks = onSnapshot(tq, (snapshot) => {
      let dataDocs = snapshot.docs;
      if (userData.role === "seller") {
        dataDocs = dataDocs.filter((d) => d.data().sellerId === userData.id);
      }
      const data = dataDocs.map((d) => {
        return {
          id: d.id,
          ...d.data(),
        } as Task;
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
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const activeOriginalStatusRef = React.useRef<string | null>(null);

  const activeColumnRef = React.useRef<any>(null);

  const handleDragStart = (event: any) => {
    if (isReadOnly) return;
    setActiveId(event.active.id);
    
    if (event.active.data.current?.type === "Column") {
      activeColumnRef.current = event.active.data.current.column;
      return;
    }
    
    const client = displayClients.find((c) => c.id === event.active.id);
    if (client) {
      activeOriginalStatusRef.current = client.status || null;
    }
  };

  const handleDragOver = (event: any) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    const isActiveAClient = displayClients.some((c) => c.id === activeId);
    if (!isActiveAClient) return;

    const overClient = displayClients.find((c) => c.id === overId);
    const overColumnId = overClient ? overClient.status : overId;

    if (!columns.find((c) => c.id === overColumnId)) return;

    // Instead of just setClients, we update both to handle optimistic UI
    setDeals((prev) => {
      const dIndex = prev.findIndex((d) => d.id === activeId);
      if (dIndex !== -1 && activeId !== overId) {
        const next = [...prev];
        next[dIndex] = { ...next[dIndex], status: overColumnId as string };
        return next;
      }
      return prev;
    });
    setClients((prev) => {
      const activeIndex = prev.findIndex((c) => c.id === activeId);
      const overIndex = overClient
        ? prev.findIndex((c) => c.id === overId)
        : prev.length;

      if (activeIndex === -1) return prev;

      const activeClient = prev[activeIndex];

      if (activeClient.status !== overColumnId) {
        // Moving to a new column
        const next = [...prev];
        const movedClient = { ...activeClient, status: overColumnId as any };
        next.splice(activeIndex, 1);
        if (overClient) {
          next.splice(overIndex, 0, movedClient);
        } else {
          // Empty column drop, just place it at the end
          next.push(movedClient);
        }
        return next;
      } else if (overClient && activeIndex !== overIndex) {
        // Reordering within the same column
        const next = [...prev];
        const [movedClient] = next.splice(activeIndex, 1);
        next.splice(overIndex, 0, movedClient);
        return next;
      }

      return prev;
    });
  };

  const displayClients: Client[] = [
    ...deals.map(deal => {
      const person = clients.find(c => c.id === deal.clientId) || {} as Client;
      return {
        ...person,
        id: deal.id, // Use Deal ID so DnD and updates affect the deal
        originalClientId: deal.clientId,
        dealTitle: deal.title,
        dealValue: deal.value,
        status: deal.status || deal.stageId || "open",
        sellerId: deal.sellerId || person.sellerId,
        vehicle: deal.vehicle || person.vehicle,
      } as Client;
    }),
    ...clients.filter(c => !deals.some(d => d.clientId === c.id)).map(c => ({
      ...c,
      originalClientId: c.id,
      dealTitle: c.name ? `Trato con ${c.name}` : "Trato",
    }))
  ];

  const deduplicatedClients = Array.from(new Map(displayClients.map(c => [c.id, c])).values());

  const activeClient = activeId ? deduplicatedClients.find((c) => c.id === activeId) : null;

  const filteredClients =
    selectedSellerId === "all" ? deduplicatedClients : deduplicatedClients.filter((c) => c.sellerId === selectedSellerId);

  const activeColumns = columns.filter((c) => !isTerminalColumn(c));
  const terminalColumns = columns.filter((c) => isTerminalColumn(c));

  const handleDragEnd = async (event: any) => {
    if (isReadOnly) return;
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;
    
    if (active.data.current?.type === "Column" && userData?.agencyId) {
      const activeId = active.id.replace('col-', '');
      const overId = over.id.replace('col-', '');
      
      if (activeId !== overId) {
        const oldIndex = activeColumns.findIndex(c => c.id === activeId);
        const newIndex = activeColumns.findIndex(c => c.id === overId);
        
        if (oldIndex !== -1 && newIndex !== -1) {
          const newCols = arrayMove(activeColumns, oldIndex, newIndex);
          const finalCols = [...newCols, ...terminalColumns];
          setColumns(finalCols);
          try {
            await updateDoc(doc(db, "agencies", userData.agencyId), { pipelineStages: finalCols });
          } catch(e) {
            console.error(e);
          }
        }
      }
      return;
    }

    const clientId = active.id;
    const overClientId = over.id;
    const overClient = displayClients.find((c) => c.id === overClientId);
    const overColumnId = overClient ? overClient.status : over.id;

    if (!columns.find((c) => c.id === overColumnId)) return;

    const client = displayClients.find((c) => c.id === clientId);
    const originalStatus = activeOriginalStatusRef.current;
    
    if (client && originalStatus !== overColumnId) {
      if (userData?.role === "admin") {
        const canModify = !client.id ||
          (client.creatorId === userData?.id) ||
          (client.createdByAdmin === true) ||
          (!client.creatorId && (client.sellerId === userData?.id || !client.sellerId));
        if (!canModify) {
          alert("Como administrador, no puedes modificar el embudo de otro vendedor. Solo puedes modificar contactos o tratos creados por ti.");
          // Revert locally modified state
          setClients(prev => prev.map(c => c.id === client.id ? { ...c, status: originalStatus as string } : c));
          activeOriginalStatusRef.current = null; activeColumnRef.current = null;
          return;
        }
      }

      // The array was already modified locally in handleDragOver, 
      // we only need to persist to Firebase if the status is different from start
      try {
        const overStr = String(overColumnId || "").toLowerCase();
        const overColumn = columns.find(c => c.id === overColumnId);
        const isWon = overColumn ? checkIsWon(overColumnId, [overColumn]) : false;

        if (isWon) {
          setClientToMarkWon({ client, originalStatus: originalStatus as string });
          activeOriginalStatusRef.current = null; activeColumnRef.current = null;
          return;
        }

        const isLost = overColumn ? checkIsLost(overColumnId, [overColumn]) : false;
        if (isLost) {
          setClientToMarkLost({ client, originalStatus: originalStatus as string, overColumnId: overColumnId as string });
          activeOriginalStatusRef.current = null; activeColumnRef.current = null;
          return;
        }

        const updates: any = {
          status: overColumnId,
          updatedAt: new Date().toISOString(),
        };

        const isExistingDeal = deals.some(d => d.id === clientId);
        const actualClientId = client.originalClientId || client.id;
        if (isExistingDeal) {
          await setDoc(doc(db, "deals", clientId), updates, { merge: true });
        } else {
          // It's a legacy client being moved, create a deal
          const dealRef = doc(collection(db, "deals"));
          await setDoc(dealRef, {
            ...updates,
            id: dealRef.id,
            clientId: actualClientId,
            agencyId: userData?.agencyId,
            sellerId: client.sellerId || userData?.id,
            createdAt: new Date().toISOString(),
            title: `Trato con ${client.name}`,
            value: client.dealValue ? Number(client.dealValue) : 0,
            vehicle: client.vehicle || null,
            vehicleId: client.vehicleId || null
          });
        }
        // Also update the client's status so it stays in sync
        if (actualClientId) {
          await updateDoc(doc(db, "clients", actualClientId), {
            status: overColumnId,
            updatedAt: new Date().toISOString()
          });
        }
      } catch (e) {
        console.error("Status update error", e);
      }
    }
    
    activeOriginalStatusRef.current = null; activeColumnRef.current = null;
  };


  const handleDealWonConfirm = async (saleDetails: any) => {
    if (!clientToMarkWon) return;
    const { client } = clientToMarkWon;
    
    try {
      const updates: any = {
        status: "won",
        soldAt: new Date().toISOString().split('T')[0],
        saleDetails,
        updatedAt: new Date().toISOString(),
      };

      const isExistingDeal = deals.some(d => d.id === client.id);
      const actualClientId = client.originalClientId || client.id;
      if (isExistingDeal) {
        await setDoc(doc(db, "deals", client.id), updates, { merge: true });
      } else {
        const dealRef = doc(collection(db, "deals"));
        await setDoc(dealRef, {
          ...updates,
          id: dealRef.id,
          clientId: actualClientId,
          agencyId: userData?.agencyId,
          sellerId: client.sellerId || userData?.id,
          createdAt: new Date().toISOString(),
          title: `Trato con ${client.name}`,
          value: client.dealValue ? Number(client.dealValue) : 0,
          vehicle: client.vehicle || null,
          vehicleId: client.vehicleId || null
        });
      }
      
      if (actualClientId) {
        await updateDoc(doc(db, "clients", actualClientId), {
          status: "won",
          soldAt: new Date().toISOString().split('T')[0],
          updatedAt: new Date().toISOString()
        });
      }

      if (client.vehicleId) {
        await updateDoc(doc(db, "vehicles", client.vehicleId), {
          pendingValidation: {
            type: "sold",
            requestedBy: userData?.id,
            requestedByName: userData?.name || userData?.email,
            clientId: client.id,
            clientName: client.name,
            requestedAt: new Date().toISOString(),
          },
        });
      }

      await createPaymentTasks(db, client, saleDetails, userData);

      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#E4002B", "#25D366", "#000000"],
      });
    } catch (e) {
      console.error("Status update error", e);
    } finally {
      setClientToMarkWon(null);
    }
  };

  const handleDealWonCancel = () => {
    if (!clientToMarkWon) return;
    const { client, originalStatus } = clientToMarkWon;
    
    // Revert local state to originalStatus
    setClients(prev => prev.map(c => c.id === client.id ? { ...c, status: originalStatus } : c));
    setClientToMarkWon(null);
  };

  const handleDealLostConfirm = async (reason: string, details: string) => {
    if (!clientToMarkLost) return;
    const { client, overColumnId } = clientToMarkLost;
    const fullReason = reason === "Otro" ? details : `${reason}${details ? ` - ${details}` : ""}`;

    try {
      const updates: any = {
        status: overColumnId,
        lostReason: fullReason,
        lostAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const isExistingDeal = deals.some(d => d.id === client.id);
      const actualClientId = client.originalClientId || client.id;
      if (isExistingDeal) {
        await setDoc(doc(db, "deals", client.id), updates, { merge: true });
      } else {
        const dealRef = doc(collection(db, "deals"));
        await setDoc(dealRef, {
          ...updates,
          id: dealRef.id,
          clientId: actualClientId,
          agencyId: userData?.agencyId,
          sellerId: client.sellerId || userData?.id,
          createdAt: new Date().toISOString(),
          title: `Trato con ${client.name}`,
          value: client.dealValue ? Number(client.dealValue) : 0,
          vehicle: client.vehicle || null,
          vehicleId: client.vehicleId || null
        });
      }
      
      if (actualClientId) {
        await updateDoc(doc(db, "clients", actualClientId), {
          status: overColumnId,
          lostReason: fullReason,
          lostAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
    } catch (e) {
      console.error("Status update error", e);
    } finally {
      setClientToMarkLost(null);
    }
  };

  const handleDealLostCancel = () => {
    if (!clientToMarkLost) return;
    const { client, originalStatus } = clientToMarkLost;
    
    // Revert local state to originalStatus
    setClients(prev => prev.map(c => c.id === client.id ? { ...c, status: originalStatus } : c));
    setClientToMarkLost(null);
  };

  return (
    <div className="flex flex-col min-h-full">
      <div className="mb-4 flex flex-col sm:flex-row sm:justify-end items-start sm:items-center gap-4 shrink-0">
        <div className="flex flex-wrap items-center gap-3">
          {userData?.role === "admin" && (
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 text-slate-400 hover:bg-slate-100 dark:bg-slate-700 hover:text-slate-700 dark:text-slate-300 rounded transition-colors ml-2"
              title="Configurar Etapas del Pipeline"
            >
              <Settings className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={() => setShowArchived(true)}
            className="p-2 text-slate-400 hover:bg-slate-100 dark:bg-slate-700 hover:text-slate-700 dark:text-slate-300 rounded transition-colors ml-2"
            title="Ver Ganados y Perdidos"
          >
            <Archive className="w-5 h-5" />
          </button>
          {["admin", "master"].includes(userData?.role || "") &&
            users.length > 0 && (
              <div className="ml-4">
                <select
                  value={selectedSellerId}
                  onChange={(e) => {
                    setSelectedSellerId(e.target.value);
                    localStorage.setItem("kanban_filterSeller", e.target.value);
                  }}
                  className="text-sm border-gray-200 dark:border-slate-700 rounded-md py-1.5 pl-3 pr-8 text-slate-700 dark:text-slate-300 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-800"
                >
                  <option value="all">Todos los vendedores</option>
                  {users.map((u) => (
                    <option key={`user-${u.id}`} value={u.id}>
                      {(!u.name || u.name === 'Usuario Pendiente')
                        ? (u.role === 'admin' ? 'Administrador' : u.email?.split('@')[0] || 'Usuario')
                        : u.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
        </div>
        <button
          onClick={() => setSelectedClient({} as Client)}
          className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transition-colors text-white px-4 py-2 rounded text-xs font-bold shadow-sm shadow-blue-200"
        >
          + NUEVO TRATO
        </button>
      </div>

      <div className="flex flex-col flex-1 min-h-0">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex flex-1 overflow-x-auto snap-x snap-mandatory md:snap-none items-stretch bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded">
            <SortableContext items={activeColumns.map((c) => `col-${c.id}`)} strategy={horizontalListSortingStrategy}>
              {activeColumns.map((col, index) => {
                const columnClients = filteredClients.filter(
                  (c) => {
                    if (c.status === col.id) return true;
                    if (index === 0) {
                      const isActiveCol = activeColumns.some(ac => ac.id === c.status);
                      const isTermCol = terminalColumns.some(tc => tc.id === c.status);
                      if (!isActiveCol && !isTermCol && !checkIsWon(c.status, columns) && !checkIsLost(c.status, columns)) return true;
                    }
                    return false;
                  }
                );
                return (
                  <SortableKanbanColumn
                    key={`${col.id}-${index}`}
                    column={col}
                    clients={columnClients}
                    onClientClick={setSelectedClient}
                    tasks={tasks}
                    isFirst={index === 0}
                    isLast={index === activeColumns.length - 1}
                    onTitleChange={async (newTitle) => {
                      if (!userData?.agencyId) return;
                      const newColumns = columns.map(c => c.id === col.id ? { ...c, title: newTitle } : c);
                      setColumns(newColumns); // optimistic update
                      try {
                        await updateDoc(doc(db, "agencies", userData.agencyId), { pipelineStages: newColumns });
                      } catch (e) {
                        console.error(e);
                      }
                    }}
                    onMoveLeft={async () => {
                      if (index > 0 && userData?.agencyId) {
                        const newCols = [...activeColumns];
                        const temp = newCols[index];
                        newCols[index] = newCols[index - 1];
                        newCols[index - 1] = temp;
                        const finalCols = [...newCols, ...terminalColumns];
                        setColumns(finalCols);
                        await updateDoc(doc(db, "agencies", userData.agencyId), { pipelineStages: finalCols });
                      }
                    }}
                    onMoveRight={async () => {
                      if (index < activeColumns.length - 1 && userData?.agencyId) {
                        const newCols = [...activeColumns];
                        const temp = newCols[index];
                        newCols[index] = newCols[index + 1];
                        newCols[index + 1] = temp;
                        const finalCols = [...newCols, ...terminalColumns];
                        setColumns(finalCols);
                        await updateDoc(doc(db, "agencies", userData.agencyId), { pipelineStages: finalCols });
                      }
                    }}
                    autoFocusEdit={newColumnId === col.id}
                    onAddRight={async () => {
                      if (!userData?.agencyId) return;
                      const newId = `stage_${Date.now()}`;
                      const newStage = { id: newId, title: "Nueva Etapa" };
                      const newCols = [...activeColumns];
                      newCols.splice(index + 1, 0, newStage);
                      const finalCols = [...newCols, ...terminalColumns];
                      setColumns(finalCols);
                      setNewColumnId(newId);
                      try {
                        await updateDoc(doc(db, "agencies", userData.agencyId), { pipelineStages: finalCols });
                      } catch (e) {
                        console.error(e);
                      }
                    }}
                  />
                );
              })}
            </SortableContext>
          </div>

          <TerminalDropBar
            columns={terminalColumns}
            activeId={activeId}
          />

          <DragOverlay zIndex={50} dropAnimation={null}>
            {activeClient ? (
              <div className="w-[250px] shadow-2xl opacity-100 rotate-1">
                <ClientCard
                  client={activeClient}
                  tasks={tasks.filter((t) => t.clientId === activeClient.id)}
                />
              </div>
            ) : activeColumnRef.current ? (
              <div className="w-[270px] shadow-2xl opacity-100 rotate-2">
                <div className="flex flex-col px-4 py-3 shrink-0 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 relative">
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[14px] font-bold text-slate-800 dark:text-slate-100">{activeColumnRef.current.title}</span>
                  </div>
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {selectedClient !== null && (
        <ClientDetailModal
          client={selectedClient}
          initialStatus={columns.length > 0 ? columns[0].id : "new"}
          onClose={() => setSelectedClient(null)}
        />
      )}

      {showSettings && (
        <PipelineSettingsModal
          onClose={() => setShowSettings(false)}
          currentStages={columns}
        />
      )}

      {clientToMarkWon && (
        <DealWonModal
          client={clientToMarkWon.client}
          onConfirm={handleDealWonConfirm}
          onCancel={handleDealWonCancel}
        />
      )}
      {clientToMarkLost && (
        <LostReasonModal
          isOpen={!!clientToMarkLost}
          clientName={clientToMarkLost.client.name}
          onConfirm={handleDealLostConfirm}
          onClose={handleDealLostCancel}
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
