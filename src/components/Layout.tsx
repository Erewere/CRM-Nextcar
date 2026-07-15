import { useState, useEffect } from "react";
import { Outlet, NavLink, useNavigate, useLocation } from "react-router";
import { useAuth } from "../contexts/AuthContext";
import { logout, db } from "../lib/firebase";
import {
  LayoutDashboard,
  Trello,
  CheckSquare,
  Users,
  LogOut,
  Car,
  Building,
  Menu,
  X,
  Moon,
  Sun,
  ChevronLeft,
  ChevronRight,
  Mail,
  CreditCard,
  Blocks,
  Key,
  TrendingUp,
} from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import clsx from "clsx";

import { TaskReminders } from "./TaskReminders";
import { ChangePasswordModal } from "./ChangePasswordModal";
import { UserSettingsModal } from "./UserSettingsModal";
import { NotificationsPopover } from "./NotificationsPopover";
import { useIsMobile } from "../hooks/useIsMobile";

export function Layout() {
  const { userData } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [agencyName, setAgencyName] = useState<string>("");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showUserSettingsModal, setShowUserSettingsModal] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    // Check local storage for dark mode preference
    const savedMode = localStorage.getItem("darkMode") === "true";
    setIsDarkMode(savedMode);
    if (savedMode) {
      document.documentElement.classList.add("dark");
    }

    const savedCollapsed = localStorage.getItem("sidebarCollapsed") === "true";
    setIsSidebarCollapsed(savedCollapsed);
  }, []);

  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    localStorage.setItem("darkMode", newMode.toString());
    if (newMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const toggleSidebar = () => {
    const newCollapsed = !isSidebarCollapsed;
    setIsSidebarCollapsed(newCollapsed);
    localStorage.setItem("sidebarCollapsed", newCollapsed.toString());
  };

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location]);

  useEffect(() => {
    if (userData?.agencyId && userData.agencyId !== "unassigned") {
      getDoc(doc(db, "agencies", userData.agencyId)).then((snap) => {
        if (snap.exists()) {
          setAgencyName(snap.data().name);
        }
      });
    } else if (userData?.role === "master") {
      setAgencyName("Master Admin");
    }
  }, [userData]);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const navItems = [
    {
      name: "Dashboard",
      path: "/",
      icon: LayoutDashboard,
      roles: ["master", "admin", "seller"],
    },
    {
      name: "Inteligencia",
      path: "/intelligence",
      icon: TrendingUp,
      roles: ["master", "admin"],
    },
    {
      name: "Inventario",
      path: "/inventory",
      icon: Car,
      roles: ["admin", "seller", "master"],
    },
    {
      name: "Embudo",
      path: "/kanban",
      icon: Trello,
      roles: ["admin", "seller"],
    },
    {
      name: "Tareas y Calendario",
      path: "/tasks",
      icon: CheckSquare,
      roles: ["admin", "seller"],
    },
    {
      name: "Personas",
      path: "/persons",
      icon: Users,
      roles: ["admin", "seller", "master"],
    },
    {
      name: "Correos",
      path: "/emails",
      icon: Mail,
      roles: ["admin", "seller", "master"],
    },
    {
      name: "Agencias & Usuarios",
      path: "/users",
      icon: Building,
      roles: ["master", "admin"],
    },
    {
      name: "Facturación",
      path: "/billing",
      icon: CreditCard,
      roles: ["master", "admin"],
    },
    {
      name: "Integraciones",
      path: "/integrations",
      icon: Blocks,
      roles: ["master", "admin"],
    },
  ].filter((item) => {
    if (
      userData?.role === 'master' &&
      item.roles.includes("master")
    )
      return true;
    return item.roles.includes(userData?.role || "");
  });

  return (
    <div className="min-h-[100dvh] bg-gray-50 dark:bg-slate-900 flex flex-col md:flex-row">
      <TaskReminders />
      {/* Sidebar */}
      <aside
        className={clsx(
          "hidden md:flex inset-y-0 left-0 z-50 bg-slate-900 text-slate-300 flex-col items-stretch shrink-0 transition-[width,transform] duration-300 relative",
          isSidebarCollapsed ? "w-20" : "w-64",
        )}
      >
        <button
          onClick={toggleSidebar}
          className="hidden md:flex absolute -right-3 top-6 bg-slate-800 text-slate-400 border border-slate-700 hover:text-white rounded-full p-1 z-50 hover:bg-slate-700 transition-colors"
        >
          {isSidebarCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>

        <div
          className={clsx(
            "hidden md:flex items-center gap-3 p-6 border-b border-slate-800",
            isSidebarCollapsed && "justify-center px-2",
          )}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 font-bold text-white shadow-lg shadow-blue-900/20">
            NX
          </div>
          {!isSidebarCollapsed && (
            <span className="text-xl font-bold tracking-tight text-white truncate">
              Nextcar <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">CRM</span>
            </span>
          )}
        </div>

        <nav className="mt-4 flex-1 space-y-1 px-4 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              title={isSidebarCollapsed ? item.name : undefined}
              className={({ isActive }) =>
                clsx(
                  "flex items-center gap-3 py-2 rounded-lg text-sm transition-all duration-200",
                  isSidebarCollapsed ? "justify-center px-0" : "px-3",
                  isActive
                    ? "bg-gradient-to-r from-blue-600/20 to-indigo-600/10 text-blue-400 font-semibold shadow-sm border border-blue-500/10"
                    : "text-slate-300 hover:bg-slate-800 hover:text-slate-100",
                )
              }
            >
              <item.icon
                className={clsx(
                  "shrink-0",
                  isSidebarCollapsed ? "w-6 h-6" : "w-5 h-5",
                )}
              />
              {!isSidebarCollapsed && (
                <span className="truncate">{item.name}</span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto border-t border-slate-800 p-4">
          <button
            onClick={() => setShowUserSettingsModal(true)}
            className={clsx(
              "w-full flex items-center rounded-xl bg-slate-800/50 mb-2 hover:bg-slate-800 transition-colors cursor-pointer text-left",
              isSidebarCollapsed ? "justify-center p-2" : "gap-3 p-3",
            )}
          >
            {userData?.photoURL ? (
              <img
                src={userData.photoURL}
                alt="Avatar"
                className="h-10 w-10 shrink-0 rounded-lg object-cover"
                title={isSidebarCollapsed ? userData?.name : undefined}
              />
            ) : (
              <div
                className="h-10 w-10 shrink-0 rounded-lg bg-slate-600 flex items-center justify-center text-white font-bold uppercase"
                title={isSidebarCollapsed ? userData?.name : undefined}
              >
                {userData?.name?.substring(0, 2) || "US"}
              </div>
            )}
            {!isSidebarCollapsed && (
              <div className="flex flex-col overflow-hidden">
                <span className="text-sm font-semibold text-white truncate">
                  {userData?.name}
                </span>
                <span className="text-[10px] text-slate-400 capitalize">
                  {userData?.role}
                </span>
              </div>
            )}
          </button>
          <button
            onClick={() => setShowPasswordModal(true)}
            title={isSidebarCollapsed ? "Cambiar Contraseña" : undefined}
            className={clsx(
              "w-full flex items-center rounded-lg text-sm text-slate-400 hover:bg-slate-800 hover:text-white transition-colors mb-1",
              isSidebarCollapsed ? "justify-center py-3" : "gap-3 px-3 py-2",
            )}
          >
            <Key
              className={clsx(
                "shrink-0",
                isSidebarCollapsed ? "w-6 h-6" : "w-5 h-5",
              )}
            />
            {!isSidebarCollapsed && (
              <span className="truncate">Cambiar Contraseña</span>
            )}
          </button>
          <button
            onClick={handleLogout}
            title={isSidebarCollapsed ? "Cerrar Sesión" : undefined}
            className={clsx(
              "w-full flex items-center rounded-lg text-sm text-slate-400 hover:bg-slate-800 hover:text-white transition-colors",
              isSidebarCollapsed ? "justify-center py-3" : "gap-3 px-3 py-2",
            )}
          >
            <LogOut
              className={clsx(
                "shrink-0",
                isSidebarCollapsed ? "w-6 h-6" : "w-5 h-5",
              )}
            />
            {!isSidebarCollapsed && (
              <span className="truncate">Cerrar Sesión</span>
            )}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={clsx("flex-1 flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-900 font-sans w-full relative transition-colors", isMobile ? "h-[calc(100dvh-64px)]" : "h-[100dvh]")}>
        {!isMobile && <header className="flex min-h-[72px] py-3 items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 md:px-8 shrink-0 transition-colors">
          <div className="flex flex-col justify-center overflow-hidden">
            <div className="flex items-center gap-2 md:gap-4 overflow-hidden">
              <h1 className="text-[30px] font-bold text-slate-800 dark:text-white hidden sm:block shrink-0 transition-colors leading-none">
                {navItems.find(item => item.path === location.pathname)?.name || "Panel de Control"}
              </h1>
              {agencyName && (
                <div className="flex items-center gap-1 md:gap-2 rounded-full bg-blue-50 dark:bg-blue-900/40 border border-blue-100 dark:border-blue-800/50 px-2 py-0.5 truncate shrink-0 transition-colors">
                  <Building className="w-3 h-3 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span className="text-[10px] md:text-[11px] font-medium text-blue-700 dark:text-blue-300 truncate">
                    {agencyName}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2 rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 shrink-0 transition-colors">
                <span className="text-[10px] md:text-[11px] font-medium text-slate-600 dark:text-slate-400 capitalize">
                  {userData?.role === 'master' ? 'Master' : 
                   userData?.role === 'admin' ? 'Administrador' : 'Vendedor'}
                </span>
              </div>
            </div>
            <p className="text-[15px] text-slate-500 dark:text-slate-400 hidden sm:block mt-1.5 truncate max-w-md leading-none">
              {location.pathname === '/' ? 'Métricas clave y estado de tus ventas' :
               location.pathname === '/inventory' ? 'Gestiona los vehículos de la agencia' :
               location.pathname === '/kanban' ? 'Arrastra los prospectos para avanzar su proceso' :
               location.pathname === '/persons' ? 'Directorio de contactos y prospectos' :
               location.pathname === '/tasks' ? 'Gestiona tus tareas y recordatorios' :
               location.pathname === '/emails' ? 'Gestiona tu bandeja de entrada sincronizada' :
               location.pathname === '/users' ? 'Administra los accesos y roles de usuarios' :
               location.pathname === '/billing' ? 'Gestiona el plan y facturación de la agencia' :
               location.pathname === '/integrations' ? 'Conecta tus herramientas favoritas al CRM' :
               'Administra y controla las actividades del CRM'}
            </p>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <NotificationsPopover />
            {/* Dark Mode Toggle */}
            <button
              onClick={toggleDarkMode}
              className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Toggle dark mode"
            >
              {isDarkMode ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </button>

            {/* Simulating "Integration with website" CTA just conceptually or link out */}
            <a
              href="https://www.nextcar.erewere.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors"
            >
              <Car className="w-4 h-4" />
              Ir a Nextcar
            </a>
          </div>
        </header>}

        <div className="flex-1 overflow-auto p-4 md:p-6 relative transition-colors">
          <Outlet />
        </div>
      </main>
      
      {/* Mobile Bottom Navigation */}
      {isMobile && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 w-full bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-around h-16 px-2 pb-safe z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          {[
            { name: "Inicio", path: "/", icon: LayoutDashboard },
            { name: "Contactos", path: "/persons", icon: Users },
            { name: "Inventario", path: "/inventory", icon: Car },
            { name: "Citas", path: "/tasks", icon: CheckSquare },
          ].map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              className={({ isActive }) =>
                clsx(
                  "flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors",
                  isActive ? "text-blue-600 dark:text-blue-400" : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                )
              }
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.name}</span>
            </NavLink>
          ))}
          <button
            onClick={() => setShowUserSettingsModal(true)}
            className="flex flex-col items-center justify-center w-full h-full space-y-1 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden">
               {userData?.photoURL ? (
                  <img src={userData.photoURL} alt="" className="w-full h-full object-cover" />
               ) : (
                  <span className="text-[8px] font-bold">{userData?.name?.substring(0, 2) || "US"}</span>
               )}
            </div>
            <span className="text-[10px] font-medium truncate w-full px-1 text-center">{agencyName || "Perfil"}</span>
          </button>
        </nav>
      )}

      {showPasswordModal && <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />}
      <UserSettingsModal isOpen={showUserSettingsModal} onClose={() => setShowUserSettingsModal(false)} />
    </div>
  );
}
