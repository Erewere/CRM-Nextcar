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
import { MobileHome } from "./mobile/MobileHome";
import { MobileClientDetail } from "./mobile/MobileClientDetail";
import { useIsMobile } from "../hooks/useIsMobile";
import { deduplicateClients } from "../lib/clientUtils";
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
  AlertCircle,
  Filter,
  Briefcase,

  Check,
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
      <div className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-lg border border-slate-100 dark:border-slate-700">
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
  const isMobile = useIsMobile();
  const [clients, setClients] = useState<Client[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
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

        if (userData.role === "seller") {
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

        const [clientsSnap, dealsSnap, vehiclesSnap, tasksSnap, usersSnap, tagsSnap] =
          await Promise.all([
            getDocs(clientsQ),
            getDocs(dealsQ),
            getDocs(vehiclesQ),
            getDocs(tasksQ),
            getDocs(usersQ),
            getDocs(tagsQ),
          ]);
        
        setDeals(
          dealsSnap.docs.map((doc) => ({ ...doc.data(), id: doc.id }))
        );

        const rawClients = clientsSnap.docs.map(
          (doc) => ({ ...doc.data(), id: doc.id }) as Client,
        );
        
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

  if (loading) return <div>Cargando dashboard...</div>;

  if (
    userData?.role === "master" ||
    userData?.role === 'master'
  ) {
    return <MasterDashboard />;
  }

  if (userData?.role === "unassigned") {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 text-center h-[60vh]">
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

  const activeContacts = baseFilteredClients.filter((c) => isActive(c.status));
  const wonContacts = filteredClients.filter((c) => isWon(c.status));

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

  // Match Calculation
  let allClientMatches = 0;
  const uniqueActiveContacts = Array.from(new Map(activeContacts.map(c => [c.originalClientId || c.id, c])).values()) as Client[];

  uniqueActiveContacts.forEach((client) => {
    const matches = getClientMatches(client, availableVehicles);
    allClientMatches += matches.length;
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
      <>
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
      </>
    );
  }

  return (
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
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 w-full bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex flex-wrap gap-2 items-center w-full lg:w-auto">
            <div className="flex items-center gap-2 pr-3 border-r border-slate-200 dark:border-slate-700 hidden sm:flex">
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
                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20"
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
                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20"
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
                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20"
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
                  ? "bg-gradient-to-r from-slate-600 to-slate-700 text-white shadow-md"
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
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col overflow-hidden">
            <div className="p-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                Centro de Atención
              </h3>
            </div>
            <div className="p-4 grid grid-cols-2 gap-3">
              <Link to="/tasks" className="flex flex-col gap-1 justify-between p-3 rounded-lg bg-rose-50 border border-rose-100 hover:bg-rose-100 transition-colors">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-500" />
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight">Atrasadas</p>
                </div>
                <span className="text-rose-600 font-black text-lg">{overdueTasks.length}</span>
              </Link>
              <Link to="/tasks" className="flex flex-col gap-1 justify-between p-3 rounded-lg bg-blue-50 border border-blue-100 hover:bg-blue-100 transition-colors">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-500" />
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight">Para Hoy</p>
                </div>
                <span className="text-blue-600 font-black text-lg">{todayTasks.length}</span>
              </Link>
              <Link to="/tasks" className="flex flex-col gap-1 justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight">Esta Sem.</p>
                </div>
                <span className="text-slate-600 dark:text-slate-400 font-black text-lg">{thisWeekTasks.length}</span>
              </Link>
              
              {buscanAutoCount > 0 && (
                <Link to="/persons" className="flex flex-col gap-1 justify-between p-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 transition-colors">
                  <div className="flex items-center gap-2">
                    <Car className="w-4 h-4 text-indigo-500" />
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight">Buscan Auto</p>
                  </div>
                  <span className="text-indigo-600 font-black text-lg">{buscanAutoCount}</span>
                </Link>
              )}
{allClientMatches > 0 && (
                <Link to="/persons" className="flex flex-col gap-1 justify-between p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition-colors">
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
            <Link to="/persons" className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-center">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Total Prospectos</p>
              <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100">{filteredClients.length}</h2>
            </Link>
            <Link to="/kanban" className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-center">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Activos</p>
              <h2 className="text-2xl font-black text-blue-600 dark:text-blue-400">{activeContacts.length}</h2>
            </Link>
            <Link to="/closed-sales" className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-center">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Ventas Cerradas</p>
              <h2 className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{wonContacts.length}</h2>
            </Link>
            <Link to="/closed-sales" className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-center">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Ingresos</p>
              <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(totalWonAmount)}
              </h2>
            </Link>
          </div>
          
          {buscanAutoClients.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 mt-4">
              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                <Car className="w-4 h-4 text-indigo-500" />
                Vehículos Buscados
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {buscanAutoClients.slice(0, 6).map((client, idx) => (
                  <div key={`${client.id}-${idx}`} className="bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800 rounded-lg p-3 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors cursor-pointer" onClick={() => setSelectedClient(client)}>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Link to="/persons" className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-center hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition-all cursor-pointer group">
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">Total Prospectos</p>
              <div className="flex items-baseline gap-2">
                <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100 group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors">{filteredClients.length}</h2>
              </div>
            </Link>
            
            <Link to="/kanban" className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-center relative overflow-hidden hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition-all cursor-pointer group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 group-hover:scale-110 transition-all">
                <Target className="w-16 h-16 text-blue-500" />
              </div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1 relative z-10 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">Activos (En Pipeline)</p>
              <div className="flex items-baseline gap-2 relative z-10">
                <h2 className="text-3xl font-black text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors">{activeContacts.length}</h2>
              </div>
            </Link>

            <Link to="/closed-sales" className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-center hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-700 transition-all cursor-pointer group">
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">Ventas Cerradas</p>
              <div className="flex items-baseline gap-2">
                <h2 className="text-3xl font-black text-emerald-600 dark:text-emerald-400 group-hover:text-emerald-700 dark:group-hover:text-emerald-300 transition-colors">{wonContacts.length}</h2>
              </div>
            </Link>

            <Link to="/closed-sales" className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-center hover:shadow-md hover:border-slate-400 dark:hover:border-slate-600 transition-all cursor-pointer group">
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1 group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors">Ingresos (Ventas)</p>
              <div className="flex items-baseline gap-2">
                <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(totalWonAmount)}
                </h2>
              </div>
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <Filter className="w-5 h-5 text-blue-600" />
                  Embudo de Ventas
                </h3>
              </div>
              <div className="flex flex-col gap-6">
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <FunnelChart>
                      <Tooltip
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      />
                      <Funnel
                        dataKey="value"
                        data={funnelData}
                        isAnimationActive
                      >
                        {funnelData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Funnel>
                    </FunnelChart>
                  </ResponsiveContainer>
                </div>
                
                {buscanAutoClients.length > 0 && (
                  <div className="border-t border-slate-100 dark:border-slate-700 pt-4">
                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                      <Car className="w-4 h-4 text-indigo-500" />
                      Vehículos Buscados
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {buscanAutoClients.slice(0, 6).map((client, idx) => (
                        <div key={`${client.id}-${idx}`} className="bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800 rounded-lg p-3 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors cursor-pointer" onClick={() => setSelectedClient(client)}>
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
              </div>
            </div>
            
            <div className="lg:col-span-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col overflow-hidden">
              <div className="p-5 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  Centro de Atención
                </h3>
              </div>
              <div className="p-5 flex flex-col gap-4">
                <Link to="/tasks" className="flex flex-col gap-2 justify-between p-4 rounded-lg bg-rose-50 border border-rose-100 hover:bg-rose-100 transition-colors h-full">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-rose-500" />
                    <div>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Tareas Atrasadas</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Requieren atención urgente</p>
                    </div>
                  </div>
                  <span className="text-rose-600 font-black text-xl">{overdueTasks.length}</span>
                </Link>
                <Link to="/tasks" className="flex flex-col gap-2 justify-between p-4 rounded-lg bg-blue-50 border border-blue-100 hover:bg-blue-100 transition-colors h-full">
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-blue-500" />
                    <div>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Para Hoy</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Actividades programadas</p>
                    </div>
                  </div>
                  <span className="text-blue-600 font-black text-xl">{todayTasks.length}</span>
                </Link>
                <Link to="/tasks" className="flex flex-col gap-2 justify-between p-4 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors h-full">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                    <div>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Esta Semana</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Tareas futuras próximas</p>
                    </div>
                  </div>
                  <span className="text-slate-600 dark:text-slate-400 font-black text-xl">{thisWeekTasks.length}</span>
                </Link>
                {userData?.role === "admin" && inactiveAlerts.length > 0 && (
                  <Link to="/users" className="flex flex-col gap-2 justify-between p-4 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 hover:bg-orange-100 transition-colors h-full">
                    <div className="flex items-center gap-3">
                      <AlertCircle className="w-5 h-5 text-orange-500" />
                      <div>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Alertas Inactividad</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Sin atención (&#62;{inactivityAlertDays}d)</p>
                      </div>
                    </div>
                    <span className="text-orange-600 font-black text-xl">{inactiveAlerts.length}</span>
                  </Link>
                )}
                
                {buscanAutoCount > 0 && (
                  <Link
                    to="/persons"
                    className="flex flex-col gap-2 justify-between p-4 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors h-full"
                  >
                    <div className="flex items-center gap-3">
                      <Car className="w-5 h-5 text-indigo-500" />
                      <div>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                          Buscan Auto
                        </p>
                        <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                          Prospectos en búsqueda
                        </p>
                      </div>
                    </div>
                    <span className="text-indigo-600 font-black text-xl">
                      {buscanAutoCount}
                    </span>
                  </Link>
                )}
{allClientMatches > 0 && (
                  <Link
                    to="/persons"
                    className="flex flex-col gap-2 justify-between p-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors h-full"
                  >
                    <div className="flex items-center gap-3">
                      <Target className="w-5 h-5 text-emerald-500" />
                      <div>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                          Matches Inventario
                        </p>
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                          Posibles coincidencias
                        </p>
                      </div>
                    </div>
                    <span className="text-emerald-600 font-black text-xl">
                      {allClientMatches}
                    </span>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {selectedClient && (
        <ClientDetailModal
          client={selectedClient}
          onClose={() => setSelectedClient(null)}
          onUpdated={() => setRefreshKey(prev => prev + 1)}
        />
      )}
    </div>
  );
}
