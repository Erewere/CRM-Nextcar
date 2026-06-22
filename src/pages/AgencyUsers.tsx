import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { collection, doc, updateDoc, setDoc, query, where, getDocs } from 'firebase/firestore';
import { Users, Shield, Building, Mail, CheckCircle, Plus } from 'lucide-react';

export function AgencyUsers() {
  const { userData } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [agencies, setAgencies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newAgencyName, setNewAgencyName] = useState('');
  
  useEffect(() => {
    if (!userData) return;
    
    const fetchData = async () => {
      try {
        setLoading(true);
        if (userData.role === 'master' || userData.id === 'vxFIfZ5bdQSzaekW5d5c1TbNVCO2') {
          // Master gets all users and all agencies
          const usersSnap = await getDocs(collection(db, 'users'));
          const agenciesSnap = await getDocs(collection(db, 'agencies'));
          
          setUsers(usersSnap.docs.map(d => ({ id: d.id, ...d.data() })));
          setAgencies(agenciesSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        } else if (userData.role === 'admin') {
          // Admin gets users in their agency
          const snap = await getDocs(query(collection(db, 'users'), where('agencyId', '==', userData.agencyId)));
          setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        }
      } catch (e) {
        console.error("Error fetching data:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [userData]);

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
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch (e) {
      console.error(e);
      alert('Error updating role. Check permissions.');
    }
  };

  const handleUpdateAgency = async (userId: string, newAgencyId: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), { agencyId: newAgencyId });
      setUsers(users.map(u => u.id === userId ? { ...u, agencyId: newAgencyId } : u));
    } catch (e) {
      console.error(e);
      alert('Error updating agency. Check permissions.');
    }
  };

  if (loading) return <div className="p-8">Cargando...</div>;

  const isMaster = userData?.role === 'master' || userData?.id === 'vxFIfZ5bdQSzaekW5d5c1TbNVCO2';

  return (
    <div className="max-w-6xl mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-600" />
            Gestión de Usuarios
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {isMaster ? 'Administra todos los usuarios y sus agencias' : 'Administra los roles de los usuarios en tu agencia'}
          </p>
        </div>
      </div>

      {isMaster && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row items-end gap-4">
          <div className="flex-1 w-full">
            <label className="block text-sm font-semibold text-slate-700 mb-1">Nueva Agencia</label>
            <input
              type="text"
              value={newAgencyName}
              onChange={(e) => setNewAgencyName(e.target.value)}
              placeholder="Nombre de la nueva agencia..."
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700"
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
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <ul className="divide-y divide-slate-100">
          {users.map(u => (
            <li key={u.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <div className="font-bold text-slate-800">{u.name || 'Sin Nombre'}</div>
                  {u.role === 'master' && <span className="inline-flex items-center rounded-md bg-stone-100 px-2 py-1 text-[10px] font-medium text-stone-600 ring-1 ring-inset ring-stone-500/10"><Shield className="w-3 h-3 mr-1"/> Master</span>}
                  {u.role === 'admin' && <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-[10px] font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">Admin</span>}
                  {u.role === 'unassigned' && <span className="inline-flex items-center rounded-md bg-orange-50 px-2 py-1 text-[10px] font-medium text-orange-700 ring-1 ring-inset ring-orange-600/10">Pendiente</span>}
                </div>
                <div className="text-sm text-slate-500 mt-1 flex items-center gap-1">
                  <Mail className="w-3 h-3" />
                  {u.email}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                {isMaster && (
                  <div className="w-full sm:w-auto">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Agencia</label>
                    <select
                      value={u.agencyId || 'unassigned'}
                      onChange={(e) => handleUpdateAgency(u.id, e.target.value)}
                      className="text-sm border border-slate-300 rounded-md py-1.5 px-3 bg-white w-full sm:w-48 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="unassigned">-- Sin Asignar --</option>
                      {agencies.map(a => (
                        <option value={a.id} key={a.id}>{a.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                
                <div className="w-full sm:w-auto">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Rol</label>
                  <select
                    value={u.role || 'unassigned'}
                    onChange={(e) => handleUpdateRole(u.id, e.target.value)}
                    className="text-sm border border-slate-300 rounded-md py-1.5 px-3 bg-white w-full sm:w-32 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    disabled={(!isMaster && u.role === 'master')}
                  >
                    {isMaster && <option value="master">Master</option>}
                    <option value="admin">Administrador</option>
                    <option value="seller">Vendedor</option>
                    <option value="unassigned">Desasignado</option>
                  </select>
                </div>
              </div>
            </li>
          ))}
          {users.length === 0 && (
            <li className="p-8 text-center text-slate-500">
              No se encontraron usuarios
            </li>
          )}
        </ul>
      </div>

    </div>
  );
}
