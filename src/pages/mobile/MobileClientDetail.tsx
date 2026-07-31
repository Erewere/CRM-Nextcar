import React, { useState, useEffect, useRef } from 'react';
import { X, Phone, MessageCircle, Mail, MapPin, Tag, Calendar, User, AlignLeft, Send, Check, Car, Mic, Calculator, Trash2, Plus, CheckCircle2 } from 'lucide-react';
import { Client, Vehicle } from '../../types';
import { db } from '../../lib/firebase';
import { doc, setDoc, addDoc, collection, getDoc, updateDoc, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import clsx from 'clsx';
import { format } from 'date-fns';
import { checkIsWon, checkIsLost } from '../../lib/clientUtils';
import { DealWonModal } from '../../components/DealWonModal';
import { LostReasonModal } from '../../components/LostReasonModal';
import { PaymentModal } from '../../components/PaymentModal';
import { VehicleDetailModal } from '../../components/VehicleDetailModal';
import { createPaymentTasks } from '../../lib/paymentTasks';

interface Props {
  client: Client;
  onClose: () => void;
  onUpdated: () => void;
  scrollToHistory?: boolean;
}

export function MobileClientDetail({ client, onClose, onUpdated, scrollToHistory }: Props) {
  const { userData } = useAuth();
  const [pipelineStages, setPipelineStages] = useState<any[]>([]);
  const [currentStatus, setCurrentStatus] = useState(client.status || 'new');
  const [clientData, setClientData] = useState<Partial<Client>>(client);
  const [showDealWonModal, setShowDealWonModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showLostReasonModal, setShowLostReasonModal] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [assignedVehicle, setAssignedVehicle] = useState<Vehicle | null>(null);
  const [selectedVehicleForModal, setSelectedVehicleForModal] = useState<Vehicle | null>(null);

  const handlePaymentConfirm = async (payment: any) => {
    setShowPaymentModal(false);
    
    const baseDetails = clientData?.saleDetails || {
      price: clientData?.dealValue || client.dealValue || 0,
      method: 'contado',
      payments: []
    };
    
    const newPayment = {
      amount: payment.amount,
      date: payment.date,
      method: payment.method,
      notes: payment.notes || '',
      installmentNumber: payment.installmentNumber,
      id: Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString()
    };
    
    const updatedSaleDetails = {
      ...baseDetails,
      payments: [...(baseDetails.payments || []), newPayment]
    };

    const finalClientId = (client.originalClientId || client.id) as string;
    const isDeal = Boolean(client.originalClientId && client.originalClientId !== client.id);
    const finalDealId = isDeal ? (client.id as string) : null;
    const todayIso = new Date().toISOString().split('T')[0];

    let newStatus = currentStatus;

    if (payment.markSaleAsWon) {
      const wonStage = pipelineStages.find(s => 
        s.name?.toLowerCase().includes('ganad') || s.name?.toLowerCase().includes('vendid')
      );
      if (wonStage) {
        newStatus = wonStage.id;
      } else {
        newStatus = 'won';
      }
      setCurrentStatus(newStatus);
    }

    setClientData(prev => ({
      ...prev,
      status: newStatus,
      saleDetails: updatedSaleDetails
    }));

    try {
      const updateData: any = {
        saleDetails: updatedSaleDetails,
        updatedAt: new Date().toISOString()
      };

      if (payment.markSaleAsWon) {
        updateData.status = newStatus;
        updateData.soldAt = todayIso;
      }

      if (finalDealId) {
        await setDoc(doc(db, "deals", finalDealId), updateData, { merge: true });
      }
      if (finalClientId) {
        await setDoc(doc(db, "clients", finalClientId), updateData, { merge: true });
      }
      const vId = clientData?.vehicleId || client.vehicleId;
      if (vId) {
        const vehicleUpdate: any = {
          saleDetails: updatedSaleDetails,
          updatedAt: new Date().toISOString()
        };
        if (payment.markSaleAsWon) {
          vehicleUpdate.status = 'sold';
          vehicleUpdate.soldAt = todayIso;
          vehicleUpdate.buyerId = finalClientId;
          vehicleUpdate.soldToClientId = finalClientId;
          if (clientData?.name || client?.name) vehicleUpdate.buyerName = clientData?.name || client?.name;
        }
        await setDoc(doc(db, "vehicles", vId), vehicleUpdate, { merge: true });
      }

      // If completing a specific installment task
      if (payment.taskIdToComplete) {
        try {
          await updateDoc(doc(db, "tasks", payment.taskIdToComplete), {
            completed: true,
            completedAt: new Date().toISOString()
          });
        } catch (tErr) {
          console.error("Error completing payment task on mobile:", tErr);
        }
      }

      // If marking sale as won from payment and method is credit, generate schedule tasks
      if (payment.markSaleAsWon && updatedSaleDetails.method === 'credito') {
        try {
          await createPaymentTasks(
            db, 
            { ...client, ...clientData, id: finalClientId, name: clientData?.name || client.name }, 
            updatedSaleDetails, 
            userData
          );
        } catch (pErr) {
          console.error("Error creating payment tasks from payment confirm on mobile:", pErr);
        }
      }

      onUpdated?.();
    } catch (err) {
      console.error("Error saving payment on mobile", err);
    }
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (!clientData?.saleDetails?.payments) return;
    if (!window.confirm("¿Eliminar este pago?")) return;

    const updatedPayments = clientData.saleDetails.payments.filter((p: any) => p.id !== paymentId);
    const updatedSaleDetails = {
      ...clientData.saleDetails,
      payments: updatedPayments
    };

    setClientData(prev => ({
      ...prev,
      saleDetails: updatedSaleDetails
    }));

    const finalClientId = (client.originalClientId || client.id) as string;
    const isDeal = Boolean(client.originalClientId && client.originalClientId !== client.id);
    const finalDealId = isDeal ? (client.id as string) : null;

    try {
      const updateData = {
        saleDetails: updatedSaleDetails,
        updatedAt: new Date().toISOString()
      };

      if (finalDealId) {
        await setDoc(doc(db, "deals", finalDealId), updateData, { merge: true });
      }
      if (finalClientId) {
        await setDoc(doc(db, "clients", finalClientId), updateData, { merge: true });
      }
      if (clientData?.vehicleId || client.vehicleId) {
        await setDoc(doc(db, "vehicles", (clientData?.vehicleId || client.vehicleId) as string), updateData, { merge: true });
      }
      onUpdated?.();
    } catch (err) {
      console.error("Error deleting payment on mobile", err);
    }
  };

  useEffect(() => {
    const actualClientId = client.originalClientId || client.id;
    if (!actualClientId) return;

    const unsubClient = onSnapshot(doc(db, "clients", actualClientId), (snap) => {
      if (snap.exists()) {
        const cData = snap.data() as Client;
        setClientData(prev => ({ ...prev, ...cData }));
        if (cData.status) setCurrentStatus(cData.status);
      }
    });

    const isDeal = Boolean(client.originalClientId && client.originalClientId !== client.id);
    const dealIdToListen = isDeal ? client.id : null;

    let unsubDeal: (() => void) | null = null;
    if (dealIdToListen) {
      unsubDeal = onSnapshot(doc(db, "deals", dealIdToListen), (snap) => {
        if (snap.exists()) {
          const dData = snap.data();
          setClientData(prev => ({
            ...prev,
            dealValue: dData.value !== undefined ? dData.value : (dData.saleDetails?.price || prev.dealValue),
            saleDetails: dData.saleDetails || prev.saleDetails,
            soldAt: dData.soldAt || prev.soldAt,
            status: dData.status || prev.status,
            vehicle: dData.vehicle || prev.vehicle,
            vehicleId: dData.vehicleId || prev.vehicleId,
          }));
          if (dData.status) setCurrentStatus(dData.status);
        }
      });
    }

    return () => {
      unsubClient();
      if (unsubDeal) unsubDeal();
    };
  }, [client.id, client.originalClientId]);

  useEffect(() => {
    const vehId = clientData.vehicleId || client.vehicleId;
    if (vehId) {
      getDoc(doc(db, 'vehicles', vehId)).then(snap => {
        if (snap.exists()) {
          setAssignedVehicle({ id: snap.id, ...snap.data() } as Vehicle);
        }
      }).catch(err => console.error("Error fetching vehicle:", err));
    }
  }, [clientData.vehicleId, client.vehicleId]);
  
  // Quick note state
  const [quickNote, setQuickNote] = useState('');
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [noteSuccess, setNoteSuccess] = useState(false);
  const [notes, setNotes] = useState<any[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  const quickActions = [
    { id: 'call', label: 'Llamada', prefix: 'Llamada saliente', icon: Phone, color: 'text-blue-500' },
    { id: 'whatsapp', label: 'WhatsApp', prefix: 'Mensaje de WhatsApp', icon: MessageCircle, color: 'text-green-500' },
    { id: 'meeting', label: 'Visita', prefix: 'Visitó agencia', icon: MapPin, color: 'text-rose-500' },
    { id: 'other', label: 'Test Drive', prefix: 'Hizo Test Drive', icon: Car, color: 'text-purple-500' }
  ];

  useEffect(() => {
    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'es-MX';

      recognitionRef.current.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
             setQuickNote(prev => prev + transcript + ' ');
          }
        }
      };
      
      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        if (event.error === 'not-allowed') {
          alert('No se pudo acceder al micrófono. Por favor, revisa los permisos.');
        }
        setIsRecording(false);
      };
      
      recognitionRef.current.onend = () => {
         setIsRecording(false);
      };
    }
  }, []);

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      alert("El dictado por voz no está soportado en este navegador.");
      return;
    }
    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      recognitionRef.current.start();
      setIsRecording(true);
    }
  };

  const historyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollToHistory && historyRef.current) {
      setTimeout(() => {
        historyRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 300);
    }
  }, [scrollToHistory, client]);


  useEffect(() => {
    const loadNotes = async () => {
      try {
        const actualClientId = client.originalClientId || client.id;
        const isDeal = Boolean(client.originalClientId && client.originalClientId !== client.id);
        const actualDealId = isDeal ? (client.id as string) : null;

        const idsToQuery = Array.from(new Set([actualClientId, client.id].filter(Boolean) as string[]));
        const notesMap = new Map<string, any>();

        for (const cId of idsToQuery) {
          const q = query(
            collection(db, "notes"),
            where("clientId", "==", cId)
          );
          const s = await getDocs(q);
          s.docs.forEach((d) => {
            notesMap.set(d.id, { ...d.data(), id: d.id });
          });
        }

        const dealIdsToQuery = Array.from(new Set([actualDealId, client.id].filter(Boolean) as string[]));
        for (const dId of dealIdsToQuery) {
          const q = query(
            collection(db, "notes"),
            where("dealId", "==", dId)
          );
          const s = await getDocs(q);
          s.docs.forEach((d) => {
            notesMap.set(d.id, { ...d.data(), id: d.id });
          });
        }

        const n = Array.from(notesMap.values());
        n.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setNotes(n);
      } catch (error) {
        console.error("Error loading notes:", error);
      }
    };
    loadNotes();
  }, [client.id, client.originalClientId]);

  useEffect(() => {
    if (!userData?.agencyId) return;
    const fetchStages = async () => {
      try {
        const agencyDoc = await getDoc(doc(db, "agencies", userData.agencyId!));
        if (agencyDoc.exists()) {
          const data = agencyDoc.data();
          if (data.pipelineStages && data.pipelineStages.length > 0) {
            setPipelineStages(data.pipelineStages);
          } else {
            setPipelineStages([
              { id: "new", title: "Nuevos" },
              { id: "contacted", title: "Contactados" },
              { id: "appointment", title: "Cita Agendada" },
              { id: "test_drive", title: "Test Drive" },
              { id: "negotiation", title: "Negociación" },
              { id: "won", title: "Vendido" },
              { id: "lost", title: "Perdido" },
            ]);
          }
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchStages();
  }, [userData]);

  const handleStatusChange = async (newStatus: string) => {
    if (checkIsWon(newStatus, pipelineStages)) {
      setPendingStatus(newStatus);
      setShowDealWonModal(true);
      return;
    }
    if (checkIsLost(newStatus, pipelineStages)) {
      setPendingStatus(newStatus);
      setShowLostReasonModal(true);
      return;
    }

    try {
      setCurrentStatus(newStatus);
      const isDeal = client.originalClientId && client.originalClientId !== client.id;
      const actualClientId = client.originalClientId || client.id;
      
      if (isDeal) {
        // Update the deal
        const dealRef = doc(db, 'deals', client.id!);
        await updateDoc(dealRef, {
          status: newStatus,
          updatedAt: new Date().toISOString()
        });
        
        // Also update the client
        const clientRef = doc(db, 'clients', actualClientId!);
        await updateDoc(clientRef, {
          status: newStatus,
          updatedAt: new Date().toISOString()
        });
      } else {
        // Update the client directly
        const clientRef = doc(db, 'clients', client.id!);
        await updateDoc(clientRef, {
          status: newStatus,
          updatedAt: new Date().toISOString()
        });
        
        // Also update any deals if they exist
        const q = query(collection(db, 'deals'), where('clientId', '==', client.id!));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const dealDoc = snap.docs[0];
          await updateDoc(doc(db, 'deals', dealDoc.id), {
            status: newStatus,
            updatedAt: new Date().toISOString()
          });
        }
      }
      
      onUpdated();
    } catch (err) {
      console.error("Error updating status", err);
      // Revert if failed
      setCurrentStatus(client.status || 'new');
    }
  };

  const handleLostConfirm = async (reason: string, details: string) => {
    setShowLostReasonModal(false);
    const targetStatus = pendingStatus || "lost";
    const fullReason = reason === "Otro" ? details : `${reason}${details ? ` - ${details}` : ""}`;
    
    try {
      setCurrentStatus(targetStatus);
      const isDeal = client.originalClientId && client.originalClientId !== client.id;
      const actualClientId = client.originalClientId || client.id;
      
      if (isDeal) {
        const dealRef = doc(db, 'deals', client.id!);
        await updateDoc(dealRef, {
          status: targetStatus,
          lostReason: fullReason,
          updatedAt: new Date().toISOString()
        });
        
        const clientRef = doc(db, 'clients', actualClientId!);
        await updateDoc(clientRef, {
          status: targetStatus,
          lostReason: fullReason,
          updatedAt: new Date().toISOString()
        });
      } else {
        const clientRef = doc(db, 'clients', client.id!);
        await updateDoc(clientRef, {
          status: targetStatus,
          lostReason: fullReason,
          updatedAt: new Date().toISOString()
        });
        
        const q = query(collection(db, 'deals'), where('clientId', '==', client.id!));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const dealDoc = snap.docs[0];
          await updateDoc(doc(db, 'deals', dealDoc.id), {
            status: targetStatus,
            lostReason: fullReason,
            updatedAt: new Date().toISOString()
          });
        }
      }
      onUpdated();
    } catch (err) {
      console.error("Error saving lost reason:", err);
      setCurrentStatus(client.status || 'new');
    }
    setPendingStatus(null);
  };

  const handleDealWonConfirm = async (saleDetails: any) => {
    setShowDealWonModal(false);
    const targetStatus = pendingStatus || "won";
    
    try {
      setCurrentStatus(targetStatus);
      const isDeal = client.originalClientId && client.originalClientId !== client.id;
      const actualClientId = client.originalClientId || client.id;
      
      if (isDeal) {
        const dealRef = doc(db, 'deals', client.id!);
        await updateDoc(dealRef, {
          status: targetStatus,
          soldAt: new Date().toISOString().split('T')[0],
          saleDetails,
          value: saleDetails?.price || client.dealValue || 0,
          updatedAt: new Date().toISOString()
        });
        
        const clientRef = doc(db, 'clients', actualClientId!);
        await updateDoc(clientRef, {
          status: targetStatus,
          soldAt: new Date().toISOString().split('T')[0],
          saleDetails,
          dealValue: saleDetails?.price || client.dealValue || 0,
          updatedAt: new Date().toISOString()
        });
      } else {
        const clientRef = doc(db, 'clients', client.id!);
        await updateDoc(clientRef, {
          status: targetStatus,
          soldAt: new Date().toISOString().split('T')[0],
          saleDetails,
          dealValue: saleDetails?.price || client.dealValue || 0,
          updatedAt: new Date().toISOString()
        });
        
        const q = query(collection(db, 'deals'), where('clientId', '==', client.id!));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const dealDoc = snap.docs[0];
          await updateDoc(doc(db, 'deals', dealDoc.id), {
            status: targetStatus,
            soldAt: new Date().toISOString().split('T')[0],
            saleDetails,
            updatedAt: new Date().toISOString()
          });
        }
      }

      if (client.vehicleId) {
        const vDoc = await getDoc(doc(db, 'vehicles', client.vehicleId));
        if (vDoc.exists()) {
          const vData = vDoc.data() as Vehicle;
          const originalPrice = vData.price || client.dealValue || 0;
          const proposedPrice = saleDetails?.price ? Number(saleDetails.price) : originalPrice;
          const purchasePrice = vData.purchasePrice || 0;
          const hasPriceChange = originalPrice > 0 && originalPrice !== proposedPrice;

          await updateDoc(doc(db, 'vehicles', client.vehicleId), {
            pendingValidation: {
              type: 'sold',
              requestedBy: userData?.id,
              requestedByName: userData?.name || userData?.email,
              clientId: actualClientId,
              dealId: client.id,
              clientName: client.name,
              originalPrice,
              proposedPrice,
              purchasePrice,
              hasPriceChange,
              saleDetails: saleDetails ? { ...saleDetails, price: proposedPrice } : { price: proposedPrice, method: 'contado' },
              vehicle: client.vehicle || (vData ? `${vData.year} ${vData.make} ${vData.model}` : null),
              requestedAt: new Date().toISOString(),
            },
          });
        }
      }

      onUpdated();
    } catch (err) {
      console.error("Error updating status:", err);
      setCurrentStatus(client.status || 'new');
    }
    setPendingStatus(null);
  };

  const handleAddQuickNote = async (type: string, prefixText?: string) => {
    if (isSubmittingNote) return;
    setIsSubmittingNote(true);
    try {
      let content = quickNote;
      if (prefixText) {
         content = content ? `${prefixText} - ${content}` : prefixText;
      }
      
      if (!content.trim()) {
        setIsSubmittingNote(false);
        return;
      }

      const actualClientId = client.originalClientId || client.id;
      const isDeal = Boolean(client.originalClientId && client.originalClientId !== client.id);
      const actualDealId = isDeal ? (client.id as string) : "";

      const noteData: Record<string, any> = {
        clientId: actualClientId,
        agencyId: userData?.agencyId || client.agencyId || "",
        content: content.trim(),
        type: type,
        createdAt: new Date().toISOString(),
      };
      if (actualDealId) {
        noteData.dealId = actualDealId;
      }
      if (userData?.id) {
        noteData.createdBy = userData.id;
      }
      if (userData?.name) {
        noteData.createdByName = userData.name;
      }
      Object.keys(noteData).forEach(
        (k) => noteData[k] === undefined && delete noteData[k]
      );

      await addDoc(collection(db, 'notes'), noteData);
      
      setQuickNote('');
      setNoteSuccess(true);
      setTimeout(() => setNoteSuccess(false), 2000);
      onUpdated();
      
      // refresh notes
      const idsToQuery = Array.from(new Set([actualClientId, client.id].filter(Boolean) as string[]));
      const notesMap = new Map<string, any>();

      for (const cId of idsToQuery) {
        const q = query(
          collection(db, "notes"),
          where("clientId", "==", cId)
        );
        const s = await getDocs(q);
        s.docs.forEach((d) => {
          notesMap.set(d.id, { ...d.data(), id: d.id });
        });
      }

      const dealIdsToQuery = Array.from(new Set([actualDealId, client.id].filter(Boolean) as string[]));
      for (const dId of dealIdsToQuery) {
        const q = query(
          collection(db, "notes"),
          where("dealId", "==", dId)
        );
        const s = await getDocs(q);
        s.docs.forEach((d) => {
          notesMap.set(d.id, { ...d.data(), id: d.id });
        });
      }

      const n = Array.from(notesMap.values());
      n.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setNotes(n);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingNote(false);
    }
  };

  const getWhatsAppLink = (phone: string) => {
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) cleaned = '52' + cleaned;
    return `https://wa.me/${cleaned}`;
  };

  return (
    <div className="fixed inset-0 bg-slate-100 dark:bg-slate-900 z-[100] flex flex-col animate-in slide-in-from-right duration-300">
      <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 shrink-0 sticky top-0 z-10">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white truncate pr-4">
          Ficha del Cliente
        </h2>
        <button onClick={onClose} className="p-2 -mr-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full bg-slate-100 dark:bg-slate-800">
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Profile Header */}
        <div className="bg-white dark:bg-slate-800 p-6 mb-2 shadow-sm border-b border-gray-200 dark:border-slate-700">
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-2xl mb-4">
            {client.name.substring(0,2).toUpperCase()}
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-1 leading-tight">{client.name}</h1>
          <p className="text-slate-500 flex items-center gap-1.5 text-sm mb-4">
            <User className="w-4 h-4" />
            {client.origin === 'facebook' ? 'Facebook' : client.origin === 'whatsapp' ? 'WhatsApp' : client.origin === 'website' ? 'Sitio Web' : 'Manual'}
          </p>

          <div className="flex gap-2">
            <a 
              href={client.phone ? `tel:${client.phone.replace(/\D/g, '')}` : undefined}
              className={clsx(
                "flex-1 flex items-center justify-center gap-2 py-3 rounded font-semibold transition-colors text-sm",
                client.phone ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-slate-100 dark:bg-slate-700 text-slate-400 pointer-events-none"
              )}
            >
              <Phone className="w-4 h-4" />
              Llamar
            </a>
            <a 
              href={client.phone ? getWhatsAppLink(client.phone) : undefined}
              target="_blank"
              rel="noopener noreferrer"
              className={clsx(
                "flex-1 flex items-center justify-center gap-2 py-3 rounded font-semibold transition-colors text-sm",
                client.phone ? "bg-[#25D366] text-white hover:bg-[#20b858]" : "bg-slate-100 dark:bg-slate-700 text-slate-400 pointer-events-none"
              )}
            >
              <MessageCircle className="w-4 h-4" />
              WhatsApp
            </a>
          </div>
        </div>

        {/* Detalles de Venta si está ganado o tiene saleDetails */}
        {(clientData?.saleDetails || currentStatus === 'won') && (() => {
          const sDetails = clientData?.saleDetails || {
            price: clientData?.dealValue || client.dealValue || assignedVehicle?.price || 0,
            method: 'contado'
          };
          const actualPrice = sDetails.price || clientData?.dealValue || client.dealValue || assignedVehicle?.price || 0;
          const vehicleName = assignedVehicle
            ? `${assignedVehicle.year} ${assignedVehicle.make} ${assignedVehicle.model}`
            : (clientData?.vehicle || client.vehicle || "Vehículo de la venta");

          const paymentsList = sDetails.payments || [];
          const totalPaid = paymentsList.reduce((acc: number, p: any) => acc + (p.amount || 0), 0);
          const remaining = Math.max(0, actualPrice - totalPaid);
          const pct = actualPrice > 0 ? Math.min(100, Math.round((totalPaid / actualPrice) * 100)) : 100;

          return (
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50/50 dark:from-emerald-950/30 dark:to-teal-950/20 p-4 mb-2 shadow-sm border-y border-emerald-200/80 dark:border-emerald-800/60">
              <div className="flex justify-between items-start mb-3 pb-2 border-b border-emerald-200/60 dark:border-emerald-800/40 gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-emerald-600 text-white shrink-0">
                    <Calculator className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5 flex-wrap">
                      <span>Detalles de Venta</span>
                      {remaining === 0 && actualPrice > 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 border border-emerald-300/50">
                          LIQUIDADO
                        </span>
                      ) : totalPaid > 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 border border-amber-300/50">
                          PARCIAL ({pct}%)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-300 border border-rose-300/50">
                          PENDIENTE
                        </span>
                      )}
                    </h3>
                    {(clientData?.soldAt || client.soldAt) && (
                      <p className="text-xs text-emerald-700 dark:text-emerald-400">
                        Fecha: {new Date((clientData?.soldAt || client.soldAt) + "T00:00:00").toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </p>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowPaymentModal(true)}
                  className="text-xs px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow transition-colors flex items-center gap-1 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Pago</span>
                </button>
              </div>

              <div 
                onClick={() => {
                  const vToOpen = assignedVehicle || (client.vehicleId ? { id: client.vehicleId, make: client.vehicle || 'Vehículo', model: '', price: actualPrice } : null);
                  if (vToOpen) setSelectedVehicleForModal(vToOpen as Vehicle);
                }}
                className="p-3 bg-white dark:bg-slate-800/80 rounded-lg border border-emerald-100 dark:border-emerald-900/40 mb-3 flex items-center gap-3 cursor-pointer hover:bg-emerald-50/50 transition-colors group"
                title="Ver ficha completa del auto"
              >
                {(assignedVehicle?.photoUrls?.[0] || assignedVehicle?.photoUrl || (assignedVehicle as any)?.images?.[0]) ? (
                  <img src={assignedVehicle?.photoUrls?.[0] || assignedVehicle?.photoUrl || (assignedVehicle as any)?.images?.[0]} alt={vehicleName} className="w-14 h-11 object-cover rounded border border-gray-200 dark:border-slate-700 shrink-0 group-hover:scale-105 transition-transform" />
                ) : (
                  <div className="w-10 h-10 rounded bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-700 dark:text-emerald-300 font-bold shrink-0">
                    <Car className="w-5 h-5" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase">Vehículo Vendido</p>
                    <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-bold group-hover:underline">Ver Auto</span>
                  </div>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{vehicleName}</p>
                  {assignedVehicle?.vin && (
                    <p className="text-[10px] font-mono text-slate-500">VIN: {assignedVehicle.vin}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs bg-white dark:bg-slate-800/80 p-3 rounded-lg border border-emerald-100 dark:border-emerald-900/40 mb-3">
                <div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Método de Pago</p>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 capitalize mt-0.5">
                    {sDetails.method === 'contado' ? 'Contado' : sDetails.method === 'credito_bancario' ? 'Crédito Bancario' : 'Crédito Propio'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Precio Final Acordado</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-emerald-700 dark:text-emerald-400 font-bold text-xs">$</span>
                    <input
                      type="number"
                      value={sDetails.price !== undefined && sDetails.price !== null ? sDetails.price : ''}
                      onChange={(e) => {
                        const newP = e.target.value === '' ? 0 : Number(e.target.value);
                        setClientData((prev: any) => ({
                          ...prev,
                          dealValue: newP,
                          saleDetails: {
                            ...(prev?.saleDetails || { method: 'contado' }),
                            price: newP
                          }
                        }));
                      }}
                      placeholder="0"
                      className="w-28 px-1.5 py-0.5 font-bold text-xs text-emerald-700 dark:text-emerald-400 bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
                {sDetails.method === 'credito' && (
                  <>
                    <div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Enganche</p>
                      <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                        {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(sDetails.downPayment || 0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Plazo / Tasa</p>
                      <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                        {sDetails.termMonths} meses @ {sDetails.interestRate}%
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* PROGRESS BAR */}
              <div className="bg-white dark:bg-slate-800/90 rounded-lg p-2.5 border border-emerald-100 dark:border-emerald-800/50 mb-3">
                <div className="flex justify-between items-center text-[11px] font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  <span>Progreso de Pagos</span>
                  <span>{pct}% ({new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(totalPaid)})</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden mb-1">
                  <div 
                    className={`h-full transition-all duration-300 ${remaining === 0 ? 'bg-emerald-500' : 'bg-amber-500'}`} 
                    style={{ width: `${pct}%` }} 
                  />
                </div>
              </div>

              {/* PAYMENT HISTORY */}
              <div className="bg-white dark:bg-slate-800/90 rounded-lg p-3 border border-emerald-100 dark:border-emerald-800/50">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 border-b border-gray-100 dark:border-slate-700 pb-1 flex justify-between items-center">
                  <span>Historial de Exhibiciones / Pagos</span>
                  <span className="text-[10px] font-normal text-slate-400">
                    {paymentsList.length} exhibición(es)
                  </span>
                </h4>

                {paymentsList.length > 0 ? (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {paymentsList.map((payment: any, idx: number) => (
                      <div key={`mob-pay-${payment.id || idx}`} className="flex justify-between items-center text-xs py-1 border-b border-gray-50 dark:border-slate-800/50 last:border-0">
                        <div>
                          <span className="font-bold text-slate-800 dark:text-slate-100">
                            {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(payment.amount)}
                          </span>
                          <span className="text-slate-500 dark:text-slate-400 ml-1.5">
                            • {payment.date ? new Date(payment.date + "T00:00:00").toLocaleDateString('es-MX', { month: 'short', day: 'numeric' }) : ''}
                          </span>
                          <span className="text-slate-400 ml-1 capitalize text-[11px]">
                            ({payment.method || 'Efectivo'})
                          </span>
                        </div>
                        {payment.id && (
                          <button
                            type="button"
                            onClick={() => handleDeletePayment(payment.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}

                    <div className="flex justify-between items-center text-xs font-bold pt-2 border-t border-gray-200 dark:border-slate-700">
                      <span className="text-slate-600 dark:text-slate-400">Saldo Restante</span>
                      <span className={remaining > 0 ? "text-rose-500 font-extrabold" : "text-emerald-600 font-extrabold"}>
                        {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(remaining)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 text-center py-2 italic flex flex-col items-center gap-1">
                    <span>Sin exhibiciones registradas</span>
                    <button
                      type="button"
                      onClick={() => setShowPaymentModal(true)}
                      className="text-emerald-600 font-semibold text-xs mt-0.5"
                    >
                      + Registrar pago
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Pipeline Stage */}
                <div className="bg-white dark:bg-slate-800 p-4 mb-2 shadow-sm border-y border-gray-200 dark:border-slate-700">
          <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Etapa del Embudo</h3>
          <div className="flex overflow-x-auto pb-2 -mx-4 px-4 snap-x hide-scrollbar gap-2 scroll-smooth">
            {pipelineStages.map((stage, idx) => {
              const isActive = currentStatus === stage.id;
              const isPast = pipelineStages.findIndex(s => s.id === currentStatus) > idx;
              return (
                <button
                  key={`stage-${stage.id}`}
                  onClick={() => handleStatusChange(stage.id)}
                  className={clsx(
                    "flex items-center shrink-0 snap-center px-4 py-2 rounded text-sm font-medium whitespace-nowrap transition-all",
                    isActive 
                      ? "bg-blue-600 text-white shadow-sm ring-2 ring-blue-600 ring-offset-2 dark:ring-offset-slate-800" 
                      : isPast
                        ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800/50"
                        : "bg-[#f4f5f5] dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-blue-400"
                  )}
                >
                  {stage.title || stage.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Quick Interactions */}
        <div className="bg-white dark:bg-slate-800 p-6 mb-2 shadow-sm border-y border-gray-200 dark:border-slate-700">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-3">Registro Rápido</h3>
          
          <div className="grid grid-cols-2 gap-2 mb-4">
            {quickActions.map(action => (
              <button
                key={`action-${action.id}`}
                onClick={() => setSelectedActionId(selectedActionId === action.id ? null : action.id)}
                className={clsx(
                  "flex items-center justify-center gap-2 py-3 rounded text-sm font-medium transition-colors border",
                  selectedActionId === action.id 
                    ? "bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-900/30 dark:border-blue-500 dark:text-blue-300"
                    : "bg-[#f4f5f5] border-transparent dark:bg-slate-900 dark:border-transparent text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                )}
              >
                <action.icon className={clsx("w-4 h-4", action.color)} />
                {action.label}
              </button>
            ))}
          </div>

          <div className="relative">
            <button
              onClick={toggleRecording}
              className={clsx(
                "absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded transition-colors",
                isRecording ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 animate-pulse" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              )}
            >
              <Mic className="w-4 h-4" />
            </button>
            <input
              type="text"
              placeholder={isRecording ? "Escuchando..." : "Nota adicional (opcional)..."}
              value={quickNote}
              onChange={(e) => setQuickNote(e.target.value)}
              className="w-full bg-[#f4f5f5] dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded pl-10 pr-12 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <button
              disabled={(!quickNote.trim() && !selectedActionId) || isSubmittingNote}
              onClick={() => {
                const action = quickActions.find(a => a.id === selectedActionId);
                handleAddQuickNote(action ? action.id : 'note', action ? action.prefix : undefined);
                setSelectedActionId(null);
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-blue-600 text-white rounded disabled:opacity-50 transition-colors"
            >
              {noteSuccess ? <Check className="w-4 h-4" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Historial (Notas) */}
        <div ref={historyRef} />
        <div className="bg-white dark:bg-slate-800 p-6 mb-2 shadow-sm border-y border-gray-200 dark:border-slate-700">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4">Historial</h3>
          {notes.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">No hay registros en el historial.</p>
          ) : (
            <div className="space-y-4">
              {notes.map(note => (
                <div key={`note-${note.id}`} className="relative pl-4 border-l-2 border-gray-200 dark:border-slate-700 pb-2 last:border-0 last:pb-0">
                  <div className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600" />
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      {note.createdByName || "Usuario"}
                    </span>
                    <span className="text-xs text-slate-400">
                      {format(new Date(note.createdAt), "dd MMM, HH:mm")}
                    </span>
                  </div>
                  <p className="text-sm text-slate-800 dark:text-slate-200 break-words [word-break:break-word]">{note.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {showDealWonModal && (
        <DealWonModal
          client={{ ...client, ...clientData } as Client}
          vehicle={assignedVehicle}
          onConfirm={handleDealWonConfirm}
          onCancel={() => setShowDealWonModal(false)}
        />
      )}

      {showLostReasonModal && (
        <LostReasonModal
          isOpen={showLostReasonModal}
          onClose={() => setShowLostReasonModal(false)}
          onConfirm={handleLostConfirm}
        />
      )}

      {showPaymentModal && (
        <PaymentModal
          onConfirm={handlePaymentConfirm}
          onCancel={() => setShowPaymentModal(false)}
          saleDetails={clientData?.saleDetails}
          isWon={checkIsWon(currentStatus, pipelineStages)}
          clientName={clientData?.name || client.name}
          maxAmount={(() => {
            const actualPrice = clientData?.saleDetails?.price || clientData?.dealValue || client.dealValue || assignedVehicle?.price || 0;
            const payments = clientData?.saleDetails?.payments || [];
            const paid = payments.reduce((acc: number, p: any) => acc + (p.amount || 0), 0);
            return Math.max(0, actualPrice - paid);
          })()}
        />
      )}

      {selectedVehicleForModal && (
        <VehicleDetailModal
          vehicle={selectedVehicleForModal}
          onClose={() => setSelectedVehicleForModal(null)}
          clientContext={client}
        />
      )}
    </div>
  );
}
