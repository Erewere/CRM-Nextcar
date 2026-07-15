import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';
import { Client, PipelineStage } from '../../types';
import { deduplicateClients } from '../../lib/clientUtils';
import { Search, Phone, MessageCircle, User, Car, Calendar, FileText, ChevronRight, Activity, X } from 'lucide-react';
import { clsx } from 'clsx';
import { MobileClientDetail } from './MobileClientDetail';
import { NewActivityModal } from '../../components/NewActivityModal';

export function MobilePersons() {
  const { userData } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [pipelineStages, setPipelineStages] = useState<PipelineStage[]>([]);
  const [taskClient, setTaskClient] = useState<Client | null>(null);
  const [stageClient, setStageClient] = useState<Client | null>(null);
  const [historyClient, setHistoryClient] = useState<Client | null>(null);

  useEffect(() => {
    if (userData?.agencyId) {
      getDoc(doc(db, "agencies", userData.agencyId as string))
        .then((docSnap) => {
          if (docSnap.exists() && docSnap.data().pipelineStages) {
            setPipelineStages(docSnap.data().pipelineStages);
          }
        })
        .catch(console.error);
    }
  }, [userData?.agencyId]);

  useEffect(() => {
    fetchClients();
  }, [userData]);

  const fetchClients = async () => {
    if (!userData || userData.role === 'master') return;
    setLoading(true);
    try {
      let q = query(
        collection(db, 'clients'),
        where('agencyId', '==', userData.agencyId)
      );
      
      if (userData.role === 'seller') {
        q = query(
          collection(db, 'clients'),
          where('agencyId', '==', userData.agencyId),
          where('sellerId', '==', userData.id)
        );
      }

      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Client));
      
      setClients(deduplicateClients(list));
      setSelectedClient(prev => prev ? (list.find(c => c.id === prev.id) || prev) : null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (c.phone && c.phone.includes(searchTerm)) ||
    (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

    const getWhatsAppLink = (phone: string) => {
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) cleaned = '52' + cleaned;
    return `https://wa.me/${cleaned}`;
  };

  if (loading && clients.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden relative">
      <div className="px-4 py-4 shrink-0 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 z-10 sticky top-0">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Contactos
          </h1>
          <span className="text-sm font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full">
            {filteredClients.length}
          </span>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, teléfono o email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-4 pb-24 space-y-3">
        {filteredClients.map((client, idx) => (
          <div key={`${client.id}-${idx}`} className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col">
            <div 
              className="p-4 cursor-pointer active:bg-slate-50 dark:active:bg-slate-700/50 transition-colors"
              onClick={() => setSelectedClient(client)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 w-full">
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold shrink-0">
                    {client.name.substring(0,2).toUpperCase()}
                  </div>
                  
                  <div className="flex flex-col overflow-hidden">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight truncate">
                      {client.name}
                    </h3>
                    {(client.vehicle || client.dealTitle) && (
                      <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400 mt-1">
                        <Car className="w-3.5 h-3.5 shrink-0" />
                        <span className="text-xs font-bold uppercase tracking-wider truncate">{client.vehicle || client.dealTitle}</span>
                      </div>
                    )}
                  </div>

                </div>
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-700 px-2 py-2 flex items-center justify-between overflow-x-auto scrollbar-hide">
              <div className="flex items-center gap-1 min-w-max">
                <a 
                  href={`tel:${client.phone || ''}`} 
                  onClick={(e) => { e.stopPropagation(); if(!client.phone) e.preventDefault(); }}
                  className={clsx("flex flex-col items-center justify-center w-14 h-12 rounded-xl transition-colors", client.phone ? "active:bg-blue-100 dark:active:bg-blue-900/40 text-blue-600 dark:text-blue-400" : "opacity-50 text-slate-400")}
                >
                  <Phone className="w-4 h-4 mb-1" />
                  <span className="text-[9px] font-medium">Llamar</span>
                </a>
                <a 
                  href={`https://wa.me/${(client.phone || '').replace(/[^0-9]/g, '')}`} 
                  target="_blank" rel="noreferrer"
                  onClick={(e) => { e.stopPropagation(); if(!client.phone) e.preventDefault(); }}
                  className={clsx("flex flex-col items-center justify-center w-14 h-12 rounded-xl transition-colors", client.phone ? "active:bg-green-100 dark:active:bg-green-900/40 text-green-600 dark:text-green-400" : "opacity-50 text-slate-400")}
                >
                  <MessageCircle className="w-4 h-4 mb-1" />
                  <span className="text-[9px] font-medium">WhatsApp</span>
                </a>
                <button 
                  onClick={(e) => { e.stopPropagation(); setTaskClient(client); }}
                  className="flex flex-col items-center justify-center w-14 h-12 rounded-xl transition-colors active:bg-amber-100 dark:active:bg-amber-900/40 text-amber-600 dark:text-amber-400"
                >
                  <Calendar className="w-4 h-4 mb-1" />
                  <span className="text-[9px] font-medium">Tarea</span>
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); setStageClient(client); }}
                  className="flex flex-col items-center justify-center w-14 h-12 rounded-xl transition-colors active:bg-purple-100 dark:active:bg-purple-900/40 text-purple-600 dark:text-purple-400"
                >
                  <Activity className="w-4 h-4 mb-1" />
                  <span className="text-[9px] font-medium">Etapa</span>
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); setHistoryClient(client); }}
                  className="flex flex-col items-center justify-center w-14 h-12 rounded-xl transition-colors active:bg-slate-200 dark:active:bg-slate-700 text-slate-600 dark:text-slate-300"
                >
                  <FileText className="w-4 h-4 mb-1" />
                  <span className="text-[9px] font-medium">Nota</span>
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); setSelectedClient(client); }}
                  className="flex flex-col items-center justify-center w-14 h-12 rounded-xl transition-colors active:bg-slate-200 dark:active:bg-slate-700 text-slate-600 dark:text-slate-300"
                >
                  <User className="w-4 h-4 mb-1" />
                  <span className="text-[9px] font-medium">Ficha</span>
                </button>
              </div>
            </div>
          </div>
        ))}
        {filteredClients.length === 0 && (
          <div className="text-center py-10 text-slate-500">
            No se encontraron contactos.
          </div>
        )}
      </div>

      {selectedClient && (
        <MobileClientDetail 
          client={selectedClient} 
          onClose={() => setSelectedClient(null)} 
          onUpdated={fetchClients}
        />
      )}
      {historyClient && (
        <MobileClientDetail 
           client={historyClient} 
           onClose={() => setHistoryClient(null)} 
           onUpdated={fetchClients}
           scrollToHistory={true}
        />
      )}
      {taskClient && (
        <NewActivityModal
          onClose={() => setTaskClient(null)}
          onSave={() => { setTaskClient(null); fetchClients(); }}
          clients={clients}
          currentUser={userData}
          initialData={{ clientId: taskClient.id }}
        />
      )}
      {stageClient && (
        <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-black/60 p-4" onClick={() => setStageClient(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white">Cambiar Etapa</h3>
              <button onClick={() => setStageClient(null)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-2 max-h-[60vh] overflow-y-auto">
              {pipelineStages.map(stage => (
                <button
                  key={stage.id}
                  onClick={async () => {
                    try {
                      await updateDoc(doc(db, "clients", stageClient.id), { status: stage.id, updatedAt: new Date().toISOString() });
                      setStageClient(null);
                      fetchClients();
                    } catch (err) {
                      console.error(err);
                    }
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl font-medium text-slate-700 dark:text-slate-300 transition-colors flex items-center justify-between"
                >
                  {stage.title}
                  {stageClient.status === stage.id && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}