import React, { useState, useEffect, useRef } from 'react';
import { X, Phone, MessageCircle, Mail, MapPin, Tag, Calendar, User, AlignLeft, Send, Check, Car, Mic } from 'lucide-react';
import { Client } from '../../types';
import { db } from '../../lib/firebase';
import { doc, setDoc, addDoc, collection, getDoc, updateDoc, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import clsx from 'clsx';
import { format } from 'date-fns';

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
        const q = query(collection(db, "notes"), where("clientId", "==", client.id));
        const s = await getDocs(q);
        const n = s.docs.map((d) => ({ ...d.data(), id: d.id }) as any);
        n.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setNotes(n);
      } catch (error) {
        console.error("Error loading notes:", error);
      }
    };
    loadNotes();
  }, [client.id]);

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
      
      // refresh notes
      const q = query(collection(db, "notes"), where("clientId", "==", client.id));
      const s = await getDocs(q);
      const n = s.docs.map((d) => ({ ...d.data(), id: d.id }) as any);
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
                <div className="bg-white dark:bg-slate-800 p-4 mb-2 shadow-sm border-y border-slate-200 dark:border-slate-700">
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
                    "flex items-center shrink-0 snap-center px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all",
                    isActive 
                      ? "bg-blue-600 text-white shadow-md ring-2 ring-blue-600 ring-offset-2 dark:ring-offset-slate-800" 
                      : isPast
                        ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800/50"
                        : "bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-blue-400"
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
            {quickActions.map(action => (
              <button
                key={`action-${action.id}`}
                onClick={() => setSelectedActionId(selectedActionId === action.id ? null : action.id)}
                className={clsx(
                  "flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-colors border",
                  selectedActionId === action.id 
                    ? "bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-900/30 dark:border-blue-500 dark:text-blue-300"
                    : "bg-slate-50 border-transparent dark:bg-slate-900 dark:border-transparent text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
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
                "absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-colors",
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
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-12 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <button
              disabled={(!quickNote.trim() && !selectedActionId) || isSubmittingNote}
              onClick={() => {
                const action = quickActions.find(a => a.id === selectedActionId);
                handleAddQuickNote(action ? action.id : 'note', action ? action.prefix : undefined);
                setSelectedActionId(null);
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-blue-600 text-white rounded-lg disabled:opacity-50 transition-colors"
            >
              {noteSuccess ? <Check className="w-4 h-4" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Historial (Notas) */}
        <div ref={historyRef} />
        <div className="bg-white dark:bg-slate-800 p-6 mb-2 shadow-sm border-y border-slate-200 dark:border-slate-700">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4">Historial</h3>
          {notes.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">No hay registros en el historial.</p>
          ) : (
            <div className="space-y-4">
              {notes.map(note => (
                <div key={`note-${note.id}`} className="relative pl-4 border-l-2 border-slate-200 dark:border-slate-700 pb-2 last:border-0 last:pb-0">
                  <div className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600" />
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      {note.createdByName || "Usuario"}
                    </span>
                    <span className="text-xs text-slate-400">
                      {format(new Date(note.createdAt), "dd MMM, HH:mm")}
                    </span>
                  </div>
                  <p className="text-sm text-slate-800 dark:text-slate-200">{note.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
