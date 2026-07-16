import { toJpeg } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { QRCodeSVG } from 'qrcode.react';
import React, { useState, useEffect } from 'react';
import imageCompression from 'browser-image-compression';
import { useAuth } from '../contexts/AuthContext';
import { db, storage } from '../lib/firebase';
import { collection, doc, setDoc, onSnapshot, query, where, deleteDoc, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Vehicle, VehicleExpense, Agency, Client } from '../types';
import { useIsMobile } from '../hooks/useIsMobile';
import { deduplicateClients } from '../lib/clientUtils';
import { X, Upload, Trash2, Plus, DollarSign, Edit2, Printer, Share2 } from 'lucide-react';

interface Props {
  vehicle: Vehicle | Partial<Vehicle>;
  onClose: () => void;
}

export function VehicleDetailModal({ vehicle, onClose }: Props) {
  const { userData } = useAuth();
  const isNew = !vehicle.id;
  const isMobile = useIsMobile();
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const pdfRef = React.useRef<HTMLDivElement>(null);

  const [activeTab, setActiveTab] = useState<'info' | 'expenses'>('info');
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [formData, setFormData] = useState<Partial<Vehicle>>(
    isNew ? { 
      status: 'available', 
      agencyId: userData?.agencyId === 'unassigned' ? '' : userData?.agencyId, 
      make: '', model: '', year: new Date().getFullYear(), color: '',
      transmission: 'Automática', bodyType: 'Sedán', photoUrl: '',
      price: 0, purchasePrice: 0, vin: '', websiteUrl: '',
      km: 0, 
      ownership: 'propio',
      receivedAt: (() => {
        const d = new Date();
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      })(), 
      cylinders: 4, liters: 0, equipment: '', passengers: 5
    } : {
      status: 'available', 
      agencyId: '', 
      make: '', model: '', year: new Date().getFullYear(), color: '',
      transmission: 'Automática', bodyType: 'Sedán', photoUrl: '',
      price: 0, purchasePrice: 0, vin: '', websiteUrl: '',
      km: 0, ownership: 'propio', receivedAt: '', cylinders: 4, liters: 0, equipment: '', passengers: 5,
      ...vehicle
    }
  );
  const [expenses, setExpenses] = useState<VehicleExpense[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);

  // Expense form
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [expDesc, setExpDesc] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const getLocalDateString = () => {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };

  const getFinancingInfo = (year: number, price: number) => {
    const plans: Record<number, { maxTerm: number, minDownPayment: number, minRate: string, maxRate: string }> = {
      2014: { maxTerm: 12, minDownPayment: 0.5, minRate: "30.00%", maxRate: "30.00%" },
      2015: { maxTerm: 18, minDownPayment: 0.5, minRate: "30.00%", maxRate: "30.00%" },
      2016: { maxTerm: 60, minDownPayment: 0.2, minRate: "30.00%", maxRate: "30.00%" },
      2017: { maxTerm: 60, minDownPayment: 0.2, minRate: "14.99%", maxRate: "15.99%" },
      2018: { maxTerm: 60, minDownPayment: 0.2, minRate: "14.99%", maxRate: "15.99%" },
      2019: { maxTerm: 60, minDownPayment: 0.2, minRate: "13.99%", maxRate: "14.99%" },
      2020: { maxTerm: 60, minDownPayment: 0.2, minRate: "13.99%", maxRate: "15.99%" },
      2021: { maxTerm: 60, minDownPayment: 0.2, minRate: "13.99%", maxRate: "14.99%" },
      2022: { maxTerm: 72, minDownPayment: 0.2, minRate: "13.99%", maxRate: "15.24%" },
      2023: { maxTerm: 84, minDownPayment: 0.2, minRate: "13.99%", maxRate: "15.24%" },
      2024: { maxTerm: 96, minDownPayment: 0.2, minRate: "13.99%", maxRate: "15.74%" },
      2025: { maxTerm: 120, minDownPayment: 0.2, minRate: "13.99%", maxRate: "15.99%" },
      2026: { maxTerm: 120, minDownPayment: 0.2, minRate: "13.99%", maxRate: "16.24%" },
    };
    
    if (year < 2014) return null;
    let planYear = year;
    if (year > 2026) planYear = 2026;
    
    const plan = plans[planYear];
    if (!plan) return null;
    
    return {
      downPaymentPct: plan.minDownPayment * 100,
      downPaymentAmount: price * plan.minDownPayment,
      maxTerm: plan.maxTerm,
      minRate: plan.minRate,
      maxRate: plan.maxRate
    };
  };

  const handleSharePDF = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!pdfRef.current || isGeneratingPDF || !vehicle) return;
    setIsGeneratingPDF(true);

    try {
      // Fetch image as dataURL to prevent CORS issues
      const imageSrc = formData.photoUrls?.[0] || formData.photoUrl || vehicle?.photoUrls?.[0] || vehicle?.photoUrl;
      const originalImgNode = pdfRef.current.querySelector('img');
      let originalSrc = '';
      
      if (imageSrc && originalImgNode) {
        try {
          originalSrc = originalImgNode.src;
          // Use our local proxy to avoid CORS issues
          const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(imageSrc)}`;
          originalImgNode.src = proxyUrl;
          // Wait for the image to load from the proxy
          await new Promise((resolve, reject) => {
             const img = new Image();
             img.onload = resolve;
             img.onerror = reject;
             img.src = proxyUrl;
          });
        } catch (err) {
          console.warn("Failed to load proxied image for PDF", err);
          originalImgNode.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
        }
      }

      const imgData = await toJpeg(pdfRef.current, { 
        quality: 0.9,
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        cacheBust: true
      });

      if (originalImgNode && originalSrc) {
        // Restore original src
        originalImgNode.src = originalSrc;
      }

      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'px',
        format: [800, 1131]
      });
      
      pdf.addImage(imgData, 'JPEG', 0, 0, 800, 1131);
      const pdfBlob = pdf.output('blob');
      
      const file = new File([pdfBlob], `${vehicle.make || 'Vehiculo'}_${vehicle.model || ''}.pdf`, { type: 'application/pdf' });
      
      // Check if navigator.share is available and supports files
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            title: `Ficha Técnica - ${vehicle.make || ''} ${vehicle.model || ''}`,
            text: `Revisa este increíble ${vehicle.make || ''} ${vehicle.model || ''} ${vehicle.year || ''}!`,
            files: [file]
          });
        } catch (shareErr) {
          // If share fails (e.g. user canceled), just fallback to open/save
          const pdfUrl = URL.createObjectURL(pdfBlob);
          window.open(pdfUrl, '_blank');
        }
      } else {
        const pdfUrl = URL.createObjectURL(pdfBlob);
        window.open(pdfUrl, '_blank');
      }
    } catch (error) {
      console.error('Error sharing PDF:', error);
      alert('Error PDF: ' + (error.message || error));
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const [expDate, setExpDate] = useState(getLocalDateString());

  const [selectedClientId, setSelectedClientId] = useState<string>('');

  useEffect(() => {
    if (!isNew && vehicle) {
      setFormData({ ...vehicle });
    }
  }, [vehicle, isNew]);

  useEffect(() => {
    if (userData?.role === 'master') {
      getDocs(collection(db, 'agencies')).then(snap => {
        setAgencies(snap.docs.map(d => ({ ...d.data(), id: d.id } as Agency)));
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
        const rawClients = snap.docs.map(d => ({ ...d.data(), id: d.id } as Client));
        setClients(deduplicateClients(rawClients));
      });
    }
  }, [userData]);

  useEffect(() => {
    if (isNew || !vehicle.id) return;
    const q = query(collection(db, 'vehicleExpenses'), where('vehicleId', '==', vehicle.id));
    const unsub = onSnapshot(q, snap => {
      setExpenses(snap.docs.map(d => ({ ...d.data(), id: d.id }) as VehicleExpense));
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
    const files = e.target.files;
    if (!files || files.length === 0) return;
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
      
      const vId = vehicle.id || 'temp_' + Date.now();
      const newUrls: string[] = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const compressedFile = await imageCompression(file, options);
        const fileName = `${Date.now()}_${compressedFile.name}`;
        const storageRef = ref(storage, `users/${userData?.id}/vehicles/${vId}/${fileName}`);
        await uploadBytes(storageRef, compressedFile);
        const url = await getDownloadURL(storageRef);
        newUrls.push(url);
      }
      
      setFormData(prev => ({ 
        ...prev, 
        photoUrl: prev.photoUrl || newUrls[0],
        photoUrls: [...(prev.photoUrls || []), ...newUrls]
      }));
    } catch (err) {
      console.error('Upload failed', err);
      setErrorStatus('Error al subir foto (revisa permisos)');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const removePhoto = (index: number) => {
    setFormData(prev => {
      const newUrls = [...(prev.photoUrls || [])];
      newUrls.splice(index, 1);
      return {
        ...prev,
        photoUrl: newUrls.length > 0 ? newUrls[0] : '',
        photoUrls: newUrls
      };
    });
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
    setExpDate(getLocalDateString());
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
            {!isNew && userData?.role !== 'seller' && (
              <button 
                 onClick={() => setActiveTab('expenses')}
                 className={`font-semibold border-b-2 px-1 py-2 transition-colors ${activeTab === 'expenses' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-300'}`}
              >
                Gastos
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!isNew && (
              <button 
                onClick={handleSharePDF}
                disabled={isGeneratingPDF}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors mr-2 shadow-sm"
                title="Generar Ficha en PDF"
              >
                <Share2 className="w-4 h-4" />
                <span className="hidden sm:inline">{isGeneratingPDF ? 'Generando...' : 'Ficha PDF'}</span>
                <span className="sm:hidden">{isGeneratingPDF ? '...' : 'PDF'}</span>
              </button>
            )}

            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:text-slate-400 hover:bg-slate-200 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
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
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Fotos del Vehículo</label>
                  
                  {/* Primary Photo */}
                  {(() => {
                    const allPhotos = formData.photoUrls || (formData.photoUrl ? [formData.photoUrl] : []);
                    if (allPhotos.length > 0) {
                      return (
                        <div className="relative w-full h-56 md:h-64 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 mb-3 group">
                          <img src={allPhotos[0]} alt="Principal" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removePhoto(0)}
                            className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white p-1.5 rounded-full opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-4 h-4" />
                          </button>
                          <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm text-white text-xs font-bold px-2 py-1 rounded-md">
                            FOTO PRINCIPAL
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-2">
                    {/* Render additional photos */}
                    {(formData.photoUrls || (formData.photoUrl ? [formData.photoUrl] : [])).slice(1).map((url, idx) => (
                      <div key={idx + 1} className="aspect-square relative rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 group">
                        <img src={url} alt={`Vehicle ${idx + 2}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removePhoto(idx + 1)}
                          className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white p-1 rounded-full opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    
                    {/* Add new photo button */}
                    <label className="aspect-square flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                      {uploading ? (
                        <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-600 mb-1"></div>
                      ) : (
                        <Plus className="w-6 h-6 text-slate-400 mb-1" />
                      )}
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        {uploading ? '...' : 'Añadir'}
                      </span>
                      <input type="file" accept="image/*" multiple className="hidden" onChange={handleFileUpload} disabled={uploading} />
                    </label>
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
                        <option key={`agency-${a.id}`} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Estado</label>
                    <select
                      value={formData.status}
                      onChange={e => {
                        const newStatus = e.target.value;
                        const newFormData = { ...formData, status: newStatus };
                        if (newStatus === 'sold' && !formData.soldAt) {
                          newFormData.soldAt = new Date().toISOString().split('T')[0];
                        }
                        setFormData(newFormData);
                      }}
                      className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-700 dark:text-slate-300"
                    >
                      <option value="available">Disponible</option>
                      <option value="reserved">Reservado</option>
                      <option value="sold">Vendido</option>
                    </select>
                  </div>
                  {formData.status === 'sold' && (
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Fecha de Venta</label>
                      <input 
                        type="date" 
                        value={formData.soldAt ? formData.soldAt.split('T')[0] : ''} 
                        onChange={e => setFormData({...formData, soldAt: e.target.value})}
                        className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Precio de Venta</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="number" inputMode="numeric" pattern="[0-9]*" required
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
                          <option key={`client-${c.id}`} value={c.id}>{c.name}</option>
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
                        type="number" inputMode="numeric" pattern="[0-9]*"
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
                    <input type="text" required value={formData.make || ''} onChange={e=>setFormData({...formData, make: e.target.value})} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Modelo</label>
                    <input type="text" required value={formData.model || ''} onChange={e=>setFormData({...formData, model: e.target.value})} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Año</label>
                    <input type="number" inputMode="numeric" pattern="[0-9]*" required value={formData.year || ''} onChange={e=>setFormData({...formData, year: Number(e.target.value)})} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Color</label>
                    <input type="text" required value={formData.color || ''} onChange={e=>setFormData({...formData, color: e.target.value})} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Transmisión</label>
                    <select value={formData.transmission || ''} onChange={e=>setFormData({...formData, transmission: e.target.value})} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200">
                      <option>Automática</option>
                      <option>Manual</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Carrocería</label>
                    <select value={formData.bodyType || ''} onChange={e=>setFormData({...formData, bodyType: e.target.value})} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200">
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
                    <input type="text" value={formData.vin || ''} onChange={e=>setFormData({...formData, vin: e.target.value})} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-mono text-sm uppercase" maxLength={17} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Kilometraje (Km)</label>
                    <input type="number" inputMode="numeric" pattern="[0-9]*" required value={formData.km || ''} onChange={e=>setFormData({...formData, km: Number(e.target.value)})} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200" />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Link de Página Web (Opcional)</label>
                  <input type="url" placeholder="https://..." value={formData.websiteUrl || ''} onChange={e=>setFormData({...formData, websiteUrl: e.target.value})} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Cilindros</label>
                    <input type="number" inputMode="numeric" pattern="[0-9]*" value={formData.cylinders || ''} onChange={e=>setFormData({...formData, cylinders: Number(e.target.value)})} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Motor (Litros)</label>
                    <input type="number" inputMode="numeric" pattern="[0-9]*" step="0.1" value={formData.liters || ''} onChange={e=>setFormData({...formData, liters: Number(e.target.value)})} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Fecha de Recepción</label>
                    <input type="date" value={typeof formData.receivedAt === 'string' ? formData.receivedAt.split('T')[0] : ''} onChange={e=>setFormData({...formData, receivedAt: e.target.value})} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Pasajeros</label>
                    <input type="number" inputMode="numeric" pattern="[0-9]*" value={formData.passengers || ''} onChange={e=>setFormData({...formData, passengers: parseInt(e.target.value) || undefined})} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200" placeholder="Ej. 5" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Equipamiento</label>
                    <input type="text" value={formData.equipment || ''} onChange={e=>setFormData({...formData, equipment: e.target.value})} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200" placeholder="Ej. Quemacocos, Piel..." />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tipo de Propiedad</label>
                    <select value={formData.ownership || 'propio'} onChange={e=>setFormData({...formData, ownership: e.target.value})} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200">
                      <option value="propio">Propio</option>
                      <option value="consignacion">Consignación</option>
                    </select>
                  </div>
                </div>

                {!isNew && isAdmin && (
                  <div className="mt-8 p-4 bg-green-50 rounded-xl border border-green-200">
                    <h4 className="text-sm font-bold text-green-900 mb-2">Resumen Financiero</h4>
                    <div className="space-y-1 text-sm text-green-800">
                      <div className="flex justify-between">
                        <span>Venta Proyectada:</span>
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

          {activeTab === 'expenses' && !isNew && userData?.role !== 'seller' && (
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
                    type="number" inputMode="numeric" pattern="[0-9]*" 
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
                      <tr key={`expense-${exp.id}`} className={`border-b last:border-0 hover:bg-slate-50 dark:bg-slate-900/50 ${editingExpenseId === exp.id ? 'bg-blue-50/50' : ''}`}>
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

        {/* Hidden PDF View */}
        <div className="fixed top-[-9999px] left-[-9999px] pointer-events-none w-[800px] max-w-none">
          <div ref={pdfRef} className="w-[800px] h-[1131px] flex flex-col p-8 font-sans relative overflow-hidden" style={{ background: 'linear-gradient(to bottom right, #0f172a, #1e293b)', color: '#ffffff' }}>
            
            {/* Header section with brand/agency name if available */}
            <div className="w-full flex justify-between items-center mb-6 z-10">
               <div className="text-3xl font-black tracking-widest" style={{ color: 'rgba(255, 255, 255, 0.5)' }}>FICHA TÉCNICA</div>
               <div className="text-3xl font-bold px-6 py-2 rounded-full" style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', color: '#60a5fa' }}>
                 {userData?.role === 'master' ? 'AUTO DEALER' : 'NUESTRO INVENTARIO'}
               </div>
            </div>

            {/* Top row: Image on left, Title & Price on right */}
            <div className="flex w-full gap-6 mb-8 z-10">
               {/* Left: Image */}
               <div className="w-[420px] h-[320px] rounded-[30px] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] border-[6px] relative flex items-center justify-center shrink-0" style={{ borderColor: 'rgba(255,255,255,0.1)', backgroundColor: '#1e293b' }}>
                  {(formData.photoUrls?.[0] || formData.photoUrl || vehicle?.photoUrls?.[0] || vehicle?.photoUrl) ? (
                    <img 
                      src={formData.photoUrls?.[0] || formData.photoUrl || vehicle?.photoUrls?.[0] || vehicle?.photoUrl} 
                      alt={`${vehicle.make} ${vehicle.model}`}
                      className="w-full h-full object-cover"
                      crossOrigin="anonymous"
                    />
                  ) : (
                    <div className="text-3xl font-medium flex flex-col items-center" style={{ color: '#64748b' }}>
                      <span>Sin Imagen</span>
                    </div>
                  )}
                  {vehicle.status === 'sold' && (
                    <div className="absolute inset-0 flex items-center justify-center backdrop-blur-sm" style={{ backgroundColor: 'rgba(220, 38, 38, 0.8)' }}>
                      <span className="font-black text-5xl rotate-[-15deg] uppercase tracking-widest border-4 p-4 rounded-3xl" style={{ color: '#ffffff', borderColor: '#ffffff' }}>VENDIDO</span>
                    </div>
                  )}
               </div>

               {/* Right: Title & Price */}
               <div className="flex-1 flex flex-col justify-center">
                  <h1 className="text-[50px] font-black uppercase leading-none tracking-tight mb-2" style={{ color: '#ffffff', textShadow: '0 5px 15px rgba(0,0,0,0.5)' }}>
                    {vehicle.make}
                  </h1>
                  <h2 className="text-[35px] font-bold tracking-wide mb-6" style={{ color: '#60a5fa' }}>
                    {vehicle.model} <span style={{ color: 'rgba(255, 255, 255, 0.3)' }}>|</span> <span style={{ color: '#ffffff' }}>{vehicle.year}</span>
                  </h2>
                  
                  {vehicle.price > 0 && (
                    <div className="w-full rounded-[24px] py-4 px-6 flex flex-col justify-center shadow-2xl" style={{ background: 'linear-gradient(to right, #2563eb, #3b82f6)' }}>
                      <span className="text-lg font-bold uppercase tracking-widest mb-1" style={{ color: 'rgba(255, 255, 255, 0.9)' }}>Precio de Venta</span>
                      <span className="text-[40px] font-black leading-none" style={{ color: '#ffffff' }}>${Number(vehicle.price).toLocaleString()}</span>
                    </div>
                  )}
               </div>
            </div>

            {/* Vehicle Specifications Grid */}
            <div className="w-full backdrop-blur-md rounded-[30px] p-6 border grid grid-cols-3 gap-x-8 gap-y-6 mb-8 z-10" style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', borderColor: 'rgba(255, 255, 255, 0.1)' }}>
              <div className="flex flex-col border-b-2 pb-4" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
                <span className="text-base font-semibold uppercase tracking-wider mb-1" style={{ color: '#93c5fd' }}>Kilometraje</span>
                <span className="text-2xl font-black" style={{ color: '#ffffff' }}>{Number(vehicle.km || 0).toLocaleString()} km</span>
              </div>
              <div className="flex flex-col border-b-2 pb-4" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
                <span className="text-base font-semibold uppercase tracking-wider mb-1" style={{ color: '#93c5fd' }}>Transmisión</span>
                <span className="text-2xl font-black" style={{ color: '#ffffff' }}>{vehicle.transmission}</span>
              </div>
              <div className="flex flex-col border-b-2 pb-4" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
                <span className="text-base font-semibold uppercase tracking-wider mb-1" style={{ color: '#93c5fd' }}>Color</span>
                <span className="text-2xl font-black" style={{ color: '#ffffff' }}>{vehicle.color}</span>
              </div>
              <div className="flex flex-col border-b-2 pb-4" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
                <span className="text-base font-semibold uppercase tracking-wider mb-1" style={{ color: '#93c5fd' }}>Carrocería</span>
                <span className="text-2xl font-black" style={{ color: '#ffffff' }}>{vehicle.bodyType}</span>
              </div>
              <div className="flex flex-col border-b-2 pb-4" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
                <span className="text-base font-semibold uppercase tracking-wider mb-1" style={{ color: '#93c5fd' }}>Motor</span>
                <span className="text-2xl font-black" style={{ color: '#ffffff' }}>{vehicle.cylinders ? `${vehicle.cylinders} Cil` : '-'} {vehicle.liters ? `/ ${vehicle.liters} L` : ''}</span>
              </div>
              <div className="flex flex-col border-b-2 pb-4" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
                <span className="text-base font-semibold uppercase tracking-wider mb-1" style={{ color: '#93c5fd' }}>Pasajeros</span>
                <span className="text-2xl font-black" style={{ color: '#ffffff' }}>{vehicle.passengers || '-'}</span>
              </div>
            </div>

            {/* Financing Info (If applicable) */}
            {vehicle.price > 0 && (
              <div className="w-full z-10 mb-8">
                {(() => {
                  const financing = getFinancingInfo(vehicle.year || new Date().getFullYear(), vehicle.price);
                  if (!financing) return null;
                  return (
                    <div className="w-full rounded-[30px] p-6 border grid grid-cols-2 gap-6 shadow-2xl" style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', borderColor: 'rgba(255, 255, 255, 0.1)' }}>
                      <div className="flex flex-col border-r-2" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
                        <span className="text-base font-semibold uppercase tracking-wider mb-2" style={{ color: '#a78bfa' }}>Enganche Min ({financing.downPaymentPct}%)</span>
                        <span className="text-3xl font-black" style={{ color: '#ffffff' }}>${Number(financing.downPaymentAmount).toLocaleString()}</span>
                      </div>
                      <div className="flex flex-col pl-4">
                        <span className="text-base font-semibold uppercase tracking-wider mb-2" style={{ color: '#a78bfa' }}>Plazo Máximo</span>
                        <span className="text-3xl font-black" style={{ color: '#ffffff' }}>{financing.maxTerm} Meses</span>
                        <span className="text-lg font-medium mt-2" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                          Tasa: {financing.minRate} - {financing.maxRate}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Footer / Contact info & QR */}
            <div className="w-full mt-auto flex items-end justify-between z-10">
               <div className="flex-1 pr-6 pb-2">
                 <p className="text-xl font-medium leading-relaxed" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>Contáctanos para más información o agenda tu prueba de manejo hoy mismo.</p>
               </div>
               {((formData.websiteUrl || vehicle.websiteUrl)) && (
                 <div className="flex flex-col items-center bg-white p-3 rounded-2xl shrink-0">
                   <QRCodeSVG value={formData.websiteUrl || vehicle.websiteUrl || ""} size={120} level="M" />
                   <span className="text-sm font-bold text-slate-800 mt-2 tracking-wider">VER ONLINE</span>
                 </div>
               )}
            </div>
            
            {/* Decorative elements */}
            <div className="absolute top-[-200px] right-[-200px] w-[600px] h-[600px] rounded-full blur-[100px] pointer-events-none" style={{ backgroundColor: 'rgba(59, 130, 246, 0.2)' }}></div>
            <div className="absolute bottom-[-200px] left-[-200px] w-[800px] h-[800px] rounded-full blur-[120px] pointer-events-none" style={{ backgroundColor: 'rgba(168, 85, 247, 0.2)' }}></div>
          </div>
        </div>
      </div>
    </div>
  );
}

