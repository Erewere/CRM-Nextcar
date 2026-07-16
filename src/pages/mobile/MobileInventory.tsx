import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { Vehicle } from '../../types';
import { Car as CarIcon, Search, Share2, DollarSign, Calendar, SlidersHorizontal } from 'lucide-react';
import clsx from 'clsx';
import { ShareVehicleModal } from '../../components/ShareVehicleModal';

export function MobileInventory() {
  const { userData } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [vehicleToShare, setVehicleToShare] = useState<Vehicle | null>(null);

  useEffect(() => {
    if (!userData?.agencyId && userData?.role !== 'master') return;

    let q = query(collection(db, 'vehicles'));
    if (userData?.role !== 'master') {
      q = query(collection(db, 'vehicles'), where('agencyId', '==', userData.agencyId));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedVehicles = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Vehicle));
      setVehicles(loadedVehicles);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userData]);

  const filteredVehicles = vehicles.filter(v => {
    const searchLower = searchTerm.toLowerCase();
    const isSold = v.status === 'sold';
    if (isSold) return false;
    
    return (
      v.make.toLowerCase().includes(searchLower) ||
      v.model.toLowerCase().includes(searchLower) ||
      v.year.toString().includes(searchLower) ||
      (v.vin || '').toLowerCase().includes(searchLower)
    );
  });

  if (loading) {
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
            Inventario
          </h1>
          <span className="text-sm font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full">
            {filteredVehicles.length} Autos
          </span>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar marca, modelo o año..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-4 pb-24 space-y-4">
        {filteredVehicles.map((vehicle, idx) => (
          <div key={`${vehicle.id}-${idx}`} className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col">
            <div className="h-48 bg-slate-100 dark:bg-slate-900 relative">
              {vehicle.photoUrls?.[0] || vehicle.photoUrl ? (
                <img 
                  src={vehicle.photoUrls?.[0] || vehicle.photoUrl || ''} 
                  alt={`${vehicle.make} ${vehicle.model}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-300 dark:text-slate-700">
                  <CarIcon className="w-16 h-16" />
                </div>
              )}
              <div className="absolute top-3 left-3 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm px-2.5 py-1 rounded-lg text-xs font-bold text-slate-900 dark:text-white shadow-sm border border-black/5 dark:border-white/5">
                {vehicle.year}
              </div>
            </div>
            
            <div className="p-4 flex flex-col gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                  {vehicle.make} {vehicle.model}
                </h3>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">
                  {vehicle.version || vehicle.bodyType || 'Sin versión'}
                </div>
              </div>
              
              <div className="flex items-center justify-between mt-1">
                <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                  <SlidersHorizontal className="w-4 h-4 text-slate-400" />
                  <span className="text-sm font-medium">{vehicle.mileage?.toLocaleString()} km</span>
                </div>
                <div className="text-lg font-bold text-green-600 dark:text-green-400 flex items-center">
                  <DollarSign className="w-5 h-5 -mr-1" />
                  {vehicle.price?.toLocaleString()}
                </div>
              </div>
              
              <div className="pt-3 border-t border-slate-100 dark:border-slate-700 mt-1">
                <button
                  onClick={() => setVehicleToShare(vehicle)}
                  className="w-full flex items-center justify-center gap-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 py-2.5 rounded-xl font-semibold transition-colors text-sm"
                >
                  <Share2 className="w-4 h-4" />
                  Compartir con Cliente
                </button>
              </div>
            </div>
          </div>
        ))}
        {filteredVehicles.length === 0 && (
          <div className="text-center py-10 text-slate-500">
            No se encontraron vehículos.
          </div>
        )}
      </div>

      {vehicleToShare && (
        <ShareVehicleModal
          vehicle={vehicleToShare}
          onClose={() => setVehicleToShare(null)}
        />
      )}
    </div>
  );
}
