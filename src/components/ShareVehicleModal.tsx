import { motion } from "motion/react";
import React, { useState, useEffect } from 'react';
import { X, Search, Check, Send, AlertCircle, Car } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { Client, Vehicle } from '../types';
import { deduplicateClients } from '../lib/clientUtils';
import clsx from 'clsx';

interface Props {
  vehicle: Vehicle;
  onClose: () => void;
}

export function ShareVehicleModal({ vehicle, onClose }: Props) {
  const { userData } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!userData) return;
    const fetchClients = async () => {
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
        const list = snap.docs.map(d => ({ ...d.data(), id: d.id } as Client));
        setClients(deduplicateClients(list));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchClients();
  }, [userData]);

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (c.phone && c.phone.includes(searchTerm))
  );

  const handleSend = async () => {
    if (!selectedClient) return;
    setSending(true);
    
    try {
      // Format phone (add country code if needed, assuming +52 for Mexico for now if missing)
      let phone = selectedClient.phone.replace(/\D/g, '');
      if (phone.length === 10) phone = '52' + phone;

      // Send Template
      const res = await fetch('/api/meta/send-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: phone,
          templateName: 'vehicle_recommendation',
          variables: [
             { type: "text", text: selectedClient.name },
             { type: "text", text: `${vehicle.make} ${vehicle.model} ${vehicle.year}` },
             { type: "text", text: `$${vehicle.price?.toLocaleString()}` }
          ]
        })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error sending message');
      
      // Save interaction note
      await addDoc(collection(db, 'notes'), {
        clientId: selectedClient.id,
        agencyId: userData?.agencyId,
        content: `Compartido vía WhatsApp: ${vehicle.make} ${vehicle.model} ${vehicle.year} - $${vehicle.price?.toLocaleString()}`,
        type: 'whatsapp',
        createdAt: new Date().toISOString(),
        createdBy: userData?.id,
        createdByName: userData?.name
      });

      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      console.error(err);
      alert('Error al enviar el mensaje');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex flex-col justify-end md:items-center md:justify-center p-0 md:p-4">
      <motion.div className="absolute inset-0" onClick={onClose} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} />
      <motion.div 
        className="bg-white dark:bg-slate-900 w-full h-[90dvh] md:h-auto md:max-h-[85vh] md:max-w-md md:rounded-2xl rounded-t-3xl flex flex-col shadow-2xl relative z-10"
        initial={{ y: "60vh", scaleX: 0.3, scaleY: 0.05, opacity: 0, borderRadius: "10rem" }}
        animate={{ y: 0, scaleX: 1, scaleY: 1, opacity: 1, borderRadius: "1.5rem" }}
        exit={{ y: "60vh", scaleX: 0.3, scaleY: 0.05, opacity: 0, borderRadius: "10rem", transition: { duration: 0.25, ease: "easeInOut" } }}
        transition={{ type: "spring", damping: 22, stiffness: 280, mass: 0.8 }}
        style={{ transformOrigin: "bottom center" }}
      >
        
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Compartir Vehículo</h2>
          <button onClick={onClose} className="p-2 -mr-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full bg-slate-100 dark:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {success ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
              <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">¡Enviado con éxito!</h3>
            <p className="text-slate-500 dark:text-slate-400">
              Se ha enviado un mensaje de WhatsApp a {selectedClient?.name} y se ha registrado en su historial.
            </p>
          </div>
        ) : (
          <>
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 shrink-0 flex gap-4 items-center">
               <div className="w-16 h-12 bg-slate-200 dark:bg-slate-700 rounded-lg overflow-hidden shrink-0">
                  {vehicle.photoUrls?.[0] || vehicle.photoUrl ? (
                    <img src={vehicle.photoUrls?.[0] || vehicle.photoUrl} className="w-full h-full object-cover" alt="" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><Car className="w-6 h-6 text-slate-400" /></div>
                  )}
               </div>
               <div className="min-w-0">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">{vehicle.make} {vehicle.model}</h4>
                  <p className="text-xs text-slate-500">${vehicle.price?.toLocaleString()}</p>
               </div>
            </div>

            <div className="p-4 shrink-0 border-b border-slate-200 dark:border-slate-800">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar cliente..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl pl-9 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {loading ? (
                <div className="flex justify-center p-8"><div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>
              ) : filteredClients.length === 0 ? (
                <div className="text-center p-8 text-slate-500">No se encontraron clientes</div>
              ) : (
                <div className="space-y-1">
                  {filteredClients.map(c => (
                    <button
                      key={`client-${c.id}`}
                      onClick={() => setSelectedClient(c)}
                      className={clsx(
                        "w-full flex items-center justify-between p-3 rounded-xl text-left transition-colors",
                        selectedClient?.id === c.id 
                          ? "bg-blue-50 dark:bg-blue-900/30 ring-1 ring-blue-500" 
                          : "hover:bg-slate-50 dark:hover:bg-slate-800"
                      )}
                    >
                      <div>
                        <div className="font-semibold text-sm text-slate-900 dark:text-white">{c.name}</div>
                        <div className="text-xs text-slate-500">{c.phone || "Sin teléfono"}</div>
                      </div>
                      {selectedClient?.id === c.id && (
                        <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-white">
                          <Check className="w-3 h-3" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 pb-safe">
              <button
                disabled={!selectedClient || sending || !selectedClient.phone}
                onClick={handleSend}
                className="w-full bg-blue-600 text-white rounded-xl py-3.5 font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
              >
                {sending ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Enviar WhatsApp
                  </>
                )}
              </button>
              {selectedClient && !selectedClient.phone && (
                <div className="flex items-center gap-1.5 text-xs text-amber-600 mt-2 justify-center">
                  <AlertCircle className="w-4 h-4" />
                  El cliente seleccionado no tiene teléfono registrado
                </div>
              )}
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
