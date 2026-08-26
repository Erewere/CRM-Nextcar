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
import { Client, PipelineStage, Task, Deal, Vehicle } from "../types";
import confetti from "canvas-confetti";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
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
import { MoverTratoMovil } from "../components/MoverTratoMovil";
import { checkIsWon, checkIsLost } from "../lib/clientUtils";
import { puedeVenderSinAprobacion, vehiculoVendido } from "../lib/ventaDeVehiculo";
import { ventaYaRegistrada, avisoDeVentaDuplicada } from "../lib/ventas";
import { createPaymentTasks } from "../lib/paymentTasks";
import { Settings, ChevronUp, ChevronDown, Archive, X, Search } from "lucide-react";
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
                          tasks={tasks.filter((t) => t.clientId === clientIdToUse || t.clientId === client.id || (t as any).dealId === client.id)}
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
  // Que trato esta esperando elegir etapa desde el telefono.
  const [tratoAMover, setTratoAMover] = useState<Client | null>(null);
  // Para poder distinguir «no hay tratos» de «no se pudieron leer».
  const [errorDeTratos, setErrorDeTratos] = useState<string | null>(null);
  const [dealsRecibidos, setDealsRecibidos] = useState<number | null>(null);
  const carrusel = React.useRef<HTMLDivElement | null>(null);

  const [clientToMarkWon, setClientToMarkWon] = useState<{ client: Client, originalStatus: string } | null>(null);
  const [clientToMarkLost, setClientToMarkLost] = useState<{ client: Client, originalStatus: string, overColumnId: string } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSellerId, setSelectedSellerId] = useState<string>(() => {
    return localStorage.getItem("kanban_filterSeller") || "all";
  });
  const [showArchived, setShowArchived] = useState(false);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

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
    if (userData.role === "admin") {
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
        setDealsRecibidos(data.length);
        if (userData.role === "seller") {
          data = data.filter((d) => d.sellerId === userData.id);
        }
        setDeals(data);
        setErrorDeTratos(null);
      },
      // Esta suscripcion no tenia manejo de error: si Firestore la rechazaba,
      // el embudo salia vacio sin decir nada y parecia que no habia tratos.
      // Un embudo vacio y un embudo que no se pudo leer son cosas distintas.
      (error) => {
        console.error("Error leyendo los tratos", error);
        setErrorDeTratos(error?.message || String(error));
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

    const vq = query(
      collection(db, "vehicles"),
      where("agencyId", "==", userData.agencyId)
    );
    const unsubscribeVehicles = onSnapshot(vq, (snapshot) => {
      const vData = snapshot.docs.map((d) => ({ ...d.data(), id: d.id } as Vehicle));
      setVehicles(vData);
    });

    return () => {
      unsubscribeAgency();
      unsubscribeClients();
      unsubscribeTasks();
      unsubscribeUsers();
      unsubscribeVehicles();
    };
  }, [userData]);

  /**
   * El raton y el dedo se separan a proposito.
   *
   * Antes los dos usaban el mismo sensor, que empieza a arrastrar a los cinco
   * pixeles de movimiento. Con el raton esta bien; con el dedo, cinco pixeles
   * es exactamente el principio de un deslizamiento para ver la siguiente
   * etapa. Asi que en el telefono cada intento de desplazarse arrancaba un
   * arrastre y la pantalla se quedaba trabada: de ahi que casi no se pudiera
   * mover nada.
   *
   * Con el dedo ahora hay que mantener pulsado un momento para arrastrar, y un
   * deslizamiento normal vuelve a desplazar la pantalla. Aun asi, arrastrar en
   * un telefono es incomodo -- la etapa de destino esta fuera de la pantalla --
   * por eso ahi se mueve tocando, con la hoja de «Mover a».
   */
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
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
        status: deal.status || "open",
        sellerId: deal.sellerId || person.sellerId,
        vehicle: deal.vehicle || person.vehicle,
      } as Client;
    }),
    // El embudo representa tratos, no contactos. Un contacto sin trato vive
    // en Personas; para incorporarlo al embudo se usa "+ NUEVO TRATO", que
    // permite buscar a la persona existente y reutilizarla.
  ];

  const deduplicatedClients = Array.from(new Map(displayClients.map(c => [c.id, c])).values());

  const activeClient = activeId ? deduplicatedClients.find((c) => c.id === activeId) : null;

  // Busqueda sobre las tarjetas del embudo: nombre, titulo del trato, datos de
  // contacto y el auto, ya sea el texto escrito o el vehiculo enlazado.
  const filteredClients = deduplicatedClients.filter((c) => {
    if (selectedSellerId !== "all" && c.sellerId !== selectedSellerId) return false;
    if (!searchQuery.trim()) return true;

    const q = searchQuery.toLowerCase().trim();
    const enTexto = [c.name, c.dealTitle, c.phone, c.email, c.vehicle]
      .some((campo) => String(campo || "").toLowerCase().includes(q));
    if (enTexto) return true;

    if (c.vehicleId) {
      const v = vehicles.find((veh) => veh.id === c.vehicleId);
      if (v) {
        const ficha = `${v.year || ""} ${v.make || ""} ${v.model || ""} ${v.vin || ""} ${v.color || ""}`;
        if (ficha.toLowerCase().includes(q)) return true;
      }
    }
    return false;
  });

  const activeColumns = columns.filter((c) => !isTerminalColumn(c));
  const terminalColumns = columns.filter((c) => isTerminalColumn(c));

  /**
   * Mover un trato de etapa, venga de donde venga el gesto.
   *
   * Arrastrar con el raton y tocar «Mover a» en el telefono tienen que acabar
   * en lo mismo: los mismos permisos, las mismas ventanas de venta ganada o
   * perdida y las mismas escrituras. Con la logica repetida en dos sitios, la
   * del telefono se habria quedado atras a la primera correccion.
   *
   * Devuelve false solo cuando el asesor no puede mover ese trato, para que
   * quien arrastro pueda devolver la tarjeta a su sitio.
   */
  const moverTratoAEtapa = async (
    client: Client,
    destinoId: string,
    origenStatus?: string | null
  ): Promise<boolean> => {
    if (isReadOnly) return true;
    const columna = columns.find((c) => c.id === destinoId);
    if (!columna) return true;

    const desde = origenStatus ?? client.status;
    if (desde === destinoId) return true;

    // Un administrador supervisa el embudo completo de su agencia: puede mover
    // el trato de cualquier asesor, igual que ya podia reasignarlo desde la
    // ficha del contacto.
    if (userData?.role !== "admin" && userData?.role !== "master") {
      // Un asesor mueve lo que trae asignado, lo que creo el mismo y lo que
      // esta sin asignar. Todo lo demas se lo reasigna un administrador.
      const esSuyo =
        !client.id ||
        client.sellerId === userData?.id ||
        !client.sellerId ||
        client.creatorId === userData?.id;
      if (!esSuyo) {
        alert("Este trato está asignado a otro asesor. Pide a un administrador que te lo reasigne.");
        return false;
      }
    }

    // Ganado y perdido no son un cambio de etapa a secas: piden los datos de la
    // venta o el motivo, y de ahi salen la venta del auto y sus tareas.
    if (checkIsWon(destinoId, [columna])) {
      setClientToMarkWon({ client, originalStatus: desde as string });
      return true;
    }
    if (checkIsLost(destinoId, [columna])) {
      setClientToMarkLost({ client, originalStatus: desde as string, overColumnId: destinoId });
      return true;
    }

    try {
      const updates: any = { status: destinoId, updatedAt: new Date().toISOString() };
      const actualClientId = client.originalClientId || client.id;

      if (deals.some((d) => d.id === client.id)) {
        await setDoc(doc(db, "deals", client.id as string), updates, { merge: true });
      } else {
        // Es un contacto antiguo sin trato: se le crea uno al moverlo.
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
          vehicleId: client.vehicleId || null,
        });
      }

      if (actualClientId) {
        await updateDoc(doc(db, "clients", actualClientId), {
          status: destinoId,
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (e) {
      console.error("Status update error", e);
    }
    return true;
  };

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
      const sePudo = await moverTratoAEtapa(client, overColumnId as string, originalStatus);
      if (!sePudo) {
        // handleDragOver ya habia movido la tarjeta en pantalla; se devuelve.
        setClients((prev) =>
          prev.map((c) => (c.id === client.id ? { ...c, status: originalStatus as string } : c))
        );
      }
    }

    activeOriginalStatusRef.current = null; activeColumnRef.current = null;
  };


  const handleDealWonConfirm = async (saleDetails: any) => {
    if (!clientToMarkWon) return;
    const { client } = clientToMarkWon;
    
    try {
      // Varios tratos pueden traer el mismo auto asignado; vendido, solo uno.
      const conflicto = await ventaYaRegistrada(
        client.vehicleId,
        userData?.agencyId,
        client.id
      );
      if (conflicto) {
        alert(avisoDeVentaDuplicada(conflicto));
        return;
      }

      const updates: any = {
        status: "won",
        soldAt: new Date().toISOString().split('T')[0],
        saleDetails,
        value: saleDetails?.price || client.dealValue || 0,
        updatedAt: new Date().toISOString(),
      };

      const isExistingDeal = deals.some(d => d.id === client.id);
      const actualClientId = client.originalClientId || client.id;
      let idTrato: string;
      if (isExistingDeal) {
        idTrato = client.id as string;
        await setDoc(doc(db, "deals", idTrato), updates, { merge: true });
      } else {
        const dealRef = doc(collection(db, "deals"));
        idTrato = dealRef.id;
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
        // El contacto guarda la referencia -- que compro y de que trato fue --
        // pero el dinero vive solo en el trato. Cuando la venta se guardaba
        // completa en los dos, borrar el trato dejaba al contacto anunciando
        // una venta que ya no existia, con su saldo y todo.
        await updateDoc(doc(db, "clients", actualClientId), {
          status: "won",
          soldAt: new Date().toISOString().split('T')[0],
          ventaDealId: idTrato,
          updatedAt: new Date().toISOString()
        });
      }

      if (client.vehicleId) {
        const currentVehicle = vehicles.find(v => v.id === client.vehicleId);
        const originalPrice = currentVehicle?.price || client.dealValue || 0;
        const proposedPrice = saleDetails?.price ? Number(saleDetails.price) : originalPrice;
        const hasPriceChange = originalPrice > 0 && originalPrice !== proposedPrice;

        if (puedeVenderSinAprobacion(userData?.role)) {
          // Quien cierra la venta ya tiene permiso para confirmarla: el auto
          // sale del inventario ahora, no cuando alguien se acuerde de
          // aprobarlo.
          await updateDoc(doc(db, "vehicles", client.vehicleId), vehiculoVendido({
            clientId: actualClientId,
            clientName: client.name,
            dealId: idTrato || client.id,
            precio: proposedPrice,
            saleDetails,
          }));
        } else {
        await updateDoc(doc(db, "vehicles", client.vehicleId), {
          pendingValidation: {
            type: "sold",
            requestedBy: userData?.id,
            requestedByName: userData?.name || userData?.email,
            clientId: actualClientId,
            dealId: client.id,
            clientName: client.name,
            originalPrice,
            proposedPrice,
            // El costo no se copia aqui: nadie lo leia de este registro, y
            // quien cierra una venta no necesariamente puede verlo.
            hasPriceChange,
            saleDetails: saleDetails ? { ...saleDetails, price: proposedPrice } : { price: proposedPrice, method: 'contado' },
            vehicle: client.vehicle || (currentVehicle ? `${currentVehicle.year} ${currentVehicle.make} ${currentVehicle.model}` : null),
            requestedAt: new Date().toISOString(),
          },
        });
        }
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
      <div className="mb-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
        <div className="relative w-full md:w-80 lg:w-96">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar trato, cliente, teléfono, auto..."
              className="w-full pl-9 pr-8 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 shadow-sm transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 p-0.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                title="Limpiar búsqueda"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 justify-end">
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

      {/* Fichas de etapas, solo en el telefono.
          Alli se ve una etapa a la vez y las demas quedan fuera de la
          pantalla, asi que para llegar a la ultima habia que deslizar tantas
          veces como etapas tenga el embudo, sin saber cuantas faltaban. Aqui
          estan todas con su conteo y se salta a cualquiera de un toque. */}
      <div className="md:hidden flex gap-2 overflow-x-auto px-1 pb-2 shrink-0">
        {activeColumns.map((col) => {
          const cuantos = filteredClients.filter((c) => c.status === col.id).length;
          return (
            <button
              key={`ficha-${col.id}`}
              onClick={() =>
                carrusel.current
                  ?.querySelector(`[data-etapa="${col.id}"]`)
                  ?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" })
              }
              className="shrink-0 flex items-center gap-1.5 rounded-full border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 active:bg-slate-100 dark:active:bg-slate-700"
            >
              <span className="truncate max-w-[110px]">{col.title}</span>
              <span className="rounded-full bg-slate-100 dark:bg-slate-700 px-1.5 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                {cuantos}
              </span>
            </button>
          );
        })}
      </div>

      {/* Un embudo vacio callado no dice si no hay tratos o si no se pudieron
          leer. Con 28 tratos en la agencia y la pantalla en blanco, esa
          diferencia es justo lo que hace falta saber. */}
      {filteredClients.length === 0 && (
        <div className="mb-3 rounded border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-900/20 px-3 py-2.5 text-xs text-amber-800 dark:text-amber-200 shrink-0">
          {errorDeTratos ? (
            <>
              <span className="font-bold">No se pudieron leer los tratos.</span> {errorDeTratos}
            </>
          ) : dealsRecibidos === null ? (
            <>
              <span className="font-bold">La consulta de tratos no ha respondido.</span>{" "}
              Ni datos ni error. Si esto no cambia en unos segundos, la suscripción no llegó
              a crearse.
            </>
          ) : dealsRecibidos === 0 ? (
            <>
              <span className="font-bold">Llegaron 0 tratos de esta agencia.</span> Las etapas
              sí cargaron, así que la agencia y la conexión están bien. Suele ser que esta
              sesión entre con otra cuenta.
            </>
          ) : (
            <>
              <span className="font-bold">
                Llegaron {dealsRecibidos} tratos, pero ninguno se está mostrando.
              </span>{" "}
              El problema no es la lectura, es cómo se reparten por etapa. Etapas activas:{" "}
              {activeColumns.length}. Contactos: {clients.length}.
            </>
          )}
        </div>
      )}

      <div className="flex flex-col flex-1 min-h-0">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div ref={carrusel} className="flex flex-1 overflow-x-auto snap-x snap-mandatory md:snap-none items-stretch bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded">
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
                    onMoverCliente={setTratoAMover}
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
                  tasks={tasks.filter((t) => t.clientId === (activeClient.originalClientId || activeClient.id) || t.clientId === activeClient.id || (t as any).dealId === activeClient.id)}
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

      {tratoAMover && (
        <MoverTratoMovil
          client={tratoAMover}
          columnas={columns}
          onCerrar={() => setTratoAMover(null)}
          onElegir={async (etapaId) => {
            const trato = tratoAMover;
            setTratoAMover(null);
            // La misma funcion que usa el arrastre: mismos permisos, mismas
            // ventanas de venta ganada o perdida, mismas escrituras.
            await moverTratoAEtapa(trato, etapaId, trato.status);
          }}
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
          vehicle={vehicles.find(v => v.id === clientToMarkWon.client.vehicleId)}
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
