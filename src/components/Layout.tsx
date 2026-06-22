import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { logout, db } from '../lib/firebase';
import { LayoutDashboard, Trello, CheckSquare, Users, LogOut, Car, Building, Menu, X, Moon, Sun, ChevronLeft, ChevronRight, Mail } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import clsx from 'clsx';

export function Layout() {
  const { userData } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [agencyName, setAgencyName] = useState<string>('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    // Check local storage for dark mode preference
    const savedMode = localStorage.getItem('darkMode') === 'true';
    setIsDarkMode(savedMode);
    if (savedMode) {
      document.documentElement.classList.add('dark');
    }
    
    const savedCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    setIsSidebarCollapsed(savedCollapsed);
  }, []);

  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    localStorage.setItem('darkMode', newMode.toString());
    if (newMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const toggleSidebar = () => {
    const newCollapsed = !isSidebarCollapsed;
    setIsSidebarCollapsed(newCollapsed);
    localStorage.setItem('sidebarCollapsed', newCollapsed.toString());
  };

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location]);

  useEffect(() => {
    if (userData?.agencyId && userData.agencyId !== 'unassigned') {
      getDoc(doc(db, 'agencies', userData.agencyId)).then(snap => {
        if (snap.exists()) {
          setAgencyName(snap.data().name);
        }
      });
    } else if (userData?.role === 'master') {
      setAgencyName('Master Admin');
    }
  }, [userData]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard, roles: ['master', 'admin', 'seller'] },
    { name: 'Inventario', path: '/inventory', icon: Car, roles: ['admin', 'seller', 'master'] },
    { name: 'Kanban', path: '/kanban', icon: Trello, roles: ['admin', 'seller'] },
    { name: 'Tareas Pendientes', path: '/tasks', icon: CheckSquare, roles: ['admin', 'seller'] },
    { name: 'Personas', path: '/persons', icon: Users, roles: ['admin', 'seller', 'master'] },
    { name: 'Correos', path: '/emails', icon: Mail, roles: ['admin', 'seller', 'master'] },
    { name: 'Agencias & Usuarios', path: '/users', icon: Building, roles: ['master', 'admin'] }
  ].filter(item => {
    if (userData?.id === 'vxFIfZ5bdQSzaekW5d5c1TbNVCO2' && item.roles.includes('master')) return true;
    return item.roles.includes(userData?.role || '');
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between bg-slate-900 px-4 py-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 font-bold text-white text-sm">
            NX
          </div>
          <span className="text-lg font-bold tracking-tight text-white">Nextcar <span className="text-blue-500">CRM</span></span>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="text-slate-300 hover:text-white p-2"
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar overlay for mobile */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={clsx(
        "fixed inset-y-0 left-0 z-50 bg-slate-900 text-slate-300 flex flex-col items-stretch shrink-0 transition-[width,transform] duration-300 md:relative md:translate-x-0",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full",
        isSidebarCollapsed ? "w-20" : "w-64"
      )}>
        <button 
          onClick={toggleSidebar}
          className="hidden md:flex absolute -right-3 top-6 bg-slate-800 text-slate-400 border border-slate-700 hover:text-white rounded-full p-1 z-50 hover:bg-slate-700 transition-colors"
        >
          {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>

        <div className={clsx("hidden md:flex items-center gap-3 p-6 border-b border-slate-800", isSidebarCollapsed && "justify-center px-2")}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 font-bold text-white shadow-lg shadow-blue-900/20">
            NX
          </div>
          {!isSidebarCollapsed && (
            <span className="text-xl font-bold tracking-tight text-white truncate">Nextcar <span className="text-blue-500">CRM</span></span>
          )}
        </div>
        
        <nav className="mt-4 flex-1 space-y-1 px-4 overflow-y-auto">
          {navItems.map((item) => (
             <NavLink
               key={item.path}
               to={item.path}
               end={item.path === '/'}
               title={isSidebarCollapsed ? item.name : undefined}
               className={({ isActive }) => clsx(
                 "flex items-center gap-3 py-2 rounded-lg text-sm transition-colors",
                 isSidebarCollapsed ? "justify-center px-0" : "px-3",
                 isActive ? "bg-blue-600/10 text-blue-400 font-medium" : "text-slate-300 hover:bg-slate-800"
               )}
             >
               <item.icon className={clsx("shrink-0", isSidebarCollapsed ? "w-6 h-6" : "w-5 h-5")} />
               {!isSidebarCollapsed && <span className="truncate">{item.name}</span>}
             </NavLink>
          ))}
        </nav>

        <div className="mt-auto border-t border-slate-800 p-4">
          <div className={clsx("flex items-center rounded-xl bg-slate-800/50 mb-2", isSidebarCollapsed ? "justify-center p-2" : "gap-3 p-3")}>
            <div className="h-10 w-10 shrink-0 rounded-lg bg-slate-600 flex items-center justify-center text-white font-bold uppercase" title={isSidebarCollapsed ? userData?.name : undefined}>
              {userData?.name?.substring(0,2) || 'US'}
            </div>
            {!isSidebarCollapsed && (
              <div className="flex flex-col overflow-hidden">
                <span className="text-sm font-semibold text-white truncate">{userData?.name}</span>
                <span className="text-[10px] text-slate-400 capitalize">{userData?.role}</span>
              </div>
            )}
          </div>
          <button 
            onClick={handleLogout}
            title={isSidebarCollapsed ? "Cerrar Sesión" : undefined}
            className={clsx(
              "w-full flex items-center rounded-lg text-sm text-slate-400 hover:bg-slate-800 hover:text-white transition-colors",
              isSidebarCollapsed ? "justify-center py-3" : "gap-3 px-3 py-2"
            )}
          >
            <LogOut className={clsx("shrink-0", isSidebarCollapsed ? "w-6 h-6" : "w-5 h-5")} />
            {!isSidebarCollapsed && <span className="truncate">Cerrar Sesión</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-[calc(100vh-56px)] md:h-screen overflow-hidden bg-slate-50 dark:bg-slate-900 font-sans w-full relative transition-colors">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 md:px-8 shrink-0 transition-colors">
          <div className="flex items-center gap-2 md:gap-4 overflow-hidden">
            <h1 className="text-lg font-bold text-slate-800 dark:text-white hidden sm:block shrink-0 transition-colors">Panel de Control</h1>
            {agencyName && (
              <div className="flex items-center gap-1 md:gap-2 rounded-full bg-blue-50 dark:bg-blue-900/40 border border-blue-100 dark:border-blue-800/50 px-2 md:px-3 py-1 truncate shrink-0 transition-colors">
                <Building className="w-3 h-3 text-blue-600 dark:text-blue-400 shrink-0" />
                <span className="text-[10px] md:text-xs font-medium text-blue-700 dark:text-blue-300 truncate">{agencyName}</span>
              </div>
            )}
            <div className="flex items-center gap-2 rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1 shrink-0 transition-colors">
              <span className="h-2 w-2 rounded-full bg-green-500"></span>
              <span className="text-[10px] md:text-xs font-medium text-slate-600 dark:text-slate-400 hidden sm:inline">En línea</span>
            </div>
          </div>
          <div className="flex items-center gap-4 shrink-0">
             {/* Dark Mode Toggle */}
             <button
               onClick={toggleDarkMode}
               className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
               aria-label="Toggle dark mode"
             >
               {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
             </button>

             {/* Simulating "Integration with website" CTA just conceptually or link out */}
             <a href="https://www.nextcar.erewere.com" target="_blank" rel="noopener noreferrer" className="hidden sm:flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors">
               <Car className="w-4 h-4" />
               Ir a Nextcar
             </a>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 md:p-8 relative transition-colors">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
