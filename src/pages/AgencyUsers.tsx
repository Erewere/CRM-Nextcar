import { getAuth } from "firebase/auth";
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { collection, doc, updateDoc, setDoc, query, where, getDocs, deleteDoc, getDoc } from 'firebase/firestore';
import { Users, Calendar, Shield, Building, Mail, CheckCircle, Plus, Send, Tag, X, Clock, Trash2 } from 'lucide-react';
import { Task, Client } from '../types';
import { deduplicateClients } from '../lib/clientUtils';
import firebaseConfig from '../../firebase-applet-config.json';

export function AgencyUsers() {
  const navigate = useNavigate();
  const { userData } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [agencies, setAgencies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newAgencyName, setNewAgencyName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteTargetAgencyId, setInviteTargetAgencyId] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteSuccessMsg, setInviteSuccessMsg] = useState('');
  
  const [agencyTags, setAgencyTags] = useState<{ id: string; name: string }[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [loadingTags, setLoadingTags] = useState(false);
  
  const [inactivityAlertDays, setInactivityAlertDays] = useState(14);
  const [savingInactivity, setSavingInactivity] = useState(false);
  const [businessStart, setBusinessStart] = useState('08:00');
  const [businessEnd, setBusinessEnd] = useState('21:00');
  const [savingHours, setSavingHours] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  
  useEffect(() => {
    if (!userData) return;
    
    const fetchTags = async () => {
      const targetAgencyId = userData.agencyId || 'master_agency';
      try {
        const q = query(collection(db, 'agency_tags'), where('agencyId', '==', targetAgencyId));
        const snap = await getDocs(q);
        if (snap.empty) {
          const defaults = ['Venta', 'Compra', 'Busca de auto', 'Crédito'];
          const created = [];
          for (const def of defaults) {
            const newRef = doc(collection(db, 'agency_tags'));
            await setDoc(newRef, {
              id: newRef.id,
              name: def,
              agencyId: targetAgencyId,
              createdAt: new Date().toISOString()
            });
            created.push({ id: newRef.id, name: def });
          }
          setAgencyTags(created);
        } else {
          setAgencyTags(snap.docs.map(d => ({ id: d.id, name: d.data().name })));
        }
      } catch (err) {
        console.error("Error loading tags:", err);
      }
    };

    fetchTags();
  }, [userData]);

  const handleAddTag = async () => {
    if (!newTagInput.trim() || !userData) return;
    const targetAgencyId = userData.agencyId || 'master_agency';
    setLoadingTags(true);
    try {
      const newRef = doc(collection(db, 'agency_tags'));
      const newTagName = newTagInput.trim();
      await setDoc(newRef, {
        id: newRef.id,
        name: newTagName,
        agencyId: targetAgencyId,
        createdAt: new Date().toISOString()
      });
      setAgencyTags(prev => [...prev, { id: newRef.id, name: newTagName }]);
      setNewTagInput('');
    } catch (err) {
      console.error(err);
      alert("Error al guardar etiqueta");
    } finally {
      setLoadingTags(false);
    }
  };

  const handleDeleteTag = async (tagId: string) => {
    try {
      await deleteDoc(doc(db, 'agency_tags', tagId));
      setAgencyTags(prev => prev.filter(t => t.id !== tagId));
    } catch (err) {
      console.error(err);
      alert("Error al eliminar etiqueta");
    }
  };
  
  useEffect(() => {
    if (!userData) return;
    
    const fetchData = async () => {
      try {
        setLoading(true);
        if (userData.role === 'master') {
          // Master gets all users and all agencies
          const usersSnap = await getDocs(collection(db, 'users'));
          const agenciesSnap = await getDocs(collection(db, 'agencies'));
          
          setUsers(usersSnap.docs.map(d => ({ ...d.data(), id: d.id })));
          setAgencies(agenciesSnap.docs.map(d => ({ ...d.data(), id: d.id })));
        } else if (userData.role === 'admin') {
          // Admin gets users in their agency
          const snap = await getDocs(query(collection(db, 'users'), where('agencyId', '==', userData.agencyId)));
          setUsers(snap.docs.map(d => ({ ...d.data(), id: d.id })));
        }

        // Load inactivity alerts data
        if (userData.agencyId && userData.agencyId !== 'unassigned') {
          const agencySnap = await getDoc(doc(db, 'agencies', userData.agencyId));
          if (agencySnap.exists()) {
            const agencyData = agencySnap.data();
            if (agencyData.inactivityAlertDays) {
              setInactivityAlertDays(agencyData.inactivityAlertDays);
            }
            if (agencyData.businessHours) {
              setBusinessStart(agencyData.businessHours.start || '08:00');
              setBusinessEnd(agencyData.businessHours.end || '21:00');
            }
          }
          const clientsQ = query(collection(db, 'clients'), where('agencyId', '==', userData.agencyId));
          const tasksQ = query(collection(db, 'tasks'), where('agencyId', '==', userData.agencyId));
          
          const [clientsSnap, tasksSnap] = await Promise.all([
            getDocs(clientsQ),
            getDocs(tasksQ)
          ]);
          const rawClients = clientsSnap.docs.map(d => ({ ...d.data(), id: d.id } as Client));
          setClients(deduplicateClients(rawClients));
          setTasks(tasksSnap.docs.map(d => ({ ...d.data(), id: d.id } as Task)));
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
      
      // Copy current tags to the new agency
      for (const tag of agencyTags) {
        const newTagRef = doc(collection(db, 'agency_tags'));
        await setDoc(newTagRef, {
          id: newTagRef.id,
          name: tag.name,
          agencyId: newAgencyRef.id,
          createdAt: new Date().toISOString()
        });
      }

      setAgencies([...agencies, { id: newAgencyRef.id, ...agencyData }]);
      setNewAgencyName('');
      alert('Agencia creada exitosamente con las etiquetas actuales.');
    } catch (e) {
      console.error(e);
      alert('Error al crear agencia.');
    }
  };

  const handleToggleFreeAccess = async (agencyId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'agencies', agencyId), { hasFreeAccess: !currentStatus });
      setAgencies(agencies.map(a => a.id === agencyId ? { ...a, hasFreeAccess: !currentStatus } : a));
    } catch (e) {
      console.error(e);
      alert('Error updating agency free access.');
    }
  };

  const handleUpdateRole = async (userId: string, newRole: string, currentName: string, email: string) => {
    try {
      const updates: any = { role: newRole };
      let newName = currentName;
      
      // If the user was assigned a role but their name still says pending, update it to their email prefix
      if (newRole !== 'unassigned' && currentName === 'Usuario Pendiente') {
        newName = email.split('@')[0];
        updates.name = newName;
      }

      await updateDoc(doc(db, 'users', userId), updates);
      setUsers(users.map(u => u.id === userId ? { ...u, ...updates } : u));
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

  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState('seller');
  const [createdUserPassword, setCreatedUserPassword] = useState('');

  const handleCreateUser = async () => {
    if (!inviteEmail.trim() || !inviteEmail.includes('@')) {
        alert('Por favor, ingresa un correo electrónico válido.');
        return;
    }
    if (!inviteName.trim()) {
        alert('Por favor, ingresa un nombre para el usuario.');
        return;
    }
    
    setInviting(true);
    setCreatedUserPassword('');
    try {
        const targetAgencyId = inviteTargetAgencyId || userData?.agencyId;
        const tempPassword = Math.random().toString(36).slice(-8) + 'Aa1!'; // Generate a random password

        // Use Firebase Auth REST API directly to avoid signing out the current admin
        const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseConfig.apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: inviteEmail.trim(),
                password: tempPassword,
                returnSecureToken: true
            })
        });

        const data = await res.json();

        if (!res.ok) {
            const errorMsg = data.error?.message || 'Error al crear el usuario en Auth';
            throw new Error(errorMsg);
        }
        
        const newUserId = data.localId;

        // Save user data to Firestore
        await setDoc(doc(db, 'users', newUserId), {
            email: inviteEmail.trim(),
            name: inviteName.trim(),
            role: inviteRole,
            agencyId: targetAgencyId,
            createdAt: new Date().toISOString()
        });

        // Add the new user to the local list
        setUsers(prev => [...prev, {
            id: newUserId,
            email: data.email,
            name: inviteName.trim(),
            role: inviteRole,
            agencyId: targetAgencyId,
            createdAt: new Date().toISOString()
        }]);

        setInviteSuccessMsg(`¡Usuario creado con éxito!`);
        setCreatedUserPassword(tempPassword);
        setInviteEmail('');
        setInviteName('');
    } catch (e: any) {
        console.error(e);
        alert('Error al crear usuario. ' + (e.message || ''));
    } finally {
        setInviting(false);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (userData?.role !== 'admin' && userData?.role !== 'master') return;
    if (userId === userData?.id) {
        console.warn("No puedes eliminar tu propia cuenta.");
        return;
    }

    try {
        const auth = getAuth();
        const token = await auth.currentUser?.getIdToken();
        const res = await fetch('/api/delete-user', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ uid: userId })
        });
        
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Error al eliminar usuario');
        }

        setUsers(prev => prev.filter(u => u.id !== userId));
        alert('Usuario eliminado correctamente.');
    } catch (e: any) {
        console.error("Error deleting user:", e);
        alert('Error al eliminar usuario: ' + e.message);
    }
  };

  const inactivityThresholdMs = inactivityAlertDays * 24 * 60 * 60 * 1000;
  const inactiveAlerts = useMemo(() => {
    const alerts: { task: Task, client: Client | null }[] = [];
    const nowMs = Date.now();
    tasks.forEach(task => {
      if (!task.completed && task.dueDate) {
        const taskDate = new Date(task.dueDate).getTime();
        if (nowMs - taskDate > inactivityThresholdMs) {
          alerts.push({
            task,
            client: clients.find(c => c.id === task.clientId) || null
          });
        }
      }
    });
    return alerts;
  }, [tasks, clients, inactivityThresholdMs]);

  const handleSaveBusinessHours = async () => {
    if (!userData?.agencyId || userData.agencyId === 'unassigned') return;
    setSavingHours(true);
    try {
      await updateDoc(doc(db, 'agencies', userData.agencyId), {
        businessHours: { start: businessStart, end: businessEnd }
      });
      // Optionally show a non-intrusive toast, but an alert works for now
      // alert('Horario guardado correctamente.');
    } catch (e) {
      console.error(e);
      alert('Error al guardar el horario.');
    } finally {
      setSavingHours(false);
    }
  };

  const handleSaveInactivity = async () => {
    if (!userData?.agencyId) return;
    setSavingInactivity(true);
    try {
      await updateDoc(doc(db, 'agencies', userData.agencyId), {
        inactivityAlertDays
      });
      alert('Configuración guardada.');
    } catch (e) {
      console.error(e);
      alert('Error guardando configuración.');
    } finally {
      setSavingInactivity(false);
    }
  };

  if (loading) return <div className="p-8">Cargando...</div>;

  const isMaster = userData?.role === 'master' ;

  return (
    <div className="max-w-6xl mx-auto py-4 space-y-4">

      {isMaster && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 flex flex-col md:flex-row items-end gap-4">
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
      )}

      {isMaster && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="p-5 border-b border-slate-200 dark:border-slate-700">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Building className="w-5 h-5 text-indigo-500" />
              Gestión de Agencias
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Administra las agencias y otorga accesos de prueba gratuita.
            </p>
          </div>
          <ul className="divide-y divide-slate-100 dark:divide-slate-700/50 max-h-[400px] overflow-y-auto">
            {agencies.map(a => (
              <li key={`agency-${a.id}`} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 dark:bg-slate-900/50 transition-colors">
                <div className="flex-1">
                  <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    {a.name}
                    {a.hasFreeAccess && (
                      <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-[10px] font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                        Prueba Gratis
                      </span>
                    )}
                    {a.subscriptionStatus === 'active' && (
                      <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-[10px] font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20">
                        Premium
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">
                    ID: {a.id}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleToggleFreeAccess(a.id, !!a.hasFreeAccess)}
                    className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                      a.hasFreeAccess 
                        ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200' 
                        : 'bg-green-50 text-green-600 hover:bg-green-100 border border-green-200'
                    }`}
                  >
                    {a.hasFreeAccess ? 'Revocar Prueba' : 'Otorgar Prueba'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 flex flex-col gap-4">
        <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-2">Añadir Nuevo Usuario</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 w-full items-end">
          {isMaster && (
            <div className="w-full">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Agencia Destino</label>
              <select
                value={inviteTargetAgencyId}
                onChange={(e) => setInviteTargetAgencyId(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300"
              >
                <option value="">Selecciona una agencia...</option>
                {agencies.map(a => (
                  <option key={`agency-${a.id}`} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="w-full">
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Nombre Completo</label>
            <input
              type="text"
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              placeholder="Ej. Juan Pérez"
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300"
            />
          </div>
          <div className="w-full">
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Correo Electrónico</label>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="usuario@ejemplo.com"
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300"
            />
          </div>
          <div className="w-full">
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Rol</label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300"
            >
              <option value="seller">Vendedor</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end mt-2">
          <button
            onClick={handleCreateUser}
            disabled={!inviteEmail.trim() || !inviteName.trim() || inviting || (isMaster && !inviteTargetAgencyId)}
            className="w-full md:w-auto px-6 py-2 bg-[#2E914F] hover:bg-[#257A41] text-white font-medium rounded-lg disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            {inviting ? 'Creando...' : 'Crear Usuario'}
          </button>
        </div>
        {inviteSuccessMsg && (
          <div className="mt-4 text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-4 py-4 rounded-lg flex flex-col gap-2 border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2 font-semibold">
              <CheckCircle className="w-5 h-5" />
              {inviteSuccessMsg}
            </div>
            {createdUserPassword && (
              <div className="mt-2 bg-white dark:bg-slate-800 p-3 rounded border border-green-100 dark:border-green-900 select-all">
                <p className="text-slate-600 dark:text-slate-300 mb-1">Contraseña temporal generada:</p>
                <code className="text-lg font-mono font-bold text-slate-800 dark:text-white bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded">
                  {createdUserPassword}
                </code>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                  Copia esta contraseña y entrégasela al usuario. Podrá cambiarla una vez que inicie sesión.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {userData?.role === 'admin' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-orange-200 dark:border-orange-800 shadow-sm flex flex-col">
          <div className="p-5 border-b border-orange-100 dark:border-orange-900 bg-orange-50 dark:bg-orange-900/20">
            <h3 className="text-sm font-bold text-orange-700 dark:text-orange-400 uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Alertas de Inactividad
            </h3>
            <p className="text-xs text-orange-600 dark:text-orange-500 mt-1">
              Clientes con tareas vencidas hace más de {inactivityAlertDays} días.
            </p>
          </div>
          <div className="p-5 flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-100 dark:border-slate-700">
              <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Umbral de Inactividad (Días)</label>
              <div className="flex items-center gap-2">
                <input 
                  type="number"
                  min="1"
                  max="365"
                  value={inactivityAlertDays}
                  onChange={(e) => setInactivityAlertDays(Number(e.target.value))}
                  className="border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-sm bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 w-20 text-center"
                />
                <button 
                  onClick={handleSaveInactivity} 
                  disabled={savingInactivity}
                  className="px-3 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingInactivity ? '...' : 'Guardar'}
                </button>
              </div>
            </div>
            
            <div className="space-y-3 overflow-y-auto max-h-[300px] scrollbar-hide flex-1">
              {inactiveAlerts.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-400 flex-col">
                  <CheckCircle className="w-8 h-8 mb-2 text-green-500 opacity-50" />
                  <p>Todos los clientes están al día.</p>
                </div>
              ) : (
                inactiveAlerts.map(({ task, client }) => (
                  <div 
                    key={`task-${task.id}`} 
                    className="p-3 rounded-lg bg-orange-50/50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-800/30 cursor-pointer hover:bg-orange-100/50 dark:hover:bg-orange-900/20 transition-colors"
                    onClick={() => {
                      if (client) {
                        navigate('/persons', { state: { clientId: client.id } });
                      }
                    }}
                  >
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
                      {client ? client.name : 'Sin cliente asignado'}
                    </p>
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                      Tarea: <span className="text-slate-800 dark:text-slate-300">{task.title}</span>
                    </p>
                    <p className="text-[10px] text-orange-600 dark:text-orange-400 font-semibold mt-1">
                      Venció el: {new Date(task.dueDate).toLocaleDateString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Horario de Calendario */}
      {userData?.role === 'admin' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col p-6 space-y-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-500" />
              Horario del Calendario
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Define el horario de inicio y fin para mostrar en el calendario de la agencia.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Inicio</label>
              <input 
                type="time" 
                value={businessStart}
                onChange={(e) => setBusinessStart(e.target.value)}
                className="border border-slate-300 dark:border-slate-600 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Fin</label>
              <input 
                type="time" 
                value={businessEnd}
                onChange={(e) => setBusinessEnd(e.target.value)}
                className="border border-slate-300 dark:border-slate-600 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="pt-5">
              <button 
                onClick={handleSaveBusinessHours}
                disabled={savingHours}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
              >
                {savingHours ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sección de Gestión de Etiquetas */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <Tag className="w-5 h-5 text-indigo-500" />
            Etiquetas del Equipo
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Define las etiquetas que podrá usar tu equipo para clasificar a los prospectos en el CRM (ej. Venta, Compra, Crédito, etc.).
          </p>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={newTagInput}
            onChange={(e) => setNewTagInput(e.target.value)}
            placeholder="Ejemplo: Arrendamiento o Busca de auto"
            className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddTag();
            }}
          />
          <button
            onClick={handleAddTag}
            disabled={!newTagInput.trim() || loadingTags}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors flex items-center gap-1 shrink-0"
          >
            <Plus className="w-4 h-4" />
            Agregar
          </button>
        </div>

        {agencyTags.length > 0 ? (
          <div className="flex flex-wrap gap-2 pt-2">
            {agencyTags.map(tag => (
              <span
                key={`tag-${tag.id}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800/10"
              >
                {tag.name}
                <button
                  type="button"
                  onClick={() => handleDeleteTag(tag.id)}
                  className="text-indigo-400 hover:text-red-500 transition-colors font-bold text-sm leading-none p-0.5 focus:outline-none"
                  title="Eliminar Etiqueta"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400 dark:text-slate-500 italic py-2">
            Cargando etiquetas o utilizando las etiquetas predeterminadas...
          </p>
        )}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <ul className="divide-y divide-slate-100">
          {users.map(u => (
            <li key={`user-${u.id}`} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50 dark:bg-slate-900 transition-colors">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <div className="font-bold text-slate-800 dark:text-slate-200">
                    {(!u.name || u.name === 'Usuario Pendiente') && u.role !== 'unassigned'
                      ? (u.role === 'admin' ? 'Administrador' : u.email?.split('@')[0] || 'Usuario')
                      : (u.name || 'Sin Nombre')}
                  </div>
                  {u.role === 'master' && <span className="inline-flex items-center rounded-md bg-stone-100 px-2 py-1 text-[10px] font-medium text-stone-600 ring-1 ring-inset ring-stone-500/10"><Shield className="w-3 h-3 mr-1"/> Master</span>}
                  {u.role === 'admin' && <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-[10px] font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">Admin</span>}
                  {u.role === 'seller' && <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/10">Vendedor</span>}
                  {u.role === 'unassigned' && <span className="inline-flex items-center rounded-md bg-orange-50 px-2 py-1 text-[10px] font-medium text-orange-700 ring-1 ring-inset ring-orange-600/10">Pendiente</span>}
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                  <Mail className="w-3 h-3" />
                  {u.email}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                {isMaster && (
                  <div className="w-full sm:w-auto">
                    <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Agencia</label>
                    <select
                      value={u.agencyId || 'unassigned'}
                      onChange={(e) => handleUpdateAgency(u.id, e.target.value)}
                      className="text-sm border border-slate-300 dark:border-slate-600 rounded-md py-1.5 px-3 bg-white dark:bg-slate-800 w-full sm:w-48 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="unassigned">-- Sin Asignar --</option>
                      {agencies.map(a => (
                        <option value={a.id} key={`agency-${a.id}`}>{a.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                
                <div className="w-full sm:w-auto flex items-end gap-2">
                  <div className="w-full sm:w-auto">
                    <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Rol</label>
                    <select
                      value={u.role || 'unassigned'}
                      onChange={(e) => handleUpdateRole(u.id, e.target.value, u.name, u.email)}
                      className="text-sm border border-slate-300 dark:border-slate-600 rounded-md py-1.5 px-3 bg-white dark:bg-slate-800 w-full sm:w-32 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      disabled={(!isMaster && u.role === 'master')}
                    >
                      {isMaster && u.role === 'master' && <option value="master">Master</option>}
                      <option value="admin">Administrador</option>
                      <option value="seller">Vendedor</option>
                      <option value="unassigned">Desasignado</option>
                    </select>
                  </div>
                  
                  {u.id !== userData?.id && (userData?.role === 'admin' || userData?.role === 'master') && (
                    <button
                      onClick={() => handleDeleteUser(u.id, u.name || u.email || 'Usuario')}
                      className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                      title="Eliminar usuario"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
          {users.length === 0 && (
            <li className="p-8 text-center text-slate-500 dark:text-slate-400">
              No se encontraron usuarios
            </li>
          )}
        </ul>
      </div>

    </div>
  );
}
