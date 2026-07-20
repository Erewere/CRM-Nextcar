import React from 'react';
import { BrowserRouter, Route, Routes, Navigate } from 'react-router';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Kanban } from './pages/Kanban';
import { Tasks } from './pages/Tasks';
import { Persons } from './pages/Persons';
import { AgencyUsers } from './pages/AgencyUsers';
import { Inventory } from './pages/Inventory';
import { Emails } from './pages/Emails';
import { VehiclePrint } from './pages/VehiclePrint';
import { Billing } from './pages/Billing';
import { Chats } from './pages/Chats';
import { auth } from './lib/firebase';
import { signOut } from 'firebase/auth';

import { Integrations } from './pages/Integrations';
import { IntelligenceDashboard } from './pages/IntelligenceDashboard';
import { ClosedSales } from './pages/ClosedSales';

const safeDate = (val: any) => {
  if (!val) return new Date();
  if (typeof val.toDate === 'function') return val.toDate();
  if (val.seconds) return new Date(val.seconds * 1000);
  const d = new Date(val);
  return isNaN(d.getTime()) ? new Date() : d;
};

const ProtectedRoute = ({ children, requireRole }: { children: React.ReactNode, requireRole?: ('master' | 'admin' | 'seller')[] }) => {
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
    return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#E4002B]"></div></div>;
  }
  if (!currentUser) {
    console.log("ProtectedRoute: no currentUser, redirecting to /login");
    return <Navigate to="/login" replace />;
  }
  if (!userData) {
    console.log("ProtectedRoute: no userData, rendering spinner");
    return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#E4002B]"></div></div>;
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
    let hasActiveSubscription = agencyData?.hasFreeAccess || agencyData?.subscriptionStatus === 'active';
    
    if (agencyData?.subscriptionStatus === 'trialing') {
      let trialEnds;
      if (agencyData.createdAt) {
        const createdDate = safeDate(agencyData.createdAt);
        trialEnds = new Date(createdDate.getTime() + 30 * 24 * 60 * 60 * 1000);
      } else if (agencyData.trialEndsAt) {
        trialEnds = safeDate(agencyData.trialEndsAt);
      }

      if (trialEnds && trialEnds > new Date()) {
        hasActiveSubscription = true;
      }
    }
    
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
          <Route path="/print/vehicle/:id" element={<ProtectedRoute requireRole={['master', 'admin', 'seller']}><VehiclePrint /></ProtectedRoute>} />
          
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="intelligence" element={<ProtectedRoute requireRole={['master', 'admin']}><IntelligenceDashboard /></ProtectedRoute>} />
            <Route path="inventory" element={<ProtectedRoute requireRole={['master', 'admin', 'seller']}><Inventory /></ProtectedRoute>} />
            <Route path="kanban" element={<ProtectedRoute requireRole={['admin', 'seller']}><Kanban /></ProtectedRoute>} />
            <Route path="persons" element={<ProtectedRoute requireRole={['admin', 'seller', 'master']}><Persons /></ProtectedRoute>} />
            <Route path="tasks" element={<ProtectedRoute requireRole={['admin', 'seller']}><Tasks /></ProtectedRoute>} />
            <Route path="emails" element={<ProtectedRoute requireRole={['admin', 'seller', 'master']}><Emails /></ProtectedRoute>} />
            <Route path="chats" element={<ProtectedRoute requireRole={['master', 'admin', 'seller']}><Chats /></ProtectedRoute>} />
            <Route path="users" element={<ProtectedRoute requireRole={['master', 'admin']}><AgencyUsers /></ProtectedRoute>} />
            <Route path="billing" element={<ProtectedRoute requireRole={['master', 'admin']}><Billing /></ProtectedRoute>} />
            <Route path="integrations" element={<ProtectedRoute requireRole={['master', 'admin']}><Integrations /></ProtectedRoute>} />
            <Route path="closed-sales" element={<ProtectedRoute requireRole={['master', 'admin', 'seller']}><ClosedSales /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
