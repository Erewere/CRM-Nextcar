import React, { useState, useEffect } from 'react';
import { X, Phone, MessageCircle, Mail, MapPin, Tag, Calendar, User, AlignLeft, Send, Check, Car } from 'lucide-react';
import { Client } from '../../types';
import { db } from '../../lib/firebase';
import { doc, setDoc, addDoc, collection, getDoc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import clsx from 'clsx';
import { format } from 'date-fns';

interface Props {
  client: Client;
  onClose: () => void;
  onUpdated: () => void;
}

export function MobileClientDetail({ client, onClose, onUpdated }: Props) {
  const { userData } = useAuth();
  const [pipelineStages, setPipelineStages] = useState<any[]>([]);
  const [currentStatus, setCurrentStatus] = useState(client.status || 'new');
  
  // Quick note state
  const [quickNote, setQuickNote] = useState('');
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [noteSuccess, setNoteSuccess] = useState(false);

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
    try {
      setCurrentStatus(newStatus);
      const clientRef = doc(db, 'clients', client.id!);
      await updateDoc(clientRef, {
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
      
      // Also update any deals if they exist (simplification for mobile)
      
      onUpdated();
    } catch (err) {
      console.error("Error updating status", err);
      // Revert if failed
      setCurrentStatus(client.status || 'new');
    }
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

      await addDoc(collection(db, 'notes'), {
        clientId: client.id,
        agencyId: userData?.agencyId,
        content: content.trim(),
        type: type,
        createdAt: new Date().toISOString(),
        createdBy: userData?.id,
        createdByName: userData?.name
      });
      
      setQuickNote('');
      setNoteSuccess(true);
      setTimeout(() => setNoteSuccess(false), 2000);
      onUpdated();
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
      <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0 sticky top-0 z-10">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white truncate pr-4">
          Ficha del Cliente
        </h2>
        <button onClick={onClose} className="p-2 -mr-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full bg-slate-100 dark:bg-slate-800">
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Profile Header */}
        <div className="bg-white dark:bg-slate-800 p-6 mb-2 shadow-sm border-b border-slate-200 dark:border-slate-700">
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
                "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold transition-colors text-sm",
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
                "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold transition-colors text-sm",
                client.phone ? "bg-[#25D366] text-white hover:bg-[#20b858]" : "bg-slate-100 dark:bg-slate-700 text-slate-400 pointer-events-none"
              )}
            >
              <MessageCircle className="w-4 h-4" />
              WhatsApp
            </a>
          </div>
        </div>

        {/* Pipeline Stage */}
        <div className="bg-white dark:bg-slate-800 p-6 mb-2 shadow-sm border-y border-slate-200 dark:border-slate-700">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-3">Etapa del Embudo</h3>
          <div className="flex overflow-x-auto pb-2 -mx-2 px-2 snap-x hide-scrollbar gap-2">
            {pipelineStages.map((stage) => {
              const isActive = currentStatus === stage.id;
              return (
                <button
                  key={stage.id}
                  onClick={() => handleStatusChange(stage.id)}
                  className={clsx(
                    "shrink-0 snap-center px-4 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap transition-all border",
                    isActive 
                      ? "bg-blue-600 border-blue-600 text-white shadow-md" 
                      : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-blue-400"
                  )}
                >
                  {stage.title || stage.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Quick Interactions */}
        <div className="bg-white dark:bg-slate-800 p-6 mb-2 shadow-sm border-y border-slate-200 dark:border-slate-700">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-3">Registro Rápido</h3>
          
          <div className="grid grid-cols-2 gap-2 mb-4">
            <button
              onClick={() => handleAddQuickNote('call', 'Llamada saliente')}
              className="flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 py-3 rounded-xl text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              <Phone className="w-4 h-4 text-blue-500" />
              Llamada
            </button>
            <button
              onClick={() => handleAddQuickNote('whatsapp', 'Mensaje de WhatsApp')}
              className="flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 py-3 rounded-xl text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              <MessageCircle className="w-4 h-4 text-green-500" />
              WhatsApp
            </button>
            <button
              onClick={() => handleAddQuickNote('meeting', 'Visitó agencia')}
              className="flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 py-3 rounded-xl text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              <MapPin className="w-4 h-4 text-rose-500" />
              Visita
            </button>
            <button
              onClick={() => handleAddQuickNote('other', 'Hizo Test Drive')}
              className="flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 py-3 rounded-xl text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              <Car className="w-4 h-4 text-purple-500" />
              Test Drive
            </button>
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder="Nota adicional (opcional)..."
              value={quickNote}
              onChange={(e) => setQuickNote(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-4 pr-12 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <button
              disabled={!quickNote.trim() || isSubmittingNote}
              onClick={() => handleAddQuickNote('note')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-blue-600 text-white rounded-lg disabled:opacity-50 transition-colors"
            >
              {noteSuccess ? <Check className="w-4 h-4" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
