import { motion, AnimatePresence } from "motion/react";
import { quitarVentaDeTratoPerdido } from "../lib/ventaDescartada";
import { completarValorDelTrato } from "../lib/valorDelTrato";
import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router";
import imageCompression from "browser-image-compression";
import { Client, Task, ClientFile, Vehicle, Deal } from "../types";
import { getClientMatches } from "../services/matchingEngine";
import { useAuth } from "../contexts/AuthContext";
import { db, storage } from "../lib/firebase";
import { useReadOnly } from "../hooks/useReadOnly";
import { usePermissions } from "../hooks/usePermissions";
import { ventaYaRegistrada, avisoDeVentaDuplicada, elegirTratoDeLaVenta, elegirTratoAbierto, tratoConVenta } from "../lib/ventas";
import { hoyLocal } from "../lib/fechas";
import { EscribirAlCliente } from "./EscribirAlCliente";
import { ResumenBusquedaAuto, frasesDeBusqueda } from "./ResumenBusquedaAuto";
import {
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  getDoc,
  orderBy,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import {
  X,
  FileText,
  Upload,
  Calendar,
  CheckSquare,
  Phone,
  MessageCircle,
  MoreHorizontal,
  User,
  Tag,
  Clock,
  Building2,
  Globe,
  Eye,
  Users,
  Edit2, Target, Calculator, Lock, Car, Trash2, Plus, CheckCircle2, ChevronRight, ChevronLeft, ChevronDown, ChevronUp, Search,
  Check,
  Trophy,
  XCircle,
  RotateCcw,
} from "lucide-react";
import clsx from "clsx";
import { TimeSelect } from "./TimeSelect";
import { DealWonModal } from "./DealWonModal";
import { LostReasonModal } from "./LostReasonModal";
import { PaymentModal } from "./PaymentModal";
import { VehicleDetailModal } from "./VehicleDetailModal";
import { ResumenCliente } from "./ficha/ResumenCliente";
import { Cotizador } from "./Cotizador";
import { NewActivityModal } from "./NewActivityModal";
import { createPaymentTasks } from "../lib/paymentTasks";
import { ventasApi } from "../lib/ventasApi";
import { checkIsWon, checkIsLost, sanitizeFirestoreData } from "../lib/clientUtils";
import { aplicarEtapaAlTrato } from "../lib/etapaDelContacto";
import { avisarEtapaCredito } from "../lib/creditoDesdeEmbudo";
import { FUENTES, etiquetaDeFuente, fuenteDelContacto } from "../lib/fuentes";

import { puedeVenderSinAprobacion, vehiculoVendido, esElCompradorDelVehiculo } from "../lib/ventaDeVehiculo";
interface Props {
  client: Client | Partial<Client>;
  initialStatus?: string;
  onClose: () => void;
  onUpdated?: () => void;
}

export function ClientDetailModal({
  client: clientRecibido,
  initialStatus = "new",
  onClose,
  onUpdated,
}: Props) {
  const { userData, agencyData } = useAuth();
  const navigate = useNavigate();
  // Cotizar: false = cerrado; null = elegir el auto; un auto = ese.
  const [cotizandoAuto, setCotizandoAuto] = useState<Vehicle | null | false>(false);
  // Cerrar en dos tiempos: primero se anima la salida, y cuando termina se
  // avisa de verdad a quien abrio la ventana. Antes se desmontaba en el acto y
  // la animacion de salida no llegaba a verse nunca.
  const [cerrando, setCerrando] = useState(false);
  const cerrar = () => setCerrando(true);

  /**
   * Al crear un trato, la ventana se queda abierta en vez de cerrarse.
   *
   * Las notas, los archivos y las actividades son registros aparte que tienen
   * que apuntar al trato, asi que mientras el trato no existe no hay donde
   * colgarlos y la pantalla los tiene apagados. Antes guardar cerraba la
   * ventana, y para escribir la primera nota habia que volver a buscar el
   * trato y abrirlo otra vez.
   *
   * Toda la pantalla decide si es nuevo con `!client.id`, asi que basta con
   * darle la identidad del trato recien creado: a partir de ahi se comporta
   * como un trato de siempre, las pestañas se encienden solas y los datos se
   * cargan de la base.
   */
  const [recienCreado, setRecienCreado] = useState<{ id: string; originalClientId: string } | null>(null);
  // Sin la ventana cerrandose no hay senal de que se guardo, asi que se dice.
  const [avisoDeCreado, setAvisoDeCreado] = useState(false);
  useEffect(() => {
    if (!avisoDeCreado) return;
    const t = setTimeout(() => setAvisoDeCreado(false), 6000);
    return () => clearTimeout(t);
  }, [avisoDeCreado]);
  const client = useMemo(
    () => (recienCreado && !clientRecibido.id ? { ...clientRecibido, ...recienCreado } : clientRecibido),
    [clientRecibido, recienCreado]
  );
  /**
   * Escribe sobre un trato solo si sigue existiendo.
   *
   * setDoc con merge crea el documento cuando no esta, asi que guardar la
   * ficha despues de borrar un trato lo resucitaba -- y sin agencyId, porque
   * estos guardados solo mandan los campos que cambiaron. La regla de
   * Firestore lo rechazaba por eso, con un "permisos insuficientes" que no
   * decia nada. Un trato borrado debe quedarse borrado.
   */
  /**
   * Devuelve el trato donde registrar una venta, creandolo si el contacto no
   * tiene ninguno.
   *
   * Una venta cerrada desde el embudo siempre queda en un trato, pero cerrada
   * desde esta ficha o desde el celular podia quedar solo en el contacto. Esa
   * es la razon de que la misma venta viva en dos sitios distintos segun por
   * donde se cerro. Solo se crea al cerrar una venta: un contacto sin
   * operacion sigue pudiendo existir sin trato.
   */
  const tratosDelContacto = async (clientId: string): Promise<any[]> => {
    const q = (userData?.role !== "master" && userData?.agencyId)
      ? query(collection(db, "deals"), where("clientId", "==", clientId), where("agencyId", "==", userData.agencyId))
      : query(collection(db, "deals"), where("clientId", "==", clientId));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ ...d.data(), id: d.id }));
  };

  // Crea el trato de la venta cuando el contacto no tiene ninguno que sirva.
  // Cual de los existentes es "el de la venta" lo decide elegirTratoDeLaVenta.
  const crearTratoDeVenta = async (clientId: string): Promise<string> => {
    const ref = doc(collection(db, "deals"));
    await setDoc(ref, {
      id: ref.id,
      clientId,
      agencyId: userData?.agencyId,
      sellerId: formData.sellerId || client.sellerId || userData?.id,
      title: `Trato con ${formData.name || client.name || "cliente"}`,
      value: Number(formData.dealValue) || 0,
      vehicleId: formData.vehicleId || client.vehicleId || null,
      vehicle: formData.vehicle || client.vehicle || null,
      status: "new",
      createdAt: new Date().toISOString(),
    });
    return ref.id;
  };

  const guardarTratoSiExiste = async (dealId: string, datos: any) => {
    const ref = doc(db, "deals", dealId);
    const actual = await getDoc(ref);
    if (!actual.exists()) return false;
    // updateDoc, no setDoc con merge: merge mezclaba la venta nueva con la
    // anterior campo por campo (un «contado» encima de un plan de crédito).
    await updateDoc(ref, datos);
    return true;
  };

  const [escribiendoWhatsApp, setEscribiendoWhatsApp] = useState(false);
  const isReadOnly = useReadOnly();
  const { can } = usePermissions();
  // Borrar un trato pierde su historial, asi que no lo hace cualquiera.
  const puedeEliminarTratos = can('tratos.eliminar') && !isReadOnly;
  const isNew = !client.id;
  const canModify = !isReadOnly && (isNew ||
    (userData?.role === "admin" || userData?.role === "master") ||
    (client.creatorId === userData?.id) ||
    (client.createdByAdmin === true) ||
    (!client.creatorId && (client.sellerId === userData?.id || !client.sellerId)));
  const canRegisterPayments = !isReadOnly && (userData?.role === "master" || userData?.role === "admin");
  const isAdminReadOnly = isReadOnly || (userData?.role === "admin" && !canModify);

  const isDealContext = client.originalClientId !== undefined || isNew;
  const [showDealWonModal, setShowDealWonModal] = useState(false);
  const [showLostReasonModal, setShowLostReasonModal] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showPaymentDrawer, setShowPaymentDrawer] = useState(false);
  const [selectedVehicleForModal, setSelectedVehicleForModal] = useState<Vehicle | null>(null);
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [newTaskPrefill, setNewTaskPrefill] = useState<any>(null);
  const [formData, setFormData] = useState<Partial<Client>>(
    isNew
      ? {
          status: initialStatus,
          origin: "manual",
          agencyId: userData?.agencyId,
          sellerId: userData?.id,
          creatorId: userData?.id,
          createdByAdmin: userData?.role === "admin" ? true : false,
          tags: [],
        }
      : { tags: [], ...client },
  );
  const [tasks, setTasks] = useState<Task[]>([]);
  const [files, setFiles] = useState<ClientFile[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [inventoryVehicles, setInventoryVehicles] = useState<Vehicle[]>([]);
  const [agencyUsers, setAgencyUsers] = useState<any[]>([]);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        let q;
        if (userData?.role === 'master') {
          q = query(collection(db, "users"));
        } else if (userData?.agencyId) {
          q = query(
            collection(db, "users"),
            where("agencyId", "==", userData.agencyId),
          );
        } else {
          return;
        }
        const s = await getDocs(q);
        setAgencyUsers(s.docs.map((d) => ({ ...(d.data() as object), id: d.id })));
      } catch (err) {
        console.error("Error loading users:", err);
      }
    };
    loadUsers();
  }, [userData?.agencyId, userData?.role]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);

  useEffect(() => {
    if (!userData) return;
    const fetchAvailableTags = async () => {
      const agencyId = userData?.agencyId || "master_agency";
      try {
        const q = query(
          collection(db, "agency_tags"),
          where("agencyId", "==", agencyId),
        );
        const snap = await getDocs(q);
        if (snap.empty) {
          setAvailableTags(["Venta", "Compra", "Busca de auto", "Crédito"]);
        } else {
          setAvailableTags(
            Array.from(
              new Set(snap.docs.map((doc) => doc.data().name).filter(Boolean)),
            ),
          );
        }
      } catch (err) {
        console.error("Error loading tags:", err);
        setAvailableTags(["Venta", "Compra", "Busca de auto", "Crédito"]);
      }
    };
    fetchAvailableTags();
  }, [userData]);

  const handleTagToggle = (tag: string) => {
    setFormData((prev) => {
      const currentTags = prev.tags || [];
      const updatedTags = currentTags.includes(tag)
        ? currentTags.filter((t) => t !== tag)
        : [...currentTags, tag];
      return { ...prev, tags: updatedTags };
    });
  };

  const [deals, setDeals] = useState<Deal[]>([]);

  /**
   * Trae la venta desde el trato cuando la ficha se abre sin contexto de trato.
   *
   * Desde el embudo se escucha el trato directamente, pero desde Personas no
   * habia a quien escuchar y la venta se leia del contacto. Ahora que el
   * dinero solo vive en el trato, hay que ir por el: primero el que la ficha
   * señala como suyo, y si no, el que este marcado como ganado.
   */
  useEffect(() => {
    if (isNew) return;
    const esContextoDeTrato = Boolean(client.originalClientId && client.originalClientId !== client.id);
    if (esContextoDeTrato || deals.length === 0) return;

    const referencia = (client as any).ventaDealId;
    const tratoDeLaVenta =
      deals.find((d) => d.id === referencia) ||
      deals.find((d: any) => checkIsWon(d.status) || d.saleDetails?.price);
    if (!tratoDeLaVenta) return;

    const v: any = tratoDeLaVenta;
    setFormData((prev) => ({
      ...prev,
      saleDetails: prev.saleDetails || v.saleDetails,
      dealValue: prev.dealValue ?? (v.saleDetails?.price ?? v.value),
      soldAt: prev.soldAt || v.soldAt,
    }));
  }, [deals, isNew]);
  const [activeTab, setActiveTab] = useState<"activity" | "notes" | "files" | "deals">("activity");
  // Menu de la izquierda (solo en computadora; en el telefono se ve todo en
  // una columna, como antes). Nada se desmonta al cambiar de seccion: solo se
  // esconde, asi el formulario y lo que se este escribiendo no se pierden.
  type Seccion = "resumen" | "datos" | "autos" | "tratos" | "notas" | "archivos";
  const [seccion, setSeccion] = useState<Seccion>("resumen");
  const irASeccion = (s: Seccion) => {
    setSeccion(s);
  };
  const [businessHours, setBusinessHours] = useState({ start: 8, end: 20 });
  
  useEffect(() => {
    if (!userData || userData.role === "master" ) return;
    if (userData.agencyId && userData.agencyId !== "unassigned") {
      const unsubscribe = onSnapshot(doc(db, "agencies", userData.agencyId), (snap) => {
        if (snap.exists() && snap.data().businessHours) {
          const bh = snap.data().businessHours;
          setBusinessHours({
            start: parseInt(bh.start.split(":")[0], 10),
            end: parseInt(bh.end.split(":")[0], 10)
          });
        }
      });
      return () => unsubscribe();
    }
  }, [userData]);
  const [showFullAddress, setShowFullAddress] = useState(
    !!(client.street || client.exteriorNumber || client.neighborhood || client.city || client.zipCode)
  );
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDate, setNewTaskDate] = useState("");
  const getDefaultTime = () => {
    const now = new Date();
    let mins = now.getMinutes();
    let hrs = now.getHours();
    mins = Math.ceil(mins / 15) * 15;
    if (mins === 60) {
      mins = 0;
      hrs += 1;
    }
    hrs = hrs % 24;
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
  };

  const [newTaskTime, setNewTaskTime] = useState(getDefaultTime());
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [newNoteContent, setNewNoteContent] = useState("");
  const [pipelineStages, setPipelineStages] = useState<
    { id: string; title: string }[]
  >([
    { id: "new", title: "Nuevos" },
    { id: "contacted", title: "Contactados" },
    { id: "negotiation", title: "Negociación" },
    { id: "credito", title: "Crédito" },
    { id: "won", title: "Ganados" },
    { id: "lost", title: "Perdidos" },
  ]);

  useEffect(() => {
    if (userData?.agencyId) {
      import("firebase/firestore").then(({ doc, getDoc }) => {
        getDoc(doc(db, "agencies", userData.agencyId as string))
          .then((docSnap) => {
            if (docSnap.exists()) {
              const data = docSnap.data();
              if (
                data.pipelineStages &&
                Array.isArray(data.pipelineStages) &&
                data.pipelineStages.length > 0
              ) {
                setPipelineStages(data.pipelineStages);
                setFormData((prev) => {
                  if (isNew && prev.status === "new") {
                    return { ...prev, status: data.pipelineStages[0].id };
                  }
                  return prev;
                });
              }
            }
          })
          .catch(console.error);
      });
    }
  }, [userData?.agencyId, isNew]);

  useEffect(() => {
    if (userData?.agencyId) {
      const q = query(
        collection(db, "vehicles"),
        where("agencyId", "==", userData.agencyId),
      );
      getDocs(q)
        .then((snap) => {
          setInventoryVehicles(
            snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Vehicle),
          );
        })
        .catch(console.error);
    } else if (userData?.role === "master") {
      const q = query(
        collection(db, "vehicles"),
      );
      getDocs(q)
        .then((snap) => {
          setInventoryVehicles(
            snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Vehicle),
          );
        })
        .catch(console.error);
    }
  }, [userData]);

  useEffect(() => {
    if (isNew) return;
    const actualClientId = client.originalClientId || client.id;
    if (!actualClientId) return;

    const unsubClient = onSnapshot(doc(db, "clients", actualClientId), (snap) => {
      if (snap.exists()) {
        const cData = snap.data() as Client;
        setFormData((prev) => ({
          ...prev,
          ...cData,
          dealValue: cData.saleDetails?.price !== undefined ? cData.saleDetails.price : (cData.dealValue !== undefined ? cData.dealValue : prev.dealValue),
          saleDetails: cData.saleDetails,
          soldAt: cData.soldAt || prev.soldAt,
          status: cData.status || prev.status,
          vehicle: cData.vehicle || prev.vehicle,
          vehicleId: cData.vehicleId || prev.vehicleId,
        }));
      }
    });

    const isDeal = Boolean(client.originalClientId && client.originalClientId !== client.id);
    const dealIdToListen = isDeal ? client.id : null;

    let unsubDeal: (() => void) | null = null;
    if (dealIdToListen) {
      unsubDeal = onSnapshot(doc(db, "deals", dealIdToListen), (snap) => {
        if (snap.exists()) {
          const dData = snap.data();
          setFormData((prev) => ({
            ...prev,
            dealValue: dData.saleDetails?.price !== undefined ? dData.saleDetails.price : (dData.value !== undefined ? dData.value : (dData.dealValue !== undefined ? dData.dealValue : prev.dealValue)),
            saleDetails: dData.saleDetails,
            soldAt: dData.soldAt || prev.soldAt,
            status: dData.status || prev.status,
            vehicle: dData.vehicle || prev.vehicle,
            vehicleId: dData.vehicleId || prev.vehicleId,
          }));
        }
      });
    }

    let dealsQ = query(collection(db, "deals"), where("clientId", "==", actualClientId));
    if (userData?.role !== "master" && userData?.agencyId) {
      dealsQ = query(collection(db, "deals"), where("clientId", "==", actualClientId), where("agencyId", "==", userData.agencyId));
    }
    const unsubAllDeals = onSnapshot(dealsQ, (snap) => {
      const dList = snap.docs.map(d => ({ ...d.data(), id: d.id } as Deal));
      setDeals(dList);
    });

    return () => {
      unsubClient();
      if (unsubDeal) unsubDeal();
      unsubAllDeals();
    };
  }, [client.id, client.originalClientId, isNew]);

  useEffect(() => {
    if (isNew) return;

    const actualClientId = client.originalClientId || client.id;
    const isDeal = Boolean(client.originalClientId && client.originalClientId !== client.id);
    const actualDealId = isDeal ? (client.id as string) : null;

    // Load tasks
    const loadTasks = async () => {
      try {
        const idsToQuery = Array.from(new Set([actualClientId, client.id].filter(Boolean) as string[]));
        const tasksMap = new Map<string, Task>();

        for (const cId of idsToQuery) {
          let q = query(
            collection(db, "tasks"),
            where("clientId", "==", cId),
          );
          if (userData?.role === "seller") {
            q = query(
              collection(db, "tasks"),
              where("clientId", "==", cId),
              where("agencyId", "==", userData.agencyId),
              where("sellerId", "==", userData.id),
            );
          } else if (userData?.role !== "master" && userData?.agencyId) {
            q = query(
              collection(db, "tasks"),
              where("clientId", "==", cId),
              where("agencyId", "==", userData.agencyId),
            );
          }
          const s = await getDocs(q);
          s.docs.forEach((d) => {
            tasksMap.set(d.id, { ...d.data(), id: d.id } as Task);
          });
        }

        const dealIdsToQuery = Array.from(new Set([actualDealId, client.id].filter(Boolean) as string[]));
        for (const dId of dealIdsToQuery) {
          let q = query(
            collection(db, "tasks"),
            where("dealId", "==", dId),
          );
          if (userData?.role === "seller") {
            q = query(
              collection(db, "tasks"),
              where("dealId", "==", dId),
              where("agencyId", "==", userData.agencyId),
              where("sellerId", "==", userData.id),
            );
          } else if (userData?.role !== "master" && userData?.agencyId) {
            q = query(
              collection(db, "tasks"),
              where("dealId", "==", dId),
              where("agencyId", "==", userData.agencyId),
            );
          }
          const s = await getDocs(q);
          s.docs.forEach((d) => {
            tasksMap.set(d.id, { ...d.data(), id: d.id } as Task);
          });
        }

        const t = Array.from(tasksMap.values());
        t.sort(
          (a, b) =>
            new Date(b.createdAt as string).getTime() -
            new Date(a.createdAt as string).getTime(),
        );
        setTasks(t);
      } catch (err) {
        console.error("Error loading tasks:", err);
      }
    };

    // Load files
    const loadFiles = async () => {
      try {
        const idsToQuery = Array.from(new Set([actualClientId, client.id].filter(Boolean) as string[]));
        const filesMap = new Map<string, ClientFile>();

        for (const cId of idsToQuery) {
          const q = (userData?.role !== "master" && userData?.agencyId)
            ? query(
                collection(db, "files"),
                where("clientId", "==", cId),
                where("agencyId", "==", userData.agencyId),
              )
            : query(
                collection(db, "files"),
                where("clientId", "==", cId),
              );
          const s = await getDocs(q);
          s.docs.forEach((d) => {
            filesMap.set(d.id, { ...d.data(), id: d.id } as ClientFile);
          });
        }

        const dealIdsToQuery = Array.from(new Set([actualDealId, client.id].filter(Boolean) as string[]));
        for (const dId of dealIdsToQuery) {
          const q = (userData?.role !== "master" && userData?.agencyId)
            ? query(
                collection(db, "files"),
                where("dealId", "==", dId),
                where("agencyId", "==", userData.agencyId),
              )
            : query(
                collection(db, "files"),
                where("dealId", "==", dId),
              );
          const s = await getDocs(q);
          s.docs.forEach((d) => {
            filesMap.set(d.id, { ...d.data(), id: d.id } as ClientFile);
          });
        }

        const f = Array.from(filesMap.values());
        f.sort(
          (a, b) =>
            new Date(b.uploadedAt as string).getTime() -
            new Date(a.uploadedAt as string).getTime(),
        );
        setFiles(f);
      } catch (err) {
        console.error("Error loading files:", err);
      }
    };

    // Load notes
    const loadNotes = async () => {
      try {
        const idsToQuery = Array.from(new Set([actualClientId, client.id].filter(Boolean) as string[]));
        const notesMap = new Map<string, any>();

        for (const cId of idsToQuery) {
          const q = (userData?.role !== "master" && userData?.agencyId)
            ? query(
                collection(db, "notes"),
                where("clientId", "==", cId),
                where("agencyId", "==", userData.agencyId),
              )
            : query(
                collection(db, "notes"),
                where("clientId", "==", cId),
              );
          const s = await getDocs(q);
          s.docs.forEach((d) => {
            notesMap.set(d.id, { ...d.data(), id: d.id });
          });
        }

        const dealIdsToQuery = Array.from(new Set([actualDealId, client.id].filter(Boolean) as string[]));
        for (const dId of dealIdsToQuery) {
          const q = (userData?.role !== "master" && userData?.agencyId)
            ? query(
                collection(db, "notes"),
                where("dealId", "==", dId),
                where("agencyId", "==", userData.agencyId),
              )
            : query(
                collection(db, "notes"),
                where("dealId", "==", dId),
              );
          const s = await getDocs(q);
          s.docs.forEach((d) => {
            notesMap.set(d.id, { ...d.data(), id: d.id });
          });
        }

        const n = Array.from(notesMap.values());
        n.sort(
          (a, b) =>
            new Date(b.createdAt as string).getTime() -
            new Date(a.createdAt as string).getTime(),
        );
        setNotes(n);
      } catch (err) {
        console.error("Error loading notes:", err);
      }
    };

    loadTasks();
    loadFiles();
    loadNotes();
  }, [client.id, client.originalClientId, isNew, userData]);

  const [currentStep, setCurrentStep] = useState(1);
  const [existingPersons, setExistingPersons] = useState<Client[]>([]);
  const [showNameSuggestions, setShowNameSuggestions] = useState(false);
  const [showPhoneSuggestions, setShowPhoneSuggestions] = useState(false);
  const nameInputRef = useRef<HTMLDivElement>(null);
  const phoneInputRef = useRef<HTMLDivElement>(null);

  const [vehicleSearchQuery, setVehicleSearchQuery] = useState("");
  const [isVehicleSearchOpen, setIsVehicleSearchOpen] = useState(false);
  const vehicleSearchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        nameInputRef.current &&
        !nameInputRef.current.contains(e.target as Node)
      ) {
        setShowNameSuggestions(false);
      }
      if (
        phoneInputRef.current &&
        !phoneInputRef.current.contains(e.target as Node)
      ) {
        setShowPhoneSuggestions(false);
      }
      if (
        vehicleSearchRef.current &&
        !vehicleSearchRef.current.contains(e.target as Node)
      ) {
        setIsVehicleSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (userData?.agencyId && isNew) {
      const fetchPersons = async () => {
        let q = query(
          collection(db, "clients"),
          where("agencyId", "==", userData.agencyId),
        );
        if (userData.role === "seller") {
          q = query(
            collection(db, "clients"),
            where("agencyId", "==", userData.agencyId),
            where("sellerId", "==", userData.id),
          );
        }
        try {
          const snap = await getDocs(q);
          setExistingPersons(
            snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Client),
          );
        } catch (e) {
          console.error(e);
        }
      };
      fetchPersons();
    }
  }, [userData, isNew]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, name: e.target.value }));
    setShowNameSuggestions(true);
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, phone: e.target.value }));
    setShowPhoneSuggestions(true);
  };

  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);

  useEffect(() => {
    setSelectedPersonId(null);
  }, [client, isNew]);

  const handleSelectPerson = (person: Client) => {
    setSelectedPersonId(person.id);
    setFormData((prev) => ({
      ...prev,
      name: person.name,
      email: person.email || prev.email,
      phone: person.phone || prev.phone,
      organization: person.organization || prev.organization,
      address: person.address || prev.address,
    }));
    setShowNameSuggestions(false);
    setShowPhoneSuggestions(false);
  };

  const handleStatusChange = async (newStatus: string) => {
    if (isAdminReadOnly) {
      alert("Como administrador, no tienes permisos para modificar el embudo de otro vendedor.");
      return;
    }
    if (checkIsWon(newStatus, pipelineStages)) {
      setPendingStatus(newStatus);
      setShowDealWonModal(true);
      return;
    }
    if (checkIsLost(newStatus, pipelineStages)) {
      setPendingStatus(newStatus);
      setShowLostReasonModal(true);
      return;
    }

    setFormData((prev) => {
      const updates: Partial<Client> = { status: newStatus };
      return { ...prev, ...updates };
    });

    if (!isNew && client.id) {
      try {
        const updates: any = {
          status: newStatus,
          updatedAt: new Date().toISOString(),
        };
        const finalClientId = client.originalClientId || client.id;
        let finalDealId = (client.originalClientId && client.originalClientId !== client.id) ? client.id : null;

        if (!finalDealId) {
          // Nunca el trato que lleva una venta: cambiar la etapa del contacto
          // desde su ficha no puede regresar ni perder una venta cerrada.
          const trato = elegirTratoAbierto(
            await tratosDelContacto(finalClientId as string),
            formData.vehicleId || client.vehicleId,
            pipelineStages
          );
          finalDealId = trato ? trato.id : null;
        }

        if (finalDealId) {
          await guardarTratoSiExiste(finalDealId, updates);
          await completarValorDelTrato(finalDealId as string);
          avisarEtapaCredito(finalDealId as string, newStatus, pipelineStages);
        }

        await setDoc(doc(db, "clients", finalClientId), {
          status: newStatus,
          updatedAt: new Date().toISOString(),
        }, { merge: true });

        onUpdated?.();
      } catch (err) {
        console.error("Error updating status:", err);
      }
    }
  };

  const handleLostConfirm = async (reason: string, details: string) => {
    setShowLostReasonModal(false);
    const targetStatus = pendingStatus || "lost";
    const fullReason = reason === "Otro" ? details : `${reason}${details ? ` - ${details}` : ""}`;
    
    setFormData((prev) => ({
      ...prev,
      status: targetStatus,
      lostReason: fullReason,
    }));

    if (!isNew && client.id) {
      try {
        const updates: any = {
          status: targetStatus,
          lostReason: fullReason,
          updatedAt: new Date().toISOString(),
        };

        const finalClientId = client.originalClientId || client.id;
        let finalDealId = (client.originalClientId && client.originalClientId !== client.id) ? client.id : null;

        if (!finalDealId) {
          // Nunca el trato que lleva una venta: cambiar la etapa del contacto
          // desde su ficha no puede regresar ni perder una venta cerrada.
          const trato = elegirTratoAbierto(
            await tratosDelContacto(finalClientId as string),
            formData.vehicleId || client.vehicleId,
            pipelineStages
          );
          finalDealId = trato ? trato.id : null;
        }

        if (finalDealId) {
          await guardarTratoSiExiste(finalDealId, updates);
          await quitarVentaDeTratoPerdido(finalDealId as string);
        }

        await setDoc(doc(db, "clients", finalClientId), {
          status: targetStatus,
          lostReason: fullReason,
          updatedAt: new Date().toISOString(),
        }, { merge: true });

        onUpdated?.();
      } catch (err) {
        console.error("Error saving lost reason:", err);
      }
    }
    setPendingStatus(null);
  };

  const handleDealWonConfirm = async (saleDetails: any) => {
    setShowDealWonModal(false);
    const targetStatus = pendingStatus || "won";
    
    setFormData((prev) => {
      const updates: Partial<Client> = { 
        status: targetStatus,
        soldAt: hoyLocal(),
        saleDetails,
        dealValue: saleDetails?.price || prev.dealValue
      };
      return { ...prev, ...updates };
    });

    if (!isNew && client.id) {
      try {
        const finalClientId = client.originalClientId || client.id;
        let finalDealId: string | null = (client.originalClientId && client.originalClientId !== client.id)
          ? (client.id as string)
          : null;

        // Desde la ficha del contacto no hay trato en la mano: se busca el de
        // esta venta entre los suyos. Antes se tomaba el primero que llegara,
        // y la venta podia caer en un trato viejo sin auto mientras el trato
        // del auto quedaba aparte.
        let vehiculoDeLaVenta: string | null = formData.vehicleId || client.vehicleId || null;
        if (!finalDealId) {
          const trato: any = elegirTratoDeLaVenta(
            await tratosDelContacto(finalClientId as string),
            vehiculoDeLaVenta,
            pipelineStages
          );
          if (trato) {
            finalDealId = trato.id;
            vehiculoDeLaVenta = vehiculoDeLaVenta || trato.vehicleId || null;
          }
        }

        // Un auto solo se vende una vez: si otro trato ya registra esta venta,
        // no se duplica.
        const conflicto = await ventaYaRegistrada(
          vehiculoDeLaVenta,
          userData?.agencyId,
          finalDealId
        );
        if (conflicto) {
          alert(avisoDeVentaDuplicada(conflicto));
          return;
        }

        const dealUpdates: any = {
          status: targetStatus,
          soldAt: hoyLocal(),
          saleDetails,
          value: saleDetails?.price || formData.dealValue || 0,
          updatedAt: new Date().toISOString(),
        };

        // El contacto guarda la referencia; el dinero vive en el trato.
        const clientUpdates: any = {
          status: targetStatus,
          soldAt: hoyLocal(),
          updatedAt: new Date().toISOString(),
        };

        // La venta tiene que quedar registrada en un trato. Si el que traiamos
        // ya no existe, o el contacto no tiene ninguno, se crea.
        if (finalDealId && !(await guardarTratoSiExiste(finalDealId, dealUpdates))) {
          finalDealId = null;
        }
        if (!finalDealId) {
          finalDealId = await crearTratoDeVenta(finalClientId as string);
          await guardarTratoSiExiste(finalDealId, dealUpdates);
        }

        clientUpdates.ventaDealId = finalDealId;
        await setDoc(doc(db, "clients", finalClientId), clientUpdates, { merge: true });
        
        if (vehiculoDeLaVenta) {
          const currentVehicle = inventoryVehicles.find(v => v.id === vehiculoDeLaVenta);
          const originalPrice = currentVehicle?.price || client.dealValue || 0;
          const proposedPrice = saleDetails?.price ? Number(saleDetails.price) : originalPrice;
          const hasPriceChange = originalPrice > 0 && originalPrice !== proposedPrice;

          if (puedeVenderSinAprobacion(userData?.role)) {
            // Quien cierra la venta ya tiene permiso para confirmarla: el auto
            // sale del inventario ahora, no cuando alguien se acuerde de
            // aprobarlo.
            await updateDoc(doc(db, "vehicles", vehiculoDeLaVenta), vehiculoVendido({
              clientId: finalClientId,
              clientName: client.name || formData.name,
              dealId: finalDealId,
              precio: proposedPrice,
              saleDetails,
            }));
          } else {
          await updateDoc(doc(db, "vehicles", vehiculoDeLaVenta), {
            pendingValidation: {
              type: "sold",
              requestedBy: userData?.id,
              requestedByName: userData?.name || userData?.email,
              clientId: finalClientId,
              dealId: finalDealId,
              clientName: client.name || formData.name,
              originalPrice,
              proposedPrice,
              // El costo no se copia aqui: nadie lo leia de este registro, y
              // quien cierra una venta no necesariamente puede verlo.
              hasPriceChange,
              saleDetails: saleDetails ? { ...saleDetails, price: proposedPrice } : { price: proposedPrice, method: 'contado' },
              vehicle: formData.vehicle || (currentVehicle ? `${currentVehicle.year} ${currentVehicle.make} ${currentVehicle.model}` : null),
              requestedAt: new Date().toISOString(),
            },
          });
          }
        }

        // Los pagos ya registrados y las tareas de cobro, de acuerdo con el plan nuevo.
        await ventasApi.reflejar(finalDealId as string);
        onUpdated?.();
        if (finalDealId && window.confirm("Venta registrada. ¿Abrir «Venta y pagos» para registrar el enganche o el primer pago?")) {
          onClose();
          navigate(`/venta/${finalDealId}`);
        }
      } catch (err) {
        console.error("Error updating status:", err);
      }
    }
    setPendingStatus(null);
  };
  
  const handlePaymentConfirm = async (payment: any) => {
    setShowPaymentModal(false);
    if (userData?.role === 'seller') {
      alert("Solamente los administradores pueden registrar pagos.");
      return;
    }
    
    const baseDetails = formData.saleDetails || {
      price: formData.dealValue || 0,
      method: 'contado',
      payments: []
    };
    
    const newPayment: any = {
      amount: Number(payment.amount) || 0,
      date: payment.date || hoyLocal(),
      method: payment.method || 'efectivo',
      notes: payment.notes || '',
      id: Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString()
    };
    if (payment.installmentNumber !== undefined && payment.installmentNumber !== null) {
      newPayment.installmentNumber = payment.installmentNumber;
    }
    
    const updatedSaleDetails = {
      ...baseDetails,
      payments: [...(baseDetails.payments || []), newPayment]
    };

    const finalClientId = (client.originalClientId || client.id) as string;
    const isDeal = Boolean(client.originalClientId && client.originalClientId !== client.id);
    const finalDealId = isDeal ? (client.id as string) : null;
    const todayIso = hoyLocal();

    let newStatus = formData.status;

    // Check if markSaleAsWon was checked or if we need to confirm the sale
    if (payment.markSaleAsWon) {
      const wonStage = pipelineStages.find(s => 
        (s.title || '').toLowerCase().includes('ganad') || (s.title || '').toLowerCase().includes('vendid')
      );
      if (wonStage) {
        newStatus = wonStage.id;
      } else {
        newStatus = 'won';
      }
    }

    setFormData(prev => ({
      ...prev,
      status: newStatus,
      saleDetails: updatedSaleDetails
    }));

    try {
      const updateData: any = {
        saleDetails: updatedSaleDetails,
        updatedAt: new Date().toISOString()
      };

      if (payment.markSaleAsWon) {
        updateData.status = newStatus;
        updateData.soldAt = todayIso;
      }

      const sanitizedData = sanitizeFirestoreData(updateData);

      if (finalDealId) {
        await guardarTratoSiExiste(finalDealId, sanitizedData);
      }
      // El contacto guarda UNA venta aunque compre varios autos. Si su venta
      // vigente es otro trato, el pago de este no se le copia: acababa sumado
      // tambien a la otra compra.
      const ventaVigente = (formData as any).ventaDealId;
      if (finalClientId && (!finalDealId || !ventaVigente || ventaVigente === finalDealId)) {
        await setDoc(doc(db, "clients", finalClientId), sanitizedData, { merge: true });
      }
      const isThisClientTheBuyer = Boolean(payment.markSaleAsWon || formData.status === 'won');
      if (formData.vehicleId && isThisClientTheBuyer) {
        const vehicleUpdate: any = {
          saleDetails: updatedSaleDetails,
          updatedAt: new Date().toISOString()
        };
        if (payment.markSaleAsWon) {
          vehicleUpdate.status = 'sold';
          vehicleUpdate.soldAt = todayIso;
          vehicleUpdate.buyerId = finalClientId;
          vehicleUpdate.soldToClientId = finalClientId;
          if (formData.name) vehicleUpdate.buyerName = formData.name;
        }
        await setDoc(doc(db, "vehicles", formData.vehicleId), sanitizeFirestoreData(vehicleUpdate), { merge: true });
      }

      // If completing a specific installment task
      if (payment.taskIdToComplete) {
        try {
          await updateDoc(doc(db, "tasks", payment.taskIdToComplete), {
            completed: true,
            completedAt: new Date().toISOString()
          });
        } catch (tErr) {
          console.error("Error completing payment task:", tErr);
        }
      }

      // If marking sale as won from payment and method is credit, generate schedule tasks
      if (payment.markSaleAsWon && updatedSaleDetails.method === 'credito') {
        try {
          await createPaymentTasks(
            db, 
            { ...client, ...formData, id: finalClientId, name: formData.name }, 
            updatedSaleDetails, 
            userData
          );
        } catch (pErr) {
          console.error("Error creating payment tasks from payment confirm:", pErr);
        }
      }

      onUpdated?.();
    } catch (err) {
      console.error("Error saving payment", err);
    }
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (userData?.role === 'seller') {
      alert("Solamente los administradores pueden gestionar pagos.");
      return;
    }
    if (!formData.saleDetails?.payments) return;
    if (!window.confirm("¿Seguro que deseas eliminar este pago del historial?")) return;

    const updatedPayments = formData.saleDetails.payments.filter((p: any) => p.id !== paymentId);
    const updatedSaleDetails = {
      ...formData.saleDetails,
      payments: updatedPayments
    };

    setFormData(prev => ({
      ...prev,
      saleDetails: updatedSaleDetails
    }));

    const finalClientId = (client.originalClientId || client.id) as string;
    const isDeal = Boolean(client.originalClientId && client.originalClientId !== client.id);
    const finalDealId = isDeal ? (client.id as string) : null;

    try {
      const updateData = {
        saleDetails: updatedSaleDetails,
        updatedAt: new Date().toISOString()
      };
      const sanitizedData = sanitizeFirestoreData(updateData);

      if (finalDealId) {
        await guardarTratoSiExiste(finalDealId, sanitizedData);
      }
      // El contacto guarda UNA venta aunque compre varios autos. Si su venta
      // vigente es otro trato, el pago de este no se le copia: acababa sumado
      // tambien a la otra compra.
      const ventaVigente = (formData as any).ventaDealId;
      if (finalClientId && (!finalDealId || !ventaVigente || ventaVigente === finalDealId)) {
        await setDoc(doc(db, "clients", finalClientId), sanitizedData, { merge: true });
      }
      // El auto solo se toca si es el comprador quien esta borrando el pago.
      // Este documento lo comparten todos los interesados en esa unidad, asi
      // que sin la comprobacion el historial de cualquiera de ellos acababa
      // escrito en el auto, encima del historial de la venta real.
      if (formData.vehicleId) {
        const refVehiculo = doc(db, "vehicles", formData.vehicleId);
        const vehiculo = await getDoc(refVehiculo);
        if (esElCompradorDelVehiculo(vehiculo.data(), finalClientId, finalDealId)) {
          await setDoc(refVehiculo, sanitizedData, { merge: true });
        }
      }
      onUpdated?.();
    } catch (err) {
      console.error("Error deleting payment", err);
    }
  };

  const [showWantedVehicleMenu, setShowWantedVehicleMenu] = useState(false);
  const [avisoPreferencias, setAvisoPreferencias] = useState(false);

  const handleSave = async (e?: React.FormEvent, opciones?: { cerrar?: boolean }) => {
    if (e) e.preventDefault();
    if (!userData || !formData.agencyId || formData.agencyId === "unassigned") {
      alert("Debes pertenecer a una agencia para guardar clientes.");
      return;
    }

    const hasBuscaAutoTag = formData.tags?.some(t => {
      const lower = t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return lower.includes('busca de auto') || 
             lower.includes('busca auto') ||
             lower.includes('buscan auto') ||
             lower.includes('busqueda');
    });

    // Intercept to show the Wanted Vehicle form if needed
    if (hasBuscaAutoTag && !showWantedVehicleMenu && (!formData.wantedVehicle || !formData.wantedVehicle.make)) {
      setShowWantedVehicleMenu(true);
      return;
    }

    // ¿Como llego? Obligatorio cuando nace una persona nueva (decision de
    // Luis, sep 2026). Si se eligio una persona que ya existe, no se pide.
    if (isNew && !selectedPersonId && !(formData as any).fuente) {
      alert("Elige cómo llegó este contacto.");
      return;
    }

    let finalFormData = { ...formData };

    // Solo administracion reasigna el asesor. Ocultar el selector no basta:
    // aqui se descarta cualquier cambio de sellerId que venga de otro rol,
    // conservando el valor que ya tenia el registro.
    const puedeReasignar = userData?.role === "admin" || userData?.role === "master";
    if (!puedeReasignar && !isNew) {
      finalFormData.sellerId = client.sellerId;
    }

    if (finalFormData.dealValue !== undefined) {
      finalFormData.dealValue = finalFormData.dealValue ? Number(finalFormData.dealValue) : 0;
    }
    // Lo que busca se conserva si tiene algo capturado, aunque el contacto no
    // lleve la etiqueta «Busca de auto». Antes se descartaba en silencio y
    // «Guardar preferencias» cerraba la ventana sin haber guardado nada.
    const wv0: any = finalFormData.wantedVehicle;
    const tieneBusqueda = !!wv0 && Object.values(wv0).some((x) => x !== undefined && x !== null && String(x).trim() !== "" && x !== "Cualquiera");
    if (!hasBuscaAutoTag && !tieneBusqueda) {
      finalFormData.wantedVehicle = null as any;
    }

    if (showFullAddress) {
      const parts = [finalFormData.street, finalFormData.exteriorNumber, finalFormData.neighborhood, finalFormData.city, finalFormData.zipCode].filter(Boolean);
      if (parts.length > 0) {
         finalFormData.address = parts.join(", ");
      }
    } else {
      // If using single field, we don't clear the parts, just in case they have them, but the main `address` is what matters.
    }

    if (isAdminReadOnly) {
      try {
        const actualClientId = client.originalClientId || client.id;
        const updates = {
          sellerId: finalFormData.sellerId || "",
          updatedAt: new Date().toISOString()
        };
        if (client.originalClientId && client.originalClientId !== client.id) {
          await guardarTratoSiExiste(client.id as string, { sellerId: updates.sellerId, updatedAt: updates.updatedAt });
        }
        await updateDoc(doc(db, "clients", actualClientId as string), updates);
        onUpdated?.();
        onClose();
        return;
      } catch (err: any) {
        console.error(err);
        alert("Error reasignando asesor: " + err.message);
        return;
      }
    }

    try {
      if (isNew) {
        let finalClientId = selectedPersonId;

        if (!finalClientId && finalFormData.name) {
          const normName = finalFormData.name.trim().toLowerCase();
          const normPhone = finalFormData.phone ? finalFormData.phone.trim() : "";
          const matched = existingPersons.find(p => 
            (normPhone && p.phone && p.phone.includes(normPhone)) ||
            (normName && p.name && p.name.trim().toLowerCase() === normName)
          );
          if (matched) {
            finalClientId = matched.id;
          }
        }

        if (finalClientId) {
          const clientUpdates: any = {
            name: finalFormData.name,
            email: finalFormData.email || "",
            phone: finalFormData.phone || "",
            organization: finalFormData.organization || "",
            address: finalFormData.address || "",
            updatedAt: new Date().toISOString()
          };
          if (finalFormData.sellerId) clientUpdates.sellerId = finalFormData.sellerId;
          await setDoc(doc(db, "clients", finalClientId), clientUpdates, { merge: true });
        } else {
          const newClientRef = doc(collection(db, "clients"));
          finalClientId = newClientRef.id;
          const clientDataToSave = {
            ...finalFormData,
            id: finalClientId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          delete (clientDataToSave as any).dealTitle;
          delete (clientDataToSave as any).dealValue;
          Object.keys(clientDataToSave).forEach(
            (k) =>
              (clientDataToSave as any)[k] === undefined &&
              delete (clientDataToSave as any)[k],
          );
          await setDoc(newClientRef, sanitizeFirestoreData(clientDataToSave));
        }

        // ALWAYS create a NEW deal record in `deals`
        const newDealRef = doc(collection(db, "deals"));
        // El estado de un contacto y una etapa del embudo no son lo mismo. Un
        // contacto nuevo trae status "new", que no es ninguna columna: el trato
        // nacia con esa etapa y no aparecia en el embudo por ningun lado. Solo
        // se hereda si de verdad es una etapa; si no, entra en la primera.
        const primeraEtapa = (pipelineStages && pipelineStages[0]?.id) || "lead";
        const heredada = finalFormData.status;
        const initialStage =
          heredada && pipelineStages?.some((e: any) => e?.id === heredada)
            ? heredada
            : primeraEtapa;
        const dealDataToSave: any = {
          id: newDealRef.id,
          clientId: finalClientId,
          agencyId: finalFormData.agencyId || userData?.agencyId || "",
          sellerId: finalFormData.sellerId || userData?.id || "",
          title: finalFormData.dealTitle || (finalFormData.vehicle ? `Trato: ${finalFormData.vehicle}` : `Trato con ${finalFormData.name || 'Cliente'}`),
          status: initialStage,
          value: finalFormData.dealValue ? Number(finalFormData.dealValue) : 0,
          vehicle: finalFormData.vehicle || null,
          vehicleId: finalFormData.vehicleId || null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        if (finalFormData.saleDetails) dealDataToSave.saleDetails = finalFormData.saleDetails;
        await setDoc(newDealRef, sanitizeFirestoreData(dealDataToSave));

        // El trato ya existe: la ventana se queda abierta, ahora como trato de
        // siempre, para poder escribir la primera nota o agendar la primera
        // actividad sin tener que buscarlo y abrirlo otra vez.
        // Sin `id` aqui a proposito: el guardado siguiente escribe el
        // formulario entero en el documento del contacto, y meterle el id del
        // trato se lo cambiaria. La identidad va por `recienCreado`, no por el
        // formulario.
        setRecienCreado({ id: newDealRef.id, originalClientId: finalClientId as string });
        setFormData((prev) => ({ ...prev, dealTitle: dealDataToSave.title }));
        setAvisoDeCreado(true);
        onUpdated?.();
        return;
      } else {
        const dataToUpdate = {
          ...finalFormData,
          updatedAt: new Date().toISOString(),
        };

        Object.keys(dataToUpdate).forEach(
          (k) =>
            dataToUpdate[k as keyof typeof dataToUpdate] === undefined &&
            delete dataToUpdate[k as keyof typeof dataToUpdate],
        );

        const finalClientId = client.originalClientId || client.id;
        let finalDealId: string | null = null;

        // Un contacto y un trato son cosas distintas. Al editar un contacto
        // desde Personas no se toca ningun trato: solo se guardan sus datos.
        // Los tratos se gestionan desde el embudo o desde la pestaña "Tratos"
        // del propio contacto.
        if (isDealContext) {
          finalDealId = (client.originalClientId && client.originalClientId !== client.id) ? client.id : null;

          if (!finalDealId) {
            const q = (userData?.role !== "master" && userData?.agencyId)
              ? query(collection(db, "deals"), where("clientId", "==", finalClientId), where("agencyId", "==", userData.agencyId))
              : query(collection(db, "deals"), where("clientId", "==", finalClientId));
            const snap = await getDocs(q);
            if (!snap.empty) {
              finalDealId = snap.docs[0].id;
            }
            // Si no existe ningun trato para este contacto no se inventa uno:
            // antes se generaba un id nuevo y el setDoc posterior terminaba
            // creando un trato incompleto, sin agencyId, que Firestore
            // rechazaba por reglas.
          }
        }

        const dealDataToUpdate: any = {};
        if ('dealTitle' in dataToUpdate) {
          dealDataToUpdate.title = dataToUpdate.dealTitle;
        }
        if ('dealValue' in dataToUpdate) {
          dealDataToUpdate.value = dataToUpdate.dealValue ? Number(dataToUpdate.dealValue) : 0;
        }
        if ('vehicleId' in dataToUpdate) {
          dealDataToUpdate.vehicleId = dataToUpdate.vehicleId;
        }
        if ('vehicle' in dataToUpdate) {
          dealDataToUpdate.vehicle = dataToUpdate.vehicle;
        }
        if ('status' in dataToUpdate) {
          dealDataToUpdate.status = dataToUpdate.status;
        }
        if ('sellerId' in dataToUpdate) {
          dealDataToUpdate.sellerId = dataToUpdate.sellerId;
        }
        if ('lostReason' in dataToUpdate) {
          dealDataToUpdate.lostReason = dataToUpdate.lostReason;
        }
        if ('lostAt' in dataToUpdate) {
          dealDataToUpdate.lostAt = dataToUpdate.lostAt;
        }
        if ('soldAt' in dataToUpdate) {
          dealDataToUpdate.soldAt = dataToUpdate.soldAt;
        }
        if ('saleDetails' in dataToUpdate || formData.saleDetails) {
          const sDet = dataToUpdate.saleDetails || formData.saleDetails;
          dealDataToUpdate.saleDetails = sDet;
          dataToUpdate.saleDetails = sDet;
        }
        if ('dealValue' in dataToUpdate || formData.dealValue !== undefined || formData.saleDetails?.price !== undefined) {
          const priceVal = dataToUpdate.saleDetails?.price ?? dataToUpdate.dealValue ?? formData.dealValue;
          if (priceVal !== undefined) {
            dealDataToUpdate.value = priceVal;
            dealDataToUpdate.dealValue = priceVal;
            dataToUpdate.dealValue = priceVal;
          }
        }

        Object.keys(dealDataToUpdate).forEach(
          (k) =>
            dealDataToUpdate[k] === undefined &&
            delete dealDataToUpdate[k],
        );

        // Si de verdad se escribio en un trato. guardarTratoSiExiste devuelve
        // false en silencio cuando el trato no existe, y ese silencio era el
        // problema: la ficha se veia como trato, la etapa se guardaba, y no
        // habia ninguna tarjeta en el embudo.
        let tratoGuardado = false;
        if (finalDealId && Object.keys(dealDataToUpdate).length > 0) {
          dealDataToUpdate.updatedAt = new Date().toISOString();
          tratoGuardado = await guardarTratoSiExiste(finalDealId, sanitizeFirestoreData(dealDataToUpdate));
        }

        // La tarjeta del embudo trae el id del TRATO y originalClientId. Se
        // copiaban tal cual al contacto: 22 contactos quedaron con el id de su
        // trato guardado adentro, y toda pantalla que armaba el contacto como
        // { id: doc.id, ...datos } escribia despues en un documento que no
        // existe -- Firebase lo rechaza como "Missing or insufficient
        // permissions" (poner una etiqueta desde el chat, por ejemplo).
        const paraElContacto: any = { ...dataToUpdate };
        delete paraElContacto.id;
        delete paraElContacto.originalClientId;
        await setDoc(doc(db, "clients", finalClientId as string), sanitizeFirestoreData(paraElContacto), { merge: true });

        // Elegir una etapa en la ficha de un contacto (no de un trato) movia
        // solo la etiqueta del contacto: el embudo se arma con `deals`, asi
        // que no pasaba nada visible. Ahora esa eleccion crea o mueve su
        // trato. Las etapas finales no crean nada -- ver etapaDelContacto.ts.
        // No se exige que la etapa haya cambiado. Hay contactos antiguos que
        // ya traen etapa y nunca tuvieron trato -- los que entraron por
        // /api/public/v1/leads, que solo crea el contacto -- y decian estar en
        // "Contactados" sin aparecer en el embudo. Abrirlos y guardar los
        // arregla. Repetirlo no duplica nada: si ya hay un trato abierto se
        // mueve ese, no se crea otro.
        //
        // La segunda condicion es la que faltaba. Abrir la ficha "como trato"
        // daba por hecho que el trato existe, y hay contactos que se ven asi
        // sin tenerlo: los que crea el asistente con create_lead y los que
        // entraron por /api/public/v1/leads antes del arreglo, que solo crean
        // el contacto. En esos, la etapa se guardaba en el contacto, la ficha
        // decia "Confirmacion Cita" con su valor y su auto, y en el embudo no
        // habia nada. Ahora, si no se escribio en ningun trato, se crea.
        if ((!isDealContext || !tratoGuardado) && dataToUpdate.status) {
          try {
            const r = await aplicarEtapaAlTrato({
              clientId: finalClientId as string,
              agencyId: (dataToUpdate.agencyId as string) || userData?.agencyId || "",
              sellerId: (dataToUpdate.sellerId as string) || userData?.id || "",
              etapa: dataToUpdate.status as string,
              pipelineStages,
              nombre: dataToUpdate.name as string,
              vehicle: (dataToUpdate.vehicle as string) || null,
              vehicleId: (dataToUpdate.vehicleId as string) || null,
              esMaster: userData?.role === "master",
              valor: Number(dataToUpdate.dealValue ?? formData.dealValue) || 0,
              titulo: (dataToUpdate.dealTitle as string) || formData.dealTitle || undefined,
            });
            if (r.accion === "creado") {
              alert("Listo. Se creó su trato en el embudo, en esa etapa.");
            }
          } catch (err) {
            // El contacto ya quedo guardado: fallar aqui en rojo haria creer
            // que no se guardo nada.
            console.error("No se pudo crear o mover el trato:", err);
            alert("Se guardó el contacto, pero no se pudo mover su trato.");
          }
        }

        // Sync vehicle price if it's a won deal
        const finalStatus = dataToUpdate.status || dealDataToUpdate.status || client.status;
        const finalVehicleId = dealDataToUpdate.vehicleId || dataToUpdate.vehicleId || client.vehicleId;
        if ((finalStatus === 'won' || finalStatus === 'sold') && finalVehicleId) {
           const finalPrice = dealDataToUpdate.saleDetails?.price || dataToUpdate.saleDetails?.price || dealDataToUpdate.value || 0;
           if (finalPrice > 0) {
              const vUpdate: any = { price: finalPrice };
              if (dealDataToUpdate.saleDetails || dataToUpdate.saleDetails) {
                 vUpdate.saleDetails = dealDataToUpdate.saleDetails || dataToUpdate.saleDetails;
              }
              await updateDoc(doc(db, "vehicles", finalVehicleId), vUpdate).catch(() => {});
           }
        }

      }
      onUpdated?.();
      if (opciones?.cerrar === false && !isNew) {
        setAvisoPreferencias(true);
        setTimeout(() => setAvisoPreferencias(false), 3500);
      } else {
        onClose();
      }
    } catch (err) {
      console.error(err);
      alert("Error guardando cliente: " + err.message);
    }
  };

  const handleAddTask = async () => {
    if (isNew) return;
    if (!newTaskTitle) {
      alert("El título de la tarea es requerido.");
      return;
    }
    if (!newTaskDate) {
      alert("La fecha de la tarea es requerida.");
      return;
    }
    
    // Use the raw HH:mm time
    let formattedTime = newTaskTime || "";

    if (editingTaskId) {
      const taskRef = doc(db, "tasks", editingTaskId);
      const updates: Partial<Task> = {
        title: newTaskTitle,
        dueDate: newTaskDate,
        updatedAt: new Date().toISOString(),
      };
      
      if (formattedTime) {
        updates.startTime = formattedTime;
      } else {
        updates.startTime = ""; // clear if empty
      }
      
      await updateDoc(taskRef, updates as any);
      setTasks(prev => prev.map(t => t.id === editingTaskId ? { ...t, ...updates } : t));
      setEditingTaskId(null);
    } else {
      const actualClientId = client.originalClientId || client.id;
      const isDeal = Boolean(client.originalClientId && client.originalClientId !== client.id);
      const actualDealId = isDeal ? (client.id as string) : "";

      const newRef = doc(collection(db, "tasks"));
      const t: Record<string, any> = {
        agencyId: userData?.agencyId || client.agencyId || "",
        sellerId: userData?.id || "",
        clientId: actualClientId,
        title: newTaskTitle,
        dueDate: newTaskDate || "",
        completed: false,
        createdAt: new Date().toISOString(),
      };
      if (actualDealId) {
        t.dealId = actualDealId;
      }
      if (formattedTime) {
        t.startTime = formattedTime;
      }
      Object.keys(t).forEach((k) => t[k] === undefined && delete t[k]);
      await setDoc(newRef, t);
      setTasks((prev) => [{ id: newRef.id, ...t } as Task, ...prev]);
    }

    setNewTaskTitle("");
    setNewTaskDate("");
    setNewTaskTime(getDefaultTime());
  };

  const handleEditTaskClick = (task: Task) => {
    setActiveTab("activity");
    setEditingTaskId(task.id);
    setNewTaskTitle(task.title);
    setNewTaskDate(task.dueDate);
    
    // Convert h:mm a.m. back to HH:mm for the input
    if (task.startTime) {
      try {
        const timeRegex = /(\d+):(\d+)\s*(a\.m\.|p\.m\.|am|pm)/i;
        const match = task.startTime.match(timeRegex);
        if (match) {
          let [ , hStr, m, p] = match;
          let h = parseInt(hStr, 10);
          if (p.toLowerCase().includes("p") && h < 12) h += 12;
          if (p.toLowerCase().includes("a") && h === 12) h = 0;
          setNewTaskTime(`${h.toString().padStart(2, "0")}:${m}`);
        } else {
          setNewTaskTime(task.startTime);
        }
      } catch (e) {
        setNewTaskTime(task.startTime);
      }
    } else {
      setNewTaskTime(getDefaultTime());
    }
  };

  const cancelEditTask = () => {
    setEditingTaskId(null);
    setNewTaskTitle("");
    setNewTaskDate("");
    setNewTaskTime(getDefaultTime());
  };

  const handleAddNote = async () => {
    if (isAdminReadOnly) {
      alert("Como administrador, no tienes permisos para modificar el embudo de otro vendedor.");
      return;
    }
    if (!newNoteContent || isNew) return;

    const actualClientId = client.originalClientId || client.id;
    const isDeal = Boolean(client.originalClientId && client.originalClientId !== client.id);
    const actualDealId = isDeal ? (client.id as string) : "";

    const newRef = doc(collection(db, "notes"));
    const n: Record<string, any> = {
      agencyId: userData?.agencyId || client.agencyId || "",
      sellerId: userData?.id || "",
      clientId: actualClientId,
      content: newNoteContent,
      createdAt: new Date().toISOString(),
    };
    if (actualDealId) {
      n.dealId = actualDealId;
    }
    Object.keys(n).forEach((k) => n[k] === undefined && delete n[k]);
    await setDoc(newRef, n);
    setNotes((prev) => [{ id: newRef.id, ...n }, ...prev]);
    setNewNoteContent("");
  };

  const toggleTaskCompletion = async (task: Task) => {
    if (isAdminReadOnly) {
      alert("Como administrador, no tienes permisos para modificar el embudo de otro vendedor.");
      return;
    }
    try {
      await updateDoc(doc(db, "tasks", task.id as string), {
        completed: !task.completed,
      });
      
      const updatedTasks = tasks.map((t) =>
        t.id === task.id ? { ...t, completed: !task.completed } : t,
      );
      setTasks(updatedTasks);
      
      // If marked as complete, check if there are any pending tasks for this client/deal
      if (!task.completed) {
        const hasPending = updatedTasks.some(t => !t.completed && t.id !== task.id);
        if (!hasPending) {
           const actualClientId = client.originalClientId || client.id;
           setNewTaskPrefill({
              clientId: actualClientId || "",
              clientName: formData.name || "",
              dealId: client.originalClientId ? client.id : "",
              dealTitle: formData.dealTitle || ""
           });
           setShowNewTaskModal(true);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isAdminReadOnly) {
      alert("Como administrador, no tienes permisos para modificar el embudo de otro vendedor.");
      return;
    }
    if (!e.target.files || e.target.files.length === 0 || isNew) return;
    if (!userData?.agencyId || userData.agencyId === "unassigned") {
      alert("Debes pertenecer a una agencia para subir archivos.");
      return;
    }
    const file = e.target.files[0];
    let fileToUpload = file;

    if (file.type.startsWith("image/")) {
      const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
      };
      fileToUpload = await imageCompression(file, options);
    }

    const actualClientId = client.originalClientId || client.id;
    const isDeal = Boolean(client.originalClientId && client.originalClientId !== client.id);
    const actualDealId = isDeal ? (client.id as string) : "";

    const newRef = doc(collection(db, "files"));
    const storageRef = ref(
      storage,
      `users/${userData?.id}/clients/${actualClientId}/${fileToUpload.name}`,
    );
    await uploadBytes(storageRef, fileToUpload);
    const url = await getDownloadURL(storageRef);
    const f: Record<string, any> = {
      agencyId: userData?.agencyId || client.agencyId || "",
      clientId: actualClientId,
      userId: userData?.id || "",
      filename: fileToUpload.name,
      url,
      uploadedAt: new Date().toISOString(),
    };
    if (actualDealId) {
      f.dealId = actualDealId;
    }
    Object.keys(f).forEach((k) => f[k] === undefined && delete f[k]);
    await setDoc(newRef, f);
    setFiles((prev) => [{ id: newRef.id, ...f } as ClientFile, ...prev]);
  };

  const pendingTasks = tasks.filter((t) => !t.completed);
  const completedTasks = tasks.filter((t) => t.completed);

  /** Cambiar de etapa: lo mismo que hacía la lista desplegable, ahora con las flechas. */
  const cambiarEtapa = (newStatus: string) => {
    if (checkIsLost(newStatus, pipelineStages) || checkIsWon(newStatus, pipelineStages)) {
      handleStatusChange(newStatus);
      return;
    }
    setFormData((prev) => ({
      ...prev,
      status: newStatus,
      dealTitle: prev.dealTitle || (prev.name ? `${prev.name} deal` : "Nuevo Trato"),
    }));
    handleStatusChange(newStatus);
  };
  const etapasFlecha = pipelineStages.filter((st) => !checkIsLost(st.id, pipelineStages) && !checkIsWon(st.id, pipelineStages));
  const indiceFlecha = etapasFlecha.findIndex((st) => st.id === formData.status);
  const esGanado = checkIsWon(formData.status, pipelineStages);
  const telDigitos = String(formData.phone || "").replace(/\D/g, "");
  const iniciales = String(formData.name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join("") || "?";
  const llegoHace = (() => {
    const c: any = (formData as any).createdAt;
    const d = !c ? null : typeof c === "string" ? new Date(c) : typeof c?.toDate === "function" ? c.toDate() : typeof c?.seconds === "number" ? new Date(c.seconds * 1000) : null;
    if (!d || Number.isNaN(d.getTime())) return "";
    const dias = Math.floor((Date.now() - d.getTime()) / 86400000);
    return dias <= 0 ? "hoy" : dias === 1 ? "ayer" : `hace ${dias} días`;
  })();
  // La venta y sus pagos se ven y se cobran en su página completa (/venta/:trato).
  const idDeLaVenta: string | null = (client.originalClientId && client.originalClientId !== client.id)
    ? (client.id as string) : ((formData as any).ventaDealId || null);
  const abrirVentaYPagos = () => {
    if (!idDeLaVenta) { setShowPaymentDrawer(true); return; } // venta muy vieja sin trato
    onClose();
    navigate(`/venta/${idDeLaVenta}`);
  };

  const ventaResumen = (formData.saleDetails || formData.status === "won") ? (() => {
    const soldV = inventoryVehicles.find((v) => v.id === formData.vehicleId);
    const precio = formData.saleDetails?.price || formData.dealValue || soldV?.price || 0;
    const pagos = formData.saleDetails?.payments || [];
    const pagado = pagos.reduce((acc: number, pg: any) => acc + (pg.amount || 0), 0);
    return { precio, pagado, saldo: Math.max(0, precio - pagado), cuantos: pagos.length, pct: precio > 0 ? Math.min(100, Math.round((pagado / precio) * 100)) : 100 };
  })() : null;
  const pesosMx = (n: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n || 0);
  // Tareas pendientes en orden de fecha: la primera es el «próximo paso».
  const pendientesEnOrden = [...pendingTasks].sort((a, b) =>
    `${a.dueDate || "9999"} ${a.startTime || a.dueTime || ""}`.localeCompare(`${b.dueDate || "9999"} ${b.startTime || b.dueTime || ""}`));
  const proximoPaso = pendientesEnOrden[0];
  const hoyIso = new Date().toLocaleDateString("en-CA");
  const proximoVencido = !!proximoPaso?.dueDate && proximoPaso.dueDate.slice(0, 10) < hoyIso;
  const composerRef = useRef<HTMLDivElement>(null);
  const irANota = () => {
    setActiveTab("notes");
    setTimeout(() => composerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  };

  return (
    // La animacion de salida ya existia pero no llegaba a verse: quien abre
    // esta ventana la quita de golpe, y sin AnimatePresence no hay momento en
    // que animarla. Va aqui dentro para que valga en todas las pantallas que
    // la usan, y el cierre de verdad ocurre cuando la animacion termina.
    <AnimatePresence onExitComplete={onClose}>
      {!cerrando && (
    <motion.div
      key="ventana-trato"
      className="fixed inset-0 z-50 flex flex-col bg-slate-100 dark:bg-slate-900"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16, transition: { duration: 0.18 } }}
      transition={{ duration: 0.22, ease: "easeOut" }}
    >
      {/* Pantalla completa: antes era una ventana flotante sobre la página. */}
      <div className="flex flex-col flex-1 min-h-0 relative">
        {/* CABECERA: quién es, qué se puede hacer con él y en qué etapa va.
            Se queda fija arriba; lo demás se desplaza debajo. */}
        <div className="shrink-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
          <div className="max-w-[1440px] mx-auto px-3 md:px-6 py-2 md:py-3 flex flex-col gap-2.5 md:gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={cerrar}
                className="flex items-center gap-1 min-h-[36px] pr-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                <ChevronLeft className="w-4 h-4" /> Regresar
              </button>
              <span className="text-sm text-slate-300 dark:text-slate-600">/</span>
              <span className="text-sm text-slate-500 dark:text-slate-400">{isNew ? "Nuevo" : isDealContext ? "Trato" : "Contacto"}</span>
              <div className="ml-auto flex items-center gap-2">
                {canModify && (
                  <button
                    form="client-form"
                    type="submit"
                    className={clsx(
                      "h-9 px-5 rounded-lg bg-slate-900 hover:bg-black dark:bg-white dark:hover:bg-slate-200 dark:text-slate-900 text-white text-sm font-bold items-center",
                      isNew ? "hidden md:inline-flex" : "hidden lg:inline-flex"
                    )}
                  >
                    Guardar
                  </button>
                )}
                <button
                  type="button"
                  onClick={cerrar}
                  aria-label="Cerrar"
                  className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex flex-col lg:flex-row lg:items-center gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-11 h-11 md:w-14 md:h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-base md:text-xl font-extrabold flex items-center justify-center shrink-0">
                  {iniciales}
                </div>
                <div className="min-w-0 flex-1">
                  <input
                    name={isDealContext ? "dealTitle" : "name"}
                    value={isDealContext ? (formData.dealTitle || "") : (formData.name || "")}
                    onChange={(e) => {
                      if (isDealContext) {
                        handleChange(e); // Updates dealTitle
                      } else {
                        handleChange({ target: { name: 'name', value: e.target.value } } as any); // Updates name if no deal
                      }
                    }}
                    placeholder={isDealContext ? "Nuevo Trato" : "Nombre"}
                    aria-label={isDealContext ? "Nombre del trato" : "Nombre"}
                    className="w-full text-lg md:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-600 focus:outline-none"
                  />
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 mt-0.5 text-xs md:text-sm text-slate-600 dark:text-slate-400">
                    {isDealContext && formData.name && <span className="font-semibold text-slate-800 dark:text-slate-200">{formData.name}</span>}
                    {formData.phone && <span>{formData.phone}</span>}
                    {formData.email && <span className="truncate max-w-[240px]">{formData.email}</span>}
                    {!isNew && (
                      <span>
                        Llegó por <b className="text-slate-800 dark:text-slate-200">{etiquetaDeFuente(fuenteDelContacto(formData))}</b>
                        {llegoHace ? ` ${llegoHace}` : ""}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {!isNew && telDigitos && (
                  <>
                    <button
                      type="button"
                      onClick={() => setEscribiendoWhatsApp(true)}
                      className="hidden lg:inline-flex h-10 px-3.5 rounded-lg bg-[#1fa855] hover:bg-[#178a45] text-white text-sm font-bold items-center gap-1.5"
                    >
                      <MessageCircle className="w-4 h-4" /> WhatsApp
                    </button>
                    <a
                      href={`tel:${telDigitos}`}
                      className="hidden lg:inline-flex h-10 px-3.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-bold items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-700"
                    >
                      <Phone className="w-4 h-4" /> Llamar
                    </a>
                  </>
                )}
                {!isNew && (
                  <button
                    type="button"
                    onClick={() => setCotizandoAuto(inventoryVehicles.find((v) => v.id === formData.vehicleId && v.status !== "sold") || null)}
                    className="h-10 px-3.5 rounded-lg border border-blue-700 text-blue-800 dark:text-blue-300 bg-white dark:bg-slate-800 text-sm font-bold hover:bg-blue-50 dark:hover:bg-slate-700"
                  >
                    Cotizar
                  </button>
                )}
                {!isNew && (
                  <button
                    type="button"
                    onClick={async () => {
                      // Si ya tiene una solicitud abierta, a esa; si no, una nueva con sus datos.
                      const idCliente = (client.originalClientId || client.id) as string;
                      try {
                        const { creditosApi } = await import("../lib/creditosApi");
                        const activa = (await creditosApi.lista(idCliente)).find((x: any) => !["cerrada", "cancelada"].includes(x.etapa));
                        if (activa) { navigate(`/creditos/${activa.id}`); return; }
                      } catch { /* sin conexión: se abre una nueva */ }
                      navigate(`/creditos?cliente=${idCliente}${formData.vehicleId ? `&auto=${formData.vehicleId}` : ""}`);
                    }}
                    className="h-10 px-3.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-700"
                    title="Solicitud de crédito"
                  >
                    Crédito
                  </button>
                )}
                {!isNew &&
                  formData.dealTitle &&
                  !checkIsWon(formData.status, pipelineStages) &&
                  !checkIsLost(formData.status, pipelineStages) && (
                    <>
                      {/* «Perdido» marca el trato como perdido y pide el motivo;
                          no borra nada. */}
                      <span className="hidden sm:block w-px h-7 bg-slate-200 dark:bg-slate-700 mx-0.5" />
                      <button
                        type="button"
                        onClick={() => handleStatusChange("won")}
                        className="flex-1 sm:flex-none h-10 px-3.5 inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold"
                      >
                        <Trophy className="w-4 h-4 shrink-0" /> Ganado
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStatusChange("lost")}
                        className="flex-1 sm:flex-none h-10 px-3.5 inline-flex items-center justify-center gap-1.5 rounded-lg bg-white dark:bg-slate-800 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-sm font-bold"
                      >
                        <XCircle className="w-4 h-4 shrink-0" /> Perdido
                      </button>
                    </>
                  )}
                {!isNew && checkIsWon(formData.status, pipelineStages) && (
                  <button
                    type="button"
                    onClick={() => handleStatusChange("new")}
                    className="h-10 px-3.5 inline-flex items-center justify-center gap-1.5 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm font-bold"
                  >
                    <RotateCcw className="w-4 h-4 shrink-0" /> Reabrir trato
                  </button>
                )}
              </div>
            </div>

            {/* Etapas del embudo: se cambia tocando la flecha. */}
            <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
              {etapasFlecha.length > 0 && (
                <div className="flex-1 min-w-0 flex gap-0.5 overflow-x-auto" role="group" aria-label="Etapa del trato">
                  {etapasFlecha.map((st, i) => {
                    const actual = st.id === formData.status;
                    const hecha = esGanado || (indiceFlecha >= 0 && i < indiceFlecha);
                    return (
                      <button
                        key={`flecha-${st.id}`}
                        type="button"
                        disabled={!canModify || esGanado}
                        onClick={() => !actual && cambiarEtapa(st.id)}
                        aria-current={actual ? "step" : undefined}
                        title={st.title}
                        className={clsx(
                          "flex-1 min-w-[96px] h-8 md:h-9 pl-4 pr-3 text-[11px] md:text-xs font-bold truncate transition-colors disabled:cursor-default",
                          esGanado
                            ? "bg-emerald-600 text-white"
                            : actual
                              ? "bg-blue-700 text-white"
                              : hecha
                                ? "bg-blue-400 dark:bg-blue-800 text-white hover:bg-blue-500"
                                : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600"
                        )}
                        style={{
                          clipPath: i === 0
                            ? "polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%)"
                            : "polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%, 10px 50%)",
                        }}
                      >
                        {st.title}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 shrink-0">
                {esGanado ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">Ganado</span>
                    <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 whitespace-nowrap">Fecha de venta</label>
                    <input
                      type="date"
                      value={formData.soldAt || ''}
                      onChange={(e) => setFormData(p => ({ ...p, soldAt: e.target.value }))}
                      className="text-sm border-slate-300 dark:border-slate-600 dark:bg-slate-700 bg-white rounded-md py-1"
                    />
                  </div>
                ) : !isNew && indiceFlecha < 0 ? (
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    {formData.dealTitle ? "Solo contacto" : "Contacto sin trato activo: toca una etapa para abrir uno"}
                  </span>
                ) : null}
                {isDealContext && (
                  <label className="flex flex-col">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Valor del trato</span>
                    <span className="flex items-center text-base md:text-lg font-extrabold text-slate-900 dark:text-white">
                      $
                      <input
                        type="number"
                        name="dealValue"
                        value={formData.dealValue !== undefined ? formData.dealValue : ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormData(prev => {
                            const updated = { ...prev, dealValue: val ? Number(val) : 0 };
                            if (updated.saleDetails) {
                              updated.saleDetails = { ...updated.saleDetails, price: val ? Number(val) : 0 };
                            }
                            return updated;
                          });
                        }}
                        placeholder="Monto"
                        className="w-28 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-600 focus:outline-none"
                      />
                    </span>
                  </label>
                )}
                {ventaResumen && (
                  <button
                    type="button"
                    onClick={abrirVentaYPagos}
                    className="flex items-center gap-2 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 text-left hover:bg-emerald-100 dark:hover:bg-emerald-950/60"
                    title="Ver la venta y los pagos"
                  >
                    <Calculator className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                    <span className="flex flex-col leading-tight">
                      <span className="text-xs font-extrabold text-emerald-900 dark:text-emerald-200">
                        {pesosMx(ventaResumen.pagado)} de {pesosMx(ventaResumen.precio)}
                        <span className={clsx("ml-1.5 px-1.5 py-0.5 rounded-full text-[9px]",
                          ventaResumen.saldo === 0 && ventaResumen.precio > 0 ? "bg-emerald-200 text-emerald-900" : ventaResumen.pagado > 0 ? "bg-amber-100 text-amber-900" : "bg-rose-100 text-rose-900")}>
                          {ventaResumen.saldo === 0 && ventaResumen.precio > 0 ? "LIQUIDADO" : ventaResumen.pagado > 0 ? `${ventaResumen.pct}%` : "PENDIENTE"}
                        </span>
                      </span>
                      <span className="text-[11px] text-emerald-800/80 dark:text-emerald-400">{ventaResumen.cuantos} pago(s) · Saldo {pesosMx(ventaResumen.saldo)} · Venta y pagos ›</span>
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {avisoDeCreado && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2 bg-emerald-600 text-white text-sm font-medium px-4 py-2 rounded-lg shadow-lg">
            <Check className="w-4 h-4 shrink-0" />
            Trato creado. Ya puedes añadir notas y actividades aquí mismo.
          </div>
        )}

        {isAdminReadOnly && (
          <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800/30 px-6 py-2.5 flex items-center gap-2 text-amber-800 dark:text-amber-300 text-xs font-semibold shrink-0">
            <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>Este contacto pertenece a otro asesor. Como administrador, estás en modo de <strong>Solo Lectura</strong> para este contacto. Solo puedes visualizar la información y reasignarlo a otro asesor si lo consideras necesario.</span>
          </div>
        )}

        {showWantedVehicleMenu ? (
          <div className="flex-1 overflow-y-auto p-6 bg-[#f4f5f5] dark:bg-slate-900 flex flex-col items-center">
            <div className="max-w-2xl w-full bg-white dark:bg-slate-800 p-8 rounded shadow-sm border border-gray-200 dark:border-slate-700">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Características del Vehículo Buscado</h2>
                <p className="text-slate-500 dark:text-slate-400 mt-2">
                  El cliente tiene la etiqueta de "Busca de auto". Por favor, detalla qué es lo que está buscando para poder recomendarle vehículos del inventario.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tipo de Carrocería</label>
                  <select
                    value={formData.wantedVehicle?.bodyType || ""}
                    onChange={(e) => setFormData(p => ({ ...p, wantedVehicle: { ...p.wantedVehicle, bodyType: e.target.value } }))}
                    className="w-full text-sm border-gray-300 dark:border-slate-600 dark:bg-slate-700 bg-white rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="">Cualquiera</option>
                    <option value="SUV">SUV</option>
                    <option value="Sedan">Sedán</option>
                    <option value="Hatchback">Hatchback</option>
                    <option value="Pickup">Pickup</option>
                    <option value="Coupe">Coupé</option>
                    <option value="Minivan">Minivan</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Pasajeros</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="5"
                    value={formData.wantedVehicle?.passengers || ""}
                    onChange={(e) => setFormData(p => ({ ...p, wantedVehicle: { ...p.wantedVehicle, passengers: e.target.value ? parseInt(e.target.value) : undefined } }))}
                    className="w-full text-sm border-gray-300 dark:border-slate-600 dark:bg-slate-700 bg-white rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                {/* Un presupuesto es un rango, no solo un techo. Sin el
                    minimo, a quien busca un auto de un millon se le
                    recomendaba uno de trescientos mil como coincidencia
                    exacta: cabia en su presupuesto, pero no era su busqueda.
                    Si se deja vacio, se deduce del maximo. */}
                {/* Transmision y kilometraje: dos de los motivos de rechazo
                    mas comunes, y no se preguntaban. Quien no maneja estandar
                    no compra un estandar por bueno que sea. */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Transmisión</label>
                  <select
                    value={formData.wantedVehicle?.transmission || ""}
                    onChange={(e) => setFormData(p => ({ ...p, wantedVehicle: { ...p.wantedVehicle, transmission: e.target.value || undefined } }))}
                    className="w-full text-sm border-gray-300 dark:border-slate-600 dark:bg-slate-700 bg-white rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="">Cualquiera</option>
                    <option value="Automática">Automática</option>
                    <option value="Manual">Estándar / Manual</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Kilometraje Máximo</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="Opcional. Ej. 80000"
                    value={formData.wantedVehicle?.kmMax || ""}
                    onChange={(e) => setFormData(p => ({ ...p, wantedVehicle: { ...p.wantedVehicle, kmMax: e.target.value ? parseInt(e.target.value) : undefined } }))}
                    className="w-full text-sm border-gray-300 dark:border-slate-600 dark:bg-slate-700 bg-white rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Presupuesto Mínimo</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="Opcional"
                    value={formData.wantedVehicle?.priceMin || ""}
                    onChange={(e) => setFormData(p => ({ ...p, wantedVehicle: { ...p.wantedVehicle, priceMin: e.target.value ? parseInt(e.target.value) : undefined } }))}
                    className="w-full text-sm border-gray-300 dark:border-slate-600 dark:bg-slate-700 bg-white rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Presupuesto Máximo</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="$300,000"
                    value={formData.wantedVehicle?.priceMax || ""}
                    onChange={(e) => setFormData(p => ({ ...p, wantedVehicle: { ...p.wantedVehicle, priceMax: e.target.value ? parseInt(e.target.value) : undefined } }))}
                    className="w-full text-sm border-gray-300 dark:border-slate-600 dark:bg-slate-700 bg-white rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Marca</label>
                  <input
                    type="text"
                    placeholder="Ej. Toyota, Honda..."
                    value={formData.wantedVehicle?.make || ""}
                    onChange={(e) => setFormData(p => ({ ...p, wantedVehicle: { ...p.wantedVehicle, make: e.target.value } }))}
                    className="w-full text-sm border-gray-300 dark:border-slate-600 dark:bg-slate-700 bg-white rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Modelo / Versión</label>
                  <input
                    type="text"
                    placeholder="Ej. Civic, CR-V EX..."
                    value={formData.wantedVehicle?.model || ""}
                    onChange={(e) => setFormData(p => ({ ...p, wantedVehicle: { ...p.wantedVehicle, model: e.target.value } }))}
                    className="w-full text-sm border-gray-300 dark:border-slate-600 dark:bg-slate-700 bg-white rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Año Mínimo</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="2015"
                    value={formData.wantedVehicle?.yearMin || ""}
                    onChange={(e) => setFormData(p => ({ ...p, wantedVehicle: { ...p.wantedVehicle, yearMin: e.target.value ? parseInt(e.target.value) : undefined } }))}
                    className="w-full text-sm border-gray-300 dark:border-slate-600 dark:bg-slate-700 bg-white rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Año Máximo</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="2024"
                    value={formData.wantedVehicle?.yearMax || ""}
                    onChange={(e) => setFormData(p => ({ ...p, wantedVehicle: { ...p.wantedVehicle, yearMax: e.target.value ? parseInt(e.target.value) : undefined } }))}
                    className="w-full text-sm border-gray-300 dark:border-slate-600 dark:bg-slate-700 bg-white rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Combustible</label>
                  <select
                    value={formData.wantedVehicle?.combustible || ""}
                    onChange={(e) => setFormData(p => ({ ...p, wantedVehicle: { ...p.wantedVehicle, combustible: e.target.value || undefined } }))}
                    className="w-full text-sm border-gray-300 dark:border-slate-600 dark:bg-slate-700 bg-white rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="">Cualquiera</option>
                    <option value="Gasolina">Gasolina</option>
                    <option value="Híbrido">Híbrido</option>
                    <option value="Eléctrico">Eléctrico</option>
                    <option value="Diésel">Diésel</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Color (preferencia)</label>
                  <input
                    type="text"
                    placeholder="Ej. blanco, gris"
                    value={formData.wantedVehicle?.color || ""}
                    onChange={(e) => setFormData(p => ({ ...p, wantedVehicle: { ...p.wantedVehicle, color: e.target.value } }))}
                    className="w-full text-sm border-gray-300 dark:border-slate-600 dark:bg-slate-700 bg-white rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Lo que dijo el cliente, con sus palabras</label>
                  <textarea
                    rows={2}
                    placeholder="Ej. Lo quiere para la familia, que sea económico, tiene un Versa para dar a cuenta…"
                    value={formData.wantedVehicle?.notas || ""}
                    onChange={(e) => setFormData(p => ({ ...p, wantedVehicle: { ...p.wantedVehicle, notas: e.target.value } }))}
                    className="w-full text-sm border-gray-300 dark:border-slate-600 dark:bg-slate-700 bg-white rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">En marca y modelo puedes poner varias opciones separadas por coma («Toyota, Honda»): sirve cualquiera.</p>
                </div>
              </div>

              <div className="mt-8 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowWantedVehicleMenu(false)}
                  className="px-5 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors"
                >
                  Omitir por ahora
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    setShowWantedVehicleMenu(false);
                    handleSave(e, { cerrar: false });
                  }}
                  className="px-5 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm transition-colors"
                >
                  Guardar Preferencias
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
          <div className="flex-1 min-h-0 overflow-y-auto">
          <div className={clsx(
            "max-w-[1440px] mx-auto px-3 md:px-6 py-4 md:py-5 grid grid-cols-1 gap-4 md:gap-5 items-start",
            isNew ? "lg:grid-cols-[380px_minmax(0,1fr)]" : "lg:grid-cols-[300px_minmax(0,1fr)_340px]"
          )}>

          {/* IZQUIERDA: quién es (en el teléfono va al final) */}
          <aside className={clsx("flex flex-col gap-4 min-w-0", isNew ? "order-1" : "order-3 lg:order-1")}>
            {!isNew && (
              <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <h2 className="font-extrabold text-slate-900 dark:text-white">Lo que busca</h2>
                  {canModify && (
                    <button
                      type="button"
                      onClick={() => setShowWantedVehicleMenu(true)}
                      className="text-xs font-bold text-blue-700 dark:text-blue-300 hover:underline"
                    >
                      {frasesDeBusqueda(formData.wantedVehicle).length > 0 ? "Editar" : "Capturar"}
                    </button>
                  )}
                </div>
                {frasesDeBusqueda(formData.wantedVehicle).length > 0 ? (
                  <>
                  <ResumenBusquedaAuto buscado={formData.wantedVehicle} compacto className="!bg-transparent !border-0 !p-0" />
                  {formData.wantedVehicle?.notas && <p className="mt-2 text-xs italic text-slate-600 dark:text-slate-300">«{formData.wantedVehicle.notas}»</p>}
                  {avisoPreferencias && <p className="mt-2 text-xs font-bold text-emerald-700 dark:text-emerald-400">Preferencias guardadas.</p>}
                  {(() => {
                    const cs = getClientMatches({ ...(formData as any), status: "open" } as Client, inventoryVehicles.filter((v) => v.status === "available" || !v.status)).slice(0, 4);
                    return (
                      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Autos que le sirven ({cs.length})</p>
                        {cs.length === 0 ? (
                          <p className="text-xs text-slate-500">Ninguno del inventario cumple lo que pide. Si el rango es muy estrecho, abre «Editar» y amplíalo.</p>
                        ) : (
                          <ul className="space-y-2">
                            {cs.map((m) => (
                              <li key={m.vehicle.id} className="rounded-lg border border-slate-200 dark:border-slate-700 p-2">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{m.vehicle.year} {m.vehicle.make} {m.vehicle.model}</p>
                                  <span className={clsx("text-[10px] font-extrabold px-1.5 py-0.5 rounded-full shrink-0", m.level === "exact" || m.level === "high" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900")}>
                                    {m.level === "exact" ? "Ideal" : m.level === "high" ? "Muy buena" : "Posible"}
                                  </span>
                                </div>
                                <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">{m.vehicle.price ? "$" + Number(m.vehicle.price).toLocaleString("es-MX") : "Sin precio"}</p>
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {m.razones.slice(0, 5).map((r, i) => (
                                    <span key={i} className={clsx("text-[10px] font-semibold px-1.5 py-0.5 rounded", r.ok ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900")}>{r.ok ? "✓" : "!"} {r.t}</span>
                                  ))}
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })()}
                  </>
                ) : (
                  <p className="text-sm text-slate-500 dark:text-slate-400">Aún no se captura qué auto busca. Con eso el CRM le encuentra coincidencias en tu inventario.</p>
                )}
              </section>
            )}

            <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
              <h2 className="font-extrabold text-slate-900 dark:text-white mb-3">Datos del cliente</h2>
              <form
                id="client-form"
                onSubmit={handleSave}
                className="space-y-4"
              >
                <div
                  className={`space-y-1 relative ${
                    isNew && currentStep !== 2 ? "hidden md:block" : ""
                  }`}
                  ref={vehicleSearchRef}
                >
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                      Valor / Vehículo
                    </label>
                    {formData.vehicleId || (formData.vehicle && formData.vehicle !== "Otro pendiente") ? (
                      <button
                        type="button"
                        onClick={() => {
                          setFormData({
                            ...formData,
                            vehicle: "",
                            // null y no undefined: los campos undefined se
                            // descartan antes de guardar, de modo que con
                            // merge el valor anterior quedaba intacto y el
                            // auto no se podia quitar.
                            vehicleId: null as any,
                          });
                          setIsVehicleSearchOpen(false);
                          setVehicleSearchQuery("");
                        }}
                        className="text-[11px] font-medium text-rose-500 hover:underline"
                      >
                        Quitar auto
                      </button>
                    ) : null}
                  </div>

                  {(() => {
                    const assignedV = inventoryVehicles.find(
                      (v) => v.id === formData.vehicleId
                    );

                    return (
                      <div>
                        {!isVehicleSearchOpen ? (
                          <div
                            onClick={() => setIsVehicleSearchOpen(true)}
                            className="group cursor-pointer p-2.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-blue-500 dark:hover:border-blue-400 transition-all shadow-sm"
                          >
                            {assignedV ? (
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  {assignedV.photoUrls?.[0] || assignedV.photoUrl ? (
                                    <img
                                      src={assignedV.photoUrls?.[0] || assignedV.photoUrl}
                                      alt="vehiculo"
                                      className="w-10 h-8 object-cover rounded border border-gray-200 dark:border-slate-600 shrink-0"
                                    />
                                  ) : (
                                    <div className="w-10 h-8 rounded bg-blue-50 dark:bg-slate-700 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                                      <Car className="w-5 h-5" />
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold text-gray-900 dark:text-slate-100 truncate">
                                      {assignedV.year} {assignedV.make} {assignedV.model}
                                    </p>
                                    <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                                      {assignedV.price
                                        ? new Intl.NumberFormat("es-MX", {
                                            style: "currency",
                                            currency: "MXN",
                                            maximumFractionDigits: 0,
                                          }).format(assignedV.price)
                                        : "Sin precio"}{" "}
                                      {assignedV.vin ? `• VIN: ${assignedV.vin.slice(-6)}` : ""}
                                    </p>
                                  </div>
                                </div>
                                <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 group-hover:underline shrink-0">
                                  Cambiar
                                </span>
                              </div>
                            ) : formData.vehicle === "Otro pendiente" ? (
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-xs font-semibold text-amber-600 dark:text-amber-400">
                                  <Car className="w-4 h-4" />
                                  <span>Otro pendiente</span>
                                </div>
                                <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 group-hover:underline">
                                  Cambiar
                                </span>
                              </div>
                            ) : formData.vehicle ? (
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-xs font-semibold text-gray-800 dark:text-slate-200">
                                  <Car className="w-4 h-4 text-blue-500" />
                                  <span className="truncate">{formData.vehicle}</span>
                                </div>
                                <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 group-hover:underline">
                                  Cambiar
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-slate-400 py-0.5">
                                <div className="flex items-center gap-2">
                                  <Search className="w-4 h-4 text-blue-500" />
                                  <span>Buscar auto en inventario...</span>
                                </div>
                                <ChevronDown className="w-4 h-4 text-gray-400" />
                              </div>
                            )}
                          </div>
                        ) : (
                          /* Search Input & Dropdown Panel */
                          <div className="space-y-2">
                            <div className="relative">
                              <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-2.5 pointer-events-none" />
                              <input
                                type="text"
                                autoFocus
                                value={vehicleSearchQuery}
                                onChange={(e) => setVehicleSearchQuery(e.target.value)}
                                placeholder="Buscar por marca, modelo, año, VIN, placa..."
                                className="w-full text-xs pl-8 pr-7 py-2 border border-blue-500 dark:border-blue-400 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none shadow-sm"
                              />
                              {vehicleSearchQuery ? (
                                <button
                                  type="button"
                                  onClick={() => setVehicleSearchQuery("")}
                                  className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setIsVehicleSearchOpen(false)}
                                  className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
                                >
                                  <ChevronUp className="w-4 h-4" />
                                </button>
                              )}
                            </div>

                            {/* Dropdown Options List */}
                            <div className="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-xl max-h-64 overflow-y-auto divide-y divide-gray-100 dark:divide-slate-700">
                              {/* Option: Otro pendiente */}
                              <div
                                onClick={() => {
                                  setFormData({
                                    ...formData,
                                    vehicle: "Otro pendiente",
                                    // null para que si venia de un auto del
                                    // inventario, el id anterior se limpie
                                    // en lugar de conservarse.
                                    vehicleId: null as any,
                                  });
                                  setIsVehicleSearchOpen(false);
                                  setVehicleSearchQuery("");
                                }}
                                className="p-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/60 cursor-pointer flex items-center gap-2 text-xs font-semibold text-amber-600 dark:text-amber-400"
                              >
                                <Car className="w-4 h-4" />
                                <span>Otro pendiente / No listado</span>
                              </div>

                              {/* Filtered Inventory Vehicles */}
                              {(() => {
                                const query = vehicleSearchQuery.toLowerCase().trim();
                                const matches = inventoryVehicles.filter((v) => {
                                  if (!query) return true;
                                  const text = `${v.year} ${v.make} ${v.model} ${v.bodyType || ""} ${v.vin || ""} ${v.color || ""} ${v.equipment || ""} ${(v as any).version || ""} ${(v as any).licensePlate || ""} ${(v as any).stockNumber || ""} ${v.price || ""}`.toLowerCase();
                                  return query.split(" ").every((term) => text.includes(term));
                                });

                                if (matches.length === 0) {
                                  return (
                                    <div className="p-4 text-center text-xs text-gray-500 dark:text-slate-400">
                                      No se encontraron autos que coincidan con "{vehicleSearchQuery}"
                                    </div>
                                  );
                                }

                                return matches.map((v) => {
                                  const isSelected = formData.vehicleId === v.id;
                                  const photo = v.photoUrls?.[0] || v.photoUrl;

                                  return (
                                    <div
                                      key={`search-v-${v.id}`}
                                      onClick={() => {
                                        setFormData({
                                          ...formData,
                                          vehicle: `${v.year} ${v.make} ${v.model}`,
                                          vehicleId: v.id,
                                          dealValue: v.price || formData.dealValue,
                                        });
                                        setIsVehicleSearchOpen(false);
                                        setVehicleSearchQuery("");
                                      }}
                                      className={clsx(
                                        "p-2.5 hover:bg-blue-50 dark:hover:bg-slate-700 cursor-pointer flex items-center justify-between gap-2 transition-colors",
                                        isSelected && "bg-blue-50/80 dark:bg-slate-700/80"
                                      )}
                                    >
                                      <div className="flex items-center gap-2.5 min-w-0">
                                        {photo ? (
                                          <img
                                            src={photo}
                                            alt={`${v.make} ${v.model}`}
                                            className="w-11 h-8 object-cover rounded border border-gray-200 dark:border-slate-600 shrink-0"
                                          />
                                        ) : (
                                          <div className="w-11 h-8 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 flex items-center justify-center shrink-0">
                                            <Car className="w-4 h-4" />
                                          </div>
                                        )}

                                        <div className="min-w-0">
                                          <p className="text-xs font-bold text-gray-900 dark:text-slate-100 truncate">
                                            {v.year} {v.make} {v.model}
                                          </p>
                                          <p className="text-[11px] text-gray-500 dark:text-slate-400 truncate">
                                            {v.price
                                              ? new Intl.NumberFormat("es-MX", {
                                                  style: "currency",
                                                  currency: "MXN",
                                                  maximumFractionDigits: 0,
                                                }).format(v.price)
                                              : "Sin precio"}
                                            {v.vin ? ` • VIN: ${v.vin}` : ""}
                                            {v.color ? ` • ${v.color}` : ""}
                                          </p>
                                        </div>
                                      </div>

                                      {isSelected && (
                                        <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                                      )}
                                    </div>
                                  );
                                });
                              })()}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>


                <div className={`pt-2 border-t border-gray-100 dark:border-slate-700 space-y-1 ${isNew && currentStep !== 1 ? "hidden md:block" : ""}`}>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    Persona
                  </label>
                  <div
                    className="flex items-center gap-2 relative"
                    ref={nameInputRef}
                  >
                    <User className="w-4 h-4 text-gray-400" />
                    <input
                      name="name"
                      autoComplete="off"
                      placeholder="Nombre"
                      value={formData.name || ""}
                      onChange={handleNameChange}
                      onFocus={() => setShowNameSuggestions(true)}
                      className="w-full text-sm py-1 font-medium border-b border-transparent hover:border-gray-300 focus:border-blue-600 focus:outline-none"
                    />
                    {showNameSuggestions && formData.name && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-md shadow-sm z-50 max-h-48 overflow-y-auto">
                        {existingPersons.filter((p) =>
                          p.name
                            ?.toLowerCase()
                            .includes((formData.name || "").toLowerCase()),
                        ).length > 0 ? (
                          existingPersons
                            .filter((p) =>
                              p.name
                                ?.toLowerCase()
                                .includes((formData.name || "").toLowerCase()),
                            )
                            .map((p, i) => (
                              <div
                                key={`person-${p.id}-${i}`}
                                className="px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                                onClick={() => handleSelectPerson(p)}
                              >
                                <div className="font-medium text-slate-900 dark:text-slate-100">
                                  {p.name}
                                </div>
                                {p.phone && (
                                  <div className="text-xs text-slate-500">
                                    {p.phone}
                                  </div>
                                )}
                              </div>
                            ))
                        ) : (
                          <div className="px-3 py-2 text-sm text-slate-500 italic">
                            No hay coincidencias (se guardará como nuevo)
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Building2 className="w-4 h-4 text-gray-400" />
                    <input
                      name="organization"
                      placeholder="Organización / Empresa"
                      value={formData.organization || ""}
                      onChange={handleChange}
                      className="w-full bg-transparent dark:text-slate-200 text-sm py-1 border-b border-transparent hover:border-gray-300 focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                  {!(isNew && selectedPersonId) && (
                    <div className="flex items-center gap-2 mt-2">
                      <Globe className="w-4 h-4 text-gray-400" />
                      <select
                        name="fuente"
                        value={(formData as any).fuente || ""}
                        onChange={handleChange}
                        title="¿Cómo llegó?"
                        className={`w-full bg-transparent text-sm py-1 border-b focus:border-blue-600 focus:outline-none dark:bg-slate-800 ${
                          isNew && !(formData as any).fuente
                            ? "border-red-300 text-slate-500"
                            : "border-transparent hover:border-gray-300 dark:text-slate-200"
                        }`}
                      >
                        <option value="">{isNew ? "¿Cómo llegó? (obligatorio)" : "¿Cómo llegó? Sin dato"}</option>
                        {FUENTES.map((f) => (
                          <option key={f.id} value={f.id}>{f.etiqueta}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div
                    className="flex items-center gap-2 mt-2 relative"
                    ref={phoneInputRef}
                  >
                    <Phone className="w-4 h-4 text-gray-400" />
                    <input
                      name="phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="off"
                      placeholder="Teléfono"
                      value={formData.phone || ""}
                      onChange={handlePhoneChange}
                      onFocus={() => setShowPhoneSuggestions(true)}
                      className="w-full bg-transparent dark:text-slate-200 text-sm py-1 border-b border-transparent hover:border-gray-300 focus:border-blue-600 focus:outline-none"
                    />
                    {showPhoneSuggestions && formData.phone && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-md shadow-sm z-50 max-h-48 overflow-y-auto">
                        {existingPersons.filter((p) =>
                          p.phone?.includes(formData.phone || ""),
                        ).length > 0 ? (
                          existingPersons
                            .filter((p) =>
                              p.phone?.includes(formData.phone || ""),
                            )
                            .map((p, i) => (
                              <div
                                key={`person-${p.id}-${i}`}
                                className="px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                                onClick={() => handleSelectPerson(p)}
                              >
                                <div className="font-medium text-slate-900 dark:text-slate-100">
                                  {p.phone}
                                </div>
                                {p.name && (
                                  <div className="text-xs text-slate-500">
                                    {p.name}
                                  </div>
                                )}
                              </div>
                            ))
                        ) : (
                          <div className="px-3 py-2 text-sm text-slate-500 italic">
                            No hay coincidencias (se guardará como nuevo)
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 mt-2">
                    {/* Reasignar es facultad de administracion. Antes solo se
                        ocultaba el titulo y el selector quedaba disponible, de
                        modo que un asesor podia pasarle sus clientes a otro. */}
                    {(userData?.role === 'admin' || userData?.role === 'master') ? (
                      <>
                        <span className="text-[10px] uppercase font-extrabold tracking-wider text-indigo-600 dark:text-indigo-400">
                          Reasignación de Trato / Vendedor
                        </span>
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-gray-400 shrink-0" />
                          <select
                            id="sellerId-select"
                            name="sellerId"
                            value={formData.sellerId || ""}
                            onChange={handleChange}
                            className="w-full bg-transparent dark:text-slate-200 text-sm py-1 border-b border-gray-200 dark:border-slate-700 hover:border-gray-300 focus:border-blue-600 focus:outline-none"
                          >
                            <option value="" disabled>
                              Seleccionar Asignado...
                            </option>
                            {agencyUsers
                              .filter((u) => u.role !== "unassigned")
                              .map((u) => (
                                <option key={`user-${u.id}`} value={u.id}>
                                  {(!u.name || u.name === 'Usuario Pendiente')
                                    ? (u.role === 'admin' ? 'Administrador' : u.email?.split('@')[0] || 'Usuario')
                                    : u.name} {u.role === 'admin' ? '(Admin)' : u.role === 'master' ? '(Master)' : '(Vendedor)'}
                                </option>
                              ))}
                          </select>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-gray-400 shrink-0" />
                        <span className="text-sm text-slate-600 dark:text-slate-300 py-1">
                          {(() => {
                            const asignado = agencyUsers.find((u) => u.id === formData.sellerId);
                            if (!asignado) return "Sin asignar";
                            return (!asignado.name || asignado.name === 'Usuario Pendiente')
                              ? (asignado.email?.split('@')[0] || 'Usuario')
                              : asignado.name;
                          })()}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Eye className="w-4 h-4 text-gray-400" />
                    <select
                      name="visibility"
                      value={formData.visibility || "all"}
                      onChange={handleChange}
                      className="w-full bg-transparent dark:text-slate-200 text-sm py-1 border-b border-transparent hover:border-gray-300 focus:border-blue-600 focus:outline-none"
                    >
                      <option value="all">Visible para todos</option>
                      <option value="private">
                        Privado (Solo asignado y admin)
                      </option>
                    </select>
                  </div>
                  {existingPersons.find(
                    (p) =>
                      p.phone &&
                      formData.phone &&
                      formData.phone.length > 5 &&
                      p.phone.includes(formData.phone) &&
                      p.id !== formData.id,
                  ) && (
                    <p className="text-[11px] text-orange-600 font-medium ml-6">
                      Este teléfono podría estar ligado a:{" "}
                      {
                        existingPersons.find(
                          (p) =>
                            p.phone &&
                            formData.phone &&
                            p.phone.includes(formData.phone) &&
                            p.id !== formData.id,
                        )?.name
                      }
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <MessageCircle className="w-4 h-4 text-gray-400" />
                    <input
                      type="email"
                      name="email"
                      list="existing-emails-list"
                      placeholder="Correo"
                      value={formData.email || ""}
                      onChange={handleChange}
                      className="w-full bg-transparent dark:text-slate-200 text-sm py-1 border-b border-transparent hover:border-gray-300 focus:border-blue-600 focus:outline-none"
                    />
                    <datalist id="existing-emails-list">
                      {existingPersons
                        .filter((p) => p.email)
                        .map((p, i) => (
                          <option key={`person-${p.id}-${i}`} value={p.email}>
                            {p.name}
                          </option>
                        ))}
                    </datalist>
                  </div>
                  {existingPersons.find(
                    (p) =>
                      p.email &&
                      formData.email &&
                      formData.email.length > 5 &&
                      p.email.includes(formData.email) &&
                      p.id !== formData.id,
                  ) && (
                    <p className="text-[11px] text-orange-600 font-medium ml-6">
                      Este correo podría estar ligado a:{" "}
                      {
                        existingPersons.find(
                          (p) =>
                            p.email &&
                            formData.email &&
                            p.email.includes(formData.email) &&
                            p.id !== formData.id,
                        )?.name
                      }
                    </p>
                  )}
                </div>

                <div className="pt-4 border-t border-gray-100 dark:border-slate-700 space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                      Dirección
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        if (showFullAddress) {
                          const parts = [
                            formData.street,
                            formData.exteriorNumber,
                            formData.neighborhood,
                            formData.city,
                            formData.zipCode,
                          ].filter(Boolean);
                          if (parts.length > 0) {
                            setFormData((prev) => ({
                              ...prev,
                              address: parts.join(", "),
                            }));
                          }
                        }
                        setShowFullAddress(!showFullAddress);
                      }}
                      className="text-[10px] text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-bold uppercase tracking-wider"
                    >
                      {showFullAddress
                        ? "Ocultar detalles"
                        : "Desglosar dirección"}
                    </button>
                  </div>
                  {showFullAddress ? (
                    <div className="grid grid-cols-2 gap-3 mt-2">
                      <div className="col-span-2">
                        <input
                          name="street"
                          placeholder="Calle"
                          value={formData.street || ""}
                          onChange={handleChange}
                          className="w-full bg-transparent dark:text-slate-200 text-sm py-1 border-b border-transparent hover:border-gray-300 focus:border-blue-600 focus:outline-none"
                        />
                      </div>
                      <div>
                        <input
                          name="exteriorNumber"
                          placeholder="Número Ext/Int"
                          value={formData.exteriorNumber || ""}
                          onChange={handleChange}
                          className="w-full bg-transparent dark:text-slate-200 text-sm py-1 border-b border-transparent hover:border-gray-300 focus:border-blue-600 focus:outline-none"
                        />
                      </div>
                      <div>
                        <input
                          name="neighborhood"
                          placeholder="Colonia"
                          value={formData.neighborhood || ""}
                          onChange={handleChange}
                          className="w-full bg-transparent dark:text-slate-200 text-sm py-1 border-b border-transparent hover:border-gray-300 focus:border-blue-600 focus:outline-none"
                        />
                      </div>
                      <div>
                        <input
                          name="city"
                          placeholder="Ciudad y estado"
                          value={formData.city || ""}
                          onChange={handleChange}
                          className="w-full bg-transparent dark:text-slate-200 text-sm py-1 border-b border-transparent hover:border-gray-300 focus:border-blue-600 focus:outline-none"
                        />
                      </div>
                      <div>
                        <input
                          name="zipCode"
                          placeholder="Código Postal"
                          value={formData.zipCode || ""}
                          onChange={handleChange}
                          className="w-full bg-transparent dark:text-slate-200 text-sm py-1 border-b border-transparent hover:border-gray-300 focus:border-blue-600 focus:outline-none"
                        />
                      </div>
                    </div>
                  ) : (
                    <input
                      name="address"
                      placeholder="Ej. Calle 123..."
                      value={formData.address || ""}
                      onChange={handleChange}
                      className="w-full bg-transparent dark:text-slate-200 text-sm py-1 border-b border-transparent hover:border-gray-300 focus:border-blue-600 focus:outline-none"
                    />
                  )}
                </div>

                <div className="pt-4 border-t border-gray-100 dark:border-slate-700 space-y-2">
                  <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Tag className="w-3.5 h-3.5 text-indigo-505" />
                    Etiquetas
                  </label>
                  <select
                    value=""
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val) handleTagToggle(val);
                      e.target.value = "";
                    }}
                    className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded p-1.5 focus:ring-1 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none"
                  >
                    <option value="" disabled>
                      Seleccionar etiqueta...
                    </option>
                    {availableTags.map((tag, i) => (
                      <option key={`opt-${tag}-${i}`} value={tag}>
                        {tag} {(formData.tags || []).includes(tag) ? "✓" : ""}
                      </option>
                    ))}
                  </select>

                  {formData.tags && formData.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {formData.tags.map((tag, idx) => (
                        <span
                          key={`${tag}-${idx}`}
                          className="inline-flex items-center gap-1 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800/10 px-2 py-0.5 rounded-full text-[10px] font-bold"
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={() => handleTagToggle(tag)}
                            className="text-indigo-400 hover:text-red-500 font-bold ml-1 text-[11px] leading-none"
                            title="Eliminar etiqueta"
                          >
                            &times;
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] text-gray-400 dark:text-slate-500 italic mt-1">
                      Sin etiquetas personalizadas.
                    </p>
                  )}

                </div>

                <div className="pt-4 border-t border-gray-100 dark:border-slate-700">
                  <span className="text-xs text-gray-400 font-medium">
                    Fuente: {formData.origin}
                  </span>
                </div>
              
                {isNew && (
                  <div className="md:hidden flex flex-col gap-2 pt-4">
                    {currentStep === 1 ? (
                      <button
                        type="button"
                        onClick={() => setCurrentStep(2)}
                        className="w-full bg-blue-600 text-white font-bold py-3 rounded shadow-sm active:scale-95 transition-all text-center"
                      >
                        Continuar
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setCurrentStep(1)}
                          className="w-1/3 bg-gray-200 text-gray-800 font-bold py-3 rounded active:scale-95 transition-all text-center"
                        >
                          Atrás
                        </button>
                        <button
                          type="submit"
                          className="flex-1 bg-emerald-600 text-white font-bold py-3 rounded shadow-sm active:scale-95 transition-all text-center"
                        >
                          Guardar Prospecto
                        </button>
                      </div>
                    )}
                  </div>
                )}

              </form>
            </section>
          </aside>

          {/* CENTRO: qué está pasando */}
          <section className={clsx("flex flex-col gap-4 min-w-0", isNew ? "order-2" : "order-1 lg:order-2")}>
            {!isNew ? (
              <>
                {/* Próximo paso: la tarea pendiente más cercana, a la vista. */}
                {proximoPaso ? (
                  <div className={clsx(
                    "rounded-2xl border-2 p-3.5 md:p-4 flex flex-col sm:flex-row sm:items-center gap-3",
                    proximoVencido ? "border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/30" : "border-blue-200 bg-blue-50 dark:border-blue-900/60 dark:bg-blue-950/30"
                  )}>
                    <div className={clsx("w-10 h-10 rounded-xl text-white flex items-center justify-center shrink-0", proximoVencido ? "bg-red-600" : "bg-blue-700")}>
                      <Clock className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={clsx("text-[11px] font-extrabold uppercase tracking-wide", proximoVencido ? "text-red-700 dark:text-red-300" : "text-blue-800 dark:text-blue-300")}>
                        Próximo paso{proximoVencido ? " · vencido" : ""}{pendientesEnOrden.length > 1 ? ` · ${pendientesEnOrden.length} pendientes` : ""}
                      </p>
                      <p className="font-bold text-slate-900 dark:text-white truncate">{proximoPaso.title}</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        {proximoPaso.dueDate
                          ? new Date(`${proximoPaso.dueDate.slice(0, 10)}T12:00:00`).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })
                          : "Sin fecha"}
                        {(proximoPaso.startTime || proximoPaso.dueTime) ? `, ${proximoPaso.startTime || proximoPaso.dueTime}${proximoPaso.endTime ? ` a ${proximoPaso.endTime}` : ""}` : ""}
                      </p>
                    </div>
                    {!isAdminReadOnly && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => { handleEditTaskClick(proximoPaso); setActiveTab("activity"); setTimeout(() => composerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 50); }}
                          className="h-9 px-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-700"
                        >
                          Reprogramar
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleTaskCompletion(proximoPaso)}
                          className="h-9 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold flex items-center gap-1"
                        >
                          <Check className="w-4 h-4" /> Hecho
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 bg-white/60 dark:bg-slate-800/60 px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                    Sin pendientes con este cliente. Programa la siguiente llamada o visita para que no se enfríe.
                  </div>
                )}

                {/* Escribir: tarea, nota o archivo */}
                <div ref={composerRef} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <div className="flex gap-1 px-3 pt-3" role="tablist" aria-label="Qué quieres agregar">
                    {([
                      ["activity", "Tarea", Calendar],
                      ["notes", "Nota", FileText],
                      ["files", "Archivo", Upload],
                    ] as const).map(([id, texto, Icono]) => (
                      <button
                        key={id}
                        type="button"
                        role="tab"
                        aria-selected={activeTab === id}
                        onClick={() => setActiveTab(id)}
                        className={clsx(
                          "h-8 px-3 rounded-lg text-sm font-bold flex items-center gap-1.5",
                          activeTab === id ? "bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-200" : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                        )}
                      >
                        <Icono className="w-4 h-4" /> {texto}
                      </button>
                    ))}
                  </div>
                  <div className="p-3 md:p-4">
                    {isAdminReadOnly ? (
                      <div className="text-center py-6 text-slate-500 dark:text-slate-400">
                        <Lock className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Sección en Modo Lectura</p>
                        <p className="text-xs mt-1">Como administrador, no puedes agregar notas, actividades, archivos ni nuevos tratos a este contacto porque pertenece a otro asesor.</p>
                      </div>
                    ) : (
                      <>
                        {activeTab === "activity" && (
                      <div>
                        <input
                          type="text"
                          placeholder="Tomar nota o crear tarea..."
                          value={newTaskTitle}
                          onChange={(e) => setNewTaskTitle(e.target.value)}
                          className="w-full text-sm border border-gray-300 rounded p-2 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 mb-3"
                        />
                        <div className="flex gap-2 items-center mb-3">
                          <input
                            type="date"
                            value={newTaskDate}
                            onChange={(e) => setNewTaskDate(e.target.value)}
                            className="flex-1 text-sm border border-gray-300 rounded p-1.5 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                          />
                          <TimeSelect
                            value={newTaskTime}
                            onChange={(val) => setNewTaskTime(val)}
                            placeholder="h:mm"
                            minHour={businessHours.start}
                            maxHour={businessHours.end}
                          />
                        </div>
                        <div className="flex justify-end items-center gap-2">
                          {editingTaskId && (
                            <button
                              onClick={cancelEditTask}
                              className="text-gray-500 hover:text-gray-700 text-sm font-medium px-4 py-1.5 rounded transition-colors"
                            >
                              Cancelar
                            </button>
                          )}
                          <button
                            onClick={handleAddTask}
                            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium text-sm px-4 py-1.5 rounded transition-colors"
                          >
                            {editingTaskId ? "Guardar Cambios" : "Programar Tarea"}
                          </button>
                        </div>
                      </div>
                    )}
                    {activeTab === "notes" && (
                      <div className="flex flex-col gap-3">
                        <textarea
                          placeholder="Toma una nota..."
                          value={newNoteContent}
                          onChange={(e) => setNewNoteContent(e.target.value)}
                          className="w-full text-sm border border-gray-300 rounded p-2 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 min-h-[80px]"
                        />
                        <div className="flex justify-end">
                          <button
                            onClick={handleAddNote}
                            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium text-sm px-4 py-1.5 rounded transition-colors"
                          >
                            Guardar Nota
                          </button>
                        </div>
                      </div>
                    )}
    {activeTab === "files" && (
                      <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-200 dark:border-slate-700 rounded bg-gray-50 dark:bg-slate-900 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
                        <Upload className="w-8 h-8 text-gray-400 mb-2" />
                        <label className="text-sm font-medium text-blue-600 cursor-pointer hover:underline">
                          Haz clic para subir un archivo
                          <input
                            type="file"
                            className="hidden"
                            onChange={handleFileUpload}
                          />
                        </label>
                        <p className="text-xs text-gray-400 mt-1">
                          Imágenes o documentos PDF
                        </p>
                      </div>
                    )}
                      </>
                    )}
                  </div>
                </div>

                {/* Pestañas: actividad, tratos, notas, archivos y la venta */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <div className="flex gap-4 md:gap-5 px-4 border-b border-slate-200 dark:border-slate-700 overflow-x-auto" role="tablist" aria-label="Secciones de la ficha">
                    {([
                      ["resumen", "Actividad", null],
                      ["tratos", "Tratos", deals.length],
                      ["notas", "Notas", notes.length],
                      ["archivos", "Archivos", files.length],
                    ] as [Seccion, string, number | null][]).map(([id, texto, cuenta]) => (
                      <button
                        key={id}
                        type="button"
                        role="tab"
                        aria-selected={seccion === id}
                        onClick={() => irASeccion(id)}
                        className={clsx(
                          "py-3 text-sm font-bold border-b-2 whitespace-nowrap flex items-center gap-1.5",
                          seccion === id ? "border-blue-700 text-blue-800 dark:text-blue-300 dark:border-blue-400" : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                        )}
                      >
                        {texto}
                        {!!cuenta && <span className="text-[11px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-full px-1.5">{cuenta}</span>}
                      </button>
                    ))}
                    {ventaResumen && (
                      <button
                        type="button"
                        onClick={abrirVentaYPagos}
                        className="py-3 text-sm font-bold border-b-2 border-transparent whitespace-nowrap text-emerald-700 dark:text-emerald-400 hover:text-emerald-900"
                      >
                        Venta y pagos
                      </button>
                    )}
                  </div>

                  <div className="p-4 md:p-5 flex flex-col gap-5">
                    {/* Las demás tareas pendientes (la primera ya está arriba). */}
                    {seccion === "resumen" && pendientesEnOrden.length > 1 && (
                      <div>
                        <h3 className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">Otras tareas pendientes</h3>
                        <ul className="rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
                          {pendientesEnOrden.slice(1).map((t) => (
                            <li key={`task-${t.id}`} className="flex items-center justify-between gap-3 p-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <button
                                  type="button"
                                  onClick={() => toggleTaskCompletion(t)}
                                  aria-label={`Marcar como hecha: ${t.title}`}
                                  className="w-5 h-5 rounded-full border-2 border-slate-300 hover:border-emerald-500 shrink-0"
                                />
                                <button type="button" onClick={() => handleEditTaskClick(t)} className="text-sm font-medium text-slate-800 dark:text-slate-200 hover:text-blue-700 truncate text-left">
                                  {t.title}
                                </button>
                              </div>
                              <span className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 shrink-0">
                                <Clock className="w-3.5 h-3.5" />
                                {t.dueDate}
                                {(t.startTime || t.dueTime) && <b className="text-slate-700 dark:text-slate-200">{t.startTime || t.dueTime}{t.endTime ? ` a ${t.endTime}` : ""}</b>}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {seccion === "tratos" && (
      <div className="flex flex-col gap-3">
        <button
          onClick={async () => {
            const title = prompt("Nombre del trato (ej: Compra de Ford Lobo):");
            if (!title) return;
            const ref = doc(collection(db, "deals"));
            const actualClientId = client.originalClientId || client.id;
            const initialStage = pipelineStages[0]?.id || "lead";
            await setDoc(ref, {
              id: ref.id,
              agencyId: userData?.agencyId || "",
              clientId: actualClientId,
              sellerId: client.sellerId || userData?.id || "",
              title,
              status: initialStage,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });
          }}
          className="w-full py-2 bg-blue-600 text-white rounded text-sm font-medium shadow-sm hover:bg-blue-700 transition-colors"
        >
          + Nuevo Trato
        </button>
        {deals.length === 0 ? (
          <p className="text-sm text-center text-slate-500 py-4">No hay tratos activos para este contacto.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {deals.map(deal => (
              <div key={`deal-${deal.id}`} className="p-3 border border-gray-200 dark:border-slate-700 rounded shadow-sm bg-[#f4f5f5] dark:bg-slate-800/50 flex justify-between items-center">
                <div>
                  <h4 className="font-semibold text-slate-800 dark:text-slate-200">{deal.title}</h4>
                  <p className="text-xs text-slate-500">Estado: {deal.status || deal.stageId || 'Open'}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={async () => {
                      const nuevoTitulo = prompt("Nuevo nombre del trato:", deal.title || "");
                      if (nuevoTitulo === null) return;
                      const limpio = nuevoTitulo.trim();
                      if (!limpio) {
                        alert("El nombre del trato no puede quedar vacío.");
                        return;
                      }
                      if (limpio === deal.title) return;
                      try {
                        await setDoc(
                          doc(db, "deals", deal.id),
                          { title: limpio, updatedAt: new Date().toISOString() },
                          { merge: true }
                        );
                      } catch (e: any) {
                        alert("No se pudo renombrar el trato: " + (e?.message || e));
                      }
                    }}
                    className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-2 py-1 rounded hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                  >
                    Renombrar
                  </button>
                  {puedeEliminarTratos && (
                    <button
                      onClick={async () => {
                        const pagos = (deal as any).saleDetails?.payments?.length || 0;
                        const aviso = pagos > 0
                          ? `Este trato tiene ${pagos} pago${pagos === 1 ? '' : 's'} registrado${pagos === 1 ? '' : 's'}. ` +
                            "Al borrarlo se pierden. Esto no se puede deshacer. ¿Continuar?"
                          : "Se va a borrar este trato y su historial. " +
                            "Esto no se puede deshacer. ¿Continuar?";
                        if (!confirm(aviso)) return;
                        try {
                          await deleteDoc(doc(db, "deals", deal.id));
                        } catch (e: any) {
                          alert("No se pudo borrar el trato: " + (e?.message || e));
                        }
                      }}
                      className="text-xs bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-2 py-1 rounded hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
                    >
                      Eliminar
                    </button>
                  )}
                  <button
                    onClick={async () => {
                      if (confirm("¿Marcar trato como ganado?")) {
                        await guardarTratoSiExiste(deal.id, { status: "won" });
                      }
                    }}
                    className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded"
                  >
                    Marcar Ganado
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )}

                    {seccion !== "tratos" && (
                      <div>
                        {seccion === "resumen" && <h3 className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-3">Historial</h3>}
                        {seccion === "notas" && notes.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400 py-4 text-center">Aún no hay notas.</p>}
                        {seccion === "archivos" && files.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400 py-4 text-center">Aún no hay archivos. Súbelos desde «Archivo», arriba.</p>}
                  <div className="relative pl-6 space-y-6 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-0 before:w-0.5 before:bg-gray-200">
                    {seccion === "resumen" && formData.soldAt && (
                      <div className="relative">
                        <div className="absolute -left-[27px] top-1 w-4 h-4 rounded-full bg-blue-600 border-2 border-white shadow-sm flex items-center justify-center">
                          <CheckSquare className="w-2.5 h-2.5 text-white" />
                        </div>
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 p-3 rounded mr-2">
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                              Trato Ganado / Vehículo Vendido
                            </span>
                            <span className="text-[10px] text-blue-500 font-medium">
                              {formData.soldAt.split('T')[0]}
                            </span>
                          </div>
                          <p className="text-sm text-blue-800 dark:text-blue-300">
                            Venta realizada y registrada.
                          </p>
                        </div>
                      </div>
                    )}
                    {/* History items: Files and Completed Tasks interleaved pseudo-chronologically */}
                    {seccion === "resumen" && completedTasks.map((t) => (
                      <div key={`hist-t-${t.id}`} className="relative">
                        <div className="absolute -left-[27px] top-1 w-4 h-4 rounded-full bg-green-500 border-2 border-white shadow-sm flex items-center justify-center">
                          <CheckSquare className="w-2.5 h-2.5 text-white" />
                        </div>
                        <div className="bg-amber-50 border border-amber-100/60 p-3 rounded mr-2">
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-xs font-semibold text-gray-600 dark:text-slate-400">
                              Tarea completada
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-gray-400">
                                {t.dueDate}
                              </span>
                              <button
                                onClick={() => handleEditTaskClick(t)}
                                className="text-gray-400 hover:text-blue-600 transition-colors"
                                title="Editar tarea"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          <p 
                            onClick={() => handleEditTaskClick(t)}
                            className="text-sm text-gray-800 dark:text-slate-200 line-through opacity-70 cursor-pointer hover:opacity-100 hover:text-blue-600 transition-colors"
                            title="Editar tarea"
                          >
                            {t.title}
                          </p>
                        </div>
                      </div>
                    ))}

                    {(seccion === "resumen" || seccion === "notas") && notes.map((n) => (
                      <div key={`hist-n-${n.id}`} className="relative">
                        <div className="absolute -left-[27px] top-1 w-4 h-4 rounded-full bg-yellow-500 border-2 border-white shadow-sm flex items-center justify-center">
                          <FileText className="w-2.5 h-2.5 text-white" />
                        </div>
                        <div className="bg-white dark:bg-slate-800 border border-yellow-200 p-3 rounded mr-2 shadow-sm">
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-xs font-bold text-gray-800 dark:text-slate-200">
                              {n.sellerId === userData?.id
                                ? userData?.email
                                : n.createdByName || "Nota"}
                            </span>
                            <span className="text-[10px] text-gray-400">
                              {typeof n.createdAt === "string"
                                ? n.createdAt.split("T")[0]
                                : ""}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 dark:text-slate-300 whitespace-pre-wrap break-words [word-break:break-word]">
                            {n.content}
                          </p>
                        </div>
                      </div>
                    ))}

                    {(seccion === "resumen" || seccion === "archivos") && files.map((f) => (
                      <div key={`hist-f-${f.id}`} className="relative">
                        <div className="absolute -left-[27px] top-1 w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow-sm flex items-center justify-center">
                          <Upload className="w-2 h-2 text-white" />
                        </div>
                        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 p-3 rounded mr-2 hover:border-blue-300 transition-colors">
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-xs font-semibold text-gray-600 dark:text-slate-400">
                              Archivo subido
                            </span>
                            <span className="text-[10px] text-gray-400">
                              {typeof f.uploadedAt === "string"
                                ? f.uploadedAt.split("T")[0]
                                : ""}
                            </span>
                          </div>
                          <a
                            href={f.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm font-medium text-blue-600 hover:underline flex items-center gap-1.5 mt-1"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            {f.filename}
                          </a>
                        </div>
                      </div>
                    ))}

                    {seccion === "resumen" && (
                    <div className="relative">
                      <div className="absolute -left-[27px] top-1 w-4 h-4 rounded-full bg-gray-300 border-2 border-white shadow-sm"></div>
                      <div className="text-sm text-gray-500 dark:text-slate-400 ml-1">
                        {/* Decia "Trato creado" siempre, hubiera trato o no:
                            es el pie fijo de la linea de tiempo, no un
                            registro de nada. Carlos lo mostraba teniendo cero
                            tratos. Ahora solo dice de donde llego. */}
                        Contacto registrado. Origen:{" "}
                        <span className="font-semibold">{formData.origin || "manual"}</span>
                      </div>
                    </div>
                    )}
                  </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-10 flex items-center justify-center">
                <div className="text-center max-w-sm">
                  <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <User className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-2">
                    Completa el formulario
                  </h3>
                  <p className="text-gray-500 dark:text-slate-400 text-sm">
                    Rellena los datos básicos en el panel izquierdo y guarda
                    para comenzar a registrar notas, documentos y actividades.
                  </p>
                </div>
              </div>
            )}
          </section>

          {/* DERECHA: los autos y sus tratos */}
          {!isNew && (
            <aside className="order-2 lg:order-3 flex flex-col gap-4 min-w-0">
              <ResumenCliente
                columna
                cliente={formData}
                tratos={deals}
                tareas={tasks}
                etapas={pipelineStages}
                usuarios={agencyUsers}
                inventario={inventoryVehicles}
                onAbrirAuto={(v) => setSelectedVehicleForModal(v)}
                onCotizar={(v) => setCotizandoAuto(v)}
              />
              {deals.length > 0 && (
                <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
                  <div className="flex items-center justify-between mb-2.5">
                    <h2 className="font-extrabold text-slate-900 dark:text-white">Tratos</h2>
                    <button type="button" onClick={() => irASeccion("tratos")} className="text-xs font-bold text-blue-700 dark:text-blue-300 hover:underline">Ver todos</button>
                  </div>
                  <ul className="flex flex-col gap-2">
                    {deals.slice(0, 4).map((d: any) => {
                      const ganadoT = checkIsWon(d.status, pipelineStages);
                      const perdidoT = checkIsLost(d.status, pipelineStages);
                      const etapaT = ganadoT ? "Ganado" : perdidoT ? "Perdido" : (pipelineStages.find((st) => st.id === d.status)?.title || "Abierto");
                      return (
                        <li key={`mini-${d.id}`} className={clsx(
                          "flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm",
                          ganadoT ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900/60"
                            : perdidoT ? "bg-slate-50 border-slate-200 dark:bg-slate-900/40 dark:border-slate-700"
                            : "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-900/60"
                        )}>
                          <span className={clsx("font-bold truncate", perdidoT ? "text-slate-500" : "text-slate-900 dark:text-slate-100")}>{d.title || "Trato"}</span>
                          <span className={clsx("text-xs font-bold shrink-0", ganadoT ? "text-emerald-800 dark:text-emerald-300" : perdidoT ? "text-slate-500" : "text-blue-800 dark:text-blue-300")}>{etapaT}</span>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}
            </aside>
          )}
          </div>
          </div>

          {/* En el teléfono: lo más usado, siempre a la mano. */}
          {!isNew && (
            <div className="lg:hidden shrink-0 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 px-3 py-2 grid grid-cols-4 gap-2" style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}>
              <button
                type="button"
                disabled={!telDigitos}
                onClick={() => setEscribiendoWhatsApp(true)}
                className="h-11 rounded-xl bg-[#1fa855] disabled:opacity-40 text-white text-xs font-bold flex flex-col items-center justify-center"
              >
                <MessageCircle className="w-4 h-4" /> WhatsApp
              </button>
              <a
                href={telDigitos ? `tel:${telDigitos}` : undefined}
                aria-disabled={!telDigitos}
                className={clsx("h-11 rounded-xl border border-slate-300 dark:border-slate-600 text-xs font-bold flex flex-col items-center justify-center", !telDigitos && "opacity-40 pointer-events-none")}
              >
                <Phone className="w-4 h-4" /> Llamar
              </a>
              <button
                type="button"
                onClick={irANota}
                className="h-11 rounded-xl border border-slate-300 dark:border-slate-600 text-xs font-bold flex flex-col items-center justify-center"
              >
                <FileText className="w-4 h-4" /> Nota
              </button>
              {canModify ? (
                <button
                  form="client-form"
                  type="submit"
                  className="h-11 rounded-xl bg-slate-900 dark:bg-white dark:text-slate-900 text-white text-xs font-bold"
                >
                  Guardar
                </button>
              ) : (
                <button type="button" onClick={cerrar} className="h-11 rounded-xl border border-slate-300 dark:border-slate-600 text-xs font-bold">Cerrar</button>
              )}
            </div>
          )}
          </>
        )}

        {/* SLIDE-OVER DRAWER FOR SALE & PAYMENT DETAILS */}
        <AnimatePresence>
          {showPaymentDrawer && (formData.saleDetails || formData.status === 'won') && (() => {
            const soldVehicle = inventoryVehicles.find(v => v.id === formData.vehicleId);
            const sDetails = formData.saleDetails || {
              price: formData.dealValue || soldVehicle?.price || 0,
              method: 'contado'
            };
            const actualPrice = sDetails.price || formData.dealValue || soldVehicle?.price || 0;
            const vehicleName = soldVehicle 
              ? `${soldVehicle.year} ${soldVehicle.make} ${soldVehicle.model}` 
              : (formData.vehicle && formData.vehicle !== "Otro pendiente" ? formData.vehicle : "Vehículo de la venta");

            const paymentsList = sDetails.payments || [];
            const totalPaid = paymentsList.reduce((acc: number, p: any) => acc + (p.amount || 0), 0);
            const remaining = Math.max(0, actualPrice - totalPaid);
            const pct = actualPrice > 0 ? Math.min(100, Math.round((totalPaid / actualPrice) * 100)) : 100;

            return (
              <>
                {/* Backdrop overlay inside modal */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowPaymentDrawer(false)}
                  className="absolute inset-0 bg-slate-900/30 backdrop-blur-[2px] z-30"
                />

                {/* Sliding Drawer Panel */}
                <motion.div
                  initial={{ x: "100%", opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: "100%", opacity: 0 }}
                  transition={{ type: "spring", damping: 26, stiffness: 240 }}
                  className="absolute inset-y-0 right-0 z-40 w-full md:w-[480px] lg:w-[540px] bg-white dark:bg-slate-900 shadow-2xl border-l border-emerald-200 dark:border-emerald-800/80 flex flex-col overflow-hidden"
                >
                  {/* DRAWER HEADER */}
                  <div className="p-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white flex flex-col gap-3 shadow-md shrink-0">
                    <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-2 rounded-xl bg-white/20 backdrop-blur-md shrink-0">
                        <Calculator className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold flex items-center gap-2 leading-tight flex-wrap">
                          <span>Detalles de Venta &amp; Pagos</span>
                          {remaining === 0 && actualPrice > 0 ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-400/30 text-white border border-white/30">
                              LIQUIDADO
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-400/30 text-white border border-white/30">
                              {pct}% PAGADO
                            </span>
                          )}
                        </h3>
                        {formData.soldAt && (
                          <p className="text-xs text-emerald-100 opacity-90 mt-0.5">
                            Fecha de venta: {new Date(formData.soldAt + "T00:00:00").toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}
                          </p>
                        )}
                      </div>
                    </div>
                      <button
                        type="button"
                        onClick={() => setShowPaymentDrawer(false)}
                        className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors shrink-0"
                        title="Minimizar panel y ver perfil"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      {puedeEliminarTratos && (
                        <button
                          type="button"
                          onClick={async () => {
                            const idCliente = (client.originalClientId || client.id) as string;
                            const pagos = formData.saleDetails?.payments?.length || 0;
                            const aviso =
                              "Se va a descartar esta venta: el contacto deja de contar como " +
                              "vendido y desaparece del inventario de pagos." +
                              (pagos > 0
                                ? ` Se pierden ${pagos} pago${pagos === 1 ? '' : 's'} registrado${pagos === 1 ? '' : 's'}.`
                                : "") +
                              " El auto, si lo tiene asignado, vuelve a quedar disponible. ¿Continuar?";
                            if (!confirm(aviso)) return;
                            try {
                              const limpieza = {
                                saleDetails: null,
                                dealValue: null,
                                soldAt: null,
                                status: "new",
                                updatedAt: new Date().toISOString(),
                              };
                              // Solo se limpia el trato de esta venta. Antes se
                              // limpiaban todos los del contacto: en Autos Vrit
                              // descartar una venta duplicada borro tambien la
                              // buena, y el auto regreso a disponible.
                              const desdeUnTrato = Boolean(client.originalClientId && client.originalClientId !== client.id);
                              const referencia = (client as any).ventaDealId || (formData as any).ventaDealId;
                              const tratosDeLaVenta = desdeUnTrato
                                ? [client.id as string]
                                : deals
                                    .filter((d: any) => !d.isDeleted && (d.id === referencia || tratoConVenta(d, pipelineStages)))
                                    .map((d) => d.id);
                              for (const id of tratosDeLaVenta) {
                                await guardarTratoSiExiste(id, limpieza);
                              }

                              await setDoc(doc(db, "clients", idCliente), { ...limpieza, ventaDealId: null }, { merge: true });

                              // El auto solo vuelve a disponible si esta venta es
                              // la que tiene registrada; si lo vendio otro trato,
                              // esa venta no se toca.
                              const idAuto = formData.vehicleId || client.vehicleId
                                || (deals.find((d: any) => tratosDeLaVenta.includes(d.id) && d.vehicleId) as any)?.vehicleId;
                              if (idAuto) {
                                const auto = await getDoc(doc(db, "vehicles", idAuto)).catch(() => null);
                                const datosAuto: any = auto?.exists() ? auto.data() : null;
                                const esEstaVenta = datosAuto && (
                                  tratosDeLaVenta.includes(datosAuto.soldDealId) ||
                                  (!datosAuto.soldDealId && esElCompradorDelVehiculo(datosAuto, idCliente))
                                );
                                if (esEstaVenta) {
                                  await updateDoc(doc(db, "vehicles", idAuto), {
                                    status: "available",
                                    saleDetails: null,
                                    soldAt: null,
                                    buyerId: null,
                                    soldToClientId: null,
                                    soldDealId: null,
                                    updatedAt: new Date().toISOString(),
                                  }).catch(() => {});
                                }
                              }
                              onClose();
                            } catch (e: any) {
                              alert("No se pudo descartar la venta: " + (e?.message || e));
                            }
                          }}
                          className="text-xs px-3 py-1.5 bg-white/15 text-white hover:bg-white/25 font-semibold rounded-lg transition-all flex items-center gap-1.5 border border-white/30 whitespace-nowrap"
                          title="Descartar esta venta"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Descartar venta</span>
                        </button>
                      )}
                      {canRegisterPayments && (
                        <button
                          type="button"
                          onClick={() => setShowPaymentModal(true)}
                          className="text-xs px-3 py-1.5 bg-white text-emerald-800 hover:bg-emerald-50 active:scale-95 font-bold rounded-lg shadow transition-all flex items-center gap-1.5 whitespace-nowrap ml-auto"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Registrar pago</span>
                        </button>
                      )}

                    </div>
                  </div>

                  {/* DRAWER CONTENT */}
                  <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    {/* VEHICLE CARD - CLICKABLE TO OPEN FULL VEHICLE PAGE */}
                    <div 
                      onClick={() => {
                        const vToOpen = soldVehicle || (formData.vehicleId ? { id: formData.vehicleId, make: formData.vehicle || 'Vehículo', model: '', price: actualPrice } : null);
                        if (vToOpen) setSelectedVehicleForModal(vToOpen as Vehicle);
                      }}
                      className="p-3 bg-emerald-50/70 dark:bg-slate-800/80 rounded-xl border border-emerald-200/80 dark:border-emerald-800/60 flex items-center gap-3 cursor-pointer hover:bg-emerald-100/80 dark:hover:bg-slate-700 hover:border-emerald-300 dark:hover:border-emerald-700 shadow-xs hover:shadow transition-all group"
                      title="Haz clic para ver la página / ficha completa del vehículo"
                    >
                      {(soldVehicle?.photoUrls?.[0] || soldVehicle?.photoUrl || (soldVehicle as any)?.images?.[0]) ? (
                        <img 
                          src={soldVehicle?.photoUrls?.[0] || soldVehicle?.photoUrl || (soldVehicle as any)?.images?.[0]} 
                          alt={vehicleName} 
                          className="w-16 h-12 object-cover rounded-lg border border-gray-200 dark:border-slate-700 shrink-0 group-hover:scale-105 transition-transform" 
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-700 dark:text-emerald-300 font-bold shrink-0 group-hover:bg-emerald-200 transition-colors">
                          <Car className="w-6 h-6" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">
                            Vehículo Vendido
                          </p>
                          <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-bold group-hover:underline flex items-center gap-0.5">
                            <span>Ver Ficha Auto</span>
                            <ChevronRight className="w-3 h-3" />
                          </span>
                        </div>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate group-hover:text-emerald-800 dark:group-hover:text-emerald-200">
                          {vehicleName}
                        </p>
                        {soldVehicle?.vin && (
                          <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
                            VIN: {soldVehicle.vin}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* PAYMENT METHOD & PRICING */}
                    <div className="grid grid-cols-2 gap-3 text-sm bg-slate-50 dark:bg-slate-800/80 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700">
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Método de Pago</p>
                        <p className="font-semibold text-slate-800 dark:text-slate-200 capitalize flex items-center gap-1.5 mt-0.5">
                          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
                          {sDetails.method === 'contado' ? 'Contado' : sDetails.method === 'credito_bancario' ? 'Crédito Bancario' : 'Crédito Propio'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Precio Final Acordado</p>
                        {canModify ? (
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-emerald-700 dark:text-emerald-400 font-bold text-sm">$</span>
                            <input
                              type="number"
                              value={sDetails.price !== undefined && sDetails.price !== null ? sDetails.price : ''}
                              onChange={(e) => {
                                const newP = e.target.value === '' ? 0 : Number(e.target.value);
                                setFormData(prev => ({
                                  ...prev,
                                  dealValue: newP,
                                  saleDetails: {
                                    ...(prev.saleDetails || { method: 'contado' }),
                                    price: newP
                                  }
                                }));
                              }}
                              placeholder="0"
                              className="w-32 px-2 py-0.5 font-bold text-sm text-emerald-700 dark:text-emerald-400 bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
                            />
                          </div>
                        ) : (
                          <p className="font-bold text-base text-emerald-700 dark:text-emerald-400 mt-0.5">
                            {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(actualPrice)}
                          </p>
                        )}
                      </div>

                      {sDetails.method === 'credito' && (
                        <>
                          <div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Enganche</p>
                            <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                              {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(sDetails.downPayment || 0)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Plazo / Tasa</p>
                            <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                              {sDetails.termMonths} meses @ {sDetails.interestRate}% ({sDetails.interestType})
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total con Financiamiento</p>
                            <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                              {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(sDetails.calculatedTotalAmount || actualPrice)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium font-bold text-emerald-700 dark:text-emerald-400">Pago Mensual</p>
                            <p className="font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">
                              {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(sDetails.calculatedMonthlyPayment || 0)}
                            </p>
                          </div>
                        </>
                      )}
                    </div>

                    {/* PAYMENT PROGRESS BAR */}
                    <div className="bg-slate-50 dark:bg-slate-800/80 rounded-xl p-3.5 border border-slate-200 dark:border-slate-700">
                      <div className="flex justify-between items-center text-xs font-semibold mb-1.5 text-slate-700 dark:text-slate-300">
                        <span>Progreso de Pagos</span>
                        <span>{pct}% ({new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(totalPaid)} de {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(actualPrice)})</span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-300 ${remaining === 0 ? 'bg-emerald-500' : 'bg-amber-500'}`} 
                          style={{ width: `${pct}%` }} 
                        />
                      </div>
                    </div>

                    {/* PAYMENTS HISTORY */}
                    <div className="bg-slate-50 dark:bg-slate-800/80 rounded-xl p-3.5 border border-slate-200 dark:border-slate-700">
                      <div className="flex justify-between items-center mb-2.5 pb-1 border-b border-gray-200 dark:border-slate-700">
                        <h5 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          Historial de Exhibiciones / Pagos
                        </h5>
                        <span className="text-[10px] font-semibold text-slate-400 bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                          {paymentsList.length} exhibición(es)
                        </span>
                      </div>

                      {paymentsList.length > 0 ? (
                        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                          {paymentsList.map((payment: any, idx: number) => (
                            <div key={`payment-${payment.id || idx}`} className="flex justify-between items-center text-xs p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800 hover:border-emerald-200 dark:hover:border-emerald-800 transition-colors">
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                                    {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(payment.amount)}
                                  </span>
                                  <span className="text-[10px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded font-medium capitalize">
                                    {payment.method || 'Efectivo'}
                                  </span>
                                </div>
                                <span className="text-slate-500 dark:text-slate-400 text-[11px] block mt-0.5">
                                  {payment.date ? new Date(payment.date + "T00:00:00").toLocaleDateString('es-MX', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Sin fecha'}
                                </span>
                                {payment.notes && (
                                  <span className="block text-[11px] text-slate-500 dark:text-slate-400 italic mt-0.5">
                                    "{payment.notes}"
                                  </span>
                                )}
                              </div>
                              {canRegisterPayments && payment.id && (
                                <button
                                  type="button"
                                  onClick={() => handleDeletePayment(payment.id)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                  title="Eliminar pago"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          ))}

                          <div className="flex justify-between items-center text-xs font-bold pt-2 border-t border-gray-200 dark:border-slate-700">
                            <span className="text-slate-600 dark:text-slate-400">Saldo Restante por Cobrar</span>
                            <span className={remaining > 0 ? "text-rose-500 font-extrabold text-sm" : "text-emerald-600 font-extrabold text-sm"}>
                              {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(remaining)}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500 dark:text-slate-400 text-center py-3 italic flex flex-col items-center gap-1.5">
                          <span>No se han registrado pagos / exhibiciones aún.</span>
                          {canRegisterPayments && (
                            <button
                              type="button"
                              onClick={() => setShowPaymentModal(true)}
                              className="text-emerald-600 font-semibold hover:underline text-xs"
                            >
                              + Registrar la primera exhibición
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* DRAWER FOOTER */}
                  <div className="p-3 bg-slate-100 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center text-xs shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowPaymentDrawer(false)}
                      className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 font-semibold text-slate-700 dark:text-slate-200 rounded-lg transition-colors flex items-center gap-1.5"
                    >
                      <X className="w-4 h-4" /> Ocultar panel y ver perfil completo
                    </button>

                    <span className="text-slate-400 text-[11px] font-medium">
                      Control de Pagos
                    </span>
                  </div>
                </motion.div>
              </>
            );
          })()}
        </AnimatePresence>
      </div>
            {/* New Activity Modal */}
      {showNewTaskModal && (
        <NewActivityModal
          onClose={() => {
            setShowNewTaskModal(false);
            setNewTaskPrefill(null);
          }}
          clients={[{ id: client.id, ...formData } as any]}
          deals={deals}
          currentUser={userData}
          initialData={newTaskPrefill}
          onSave={async (taskData) => {
            if (!taskData.title || !taskData.dueDate || !userData) {
              if (!taskData.title) alert("El título es requerido");
              return;
            }
            try {
              const actualClientId = client.originalClientId || client.id;
              const isDeal = Boolean(client.originalClientId && client.originalClientId !== client.id);
              const actualDealId = isDeal ? (client.id as string) : null;

              const targetClientId = (taskData.clientId && taskData.clientId !== client.id) ? taskData.clientId : actualClientId;
              const targetDealId = taskData.dealId || actualDealId || "";

              const { doc, collection, setDoc, query, where, getDocs } = await import("firebase/firestore");
              const newRef = doc(collection(db, "tasks"));
              const tempTask = {
                agencyId: userData.agencyId || "",
                sellerId: userData.id || "",
                clientId: targetClientId,
                dealId: targetDealId,
                title: taskData.title,
                type: taskData.type || "call",
                notes: taskData.notes || "",
                dueDate: taskData.dueDate,
                startTime: taskData.startTime,
                endTime: taskData.endTime,
                completed: taskData.completed || false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
              
              // Remove undefined fields
              Object.keys(tempTask).forEach(
                (k) =>
                  tempTask[k as keyof typeof tempTask] === undefined &&
                  delete tempTask[k as keyof typeof tempTask],
              );
              
              await setDoc(newRef, tempTask);

              if (taskData.notes && taskData.notes.trim()) {
                const noteRef = doc(collection(db, "notes"));
                const noteData: Record<string, any> = {
                  agencyId: userData.agencyId || "",
                  sellerId: userData.id || "",
                  clientId: targetClientId,
                  content: taskData.notes.trim(),
                  createdAt: new Date().toISOString(),
                };
                if (targetDealId) {
                  noteData.dealId = targetDealId;
                }
                Object.keys(noteData).forEach(
                  (k) => noteData[k] === undefined && delete noteData[k]
                );
                await setDoc(noteRef, noteData);
              }

              setShowNewTaskModal(false);
              setNewTaskPrefill(null);

              // Reload tasks and notes
              const idsToQuery = Array.from(new Set([targetClientId, client.id].filter(Boolean) as string[]));
              const tasksMap = new Map<string, Task>();
              for (const cId of idsToQuery) {
                let q = (userData?.role !== "master" && userData?.agencyId)
                  ? query(collection(db, "tasks"), where("clientId", "==", cId), where("agencyId", "==", userData.agencyId))
                  : query(collection(db, "tasks"), where("clientId", "==", cId));
                const s = await getDocs(q);
                s.docs.forEach((d) => tasksMap.set(d.id, { ...d.data(), id: d.id } as Task));
              }
              const t = Array.from(tasksMap.values());
              t.sort((a, b) => new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime());
              setTasks(t);

              const notesMap = new Map<string, any>();
              for (const cId of idsToQuery) {
                const q = (userData?.role !== "master" && userData?.agencyId)
                  ? query(collection(db, "notes"), where("clientId", "==", cId), where("agencyId", "==", userData.agencyId))
                  : query(collection(db, "notes"), where("clientId", "==", cId));
                const s = await getDocs(q);
                s.docs.forEach((d) => notesMap.set(d.id, { ...d.data(), id: d.id }));
              }
              const n = Array.from(notesMap.values());
              n.sort((a, b) => new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime());
              setNotes(n);
            } catch (err) {
              console.error("Error creating task:", err);
            }
          }}
        />
      )}

      {cotizandoAuto !== false && (
        <Cotizador
          auto={cotizandoAuto}
          autos={inventoryVehicles.filter((v) => v.status !== 'sold' && Number(v.price) > 0)}
          cliente={{ id: (client.originalClientId || client.id) as string, name: formData.name, phone: formData.phone }}
          dealId={client.originalClientId && client.originalClientId !== client.id ? (client.id as string) : undefined}
          agencia={agencyData}
          asesor={{ name: userData?.name, phone: (userData as any)?.phone, email: userData?.email }}
          userData={userData}
          onCerrar={() => setCotizandoAuto(false)}
        />
      )}

      {showDealWonModal && (
        <DealWonModal
          client={{ ...client, dealValue: formData.dealValue, vehicleId: formData.vehicleId } as Client}
          vehicle={inventoryVehicles.find(v => v.id === formData.vehicleId)}
          inicial={formData.saleDetails || null}
          onConfirm={handleDealWonConfirm}
          onCancel={() => setShowDealWonModal(false)}
        />
      )}

      {showPaymentModal && (
        <PaymentModal
          onConfirm={handlePaymentConfirm}
          onCancel={() => setShowPaymentModal(false)}
          saleDetails={formData.saleDetails}
          pendingTasks={tasks}
          isWon={checkIsWon(formData.status, pipelineStages)}
          clientName={formData.name}
          maxAmount={(() => {
            const soldV = inventoryVehicles.find(v => v.id === formData.vehicleId);
            const actualPrice = formData.saleDetails?.price || formData.dealValue || soldV?.price || 0;
            const payments = formData.saleDetails?.payments || [];
            const paid = payments.reduce((acc: number, p: any) => acc + (p.amount || 0), 0);
            return Math.max(0, actualPrice - paid);
          })()}
        />
      )}

      {showLostReasonModal && (
        <LostReasonModal
          isOpen={showLostReasonModal}
          onClose={() => setShowLostReasonModal(false)}
          onConfirm={handleLostConfirm}
        />
      )}

      {selectedVehicleForModal && (
        <VehicleDetailModal
          vehicle={selectedVehicleForModal}
          onClose={() => setSelectedVehicleForModal(null)}
          clientContext={formData as Client}
        />
      )}

      {escribiendoWhatsApp && client.id && (
        <EscribirAlCliente
          clientId={client.id}
          nombre={formData.name || client.name || ""}
          telefono={formData.phone || client.phone || ""}
          ultimoMensajeEntrante={(client as any).lastWhatsappInboundAt}
          onCerrar={() => setEscribiendoWhatsApp(false)}
        />
      )}
    </motion.div>
      )}
    </AnimatePresence>
  );
}
