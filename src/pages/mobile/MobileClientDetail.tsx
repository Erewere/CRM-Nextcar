import { useCerrarConAtras } from "../../hooks/useVolver";
import React, { useState, useEffect, useRef } from 'react';
import { quitarVentaDeTratoPerdido } from '../../lib/ventaDescartada';
import { completarValorDelTrato } from "../../lib/valorDelTrato";
import { X, Phone, MessageCircle, Mail, MapPin, Calendar, User, AlignLeft, Send, Check, Car, Calculator, Trash2, Plus, ChevronLeft, ChevronRight, Pencil, CalendarPlus, Clock, Wallet } from 'lucide-react';
import { Client, Vehicle } from '../../types';
import { db } from '../../lib/firebase';
import { elegirTratoDeLaVenta, elegirTratoAbierto } from "../../lib/ventas";
import { hoyLocal } from "../../lib/fechas";
import { doc, setDoc, addDoc, collection, getDoc, updateDoc, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { esElCompradorDelVehiculo } from '../../lib/ventaDeVehiculo';
import { useAuth } from '../../contexts/AuthContext';
import clsx from 'clsx';
import { format } from 'date-fns';
import { checkIsWon, checkIsLost, sanitizeFirestoreData } from '../../lib/clientUtils';
import { DealWonModal } from '../../components/DealWonModal';
import { LostReasonModal } from '../../components/LostReasonModal';
import { PaymentModal } from '../../components/PaymentModal';
import { VehicleDetailModal } from '../../components/VehicleDetailModal';
import { createPaymentTasks } from '../../lib/paymentTasks';
import { avisarEtapaCredito } from '../../lib/creditoDesdeEmbudo';
import { useNavigate } from 'react-router';
import { ClientDetailModal } from '../../components/ClientDetailModal';
import { NewActivityModal } from '../../components/NewActivityModal';
import { etiquetaDeFuente, fuenteDelContacto } from '../../lib/fuentes';

interface Props {
  client: Client;
  onClose: () => void;
  onUpdated: () => void;
  scrollToHistory?: boolean;
}

export function MobileClientDetail({ client, onClose, onUpdated, scrollToHistory }: Props) {
  // El botón de atrás (y el gesto del iPhone) cierra esta ventana en vez de salirse de la pantalla.
  useCerrarConAtras(onClose);
  const { userData } = useAuth();
  const [pipelineStages, setPipelineStages] = useState<any[]>([]);
  const [currentStatus, setCurrentStatus] = useState(client.status || 'new');
  const [clientData, setClientData] = useState<Partial<Client>>(client);
  const navigate = useNavigate();
  // Los pagos se registran en la página de la venta (todo pasa por el servidor).
  const tratoDeLaVenta = (clientData as any)?.ventaDealId || ((client as any).originalClientId && (client as any).originalClientId !== client.id ? client.id : null);
  const irAPagos = () => { if (tratoDeLaVenta) navigate(`/venta/${tratoDeLaVenta}`); else setShowPaymentModal(true); };
  const [showDealWonModal, setShowDealWonModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showLostReasonModal, setShowLostReasonModal] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [assignedVehicle, setAssignedVehicle] = useState<Vehicle | null>(null);
  const [selectedVehicleForModal, setSelectedVehicleForModal] = useState<Vehicle | null>(null);

  const handlePaymentConfirm = async (payment: any) => {
    setShowPaymentModal(false);
    if (userData?.role === 'seller') {
      alert("Solamente los administradores pueden registrar pagos.");
      return;
    }
    const todayIso = hoyLocal();
    
    const baseDetails = clientData?.saleDetails || {
      price: clientData?.dealValue || client.dealValue || 0,
      method: 'contado',
      payments: []
    };
    
    const newPayment: any = {
      amount: Number(payment.amount) || 0,
      date: payment.date || todayIso,
      method: payment.method || 'efectivo',
      notes: payment.notes || '',
      id: Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString()
    };
    if (payment.installmentNumber !== undefined && payment.installmentNumber !== null) {
      newPayment.installmentNumber = payment.installmentNumber;
    }
    
    const updatedSaleDetails = {
      ...baseDetails,
      payments: [...(baseDetails.payments || []), newPayment]
    };

    const finalClientId = (client.originalClientId || client.id) as string;
    const isDeal = Boolean(client.originalClientId && client.originalClientId !== client.id);
    const finalDealId = isDeal ? (client.id as string) : null;

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

      const sanitizedData = sanitizeFirestoreData(updateData);

      if (finalDealId) {
        await setDoc(doc(db, "deals", finalDealId), sanitizedData, { merge: true });
      }
      if (finalClientId) {
        // Al contacto solo va la referencia: el dinero y los abonos viven en
        // el trato, para que no queden dos versiones de la misma venta.
        const referencia: any = { updatedAt: new Date().toISOString() };
        if (payment.markSaleAsWon) {
          referencia.status = newStatus;
          referencia.soldAt = todayIso;
        }
        if (finalDealId) referencia.ventaDealId = finalDealId;
        await setDoc(doc(db, "clients", finalClientId), referencia, { merge: true });
      }
      const vId = clientData?.vehicleId || client.vehicleId;
      const isThisClientTheBuyer = Boolean(payment.markSaleAsWon || currentStatus === 'won' || clientData?.status === 'won' || client?.status === 'won');
      if (vId && isThisClientTheBuyer) {
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
        await setDoc(doc(db, "vehicles", vId), sanitizeFirestoreData(vehicleUpdate), { merge: true });
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
    if (userData?.role === 'seller') {
      alert("Solamente los administradores pueden gestionar pagos.");
      return;
    }
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
      // El auto solo se toca si es el comprador quien esta borrando el pago.
      // Este documento lo comparten todos los interesados en esa unidad, asi
      // que sin la comprobacion el historial de cualquiera de ellos acababa
      // escrito en el auto, encima del historial de la venta real.
      const idVehiculo = (clientData?.vehicleId || client.vehicleId) as string | undefined;
      if (idVehiculo) {
        const refVehiculo = doc(db, "vehicles", idVehiculo);
        const vehiculo = await getDoc(refVehiculo);
        if (esElCompradorDelVehiculo(vehiculo.data(), finalClientId, finalDealId)) {
          await setDoc(refVehiculo, updateData, { merge: true });
        }
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
        setClientData(prev => ({ ...prev, ...cData, saleDetails: cData.saleDetails }));
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
            saleDetails: dData.saleDetails,
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
          setAssignedVehicle({ ...snap.data(), id: snap.id } as Vehicle);
        }
      }).catch(err => console.error("Error fetching vehicle:", err));
    }
  }, [clientData.vehicleId, client.vehicleId]);
  
  // Quick note state
  const [quickNote, setQuickNote] = useState('');
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [noteSuccess, setNoteSuccess] = useState(false);
  const [notes, setNotes] = useState<any[]>([]);
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);

  const quickActions = [
    { id: 'call', label: 'Llamada', prefix: 'Llamada saliente', icon: Phone, color: 'text-blue-500' },
    { id: 'whatsapp', label: 'WhatsApp', prefix: 'Mensaje de WhatsApp', icon: MessageCircle, color: 'text-green-500' },
    { id: 'meeting', label: 'Visita', prefix: 'Visitó agencia', icon: MapPin, color: 'text-rose-500' },
    { id: 'other', label: 'Test Drive', prefix: 'Hizo Test Drive', icon: Car, color: 'text-purple-500' }
  ];

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
          const q = (userData?.role !== "master" && userData?.agencyId)
            ? query(
                collection(db, "notes"),
                where("clientId", "==", cId),
                where("agencyId", "==", userData.agencyId)
              )
            : query(
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
          const q = (userData?.role !== "master" && userData?.agencyId)
            ? query(
                collection(db, "notes"),
                where("dealId", "==", dId),
                where("agencyId", "==", userData.agencyId)
              )
            : query(
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
              { id: "credito", title: "Crédito" },
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
        
        completarValorDelTrato(client.id!);
        avisarEtapaCredito(client.id!, newStatus, pipelineStages);

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
        const q = (userData?.role !== "master" && userData?.agencyId)
          ? query(collection(db, 'deals'), where('clientId', '==', client.id!), where('agencyId', '==', userData.agencyId))
          : query(collection(db, 'deals'), where('clientId', '==', client.id!));
        const snap = await getDocs(q);
        // Nunca el trato que lleva una venta: ver elegirTratoAbierto.
        const dealDoc = elegirTratoAbierto(snap.docs.map(d => ({ ...d.data(), id: d.id })), client.vehicleId, pipelineStages);
        if (dealDoc) {
          await updateDoc(doc(db, 'deals', dealDoc.id), {
            status: newStatus,
            updatedAt: new Date().toISOString()
          });
          completarValorDelTrato(dealDoc.id);
          avisarEtapaCredito(dealDoc.id, newStatus, pipelineStages);
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
        await quitarVentaDeTratoPerdido(client.id!);
        
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
        
        const q = (userData?.role !== "master" && userData?.agencyId)
          ? query(collection(db, 'deals'), where('clientId', '==', client.id!), where('agencyId', '==', userData.agencyId))
          : query(collection(db, 'deals'), where('clientId', '==', client.id!));
        const snap = await getDocs(q);
        // Nunca el trato que lleva una venta: ver elegirTratoAbierto.
        const dealDoc = elegirTratoAbierto(snap.docs.map(d => ({ ...d.data(), id: d.id })), client.vehicleId, pipelineStages);
        if (dealDoc) {
          await updateDoc(doc(db, 'deals', dealDoc.id), {
            status: targetStatus,
            lostReason: fullReason,
            updatedAt: new Date().toISOString()
          });
          await quitarVentaDeTratoPerdido(dealDoc.id);
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
      let tratoDeLaVenta: any = null;
      const isDeal = client.originalClientId && client.originalClientId !== client.id;
      const actualClientId = client.originalClientId || client.id;
      
      if (isDeal) {
        const dealRef = doc(db, 'deals', client.id!);
        await updateDoc(dealRef, {
          status: targetStatus,
          soldAt: hoyLocal(),
          saleDetails,
          value: saleDetails?.price || client.dealValue || 0,
          updatedAt: new Date().toISOString()
        });
        
        // Al contacto solo la referencia; el dinero queda en el trato.
        const clientRef = doc(db, 'clients', actualClientId!);
        await updateDoc(clientRef, {
          status: targetStatus,
          soldAt: hoyLocal(),
          ventaDealId: client.id,
          updatedAt: new Date().toISOString()
        });
      } else {
        const clientRef = doc(db, 'clients', client.id!);
        await updateDoc(clientRef, {
          status: targetStatus,
          soldAt: hoyLocal(),
          updatedAt: new Date().toISOString()
        });
        
        const q = (userData?.role !== "master" && userData?.agencyId)
          ? query(collection(db, 'deals'), where('clientId', '==', client.id!), where('agencyId', '==', userData.agencyId))
          : query(collection(db, 'deals'), where('clientId', '==', client.id!));
        const snap = await getDocs(q);
        // El trato de esta venta, no el primero de la lista: ver elegirTratoDeLaVenta.
        const dealDoc: any = elegirTratoDeLaVenta(snap.docs.map(d => ({ ...d.data(), id: d.id })), client.vehicleId, pipelineStages);
        tratoDeLaVenta = dealDoc;
        if (dealDoc) {
          await updateDoc(doc(db, 'deals', dealDoc.id), {
            status: targetStatus,
            soldAt: hoyLocal(),
            saleDetails,
            updatedAt: new Date().toISOString()
          });
          await updateDoc(clientRef, { ventaDealId: dealDoc.id });
        }
      }

      const idAutoVenta: string | undefined = client.vehicleId || tratoDeLaVenta?.vehicleId || undefined;
      if (idAutoVenta) {
        const vDoc = await getDoc(doc(db, 'vehicles', idAutoVenta));
        if (vDoc.exists()) {
          const vData = vDoc.data() as Vehicle;
          const originalPrice = vData.price || client.dealValue || 0;
          const proposedPrice = saleDetails?.price ? Number(saleDetails.price) : originalPrice;
          const hasPriceChange = originalPrice > 0 && originalPrice !== proposedPrice;

          await updateDoc(doc(db, 'vehicles', idAutoVenta), {
            pendingValidation: {
              type: 'sold',
              requestedBy: userData?.id,
              requestedByName: userData?.name || userData?.email,
              clientId: actualClientId,
              dealId: client.id,
              clientName: client.name,
              originalPrice,
              proposedPrice,
              // El costo no se copia aqui: nadie lo leia de este registro, y
              // quien cierra una venta no necesariamente puede verlo.
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
        const q = (userData?.role !== "master" && userData?.agencyId)
          ? query(
              collection(db, "notes"),
              where("clientId", "==", cId),
              where("agencyId", "==", userData.agencyId)
            )
          : query(
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
        const q = (userData?.role !== "master" && userData?.agencyId)
          ? query(
              collection(db, "notes"),
              where("dealId", "==", dId),
              where("agencyId", "==", userData.agencyId)
            )
          : query(
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


  // --- Pantalla nueva: etapa en hoja inferior, pendientes del cliente, ficha completa y agendar ---
  const [verEtapas, setVerEtapas] = useState(false);
  const [verFichaCompleta, setVerFichaCompleta] = useState(false);
  const [agendando, setAgendando] = useState(false);
  const [tareas, setTareas] = useState<any[]>([]);
  const idContacto = client.originalClientId || client.id;
  useEffect(() => {
    if (!userData?.agencyId || !idContacto) return;
    // Solo lectura: las tareas pendientes de este cliente, para ver qué sigue sin salir de la ficha.
    return onSnapshot(
      query(collection(db, 'tasks'), where('agencyId', '==', userData.agencyId), where('clientId', '==', idContacto)),
      (s) => setTareas(s.docs.map((d) => ({ ...d.data(), id: d.id })).filter((t: any) => !t.completed)
        .sort((a: any, b: any) => `${a.dueDate || '9999'} ${a.startTime || ''}`.localeCompare(`${b.dueDate || '9999'} ${b.startTime || ''}`))),
      () => {},
    );
  }, [userData?.agencyId, idContacto]);

  const hoyStr = hoyLocal();
  const cuando = (t: any) => {
    if (!t.dueDate) return 'Sin fecha';
    const d = new Date(t.dueDate + 'T00:00:00');
    const man = new Date(); man.setDate(man.getDate() + 1);
    const manStr = `${man.getFullYear()}-${String(man.getMonth() + 1).padStart(2, '0')}-${String(man.getDate()).padStart(2, '0')}`;
    const dia = t.dueDate === hoyStr ? 'Hoy' : t.dueDate === manStr ? 'Mañana' : format(d, 'dd MMM');
    return t.startTime ? `${dia} · ${t.startTime}` : dia;
  };
  const pesosMx = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);
  const etapaActual = pipelineStages.find((s) => s.id === currentStatus)?.title || pipelineStages.find((s) => s.id === currentStatus)?.name || '';
  const gano = checkIsWon(currentStatus, pipelineStages);
  const perdio = checkIsLost(currentStatus, pipelineStages);
  const telefono = clientData.phone || client.phone;
  const correo = (clientData as any).email || (client as any).email;
  const busca = (() => {
    const w: any = clientData.wantedVehicle || client.wantedVehicle;
    if (!w) return '';
    const t = [w.make, w.model, w.bodyType && w.bodyType !== 'Cualquiera' ? w.bodyType : ''].filter(Boolean).join(' ');
    const anios = w.yearMin || w.yearMax ? `${w.yearMin || ''}${w.yearMin && w.yearMax ? '–' : w.yearMax ? 'hasta ' : '+'}${w.yearMax || ''}` : '';
    const precio = w.priceMax ? `hasta ${pesosMx(w.priceMax)}` : '';
    return [t, anios, precio].filter(Boolean).join(' · ');
  })();
  const ICONO_NOTA: Record<string, any> = { call: Phone, whatsapp: MessageCircle, meeting: MapPin, other: Car };
  const CHIPS = [{ id: 'note', label: 'Nota', prefix: undefined as string | undefined, icon: AlignLeft, color: 'text-slate-500' }, ...quickActions.map((a) => ({ ...a, label: a.id === 'other' ? 'Prueba de manejo' : a.label }))];

  const getWhatsAppLink = (phone: string) => {
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) cleaned = '52' + cleaned;
    return `https://wa.me/${cleaned}`;
  };


  return (
    <div className="fixed inset-0 bg-slate-50 dark:bg-slate-900 z-[100] flex flex-col animate-in slide-in-from-right duration-300">
      {/* Barra superior: volver, nombre y acceso a la ficha completa (donde se edita todo). */}
      <div className="flex items-center gap-2 px-2 py-2 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200/70 dark:border-slate-800 shrink-0">
        <button onClick={onClose} aria-label="Volver" className="h-11 w-11 rounded-full flex items-center justify-center text-slate-700 dark:text-slate-200 active:bg-slate-100 dark:active:bg-slate-800">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <p className="flex-1 min-w-0 text-base font-bold text-slate-900 dark:text-white truncate">{client.name}</p>
        <button onClick={() => setVerFichaCompleta(true)} className="h-10 px-3 rounded-full flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 active:scale-95 transition-transform">
          <Pencil className="w-4 h-4" /> Editar
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-4 max-w-xl mx-auto">

          {/* Quién es y en qué va */}
          <section className="rounded-3xl bg-white dark:bg-slate-800 shadow-sm ring-1 ring-slate-200/70 dark:ring-slate-700 p-5">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 shrink-0 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-extrabold text-xl">
                {client.name.substring(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight break-words">{client.name}</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{etiquetaDeFuente(fuenteDelContacto(clientData as any))}</p>
              </div>
            </div>

            <button
              onClick={() => setVerEtapas(true)}
              className={clsx(
                "mt-4 w-full flex items-center justify-between gap-2 rounded-2xl px-4 py-3 text-left active:scale-[0.99] transition-transform",
                gano ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300" : perdio ? "bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300" : "bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300"
              )}
            >
              <span>
                <span className="block text-[10px] font-bold uppercase tracking-[0.14em] opacity-70">Etapa del embudo</span>
                <span className="block text-base font-extrabold">{etapaActual || 'Sin etapa'}</span>
              </span>
              <span className="text-xs font-bold flex items-center gap-0.5">Cambiar <ChevronRight className="w-4 h-4" /></span>
            </button>

            <div className="mt-3 grid grid-cols-4 gap-2">
              {[
                { t: 'Llamar', Icono: Phone, href: telefono ? `tel:${telefono.replace(/\D/g, '')}` : undefined, color: 'bg-blue-600 text-white' },
                { t: 'WhatsApp', Icono: MessageCircle, href: telefono ? getWhatsAppLink(telefono) : undefined, color: 'bg-[#25D366] text-white', ext: true },
              ].map((a) => (
                <a
                  key={a.t}
                  href={a.href}
                  target={a.ext ? '_blank' : undefined}
                  rel={a.ext ? 'noopener noreferrer' : undefined}
                  className={clsx("flex flex-col items-center justify-center gap-1 rounded-2xl py-3 text-[12px] font-bold active:scale-95 transition-transform", a.href ? a.color : "bg-slate-100 dark:bg-slate-700 text-slate-400 pointer-events-none")}
                >
                  <a.Icono className="w-5 h-5" /> {a.t}
                </a>
              ))}
              <button onClick={() => setAgendando(true)} className="flex flex-col items-center justify-center gap-1 rounded-2xl py-3 text-[12px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 active:scale-95 transition-transform">
                <CalendarPlus className="w-5 h-5" /> Agendar
              </button>
              <button
                onClick={() => { historyRef.current?.scrollIntoView({ behavior: 'smooth' }); setTimeout(() => (document.getElementById('nota-rapida') as HTMLInputElement | null)?.focus(), 350); }}
                className="flex flex-col items-center justify-center gap-1 rounded-2xl py-3 text-[12px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200 active:scale-95 transition-transform"
              >
                <AlignLeft className="w-5 h-5" /> Nota
              </button>
            </div>
          </section>

          {/* Lo que sigue: tareas pendientes de este cliente */}
          <section className="rounded-3xl bg-white dark:bg-slate-800 shadow-sm ring-1 ring-slate-200/70 dark:ring-slate-700 p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Lo que sigue</h2>
              <button onClick={() => setAgendando(true)} className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Agendar</button>
            </div>
            {tareas.length === 0 ? (
              <p className="text-sm text-slate-500 py-2">Sin tareas pendientes. Agenda la siguiente para no perder al cliente.</p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                {tareas.slice(0, 3).map((t) => {
                  const vencida = t.dueDate && t.dueDate < hoyStr;
                  return (
                    <li key={t.id} className="py-2.5 flex items-center gap-3">
                      <span className={clsx("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", vencida ? "bg-red-50 text-red-600 dark:bg-red-950/40" : "bg-amber-50 text-amber-600 dark:bg-amber-950/30")}>
                        <Clock className="w-4 h-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{t.title}</span>
                        <span className={clsx("block text-xs", vencida ? "text-red-600 font-bold" : "text-slate-500")}>{vencida ? 'Vencida · ' : ''}{cuando(t)}</span>
                      </span>
                    </li>
                  );
                })}
                {tareas.length > 3 && <li className="pt-2 text-xs text-slate-500">y {tareas.length - 3} más en Tareas</li>}
              </ul>
            )}
          </section>

          {/* Datos y lo que busca */}
          {(telefono || correo || busca || client.vehicle || (clientData.dealValue || client.dealValue)) && (
            <section className="rounded-3xl bg-white dark:bg-slate-800 shadow-sm ring-1 ring-slate-200/70 dark:ring-slate-700 p-4">
              <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 mb-2">Datos</h2>
              <dl className="space-y-3">
                {telefono && <Dato Icono={Phone} t="Teléfono" v={telefono} href={`tel:${telefono.replace(/\D/g, '')}`} />}
                {correo && <Dato Icono={Mail} t="Correo" v={correo} href={`mailto:${correo}`} />}
                {busca && <Dato Icono={Car} t="Busca" v={busca} />}
                {!busca && client.vehicle && <Dato Icono={Car} t="Auto de interés" v={client.vehicle} />}
                {(clientData.dealValue || client.dealValue) ? <Dato Icono={Wallet} t="Valor del trato" v={pesosMx(Number(clientData.dealValue || client.dealValue))} /> : null}
              </dl>
            </section>
          )}

          {/* Detalles de la venta (si ya se vendió) */}
          <div className="rounded-3xl overflow-hidden empty:hidden">
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

                {(userData?.role === 'master' || userData?.role === 'admin') && (
                  <button
                    type="button"
                    onClick={irAPagos}
                    className="text-xs px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow transition-colors flex items-center gap-1 shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Pago</span>
                  </button>
                )}
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
                        {(userData?.role === 'master' || userData?.role === 'admin') && payment.id && (
                          <button
                            type="button"
                            onClick={() => (tratoDeLaVenta ? irAPagos() : handleDeletePayment(payment.id))}
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
                    {(userData?.role === 'master' || userData?.role === 'admin') && (
                      <button
                        type="button"
                        onClick={irAPagos}
                        className="text-emerald-600 font-semibold text-xs mt-0.5"
                      >
                        + Registrar pago
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })()}
          </div>

          {/* Historial */}
          <div ref={historyRef} />
          <section className="rounded-3xl bg-white dark:bg-slate-800 shadow-sm ring-1 ring-slate-200/70 dark:ring-slate-700 p-4">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 mb-3">Historial</h2>
            {notes.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">Todavía no hay registros. Anota abajo la primera llamada o mensaje.</p>
            ) : (
              <ol className="space-y-4">
                {notes.map((note) => {
                  const Icono = ICONO_NOTA[note.type] || AlignLeft;
                  return (
                    <li key={`note-${note.id}`} className="flex gap-3">
                      <span className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 flex items-center justify-center shrink-0 mt-0.5"><Icono className="w-4 h-4" /></span>
                      <div className="min-w-0 flex-1">
                        <div className="flex justify-between items-baseline gap-2">
                          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 truncate">{note.createdByName || 'Usuario'}</span>
                          <span className="text-[11px] text-slate-400 shrink-0">{format(new Date(note.createdAt), 'dd MMM, HH:mm')}</span>
                        </div>
                        <p className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-words [word-break:break-word] mt-0.5">{note.content}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </div>
      </div>

      {/* Registro rápido: siempre a la mano abajo. Elige qué pasó y, si quieres, añade una nota. */}
      <div className="shrink-0 bg-white dark:bg-slate-900 border-t border-slate-200/70 dark:border-slate-800 px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <div className="flex gap-1.5 overflow-x-auto pb-2 hide-scrollbar">
          {CHIPS.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedActionId(selectedActionId === c.id ? null : c.id)}
              className={clsx("shrink-0 h-9 px-3 rounded-full text-xs font-bold flex items-center gap-1.5 border transition-colors",
                selectedActionId === c.id ? "bg-blue-600 border-blue-600 text-white" : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300")}
            >
              <c.icon className={clsx("w-3.5 h-3.5", selectedActionId === c.id ? "text-white" : c.color)} /> {c.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            id="nota-rapida"
            type="text"
            placeholder={selectedActionId && selectedActionId !== 'note' ? 'Detalle (opcional)…' : 'Escribe una nota…'}
            value={quickNote}
            onChange={(e) => setQuickNote(e.target.value)}
            className="flex-1 min-w-0 h-11 bg-slate-100 dark:bg-slate-800 rounded-full px-4 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            disabled={(!quickNote.trim() && (!selectedActionId || selectedActionId === 'note')) || isSubmittingNote}
            onClick={() => {
              const action = quickActions.find((a) => a.id === selectedActionId);
              handleAddQuickNote(action ? action.id : 'note', action ? action.prefix : undefined);
              setSelectedActionId(null);
            }}
            aria-label="Guardar registro"
            className="h-11 w-11 rounded-full bg-blue-600 text-white flex items-center justify-center disabled:opacity-40 active:scale-95 transition-all shrink-0"
          >
            {noteSuccess ? <Check className="w-5 h-5" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Cambiar de etapa: hoja desde abajo */}
      {verEtapas && (
        <div className="fixed inset-0 z-[110] flex items-end bg-black/50" onClick={() => setVerEtapas(false)}>
          <div className="w-full bg-white dark:bg-slate-900 rounded-t-3xl pb-[max(1rem,env(safe-area-inset-bottom))] max-h-[80dvh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-600" />
            <div className="px-5 pt-3 pb-2 flex items-center justify-between">
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">Cambiar de etapa</h3>
              <button onClick={() => setVerEtapas(false)} aria-label="Cerrar" className="h-9 w-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center"><X className="w-5 h-5 text-slate-500" /></button>
            </div>
            <ul className="px-3 pb-2">
              {pipelineStages.map((stage) => {
                const activa = currentStatus === stage.id;
                return (
                  <li key={`stage-${stage.id}`}>
                    <button
                      onClick={() => { setVerEtapas(false); if (!activa) handleStatusChange(stage.id); }}
                      className={clsx("w-full flex items-center justify-between rounded-2xl px-4 py-3.5 text-left text-[15px] font-semibold", activa ? "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300" : "text-slate-800 dark:text-slate-100 active:bg-slate-50 dark:active:bg-slate-800")}
                    >
                      {stage.title || stage.name}
                      {activa && <Check className="w-5 h-5" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      {agendando && (
        <NewActivityModal
          onClose={() => setAgendando(false)}
          onSave={() => { setAgendando(false); onUpdated(); }}
          clients={[{ ...client, id: idContacto } as Client]}
          currentUser={userData}
          initialData={{ clientId: idContacto }}
        />
      )}

      {verFichaCompleta && (
        <div className="fixed inset-0 z-[130]">
          <ClientDetailModal client={client} initialStatus={currentStatus} onClose={() => setVerFichaCompleta(false)} />
        </div>
      )}

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

function Dato({ Icono, t, v, href }: { Icono: any; t: string; v: string; href?: string }) {
  const cuerpo = (
    <>
      <span className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 flex items-center justify-center shrink-0"><Icono className="w-4 h-4" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] text-slate-500">{t}</span>
        <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100 break-words">{v}</span>
      </span>
    </>
  );
  return <div>{href ? <a href={href} className="flex items-center gap-3 active:opacity-70">{cuerpo}</a> : <div className="flex items-center gap-3">{cuerpo}</div>}</div>;
}
