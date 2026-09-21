import React from 'react';
import { NextcarIcono } from './components/NextcarLogo';
import { BrowserRouter, Route, Routes, Navigate } from 'react-router';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Layout } from './components/Layout';
import { ChatsPendientesProvider } from './contexts/ChatsPendientesContext';
import { Login } from './pages/Login';
import { ConectarPagina } from './pages/ConectarPagina';
import { Dashboard } from './pages/Dashboard';
import { Kanban } from './pages/Kanban';
import { Tasks } from './pages/Tasks';
import { Persons } from './pages/Persons';
import { AgencyUsers } from './pages/AgencyUsers';
import { Inventory } from './pages/Inventory';
import { VehiclePrint } from './pages/VehiclePrint';
import { Billing } from './pages/Billing';
import { Chats } from './pages/Chats';
import { auth } from './lib/firebase';
import { signOut } from 'firebase/auth';

import { Integrations } from './pages/Integrations';
import { PlatformPanel } from './pages/PlatformPanel';
import { ClosedSales } from './pages/ClosedSales';
import { PaymentInventory } from './pages/PaymentInventory';
import { hasActiveAccess } from './lib/subscription';

/**
 * A donde entra cada quien.
 *
 * El master no monta el Dashboard: sus efectos consultan contactos y tratos
 * sin filtrar por agencia, y desde que el master dejo de tener acceso a los
 * datos de las agencias esas consultas serian rechazadas. Su lugar es el
 * panel de la plataforma, que recibe todo calculado del servidor.
 */
const Inicio = () => {
  const { userData } = useAuth();
  if (userData?.role === 'master') return <Navigate to="/platform" replace />;
  return <Dashboard />;
};

const ProtectedRoute = ({ children, requireRole }: { children: React.ReactNode, requireRole?: ('master' | 'admin' | 'seller' | 'taller')[] }) => {
  const { currentUser, userData, agencyData, loading } = useAuth();

  console.log("ProtectedRoute: rendering", { 
    loading, 
    currentUserUid: currentUser?.uid, 
    userRole: userData?.role, 
    agencyId: userData?.agencyId,
    agencyDataLoaded: !!agencyData,
    pathname: window.location.pathname 
  });

  if (loading) {
    console.log("ProtectedRoute: loading is true, rendering spinner");
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900"><NextcarIcono className="h-14 w-14" animado /></div>;
  }
  if (!currentUser) {
    console.log("ProtectedRoute: no currentUser, redirecting to /login");
    return <Navigate to="/login" replace />;
  }
  if (!userData) {
    console.log("ProtectedRoute: no userData, rendering spinner");
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900"><NextcarIcono className="h-14 w-14" animado /></div>;
  }
  
  if (requireRole) {
    const isSpecialMaster = userData.role === 'master';
    if (!requireRole.includes(userData.role as any) && !(isSpecialMaster && requireRole.includes('master'))) {
      console.log("ProtectedRoute: unauthorized role, redirecting to /", { required: requireRole, userRole: userData.role });
      return <Navigate to="/" replace />;
    }
  }

  // Verificar suscripción o acceso gratuito de la agencia (no aplica a roles 'master')
  const isMaster = userData.role === 'master';
  
  if (!isMaster && userData.agencyId && userData.agencyId !== 'unassigned') {
    const hasActiveSubscription = hasActiveAccess(agencyData);

    if (!hasActiveSubscription) {
      const pathname = window.location.pathname;
      if (pathname !== '/' && pathname !== '/billing') {
        return <Navigate to="/" replace />;
      }
    }
  }

  console.log("ProtectedRoute: rendering children normally");
  return <>{children}</>;
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          {/* «Entrar con mi cuenta del CRM» desde nextcar.erewere.com. */}
          <Route path="/conectar-pagina" element={<ConectarPagina />} />
          <Route path="/print/vehicle/:id" element={<ProtectedRoute requireRole={['admin', 'seller', 'taller']}><VehiclePrint /></ProtectedRoute>} />
          
          <Route path="/" element={<ProtectedRoute><ChatsPendientesProvider><Layout /></ChatsPendientesProvider></ProtectedRoute>}>
            <Route index element={<Inicio />} />
            {/* Inteligencia se integro al tablero del Dashboard (sep 2026). */}
            <Route path="intelligence" element={<Navigate to="/" replace />} />
            <Route path="platform" element={<ProtectedRoute requireRole={['master']}><PlatformPanel /></ProtectedRoute>} />
            <Route path="inventory" element={<ProtectedRoute requireRole={['admin', 'seller', 'taller']}><Inventory /></ProtectedRoute>} />
            <Route path="kanban" element={<ProtectedRoute requireRole={['admin', 'seller']}><Kanban /></ProtectedRoute>} />
            <Route path="persons" element={<ProtectedRoute requireRole={['admin', 'seller']}><Persons /></ProtectedRoute>} />
            <Route path="tasks" element={<ProtectedRoute requireRole={['admin', 'seller']}><Tasks /></ProtectedRoute>} />
            {/* El vendedor contesta sus WhatsApp aqui. El menu ya le mostraba Chats,
                pero esta puerta lo regresaba al inicio: nunca pudo entrar. */}
            <Route path="chats" element={<ProtectedRoute requireRole={['master', 'admin', 'seller']}><Chats /></ProtectedRoute>} />
            <Route path="users" element={<ProtectedRoute requireRole={['master', 'admin']}><AgencyUsers /></ProtectedRoute>} />
            <Route path="billing" element={<ProtectedRoute requireRole={['admin']}><Billing /></ProtectedRoute>} />
            <Route path="integrations" element={<ProtectedRoute requireRole={['master', 'admin']}><Integrations /></ProtectedRoute>} />
            <Route path="closed-sales" element={<ProtectedRoute requireRole={['admin', 'seller']}><ClosedSales /></ProtectedRoute>} />
            <Route path="payments" element={<ProtectedRoute requireRole={['admin']}><PaymentInventory /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
