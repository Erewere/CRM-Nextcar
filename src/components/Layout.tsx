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
  AlertCircle,
  Sun,
  ChevronLeft,
  ChevronRight,
  Mail,
  CreditCard,
  Blocks,
  Key,
  TrendingUp,
  MessageSquare,
} from "lucide-react";
import { doc, getDoc, collection, query, where, onSnapshot } from "firebase/firestore";
import clsx from "clsx";
import { useReadOnly } from "../hooks/useReadOnly";
import { WelcomeTour } from "./WelcomeTour";

import { TaskReminders } from "./TaskReminders";
import { SharedMatchNotifications } from "./SharedMatchNotifications";
import { ChangePasswordModal } from "./ChangePasswordModal";
import { UserSettingsModal } from "./UserSettingsModal";
import { NotificationsPopover } from "./NotificationsPopover";
import { useIsMobile } from "../hooks/useIsMobile";
import { useSharedInventoryMatches } from "../hooks/useSharedInventoryMatches";

import { MobileFab } from "./MobileFab";
import { LuhoLogo } from "./LuhoLogo";

const safeDate = (val: any) => {
  if (!val) return new Date();
  if (typeof val.toDate === 'function') return val.toDate();
  if (val.seconds) return new Date(val.seconds * 1000);
  const d = new Date(val);
  return isNaN(d.getTime()) ? new Date() : d;
};

export function Layout() {
  const { userData, agencyData } = useAuth();
  let trialDaysLeft = null;
  if (agencyData?.subscriptionStatus === "trialing") {
    if (agencyData.createdAt) {
      const createdDate = safeDate(agencyData.createdAt);
      const daysSinceCreation = Math.floor((new Date().getTime() - createdDate.getTime()) / (1000 * 3600 * 24));
      trialDaysLeft = Math.max(0, 30 - daysSinceCreation);
    } else if (agencyData.trialEndsAt) {
      trialDaysLeft = Math.max(0, Math.ceil((safeDate(agencyData.trialEndsAt).getTime() - new Date().getTime()) / (1000 * 3600 * 24)));
    }
  }
  const isGlobalReadOnly = useReadOnly();
  const navigate = useNavigate();
  const location = useLocation();
  const [agencyName, setAgencyName] = useState<string>("");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showUserSettingsModal, setShowUserSettingsModal] = useState(false);
  const isMobile = useIsMobile();
  const [unreadChatsCount, setUnreadChatsCount] = useState<number>(0);
  const { matches: sharedMatches, ownAgencySharing } = useSharedInventoryMatches();

  useEffect(() => {
    // Check local storage for dark mode preference
    const savedMode = localStorage.getItem("darkMode") === "true";
    setIsDarkMode(false); localStorage.setItem("darkMode", "false"); document.documentElement.classList.remove("dark");
    if (false) {
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

  useEffect(() => {
    if (!userData?.agencyId) {
      setUnreadChatsCount(0);
      return;
    }

    let q;
    if (userData.role === 'master') {
      q = query(collection(db, 'agencyChats'));
    } else {
      q = query(
        collection(db, 'agencyChats'),
        where('participants', 'array-contains', userData.agencyId)
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let count = 0;
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (userData.role === 'master') {
          const unreadBy = data.unreadBy || {};
          const hasAnyUnread = Object.values(unreadBy).some(val => val === true);
          if (hasAnyUnread) {
            count++;
          }
        } else {
          if (data.unreadBy?.[userData.agencyId] === true) {
            count++;
          }
        }
      });
      setUnreadChatsCount(count);
    }, (error) => {
      console.error("Error listening to unread chats count:", error);
    });

    return () => unsubscribe();
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
    {
      name: "Chat Interagencias",
      path: "/chats",
      icon: MessageSquare,
      roles: ["master", "admin"],
      badge: unreadChatsCount > 0 ? unreadChatsCount : undefined,
    },
  ].filter((item) => {
    if (
      userData?.role === 'master' &&
      item.roles.includes("master")
    )
      return true;
    return item.roles.includes(userData?.role || "");
  });

  const hasSharedMatches = ownAgencySharing && sharedMatches.length > 0;

  const processedNavItems = navItems.map(item => {
    let finalItem = { ...item };
    if (finalItem.name === "Inventario") {
      finalItem = {
        ...finalItem,
        path: "/inventory",
        badge: (hasSharedMatches && location.pathname !== "/inventory") ? sharedMatches.length : undefined
      };
    }
    
    if (isGlobalReadOnly && finalItem.path !== '/' && finalItem.path !== '/billing') {
      (finalItem as any).disabled = true;
    }
    return finalItem;
  });

  return (
    <div className={clsx(
      "bg-gray-50 dark:bg-slate-900 flex w-full h-screen overflow-hidden",
      isMobile ? "flex-col" : "flex-row"
    )}>
      <TaskReminders />
      <SharedMatchNotifications />
      {/* Sidebar */}
      <aside
        className={clsx(
          "hidden md:flex sticky top-0 h-screen z-50 bg-white border-r border-gray-200 dark:bg-slate-900 dark:border-slate-800 text-slate-600 dark:text-slate-300 flex-col items-stretch shrink-0 transition-[width,transform] duration-300",
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
            "hidden md:flex items-center p-6 border-b border-gray-200 dark:border-slate-800 h-[72px]",
            isSidebarCollapsed ? "justify-center px-2" : "justify-start"
          )}
        >
          {isSidebarCollapsed ? (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded p-1.5">
              <LuhoLogo variant="icon" />
            </div>
          ) : (
            <div className="flex h-12 w-32 items-center justify-start">
              <LuhoLogo variant="full" className="ml-[-8px]" />
            </div>
          )}
        </div>

        <nav className="mt-4 flex-1 space-y-1 px-4 overflow-y-auto">
          {processedNavItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              title={isSidebarCollapsed ? item.name : undefined}
              onClick={(e) => {
                if ((item as any).disabled) {
                  e.preventDefault();
                }
              }}
              className={({ isActive }) =>
                clsx(
                  "flex items-center gap-3 py-2 rounded text-sm transition-all duration-200",
                  isSidebarCollapsed ? "justify-center px-0" : "px-3",
                  (item as any).disabled ? "opacity-50 cursor-not-allowed pointer-events-none" : "",
                  isActive
                    ? "bg-blue-50 text-blue-700 font-semibold shadow-sm border border-blue-100 dark:bg-gradient-to-r dark:from-blue-600/20 dark:to-indigo-600/10 dark:text-blue-400 dark:border-blue-500/10"
                    : "text-slate-600 hover:bg-[#f4f5f5] hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100",
                )
              }
            >
              <div className="relative shrink-0 flex items-center justify-center">
                <item.icon
                  className={clsx(
                    "shrink-0",
                    isSidebarCollapsed ? "w-6 h-6" : "w-5 h-5",
                  )}
                />
                {item.badge !== undefined && isSidebarCollapsed && (
                  <span className={clsx(
                    "absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border border-slate-900 animate-pulse",
                    item.name === "Inventario" ? "bg-amber-500" : "bg-red-500"
                  )} />
                )}
              </div>
              {!isSidebarCollapsed && (
                <span className="truncate">{item.name}</span>
              )}
              {!isSidebarCollapsed && item.badge !== undefined && (
                <span className={clsx(
                  "ml-auto text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center shadow-sm",
                  item.name === "Inventario" ? "bg-amber-500 animate-pulse" : "bg-red-500"
                )}>
                  {item.badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto border-t border-gray-200 dark:border-slate-800 p-4">
          <button
            onClick={() => setShowUserSettingsModal(true)}
            className={clsx(
              "tour-profile-button w-full flex items-center rounded bg-[#f4f5f5] dark:bg-slate-800/50 mb-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-left border border-gray-200 dark:border-transparent",
              isSidebarCollapsed ? "justify-center p-2" : "gap-3 p-3",
            )}
          >
            {userData?.photoURL ? (
              <img
                src={userData.photoURL}
                alt="Avatar"
                className="h-10 w-10 shrink-0 rounded object-cover"
                title={isSidebarCollapsed ? userData?.name : undefined}
              />
            ) : (
              <div
                className="h-10 w-10 shrink-0 rounded bg-slate-600 flex items-center justify-center text-white font-bold uppercase"
                title={isSidebarCollapsed ? userData?.name : undefined}
              >
                {userData?.name?.substring(0, 2) || "US"}
              </div>
            )}
            {!isSidebarCollapsed && (
              <div className="flex flex-col overflow-hidden">
                <span className="text-sm font-semibold text-slate-800 dark:text-white truncate">
                  {userData?.name}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 capitalize">
                  {userData?.role}
                </span>
              </div>
            )}
          </button>
          <button
            onClick={() => setShowPasswordModal(true)}
            title={isSidebarCollapsed ? "Cambiar Contraseña" : undefined}
            className={clsx(
              "w-full flex items-center rounded text-sm text-slate-500 hover:bg-[#f4f5f5] hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white transition-colors mb-1",
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
              "w-full flex items-center rounded text-sm text-slate-500 hover:bg-[#f4f5f5] hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white transition-colors",
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
      <main className="flex-1 flex flex-col overflow-hidden bg-[#f4f5f5] dark:bg-slate-900 font-sans w-full relative transition-colors">
        {!isMobile && <header className="flex min-h-[72px] py-3 items-center justify-between border-b border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 md:px-8 shrink-0 transition-colors">
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
              {trialDaysLeft !== null && (
                <div className="flex items-center gap-2 rounded-full bg-orange-100 dark:bg-orange-900/40 border border-orange-200 dark:border-orange-800/50 px-2 py-0.5 shrink-0 transition-colors">
                  <span className="text-[10px] md:text-[11px] font-medium text-orange-700 dark:text-orange-300">
                    Prueba: {trialDaysLeft} {trialDaysLeft === 1 ? 'día' : 'días'}
                  </span>
                </div>
              )}
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

            {/* Simulating "Integration with website" CTA just conceptually or link out */}
            <a
              href="https://www.nextcar.com.mx"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors"
            >
              <Car className="w-4 h-4" />
              Ir a Nextcar
            </a>
          </div>
        </header>}

        {(isGlobalReadOnly && userData?.role !== 'master' && userData?.agencyId !== 'unassigned') && (
          <div className="bg-red-50 dark:bg-red-900/30 border-b border-red-200 dark:border-red-800 p-3 sm:p-4 px-4 sm:px-6 flex items-center justify-between z-10 relative">
            <div className="flex items-center gap-3">
              <div className="bg-red-100 dark:bg-red-800 p-1.5 rounded-full shrink-0">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-300" />
              </div>
              <p className="text-sm text-red-800 dark:text-red-200 font-medium">
                Suscripción inactiva. Tu acceso es de solo lectura y limitado. 
                {userData?.role === 'admin' ? " Ve a Facturación para reactivarla." : " Contacta a tu administrador para reactivarla."}
              </p>
            </div>
            {userData?.role === 'admin' && (
              <button
                onClick={() => navigate('/billing')}
                className="inline-flex bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-3 py-1.5 rounded transition-colors whitespace-nowrap ml-2 sm:ml-4 cursor-pointer"
              >
                Reactivar
              </button>
            )}
          </div>
        )}

        <div className={clsx(
          "flex-1 relative transition-colors",
          isMobile 
            ? ((location.pathname === '/chats' || location.pathname === '/inventory') ? "h-full overflow-hidden" : "overflow-auto p-4") 
            : (location.pathname === '/chats' ? "h-full overflow-hidden p-4 md:p-6" : "overflow-auto p-4 md:p-6")
        )}>
          <WelcomeTour />
          <Outlet />
        </div>
      </main>
      
      {/* Global Mobile FAB */}
      {isMobile && location.pathname !== '/chats' && <MobileFab />}
      
      {/* Mobile Bottom Navigation */}
      {isMobile && (
        <nav className="md:hidden w-full bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-800 flex items-center justify-around h-16 px-2 pb-safe z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] shrink-0">
          {[
            { name: "Inicio", path: "/", icon: LayoutDashboard },
            { name: "Contactos", path: "/persons", icon: Users },
            { name: "Inventario", path: "/inventory", icon: Car, badge: (ownAgencySharing && sharedMatches.length > 0 && location.pathname !== "/inventory") ? sharedMatches.length : undefined },
            { name: "Chats", path: "/chats", icon: MessageSquare, badge: unreadChatsCount > 0 ? unreadChatsCount : undefined },
            { name: "Citas", path: "/tasks", icon: CheckSquare },
          ].filter(item => {
            if (item.name === "Chats" && userData?.role === "seller") return false;
            return true;
          }).map(item => {
            const finalItem = { ...item };
            if (isGlobalReadOnly && finalItem.path !== '/' && finalItem.path !== '/billing') {
              (finalItem as any).disabled = true;
            }
            return finalItem;
          }).map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              onClick={(e) => {
                if ((item as any).disabled) {
                  e.preventDefault();
                }
              }}
              className={({ isActive }) =>
                clsx(
                  "flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors relative",
                  (item as any).disabled ? "opacity-50 cursor-not-allowed pointer-events-none" : "",
                  isActive ? "text-blue-600 dark:text-blue-400" : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                )
              }
            >
              <div className="relative">
                <item.icon className="w-5 h-5" />
                {item.badge !== undefined && (
                  <span className={clsx(
                    "absolute -top-1.5 -right-2 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center border border-white dark:border-slate-900",
                    item.name === "Inventario" ? "bg-amber-500 animate-pulse" : "bg-red-500"
                  )}>
                    {item.badge}
                  </span>
                )}
              </div>
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
