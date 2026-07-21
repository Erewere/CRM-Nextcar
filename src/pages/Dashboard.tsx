import { checkIsWon, checkIsLost } from "../lib/clientUtils";
import { useEffect, useState, useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { Client, Vehicle, Task, User } from "../types";
import { AiAdvisorPanel } from "../components/AiAdvisorPanel";
import { ClientDetailModal } from "../components/ClientDetailModal";
import { VehicleDetailModal } from "../components/VehicleDetailModal";
import { AgencyRevenueModal } from "../components/AgencyRevenueModal";
import { useSharedInventoryMatches } from "../hooks/useSharedInventoryMatches";
import { MobileHome } from "./mobile/MobileHome";
import { MobileClientDetail } from "./mobile/MobileClientDetail";
import { useIsMobile } from "../hooks/useIsMobile";
import { deduplicateClients } from "../lib/clientUtils";
import { BadgeCheck, ExternalLink } from "lucide-react";
import { useReadOnly } from "../hooks/useReadOnly";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
  PieChart,
  Pie,
  Legend,
  FunnelChart,
  Funnel,
  LabelList,
} from "recharts";
import {
  Users,
  Car,
  Target,
  CheckCircle,
  TrendingUp,
  Calendar,
  Clock,
  AlertCircle, AlertTriangle,
  Filter,
  Briefcase,
  Check,
  DollarSign,
  Award,
  Flame,
  Sparkles,
  ShieldAlert,
  UserCheck,
  BarChart2,
  ArrowUpRight,
  Activity,
} from "lucide-react";
import {
  isToday,
  isThisWeek,
  parseISO,
  isAfter,
  startOfDay,
  isValid,
} from "date-fns";

import { MasterDashboard } from "../components/MasterDashboard";
import { LeadScoringEngine } from "../modules/lead-intelligence/services/scoringEngine";

import { Link } from "react-router";
import { getClientMatches } from '../services/matchingEngine';



const getWantedTitle = (c: Client) => {
  if (c.wantedVehicle && (c.wantedVehicle.make || c.wantedVehicle.model || (c.wantedVehicle.bodyType && c.wantedVehicle.bodyType !== 'Cualquiera'))) {
    return [c.wantedVehicle.make, c.wantedVehicle.model, c.wantedVehicle.bodyType !== 'Cualquiera' ? c.wantedVehicle.bodyType : ''].filter(Boolean).join(" ");
  }
  return c.vehicle || c.dealTitle || "Auto no especificado";
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-slate-800 p-3 rounded shadow-sm border border-gray-200 dark:border-slate-700">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">{label}</p>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: payload[0].payload.color || payload[0].color || "#3b82f6" }}></div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            <span className="font-medium text-slate-900 dark:text-white">{payload[0].value}</span> Oportunidades
          </p>
        </div>
      </div>
    );
  }
  return null;
};

export function Dashboard() {
  const { userData } = useAuth();
  const isReadOnly = useReadOnly();
  const isMobile = useIsMobile();
  const [clients, setClients] = useState<Client[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterSeller, setFilterSeller] = useState<string>(() => {
    return localStorage.getItem("dashboard_filterSeller") || "all";
  });
  const [filterStartDate, setFilterStartDate] = useState<string>(() => localStorage.getItem("dashboard_filterStartDate") || "");
  const [filterEndDate, setFilterEndDate] = useState<string>(() => localStorage.getItem("dashboard_filterEndDate") || "");
  const [filterCategory, setFilterCategory] = useState<string>(() => localStorage.getItem("dashboard_filterCategory") || "all");

  // For interactive stage selection
  const [selectedStage, setSelectedStage] = useState<string | null>(null);

  const [activeDateFilter, setActiveDateFilter] = useState<string>(() => localStorage.getItem("dashboard_activeDateFilter") || "");
  
  const [filterTags, setFilterTags] = useState<string[]>(() => {
    const saved = localStorage.getItem("dashboard_filterTags");
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem("dashboard_filterSeller", filterSeller);
    localStorage.setItem("dashboard_filterStartDate", filterStartDate);
    localStorage.setItem("dashboard_filterEndDate", filterEndDate);
    localStorage.setItem("dashboard_filterCategory", filterCategory);
    localStorage.setItem("dashboard_activeDateFilter", activeDateFilter);
    localStorage.setItem("dashboard_filterTags", JSON.stringify(filterTags));
  }, [filterSeller, filterStartDate, filterEndDate, filterCategory, activeDateFilter, filterTags]);

  const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [agencyTags, setAgencyTags] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [pipelineStages, setPipelineStages] = useState<
    { id: string; title: string }[]
  >([]);
  const [inactivityAlertDays, setInactivityAlertDays] = useState(14);
  const [agencyName, setAgencyName] = useState<string>("");
  const [isRevenueModalOpen, setIsRevenueModalOpen] = useState(false);

  useEffect(() => {
    if (userData?.agencyId) {
      import("firebase/firestore").then(({ doc, getDoc }) => {
        getDoc(doc(db, "agencies", userData.agencyId as string))
          .then((docSnap) => {
            if (docSnap.exists()) {
              const data = docSnap.data();
              setAgencyName(data.name || "");
              if (
                data.pipelineStages &&
                Array.isArray(data.pipelineStages) &&
                data.pipelineStages.length > 0
              ) {
                setPipelineStages(data.pipelineStages);
              }
              if (data.inactivityAlertDays) {
                setInactivityAlertDays(data.inactivityAlertDays);
              }
            }
          })
          .catch(console.error);
      });
    }
  }, [userData?.agencyId]);

  useEffect(() => {
    if (
      !userData ||
      userData.role === "master" ||
      userData.role === "unassigned"
    ) {
      setLoading(false);
      return;
    }

    const fetchStats = async () => {
      try {
        const agencyQuery = where("agencyId", "==", userData.agencyId);

        let clientsQ = query(collection(db, "clients"), agencyQuery);
        let dealsQ = query(collection(db, "deals"), agencyQuery);
        let tasksQ = query(collection(db, "tasks"), agencyQuery);
        let vehiclesQ = query(collection(db, "vehicles"), agencyQuery);
        let usersQ = query(collection(db, "users"), agencyQuery);
        let tagsQ = query(collection(db, "agency_tags"), agencyQuery);

        if (userData.role === "seller" || (isMobile && userData.role === "admin" && userData.adminMobileViewAllContacts === false)) {
          clientsQ = query(
            collection(db, "clients"),
            agencyQuery,
            where("sellerId", "==", userData.id),
          );
          tasksQ = query(
            collection(db, "tasks"),
            agencyQuery,
            where("sellerId", "==", userData.id),
          );
          dealsQ = query(
            collection(db, "deals"),
            agencyQuery,
            where("sellerId", "==", userData.id),
          );
        }

        const [clientsSnap, dealsSnap, vehiclesSnap, tasksSnap, usersSnap, tagsSnap, notesSnap] =
          await Promise.all([
            getDocs(clientsQ),
            getDocs(dealsQ),
            getDocs(vehiclesQ),
            getDocs(tasksQ),
            getDocs(usersQ),
            getDocs(tagsQ),
            getDocs(query(collection(db, "notes"), agencyQuery)).catch(() => ({ docs: [] } as any)),
          ]);
        
        setDeals(
          dealsSnap.docs
            .map((doc) => ({ ...doc.data(), id: doc.id }) as any)
            .filter((d: any) => !d.isDeleted)
        );

        const rawClients = clientsSnap.docs
          .map((doc) => ({ ...doc.data(), id: doc.id }) as Client)
          .filter((c) => !c.isDeleted);
        
        setClients(deduplicateClients(rawClients));
        setVehicles(
          vehiclesSnap.docs.map(
            (doc) => ({ ...doc.data(), id: doc.id }) as Vehicle,
          ),
        );
        setTasks(
          tasksSnap.docs.map((doc) => ({ ...doc.data(), id: doc.id }) as Task),
        );
        setUsers(
          usersSnap.docs.map((doc) => ({ ...doc.data(), id: doc.id }) as User),
        );
        setNotes(
          notesSnap.docs.map((doc) => ({ ...doc.data(), id: doc.id }) as any)
        );
        setAgencyTags(
          tagsSnap.docs.map((doc) => ({ id: doc.id, name: doc.data().name })),
        );
      } catch (e) {
        console.error("Error fetching dashboard data", e);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [userData, refreshKey]);

  const allSellersAndAdmins = useMemo(() => {
    const list = [...users];
    if (userData && !list.some((u) => u.id === userData.id)) {
      list.push(userData as User);
    }
    return list.filter((u) => u.role === "seller" || u.role === "admin");
  }, [users, userData]);

  // --- Process Data With Filters ---

  const isWon = (status: string = "") => checkIsWon(status, pipelineStages);
  const isLost = (status: string = "") => checkIsLost(status, pipelineStages);
  const isActive = (status: string) => !isWon(status) && !isLost(status);


  const displayClients = useMemo(() => {
    const dealClients = deals.map(deal => {
      const person = clients.find(c => c.id === deal.clientId) || {} as Client;
      return {
        ...person,
        id: deal.id,
        originalClientId: deal.clientId,
        dealTitle: deal.title,
        dealValue: deal.value,
        status: deal.status || deal.stageId || "open",
        sellerId: deal.sellerId || person.sellerId,
        vehicle: deal.vehicle || person.vehicle,
        vehicleId: deal.vehicleId || person.vehicleId,
        createdAt: deal.createdAt || person.createdAt,
        updatedAt: deal.updatedAt || person.updatedAt,
      } as Client;
    });

    const legacyClients = clients.filter(c => !deals.some(d => d.clientId === c.id)).map(c => ({
      ...c,
      originalClientId: c.id,
      dealTitle: c.name ? `Trato con ${c.name}` : "Trato",
    } as Client));

    const allClients = [...dealClients, ...legacyClients];
    return Array.from(new Map(allClients.map(c => [c.id, c])).values());
  }, [deals, clients]);
  
  const baseFilteredClients = useMemo(() => {
    return displayClients.filter((c) => {
      if (filterSeller !== "all" && c.sellerId !== filterSeller) return false;
      if (filterCategory !== "all") {
        const clientVehicle = vehicles.find((v) => v.id === c.vehicleId);
        if (clientVehicle?.bodyType !== filterCategory) return false;
      }
      if (filterTags.length > 0) {
        if (!c.tags || !filterTags.every((tag) => c.tags.includes(tag)))
          return false;
      }
      return true;
    });
  }, [clients, filterSeller, filterCategory, vehicles, filterTags]);

  const filteredClients = useMemo(() => {
    return baseFilteredClients.filter((c) => {
      const isWonClient = isWon(c.status);
      const clientDate = isWonClient && c.soldAt ? new Date(c.soldAt + "T00:00:00") : (c.createdAt?.toDate ? c.createdAt.toDate() : new Date(c.createdAt || Date.now()));
      if (filterStartDate) {
        const startDate = new Date(filterStartDate);
        if (isValid(startDate) && isValid(clientDate) && isAfter(startOfDay(startDate), clientDate)) return false;
      }
      if (filterEndDate) {
        const endDate = new Date(filterEndDate);
        if (isValid(endDate) && isValid(clientDate) && isAfter(clientDate, startOfDay(endDate))) return false;
      }
      return true;
    });
  }, [baseFilteredClients, filterStartDate, filterEndDate, pipelineStages]);

  const filteredVehicles = useMemo(() => {
    return vehicles.filter((v) => {
      if (filterCategory !== "all" && v.bodyType !== filterCategory)
        return false;
      return true;
    });
  }, [vehicles, filterCategory]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (filterSeller !== "all" && t.sellerId !== filterSeller) return false;
      return true;
    });
  }, [tasks, filterSeller]);

  const inactiveAlerts = useMemo(() => {
    const alerts: { task: Task, client: Client | null }[] = [];
    const nowMs = Date.now();
    const inactivityThresholdMs = inactivityAlertDays * 24 * 60 * 60 * 1000;
    tasks.forEach(task => {
      if (!task.completed && task.dueDate) {
        const taskDate = new Date(task.dueDate).getTime();
        if (nowMs - taskDate > inactivityThresholdMs) {
          alerts.push({
            task,
            client: clients.find(c => c.id === task.clientId) || null
          });
        }
      }
    });
    return alerts;
  }, [tasks, clients, inactivityAlertDays]);

  const activeContacts = useMemo(() => {
    return baseFilteredClients.filter((c) => isActive(c.status));
  }, [baseFilteredClients, pipelineStages]);

  const wonContacts = useMemo(() => {
    return filteredClients.filter((c) => isWon(c.status));
  }, [filteredClients, pipelineStages]);

  const clientsWithScores = useMemo(() => {
    return activeContacts.map(client => {
      const clientTasks = tasks.filter(t => t.clientId === client.id);
      const clientNotes = notes.filter(n => n.clientId === client.id);
      const scoreInfo = LeadScoringEngine.calculateScore(client, clientTasks, pipelineStages, clientNotes);
      return {
        ...client,
        leadScore: scoreInfo.score,
        probabilityCategory: scoreInfo.probabilityCategory,
        scoreDetails: scoreInfo
      };
    }).sort((a, b) => b.leadScore - a.leadScore);
  }, [activeContacts, tasks, pipelineStages, notes]);

  const sellerPerformance = useMemo(() => {
    if (userData?.role !== "admin") return [];
    
    return allSellersAndAdmins.map(seller => {
      const sellerClients = displayClients.filter(c => c.sellerId === seller.id);
      const sellerWon = sellerClients.filter(c => isWon(c.status));
      const sellerActive = sellerClients.filter(c => isActive(c.status));
      const sellerRevenue = sellerWon.reduce((sum, contact) => {
        const vehicle = vehicles.find((v) => v.id === contact.vehicleId);
        return sum + (contact.saleDetails?.price || vehicle?.price || 0);
      }, 0);
      const sellerProfit = sellerWon.reduce((sum, contact) => {
        const vehicle = vehicles.find((v) => v.id === contact.vehicleId);
        const salePrice = contact.saleDetails?.price || vehicle?.price || 0;
        const purchaseCost = vehicle?.purchasePrice || 0;
        const profit = salePrice - purchaseCost;
        return sum + (profit > 0 ? profit : 0);
      }, 0);

      return {
        id: seller.id,
        name: seller.name || seller.email || "Sin Nombre",
        photoURL: seller.photoURL,
        totalClients: sellerClients.length,
        activeClients: sellerActive.length,
        wonClients: sellerWon.length,
        revenue: sellerRevenue,
        profit: sellerProfit,
        conversionRate: sellerClients.length > 0 ? Math.round((sellerWon.length / sellerClients.length) * 100) : 0
      };
    }).sort((a, b) => b.revenue - a.revenue);
  }, [allSellersAndAdmins, displayClients, vehicles, pipelineStages]);

  const conversionRate = useMemo(() => {
    if (filteredClients.length === 0) return 0;
    return Math.round((wonContacts.length / filteredClients.length) * 100);
  }, [wonContacts.length, filteredClients.length]);

  if (loading) return <div>Cargando dashboard...</div>;

  if (userData?.role === "master") {
    return <MasterDashboard />;
  }

  if (userData?.role === "unassigned") {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-slate-800 rounded shadow-sm border border-gray-200 dark:border-slate-700 text-center h-[60vh]">
        <Users className="w-16 h-16 text-slate-300 mb-4" />
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">
          Cuenta en Revisión
        </h2>
        <p className="text-slate-500 dark:text-slate-400 max-w-sm">
          Tu cuenta ha sido creada exitosamente y se encuentra a la espera de
          que el administrador principal o la cuenta maestra asigne tu rol y
          agencia.
        </p>
      </div>
    );
  }

  // Contacts

  const totalWonAmount = wonContacts.reduce((sum, contact) => {
    return sum + (contact.saleDetails?.price || vehicles.find((v) => v.id === contact.vehicleId)?.price || 0);
  }, 0);

  const totalProfit = wonContacts.reduce((sum, contact) => {
    const vehicle = vehicles.find((v) => v.id === contact.vehicleId);
    return sum + ((vehicle?.price || 0) - (vehicle?.purchasePrice || 0));
  }, 0);

  
  // Inventory
  const availableVehicles = filteredVehicles.filter(
    (v) => v.status === "available" || !v.status,
  );

  const missingChecklistVehicles = vehicles.filter(v => v.checklist?.remindMissing && (
      !v.checklist.originalInvoice ||
      !v.checklist.taxes ||
      !v.checklist.deregistration ||
      !v.checklist.ineOrId ||
      !v.checklist.duplicateKeys ||
      !v.checklist.jack ||
      !v.checklist.securityLugNut ||
      !v.checklist.manuals ||
      !v.checklist.servicePolicy ||
      !v.checklist.smogCheck ||
      !v.checklist.tools
  )).map(v => {
      const missing = [];
      if (!v.checklist.originalInvoice) missing.push('Factura Original');
      if (!v.checklist.taxes) missing.push('Tenencias');
      if (!v.checklist.deregistration) missing.push('Baja');
      if (!v.checklist.ineOrId) missing.push('INE/ID');
      if (!v.checklist.duplicateKeys) missing.push('Llavero');
      if (!v.checklist.jack) missing.push('Gato');
      if (!v.checklist.securityLugNut) missing.push('Birlos');
      if (!v.checklist.manuals) missing.push('Manuales');
      if (!v.checklist.servicePolicy) missing.push('Póliza');
      if (!v.checklist.smogCheck) missing.push('Verificación');
      if (!v.checklist.tools) missing.push('Herramienta');
      return { ...v, missingItems: missing };
  });

  // Match Calculation
  let allClientMatches = 0;
  const uniqueActiveContacts = Array.from(new Map(activeContacts.map(c => [c.originalClientId || c.id, c])).values()) as Client[];

  uniqueActiveContacts.forEach((client) => {
    const matches = getClientMatches(client, availableVehicles);
    const validMatches = matches.filter(m => !client.dismissedMatches?.includes(`${m.vehicle.id}_${m.vehicle.price || 0}`));
    allClientMatches += validMatches.length;
  });

  const buscanAutoClients = uniqueActiveContacts.filter(c => 
    c.tags && c.tags.some(t => t.toLowerCase().includes('busca de auto') || t.toLowerCase().includes('busca auto') || t.toLowerCase() === 'compra')
  );
  const buscanAutoCount = buscanAutoClients.length;



  // Pipeline Stats
  const statusCounts = activeContacts.reduce(
    (acc, c) => {
      acc[c.status] = (acc[c.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const pipelineData = Object.keys(statusCounts)
    .map((status) => {
      const stage = pipelineStages.find((s) => s.id === status);
      return {
        id: status,
        name: stage
          ? stage.title
          : status === "open"
            ? "Abierto"
            : status === "won"
              ? "Ganado"
              : status === "lost"
                ? "Perdido"
                : status || "Nuevo",
        value: statusCounts[status],
      };
    })
    .sort((a, b) => {
      const indexA = pipelineStages.findIndex((s) => s.id === a.id);
      const indexB = pipelineStages.findIndex((s) => s.id === b.id);
      return (indexA === -1 ? 99 : indexA) - (indexB === -1 ? 99 : indexB);
    });

  // Tasks Insights
  const todayTasks = filteredTasks.filter((t) => {
    if (t.completed || !t.dueDate) return false;
    const d = parseISO(t.dueDate);
    return isValid(d) && isToday(d);
  });
  const thisWeekTasks = filteredTasks.filter((t) => {
    if (t.completed || !t.dueDate) return false;
    const d = parseISO(t.dueDate);
    return isValid(d) && isThisWeek(d);
  });
  const overdueTasks = filteredTasks.filter((t) => {
    if (t.completed || !t.dueDate) return false;
    const d = parseISO(t.dueDate);
    return isValid(d) && isAfter(startOfDay(new Date()), d) && !isToday(d);
  });

  // "Hot" leads (Probability of sale in week/month)
  // Let's assume contacts in advanced stages (e.g. 'propuesta', 'demostracion') or with tasks this week are higher probability.
  const hotLeads = activeContacts.filter((c) => {
    const hasActiveTask = thisWeekTasks.some((t) => t.clientId === c.id);
    const st = String(c.status || "").toLowerCase();
    const inAdvancedStage = c.status
      ? st.includes("propuest") ||
        st.includes("demostra") ||
        st.includes("negocia")
      : false;
    return hasActiveTask || inAdvancedStage;
  });

  const COLORS = [
    "#3b82f6",
    "#10b981",
    "#f59e0b",
    "#8b5cf6",
    "#ec4899",
    "#64748b",
  ];


  const funnelData = [
    { name: 'Prospectos', value: filteredClients.length },
    { name: 'Activos', value: activeContacts.length },
    { name: 'En Cierre', value: activeContacts.filter((c) => {
      const st = String(c.status || "").toLowerCase();
      return st.includes("propuesta") || st.includes("demostracion") || st.includes("negociacion");
    }).length },
    { name: 'Ventas Cerradas', value: wonContacts.length },
  ];


  if (isMobile) {
    return (
      <div className={isReadOnly ? "pointer-events-none opacity-80 select-none relative" : ""}>
        {isReadOnly && <div className="absolute inset-0 z-50 pointer-events-auto cursor-not-allowed bg-transparent" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }} />}
        <MobileHome 
          userName={userData?.name || userData?.email || "Asesor"}
          agencyId={userData?.agencyId || ""}
          agencyName={agencyName}
          clients={clients}
          activeContacts={uniqueActiveContacts}
          buscanAutoClients={buscanAutoClients}
          tasks={tasks}
          pipelineStages={pipelineStages}
          onSelectClient={setSelectedClient}
          userRole={userData?.role}
          clientsWithScores={clientsWithScores}
          sellerPerformance={sellerPerformance}
          conversionRate={conversionRate}
          totalWonAmount={totalWonAmount}
          totalProfit={totalProfit}
          inactiveAlerts={inactiveAlerts}
          allClientMatches={allClientMatches}
          vehicles={vehicles}
        />
        {selectedClient && (
          <div className="fixed inset-0 z-[100] bg-slate-900">
             <MobileClientDetail
                client={selectedClient}
                onClose={() => setSelectedClient(null)}
                onUpdated={() => setRefreshKey((prev) => prev + 1)}
             />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={isReadOnly ? "pointer-events-none opacity-80 select-none relative" : ""}>
      {isReadOnly && <div className="absolute inset-0 z-50 pointer-events-auto cursor-not-allowed bg-transparent" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }} />}
      <div className="space-y-4 pb-8">
        {/* AI Advisor Panel */}
        <AiAdvisorPanel 
          userName={userData?.name || userData?.email || "Asesor"}
          agencyId={userData?.agencyId || ''}
          activeContacts={activeContacts}
          tasks={tasks}
          pipelineStages={pipelineStages}
        />

      {isMobile ? (
        <div className="flex border-b border-gray-200 dark:border-slate-700 mb-6 mt-4">
          <button
            onClick={() => {
              const today = new Date().toISOString().split("T")[0];
              setFilterStartDate(today);
              setFilterEndDate(today);
              setActiveDateFilter("today");
            }}
            className={`py-2 px-4 border-b-2 font-medium text-sm transition-colors ${
              activeDateFilter === "today"
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            Hoy
          </button>
          <button
            onClick={() => {
              const date = new Date();
              date.setDate(date.getDate() - date.getDay() + 1); // Monday
              const start = date.toISOString().split("T")[0];
              const end = new Date().toISOString().split("T")[0];
              setFilterStartDate(start);
              setFilterEndDate(end);
              setActiveDateFilter("week");
            }}
            className={`py-2 px-4 border-b-2 font-medium text-sm transition-colors ${
              activeDateFilter === "week"
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            Esta Semana
          </button>
          <button
            onClick={() => {
              const date = new Date();
              const start = new Date(date.getFullYear(), date.getMonth(), 1)
                .toISOString()
                .split("T")[0];
              const end = new Date().toISOString().split("T")[0];
              setFilterStartDate(start);
              setFilterEndDate(end);
              setActiveDateFilter("month");
            }}
            className={`py-2 px-4 border-b-2 font-medium text-sm transition-colors ${
              activeDateFilter === "month"
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            Este Mes
          </button>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 w-full bg-white dark:bg-slate-800 p-3 rounded border border-gray-200 dark:border-slate-700 shadow-sm">
          <div className="flex flex-wrap gap-2 items-center w-full lg:w-auto">
            <div className="flex items-center gap-2 pr-3 border-r border-gray-200 dark:border-slate-700 hidden sm:flex">
              <Filter className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                Filtros
              </span>
            </div>
            <button
              onClick={() => {
                const today = new Date().toISOString().split("T")[0];
                setFilterStartDate(today);
                setFilterEndDate(today);
                setActiveDateFilter("today");
              }}
              className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
                activeDateFilter === "today"
                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm shadow-blue-500/20"
                  : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300"
              }`}
            >
              Hoy
            </button>
            <button
              onClick={() => {
                const date = new Date();
                date.setDate(date.getDate() - date.getDay() + 1); // Monday
                const start = date.toISOString().split("T")[0];
                const end = new Date().toISOString().split("T")[0];
                setFilterStartDate(start);
                setFilterEndDate(end);
                setActiveDateFilter("week");
              }}
              className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
                activeDateFilter === "week"
                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm shadow-blue-500/20"
                  : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300"
              }`}
            >
              Esta Semana
            </button>
            <button
              onClick={() => {
                const date = new Date();
                const start = new Date(date.getFullYear(), date.getMonth(), 1)
                  .toISOString()
                  .split("T")[0];
                const end = new Date().toISOString().split("T")[0];
                setFilterStartDate(start);
                setFilterEndDate(end);
                setActiveDateFilter("month");
              }}
              className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
                activeDateFilter === "month"
                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm shadow-blue-500/20"
                  : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300"
              }`}
            >
              Este Mes
            </button>
            <button
              onClick={() => {
                setFilterStartDate("");
                setFilterEndDate("");
                setActiveDateFilter("all");
              }}
              className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
                activeDateFilter === "all"
                  ? "bg-gradient-to-r from-slate-600 to-slate-700 text-white shadow-sm"
                  : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300"
              }`}
            >
              Todos
            </button>
          </div>
        </div>
      )}

      {isMobile ? (
        <>
          {/* Mobile Action Center */}
          <div className="bg-white dark:bg-slate-800 rounded border border-gray-200 dark:border-slate-700 shadow-sm flex flex-col overflow-hidden">
            <div className="p-3 border-b border-gray-200 dark:border-slate-700 bg-[#f4f5f5] dark:bg-slate-900">
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                Centro de Atención
              </h3>
            </div>
            <div className="p-4 grid grid-cols-2 gap-3">
              <Link to="/tasks" className="flex flex-col gap-1 justify-between p-3 rounded bg-rose-50 border border-rose-100 hover:bg-rose-100 transition-colors">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-500" />
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight">Atrasadas</p>
                </div>
                <span className="text-rose-600 font-black text-lg">{overdueTasks.length}</span>
              </Link>
              <Link to="/tasks" className="flex flex-col gap-1 justify-between p-3 rounded bg-blue-50 border border-blue-100 hover:bg-blue-100 transition-colors">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-500" />
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight">Para Hoy</p>
                </div>
                <span className="text-blue-600 font-black text-lg">{todayTasks.length}</span>
              </Link>
              <Link to="/tasks" className="flex flex-col gap-1 justify-between p-3 rounded bg-[#f4f5f5] dark:bg-slate-900 border border-gray-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight">Esta Sem.</p>
                </div>
                <span className="text-slate-600 dark:text-slate-400 font-black text-lg">{thisWeekTasks.length}</span>
              </Link>
              
              {buscanAutoCount > 0 && (
                <Link to="/persons" className="flex flex-col gap-1 justify-between p-3 rounded bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 transition-colors">
                  <div className="flex items-center gap-2">
                    <Car className="w-4 h-4 text-indigo-500" />
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight">Buscan Auto</p>
                  </div>
                  <span className="text-indigo-600 font-black text-lg">{buscanAutoCount}</span>
                </Link>
              )}
{allClientMatches > 0 && (
                <Link to="/persons" className="flex flex-col gap-1 justify-between p-3 rounded bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition-colors">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-emerald-500" />
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight">Matches</p>
                  </div>
                  <span className="text-emerald-600 font-black text-lg">{allClientMatches}</span>
                </Link>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <Link to="/persons" className="bg-white dark:bg-slate-800 p-4 rounded border border-gray-200 dark:border-slate-700 shadow-sm flex flex-col justify-center">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Total Prospectos</p>
              <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100">{filteredClients.length}</h2>
            </Link>
            <Link to="/kanban" className="bg-white dark:bg-slate-800 p-4 rounded border border-gray-200 dark:border-slate-700 shadow-sm flex flex-col justify-center">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Activos</p>
              <h2 className="text-2xl font-black text-blue-600 dark:text-blue-400">{activeContacts.length}</h2>
            </Link>
            <Link to="/closed-sales" className="bg-white dark:bg-slate-800 p-4 rounded border border-gray-200 dark:border-slate-700 shadow-sm flex flex-col justify-center">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Ventas Cerradas</p>
              <h2 className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{wonContacts.length}</h2>
            </Link>
            <Link to="/closed-sales" className="bg-white dark:bg-slate-800 p-4 rounded border border-gray-200 dark:border-slate-700 shadow-sm flex flex-col justify-center">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Ingresos</p>
              <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(totalWonAmount)}
              </h2>
            </Link>
          </div>
          
          {buscanAutoClients.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded border border-gray-200 dark:border-slate-700 shadow-sm p-4 mt-4">
              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                <Car className="w-4 h-4 text-indigo-500" />
                Vehículos Buscados
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {buscanAutoClients.slice(0, 6).map((client, idx) => (
                  <div key={`${client.id}-${idx}`} className="bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800 rounded p-3 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors cursor-pointer" onClick={() => setSelectedClient(client)}>
                    <p className="text-[11px] font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider truncate mb-1">
                      {getWantedTitle(client)}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-4 rounded-full bg-indigo-200 dark:bg-indigo-800 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-[9px] font-bold">
                        {client.name.substring(0,1).toUpperCase()}
                      </div>
                      <span className="text-xs text-slate-600 dark:text-slate-400 truncate font-medium">{client.name}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Desktop Layout */}
          {userData?.role === "admin" ? (
            /* ========================================================================= */
            /* 1. ADMINISTRATOR DESKTOP VIEW                                             */
            /* ========================================================================= */
            <div className="space-y-6">
              {/* Admin Headbanner */}
              <div className="bg-slate-900 text-white rounded p-6 border border-slate-800 shadow-xl relative overflow-hidden">
                <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10 bg-gradient-to-l from-indigo-500 to-transparent pointer-events-none" />
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <span className="text-xs font-black uppercase tracking-widest text-indigo-400 bg-indigo-950 border border-indigo-900/50 px-3 py-1 rounded-full">
                      Panel de Control General
                    </span>
                    <h1 className="text-2xl font-black tracking-tight text-white mt-3">
                      Consola de Administración: {agencyName || "LUHO Agency"}
                    </h1>
                    <p className="text-slate-400 text-xs mt-1">
                      Monitoreo en tiempo real de ingresos, rendimiento de asesores e inteligencia comercial.
                    </p>
                  </div>
                  <div className="bg-slate-800 border border-slate-700/50 rounded px-4 py-3 flex items-center gap-3">
                    <Activity className="w-5 h-5 text-indigo-400 animate-pulse" />
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Estado de Agencia</p>
                      <p className="text-sm font-extrabold text-slate-200">Operación Activa</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Admin KPIs */}
              {missingChecklistVehicles.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/10 border-l-4 border-amber-500 rounded p-4 shadow-sm mb-6 flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-500" />
                    <h3 className="text-sm font-bold text-amber-800 dark:text-amber-300">
                      Alertas de Inventario (Checklist Faltantes)
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {missingChecklistVehicles.map((v, i) => (
                      <div key={i} className="bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-800/50 p-3 rounded shadow-sm text-sm">
                        <div className="font-bold text-slate-800 dark:text-slate-200 mb-1 flex items-center justify-between">
                           <span>{v.make} {v.model}</span>
                           <span className="text-[10px] bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">{v.year}</span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">{v.vin || 'Sin VIN'}</p>
                        <p className="text-[11px] font-medium text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 p-1.5 rounded">
                          Faltan: {v.missingItems.join(', ')}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div 
                  onClick={() => setIsRevenueModalOpen(true)}
                  className="bg-white dark:bg-slate-800 p-6 rounded border border-gray-200 dark:border-slate-700 shadow-sm flex flex-col justify-between hover:shadow-md cursor-pointer transition-all relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform pointer-events-none">
                    <DollarSign className="w-12 h-12 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total Ingresos de Agencia</p>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(totalWonAmount)}
                    </h2>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-3 flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                    Ingresos brutos por ventas cerradas
                  </p>
                </div>

                <div 
                  onClick={() => setIsRevenueModalOpen(true)}
                  className="bg-white dark:bg-slate-800 p-6 rounded border border-gray-200 dark:border-slate-700 shadow-sm flex flex-col justify-between hover:shadow-md cursor-pointer transition-all relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform pointer-events-none">
                    <TrendingUp className="w-12 h-12 text-indigo-500" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Margen de Utilidad Bruta</p>
                    <h2 className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(totalProfit)}
                    </h2>
                  </div>
                  <p className="text-[11px] text-indigo-500 mt-3 flex items-center gap-1 font-medium">
                    <Sparkles className="w-3.5 h-3.5" />
                    Ganancia estimada (Venta - Compra)
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 rounded border border-gray-200 dark:border-slate-700 shadow-sm flex flex-col justify-between hover:shadow-sm transition-all relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform pointer-events-none">
                    <Users className="w-12 h-12 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Prospectos en Agencia</p>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">
                      {filteredClients.length} <span className="text-xs text-slate-400 font-normal">leads</span>
                    </h2>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-3 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-blue-500" />
                    {activeContacts.length} prospectos activos en seguimiento
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 rounded border border-gray-200 dark:border-slate-700 shadow-sm flex flex-col justify-between hover:shadow-sm transition-all relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform pointer-events-none">
                    <Target className="w-12 h-12 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Conversión de la Agencia</p>
                    <h2 className="text-2xl font-black text-orange-600 dark:text-orange-400">
                      {conversionRate}%
                    </h2>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-3 flex items-center gap-1">
                    <Award className="w-3.5 h-3.5 text-orange-500" />
                    Porcentaje de cierre sobre base total
                  </p>
                </div>
              </div>

              {/* Admin Main Grid */}
              <div className="flex flex-col gap-6">
                
                {/* Left Column (8/12) */}
                <div className="space-y-6">
                  {/* Advisor Performance Board */}
                  <div className="bg-white dark:bg-slate-800 rounded border border-gray-200 dark:border-slate-700 shadow-sm p-6 overflow-hidden">
                    <div className="flex justify-between items-center mb-6">
                      <div>
                        <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                          <UserCheck className="w-5 h-5 text-indigo-500" />
                          Rendimiento de Asesores de Ventas
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">Métricas de conversión y volumen de ventas generados por el equipo.</p>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-gray-200 dark:border-slate-700 pb-3 text-slate-400 text-[11px] uppercase font-black tracking-wider">
                            <th className="py-3 px-2">Asesor</th>
                            <th className="py-3 text-center">Prospectos</th>
                            <th className="py-3 text-center">Cierres</th>
                            <th className="py-3 text-center">Tasa Cierre</th>
                            <th className="py-3 text-right">Ventas ($)</th>
                            <th className="py-3 text-right pr-2">Utilidad Margen</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                          {sellerPerformance.map((seller) => (
                            <tr key={seller.id} className="border-b border-gray-100 dark:border-slate-800 last:border-0">
                              <td className="py-4 px-2 flex items-center gap-3">
                                {seller.photoURL ? (
                                  <img src={seller.photoURL} alt={seller.name} className="w-8 h-8 rounded-full object-cover border border-gray-200" referrerPolicy="no-referrer" />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 text-white font-bold flex items-center justify-center text-xs shadow-inner">
                                    {seller.name.substring(0, 2).toUpperCase()}
                                  </div>
                                )}
                                <div>
                                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{seller.name}</p>
                                  <p className="text-[10px] text-slate-400">Asesor de Ventas</p>
                                </div>
                              </td>
                              <td className="py-4 text-center">
                                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{seller.totalClients}</span>
                                <span className="text-[10px] text-slate-400 block">{seller.activeClients} activos</span>
                              </td>
                              <td className="py-4 text-center">
                                <span className="inline-block bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full text-xs font-extrabold border border-emerald-100 dark:border-emerald-900/30">
                                  {seller.wonClients}
                                </span>
                              </td>
                              <td className="py-4 text-center font-bold text-slate-800 dark:text-slate-200 text-sm">
                                {seller.conversionRate}%
                              </td>
                              <td className="py-4 text-right font-black text-slate-900 dark:text-slate-100 text-sm">
                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(seller.revenue)}
                              </td>
                              <td className="py-4 text-right pr-2 font-black text-indigo-600 dark:text-indigo-400 text-sm">
                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(seller.profit)}
                              </td>
                            </tr>
                          ))}
                          {sellerPerformance.length === 0 && (
                            <tr>
                              <td colSpan={6} className="py-8 text-center text-slate-400 italic text-sm">
                                No hay asesores registrados en la agencia.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Funnel Section */}
                  <div className="bg-white dark:bg-slate-800 rounded border border-gray-200 dark:border-slate-700 shadow-sm p-6">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                          <BarChart2 className="w-5 h-5 text-indigo-500" />
                          Embudo Comercial Consolidado
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">Distribución de oportunidades en las distintas etapas de venta.</p>
                      </div>
                    </div>
                    
                    <div className="h-[220px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <FunnelChart>
                          <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                          <Funnel dataKey="value" data={funnelData} isAnimationActive>
                            {funnelData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Funnel>
                        </FunnelChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Right Column (4/12) */}
                <div className="space-y-6">
                  
                  {/* Mayor Lead Score Panel for Admin */}
                  <div className="bg-white dark:bg-slate-800 rounded border border-gray-200 dark:border-slate-700 shadow-sm p-5 flex flex-col">
                    <div className="mb-4">
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1.5 text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest bg-indigo-50 dark:bg-indigo-950/50 px-2.5 py-1 rounded-full border border-indigo-100 dark:border-indigo-900/30">
                          <Flame className="w-3.5 h-3.5 text-indigo-500 fill-indigo-500/10" />
                          Lead Intelligence
                        </span>
                      </div>
                      <h3 className="text-base font-black text-slate-800 dark:text-slate-100 mt-2">
                        Top Leads con Mayor Lead Score
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Oportunidades más calientes en la agencia ordenadas por probabilidad de éxito.
                      </p>
                    </div>

                    <div className="space-y-3 divide-y divide-slate-100 dark:divide-slate-700/50">
                      {clientsWithScores.slice(0, 5).map((client, idx) => {
                        const sellerObj = allSellersAndAdmins.find(u => u.id === client.sellerId);
                        return (
                          <div 
                            key={`admin-lead-${client.id}`}
                            onClick={() => setSelectedClient(client)}
                            className="pt-3 first:pt-0 group cursor-pointer"
                          >
                            <div className="flex justify-between items-start gap-2">
                              <div className="min-w-0">
                                <h4 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">
                                  {client.name}
                                </h4>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mt-0.5 truncate">
                                  {getWantedTitle(client)}
                                </p>
                                <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1.5">
                                  <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                                  Asesor: <span className="font-semibold text-slate-600 dark:text-slate-300">{sellerObj?.name || "Sin asignar"}</span>
                                </p>
                              </div>
                              <div className="text-right">
                                <span className={`inline-block font-black text-xs px-2.5 py-1 rounded-full text-white shadow-sm ${
                                  client.leadScore >= 75 ? "bg-emerald-500" : client.leadScore >= 45 ? "bg-amber-500" : "bg-slate-400"
                                }`}>
                                  Score: {client.leadScore}
                                </span>
                                <span className="block text-[9px] font-black uppercase text-slate-400 tracking-wider mt-1.5">
                                  Probabilidad {client.probabilityCategory}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {clientsWithScores.length === 0 && (
                        <div className="py-8 text-center text-slate-400 italic text-xs">
                          No hay prospectos activos con Lead Score calculado.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Inactivity & Alertas for Admin */}
                  <div className="bg-white dark:bg-slate-800 rounded border border-gray-200 dark:border-slate-700 shadow-sm p-5">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2 mb-4">
                      <ShieldAlert className="w-4.5 h-4.5 text-red-500" />
                      Alertas de Inactividad de Agencia
                    </h3>
                    <div className="space-y-3 max-h-[250px] overflow-y-auto pr-1">
                      {inactiveAlerts.map((alert, index) => {
                        const sellerObj = allSellersAndAdmins.find(u => u.id === alert.task.sellerId);
                        return (
                          <div 
                            key={`admin-alert-${alert.task.id}-${index}`}
                            className="p-3 bg-red-50/50 dark:bg-red-950/10 border border-red-100 dark:border-red-900/30 rounded"
                          >
                            <p className="text-xs font-black text-slate-800 dark:text-slate-200 line-clamp-1">{alert.task.title}</p>
                            <p className="text-[10px] text-slate-400 mt-1">
                              Cliente: <span className="font-bold text-slate-600 dark:text-slate-300">{alert.client?.name || "N/A"}</span>
                            </p>
                            <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-200 dark:border-slate-800 text-[9px] text-slate-400">
                              <span>Vencimiento: {alert.task.dueDate}</span>
                              <span className="font-bold text-red-600 dark:text-red-400">Responsable: {sellerObj?.name || "Asesor"}</span>
                            </div>
                          </div>
                        );
                      })}
                      {inactiveAlerts.length === 0 && (
                        <div className="py-8 text-center text-slate-400 italic text-xs">
                          Excelente. No hay tareas en inactividad crítica.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ========================================================================= */
            /* 2. ADVISOR / SELLER DESKTOP VIEW                                          */
            /* ========================================================================= */
            <div className="space-y-6">
              {/* Advisor Banner */}
              <div className="bg-slate-900 text-white rounded p-6 border border-slate-800 shadow-xl relative overflow-hidden">
                <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10 bg-gradient-to-l from-indigo-500 to-transparent pointer-events-none" />
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <span className="text-xs font-black uppercase tracking-widest text-emerald-400 bg-emerald-950 border border-emerald-900/50 px-3 py-1 rounded-full">
                      Panel Personal de Ventas
                    </span>
                    <h1 className="text-2xl font-black tracking-tight text-white mt-3">
                      Hola, {userData?.name || "Asesor"}
                    </h1>
                    <p className="text-slate-400 text-xs mt-1">
                      Enfócate en tus prospectos prioritarios (Mayor Lead Score) y completa tus seguimientos diarios.
                    </p>
                  </div>
                  <div className="bg-slate-800 border border-slate-700/50 rounded px-4 py-3 flex items-center gap-3">
                    <Award className="w-5 h-5 text-emerald-400" />
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Tu Meta Mensual</p>
                      <p className="text-sm font-extrabold text-slate-200">En progreso</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Seller KPIs */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white dark:bg-slate-800 p-6 rounded border border-gray-200 dark:border-slate-700 shadow-sm flex flex-col justify-between hover:shadow-sm transition-all relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform pointer-events-none">
                    <CheckCircle className="w-12 h-12 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Mis Ventas Cerradas</p>
                    <h2 className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
                      {wonContacts.length} <span className="text-xs text-slate-400 font-normal">cierres</span>
                    </h2>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-3 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                    ¡Excelente trabajo de venta!
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 rounded border border-gray-200 dark:border-slate-700 shadow-sm flex flex-col justify-between hover:shadow-sm transition-all relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform pointer-events-none">
                    <DollarSign className="w-12 h-12 text-slate-500" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Mis Ingresos Generados</p>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(totalWonAmount)}
                    </h2>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-3 flex items-center gap-1">
                    <Activity className="w-3.5 h-3.5 text-slate-400" />
                    Valor total de unidades vendidas
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 rounded border border-gray-200 dark:border-slate-700 shadow-sm flex flex-col justify-between hover:shadow-sm transition-all relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform pointer-events-none">
                    <Target className="w-12 h-12 text-indigo-500" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Mis Prospectos Activos</p>
                    <h2 className="text-3xl font-black text-indigo-600 dark:text-indigo-400">
                      {activeContacts.length} <span className="text-xs text-slate-400 font-normal">leads</span>
                    </h2>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-3 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-indigo-500" />
                    Leads en pipeline de negociación
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 rounded border border-gray-200 dark:border-slate-700 shadow-sm flex flex-col justify-between hover:shadow-sm transition-all relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform pointer-events-none">
                    <Award className="w-12 h-12 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Coincidencias (Matches)</p>
                    <h2 className="text-3xl font-black text-orange-600 dark:text-orange-400">
                      {allClientMatches} <span className="text-xs text-slate-400 font-normal">autos</span>
                    </h2>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-3 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-orange-500" />
                    Autos de inventario compatibles con tus clientes
                  </p>
                </div>
              </div>

              {/* Seller Main Grid */}
              <div className="flex flex-col gap-6">
                
                {/* Left Column (8/12) */}
                <div className="space-y-6">
                  
                  {/* Mayor Lead Score Detailed Board */}
                  <div className="bg-white dark:bg-slate-800 rounded border border-gray-200 dark:border-slate-700 shadow-sm p-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6 border-b border-gray-200 dark:border-slate-700/50 pb-4">
                      <div>
                        <span className="inline-flex items-center gap-1 text-xs font-extrabold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-1 rounded-full">
                          <Flame className="w-3.5 h-3.5 text-indigo-500 animate-bounce" />
                          ALTA PRIORIDAD (MAYOR LEAD SCORE)
                        </span>
                        <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 mt-2">
                          Mis Prospectos Calientes
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Enfoca tus llamadas en estos clientes. Su puntuación refleja un perfil completo, interés claro y un seguimiento activo.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {clientsWithScores.slice(0, 6).map((client) => (
                        <div 
                          key={`seller-lead-${client.id}`}
                          className="p-4 bg-[#f4f5f5] dark:bg-slate-900/50 hover:bg-[#f4f5f5] hover:dark:bg-slate-800 border border-gray-200 dark:border-slate-800 rounded transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 group"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className={`w-2.5 h-2.5 rounded-full ${
                                client.leadScore >= 75 ? "bg-emerald-500 animate-pulse" : client.leadScore >= 45 ? "bg-amber-500" : "bg-slate-400"
                              }`} />
                              <h4 className="text-base font-extrabold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">
                                {client.name}
                              </h4>
                              {client.probabilityCategory === "Alta" && (
                                <span className="text-[10px] font-black uppercase bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-400 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-900/30">
                                  Caliente
                                </span>
                              )}
                            </div>
                            
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mt-1.5 truncate">
                              Busca: <span className="text-slate-800 dark:text-slate-200 font-extrabold">{getWantedTitle(client)}</span>
                            </p>

                            {/* Core Factors Visualizer */}
                            <div className="flex flex-wrap gap-2 mt-3 text-[10px]">
                              <span className={`px-2 py-0.5 rounded border ${
                                client.scoreDetails?.factors.profileCompleteness && client.scoreDetails.factors.profileCompleteness >= 15
                                  ? "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-gray-200 dark:border-slate-700" 
                                  : "bg-slate-100/50 dark:bg-slate-800/40 text-slate-400 border-gray-200/50 dark:border-slate-700/50"
                              }`}>
                                Perfil Completo: {client.scoreDetails?.factors.profileCompleteness || 0}/25
                              </span>
                              <span className={`px-2 py-0.5 rounded border ${
                                client.scoreDetails?.factors.budget && client.scoreDetails.factors.budget >= 15
                                  ? "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-gray-200 dark:border-slate-700" 
                                  : "bg-slate-100/50 dark:bg-slate-800/40 text-slate-400 border-gray-200/50 dark:border-slate-700/50"
                              }`}>
                                Presupuesto: {client.scoreDetails?.factors.budget || 0}/20
                              </span>
                              <span className={`px-2 py-0.5 rounded border ${
                                client.scoreDetails?.factors.urgency && client.scoreDetails.factors.urgency >= 15
                                  ? "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-gray-200 dark:border-slate-700" 
                                  : "bg-slate-100/50 dark:bg-slate-800/40 text-slate-400 border-gray-200/50 dark:border-slate-700/50"
                              }`}>
                                Pipeline: {client.scoreDetails?.factors.urgency || 0}/25
                              </span>
                              <span className={`px-2 py-0.5 rounded border ${
                                client.scoreDetails?.factors.activity && client.scoreDetails.factors.activity >= 15
                                  ? "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-gray-200 dark:border-slate-700" 
                                  : "bg-slate-100/50 dark:bg-slate-800/40 text-slate-400 border-gray-200/50 dark:border-slate-700/50"
                              }`}>
                                Seguimiento: {client.scoreDetails?.factors.activity || 0}/30
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 border-t md:border-t-0 border-gray-200 dark:border-slate-800 pt-3 md:pt-0">
                            {/* Score Display */}
                            <div className="text-center md:px-4">
                              <span className="block text-2xl font-black text-slate-850 dark:text-slate-100">{client.leadScore}</span>
                              <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Puntos Score</span>
                            </div>

                            {/* Action Button */}
                            <button
                              onClick={() => setSelectedClient(client)}
                              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-black rounded shadow-sm shadow-blue-500/15 flex items-center gap-1.5 transition-all"
                            >
                              Atender
                              <ArrowUpRight className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                      {clientsWithScores.length === 0 && (
                        <div className="py-12 text-center text-slate-400 italic text-sm">
                          No tienes prospectos activos en este momento.
                        </div>
                      )}
                    </div>
                  </div>

                  </div>
                  {/* Right Column (4/12) */}
                <div className="space-y-6">
                  
                  {/* Advisor Activity Center (Tasks) */}
                  <div className="bg-white dark:bg-slate-800 rounded border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col">
                    <div className="p-5 border-b border-slate-150 dark:border-slate-700/60 bg-[#f4f5f5] dark:bg-slate-900">
                      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
                        <Calendar className="w-4.5 h-4.5 text-blue-600" />
                        Mi Agenda y Seguimiento
                      </h3>
                    </div>
                    
                    <div className="p-5 flex flex-col gap-4">
                      <Link to="/tasks" className="flex flex-col gap-1 justify-between p-4 rounded bg-rose-50 hover:bg-rose-100/80 border border-rose-100 transition-all h-full group">
                        <div className="flex items-center gap-3">
                          <AlertCircle className="w-5 h-5 text-rose-500" />
                          <div>
                            <p className="text-sm font-bold text-slate-800">Tareas Atrasadas</p>
                            <p className="text-[11px] text-slate-500">Requieren acción inmediata</p>
                          </div>
                        </div>
                        <span className="text-rose-600 font-black text-2xl mt-2 block">{overdueTasks.length}</span>
                      </Link>

                      <Link to="/tasks" className="flex flex-col gap-1 justify-between p-4 rounded bg-blue-50 hover:bg-blue-100/80 border border-blue-100 transition-all h-full group">
                        <div className="flex items-center gap-3">
                          <Clock className="w-5 h-5 text-blue-500" />
                          <div>
                            <p className="text-sm font-bold text-slate-800">Para Hoy</p>
                            <p className="text-[11px] text-slate-500">Actividades programadas hoy</p>
                          </div>
                        </div>
                        <span className="text-blue-600 font-black text-2xl mt-2 block">{todayTasks.length}</span>
                      </Link>

                      <Link to="/tasks" className="flex flex-col gap-1 justify-between p-4 rounded bg-[#f4f5f5] dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-900 border border-gray-200 dark:border-slate-700 transition-all h-full group">
                        <div className="flex items-center gap-3">
                          <Calendar className="w-5 h-5 text-slate-500" />
                          <div>
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Próximas de la Semana</p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">Seguimientos a mediano plazo</p>
                          </div>
                        </div>
                        <span className="text-slate-600 dark:text-slate-300 font-black text-2xl mt-2 block">{thisWeekTasks.length}</span>
                      </Link>
                    </div>
                  </div>

                  {/* Most wanted vehicles by my clients */}
                  {buscanAutoCount > 0 && (
                    <div className="bg-white dark:bg-slate-800 rounded border border-gray-200 dark:border-slate-700 shadow-sm p-5">
                      <h4 className="text-sm font-bold text-slate-850 dark:text-slate-200 mb-4 flex items-center gap-2">
                        <Car className="w-4.5 h-4.5 text-indigo-500" />
                        Vehículos Más Solicitados
                      </h4>
                      <div className="space-y-3">
                        {buscanAutoClients.slice(0, 5).map((client, idx) => (
                          <div 
                            key={`wanted-vehicle-${client.id}-${idx}`}
                            className="bg-[#f4f5f5] dark:bg-slate-900/50 border border-gray-200 dark:border-slate-800 rounded p-3 hover:bg-slate-100/50 transition-colors cursor-pointer"
                            onClick={() => setSelectedClient(client as Client)}
                          >
                            <p className="text-[11px] font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-wider truncate mb-1">
                              {getWantedTitle(client as Client)}
                            </p>
                            <div className="flex items-center gap-2">
                              <div className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-[10px] font-bold shadow-inner">
                                {client.name.substring(0,1).toUpperCase()}
                              </div>
                              <span className="text-xs text-slate-600 dark:text-slate-300 truncate font-semibold">{client.name}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                  )}
                </div> 
{/* Top Inventory Matches */}
                  <div className="bg-white dark:bg-slate-800 rounded border border-gray-200 dark:border-slate-700 shadow-sm p-6">
                    <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-2">
                      <Target className="w-5 h-5 text-indigo-500" />
                      Coincidencias de Inventario de Alta Prioridad
                    </h3>
                    <p className="text-xs text-slate-400 mb-6">Autos disponibles que se adaptan con excelente afinidad a las preferencias de tus prospectos.</p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {clientsWithScores.slice(0, 4).filter(c => c.leadScore >= 45).map((client) => {
                        const rawMatches = getClientMatches(client as Client, availableVehicles);
                        const matchedVehicles = rawMatches.filter(m => !(client as Client).dismissedMatches?.includes(`${m.vehicle.id}_${m.vehicle.price || 0}`));
                        if (matchedVehicles.length === 0) return null;
                        
                        return (
                          <div 
                            key={`match-box-${client.id}`}
                            className="bg-[#f4f5f5] dark:bg-slate-900/40 border border-slate-150 dark:border-slate-800/80 rounded p-4 flex flex-col justify-between"
                          >
                            <div>
                              <div className="flex justify-between items-start">
                                <span className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider">
                                  Match Detectado
                                </span>
                                <span className="text-[11px] font-extrabold bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-400 px-2 py-0.5 rounded">
                                  Score {client.leadScore}
                                </span>
                              </div>
                              <h4 className="text-sm font-black text-slate-900 dark:text-slate-100 mt-2">
                                {client.name}
                              </h4>
                              <p className="text-xs text-slate-400 mt-1">
                                Busca: {getWantedTitle(client as Client)}
                              </p>
                              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-slate-800">
                                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                                  Auto Compatible Disponible:
                                </p>
                                <p className="text-xs font-black text-slate-800 dark:text-slate-200 mt-1">
                                  {matchedVehicles[0].vehicle.make} {matchedVehicles[0].vehicle.model} ({matchedVehicles[0].vehicle.year})
                                </p>
                                <p className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400 mt-0.5">
                                  ${matchedVehicles[0].vehicle.price.toLocaleString()}
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => setSelectedClient(client as Client)}
                              className="mt-4 w-full py-2 bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-slate-800 dark:text-slate-200 text-xs font-extrabold rounded border border-gray-200 dark:border-slate-700 transition-all flex items-center justify-center gap-1.5"
                            >
                              Ver Ficha de Cliente
                            </button>
                          </div>
                        );
                      })}
                      {clientsWithScores.slice(0, 4).filter(c => c.leadScore >= 45).length === 0 && (
                        <div className="col-span-2 py-8 text-center text-slate-400 italic text-xs">
                          No hay coincidencias automáticas de alto score en este momento.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {selectedClient && (
        <ClientDetailModal
          client={selectedClient}
          onClose={() => setSelectedClient(null)}
          onUpdated={() => setRefreshKey(prev => prev + 1)}
        />
      )}
      <AgencyRevenueModal 
        isOpen={isRevenueModalOpen} 
        onClose={() => setIsRevenueModalOpen(false)} 
        wonContacts={wonContacts} 
        vehicles={vehicles} 
      />
    </div>
  );
}
