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

const ProtectedRoute = ({ children, requireRole }: { children: React.ReactNode, requireRole?: ('master' | 'admin' | 'seller')[] }) => {
  const { currentUser, userData, loading } = useAuth();

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#E4002B]"></div></div>;
  if (!currentUser) return <Navigate to="/login" replace />;
  if (!userData) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#E4002B]"></div></div>;
  
  if (requireRole) {
    const isSpecialMaster = userData.id === 'vxFIfZ5bdQSzaekW5d5c1TbNVCO2';
    if (!requireRole.includes(userData.role as any) && !(isSpecialMaster && requireRole.includes('master'))) {
      return <Navigate to="/" replace />;
    }
  }

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
            <Route path="inventory" element={<ProtectedRoute requireRole={['master', 'admin', 'seller']}><Inventory /></ProtectedRoute>} />
            <Route path="kanban" element={<ProtectedRoute requireRole={['admin', 'seller']}><Kanban /></ProtectedRoute>} />
            <Route path="persons" element={<ProtectedRoute requireRole={['admin', 'seller', 'master']}><Persons /></ProtectedRoute>} />
            <Route path="tasks" element={<ProtectedRoute requireRole={['admin', 'seller']}><Tasks /></ProtectedRoute>} />
            <Route path="emails" element={<ProtectedRoute requireRole={['admin', 'seller', 'master']}><Emails /></ProtectedRoute>} />
            <Route path="users" element={<ProtectedRoute requireRole={['master', 'admin']}><AgencyUsers /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
