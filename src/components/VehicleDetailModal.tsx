import React, { useState, useEffect } from 'react';
import imageCompression from 'browser-image-compression';
import { useAuth } from '../contexts/AuthContext';
import { db, storage } from '../lib/firebase';
import { collection, doc, setDoc, onSnapshot, query, where, deleteDoc, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Vehicle, VehicleExpense, Agency, Client } from '../types';
import { X, Upload, Trash2, Plus, DollarSign, Edit2 } from 'lucide-react';

interface Props {
  vehicle: Vehicle | Partial<Vehicle>;
  onClose: () => void;
}

export function VehicleDetailModal({ vehicle, onClose }: Props) {
  const { userData } = useAuth();
  const isNew = !vehicle.id;
  const [activeTab, setActiveTab] = useState<'info' | 'expenses'>('info');
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [formData, setFormData] = useState<Partial<Vehicle>>(
    isNew ? { 
      status: 'available', 
      agencyId: userData?.agencyId === 'unassigned' ? '' : userData?.agencyId, 
      make: '', model: '', year: new Date().getFullYear(), color: '',
      transmission: 'Automática', bodyType: 'Sedán', photoUrl: '',
      price: 0, purchasePrice: 0, vin: '',
      km: 0, receivedAt: new Date().toISOString().split('T')[0], cylinders: 4, liters: 0, equipment: ''
    } : vehicle
  );
  const [expenses, setExpenses] = useState<VehicleExpense[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);

  // Expense form
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [expDesc, setExpDesc] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expDate, setExpDate] = useState(new Date().toISOString().split('T')[0]);

  const [selectedClientId, setSelectedClientId] = useState<string>('');

  useEffect(() => {
    if (userData?.role === 'master') {
      getDocs(collection(db, 'agencies')).then(snap => {
        setAgencies(snap.docs.map(d => ({ id: d.id, ...d.data() } as Agency)));
      });
    }
  }, [userData?.role]);

  useEffect(() => {
    if (userData?.role === 'seller' && userData?.agencyId) {
      const q = query(
        collection(db, 'clients'), 
        where('agencyId', '==', userData.agencyId),
        where('sellerId', '==', userData.id)
      );
      getDocs(q).then(snap => {
        setClients(snap.docs.map(d => ({ id: d.id, ...d.data() } as Client)));
      });
    }
  }, [userData]);

  useEffect(() => {
    if (isNew || !vehicle.id) return;
    const q = query(collection(db, 'vehicleExpenses'), where('vehicleId', '==', vehicle.id));
    const unsub = onSnapshot(q, snap => {
      setExpenses(snap.docs.map(d => ({id: d.id, ...d.data()}) as VehicleExpense));
    });
    return () => unsub();
  }, [vehicle.id, isNew]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.agencyId || formData.agencyId === 'unassigned') {
      setErrorStatus('Debes pertenecer o seleccionar una agencia para guardar vehículos.');
      return;
    }
    setLoading(true);
    setErrorStatus(null);
    try {
      const docRef = isNew ? doc(collection(db, 'vehicles')) : doc(db, 'vehicles', vehicle.id!);
      
      const payload: any = {
        ...formData,
        createdAt: isNew ? new Date().toISOString() : formData.createdAt,
        updatedAt: new Date().toISOString()
      };

      const isSeller = userData?.role === 'seller';
      if (isSeller) {
         if (!isNew) {
            delete payload.price; // Sellers cannot change the price of existing vehicles
         }
         
         // Handle status changes for sellers
         if (formData.status === 'reserved' || formData.status === 'sold') {
           if (isNew || vehicle.status !== formData.status) {
              if (!selectedClientId) {
                 setErrorStatus('Debes seleccionar un cliente para reservar o vender.');
                 setLoading(false);
                 return;
              }
              const clientInfo = clients.find(c => c.id === selectedClientId);
              payload.pendingValidation = {
                type: formData.status,
                requestedBy: userData?.id,
                requestedByName: userData?.name || userData?.email,
                clientId: selectedClientId,
                clientName: clientInfo?.name || 'Cliente Desconocido',
                requestedAt: new Date().toISOString()
              };
              payload.status = isNew ? 'available' : vehicle.status; // Revert to previous status until validated
           }
         }
      }

      await setDoc(docRef, payload, { merge: true });
      onClose();
    } catch (err) {
      console.error(err);
      setErrorStatus('Error guardando vehículo');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!formData.agencyId || formData.agencyId === 'unassigned') {
      setErrorStatus('Debes seleccionar una agencia antes de subir fotos.');
      return;
    }
    setErrorStatus(null);
    setUploading(true);
    try {
      const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true
      };
      const compressedFile = await imageCompression(file, options);
      
      const vId = vehicle.id || 'temp_' + Date.now();
      const storageRef = ref(storage, `users/${userData?.id}/vehicles/${vId}/${compressedFile.name}`);
      await uploadBytes(storageRef, compressedFile);
      const url = await getDownloadURL(storageRef);
      setFormData(prev => ({ ...prev, photoUrl: url }));
    } catch (err) {
      console.error('Upload failed', err);
      setErrorStatus('Error al subir foto (revisa permisos)');
    } finally {
      setUploading(false);
    }
  };

  const handleAddOrEditExpense = async () => {
    if (!expDesc || !expAmount || !vehicle.id) return;
    
    try {
      const expRef = editingExpenseId 
        ? doc(db, 'vehicleExpenses', editingExpenseId) 
        : doc(collection(db, 'vehicleExpenses'));
        
      await setDoc(expRef, {
        vehicleId: vehicle.id,
        description: expDesc,
        amount: Number(expAmount),
        date: expDate,
        addedBy: userData?.id
      }, { merge: true });
      
      setExpDesc('');
      setExpAmount('');
      setEditingExpenseId(null);
    } catch(err) {
      console.error("Error saving expense", err);
    }
  };

  const handleEditClick = (exp: VehicleExpense) => {
    setEditingExpenseId(exp.id);
    setExpDesc(exp.description);
    setExpAmount(exp.amount.toString());
    setExpDate(exp.date);
  };

  const cancelEdit = () => {
    setEditingExpenseId(null);
    setExpDesc('');
    setExpAmount('');
    setExpDate(new Date().toISOString().split('T')[0]);
  };

  const handleDeleteExpense = async (id: string) => {
    // Avoid window.confirm as it blocks execution in some iframes
    try {
      await deleteDoc(doc(db, 'vehicleExpenses', id));
      if (editingExpenseId === id) {
        cancelEdit();
      }
    } catch (err) {
      console.error("Error deleting expense", err);
    }
  };

  const isAdmin = userData?.role === 'admin' || userData?.role === 'master';
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const utility = (formData.price || 0) - (formData.purchasePrice || 0) - totalExpenses;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-slate-50 dark:bg-slate-900 shrink-0">
          <div className="flex items-center gap-4 text-sm">
            <button 
               onClick={() => setActiveTab('info')}
               className={`font-semibold border-b-2 px-1 py-2 transition-colors ${activeTab === 'info' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-300'}`}
            >
              Info del Vehículo
            </button>
            {!isNew && (
              <button 
                 onClick={() => setActiveTab('expenses')}
                 className={`font-semibold border-b-2 px-1 py-2 transition-colors ${activeTab === 'expenses' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-300'}`}
              >
                Gastos
              </button>
            )}
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:text-slate-400 hover:bg-slate-200 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {errorStatus && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm font-medium">
              {errorStatus}
            </div>
          )}
          {activeTab === 'info' && (
            <form id="vehicle-form" onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
              {/* Left Column - Photo & Status */}
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Foto del Vehículo</label>
                  <div className="aspect-video bg-slate-100 dark:bg-slate-700 rounded-xl relative overflow-hidden flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-600">
                    {formData.photoUrl ? (
                      <>
                        <img src={formData.photoUrl} alt="Vehicle" className="absolute inset-0 w-full h-full object-cover" />
                        <label className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer text-white">
                          <Upload className="w-8 h-8 mb-2" />
                          <span className="font-medium">Cambiar Foto</span>
                          <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} disabled={uploading} />
                        </label>
                      </>
                    ) : (
                      <label className="cursor-pointer flex flex-col items-center justify-center w-full h-full text-slate-500 dark:text-slate-400 hover:text-blue-600 hover:bg-slate-50 dark:bg-slate-900 transition-colors">
                        {uploading ? <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600 mb-2"></div> : <Upload className="w-8 h-8 mb-2" />}
                        <span className="font-medium">{uploading ? 'Subiendo...' : 'Subir Imagen'}</span>
                        <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} disabled={uploading} />
                      </label>
                    )}
                  </div>
                </div>

                {userData?.role === 'master' && (
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Agencia (Master)</label>
                    <select
                      value={formData.agencyId || ''}
                      onChange={e => setFormData({...formData, agencyId: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800"
                      required
                    >
                      <option value="" disabled>Selecciona una agencia...</option>
                      {agencies.map(a => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Estado</label>
                    <select
                      value={formData.status}
                      onChange={e => setFormData({...formData, status: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-700 dark:text-slate-300"
                    >
                      <option value="available">Disponible</option>
                      <option value="reserved">Reservado</option>
                      <option value="sold">Vendido</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Precio de Venta</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="number" required
                        value={formData.price || ''}
                        onChange={e => setFormData({...formData, price: Number(e.target.value)})}
                        readOnly={userData?.role === 'seller' && !isNew}
                        className={`w-full pl-9 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-700 dark:text-slate-300 ${userData?.role === 'seller' && !isNew ? 'bg-slate-100 dark:bg-slate-700 cursor-not-allowed' : 'bg-white dark:bg-slate-800'}`} 
                      />
                    </div>
                  </div>
                  {(formData.status === 'reserved' || formData.status === 'sold') && userData?.role === 'seller' && (
                    <div className="col-span-2">
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Cliente Solicitante</label>
                      <select
                        value={selectedClientId}
                        onChange={e => setSelectedClientId(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800"
                        required
                      >
                        <option value="" disabled>Selecciona un cliente...</option>
                        {clients.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {isAdmin && (
                  <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                    <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1 flex items-center justify-between">
                      <span>Precio de Compra</span>
                      <span className="text-[10px] bg-slate-200 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded font-bold uppercase tracking-wider">Solo Admin</span>
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="number"
                        value={formData.purchasePrice || ''}
                        onChange={e => setFormData({...formData, purchasePrice: Number(e.target.value)})}
                        className="w-full pl-9 pr-3 py-2 border rounded-lg bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 text-slate-700 dark:text-slate-300" 
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column - Form Data */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Marca</label>
                    <input type="text" required value={formData.make} onChange={e=>setFormData({...formData, make: e.target.value})} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Modelo</label>
                    <input type="text" required value={formData.model} onChange={e=>setFormData({...formData, model: e.target.value})} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Año</label>
                    <input type="number" required value={formData.year} onChange={e=>setFormData({...formData, year: Number(e.target.value)})} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Color</label>
                    <input type="text" required value={formData.color} onChange={e=>setFormData({...formData, color: e.target.value})} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Transmisión</label>
                    <select value={formData.transmission} onChange={e=>setFormData({...formData, transmission: e.target.value})} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200">
                      <option>Automática</option>
                      <option>Manual</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Carrocería</label>
                    <select value={formData.bodyType} onChange={e=>setFormData({...formData, bodyType: e.target.value})} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200">
                      <option>Sedán</option>
                      <option>SUV</option>
                      <option>Hatchback</option>
                      <option>Pickup</option>
                      <option>Coupé</option>
                      <option>Van</option>
                      <option>Minivan</option>
                      <option>Convertible</option>
                      <option>Premium</option>
                      <option>4X4</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">VIN Number</label>
                    <input type="text" value={formData.vin} onChange={e=>setFormData({...formData, vin: e.target.value})} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-mono text-sm uppercase" maxLength={17} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Kilometraje (Km)</label>
                    <input type="number" required value={formData.km} onChange={e=>setFormData({...formData, km: Number(e.target.value)})} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Cilindros</label>
                    <input type="number" value={formData.cylinders} onChange={e=>setFormData({...formData, cylinders: Number(e.target.value)})} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Motor (Litros)</label>
                    <input type="number" step="0.1" value={formData.liters} onChange={e=>setFormData({...formData, liters: Number(e.target.value)})} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Fecha de Recepción</label>
                    <input type="date" value={typeof formData.receivedAt === 'string' ? formData.receivedAt.split('T')[0] : ''} onChange={e=>setFormData({...formData, receivedAt: e.target.value})} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Equipamiento</label>
                    <input type="text" value={formData.equipment} onChange={e=>setFormData({...formData, equipment: e.target.value})} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200" placeholder="Ej. Quemacocos, Piel..." />
                  </div>
                </div>

                {!isNew && isAdmin && (
                  <div className="mt-8 p-4 bg-green-50 rounded-xl border border-green-200">
                    <h4 className="text-sm font-bold text-green-900 mb-2">Resumen Financiero</h4>
                    <div className="space-y-1 text-sm text-green-800">
                      <div className="flex justify-between">
                        <span>Venta Promyectada:</span>
                        <span>${Number(formData.price || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Costo de Compra:</span>
                        <span className="text-red-600">-${Number(formData.purchasePrice || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Gastos Acumulados:</span>
                        <span className="text-red-600">-${totalExpenses.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between font-bold pt-2 border-t border-green-200/50 mt-2 text-base">
                        <span>Utilidad Neta Proyectada:</span>
                        <span className={utility >= 0 ? "text-green-700" : "text-red-600"}>${utility.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </form>
          )}

          {activeTab === 'expenses' && !isNew && (
            <div className="h-full flex flex-col">
              <div className="flex flex-wrap gap-4 mb-6 p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border items-center">
                <input 
                  type="date" 
                  value={expDate} 
                  onChange={e=>setExpDate(e.target.value)} 
                  className="px-3 py-2 border rounded-lg text-sm" 
                />
                <input 
                  type="text" 
                  placeholder="Descripción del gasto..." 
                  value={expDesc} 
                  onChange={e=>setExpDesc(e.target.value)} 
                  className="flex-1 px-3 py-2 border rounded-lg text-sm min-w-[200px]" 
                />
                <div className="relative w-32">
                  <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="number" 
                    placeholder="Monto" 
                    value={expAmount} 
                    onChange={e=>setExpAmount(e.target.value)} 
                    className="w-full pl-8 pr-3 py-2 border rounded-lg text-sm" 
                  />
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={handleAddOrEditExpense}
                    disabled={!expDesc || !expAmount}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap"
                  >
                    {editingExpenseId ? 'Guardar Cambios' : 'Agregar Gasto'}
                  </button>
                  {editingExpenseId && (
                    <button 
                      onClick={cancelEdit}
                      className="bg-slate-200 hover:bg-slate-300 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-auto border rounded-xl">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 border-b uppercase">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Fecha</th>
                      <th className="px-4 py-3 font-semibold">Descripción</th>
                      <th className="px-4 py-3 font-semibold">Monto</th>
                      <th className="px-4 py-3 font-semibold text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map(exp => (
                      <tr key={exp.id} className={`border-b last:border-0 hover:bg-slate-50 dark:bg-slate-900/50 ${editingExpenseId === exp.id ? 'bg-blue-50/50' : ''}`}>
                        <td className="px-4 py-3 whitespace-nowrap">{new Date(exp.date).toLocaleDateString()}</td>
                        <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">{exp.description}</td>
                        <td className="px-4 py-3 text-red-600 font-medium">${exp.amount.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right">
                          <button type="button" onClick={() => handleEditClick(exp)} className="text-slate-400 hover:text-blue-600 p-1 mr-2">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button type="button" onClick={() => handleDeleteExpense(exp.id)} className="text-slate-400 hover:text-red-600 p-1">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {expenses.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                          No hay gastos registrados para este vehículo.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {expenses.length > 0 && (
                    <tfoot className="bg-slate-50 dark:bg-slate-900 font-bold border-t">
                      <tr>
                        <td colSpan={2} className="px-4 py-3 text-right">Total Gastos:</td>
                        <td className="px-4 py-3 text-red-600">${totalExpenses.toLocaleString()}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {activeTab === 'info' && (
          <div className="p-4 border-t bg-slate-50 dark:bg-slate-900 flex justify-end gap-3 shrink-0">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-200 rounded-lg">Cancelar</button>
            <button type="submit" form="vehicle-form" disabled={loading || uploading} className="px-4 py-2 text-sm text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-lg font-bold">
              {loading ? 'Guardando...' : 'Guardar Vehículo'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

