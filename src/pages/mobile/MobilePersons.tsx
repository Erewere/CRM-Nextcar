import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Client } from '../../types';
import { Search, Phone, MessageCircle, User, Car } from 'lucide-react';
import { MobileClientDetail } from './MobileClientDetail';

export function MobilePersons() {
  const { userData } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

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
      
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setClients(list);
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
        {filteredClients.map(client => (
          <div key={client.id} className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
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
    </div>
  );
}
