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
  CreditCard,
  Blocks,
  Key,
  Unlink,
  TrendingUp,
  MessageSquare,
  DollarSign,
  Building2,
  Bot,
  Phone,
} from "lucide-react";
import { doc, getDoc, collection, query, where, onSnapshot } from "firebase/firestore";
import clsx from "clsx";
import { useReadOnly } from "../hooks/useReadOnly";
import { WelcomeTour } from "./WelcomeTour";

import { ChangePasswordModal } from "./ChangePasswordModal";
import { UserSettingsModal } from "./UserSettingsModal";
import { NotificationsPopover } from "./NotificationsPopover";
import { useIsMobile } from "../hooks/useIsMobile";
import { useSharedInventoryMatches } from "../hooks/useSharedInventoryMatches";

import { MobileFab } from "./MobileFab";
import { NextcarLogo } from "./NextcarLogo";
import { getTrialDaysLeft } from "../lib/subscription";
import { NOMBRE_ROL, type Rol } from "../lib/permissions";

import { MiClaveMcp } from "./MiClaveMcp";
import { DatosDeAgenciaModal } from "./DatosDeAgenciaModal";
export function Layout() {
  const { userData, agencyData, googleAccount, googleToken, disconnectGoogleServices } = useAuth();
  const trialDaysLeft = getTrialDaysLeft(agencyData);
  const isGlobalReadOnly = useReadOnly();
  const navigate = useNavigate();
  const location = useLocation();
  const [agencyName, setAgencyName] = useState<string>("");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showClaveMcp, setShowClaveMcp] = useState(false);
  const [menuPerfilAbierto, setMenuPerfilAbierto] = useState(false);
  const [showUserSettingsModal, setShowUserSettingsModal] = useState(false);
  const [mostrarDatosAgencia, setMostrarDatosAgencia] = useState(false);

  /**
   * Solo se pide a quien todavia no le ha puesto nombre a su agencia.
   *
   * La señal es el nombre que pone el sistema al registrarse, «Agencia de
   * alguien». Mirar solo si faltan los datos habria sacado esta ventana a
   * todas las agencias que ya existen y ya tienen su nombre bien puesto.
   */
  /**
   * Avisos que se pueden posponer, pero no perder.
   *
   * Se descartan aqui y reaparecen en la campanita, donde se quedan hasta que
   * el dato se llena. Un aviso que se puede callar para siempre no sirve para
   * lo que hace falta, que es que el dato acabe puesto; y uno que no se puede
   * callar estorba a quien va con prisa.
   */
  const [avisosDescartados, setAvisosDescartados] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('crm_avisos_descartados') || '[]');
    } catch {
      return [];
    }
  });
  const descartarAviso = (clave: string) => {
    setAvisosDescartados((prev) => {
      const next = Array.from(new Set([...prev, clave]));
      try {
        localStorage.setItem('crm_avisos_descartados', JSON.stringify(next));
        // La campanita escucha esto para recoger el aviso en el momento. Sin
        // el, tardaria hasta un minuto en aparecer ahi.
        window.dispatchEvent(new Event('crm-avisos-cambiaron'));
      } catch {}
      return next;
    });
  };

  // Su telefono sale en las fichas que comparte; sin el, el cliente no sabe a
  // quien llamarle.
  const faltaTelefonoPropio =
    !!userData &&
    (userData.role === 'seller' || userData.role === 'admin') &&
    !userData.phone;

  const faltaNombrarAgencia =
    userData?.role === 'admin' &&
    !!agencyData &&
    !agencyData.datosCompletadosAt &&
    /^Agencia de /i.test(agencyData.name || '');
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
      }).catch((err) => console.error("Error fetching agency name:", err));
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
      name: "Plataforma",
      path: "/platform",
      icon: Building2,
      roles: ["master"],
    },
    {
      name: "Dashboard",
      path: "/",
      icon: LayoutDashboard,
      roles: ["admin", "seller"],
    },
    {
      name: "Inteligencia",
      path: "/intelligence",
      icon: TrendingUp,
      roles: ["admin"],
    },
    {
      name: "Inventario",
      path: "/inventory",
      icon: Car,
      roles: ["admin", "seller", "taller"],
    },
    {
      name: "Inv. de Pagos",
      path: "/payments",
      icon: DollarSign,
      roles: ["admin"],
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
      roles: ["admin", "seller"],
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
      name: "Chats",
      path: "/chats",
      icon: MessageSquare,
      // Los vendedores atienden sus propias conversaciones de WhatsApp, así que
      // también necesitan esta pantalla; antes solo entraban admin y master.
      roles: ["master", "admin", "seller"],
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
          {/* El logo de la agencia manda sobre el de Nextcar: dentro de su CRM,
              quien tiene que verse es su marca. Si no subio ninguno, se queda
              el de Nextcar. */}
          {isSidebarCollapsed ? (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded p-1.5">
              {agencyData?.logoUrl ? (
                <img src={agencyData.logoUrl} alt={agencyData.name || ""} className="max-h-full max-w-full object-contain" />
              ) : (
                <NextcarLogo variant="icon" />
              )}
            </div>
          ) : (
            <div className="flex h-12 w-32 items-center justify-start">
              {agencyData?.logoUrl ? (
                <img src={agencyData.logoUrl} alt={agencyData.name || ""} className="max-h-12 max-w-full object-contain" />
              ) : (
                <NextcarLogo variant="full" className="ml-[-8px]" />
              )}
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
            onClick={() => setMenuPerfilAbierto((v) => !v)}
            className={clsx(
              "tour-profile-button w-full flex items-center rounded bg-[#f4f5f5] dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-left border border-gray-200 dark:border-transparent",
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
                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                  {NOMBRE_ROL[(userData?.role as Rol)] || "Usuario"}
                </span>
              </div>
            )}
          </button>
          {/* Las acciones de la persona viven en un menu, no sueltas en la
              barra: asi la barra no crece cada vez que se agrega una, y el
              lugar donde buscarlas es el mismo de siempre, tu nombre. */}
          {menuPerfilAbierto && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setMenuPerfilAbierto(false)}
              />
              <div className="relative z-50">
                <div className="absolute bottom-1 left-0 right-0 mb-1 rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg overflow-hidden">
                  <button
                    onClick={() => { setMenuPerfilAbierto(false); setShowUserSettingsModal(true); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                  >
                    <Users className="w-4 h-4 shrink-0" />
                    <span className="truncate">Mi perfil</span>
                  </button>
                  {userData?.role === 'admin' && agencyData && (
                    <button
                      onClick={() => { setMenuPerfilAbierto(false); setMostrarDatosAgencia(true); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                    >
                      <Building2 className="w-4 h-4 shrink-0" />
                      <span className="truncate">Datos de mi agencia</span>
                    </button>
                  )}
                  <button
                    onClick={() => { setMenuPerfilAbierto(false); setShowClaveMcp(true); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 border-t border-gray-100 dark:border-slate-700"
                  >
                    <Bot className="w-4 h-4 shrink-0" />
                    <span className="truncate">Mi clave para IA</span>
                  </button>
                  <button
                    onClick={() => { setMenuPerfilAbierto(false); setShowPasswordModal(true); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 border-t border-gray-100 dark:border-slate-700"
                  >
                    <Key className="w-4 h-4 shrink-0" />
                    <span className="truncate">Cambiar contraseña</span>
                  </button>
                  {(googleAccount || googleToken) && (
                    <button
                      onClick={async () => {
                        setMenuPerfilAbierto(false);
                        const cuenta = googleAccount ?? 'tu cuenta de Google';
                        if (!confirm(`¿Desconectar ${cuenta}?\n\nSe retira el permiso en Google. Podrás volver a conectar con esta o con otra cuenta cuando quieras. Tus actividades y contactos del CRM no se tocan.`)) return;
                        try {
                          await disconnectGoogleServices();
                          alert('Cuenta de Google desconectada. Ya puedes conectar otra desde Integraciones.');
                        } catch (e: any) {
                          alert(e?.message || 'No se pudo desconectar la cuenta de Google.');
                        }
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 border-t border-gray-100 dark:border-slate-700"
                      title={googleAccount ? `Conectado con ${googleAccount}` : undefined}
                    >
                      <Unlink className="w-4 h-4 shrink-0" />
                      <span className="truncate">Desconectar Google</span>
                    </button>
                  )}
                  <button
                    onClick={() => { setMenuPerfilAbierto(false); handleLogout(); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 border-t border-gray-100 dark:border-slate-700"
                  >
                    <LogOut className="w-4 h-4 shrink-0" />
                    <span className="truncate">Cerrar sesión</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden bg-[#f4f5f5] dark:bg-slate-900 font-sans w-full relative transition-colors">
        <header className="flex min-h-[56px] md:min-h-[72px] py-2 md:py-3 items-center justify-between border-b border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 md:px-8 shrink-0 transition-colors z-20">
          <div className="flex flex-col justify-center overflow-hidden">
            <div className="flex items-center gap-2 md:gap-4 overflow-hidden">
              {/* En el telefono el titulo sobra: la barra de abajo ya marca en
                  que pantalla estas, con el mismo nombre. Decia «Inventario»
                  arriba e «Inventario» abajo, y ese sitio hace mas falta para
                  la agencia y el perfil. */}
              <h1 className="hidden md:block text-lg md:text-[30px] font-bold text-slate-800 dark:text-white shrink-0 transition-colors leading-none truncate max-w-[140px] sm:max-w-none">
                {navItems.find(item => item.path === location.pathname)?.name || "Panel de Control"}
              </h1>
              {agencyName && (
                <div className="flex items-center gap-1 md:gap-2 rounded-full bg-blue-50 dark:bg-blue-900/40 border border-blue-100 dark:border-blue-800/50 px-2 py-0.5 truncate shrink-0 transition-colors">
                  <Building className="w-3 h-3 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span className="text-[10px] md:text-[11px] font-medium text-blue-700 dark:text-blue-300 truncate max-w-[100px] sm:max-w-none">
                    {agencyName}
                  </span>
                </div>
              )}
              <div className="hidden sm:flex items-center gap-2 rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 shrink-0 transition-colors">
                <span className="text-[10px] md:text-[11px] font-medium text-slate-600 dark:text-slate-400 capitalize">
                  {NOMBRE_ROL[(userData?.role as Rol)] || 'Usuario'}
                </span>
              </div>
              {agencyData?.hasFreeAccess && (
                <div className="hidden sm:flex items-center gap-2 rounded-full bg-sky-100 dark:bg-sky-900/40 border border-sky-200 dark:border-sky-800/50 px-2 py-0.5 shrink-0">
                  <span className="text-[10px] md:text-[11px] font-medium text-sky-700 dark:text-sky-300">
                    Cortesía
                  </span>
                </div>
              )}
              {trialDaysLeft !== null && (
                <div className="hidden sm:flex items-center gap-2 rounded-full bg-orange-100 dark:bg-orange-900/40 border border-orange-200 dark:border-orange-800/50 px-2 py-0.5 shrink-0 transition-colors">
                  <span className="text-[10px] md:text-[11px] font-medium text-orange-700 dark:text-orange-300">
                    Prueba: {trialDaysLeft} {trialDaysLeft === 1 ? 'día' : 'días'}
                  </span>
                </div>
              )}
            </div>
            <p className="text-[15px] text-slate-500 dark:text-slate-400 hidden sm:block mt-1.5 truncate max-w-md leading-none">
              {location.pathname === '/' ? 'Métricas clave y estado de tus ventas' :
               location.pathname === '/inventory' ? 'Gestiona los vehículos de la agencia' :
               // En el telefono no se arrastra: se toca «Mover» en la tarjeta.
               location.pathname === '/kanban' ? (isMobile ? 'Toca «Mover» en una tarjeta para cambiarla de etapa' : 'Arrastra los prospectos para avanzar su proceso') :
               location.pathname === '/persons' ? 'Directorio de contactos y prospectos' :
               location.pathname === '/tasks' ? 'Gestiona tus tareas y recordatorios' :
               location.pathname === '/users' ? 'Administra los accesos y roles de usuarios' :
               location.pathname === '/billing' ? 'Gestiona el plan y facturación de la agencia' :
               location.pathname === '/integrations' ? 'Conecta tus herramientas favoritas al CRM' :
               location.pathname === '/chats' ? 'Conversaciones de WhatsApp con clientes y mensajes con otras agencias' :
               'Administra y controla las actividades del CRM'}
            </p>
          </div>
          <div className="flex items-center gap-2 md:gap-4 shrink-0">
            <NotificationsPopover />

            {/* El perfil sube aqui, junto a la campanita. Estaba ocupando un
                sitio en la barra de abajo, que es para navegar entre
                pantallas, y ahi hacia falta para el embudo. */}
            <button
              onClick={() => setShowUserSettingsModal(true)}
              className="md:hidden w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden border border-gray-200 dark:border-slate-600 shrink-0"
              aria-label="Tu perfil"
            >
              {userData?.photoURL ? (
                <img src={userData.photoURL} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">
                  {userData?.name?.substring(0, 2) || "US"}
                </span>
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
        </header>

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

          {faltaTelefonoPropio && !avisosDescartados.includes('telefono') && (
            <div className="mb-4 flex items-start gap-3 rounded-xl border border-blue-200 dark:border-blue-800/60 bg-blue-50 dark:bg-blue-900/20 px-4 py-3">
              <Phone className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Falta tu teléfono</p>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                  Aparece en las fichas de autos que compartes, para que el cliente te llame a ti y no al conmutador.
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={() => setShowUserSettingsModal(true)}
                    className="text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg active:scale-95 transition-all"
                  >
                    Ponerlo ahora
                  </button>
                  <button
                    onClick={() => descartarAviso('telefono')}
                    className="text-xs font-semibold text-slate-500 dark:text-slate-400 px-2 py-1.5"
                  >
                    Más tarde
                  </button>
                </div>
              </div>
            </div>
          )}

          {userData?.role === 'admin' && agencyData && /^Agencia de /i.test(agencyData.name || '') &&
           !avisosDescartados.includes('agencia') && (
            <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-900/20 px-4 py-3">
              <Building2 className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Tu agencia todavía no tiene nombre</p>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                  Sale así en las fichas de tus autos y en los correos a tu equipo.
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={() => setMostrarDatosAgencia(true)}
                    className="text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 px-3 py-1.5 rounded-lg active:scale-95 transition-all"
                  >
                    Ponerle nombre
                  </button>
                  <button
                    onClick={() => descartarAviso('agencia')}
                    className="text-xs font-semibold text-slate-500 dark:text-slate-400 px-2 py-1.5"
                  >
                    Más tarde
                  </button>
                </div>
              </div>
            </div>
          )}

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
            // El embudo no estaba en esta barra, y en el telefono no hay menu
            // lateral, asi que no habia forma de llegar a el salvo escribiendo
            // la direccion a mano: la pantalla donde vive el trabajo diario de
            // un vendedor era inalcanzable desde su telefono.
            { name: "Embudo", path: "/kanban", icon: Trello },
            { name: "Contactos", path: "/persons", icon: Users },
            { name: "Inventario", path: "/inventory", icon: Car, badge: (ownAgencySharing && sharedMatches.length > 0 && location.pathname !== "/inventory") ? sharedMatches.length : undefined },
            { name: "Chats", path: "/chats", icon: MessageSquare, badge: unreadChatsCount > 0 ? unreadChatsCount : undefined },
            { name: "Citas", path: "/tasks", icon: CheckSquare },
          ].filter(item => {
            if (item.name === "Chats" && userData?.role === "seller") return false;
            // Mismo permiso que en el menu de escritorio.
            if (item.name === "Embudo" && userData?.role !== "admin" && userData?.role !== "seller") return false;
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
                  "flex flex-col items-center justify-center w-full min-w-0 h-full space-y-1 transition-colors relative",
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
              {/* Al subir el perfil a la cabecera quedo sitio para el embudo
                  sin apretar. El recorte se queda como red: una etiqueta
                  partida en dos lineas descuadraria el alto de la barra. */}
              <span className="text-[10px] font-medium leading-none truncate max-w-full px-0.5">{item.name}</span>
            </NavLink>
          ))}
        </nav>
      )}

      {(faltaNombrarAgencia || mostrarDatosAgencia) && agencyData && (
        <DatosDeAgenciaModal
          agencia={agencyData}
          uid={userData?.id || ''}
          primeraVez={faltaNombrarAgencia}
          onCerrar={() => setMostrarDatosAgencia(false)}
        />
      )}

      {showPasswordModal && <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />}
      {showClaveMcp && <MiClaveMcp onClose={() => setShowClaveMcp(false)} />}
      <UserSettingsModal isOpen={showUserSettingsModal} onClose={() => setShowUserSettingsModal(false)} />
    </div>
  );
}
