import React, { useState, useEffect } from 'react';
import imageCompression from 'browser-image-compression';
import { Client, Task, ClientFile, Vehicle } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { db, storage } from '../lib/firebase';
import { doc, setDoc, updateDoc, collection, query, where, getDocs, deleteDoc, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { X, FileText, Upload, Calendar, CheckSquare, Phone, MessageCircle, MoreHorizontal, User, Tag, Clock, Building2 } from 'lucide-react';
import clsx from 'clsx';

interface Props {
  client: Client | Partial<Client>;
  initialStatus?: string;
  onClose: () => void;
}

export function ClientDetailModal({ client, initialStatus = 'new', onClose }: Props) {
  const { userData } = useAuth();
  const isNew = !client.id;
  const [formData, setFormData] = useState<Partial<Client>>(
    isNew ? { status: initialStatus, origin: 'manual', agencyId: userData?.agencyId, sellerId: userData?.id, tags: [] } : { tags: [], ...client }
  );
  const [tasks, setTasks] = useState<Task[]>([]);
  const [files, setFiles] = useState<ClientFile[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [inventoryVehicles, setInventoryVehicles] = useState<Vehicle[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);

  useEffect(() => {
    if (!userData) return;
    const fetchAvailableTags = async () => {
      const agencyId = userData?.agencyId || 'master_agency';
      try {
        const q = query(collection(db, 'agency_tags'), where('agencyId', '==', agencyId));
        const snap = await getDocs(q);
        if (snap.empty) {
          setAvailableTags(['Venta', 'Compra', 'Busca de auto', 'Crédito']);
        } else {
          setAvailableTags(Array.from(new Set(snap.docs.map(doc => doc.data().name).filter(Boolean))));
        }
      } catch (err) {
        console.error("Error loading tags:", err);
        setAvailableTags(['Venta', 'Compra', 'Busca de auto', 'Crédito']);
      }
    };
    fetchAvailableTags();
  }, [userData]);

  const handleTagToggle = (tag: string) => {
    setFormData(prev => {
      const currentTags = prev.tags || [];
      const updatedTags = currentTags.includes(tag)
        ? currentTags.filter(t => t !== tag)
        : [...currentTags, tag];
      return { ...prev, tags: updatedTags };
    });
  };
  
  const [activeTab, setActiveTab] = useState<'activity' | 'notes' | 'files'>('activity');
  const [showFullAddress, setShowFullAddress] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDate, setNewTaskDate] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');
  
  useEffect(() => {
    if (userData?.agencyId) {
      const q = query(
        collection(db, 'vehicles'),
        where('agencyId', '==', userData.agencyId),
        where('status', '==', 'available')
      );
      getDocs(q).then(snap => {
        setInventoryVehicles(snap.docs.map(d => ({ id: d.id, ...d.data() } as Vehicle)));
      }).catch(console.error);
    } else if (userData?.role === 'master') {
      const q = query(collection(db, 'vehicles'), where('status', '==', 'available'));
      getDocs(q).then(snap => {
        setInventoryVehicles(snap.docs.map(d => ({ id: d.id, ...d.data() } as Vehicle)));
      }).catch(console.error);
    }
  }, [userData]);
  
  useEffect(() => {
    if (isNew) return;
    // Load tasks
    const loadTasks = async () => {
      const q = query(collection(db, 'tasks'), where('clientId', '==', client.id));
      const s = await getDocs(q);
      const t = s.docs.map(d => ({ id: d.id, ...d.data() } as Task));
      t.sort((a, b) => new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime());
      setTasks(t);
    };
    // Load files
    const loadFiles = async () => {
      const q = query(collection(db, 'files'), where('clientId', '==', client.id));
      const s = await getDocs(q);
      const f = s.docs.map(d => ({ id: d.id, ...d.data() } as ClientFile));
      f.sort((a, b) => new Date(b.uploadedAt as string).getTime() - new Date(a.uploadedAt as string).getTime());
      setFiles(f);
    };
    // Load notes
    const loadNotes = async () => {
      const q = query(collection(db, 'notes'), where('clientId', '==', client.id));
      const s = await getDocs(q);
      const n = s.docs.map(d => ({ id: d.id, ...d.data() } as any));
      n.sort((a, b) => new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime());
      setNotes(n);
    };
    loadTasks();
    loadFiles();
    loadNotes();
  }, [client.id, isNew]);

  const [existingPersons, setExistingPersons] = useState<Client[]>([]);

  useEffect(() => {
    if (userData?.agencyId && isNew) {
      const fetchPersons = async () => {
        let q = query(collection(db, 'clients'), where('agencyId', '==', userData.agencyId));
        if (userData.role === 'seller') {
          q = query(collection(db, 'clients'), where('agencyId', '==', userData.agencyId), where('sellerId', '==', userData.id));
        }
        try {
          const snap = await getDocs(q);
          setExistingPersons(snap.docs.map(d => ({ id: d.id, ...d.data() } as Client)));
        } catch (e) {
          console.error(e);
        }
      };
      fetchPersons();
    }
  }, [userData, isNew]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const person = existingPersons.find(p => String(p.name || '').toLowerCase() === val.toLowerCase());
    if (person) {
      setFormData(prev => ({
        ...prev,
        name: person.name,
        email: person.email || prev.email,
        phone: person.phone || prev.phone,
        organization: person.organization || prev.organization,
        address: person.address || prev.address
      }));
    } else {
      setFormData(prev => ({ ...prev, name: val }));
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    setFormData(prev => ({ ...prev, status: newStatus }));
    if (!isNew && client.id) {
      try {
        await updateDoc(doc(db, 'clients', client.id as string), { status: newStatus, updatedAt: new Date().toISOString() });
      } catch (err) {
        console.error("Error updating status:", err);
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData || !formData.agencyId || formData.agencyId === 'unassigned') {
      alert('Debes pertenecer a una agencia para guardar clientes.');
      return;
    }

    try {
      if (isNew) {
        const newRef = doc(collection(db, 'clients'));
        const dataToSave = { ...formData, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        Object.keys(dataToSave).forEach(k => dataToSave[k as keyof typeof dataToSave] === undefined && delete dataToSave[k as keyof typeof dataToSave]);
        await setDoc(newRef, dataToSave);
      } else {
        const dataToUpdate = { ...formData, updatedAt: new Date().toISOString() };
        Object.keys(dataToUpdate).forEach(k => dataToUpdate[k as keyof typeof dataToUpdate] === undefined && delete dataToUpdate[k as keyof typeof dataToUpdate]);
        await updateDoc(doc(db, 'clients', client.id as string), dataToUpdate);
      }
      onClose();
    } catch(err) {
      console.error(err);
      alert("Error guardando cliente");
    }
  };

  const handleAddTask = async () => {
    if (!newTaskTitle || !newTaskDate || isNew) return;
    const newRef = doc(collection(db, 'tasks'));
    const t: Partial<Task> = {
      agencyId: userData?.agencyId,
      sellerId: userData?.id,
      clientId: client.id,
      title: newTaskTitle,
      dueDate: newTaskDate,
      completed: false,
      createdAt: new Date().toISOString()
    };
    await setDoc(newRef, t);
    setTasks(prev => [{ id: newRef.id, ...t } as Task, ...prev]);
    setNewTaskTitle('');
    setNewTaskDate('');
  };

  const handleAddNote = async () => {
    if (!newNoteContent || isNew) return;
    const newRef = doc(collection(db, 'notes'));
    const n = {
      agencyId: userData?.agencyId,
      sellerId: userData?.id,
      clientId: client.id,
      content: newNoteContent,
      createdAt: new Date().toISOString()
    };
    await setDoc(newRef, n);
    setNotes(prev => [{ id: newRef.id, ...n }, ...prev]);
    setNewNoteContent('');
  };

  const toggleTaskCompletion = async (task: Task) => {
    try {
      await updateDoc(doc(db, 'tasks', task.id as string), {
        completed: !task.completed
      });
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: !task.completed } : t));
    } catch (err) {
      console.error(err);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || isNew) return;
    if (!userData?.agencyId || userData.agencyId === 'unassigned') {
      alert('Debes pertenecer a una agencia para subir archivos.');
      return;
    }
    const file = e.target.files[0];
    let fileToUpload = file;
    
    if (file.type.startsWith('image/')) {
      const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true
      };
      fileToUpload = await imageCompression(file, options);
    }

    const newRef = doc(collection(db, 'files'));
    const storageRef = ref(storage, `users/${userData?.id}/clients/${client.id}/${fileToUpload.name}`);
    await uploadBytes(storageRef, fileToUpload);
    const url = await getDownloadURL(storageRef);
    const f: Partial<ClientFile> = {
      agencyId: userData?.agencyId,
      clientId: client.id,
      userId: userData?.id,
      filename: fileToUpload.name,
      url,
      uploadedAt: new Date().toISOString()
    };
    await setDoc(newRef, f);
    setFiles(prev => [{ id: newRef.id, ...f } as ClientFile, ...prev]);
  };

  const pendingTasks = tasks.filter(t => !t.completed);
  const completedTasks = tasks.filter(t => t.completed);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-2 sm:p-4">
      <div className="bg-white dark:bg-slate-800 w-full max-w-6xl h-[95vh] rounded-xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* TOP HEADER */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 bg-white dark:bg-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flexitems-center justify-center text-blue-700 font-bold text-lg flex items-center">
              {String(formData.name || 'U').charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-[200px]">
              {(!formData.dealTitle && !isNew) ? (
                <>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100 leading-tight">{formData.name}</h2>
                  <p className="text-sm font-medium text-gray-500 dark:text-slate-400 mt-1">Contacto sin trato activo.</p>
                </>
              ) : (
                <>
                  <input
                    name="dealTitle"
                    value={formData.dealTitle || ''}
                    onChange={handleChange}
                    placeholder={isNew ? 'Nuevo Trato' : 'Nombre del trato'}
                    className="text-xl font-bold text-gray-900 dark:text-slate-100 leading-tight w-full bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-600 focus:outline-none"
                  />
                  {formData.status === 'won' && (
                    <p className="text-sm border border-green-200 bg-green-50 text-green-700 inline-block px-2 py-0.5 rounded mt-0.5 font-medium">Ganado</p>
                  )}
                  {formData.status === 'lost' && (
                    <p className="text-sm border border-red-200 bg-red-50 text-red-700 inline-block px-2 py-0.5 rounded mt-0.5 font-medium">Perdido</p>
                  )}
                  {formData.status !== 'won' && formData.status !== 'lost' && (
                    <p className="text-sm border border-blue-200 bg-blue-50 text-blue-700 inline-block px-2 py-0.5 rounded mt-0.5 font-medium">Abierto</p>
                  )}
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {!isNew && !formData.dealTitle && (
              <button 
                type="button"
                onClick={() => {
                  setFormData(prev => ({ ...prev, dealTitle: `${formData.name} deal`, status: prev.status || 'new' }));
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-1.5 rounded shadow-sm transition-colors"
              >
                + Crear Trato
              </button>
            )}
            {!isNew && formData.dealTitle && formData.status !== 'won' && formData.status !== 'lost' && (
              <>
                <button 
                  type="button"
                  onClick={() => handleStatusChange('won')}
                  className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-1.5 rounded shadow-sm transition-colors"
                >
                  Ganado
                </button>
                <button 
                  type="button"
                  onClick={() => handleStatusChange('lost')}
                  className="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-1.5 rounded shadow-sm transition-colors"
                >
                  Perdido
                </button>
              </>
            )}
            {!isNew && (formData.status === 'won' || formData.status === 'lost') && (
              <button 
                type="button"
                onClick={() => handleStatusChange('open')}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 dark:text-slate-200 text-sm font-semibold px-4 py-1.5 rounded shadow-sm transition-colors"
              >
                Reabrir trato
              </button>
            )}
            <div className="w-px h-6 bg-gray-300 mx-1"></div>
            <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700 dark:text-slate-300 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          
          {/* LEFT SIDEBAR (DETAILS) */}
          <div className="w-[320px] shrink-0 border-r border-gray-200 bg-white dark:bg-slate-800 overflow-y-auto hidden md:block">
            <div className="p-5">
              <h3 className="font-bold text-gray-900 dark:text-slate-100 mb-4 flex items-center justify-between">
                Resumen
                <MoreHorizontal className="w-4 h-4 text-gray-400" />
              </h3>

              <form id="client-form" onSubmit={handleSave} className="space-y-4">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Valor / Vehículo</label>
                  <select name="vehicle" value={formData.vehicleId || formData.vehicle || ''} onChange={e => {
                    const val = e.target.value;
                    if (val === 'Otro pendiente') {
                       setFormData({ ...formData, vehicle: val, vehicleId: undefined });
                    } else {
                       const v = inventoryVehicles.find(veh => veh.id === val);
                       if (v) {
                         setFormData({ ...formData, vehicle: `${v.year} ${v.make} ${v.model}`, vehicleId: v.id });
                       } else {
                         setFormData({ ...formData, vehicle: val, vehicleId: undefined });
                       }
                    }
                  }} className="w-full text-sm py-1.5 font-medium text-blue-600 border-b border-transparent hover:border-gray-300 focus:border-blue-600 focus:outline-none bg-transparent cursor-pointer">
                    <option value="" disabled>Seleccionar vehículo...</option>
                    <option value="Otro pendiente">Otro pendiente</option>
                    {inventoryVehicles.map(v => (
                      <option key={v.id} value={v.id}>
                        {v.year} {v.make} {v.model} - {v.vin}
                      </option>
                    ))}
                    {formData.vehicle && formData.vehicle !== 'Otro pendiente' && !inventoryVehicles.find(v => v.id === formData.vehicleId) && (
                      <option value={formData.vehicle}>{formData.vehicle}</option>
                    )}
                  </select>
                </div>
                
                <div className="pt-2 border-t border-gray-100 dark:border-slate-700 space-y-1">
                  <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Persona</label>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-400" />
                    <input 
                      name="name" 
                      list="existing-persons-list"
                      placeholder="Nombre" 
                      value={formData.name || ''} 
                      onChange={handleNameChange} 
                      className="w-full text-sm py-1 font-medium border-b border-transparent hover:border-gray-300 focus:border-blue-600 focus:outline-none" 
                    />
                    <datalist id="existing-persons-list">
                      {existingPersons.map(p => <option key={p.id} value={p.name} />)}
                    </datalist>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Building2 className="w-4 h-4 text-gray-400" />
                    <input name="organization" placeholder="Organización / Empresa" value={formData.organization || ''} onChange={handleChange} className="w-full bg-transparent dark:text-slate-200 text-sm py-1 border-b border-transparent hover:border-gray-300 focus:border-blue-600 focus:outline-none" />
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <input 
                      name="phone" 
                      list="existing-phones-list"
                      placeholder="Teléfono" 
                      value={formData.phone || ''} 
                      onChange={handleChange} 
                      className="w-full bg-transparent dark:text-slate-200 text-sm py-1 border-b border-transparent hover:border-gray-300 focus:border-blue-600 focus:outline-none" 
                    />
                    <datalist id="existing-phones-list">
                      {existingPersons.filter(p => p.phone).map(p => <option key={p.id} value={p.phone}>{p.name}</option>)}
                    </datalist>
                  </div>
                  {existingPersons.find(p => p.phone && formData.phone && formData.phone.length > 5 && p.phone.includes(formData.phone) && p.id !== formData.id) && (
                    <p className="text-[11px] text-orange-600 font-medium ml-6">
                      Este teléfono podría estar ligado a: {existingPersons.find(p => p.phone && formData.phone && p.phone.includes(formData.phone) && p.id !== formData.id)?.name}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <MessageCircle className="w-4 h-4 text-gray-400" />
                    <input 
                      type="email" 
                      name="email" 
                      list="existing-emails-list"
                      placeholder="Correo" 
                      value={formData.email || ''} 
                      onChange={handleChange} 
                      className="w-full bg-transparent dark:text-slate-200 text-sm py-1 border-b border-transparent hover:border-gray-300 focus:border-blue-600 focus:outline-none" 
                    />
                    <datalist id="existing-emails-list">
                      {existingPersons.filter(p => p.email).map(p => <option key={p.id} value={p.email}>{p.name}</option>)}
                    </datalist>
                  </div>
                  {existingPersons.find(p => p.email && formData.email && formData.email.length > 5 && p.email.includes(formData.email) && p.id !== formData.id) && (
                    <p className="text-[11px] text-orange-600 font-medium ml-6">
                      Este correo podría estar ligado a: {existingPersons.find(p => p.email && formData.email && p.email.includes(formData.email) && p.id !== formData.id)?.name}
                    </p>
                  )}
                </div>

                <div className="pt-4 border-t border-gray-100 dark:border-slate-700 space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Dirección</label>
                    <button type="button" onClick={() => setShowFullAddress(!showFullAddress)} className="text-[10px] text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-bold uppercase tracking-wider">
                      {showFullAddress ? 'Ocultar detalles' : 'Desglosar dirección'}
                    </button>
                  </div>
                  {showFullAddress ? (
                    <div className="grid grid-cols-2 gap-3 mt-2">
                       <div className="col-span-2">
                         <input name="street" placeholder="Calle" value={formData.street || ''} onChange={handleChange} className="w-full bg-transparent dark:text-slate-200 text-sm py-1 border-b border-transparent hover:border-gray-300 focus:border-blue-600 focus:outline-none" />
                       </div>
                       <div>
                         <input name="exteriorNumber" placeholder="Número Ext/Int" value={formData.exteriorNumber || ''} onChange={handleChange} className="w-full bg-transparent dark:text-slate-200 text-sm py-1 border-b border-transparent hover:border-gray-300 focus:border-blue-600 focus:outline-none" />
                       </div>
                       <div>
                         <input name="neighborhood" placeholder="Colonia" value={formData.neighborhood || ''} onChange={handleChange} className="w-full bg-transparent dark:text-slate-200 text-sm py-1 border-b border-transparent hover:border-gray-300 focus:border-blue-600 focus:outline-none" />
                       </div>
                       <div>
                         <input name="city" placeholder="Ciudad" value={formData.city || ''} onChange={handleChange} className="w-full bg-transparent dark:text-slate-200 text-sm py-1 border-b border-transparent hover:border-gray-300 focus:border-blue-600 focus:outline-none" />
                       </div>
                       <div>
                         <input name="zipCode" placeholder="Código Postal" value={formData.zipCode || ''} onChange={handleChange} className="w-full bg-transparent dark:text-slate-200 text-sm py-1 border-b border-transparent hover:border-gray-300 focus:border-blue-600 focus:outline-none" />
                       </div>
                    </div>
                  ) : (
                    <input name="address" placeholder="Ej. Calle 123..." value={formData.address || ''} onChange={handleChange} className="w-full bg-transparent dark:text-slate-200 text-sm py-1 border-b border-transparent hover:border-gray-300 focus:border-blue-600 focus:outline-none" />
                  )}
                </div>
                
                <div className="pt-4 border-t border-gray-100 dark:border-slate-700 space-y-2">
                  <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Tag className="w-3.5 h-3.5 text-indigo-505" />
                    Etiquetas
                  </label>
                  <select
                    value=""
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val) handleTagToggle(val);
                      e.target.value = '';
                    }}
                    className="w-full text-sm border border-slate-200 dark:border-slate-700 rounded p-1.5 focus:ring-1 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none"
                  >
                    <option value="" disabled>Seleccionar etiqueta...</option>
                    {availableTags.map((tag, i) => (
                      <option key={`opt-${tag}-${i}`} value={tag}>
                        {tag} {(formData.tags || []).includes(tag) ? '✓' : ''}
                      </option>
                    ))}
                  </select>

                  {formData.tags && formData.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {formData.tags.map((tag, idx) => (
                        <span key={`${tag}-${idx}`} className="inline-flex items-center gap-1 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800/10 px-2 py-0.5 rounded-full text-[10px] font-bold">
                          {tag}
                          <button
                            type="button"
                            onClick={() => handleTagToggle(tag)}
                            className="text-indigo-400 hover:text-red-500 font-bold ml-1 text-[11px] leading-none"
                            title="Eliminar etiqueta"
                          >
                            &times;
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] text-gray-400 dark:text-slate-500 italic mt-1">Sin etiquetas personalizadas.</p>
                  )}
                </div>

                <div className="pt-4 border-t border-gray-100 dark:border-slate-700">
                  <span className="text-xs text-gray-400 font-medium">Fuente: {formData.origin}</span>
                </div>
              </form>
            </div>
          </div>

          {/* RIGHT SIDEBAR (INTERACTIONS & TIMELINE) */}
          <div className="flex-1 flex flex-col bg-[#F9FAFB] overflow-hidden">
            
            {!isNew ? (
              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                
                {/* INTERACTION WIDGET */}
                <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm overflow-hidden">
                  <div className="flex border-b border-gray-200 dark:border-slate-700">
                    <button 
                      onClick={() => setActiveTab('activity')}
                      className={clsx("flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors", activeTab === 'activity' ? "border-blue-600 text-blue-700 bg-blue-50/50" : "border-transparent text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:text-slate-100 hover:bg-gray-50 dark:bg-slate-900")}
                    >
                      <Calendar className="w-4 h-4" /> Actividad
                    </button>
                    <button 
                      onClick={() => setActiveTab('notes')}
                      className={clsx("flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors", activeTab === 'notes' ? "border-blue-600 text-blue-700 bg-blue-50/50" : "border-transparent text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:text-slate-100 hover:bg-gray-50 dark:bg-slate-900")}
                    >
                      <FileText className="w-4 h-4" /> Notas
                    </button>
                    <button 
                      onClick={() => setActiveTab('files')}
                      className={clsx("flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors", activeTab === 'files' ? "border-blue-600 text-blue-700 bg-blue-50/50" : "border-transparent text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:text-slate-100 hover:bg-gray-50 dark:bg-slate-900")}
                    >
                      <Upload className="w-4 h-4" /> Archivos
                    </button>
                  </div>
                  
                  <div className="p-4 bg-white dark:bg-slate-800">
                    {activeTab === 'activity' && (
                      <div>
                        <input 
                          type="text" 
                          placeholder="Tomar nota o crear tarea..." 
                          value={newTaskTitle} 
                          onChange={e=>setNewTaskTitle(e.target.value)} 
                          className="w-full text-sm border border-gray-300 rounded p-2 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 mb-3" 
                        />
                        <div className="flex justify-between items-center">
                          <input 
                            type="date" 
                            value={newTaskDate} 
                            onChange={e=>setNewTaskDate(e.target.value)} 
                            className="text-sm border border-gray-300 rounded p-1.5 focus:ring-1 focus:ring-blue-500 focus:border-blue-500" 
                          />
                          <button onClick={handleAddTask} className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm px-4 py-1.5 rounded transition-colors">Programar Vencimiento</button>
                        </div>
                      </div>
                    )}
                    {activeTab === 'notes' && (
                      <div className="flex flex-col gap-3">
                        <textarea 
                          placeholder="Toma una nota..." 
                          value={newNoteContent} 
                          onChange={e=>setNewNoteContent(e.target.value)} 
                          className="w-full text-sm border border-gray-300 rounded p-2 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 min-h-[80px]" 
                        />
                        <div className="flex justify-end">
                          <button onClick={handleAddNote} className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm px-4 py-1.5 rounded transition-colors">Guardar Nota</button>
                        </div>
                      </div>
                    )}
                    {activeTab === 'files' && (
                      <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-200 dark:border-slate-700 rounded bg-gray-50 dark:bg-slate-900 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
                        <Upload className="w-8 h-8 text-gray-400 mb-2" />
                        <label className="text-sm font-medium text-blue-600 cursor-pointer hover:underline">
                          Haz clic para subir un archivo
                          <input type="file" className="hidden" onChange={handleFileUpload} />
                        </label>
                        <p className="text-xs text-gray-400 mt-1">Imágenes o documentos PDF</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* FOCUS SECTION (Pending tasks) */}
                {pendingTasks.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-gray-800 dark:text-slate-200 flex items-center gap-2"> Enfoque </h3>
                    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm">
                      {pendingTasks.map((t, idx) => (
                        <div key={t.id} className={clsx("flex items-center justify-between p-3", idx !== pendingTasks.length - 1 && "border-b border-gray-100 dark:border-slate-700")}>
                          <div className="flex items-center gap-3">
                            <button 
                              onClick={() => toggleTaskCompletion(t)}
                              className="w-5 h-5 rounded-full border-2 border-gray-300 flex items-center justify-center hover:border-green-500 transition-colors"
                            >
                            </button>
                            <span className="text-sm font-medium text-gray-800 dark:text-slate-200">{t.title}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400 font-medium">
                            <Clock className="w-3.5 h-3.5" />
                            {t.dueDate}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* TIMELINE / HISTORY SECTION */}
                <div className="space-y-4">
                   <h3 className="text-sm font-bold text-gray-800 dark:text-slate-200 flex items-center gap-2"> Historial </h3>
                   
                   <div className="relative pl-6 space-y-6 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-0 before:w-0.5 before:bg-gray-200">
                     
                     {/* History items: Files and Completed Tasks interleaved pseudo-chronologically */}
                     {completedTasks.map(t => (
                       <div key={`hist-t-${t.id}`} className="relative">
                         <div className="absolute -left-[27px] top-1 w-4 h-4 rounded-full bg-green-500 border-2 border-white shadow-sm flex items-center justify-center">
                           <CheckSquare className="w-2.5 h-2.5 text-white" />
                         </div>
                         <div className="bg-amber-50 border border-amber-100/60 p-3 rounded-lg mr-2">
                           <div className="flex justify-between items-start mb-1">
                             <span className="text-xs font-semibold text-gray-600 dark:text-slate-400">Tarea completada</span>
                             <span className="text-[10px] text-gray-400">{t.dueDate}</span>
                           </div>
                           <p className="text-sm text-gray-800 dark:text-slate-200 line-through opacity-70">{t.title}</p>
                         </div>
                       </div>
                     ))}

                     {notes.map(n => (
                       <div key={`hist-n-${n.id}`} className="relative">
                         <div className="absolute -left-[27px] top-1 w-4 h-4 rounded-full bg-yellow-500 border-2 border-white shadow-sm flex items-center justify-center">
                           <FileText className="w-2.5 h-2.5 text-white" />
                         </div>
                         <div className="bg-white dark:bg-slate-800 border border-yellow-200 p-3 rounded-lg mr-2 shadow-sm">
                           <div className="flex justify-between items-start mb-2">
                             <span className="text-xs font-bold text-gray-800 dark:text-slate-200">{n.sellerId === userData?.id ? userData?.email : 'Nota'}</span>
                             <span className="text-[10px] text-gray-400">{typeof n.createdAt === 'string' ? n.createdAt.split('T')[0] : ''}</span>
                           </div>
                           <p className="text-sm text-gray-700 dark:text-slate-300 whitespace-pre-wrap">{n.content}</p>
                         </div>
                       </div>
                     ))}

                     {files.map(f => (
                       <div key={`hist-f-${f.id}`} className="relative">
                         <div className="absolute -left-[27px] top-1 w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow-sm flex items-center justify-center">
                           <Upload className="w-2 h-2 text-white" />
                         </div>
                         <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 p-3 rounded-lg mr-2 hover:border-blue-300 transition-colors">
                           <div className="flex justify-between items-start mb-1">
                             <span className="text-xs font-semibold text-gray-600 dark:text-slate-400">Archivo subido</span>
                             <span className="text-[10px] text-gray-400">{typeof f.uploadedAt === 'string' ? f.uploadedAt.split('T')[0] : ''}</span>
                           </div>
                           <a href={f.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-blue-600 hover:underline flex items-center gap-1.5 mt-1">
                             <FileText className="w-3.5 h-3.5" />
                             {f.filename}
                           </a>
                         </div>
                       </div>
                     ))}

                     <div className="relative">
                       <div className="absolute -left-[27px] top-1 w-4 h-4 rounded-full bg-gray-300 border-2 border-white shadow-sm"></div>
                       <div className="text-sm text-gray-500 dark:text-slate-400 ml-1">
                         Trato creado. Origen: <span className="font-semibold">{formData.origin}</span>
                       </div>
                     </div>

                   </div>
                </div>
                
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-slate-900">
                <div className="text-center max-w-sm">
                  <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <User className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-2">Completa el formulario</h3>
                  <p className="text-gray-500 dark:text-slate-400 text-sm">Rellena los datos básicos en el panel izquierdo y guarda para comenzar a registrar notas, documentos y actividades.</p>
                </div>
              </div>
            )}

            {/* BOTTOM ACTIONS (mobile: form save, desktop: right aligned save) */}
            <div className="p-4 bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 flex justify-end gap-3 shrink-0">
              <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded transition-colors">
                Cancelar
              </button>
              <button form="client-form" type="submit" className="px-6 py-2 bg-[#2E353B] hover:bg-black transition-colors text-white text-sm font-bold rounded shadow-sm">
                Guardar
              </button>
            </div>
            
          </div>
        </div>
      </div>
    </div>
  );
}

