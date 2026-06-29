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
  const [clients, setClients] = useState<Client[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterSeller, setFilterSeller] = useState<string>("all");
  const [filterStartDate, setFilterStartDate] = useState<string>("");
  const [filterEndDate, setFilterEndDate] = useState<string>("");
  const [filterCategory, setFilterCategory] = useState<string>("all");

  // For interactive stage selection
  const [selectedStage, setSelectedStage] = useState<string | null>(null);

  const [activeDateFilter, setActiveDateFilter] = useState<string>("");
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);
  const [agencyTags, setAgencyTags] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [pipelineStages, setPipelineStages] = useState<
    { id: string; title: string }[]
  >([]);

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
      userData.id === "vxFIfZ5bdQSzaekW5d5c1TbNVCO2" ||
      userData.role === "unassigned"
    ) {
      setLoading(false);
      return;
    }

    const fetchStats = async () => {
      try {
        const agencyQuery = where("agencyId", "==", userData.agencyId);

        let clientsQ = query(collection(db, "clients"), agencyQuery);
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
        }

        const [clientsSnap, vehiclesSnap, tasksSnap, usersSnap, tagsSnap] =
          await Promise.all([
            getDocs(clientsQ),
            getDocs(vehiclesQ),
            getDocs(tasksQ),
            getDocs(usersQ),
            getDocs(tagsQ),
          ]);

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

  // --- Process Data With Filters ---

  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      if (filterSeller !== "all" && c.sellerId !== filterSeller) return false;

      if (filterStartDate) {
        const clientDate = c.createdAt?.toDate
          ? c.createdAt.toDate()
          : new Date(c.createdAt || Date.now());
        const startDate = new Date(filterStartDate);
        if (
          isValid(startDate) &&
          isValid(clientDate) &&
          isAfter(startOfDay(startDate), clientDate)
        )
          return false;
      }
      if (filterEndDate) {
        const clientDate = c.createdAt?.toDate
          ? c.createdAt.toDate()
          : new Date(c.createdAt || Date.now());
        const endDate = new Date(filterEndDate);
        if (
          isValid(endDate) &&
          isValid(clientDate) &&
          isAfter(clientDate, startOfDay(endDate))
        )
          return false;
      }

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
  }, [
    clients,
    filterSeller,
    filterStartDate,
    filterEndDate,
    filterCategory,
    vehicles,
    filterTags,
  ]);

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

  if (loading) return <div>Cargando dashboard...</div>;

  if (
    userData?.role === "master" ||
    userData?.id === "vxFIfZ5bdQSzaekW5d5c1TbNVCO2"
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
  const wonKeywords = ["ganado", "won", "vendid", "cerrad"];
  const lostKeywords = ["perdid", "lost"];

  const isWon = (status: string = "") =>
    wonKeywords.some((k) =>
      String(status || "")
        .toLowerCase()
        .includes(k),
    );
  const isLost = (status: string = "") =>
    lostKeywords.some((k) =>
      String(status || "")
        .toLowerCase()
        .includes(k),
    );
  const isActive = (status: string) => !isWon(status) && !isLost(status);

  const activeContacts = filteredClients.filter((c) => isActive(c.status));
  const wonContacts = filteredClients.filter((c) => isWon(c.status));

  const totalWonAmount = wonContacts.reduce((sum, contact) => {
    const vehicle = vehicles.find((v) => v.id === contact.vehicleId);
    return sum + (vehicle?.price || 0);
  }, 0);

  const totalProfit = wonContacts.reduce((sum, contact) => {
    const vehicle = vehicles.find((v) => v.id === contact.vehicleId);
    return sum + ((vehicle?.price || 0) - (vehicle?.purchasePrice || 0));
  }, 0);

  // Inventory
  const availableVehicles = filteredVehicles.filter(
    (v) => v.status === "available" || !v.status,
  );

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
        total: statusCounts[status],
      };
    })
    .sort((a, b) => b.total - a.total); // Sort highest first

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
    <div className="space-y-6 pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-200 tracking-tight">
            Resumen Ejecutivo
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Métricas clave y estado de tus ventas
          </p>
        </div>

        {/* Dynamic Filters */}
        <div className="flex flex-col items-start md:items-end gap-3 w-full md:w-auto">
          {/* Quick Date Filters */}
          <div className="flex flex-wrap gap-2">
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

          <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="flex items-center gap-2 pl-2 border-r border-slate-200 dark:border-slate-700 pr-3">
              <Filter className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                Filtros
              </span>
            </div>

            {userData?.role === "admin" && (
              <select
                className="px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm rounded-md focus:outline-none focus:border-blue-500 text-slate-700 dark:text-slate-300"
                value={filterSeller}
                onChange={(e) => setFilterSeller(e.target.value)}
              >
                <option value="all">Todos los vendedores</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
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
                  setFilterCategory("all");
                  setFilterTags([]);
                  setFilterStartDate("");
                  setFilterEndDate("");
                  setActiveDateFilter("");
                }}
                className="text-xs underline text-slate-400 hover:text-slate-600 dark:text-slate-400 px-2"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Primary KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link
          to="/kanban"
          className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between hover:border-blue-300 hover:shadow-md transition-all"
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              Oportunidades Activas
            </p>
            <p className="text-3xl font-bold text-slate-800 dark:text-slate-200">
              {activeContacts.length}
            </p>
          </div>
          <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
            <Briefcase className="w-5 h-5 text-blue-600" />
          </div>
        </Link>

        <Link
          to="/inventory"
          className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between hover:border-emerald-300 hover:shadow-md transition-all"
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              Inventario Disponible
            </p>
            <p className="text-3xl font-bold text-slate-800 dark:text-slate-200">
              {availableVehicles.length}
            </p>
          </div>
          <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
            <Car className="w-5 h-5 text-emerald-600" />
          </div>
        </Link>

        <Link
          to="/kanban"
          className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between hover:border-amber-300 hover:shadow-md transition-all"
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              Oportunidades ('Hot')
            </p>
            <p className="text-3xl font-bold text-slate-800 dark:text-slate-200">
              {hotLeads.length}
            </p>
          </div>
          <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center">
            <Target className="w-5 h-5 text-amber-600" />
          </div>
        </Link>

        {/* Additional Stats for Won Deals & Profits */}
        <Link
          to="/kanban"
          className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between hover:border-green-300 hover:shadow-md transition-all"
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              Ventas Cerradas
            </p>
            <p className="text-3xl font-bold text-slate-800 dark:text-slate-200 mb-2">
              {wonContacts.length}
            </p>
            <div className="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-400">
              <p>Monto: <span className="font-semibold text-slate-800 dark:text-slate-200">${totalWonAmount.toLocaleString()}</span></p>
              {(userData?.role === 'admin' || userData?.role === 'master') && (
                <p>Utilidad: <span className="font-semibold text-green-600 dark:text-green-400">${totalProfit.toLocaleString()}</span></p>
              )}
            </div>
          </div>
          <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center shrink-0 self-start">
            <TrendingUp className="w-5 h-5 text-green-600" />
          </div>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Embudo de Ventas Interactivo */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Oportunidades por Etapa Activa
            </h3>
            {selectedStage && (
              <button
                onClick={() => setSelectedStage(null)}
                className="text-xs text-blue-600 bg-blue-50 px-3 py-1 rounded-full font-medium hover:bg-blue-100"
              >
                Ver Todas
              </button>
            )}
          </div>
          <div className="flex-1 min-h-[300px]">
            {pipelineData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={pipelineData}
                  onClick={(data: any) => {
                    if (
                      data &&
                      data.activePayload &&
                      data.activePayload.length > 0
                    ) {
                      setSelectedStage(data.activePayload[0].payload.id);
                    }
                  }}
                >
                  <defs>
                    <linearGradient id="colorBlue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.9} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.4} />
                    </linearGradient>
                    <linearGradient id="colorGreen" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.9} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.4} />
                    </linearGradient>
                    <linearGradient id="colorOrange" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.9} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.4} />
                    </linearGradient>
                    <linearGradient id="colorPurple" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.9} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.4} />
                    </linearGradient>
                    <linearGradient id="colorPink" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ec4899" stopOpacity={0.9} />
                      <stop offset="95%" stopColor="#ec4899" stopOpacity={0.4} />
                    </linearGradient>
                    <linearGradient id="colorInactive" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#cbd5e1" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#cbd5e1" stopOpacity={0.3} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#f8fafc"
                  />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: "#94a3b8" }}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: "#94a3b8" }}
                    dx={-10}
                  />
                  <Tooltip
                    cursor={{ fill: "transparent" }}
                    content={<CustomTooltip />}
                  />
                  <Bar dataKey="total" radius={[6, 6, 0, 0]} barSize={36}>
                    {pipelineData.map((entry, index) => {
                      const gradients = [
                        "url(#colorBlue)",
                        "url(#colorGreen)",
                        "url(#colorOrange)",
                        "url(#colorPurple)",
                        "url(#colorPink)",
                      ];
                      const isActive = selectedStage === entry.id || !selectedStage;
                      const fillColor = isActive
                        ? gradients[index % gradients.length]
                        : "url(#colorInactive)";

                      return (
                        <Cell
                          key={`cell-${index}`}
                          fill={fillColor}
                          className="cursor-pointer transition-all duration-300 hover:opacity-80"
                        />
                      );
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400">
                No hay oportunidades activas.
              </div>
            )}
          </div>
        </div>

        {/* Action Center (Tasks) */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col overflow-hidden">
          <div className="p-5 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600" />
              Centro de Atención
            </h3>
          </div>
          <div className="p-5 flex-1 space-y-4">
            <Link
              to="/tasks"
              className="block flex items-center justify-between p-3 rounded-lg bg-rose-50 border border-rose-100 hover:bg-rose-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-rose-500" />
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    Tareas Atrasadas
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Requieren atención urgente
                  </p>
                </div>
              </div>
              <span className="text-rose-600 font-black text-xl">
                {overdueTasks.length}
              </span>
            </Link>

            <Link
              to="/tasks"
              className="block flex items-center justify-between p-3 rounded-lg bg-blue-50 border border-blue-100 hover:bg-blue-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-blue-500" />
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    Para Hoy
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Actividades programadas
                  </p>
                </div>
              </div>
              <span className="text-blue-600 font-black text-xl">
                {todayTasks.length}
              </span>
            </Link>

            <Link
              to="/tasks"
              className="block flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    Esta Semana
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Tareas futuras próximas
                  </p>
                </div>
              </div>
              <span className="text-slate-600 dark:text-slate-400 font-black text-xl">
                {thisWeekTasks.length}
              </span>
            </Link>
          </div>
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
