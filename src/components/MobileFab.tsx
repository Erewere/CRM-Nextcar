import { motion, AnimatePresence } from "motion/react";
import React, { useState, useEffect } from 'react';
import { Plus, Users, Car, CheckSquare, Target } from 'lucide-react';
import clsx from 'clsx';
import { ClientDetailModal } from './ClientDetailModal';
import { VehicleDetailModal } from './VehicleDetailModal';
import { NewActivityModal } from './NewActivityModal';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Client, Deal } from '../types';
import { deduplicateClients } from '../lib/clientUtils';
import { useReadOnly } from '../hooks/useReadOnly';

export function MobileFab() {
  const [isOpen, setIsOpen] = useState(false);
  const [showClientModal, setShowClientModal] = useState(false);
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const { userData } = useAuth();
  const isReadOnly = useReadOnly();
  
  const [clients, setClients] = useState<Client[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);

  useEffect(() => {
    if (!userData || userData.role === 'master' || !userData.agencyId) return;

    let q = query(
      collection(db, 'clients'),
      where('agencyId', '==', userData.agencyId)
    );
    if (userData.role === 'seller' || (userData.role === 'admin' && userData.adminMobileViewAllContacts === false)) {
      q = query(
        collection(db, 'clients'),
        where('agencyId', '==', userData.agencyId),
        where('sellerId', '==', userData.id)
      );
    }
    
    let dq = query(
      collection(db, 'deals'),
      where('agencyId', '==', userData.agencyId)
    );
    if (userData.role === 'seller' || (userData.role === 'admin' && userData.adminMobileViewAllContacts === false)) {
      dq = query(
        collection(db, 'deals'),
        where('agencyId', '==', userData.agencyId),
        where('sellerId', '==', userData.id)
      );
    }

    const unsubClients = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ ...d.data(), id: d.id } as Client));
      setClients(deduplicateClients(list));
    });
    
    const unsubDeals = onSnapshot(dq, (snap) => {
      setDeals(snap.docs.map(d => ({ ...d.data(), id: d.id } as Deal)));
    });

    return () => {
      unsubClients();
      unsubDeals();
    };
  }, [userData]);

  // Using a long press handler for completeness if they prefer "Dejando presionado", 
  // but standard click also toggles it for accessibility.
  let pressTimer: any = null;
  const handleTouchStart = () => {
    pressTimer = setTimeout(() => {
      setIsOpen(true);
    }, 500); // 500ms long press
  };
  const handleTouchEnd = () => {
    if (pressTimer) clearTimeout(pressTimer);
  };

  if (isReadOnly) return null;

  return (
    <>
      {/* Dimmed Background Overlay */}
      <AnimatePresence>
        {isOpen && (
           <motion.div 
             className="fixed inset-0 bg-slate-900/20 backdrop-blur-[2px] z-40 md:hidden"
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             exit={{ opacity: 0 }}
             onClick={() => setIsOpen(false)}
           />
        )}
      </AnimatePresence>

      <div className="fixed bottom-[85px] right-4 z-50 md:hidden flex flex-col items-center gap-3">
        <AnimatePresence>
          {isOpen && (
             <motion.div 
               className="flex flex-col items-center gap-3 mb-2"
               initial={{ y: 60, scale: 0.1, opacity: 0 }}
               animate={{ y: 0, scale: 1, opacity: 1 }}
               exit={{ y: 60, scale: 0.1, opacity: 0, transition: { duration: 0.2 } }}
               transition={{ type: "spring", damping: 18, stiffness: 300, mass: 0.8 }}
               style={{ transformOrigin: "bottom center" }}
             >
              <button 
                onClick={() => { setIsOpen(false); setShowTaskModal(true); }}
                className="w-12 h-12 bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 rounded-full shadow-sm flex items-center justify-center border border-gray-200 dark:border-slate-700 active:scale-95 transition-all"
              >
                <CheckSquare className="w-5 h-5" />
              </button>
              <button 
                onClick={() => { setIsOpen(false); setShowVehicleModal(true); }}
                className="w-12 h-12 bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 rounded-full shadow-sm flex items-center justify-center border border-gray-200 dark:border-slate-700 active:scale-95 transition-all"
              >
                <Car className="w-5 h-5" />
              </button>
              <button 
                onClick={() => { setIsOpen(false); setShowClientModal(true); }}
                className="w-12 h-12 bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 rounded-full shadow-sm flex items-center justify-center border border-gray-200 dark:border-slate-700 active:scale-95 transition-all"
              >
                <Users className="w-5 h-5" />
              </button>
             </motion.div>
          )}
        </AnimatePresence>
        <button
          onClick={() => setIsOpen(!isOpen)}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className={clsx(
            "w-14 h-14 rounded-full flex items-center justify-center shadow-xl text-white transition-transform duration-200 active:scale-95",
            isOpen ? "bg-slate-800 dark:bg-slate-700 rotate-45" : "bg-blue-600 hover:bg-blue-700"
          )}
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      {showClientModal && (
         <ClientDetailModal
            client={{}}
            onClose={() => setShowClientModal(false)}
            initialStatus="new"
         />
      )}
      {showVehicleModal && (
         <VehicleDetailModal
            vehicle={{ status: 'available' }}
            onClose={() => setShowVehicleModal(false)}
         />
      )}
      {showTaskModal && (
         <NewActivityModal
            onClose={() => setShowTaskModal(false)}
            onSave={() => setShowTaskModal(false)}
            clients={clients}
            deals={deals}
            currentUser={userData}
         />
      )}
    </>
  );
}
