import React, { useEffect, useState, useMemo } from 'react';
import { collection, getDocs, doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { User, ClientFile, Agency, Client, Task } from '../types';
import { Shield, FileText, Calendar, Mail, FileUp, X, ExternalLink, Plus, Building, Users, Activity, CheckCircle, ChevronDown, ChevronRight, Briefcase } from 'lucide-react';
import { format } from 'date-fns';
import clsx from 'clsx';

const safeDate = (val: any) => {
  if (!val) return new Date();
  if (typeof val.toDate === 'function') return val.toDate();
  if (val.seconds) return new Date(val.seconds * 1000);
  const d = new Date(val);
  return isNaN(d.getTime()) ? new Date() : d;
};

interface UserStats extends User {
  filesCount: number;
  clientsCount: number;
  tasksCount: number;
  isActive: boolean;
}

interface AgencyStats extends Agency {
  users: UserStats[];
  activeUsersCount: number;
  totalUsersCount: number;
}

export function MasterDashboard() {
  const [users, setUsers] = useState<UserStats[]>([]);
  const [agenciesStats, setAgenciesStats] = useState<AgencyStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserStats | null>(null);
  const [userFiles, setUserFiles] = useState<ClientFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [allFiles, setAllFiles] = useState<ClientFile[]>([]);
  const [newAgencyName, setNewAgencyName] = useState('');
  const [expandedAgencies, setExpandedAgencies] = useState<Record<string, boolean>>({});

  const fetchUsersAndFiles = async () => {
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      const filesSnap = await getDocs(collection(db, 'files'));
      const agenciesSnap = await getDocs(collection(db, 'agencies'));
      const clientsSnap = await getDocs(collection(db, 'clients'));
      const tasksSnap = await getDocs(collection(db, 'tasks'));
      
      const filesData = filesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClientFile));
      const clientsData = clientsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
      const tasksData = tasksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
      
      setAllFiles(filesData);
      
      const agenciesData = agenciesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Agency));
      
      const userData = usersSnap.docs.map(doc => {
        const u = { id: doc.id, ...doc.data() } as User;
        const fCount = filesData.filter(f => f.userId === u.id).length;
        const cCount = clientsData.filter(c => c.sellerId === u.id).length;
        const tCount = tasksData.filter(t => t.sellerId === u.id).length;
        const isActive = fCount > 0 || cCount > 0 || tCount > 0;
        return { ...u, filesCount: fCount, clientsCount: cCount, tasksCount: tCount, isActive };
      });
      
      setUsers(userData);
      
      const aStats: AgencyStats[] = agenciesData.map(a => {
        const aUsers = userData.filter(u => u.agencyId === a.id);
        const aUsersActive = aUsers.filter(u => u.isActive).length;
        return {
          ...a,
          users: aUsers,
          totalUsersCount: aUsers.length,
          activeUsersCount: aUsersActive
        };
      });
      
      const unassignedUsers = userData.filter(u => !u.agencyId || u.agencyId === 'unassigned');
      if (unassignedUsers.length > 0) {
        aStats.push({
          id: 'unassigned',
          name: 'Usuarios Sin Agencia',
          createdAt: new Date(),
          users: unassignedUsers,
          totalUsersCount: unassignedUsers.length,
          activeUsersCount: unassignedUsers.filter(u => u.isActive).length
        });
      }
      
      setAgenciesStats(aStats);
    } catch (e) {
      console.error("Error fetching master data", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsersAndFiles();
  }, []);

  const handleCreateAgency = async () => {
    if (!newAgencyName.trim()) return;
    try {
      const newAgencyRef = doc(collection(db, 'agencies'));
      const agencyData = { name: newAgencyName, createdAt: new Date().toISOString() };
      await setDoc(newAgencyRef, agencyData);
      fetchUsersAndFiles(); // Refresh
      setNewAgencyName('');
      alert('Agencia creada exitosamente.');
    } catch (e) {
      console.error(e);
      alert('Error al crear agencia.');
    }
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole });
      fetchUsersAndFiles();
    } catch (e) {
      console.error(e);
      alert('Error al actualizar rol');
    }
  };

  const handleUpdateAgency = async (userId: string, newAgencyId: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), { agencyId: newAgencyId });
      fetchUsersAndFiles();
    } catch (e) {
      console.error(e);
      alert('Error al actualizar agencia');
    }
  };

  const handleUserClick = (u: UserStats) => {
    setSelectedUser(u);
    setLoadingFiles(true);
    const uFiles = allFiles.filter(f => f.userId === u.id);
    setUserFiles(uFiles);
    setLoadingFiles(false);
  };

  const toggleAgency = (agencyId: string) => {
    setExpandedAgencies(prev => ({
      ...prev,
      [agencyId]: !prev[agencyId]
    }));
  };

  if (loading) return <div>Cargando panel maestro...</div>;

  const totalAgencies = agenciesStats.filter(a => a.id !== 'unassigned').length;
  const totalUsers = users.length;
  const totalActiveUsers = users.filter(u => u.isActive).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-200 tracking-tight">Dashboard General</h1>
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
          <Shield className="w-3 h-3" />
          Cuenta Maestra
        </span>
      </div>
      <div>
        <p className="text-sm text-slate-500 dark:text-slate-400">Estadísticas y gestión global del sistema Nextcar CRM.</p>
      </div>

      {/* Global Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 flex flex-col justify-center">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Building className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-slate-500 dark:text-slate-400 font-medium">Agencias Registradas</h3>
          </div>
          <p className="text-3xl font-bold text-slate-800 dark:text-slate-100">{totalAgencies}</p>
        </div>
        
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 flex flex-col justify-center">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
              <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h3 className="text-slate-500 dark:text-slate-400 font-medium">Usuarios Totales</h3>
          </div>
          <p className="text-3xl font-bold text-slate-800 dark:text-slate-100">{totalUsers}</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 flex flex-col justify-center">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <Activity className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-slate-500 dark:text-slate-400 font-medium">Usuarios Activos (Usando CRM)</h3>
          </div>
          <div className="flex items-end gap-2">
            <p className="text-3xl font-bold text-slate-800 dark:text-slate-100">{totalActiveUsers}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
              ({totalUsers > 0 ? Math.round((totalActiveUsers / totalUsers) * 100) : 0}% del total)
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 flex flex-col md:flex-row items-end gap-4">
        <div className="flex-1 w-full">
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Nueva Agencia</label>
          <input
            type="text"
            value={newAgencyName}
            onChange={(e) => setNewAgencyName(e.target.value)}
            placeholder="Nombre de la nueva agencia..."
            className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300"
          />
        </div>
        <button
          onClick={handleCreateAgency}
          disabled={!newAgencyName.trim()}
          className="w-full md:w-auto px-6 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Crear Agencia
        </button>
      </div>

      {/* Agencies and Users List */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Agencias y Usuarios</h2>
        
        {agenciesStats.map((agency) => {
          const isExpanded = expandedAgencies[agency.id] || false;
          
          return (
            <div key={agency.id} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div 
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors"
                onClick={() => toggleAgency(agency.id)}
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-slate-100 dark:bg-slate-900 rounded-lg">
                    <Building className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 dark:text-slate-200 text-lg">{agency.name}</h3>
                    <div className="flex items-center gap-4 mt-1 text-sm text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1"><Users className="w-4 h-4"/> {agency.totalUsersCount} usuarios</span>
                      <span className="flex items-center gap-1 text-green-600 dark:text-green-400"><Activity className="w-4 h-4"/> {agency.activeUsersCount} activos</span>
                    </div>
                  </div>
                </div>
                <div className="p-2 text-slate-400">
                  {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                </div>
              </div>
              
              {isExpanded && (
                <div className="border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-4">
                  {agency.users.length === 0 ? (
                    <p className="text-center text-slate-500 dark:text-slate-400 py-4">No hay usuarios asignados a esta agencia.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                          <tr>
                            <th className="pb-3 font-medium">Usuario</th>
                            <th className="pb-3 font-medium">Rol</th>
                            <th className="pb-3 font-medium">Estadísticas de CRM</th>
                            <th className="pb-3 font-medium text-right">Archivos</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700/50">
                          {agency.users.map(u => (
                            <tr key={u.id}>
                              <td className="py-3 pr-4">
                                <div className="flex items-center gap-2">
                                  {u.isActive ? (
                                    <div className="w-2 h-2 rounded-full bg-green-500" title="Usuario activo" />
                                  ) : (
                                    <div className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600" title="Usuario inactivo" />
                                  )}
                                  <div>
                                    <div className="font-medium text-slate-900 dark:text-slate-100">{u.name || 'Sin Nombre'}</div>
                                    <div className="text-slate-500 dark:text-slate-400 flex items-center gap-1 text-xs mt-0.5"><Mail className="w-3 h-3"/> {u.email}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 pr-4">
                                <select
                                  value={u.role || 'unassigned'}
                                  onChange={(e) => handleUpdateRole(u.id, e.target.value)}
                                  className="text-xs border border-slate-300 dark:border-slate-600 rounded py-1 px-2 bg-white dark:bg-slate-800 w-full max-w-[140px] focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                  disabled={u.email === 'luisfj@gmail.com'}
                                >
                                  {u.email === 'luisfj@gmail.com' && <option value="master">Master</option>}
                                  <option value="admin">Administrador</option>
                                  <option value="seller">Vendedor</option>
                                  <option value="unassigned">Desasignado</option>
                                </select>
                                <div className="mt-2">
                                  <select
                                    value={u.agencyId || 'unassigned'}
                                    onChange={(e) => handleUpdateAgency(u.id, e.target.value)}
                                    className="text-xs border border-slate-300 dark:border-slate-600 rounded py-1 px-2 bg-white dark:bg-slate-800 w-full max-w-[140px] focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                  >
                                    <option value="unassigned">-- Sin Agencia --</option>
                                    {agenciesStats.filter(a => a.id !== 'unassigned').map(a => (
                                      <option value={a.id} key={a.id}>{a.name}</option>
                                    ))}
                                  </select>
                                </div>
                              </td>
                              <td className="py-3 pr-4">
                                <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
                                  <div className="flex items-center gap-1" title="Clientes Registrados">
                                    <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                                    {u.clientsCount}
                                  </div>
                                  <div className="flex items-center gap-1" title="Tareas Creadas">
                                    <CheckCircle className="w-3.5 h-3.5 text-slate-400" />
                                    {u.tasksCount}
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 text-right">
                                <button 
                                  onClick={() => handleUserClick(u)}
                                  className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 dark:text-indigo-400 px-2.5 py-1.5 rounded transition-colors"
                                >
                                  <FileUp className="w-3.5 h-3.5" />
                                  Ver ({u.filesCount})
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {selectedUser && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
         <div className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[80vh] overflow-hidden">
           <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900">
             <div>
               <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100">Archivos de Usuario</h2>
               <p className="text-sm text-slate-500 dark:text-slate-400">{selectedUser.name} ({selectedUser.email})</p>
             </div>
             <button onClick={() => setSelectedUser(null)} className="text-gray-400 hover:text-black">
               <X className="w-6 h-6" />
             </button>
           </div>
           <div className="flex-1 overflow-y-auto p-6 space-y-4">
             {userFiles.length === 0 ? (
               <div className="text-center py-8 text-slate-500 dark:text-slate-400 flex flex-col items-center">
                  <FileText className="w-8 h-8 text-slate-300 mb-2" />
                  Este usuario no ha subido ningún archivo.
               </div>
             ) : (
               <div className="space-y-3">
                 {userFiles.map(f => (
                   <div key={f.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-700 gap-3">
                     <div className="flex items-center gap-3 overflow-hidden">
                       <FileText className="w-5 h-5 text-indigo-500 flex-shrink-0" />
                       <div className="truncate">
                         <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{f.filename}</p>
                         <p className="text-xs text-slate-500 dark:text-slate-400">{f.uploadedAt ? format(safeDate(f.uploadedAt), 'dd/MM/yyyy HH:mm') : 'N/A'}</p>
                       </div>
                     </div>
                     <a href={f.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-800 shrink-0">
                       <ExternalLink className="w-4 h-4"/>
                       Abrir
                     </a>
                   </div>
                 ))}
               </div>
             )}
           </div>
           <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex justify-end">
             <button onClick={() => setSelectedUser(null)} className="px-5 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-black bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm">Cerrar</button>
           </div>
         </div>
       </div>
      )}
    </div>
  );
}
