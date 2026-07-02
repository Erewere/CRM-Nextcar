import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { collection, doc, updateDoc, setDoc, query, where, getDocs, deleteDoc, getDoc } from 'firebase/firestore';
import { Users, Shield, Building, Mail, CheckCircle, Plus, Send, Tag, Trash2, X, Clock } from 'lucide-react';
import { Task, Client } from '../types';

export function AgencyUsers() {
  const { userData } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [agencies, setAgencies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newAgencyName, setNewAgencyName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteSuccessMsg, setInviteSuccessMsg] = useState('');
  
  const [agencyTags, setAgencyTags] = useState<{ id: string; name: string }[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [loadingTags, setLoadingTags] = useState(false);
  
  const [inactivityAlertDays, setInactivityAlertDays] = useState(14);
  const [savingInactivity, setSavingInactivity] = useState(false);
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

        // Load inactivity alerts data
        if (userData.agencyId && userData.agencyId !== 'unassigned') {
          const agencySnap = await getDoc(doc(db, 'agencies', userData.agencyId));
          if (agencySnap.exists() && agencySnap.data().inactivityAlertDays) {
            setInactivityAlertDays(agencySnap.data().inactivityAlertDays);
          }
          const clientsQ = query(collection(db, 'clients'), where('agencyId', '==', userData.agencyId));
          const tasksQ = query(collection(db, 'tasks'), where('agencyId', '==', userData.agencyId));
          
          const [clientsSnap, tasksSnap] = await Promise.all([
            getDocs(clientsQ),
            getDocs(tasksQ)
          ]);
          setClients(clientsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Client)));
          setTasks(tasksSnap.docs.map(d => ({ id: d.id, ...d.data() } as Task)));
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

  const handleSendInvitation = async () => {
    if (!inviteEmail.trim() || !inviteEmail.includes('@')) {
        alert('Por favor, ingresa un correo electrónico válido.');
        return;
    }
    
    setInviting(true);
    try {
        const appUrl = window.location.origin + '/login';
        const subject = 'Invitación oficial para unirte a Nextcar CRM';
        const messageHtml = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; padding: 40px 20px;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
    <div style="background-color: #1e293b; padding: 40px 30px; text-align: center;">
      <img src="https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=800&q=80" alt="Nextcar" style="width: 100%; height: 160px; object-fit: cover; border-radius: 8px; margin-bottom: 20px; opacity: 0.9;" />
      <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">Nextcar CRM</h1>
    </div>
    <div style="padding: 40px 30px;">
      <p style="color: #334155; font-size: 16px; line-height: 24px; margin-top: 0;">Estimado(a) colaborador(a),</p>
      <p style="color: #334155; font-size: 16px; line-height: 24px;">Has sido cordialmente invitado(a) a unirte al equipo de ventas en nuestro sistema <strong>Nextcar CRM</strong>.</p>
      <p style="color: #334155; font-size: 16px; line-height: 24px;">Nuestra plataforma de alto rendimiento te proporcionará las herramientas necesarias para gestionar de manera integral el inventario de vehículos, dar un seguimiento preciso a tus clientes potenciales y organizar tus tareas estratégicas para maximizar los cierres de ventas.</p>
      <div style="text-align: center; margin: 40px 0;">
        <a href="${appUrl}" style="background-color: #2563eb; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.3);">Acceder a la Plataforma</a>
      </div>
      <p style="color: #64748b; font-size: 14px; line-height: 24px;">Si tienes problemas con el botón, puedes copiar y pegar este enlace en tu navegador:</p>
      <p style="color: #2563eb; font-size: 14px; word-break: break-all; margin-bottom: 0;">${appUrl}</p>
    </div>
    <div style="background-color: #f1f5f9; padding: 24px; text-align: center; border-top: 1px solid #e2e8f0;">
      <p style="color: #64748b; font-size: 13px; margin: 0;">© ${new Date().getFullYear()} Nextcar CRM. Todos los derechos reservados.</p>
    </div>
  </div>
</div>`;

        const res = await fetch('/api/send-invite', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                to: inviteEmail.trim(),
                subject: subject,
                html: messageHtml
            })
        });

        const data = await res.json();

        if (!res.ok) {
            const errorMsg = data.error?.message || (typeof data.error === 'string' ? data.error : JSON.stringify(data.error)) || 'Error al enviar la invitación';
            throw new Error(errorMsg);
        }

        setInviteSuccessMsg(`¡Invitación enviada con éxito a ${inviteEmail.trim()}!`);
        setInviteEmail('');
        setTimeout(() => setInviteSuccessMsg(''), 5000);
    } catch (e: any) {
        console.error(e);
        alert('Error al enviar invitación. ' + (e.message || ''));
    } finally {
        setInviting(false);
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

  const isMaster = userData?.role === 'master' || userData?.id === 'vxFIfZ5bdQSzaekW5d5c1TbNVCO2';

  return (
    <div className="max-w-6xl mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-200 tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-600" />
            Gestión de Usuarios
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {isMaster ? 'Administra todos los usuarios y sus agencias' : 'Administra los roles de los usuarios en tu agencia'}
          </p>
        </div>
      </div>

      {isMaster && (
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
              <li key={a.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 dark:bg-slate-900/50 transition-colors">
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
        <div className="flex flex-col md:flex-row items-end gap-4 w-full">
          <div className="flex-1 w-full">
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Invitar al Equipo (Enviar correo electrónico)</label>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="correo@ejemplo.com"
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300"
            />
          </div>
          <button
            onClick={handleSendInvitation}
            disabled={!inviteEmail.trim() || inviting}
            className="w-full md:w-auto px-6 py-2 bg-[#2E914F] hover:bg-[#257A41] text-white font-medium rounded-lg disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm transition-colors"
          >
            <Send className="w-4 h-4" />
            {inviting ? 'Enviando...' : 'Enviar Invitación'}
          </button>
        </div>
        {inviteSuccessMsg && (
          <div className="text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-4 py-3 rounded-lg flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            {inviteSuccessMsg}
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
                  <div key={task.id} className="p-3 rounded-lg bg-orange-50/50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-800/30">
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
                key={tag.id}
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
            <li key={u.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50 dark:bg-slate-900 transition-colors">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <div className="font-bold text-slate-800 dark:text-slate-200">
                    {u.name === 'Usuario Pendiente' && u.role !== 'unassigned' ? (u.email?.split('@')[0] || 'Usuario') : (u.name || 'Sin Nombre')}
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
                        <option value={a.id} key={a.id}>{a.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                
                <div className="w-full sm:w-auto">
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Rol</label>
                  <select
                    value={u.role || 'unassigned'}
                    onChange={(e) => handleUpdateRole(u.id, e.target.value, u.name, u.email)}
                    className="text-sm border border-slate-300 dark:border-slate-600 rounded-md py-1.5 px-3 bg-white dark:bg-slate-800 w-full sm:w-32 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
            <li className="p-8 text-center text-slate-500 dark:text-slate-400">
              No se encontraron usuarios
            </li>
          )}
        </ul>
      </div>

    </div>
  );
}
