import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { collection, doc, updateDoc, setDoc, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { Users, Shield, Building, Mail, CheckCircle, Plus, Send, Tag, Trash2, X } from 'lucide-react';

export function AgencyUsers() {
  const { userData } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [agencies, setAgencies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newAgencyName, setNewAgencyName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  
  const [agencyTags, setAgencyTags] = useState<{ id: string; name: string }[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [loadingTags, setLoadingTags] = useState(false);
  
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

  const handleSendInvitation = async () => {
    if (!inviteEmail.trim() || !inviteEmail.includes('@')) {
        alert('Por favor, ingresa un correo electrónico válido.');
        return;
    }
    
    setInviting(true);
    try {
        const appUrl = window.location.origin + '/login';
        const subject = 'Invitación para unirte al CRM Nextcar';
        const messageHtml = `<p>Hola,</p>
<p>Has sido invitado para unirte al equipo de ventas en nuestro CRM.</p>
<p>Esta aplicación te ayudará a gestionar tus ventas, clientes, inventario y tareas de manera eficiente para cerrar más tratos.</p>
<p>Por favor ingresa y regístrate utilizando el siguiente enlace:</p>
<p><a href="${appUrl}">${appUrl}</a></p>
<br/>
<p>¡Bienvenido al equipo!</p>`;

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

        alert('¡Invitación enviada con éxito a ' + inviteEmail.trim() + '!');
        setInviteEmail('');
    } catch (e: any) {
        console.error(e);
        alert('Error al enviar invitación. ' + (e.message || ''));
    } finally {
        setInviting(false);
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

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 flex flex-col md:flex-row items-end gap-4">
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
                  <div className="font-bold text-slate-800 dark:text-slate-200">{u.name || 'Sin Nombre'}</div>
                  {u.role === 'master' && <span className="inline-flex items-center rounded-md bg-stone-100 px-2 py-1 text-[10px] font-medium text-stone-600 ring-1 ring-inset ring-stone-500/10"><Shield className="w-3 h-3 mr-1"/> Master</span>}
                  {u.role === 'admin' && <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-[10px] font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">Admin</span>}
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
                    onChange={(e) => handleUpdateRole(u.id, e.target.value)}
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
