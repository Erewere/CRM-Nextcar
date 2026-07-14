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
import { MobileHome } from "./mobile/MobileHome";
import { useIsMobile } from "../hooks/useIsMobile";
import { MobileHome } from "./mobile/MobileHome";
import { useIsMobile } from "../hooks/useIsMobile";
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
  ChevronDown,
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
  const [agencyTags, setAgencyTags] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [pipelineStages, setPipelineStages] = useState<
    { id: string; title: string }[]
  >([]);
  const [inactivityAlertDays, setInactivityAlertDays] = useState(14);

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
          dealsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        );

        setClients(
          clientsSnap.docs.map(
            (doc) => ({ id: doc.id, ...doc.data() }) as Client,
          ),
        );
        setVehicles(
          vehiclesSnap.docs.map(
            (doc) => ({ id: doc.id, ...doc.data() }) as Vehicle,
          ),
        );
        setTasks(
          tasksSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Task),
        );
        setUsers(
          usersSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as User),
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
  }, [userData]);

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
  activeContacts.forEach((client) => {
    const matches = getClientMatches(client, availableVehicles);
    allClientMatches += matches.length;
  });


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

      {/* Dynamic Filters */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-3 w-full bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
        {/* Quick Date Filters */}
        <div className="flex flex-wrap gap-2 items-center w-full xl:w-auto">
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
          </div>

          <div className="flex flex-wrap items-center justify-start xl:justify-end gap-3 w-full xl:w-auto">

            
            {userData?.role === "admin" && (
              <select
                className="px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm rounded-md focus:outline-none focus:border-blue-500 text-slate-700 dark:text-slate-300 max-w-[150px] truncate"
                value={filterSeller}
                onChange={(e) => {
                  setFilterSeller(e.target.value);
                  localStorage.setItem("dashboard_filterSeller", e.target.value);
                }}
              >
                <option value="all">Todos los vendedores</option>
                {allSellersAndAdmins.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name || u.email} {u.role === "admin" ? " (Admin)" : ""}
                  </option>
                ))}
              </select>
            )}
            <select
              className="px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm rounded-md focus:outline-none focus:border-blue-500 text-slate-700 dark:text-slate-300 max-w-[180px] truncate"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <option value="all">Todas las categorías</option>
              {Array.from(
                new Set(vehicles.map((v) => v.bodyType).filter(Boolean)),
              ).map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <div className="relative">
              <button
                onClick={() => setIsTagDropdownOpen(!isTagDropdownOpen)}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm rounded-md focus:outline-none text-slate-700 dark:text-slate-300 max-w-[180px]"
              >
                <span className="truncate">
                  {filterTags.length > 0
                    ? `${filterTags.length} etiquetas`
                    : "Todas las etiquetas"}
                </span>
                <ChevronDown className="w-4 h-4" />
              </button>
              {isTagDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-0"
                    onClick={() => setIsTagDropdownOpen(false)}
                  />
                  <div className="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-lg z-10 py-1 max-h-60 overflow-y-auto">
                    <div
                      className="px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer flex items-center justify-between text-sm text-slate-700 dark:text-slate-300"
                      onClick={() => {
                        setFilterTags([]);
                        setIsTagDropdownOpen(false);
                      }}
                    >
                      <span>Todas las etiquetas</span>
                      {filterTags.length === 0 && (
                        <Check className="w-4 h-4 text-blue-600" />
                      )}
                    </div>
                    {agencyTags.map((tag) => (
                      <div
                        key={tag.id}
                        className="px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer flex items-center justify-between text-sm text-slate-700 dark:text-slate-300"
                        onClick={() => {
                          if (filterTags.includes(tag.name)) {
                            setFilterTags(
                              filterTags.filter((t) => t !== tag.name),
                            );
                          } else {
                            setFilterTags([...filterTags, tag.name]);
                          }
                        }}
                      >
                        <span>{tag.name}</span>
                        {filterTags.includes(tag.name) && (
                          <Check className="w-4 h-4 text-blue-600" />
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1">
              <span className="text-xs text-slate-400 font-medium">Desde</span>
              <input
                type="date"
                className="bg-transparent text-sm focus:outline-none text-slate-700 dark:text-slate-300"
                value={filterStartDate}
                onChange={(e) => { setFilterStartDate(e.target.value); setActiveDateFilter(""); }}
              />
            </div>
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1">
              <span className="text-xs text-slate-400 font-medium">Hasta</span>
              <input
                type="date"
                className="bg-transparent text-sm focus:outline-none text-slate-700 dark:text-slate-300"
                value={filterEndDate}
                onChange={(e) => { setFilterEndDate(e.target.value); setActiveDateFilter(""); }}
              />
            </div>
            {(filterSeller !== "all" ||
              filterCategory !== "all" ||
              filterTags.length > 0 ||
              filterStartDate ||
              filterEndDate) && (
              <button
                onClick={() => {
                  setFilterSeller("all");
                  localStorage.setItem("dashboard_filterSeller", "all");
                  setFilterStartDate("");
                  setFilterEndDate("");
                  setFilterCategory("all");
                  setFilterTags([]);
                  setActiveDateFilter("");
                }}
                className="text-xs text-red-500 hover:text-red-700 font-medium px-2"
              >
                Limpiar Filtros
              </button>
            )}


          </div>
      </div>

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
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col min-h-[350px]">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-6">
            Embudo de Ventas
          </h3>
          {pipelineData.length > 0 ? (
            <div className="flex-1 w-full h-full min-h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <FunnelChart margin={{ top: 20, right: 20, left: 20, bottom: 20 }}>
                  <Tooltip content={<CustomTooltip />} />
                  <Funnel
                    dataKey="value"
                    data={pipelineData}
                    isAnimationActive
                  >
                    <LabelList position="right" fill="#64748b" stroke="none" dataKey="name" fontSize={12} />
                    <LabelList position="center" fill="#fff" stroke="none" dataKey="value" fontSize={14} fontWeight="bold" />
                    {pipelineData.map((entry, index) => {
                      const isActive = selectedStage === entry.id || !selectedStage;
                      return (
                        <Cell
                          key={`cell-${index}`}
                          fill={isActive ? COLORS[index % COLORS.length] : '#cbd5e1'}
                          className="cursor-pointer transition-all duration-300 hover:opacity-80"
                          onClick={() => setSelectedStage(selectedStage === entry.id ? null : entry.id)}
                        />
                      );
                    })}
                  </Funnel>
                </FunnelChart>
              </ResponsiveContainer>
            </div>
          ) : (
             <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
                No hay oportunidades activas para mostrar.
             </div>
          )}
        </div>

        {/* Action Center (Tasks & Alerts) */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col overflow-hidden">
          <div className="p-5 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600" />
              Centro de Atención
            </h3>
          </div>
          <div className="p-5 flex-1 space-y-4">
            <Link to="/tasks" className="block flex items-center justify-between p-3 rounded-lg bg-rose-50 border border-rose-100 hover:bg-rose-100 transition-colors">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-rose-500" />
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Tareas Atrasadas</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Requieren atención urgente</p>
                </div>
              </div>
              <span className="text-rose-600 font-black text-xl">{overdueTasks.length}</span>
            </Link>

            <Link to="/tasks" className="block flex items-center justify-between p-3 rounded-lg bg-blue-50 border border-blue-100 hover:bg-blue-100 transition-colors">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-blue-500" />
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Para Hoy</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Actividades programadas</p>
                </div>
              </div>
              <span className="text-blue-600 font-black text-xl">{todayTasks.length}</span>
            </Link>

            <Link to="/tasks" className="block flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
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
              <Link to="/users" className="block flex items-center justify-between p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 hover:bg-orange-100 transition-colors">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-orange-500" />
                  <div>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Alertas de Inactividad</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Clientes sin atención (&#62;{inactivityAlertDays}d)</p>
                  </div>
                </div>
                <span className="text-orange-600 font-black text-xl">{inactiveAlerts.length}</span>
              </Link>
            )}

            {allClientMatches > 0 && (
              <Link
                to="/persons"
                className="block flex items-center justify-between p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Target className="w-5 h-5 text-emerald-500" />
                  <div>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      Matches de Inventario
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


      {/* Vehículos Buscados (Demanda Activa) */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col overflow-hidden mb-6">
        <div className="p-5 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex justify-between items-center">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
            Demanda Activa (Vehículos Buscados)
          </h3>
        </div>
        <div className="p-5 flex-1 max-h-[300px] overflow-y-auto">
          {activeContacts.filter(c => c.wantedVehicle && (c.wantedVehicle.make || c.wantedVehicle.model)).length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeContacts.filter(c => c.wantedVehicle && (c.wantedVehicle.make || c.wantedVehicle.model)).map(client => (
                <Link to="/persons" state={{ clientId: client.id }} key={client.id} className="block p-4 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-indigo-300 hover:shadow-md transition-all bg-slate-50 dark:bg-slate-900 group">
                  <div className="flex justify-between items-start mb-2">
                    <p className="font-bold text-indigo-700 dark:text-indigo-400">
                      {client.wantedVehicle?.make} {client.wantedVehicle?.model}
                    </p>
                    <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">
                      Buscado
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 space-y-1 mb-3">
                    <p>{client.wantedVehicle?.yearMin || '2000'} - {client.wantedVehicle?.yearMax || new Date().getFullYear()}</p>
                    {client.wantedVehicle?.priceMax && <p>Presupuesto: ${client.wantedVehicle.priceMax.toLocaleString()}</p>}
                    {client.wantedVehicle?.bodyType && <p>Carrocería: {client.wantedVehicle.bodyType}</p>}
                  </div>
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 border-t border-slate-200 dark:border-slate-700 pt-2">
                    Cliente: {client.name}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-24 text-slate-400 text-sm">
              No hay registros de vehículos buscados actualmente.
            </div>
          )}
        </div>
      </div>

      {/* Drill-down view if a stage is selected */}
      {selectedStage && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-blue-200 shadow-md">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
            Prospectos en la etapa:{" "}
            <span className="text-blue-600">
              "
              {pipelineStages.find((s) => s.id === selectedStage)?.title ||
                selectedStage}
              "
            </span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeContacts
              .filter((c) => c.status === selectedStage)
              .map((client) => (
                <Link
                  to="/kanban"
                  key={client.id}
                  className="block p-4 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-blue-300 hover:shadow-md transition-all bg-slate-50 dark:bg-slate-900 group"
                >
                  <p className="font-bold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 transition-colors">
                    {client.name}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 truncate mt-1">
                    {client.vehicle || "Sin vehículo de interés"}
                  </p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs text-slate-400">
                      {client.origin}
                    </span>
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded font-medium">
                      Ver en Kanban
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
