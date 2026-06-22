import React, { useEffect, useState } from 'react';
import { collection, getDocs, doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { User, ClientFile } from '../types';
import { Shield, FileText, Calendar, Mail, FileUp, X, ExternalLink, Plus } from 'lucide-react';
import { format } from 'date-fns';

const safeDate = (val: any) => {
  if (!val) return new Date();
  if (typeof val.toDate === 'function') return val.toDate();
  if (val.seconds) return new Date(val.seconds * 1000);
  return new Date(val);
};

export function MasterDashboard() {
  const [users, setUsers] = useState<(User & { filesCount: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userFiles, setUserFiles] = useState<ClientFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [allFiles, setAllFiles] = useState<ClientFile[]>([]);
  const [agencies, setAgencies] = useState<{ id: string, name: string }[]>([]);
  const [newAgencyName, setNewAgencyName] = useState('');

  const fetchUsersAndFiles = async () => {
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      const filesSnap = await getDocs(collection(db, 'files'));
      const agenciesSnap = await getDocs(collection(db, 'agencies'));
      
      const filesData = filesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClientFile));
      setAllFiles(filesData);

      const agenciesData = agenciesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as { id: string, name: string }));
      setAgencies(agenciesData);

      const userData = usersSnap.docs.map(doc => {
        const u = { id: doc.id, ...doc.data() } as User;
        const fCount = filesData.filter(f => f.userId === u.id).length;
        return { ...u, filesCount: fCount };
      });
      
      setUsers(userData);
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
      setAgencies([...agencies, { id: newAgencyRef.id, ...agencyData }]);
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
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole as any } : u));
    } catch (e) {
      console.error(e);
      alert('Error al actualizar rol');
    }
  };

  const handleUpdateAgency = async (userId: string, newAgencyId: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), { agencyId: newAgencyId });
      setUsers(users.map(u => u.id === userId ? { ...u, agencyId: newAgencyId } : u));
    } catch (e) {
      console.error(e);
      alert('Error al actualizar agencia');
    }
  };


  const handleUserClick = (u: User) => {
    setSelectedUser(u);
    setLoadingFiles(true);
    // filter from allFiles
    const uFiles = allFiles.filter(f => f.userId === u.id);
    setUserFiles(uFiles);
    setLoadingFiles(false);
  };

  if (loading) return <div>Cargando panel maestro...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold text-slate-800 tracking-tight">Dashboard General</h1>
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">
          <Shield className="w-3 h-3" />
          Cuenta Maestra
        </span>
      </div>
      <div>
        <p className="text-sm text-slate-500">Vista global del sistema.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row items-end gap-4">
        <div className="flex-1 w-full">
          <label className="block text-sm font-semibold text-slate-700 mb-1">Nueva Agencia</label>
          <input
            type="text"
            value={newAgencyName}
            onChange={(e) => setNewAgencyName(e.target.value)}
            placeholder="Nombre de la nueva agencia..."
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700"
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

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-6 py-4 font-medium">Usuario</th>
                <th className="px-6 py-4 font-medium min-w-[200px]">Rol</th>
                <th className="px-6 py-4 font-medium min-w-[200px]">Agencia</th>
                <th className="px-6 py-4 font-medium">Archivos Subidos</th>
                <th className="px-6 py-4 font-medium text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">{u.name || 'Sin Nombre'}</div>
                    <div className="text-slate-500 flex items-center gap-1 mt-0.5"><Mail className="w-3 h-3"/> {u.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <select
                      value={u.role || 'unassigned'}
                      onChange={(e) => handleUpdateRole(u.id, e.target.value)}
                      className="text-sm border border-slate-300 rounded-md py-1.5 px-3 bg-white w-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      disabled={u.role === 'master'}
                    >
                      <option value="master">Master</option>
                      <option value="admin">Administrador</option>
                      <option value="seller">Vendedor</option>
                      <option value="unassigned">Desasignado</option>
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    <select
                      value={u.agencyId || 'unassigned'}
                      onChange={(e) => handleUpdateAgency(u.id, e.target.value)}
                      className="text-sm border border-slate-300 rounded-md py-1.5 px-3 bg-white w-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="unassigned">-- Sin Asignar --</option>
                      {agencies.map(a => (
                        <option value={a.id} key={a.id}>{a.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1 font-medium text-slate-700">
                      <FileUp className="w-4 h-4 text-slate-400"/>
                      {u.filesCount}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => handleUserClick(u)}
                      className="text-indigo-600 hover:text-indigo-900 font-medium text-sm"
                    >
                      Ver Archivos
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">No hay usuarios en el sistema.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedUser && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
         <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[80vh] overflow-hidden">
           <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-50">
             <div>
               <h2 className="text-xl font-bold text-gray-900">Archivos de Usuario</h2>
               <p className="text-sm text-slate-500">{selectedUser.name} ({selectedUser.email})</p>
             </div>
             <button onClick={() => setSelectedUser(null)} className="text-gray-400 hover:text-black">
               <X className="w-6 h-6" />
             </button>
           </div>
           <div className="flex-1 overflow-y-auto p-6 space-y-4">
             {userFiles.length === 0 ? (
               <div className="text-center py-8 text-slate-500 flex flex-col items-center">
                  <FileText className="w-8 h-8 text-slate-300 mb-2" />
                  Este usuario no ha subido ningún archivo.
               </div>
             ) : (
               <div className="space-y-3">
                 {userFiles.map(f => (
                   <div key={f.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100 gap-3">
                     <div className="flex items-center gap-3 overflow-hidden">
                       <FileText className="w-5 h-5 text-indigo-500 flex-shrink-0" />
                       <div className="truncate">
                         <p className="text-sm font-medium text-slate-900 truncate">{f.filename}</p>
                         <p className="text-xs text-slate-500">{f.uploadedAt ? format(safeDate(f.uploadedAt), 'dd/MM/yyyy HH:mm') : 'N/A'}</p>
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
           <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
             <button onClick={() => setSelectedUser(null)} className="px-5 py-2 text-sm font-medium text-slate-600 hover:text-black bg-white border border-slate-200 rounded-lg shadow-sm">Cerrar</button>
           </div>
         </div>
       </div>
      )}
    </div>
  );
}
