import { toJpeg } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { QRCodeSVG } from 'qrcode.react';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import imageCompression from 'browser-image-compression';
import { useAuth } from '../contexts/AuthContext';
import { db, storage } from '../lib/firebase';
import { collection, doc, setDoc, onSnapshot, query, where, deleteDoc, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Vehicle, VehicleExpense, Agency, Client } from '../types';
import { useIsMobile } from '../hooks/useIsMobile';
import { deduplicateClients } from '../lib/clientUtils';
import { useReadOnly } from '../hooks/useReadOnly';
import { X, Upload, Trash2, Plus, DollarSign, Edit2, Printer, Share2, MessageSquare, Sparkles } from 'lucide-react';

interface Props {
  vehicle: Vehicle | Partial<Vehicle>;
  onClose: () => void;
  clientContext?: Client;
}

export function VehicleDetailModal({ vehicle, onClose, clientContext }: Props) {
  const { userData } = useAuth();
  const navigate = useNavigate();
  const isNew = !vehicle.id;
  const isMobile = useIsMobile();
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const pdfRef = React.useRef<HTMLDivElement>(null);
  const [isGeneratingPartnersReport, setIsGeneratingPartnersReport] = useState(false);
  const partnerDocRef = React.useRef<HTMLDivElement>(null);

  const getPdfImageSrc = () => {
    const rawSrc = (formData.photoUrls && formData.photoUrls.length > 0)
      ? formData.photoUrls[0]
      : (formData.photoUrl || vehicle?.photoUrls?.[0] || vehicle?.photoUrl);
    if (!rawSrc) return '';
    if (rawSrc.startsWith('data:') || rawSrc.startsWith('blob:')) return rawSrc;
    return `/api/proxy-image?url=${encodeURIComponent(rawSrc)}`;
  };

  const [activeTab, setActiveTab] = useState<'info' | 'expenses' | 'checklist'>('info');
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
  const allPhotos = (formData.photoUrls && formData.photoUrls.length > 0)
    ? formData.photoUrls
    : (formData.photoUrl ? [formData.photoUrl] : []);
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
    if (!pdfRef.current || isGeneratingPDF) return;
    setIsGeneratingPDF(true);

    try {
      const rawSrc = (formData.photoUrls && formData.photoUrls.length > 0)
        ? formData.photoUrls[0]
        : (formData.photoUrl || vehicle?.photoUrls?.[0] || vehicle?.photoUrl);
      if (rawSrc) {
        // Preload image to browser cache to ensure it renders instantly in html-to-image
        await new Promise<void>((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve();
          img.onerror = () => resolve();
          if (rawSrc.startsWith('data:') || rawSrc.startsWith('blob:')) {
            img.src = rawSrc;
          } else {
            img.src = `/api/proxy-image?url=${encodeURIComponent(rawSrc)}`;
          }
        });
        // Short delay to let browser finish layout/decoding
        await new Promise(r => setTimeout(r, 250));
      }

      const imgData = await toJpeg(pdfRef.current, { 
        quality: 0.9,
        pixelRatio: 2,
        cacheBust: true,
        skipFonts: true,
        imagePlaceholder: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
      });

      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'px',
        format: [800, 1131]
      });
      
      pdf.addImage(imgData, 'JPEG', 0, 0, 800, 1131);
      const pdfBlob = pdf.output('blob');
      
      const file = new File([pdfBlob], `${formData.make || 'Vehiculo'}_${formData.model || ''}.pdf`, { type: 'application/pdf' });
      
      // Check if navigator.share is available and supports files
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            title: `Ficha Técnica - ${formData.make || ''} ${formData.model || ''}`,
            text: `Revisa este increíble ${formData.make || ''} ${formData.model || ''} ${formData.year || ''}!`,
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
    } catch (error: any) {
      console.error('Error sharing PDF:', error);
      const errorMsg = error instanceof Error ? error.message : (typeof error === 'object' ? 'Detalles de error no disponibles' : String(error));
      alert('Error PDF: ' + errorMsg);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleSharePartnersReport = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!partnerDocRef.current || isGeneratingPartnersReport) return;
    setIsGeneratingPartnersReport(true);

    try {
      const rawSrc = (formData.photoUrls && formData.photoUrls.length > 0)
        ? formData.photoUrls[0]
        : (formData.photoUrl || vehicle?.photoUrls?.[0] || vehicle?.photoUrl);
      if (rawSrc) {
        // Preload image
        await new Promise<void>((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve();
          img.onerror = () => resolve();
          if (rawSrc.startsWith('data:') || rawSrc.startsWith('blob:')) {
            img.src = rawSrc;
          } else {
            img.src = `/api/proxy-image?url=${encodeURIComponent(rawSrc)}`;
          }
        });
        await new Promise(r => setTimeout(r, 250));
      }

      const imgData = await toJpeg(partnerDocRef.current, { 
        quality: 0.9,
        pixelRatio: 2,
        cacheBust: true,
        skipFonts: true,
        imagePlaceholder: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
      });

      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'px',
        format: [800, 1131]
      });
      
      pdf.addImage(imgData, 'JPEG', 0, 0, 800, 1131);
      const pdfBlob = pdf.output('blob');
      
      const file = new File([pdfBlob], `Reporte_Socios_${formData.make || 'Vehiculo'}_${formData.model || ''}.pdf`, { type: 'application/pdf' });
      
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            title: `Reporte de Socios - ${formData.make || ''} ${formData.model || ''}`,
            text: `Reporte financiero confidencial del ${formData.make || ''} ${formData.model || ''} ${formData.year || ''}.`,
            files: [file]
          });
        } catch (shareErr) {
          const pdfUrl = URL.createObjectURL(pdfBlob);
          window.open(pdfUrl, '_blank');
        }
      } else {
        const pdfUrl = URL.createObjectURL(pdfBlob);
        window.open(pdfUrl, '_blank');
      }
    } catch (error: any) {
      console.error('Error sharing Partners PDF:', error);
      const errorMsg = error instanceof Error ? error.message : (typeof error === 'object' ? 'Detalles de error no disponibles' : String(error));
      alert('Error PDF: ' + errorMsg);
    } finally {
      setIsGeneratingPartnersReport(false);
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
      const currentUrls = (prev.photoUrls && prev.photoUrls.length > 0)
        ? [...prev.photoUrls]
        : (prev.photoUrl ? [prev.photoUrl] : []);
      const newUrls = [...currentUrls];
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
        addedBy: userData?.id,
        agencyId: vehicle.agencyId || userData?.agencyId || 'unassigned'
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

  const isMaster = userData?.role === 'master';
  const isOwnVehicle = isNew || formData.agencyId === userData?.agencyId;
  const isGlobalReadOnly = useReadOnly();
  const isAdmin = userData?.role === 'admin' || isMaster;
  const isReadOnly = isGlobalReadOnly || (!isOwnVehicle && !isMaster) || !isAdmin;

  const handleStartChat = async () => {
    if (!userData?.agencyId || !formData.agencyId) return;
    try {
      setLoading(true);
      const chatRoomId = [userData.agencyId, formData.agencyId].sort().join('_');
      
      const chatRef = doc(db, 'agencyChats', chatRoomId);
      await setDoc(chatRef, {
        id: chatRoomId,
        participants: [userData.agencyId, formData.agencyId],
        lastMessage: `Interés en: ${formData.year} ${formData.make} ${formData.model}`,
        lastMessageAt: new Date().toISOString(),
        unreadBy: {
          [formData.agencyId]: true,
          [userData.agencyId]: false
        }
      }, { merge: true });

      const messagesRef = collection(db, 'agencyChats', chatRoomId, 'messages');
      const newMessageDoc = doc(messagesRef);
      await setDoc(newMessageDoc, {
        id: newMessageDoc.id,
        senderId: userData.id || userData.email || 'system',
        senderAgencyId: userData.agencyId,
        text: `¡Hola! Estamos interesados en su vehículo de inventario compartido:\n🚙 *${formData.year} ${formData.make} ${formData.model}*\n💰 Precio: $${Number(formData.price || 0).toLocaleString()}\n📈 Km: ${Number(formData.km || 0).toLocaleString()} km\n🎨 Color: ${formData.color}\n⚙️ Transmisión: ${formData.transmission}`,
        createdAt: new Date().toISOString(),
        vehicleId: vehicle.id || ''
      });

      onClose();
      navigate('/chats', { state: { activeChatId: chatRoomId } });
    } catch (err: any) {
      console.error("Error starting internal chat", err);
      alert("No se pudo iniciar el chat: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const utility = (formData.price || 0) - (formData.purchasePrice || 0) - totalExpenses;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-slate-800 rounded shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-[#f4f5f5] dark:bg-slate-900 shrink-0">
          <div className="flex items-center gap-4 text-sm">
            <button 
               onClick={() => setActiveTab('info')}
               className={`font-semibold border-b-2 px-1 py-2 transition-colors ${activeTab === 'info' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-300'}`}
            >
              Info del Vehículo
            </button>
            {!isNew && userData?.role !== 'seller' && (isOwnVehicle || isMaster) && (
              <button 
                 onClick={() => setActiveTab('expenses')}
                 className={`font-semibold border-b-2 px-1 py-2 transition-colors ${activeTab === 'expenses' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-300'}`}
              >
                Gastos
              </button>
            )}
            {!isNew && (
              <button 
                 onClick={() => setActiveTab('checklist')}
                 className={`font-semibold border-b-2 px-1 py-2 transition-colors ${activeTab === 'checklist' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-300'}`}
              >
                Checklist
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!isNew && (
              <button 
                onClick={activeTab === 'expenses' ? handleSharePartnersReport : handleSharePDF}
                disabled={activeTab === 'expenses' ? isGeneratingPartnersReport : isGeneratingPDF}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded transition-colors mr-2 shadow-sm"
                title={activeTab === 'expenses' ? "Generar Reporte de Socios en PDF" : "Generar Ficha en PDF"}
              >
                <Share2 className="w-4 h-4" />
                <span className="hidden sm:inline">
                  {activeTab === 'expenses' 
                    ? (isGeneratingPartnersReport ? 'Generando...' : 'Reporte Socios') 
                    : (isGeneratingPDF ? 'Generando...' : 'Ficha PDF')
                  }
                </span>
                <span className="sm:hidden">
                  {activeTab === 'expenses' 
                    ? (isGeneratingPartnersReport ? '...' : 'Socios') 
                    : (isGeneratingPDF ? '...' : 'PDF')
                  }
                </span>
              </button>
            )}

            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:text-slate-400 hover:bg-slate-200 rounded">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {errorStatus && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded text-sm font-medium">
              {errorStatus}
            </div>
          )}
          {activeTab === 'info' && (
            <>
              {clientContext && (
                <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/60 rounded flex items-start gap-3 text-slate-850 dark:text-slate-100 shadow-sm">
                  <div className="bg-amber-100 dark:bg-amber-900/40 text-amber-650 dark:text-amber-400 p-2 rounded shrink-0 mt-0.5">
                    <Sparkles className="w-5 h-5 animate-pulse" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-sm text-amber-800 dark:text-amber-300">¡Match de Auto Encontrado!</h4>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                      Este vehículo de la agencia <span className="font-semibold text-slate-900 dark:text-white">{agencies.find(a => a.id === vehicle.agencyId)?.name || "otra agencia participante"}</span> coincide con lo que está buscando tu cliente:
                    </p>
                    <div className="mt-3 text-xs grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-slate-650 dark:text-slate-300 bg-white dark:bg-slate-900/60 p-3 rounded border border-gray-200 dark:border-slate-800">
                      <div><span className="font-bold text-slate-700 dark:text-slate-400">Cliente:</span> {clientContext.name}</div>
                      {clientContext.phone && <div><span className="font-bold text-slate-700 dark:text-slate-400">Teléfono:</span> {clientContext.phone}</div>}
                      {clientContext.email && <div><span className="font-bold text-slate-700 dark:text-slate-400">Email:</span> {clientContext.email}</div>}
                      {clientContext.wantedVehicle && (
                        <div className="col-span-1 sm:col-span-2 mt-1 border-t pt-1.5 border-gray-200 dark:border-slate-800">
                          <span className="font-bold text-slate-700 dark:text-slate-400">Preferencias de búsqueda:</span>{" "}
                          <span className="italic">
                            {[
                              clientContext.wantedVehicle.make || "Cualquier marca",
                              clientContext.wantedVehicle.model || "",
                              clientContext.wantedVehicle.yearMin || clientContext.wantedVehicle.yearMax
                                ? `(${clientContext.wantedVehicle.yearMin || "Cualquiera"} - ${clientContext.wantedVehicle.yearMax || "Cualquiera"})`
                                : "",
                              clientContext.wantedVehicle.priceMax ? `Máx: $${clientContext.wantedVehicle.priceMax.toLocaleString()}` : ""
                            ].filter(Boolean).join(" ")}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              <form id="vehicle-form" onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
              <fieldset disabled={isReadOnly} className="contents">
              {/* Left Column - Photo & Status */}
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Fotos del Vehículo</label>
                  
                  {/* Primary Photo */}
                  {(() => {
                    if (allPhotos.length > 0) {
                      return (
                        <div className="relative w-full h-56 md:h-64 rounded overflow-hidden border border-gray-200 dark:border-slate-700 mb-3 group">
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
                    {allPhotos.slice(1).map((url, idx) => (
                      <div key={idx + 1} className="aspect-square relative rounded overflow-hidden border border-gray-200 dark:border-slate-700 group">
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
                    <label className="aspect-square flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-600 rounded cursor-pointer hover:bg-[#f4f5f5] dark:hover:bg-slate-800 transition-colors">
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
                      className="w-full px-3 py-2 border rounded bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800"
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
                      className="w-full px-3 py-2 border rounded bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-700 dark:text-slate-300"
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
                        className="w-full px-3 py-2 border rounded bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500"
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
                        className={`w-full pl-9 pr-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 text-slate-700 dark:text-slate-300 ${userData?.role === 'seller' && !isNew ? 'bg-slate-100 dark:bg-slate-700 cursor-not-allowed' : 'bg-white dark:bg-slate-800'}`} 
                      />
                    </div>
                  </div>
                  {(formData.status === 'reserved' || formData.status === 'sold') && userData?.role === 'seller' && (
                    <div className="col-span-2">
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Cliente Solicitante</label>
                      <select
                        value={selectedClientId}
                        onChange={e => setSelectedClientId(e.target.value)}
                        className="w-full px-3 py-2 border rounded bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800"
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

                {isAdmin && (isOwnVehicle || isMaster) && (
                  <div className="p-4 bg-[#f4f5f5] dark:bg-slate-900 rounded border border-gray-200 dark:border-slate-700">
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
                        className="w-full pl-9 pr-3 py-2 border rounded bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 text-slate-700 dark:text-slate-300" 
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
                    <input type="text" required value={formData.make || ''} onChange={e=>setFormData({...formData, make: e.target.value})} className="w-full px-3 py-2 border rounded bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-slate-800 dark:text-slate-200" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Modelo</label>
                    <input type="text" required value={formData.model || ''} onChange={e=>setFormData({...formData, model: e.target.value})} className="w-full px-3 py-2 border rounded bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-slate-800 dark:text-slate-200" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Año</label>
                    <input type="number" inputMode="numeric" pattern="[0-9]*" required value={formData.year || ''} onChange={e=>setFormData({...formData, year: Number(e.target.value)})} className="w-full px-3 py-2 border rounded bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-slate-800 dark:text-slate-200" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Color</label>
                    <input type="text" required value={formData.color || ''} onChange={e=>setFormData({...formData, color: e.target.value})} className="w-full px-3 py-2 border rounded bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-slate-800 dark:text-slate-200" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Transmisión</label>
                    <select value={formData.transmission || ''} onChange={e=>setFormData({...formData, transmission: e.target.value})} className="w-full px-3 py-2 border rounded bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-slate-800 dark:text-slate-200">
                      <option>Automática</option>
                      <option>Manual</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Carrocería</label>
                    <select value={formData.bodyType || ''} onChange={e=>setFormData({...formData, bodyType: e.target.value})} className="w-full px-3 py-2 border rounded bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-slate-800 dark:text-slate-200">
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
                    <input type="text" value={formData.vin || ''} onChange={e=>setFormData({...formData, vin: e.target.value})} className="w-full px-3 py-2 border rounded bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-mono text-sm uppercase" maxLength={17} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Kilometraje (Km)</label>
                    <input type="number" inputMode="numeric" pattern="[0-9]*" required value={formData.km || ''} onChange={e=>setFormData({...formData, km: Number(e.target.value)})} className="w-full px-3 py-2 border rounded bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-slate-800 dark:text-slate-200" />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Link de Página Web (Opcional)</label>
                  <input type="url" placeholder="https://..." value={formData.websiteUrl || ''} onChange={e=>setFormData({...formData, websiteUrl: e.target.value})} className="w-full px-3 py-2 border rounded bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-slate-800 dark:text-slate-200" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Cilindros</label>
                    <input type="number" inputMode="numeric" pattern="[0-9]*" value={formData.cylinders || ''} onChange={e=>setFormData({...formData, cylinders: Number(e.target.value)})} className="w-full px-3 py-2 border rounded bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-slate-800 dark:text-slate-200" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Motor (Litros)</label>
                    <input type="number" inputMode="numeric" pattern="[0-9]*" step="0.1" value={formData.liters || ''} onChange={e=>setFormData({...formData, liters: Number(e.target.value)})} className="w-full px-3 py-2 border rounded bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-slate-800 dark:text-slate-200" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {isOwnVehicle && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Fecha de Recepción</label>
                      <input type="date" value={typeof formData.receivedAt === 'string' ? formData.receivedAt.split('T')[0] : ''} onChange={e=>setFormData({...formData, receivedAt: e.target.value})} className="w-full px-3 py-2 border rounded bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-slate-800 dark:text-slate-200" />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Pasajeros</label>
                    <input type="number" inputMode="numeric" pattern="[0-9]*" value={formData.passengers || ''} onChange={e=>setFormData({...formData, passengers: parseInt(e.target.value) || undefined})} className="w-full px-3 py-2 border rounded bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-slate-800 dark:text-slate-200" placeholder="Ej. 5" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Equipamiento</label>
                    <input type="text" value={formData.equipment || ''} onChange={e=>setFormData({...formData, equipment: e.target.value})} className="w-full px-3 py-2 border rounded bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-slate-800 dark:text-slate-200" placeholder="Ej. Quemacocos, Piel..." />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tipo de Propiedad</label>
                    <select value={formData.ownership || 'propio'} onChange={e=>setFormData({...formData, ownership: e.target.value})} className="w-full px-3 py-2 border rounded bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-slate-800 dark:text-slate-200">
                      <option value="propio">Propio</option>
                      <option value="consignacion">Consignación</option>
                    </select>
                  </div>
                </div>

                {!isNew && isAdmin && (isOwnVehicle || isMaster) && (
                  <div className="mt-8 p-4 bg-green-50 rounded border border-green-200">
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
              </fieldset>
            </form>
          </>
          )}

          {activeTab === 'expenses' && !isNew && userData?.role !== 'seller' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Register Gasto and Table of Gastos */}
              <div className="lg:col-span-5 flex flex-col gap-4 h-full overflow-y-auto pr-1">
                <div className="flex flex-col gap-3 p-4 bg-[#f4f5f5] dark:bg-slate-900 rounded border border-gray-200 dark:border-slate-700">
                  <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200 uppercase tracking-wider">Añadir / Editar Gasto</h4>
                  <div className="grid grid-cols-1 gap-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Fecha</span>
                      <input 
                        type="date" 
                        value={expDate} 
                        onChange={e=>setExpDate(e.target.value)} 
                        className="w-full px-3 py-2 border rounded text-sm bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-slate-800 dark:text-slate-200" 
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Descripción</span>
                      <input 
                        type="text" 
                        placeholder="Descripción del gasto..." 
                        value={expDesc} 
                        onChange={e=>setExpDesc(e.target.value)} 
                        className="w-full px-3 py-2 border rounded text-sm bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-slate-800 dark:text-slate-200" 
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Monto</span>
                      <div className="relative">
                        <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                          type="number" inputMode="numeric" pattern="[0-9]*" 
                          placeholder="Monto" 
                          value={expAmount} 
                          onChange={e=>setExpAmount(e.target.value)} 
                          className="w-full pl-8 pr-3 py-2 border rounded text-sm bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-slate-800 dark:text-slate-200" 
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button 
                      onClick={handleAddOrEditExpense}
                      disabled={!expDesc || !expAmount}
                      className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded font-bold text-sm whitespace-nowrap"
                    >
                      {editingExpenseId ? 'Guardar Cambios' : 'Agregar Gasto'}
                    </button>
                    {editingExpenseId && (
                      <button 
                        onClick={cancelEdit}
                        className="bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-3 py-2 rounded font-medium text-sm whitespace-nowrap"
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                </div>

                <div className="border border-gray-200 dark:border-slate-700 rounded overflow-hidden bg-white dark:bg-slate-800 flex-1 min-h-[200px]">
                  <div className="px-4 py-2.5 bg-[#f4f5f5] dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 font-bold text-xs text-slate-700 dark:text-slate-300 flex justify-between items-center">
                    <span>LISTA DE GASTOS</span>
                    <span className="bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400 px-2 py-0.5 rounded-full font-bold text-[10px]">
                      {expenses.length} ítems
                    </span>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-[10px] text-slate-500 dark:text-slate-400 bg-[#f4f5f5] dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 uppercase">
                        <tr>
                          <th className="px-3 py-2 font-semibold">Fecha</th>
                          <th className="px-3 py-2 font-semibold">Descripción</th>
                          <th className="px-3 py-2 font-semibold">Monto</th>
                          <th className="px-3 py-2 font-semibold text-right">Acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {expenses.map(exp => (
                          <tr key={`expense-${exp.id}`} className={`border-b border-gray-200 dark:border-slate-700/50 last:border-0 hover:bg-[#f4f5f5] dark:hover:bg-slate-700/30 ${editingExpenseId === exp.id ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''}`}>
                            <td className="px-3 py-2 whitespace-nowrap text-[11px] text-slate-500 dark:text-slate-400">{new Date(exp.date).toLocaleDateString()}</td>
                            <td className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-300 text-[11px] truncate max-w-[120px]" title={exp.description}>{exp.description}</td>
                            <td className="px-3 py-2 text-red-600 font-bold text-[11px]">${exp.amount.toLocaleString()}</td>
                            <td className="px-3 py-2 text-right whitespace-nowrap">
                              <button type="button" onClick={() => handleEditClick(exp)} className="text-slate-400 hover:text-blue-600 p-1 mr-1">
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button type="button" onClick={() => handleDeleteExpense(exp.id)} className="text-slate-400 hover:text-red-600 p-1">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {expenses.length === 0 && (
                          <tr>
                            <td colSpan={4} className="px-3 py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                              No hay gastos registrados para este vehículo.
                            </td>
                          </tr>
                        )}
                      </tbody>
                      {expenses.length > 0 && (
                        <tfoot className="bg-[#f4f5f5] dark:bg-slate-900 font-bold border-t border-gray-200 dark:border-slate-700">
                          <tr>
                            <td colSpan={2} className="px-3 py-2 text-right text-xs">Total Gastos:</td>
                            <td className="px-3 py-2 text-red-600 text-xs">${totalExpenses.toLocaleString()}</td>
                            <td></td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>
              </div>

              {/* Right Column: Partners Document Preview */}
              <div className="lg:col-span-7 flex flex-col h-full">
                <div className="flex justify-between items-center mb-2 px-1">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Documento para Socios (Vista Previa)</span>
                  <button 
                    onClick={handleSharePartnersReport}
                    disabled={isGeneratingPartnersReport}
                    className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded transition-colors shadow-sm disabled:opacity-50"
                  >
                    <Share2 className="w-3 h-3" />
                    <span>{isGeneratingPartnersReport ? 'Generando...' : 'Compartir Documento'}</span>
                  </button>
                </div>

                {/* Main Paper Preview Box */}
                <div className="border border-gray-200 dark:border-slate-700 rounded shadow-sm bg-white text-slate-800 p-5 flex flex-col font-sans relative overflow-hidden" style={{ minHeight: '480px' }}>
                  {/* Decorative corporate top border line */}
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-600"></div>

                  {/* Document Header */}
                  <div className="flex justify-between items-start mb-3 mt-1">
                    <div>
                      <h3 className="text-md font-black tracking-tight text-slate-900 uppercase">Nextcar CRM</h3>
                      <p className="text-[9px] text-slate-500 tracking-wider font-bold uppercase">
                        {agencies.find(a => a.id === formData.agencyId)?.name || 'REPORTE FINANCIERO DE SOCIOS'}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="inline-block bg-slate-100 text-slate-700 text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider mb-0.5">
                        Uso Interno / Confidencial
                      </span>
                      <p className="text-[9px] text-slate-500">Fecha: {new Date().toLocaleDateString()}</p>
                    </div>
                  </div>

                  <div className="border-t border-gray-200 my-1.5"></div>

                  {/* Vehicle Section */}
                  <div className="mb-3">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Datos Generales del Vehículo</span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 bg-[#f4f5f5] rounded p-2.5 text-[11px] border border-gray-200">
                      <div>
                        <span className="text-[9px] text-slate-400 block uppercase">Vehículo</span>
                        <span className="font-bold text-slate-800">{formData.make} {formData.model}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 block uppercase">Año / Color</span>
                        <span className="font-semibold text-slate-700">{formData.year} | {formData.color}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 block uppercase">Kilometraje</span>
                        <span className="font-semibold text-slate-700">{Number(formData.km || 0).toLocaleString()} km</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 block uppercase">VIN / Serie</span>
                        <span className="font-mono text-slate-700 text-[9px] uppercase">{formData.vin || 'N/A'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Financial Balance Section */}
                  <div className="mb-3">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Resumen Financiero del Vehículo</span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div className="p-2.5 rounded border border-gray-200 bg-white">
                        <span className="text-[9px] font-bold text-slate-500 uppercase block mb-0.5">Costo de Adquisición (Toma)</span>
                        <span className="text-sm font-extrabold text-slate-900">${Number(formData.purchasePrice || 0).toLocaleString()}</span>
                      </div>
                      <div className="p-2.5 rounded border border-gray-200 bg-white">
                        <span className="text-[9px] font-bold text-slate-500 uppercase block mb-0.5">Precio de Venta</span>
                        <span className="text-sm font-extrabold text-slate-900">${Number(formData.price || 0).toLocaleString()}</span>
                      </div>
                      <div className="p-2.5 rounded border border-gray-200 bg-white">
                        <span className="text-[9px] font-bold text-slate-500 uppercase block mb-0.5">Gastos de Preparación</span>
                        <span className="text-sm font-extrabold text-red-600">${Number(totalExpenses).toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Big Profit Box */}
                    <div className="mt-2.5 p-3 rounded border flex justify-between items-center bg-gradient-to-r from-slate-50 to-slate-100" style={{ borderColor: '#e2e8f0' }}>
                      <div>
                        <span className="text-[9px] font-bold text-slate-500 uppercase block">Utilidad Total Generada</span>
                        <span className="text-[10px] text-slate-400 font-medium">Fórmula: Venta - Adquisición - Gastos</span>
                      </div>
                      <div className="text-right">
                        <span className={`text-sm font-black px-3 py-1 rounded-md inline-block shadow-sm text-white ${utility >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`}>
                          ${Number(utility).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Mini Ledger of Expenses inside Document */}
                  <div className="mb-4 flex-1">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Detalle de Egresos / Gastos</span>
                    <div className="border border-gray-200 rounded overflow-hidden text-[11px] max-h-[140px] overflow-y-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-[#f4f5f5] text-slate-500 border-b border-gray-200 font-bold uppercase text-[8px]">
                            <th className="px-3 py-1">Fecha</th>
                            <th className="px-3 py-1">Concepto / Descripción del Gasto</th>
                            <th className="px-3 py-1 text-right">Monto</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {expenses.map((exp, idx) => (
                            <tr key={`doc-exp-${exp.id}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-[#f4f5f5]/50'}>
                              <td className="px-3 py-1 text-slate-500">{new Date(exp.date).toLocaleDateString()}</td>
                              <td className="px-3 py-1 font-semibold text-slate-700">{exp.description}</td>
                              <td className="px-3 py-1 text-right text-red-600 font-bold">${exp.amount.toLocaleString()}</td>
                            </tr>
                          ))}
                          {expenses.length === 0 && (
                            <tr>
                              <td colSpan={3} className="px-3 py-3 text-center text-slate-400">
                                Sin gastos adicionales registrados para este vehículo.
                              </td>
                            </tr>
                          )}
                        </tbody>
                        {expenses.length > 0 && (
                          <tfoot>
                            <tr className="bg-slate-100/80 text-slate-700 font-bold border-t border-gray-200">
                              <td colSpan={2} className="px-3 py-1 text-right uppercase text-[8px]">Suma de Egresos:</td>
                              <td className="px-3 py-1 text-right text-red-600">${totalExpenses.toLocaleString()}</td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                  </div>

                  {/* Signatures/Corporate Footer */}
                  <div className="border-t border-gray-200 pt-3 mt-auto">
                    <p className="text-[8px] text-slate-400 text-center italic mb-3">
                      "Este reporte contiene información financiera confidencial para toma de decisiones directivas de los socios."
                    </p>
                    <div className="flex justify-around items-center pt-1 text-[9px] text-slate-500">
                      <div className="flex flex-col items-center">
                        <div className="w-28 border-b border-gray-200 mb-0.5"></div>
                        <span>Firma Socio Administrador</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <div className="w-28 border-b border-gray-200 mb-0.5"></div>
                        <span>Socio Directivo / Auditor</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          
          {activeTab === 'checklist' && !isNew && (
            <div className="flex flex-col gap-6 p-6 bg-white dark:bg-slate-800 overflow-y-auto max-h-[70vh]">
              
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800/50 mb-2">
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  <strong className="font-bold">Instrucciones:</strong> Marca las casillas de los documentos y accesorios que <span className="font-semibold">ya fueron entregados</span> o están en tu poder. Todo elemento que se deje sin marcar será registrado en el sistema como pendiente o faltante.
                </p>
              </div>

              <div className="flex items-center justify-between border-b border-gray-200 dark:border-slate-700 pb-2">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Documentos</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { key: 'originalInvoice', label: 'Factura Original' },
                  { key: 'originInvoiceCopy', label: 'Copia Factura Origen' },
                  { key: 'rebillings', label: 'Refacturas' },
                  { key: 'taxes', label: 'Tenencias' },
                  { key: 'deregistration', label: 'Baja' },
                  { key: 'ineOrId', label: 'INE o ID' },
                ].map(item => (
                  <label key={item.key} className="flex items-start gap-3 p-3 border rounded border-gray-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900/50 cursor-pointer transition-colors">
                    <input 
                      type="checkbox" 
                      className="mt-1 w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      checked={!!formData.checklist?.[item.key]}
                      disabled={isReadOnly}
                      onChange={async (e) => {
                        const checked = e.target.checked;
                        const newChecklist = { ...formData.checklist, [item.key]: checked };
                        setFormData(prev => ({ ...prev, checklist: newChecklist }));
                        if (!isReadOnly && vehicle.id) {
                          try {
                            const { doc, updateDoc } = await import('firebase/firestore');
                            await updateDoc(doc(db, 'vehicles', vehicle.id), { checklist: newChecklist });
                          } catch (err) {}
                        }
                      }}
                    />
                    <div className="flex flex-col">
                      <span className={`text-sm font-medium ${formData.checklist?.[item.key] ? 'text-slate-800 dark:text-slate-200' : 'text-slate-600 dark:text-slate-400'}`}>
                        {item.label}
                      </span>
                      
                    </div>
                  </label>
                ))}
                
                <div className="flex flex-col gap-1 p-3 border rounded border-gray-200 dark:border-slate-700">
                   <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Placas y tarjeta</label>
                   <input 
                     type="text" 
                     placeholder="Escribe detalles..."
                     className="mt-1 w-full p-2 border rounded border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
                     value={formData.checklist?.platesAndCard || ''}
                     disabled={isReadOnly}
                     onChange={(e) => setFormData(prev => ({ ...prev, checklist: { ...prev.checklist, platesAndCard: e.target.value } }))}
                     onBlur={async (e) => {
                       if (!isReadOnly && vehicle.id) {
                          try {
                            const { doc, updateDoc } = await import('firebase/firestore');
                            await updateDoc(doc(db, 'vehicles', vehicle.id), { checklist: { ...formData.checklist, platesAndCard: e.target.value } });
                          } catch (err) {}
                        }
                     }}
                   />
                </div>
                
                <div className="flex flex-col gap-1 p-3 border rounded border-gray-200 dark:border-slate-700">
                   <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Estado de baja / placas</label>
                   <select 
                     className="mt-1 w-full p-2 border rounded border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
                     value={formData.checklist?.platesState || ''}
                     disabled={isReadOnly}
                     onChange={async (e) => {
                       const val = e.target.value;
                       setFormData(prev => ({ ...prev, checklist: { ...prev.checklist, platesState: val } }));
                       if (!isReadOnly && vehicle.id) {
                          try {
                            const { doc, updateDoc } = await import('firebase/firestore');
                            await updateDoc(doc(db, 'vehicles', vehicle.id), { checklist: { ...formData.checklist, platesState: val } });
                          } catch (err) {}
                        }
                     }}
                   >
                     <option value="">Seleccione Estado...</option>
                     {["Aguascalientes","Baja California","Baja California Sur","Campeche","Chiapas","Chihuahua","Coahuila","Colima","Ciudad de México","Durango","Guanajuato","Guerrero","Hidalgo","Jalisco","Estado de México","Michoacán","Morelos","Nayarit","Nuevo León","Oaxaca","Puebla","Querétaro","Quintana Roo","San Luis Potosí","Sinaloa","Sonora","Tabasco","Tamaulipas","Tlaxcala","Veracruz","Yucatán","Zacatecas"].map(st => (
                       <option key={st} value={st}>{st}</option>
                     ))}
                   </select>
                </div>
                
                <div className="flex flex-col gap-1 p-3 border rounded border-gray-200 dark:border-slate-700">
                   <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Número de dueños</label>
                   <input 
                     type="number" 
                     placeholder="0"
                     className="mt-1 w-full p-2 border rounded border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
                     value={formData.checklist?.ownersCount || ''}
                     disabled={isReadOnly}
                     onChange={(e) => setFormData(prev => ({ ...prev, checklist: { ...prev.checklist, ownersCount: e.target.value } }))}
                     onBlur={async (e) => {
                       if (!isReadOnly && vehicle.id) {
                          try {
                            const { doc, updateDoc } = await import('firebase/firestore');
                            await updateDoc(doc(db, 'vehicles', vehicle.id), { checklist: { ...formData.checklist, ownersCount: e.target.value } });
                          } catch (err) {}
                        }
                     }}
                   />
                </div>
              </div>
              
              <div className="flex items-center justify-between border-b border-gray-200 dark:border-slate-700 pb-2 mt-2">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Accesorios</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { key: 'jack', label: 'Gato' },
                  { key: 'securityLugNut', label: 'Birlo de seguridad' },
                  { key: 'manuals', label: 'Manuales' },
                  { key: 'servicePolicy', label: 'Póliza de servicio' },
                  { key: 'duplicateKeys', label: 'Duplicado de llaves' },
                  { key: 'smogCheck', label: 'Verificación' },
                  { key: 'tools', label: 'Herramienta' },
                ].map(item => (
                  <label key={item.key} className="flex items-start gap-3 p-3 border rounded border-gray-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900/50 cursor-pointer transition-colors">
                    <input 
                      type="checkbox" 
                      className="mt-1 w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      checked={!!formData.checklist?.[item.key]}
                      disabled={isReadOnly}
                      onChange={async (e) => {
                        const checked = e.target.checked;
                        const newChecklist = { ...formData.checklist, [item.key]: checked };
                        setFormData(prev => ({ ...prev, checklist: newChecklist }));
                        if (!isReadOnly && vehicle.id) {
                          try {
                            const { doc, updateDoc } = await import('firebase/firestore');
                            await updateDoc(doc(db, 'vehicles', vehicle.id), { checklist: newChecklist });
                          } catch (err) {}
                        }
                      }}
                    />
                    <div className="flex flex-col">
                      <span className={`text-sm font-medium ${formData.checklist?.[item.key] ? 'text-slate-800 dark:text-slate-200' : 'text-slate-600 dark:text-slate-400'}`}>
                        {item.label}
                      </span>
                      
                    </div>
                  </label>
                ))}
              </div>

              <div className="mt-4 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded border border-indigo-100 dark:border-indigo-800">
                 <label className="flex items-center gap-3 cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                      checked={!!formData.checklist?.remindMissing}
                      disabled={isReadOnly}
                      onChange={async (e) => {
                        const checked = e.target.checked;
                        const newChecklist = { ...formData.checklist, remindMissing: checked };
                        setFormData(prev => ({ ...prev, checklist: newChecklist }));
                        if (!isReadOnly && vehicle.id) {
                          try {
                            const { doc, updateDoc } = await import('firebase/firestore');
                            await updateDoc(doc(db, 'vehicles', vehicle.id), { checklist: newChecklist });
                          } catch (err) {}
                        }
                      }}
                    />
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-indigo-900 dark:text-indigo-200">
                        Recordarme sobre documentos o accesorios faltantes
                      </span>
                      <span className="text-xs text-indigo-700 dark:text-indigo-300">
                        Se enviará una alerta a los recordatorios y se mostrará en el dashboard semanal.
                      </span>
                    </div>
                 </label>
              </div>

            </div>
          )}
        </div>

        {/* Footer */}
        {activeTab === 'info' && (
          <div className="p-4 border-t bg-[#f4f5f5] dark:bg-slate-900 flex justify-end gap-3 shrink-0">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-200 rounded">Cancelar</button>
            {isReadOnly && isAdmin && (!isOwnVehicle || isMaster) && (
              <button
                type="button"
                onClick={handleStartChat}
                disabled={loading}
                className="px-5 py-2 text-sm text-white bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 rounded font-bold flex items-center gap-2 shadow-sm animate-pulse disabled:opacity-50"
              >
                <MessageSquare className="w-4.5 h-4.5" />
                {loading ? 'Iniciando...' : 'Iniciar Chat con Agencia'}
              </button>
            )}
            {!isReadOnly && isAdmin && (
              <button type="submit" form="vehicle-form" disabled={loading || uploading} className="px-4 py-2 text-sm text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded font-bold">
                {loading ? 'Guardando...' : 'Guardar Vehículo'}
              </button>
            )}
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
                  {allPhotos.length > 0 && getPdfImageSrc() ? (
                    <img 
                      src={getPdfImageSrc()} 
                      alt={`${formData.make || ''} ${formData.model || ''}`}
                      className="w-full h-full object-cover"
                      crossOrigin={getPdfImageSrc().startsWith('data:') ? undefined : "anonymous"}
                    />
                  ) : (
                    <div className="text-3xl font-medium flex flex-col items-center" style={{ color: '#64748b' }}>
                      <span>Sin Imagen</span>
                    </div>
                  )}
                  {formData.status === 'sold' && (
                    <div className="absolute inset-0 flex items-center justify-center backdrop-blur-sm" style={{ backgroundColor: 'rgba(220, 38, 38, 0.8)' }}>
                      <span className="font-black text-5xl rotate-[-15deg] uppercase tracking-widest border-4 p-4 rounded-3xl" style={{ color: '#ffffff', borderColor: '#ffffff' }}>VENDIDO</span>
                    </div>
                  )}
               </div>

               {/* Right: Title & Price */}
               <div className="flex-1 flex flex-col justify-center">
                  <h1 className="text-[50px] font-black uppercase leading-none tracking-tight mb-2" style={{ color: '#ffffff', textShadow: '0 5px 15px rgba(0,0,0,0.5)' }}>
                    {formData.make || 'Vehículo'}
                  </h1>
                  <h2 className="text-[35px] font-bold tracking-wide mb-6" style={{ color: '#60a5fa' }}>
                    {formData.model || ''} <span style={{ color: 'rgba(255, 255, 255, 0.3)' }}>|</span> <span style={{ color: '#ffffff' }}>{formData.year || ''}</span>
                  </h2>
                  
                  {formData.price && formData.price > 0 && (
                    <div className="w-full rounded-[24px] py-4 px-6 flex flex-col justify-center shadow-2xl" style={{ background: 'linear-gradient(to right, #2563eb, #3b82f6)' }}>
                      <span className="text-lg font-bold uppercase tracking-widest mb-1" style={{ color: 'rgba(255, 255, 255, 0.9)' }}>Precio de Venta</span>
                      <span className="text-[40px] font-black leading-none" style={{ color: '#ffffff' }}>${Number(formData.price).toLocaleString()}</span>
                    </div>
                  )}
               </div>
            </div>

            {/* Vehicle Specifications Grid */}
            <div className="w-full backdrop-blur-md rounded-[30px] p-6 border grid grid-cols-3 gap-x-8 gap-y-6 mb-8 z-10" style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', borderColor: 'rgba(255, 255, 255, 0.1)' }}>
              <div className="flex flex-col border-b-2 pb-4" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
                <span className="text-base font-semibold uppercase tracking-wider mb-1" style={{ color: '#93c5fd' }}>Kilometraje</span>
                <span className="text-2xl font-black" style={{ color: '#ffffff' }}>{Number(formData.km || 0).toLocaleString()} km</span>
              </div>
              <div className="flex flex-col border-b-2 pb-4" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
                <span className="text-base font-semibold uppercase tracking-wider mb-1" style={{ color: '#93c5fd' }}>Transmisión</span>
                <span className="text-2xl font-black" style={{ color: '#ffffff' }}>{formData.transmission || ''}</span>
              </div>
              <div className="flex flex-col border-b-2 pb-4" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
                <span className="text-base font-semibold uppercase tracking-wider mb-1" style={{ color: '#93c5fd' }}>Color</span>
                <span className="text-2xl font-black" style={{ color: '#ffffff' }}>{formData.color || ''}</span>
              </div>
              <div className="flex flex-col border-b-2 pb-4" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
                <span className="text-base font-semibold uppercase tracking-wider mb-1" style={{ color: '#93c5fd' }}>Carrocería</span>
                <span className="text-2xl font-black" style={{ color: '#ffffff' }}>{formData.bodyType || ''}</span>
              </div>
              <div className="flex flex-col border-b-2 pb-4" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
                <span className="text-base font-semibold uppercase tracking-wider mb-1" style={{ color: '#93c5fd' }}>Motor</span>
                <span className="text-2xl font-black" style={{ color: '#ffffff' }}>{formData.cylinders ? `${formData.cylinders} Cil` : '-'} {formData.liters ? `/ ${formData.liters} L` : ''}</span>
              </div>
              <div className="flex flex-col border-b-2 pb-4" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
                <span className="text-base font-semibold uppercase tracking-wider mb-1" style={{ color: '#93c5fd' }}>Pasajeros</span>
                <span className="text-2xl font-black" style={{ color: '#ffffff' }}>{formData.passengers || '-'}</span>
              </div>
            </div>

            {/* Financing Info (If applicable) */}
            {formData.price && formData.price > 0 && (
              <div className="w-full z-10 mb-8">
                {(() => {
                  const financing = getFinancingInfo(formData.year || new Date().getFullYear(), formData.price || 0);
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
               {formData.websiteUrl && (
                 <div className="flex flex-col items-center bg-white p-3 rounded shrink-0">
                   <QRCodeSVG value={formData.websiteUrl || ""} size={120} level="M" />
                   <span className="text-sm font-bold text-slate-800 mt-2 tracking-wider">VER ONLINE</span>
                 </div>
               )}
            </div>
            
            {/* Decorative elements */}
            <div className="absolute top-[-200px] right-[-200px] w-[600px] h-[600px] rounded-full blur-[100px] pointer-events-none" style={{ backgroundColor: 'rgba(59, 130, 246, 0.2)' }}></div>
            <div className="absolute bottom-[-200px] left-[-200px] w-[800px] h-[800px] rounded-full blur-[120px] pointer-events-none" style={{ backgroundColor: 'rgba(168, 85, 247, 0.2)' }}></div>
          </div>
        </div>

        {/* Hidden Partners PDF View */}
        <div className="fixed top-[-9999px] left-[-9999px] pointer-events-none w-[800px] max-w-none">
          <div ref={partnerDocRef} className="w-[800px] h-[1131px] flex flex-col p-12 font-sans relative bg-white text-slate-800" style={{ backgroundColor: '#ffffff' }}>
            {/* Decorative top strip */}
            <div className="absolute top-0 left-0 right-0 h-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-600"></div>
            
            {/* Logo and report header */}
            <div className="flex justify-between items-start mb-8 mt-4">
              <div>
                <h1 className="text-3xl font-black tracking-tight text-slate-900 leading-none uppercase">Nextcar CRM</h1>
                <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mt-2">
                  {agencies.find(a => a.id === formData.agencyId)?.name || 'REPORTE FINANCIERO DE SOCIOS'}
                </p>
              </div>
              <div className="text-right">
                <span className="inline-block bg-slate-100 text-slate-700 text-xs font-bold px-3 py-1 rounded uppercase tracking-wider mb-1.5">
                  Uso Interno / Confidencial
                </span>
                <p className="text-xs text-slate-500">Fecha de Emisión: {new Date().toLocaleDateString()}</p>
                <p className="text-xs text-slate-500">ID Vehículo: {vehicle.id?.substring(0, 8) || 'N/A'}</p>
              </div>
            </div>

            <div className="border-t-2 border-gray-200 my-4"></div>

            {/* Section 1: Vehicle details */}
            <div className="mb-6">
              <span className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-3">1. Datos de Identificación del Vehículo</span>
              <div className="grid grid-cols-4 gap-6 bg-[#f4f5f5] rounded p-5 text-sm border border-gray-200">
                <div>
                  <span className="text-xs text-slate-400 block uppercase mb-1">Vehículo</span>
                  <span className="font-extrabold text-slate-900 text-base">{formData.make} {formData.model}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block uppercase mb-1">Año / Color</span>
                  <span className="font-bold text-slate-700 text-base">{formData.year} | {formData.color}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block uppercase mb-1">Kilometraje</span>
                  <span className="font-bold text-slate-700 text-base">{Number(formData.km || 0).toLocaleString()} km</span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block uppercase mb-1">VIN / Serie</span>
                  <span className="font-mono text-slate-700 text-sm uppercase tracking-wide">{formData.vin || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Section 2: Financial breakdown */}
            <div className="mb-6">
              <span className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-3">2. Análisis de Costo, Venta y Rendimiento</span>
              <div className="grid grid-cols-3 gap-6 mb-4">
                <div className="p-4 rounded border border-gray-200 bg-white shadow-sm">
                  <span className="text-xs font-bold text-slate-500 uppercase block mb-1">Costo de Adquisición (Toma)</span>
                  <span className="text-2xl font-black text-slate-900">${Number(formData.purchasePrice || 0).toLocaleString()}</span>
                </div>
                <div className="p-4 rounded border border-gray-200 bg-white shadow-sm">
                  <span className="text-xs font-bold text-slate-500 uppercase block mb-1">Precio de Venta</span>
                  <span className="text-2xl font-black text-slate-900">${Number(formData.price || 0).toLocaleString()}</span>
                </div>
                <div className="p-4 rounded border border-gray-200 bg-white shadow-sm">
                  <span className="text-xs font-bold text-slate-500 uppercase block mb-1">Gastos de Preparación</span>
                  <span className="text-2xl font-black text-red-600">${Number(totalExpenses).toLocaleString()}</span>
                </div>
              </div>

              {/* Outstanding profit summary bar */}
              <div className="p-5 rounded border-2 flex justify-between items-center bg-[#f4f5f5]" style={{ borderColor: '#cbd5e1' }}>
                <div>
                  <span className="text-sm font-black text-slate-700 uppercase block">Utilidad Bruta para Socios</span>
                  <span className="text-xs text-slate-500 font-medium">Método de cálculo: Precio de Venta - Costo de Adquisición - Egresos</span>
                </div>
                <div className="text-right">
                  <span className={`text-2xl font-black px-6 py-2.5 rounded inline-block shadow-sm text-white ${utility >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`}>
                    ${Number(utility).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Section 3: Registered expenses ledger */}
            <div className="mb-8 flex-1">
              <span className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-3">3. Detalle de Gastos de Acondicionamiento (Egresos)</span>
              <div className="border border-gray-200 rounded overflow-hidden text-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#f4f5f5] text-slate-500 border-b border-gray-200 font-black uppercase text-xs">
                      <th className="px-4 py-3">Fecha</th>
                      <th className="px-4 py-3">Concepto / Descripción del Gasto</th>
                      <th className="px-4 py-3 text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {expenses.map((exp, idx) => (
                      <tr key={`pdf-exp-${exp.id}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-[#f4f5f5]/50'}>
                        <td className="px-4 py-3 text-slate-500 text-xs">{new Date(exp.date).toLocaleDateString()}</td>
                        <td className="px-4 py-3 font-bold text-slate-700">{exp.description}</td>
                        <td className="px-4 py-3 text-right text-red-600 font-extrabold">${exp.amount.toLocaleString()}</td>
                      </tr>
                    ))}
                    {expenses.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-4 py-8 text-center text-slate-400 italic">
                          No se registraron egresos o gastos de acondicionamiento para este vehículo.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {expenses.length > 0 && (
                    <tfoot>
                      <tr className="bg-slate-100 text-slate-800 font-extrabold border-t-2 border-gray-200 text-sm">
                        <td colSpan={2} className="px-4 py-3 text-right uppercase tracking-wider">Total de Egresos Registrados:</td>
                        <td className="px-4 py-3 text-right text-red-600">${totalExpenses.toLocaleString()}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>

            {/* Corporate stamp & sign block at the very bottom */}
            <div className="border-t border-gray-200 pt-6 mt-auto">
              <p className="text-xs text-slate-400 text-center italic mb-8">
                "Este reporte financiero contiene información confidencial protegida por convenios de socios. Su divulgación no autorizada está estrictamente prohibida por las políticas internas de la organización."
              </p>
              <div className="flex justify-around items-center pt-4 text-xs text-slate-600 font-bold">
                <div className="flex flex-col items-center">
                  <div className="w-48 border-b-2 border-slate-300 mb-2"></div>
                  <span>Firma de Socio Administrador</span>
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-48 border-b-2 border-slate-300 mb-2"></div>
                  <span>Socio Directivo / Auditor</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

