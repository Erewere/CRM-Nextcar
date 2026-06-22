import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { Vehicle } from '../types';
import { Plus, Car as CarIcon, Search, Trash2, Edit2 } from 'lucide-react';
import { VehicleDetailModal } from '../components/VehicleDetailModal';

export function Inventory() {
  const { userData } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null | undefined>(undefined);

  const [vehicleToDelete, setVehicleToDelete] = useState<string | null>(null);

  useEffect(() => {
    if (!userData?.agencyId && userData?.role !== 'master') return;

    let q = query(collection(db, 'vehicles'));
    if (userData?.role !== 'master') {
      q = query(collection(db, 'vehicles'), where('agencyId', '==', userData.agencyId));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const now = new Date();
      const loadedVehicles = snapshot.docs.map(d => {
        const data = d.data() as Vehicle & { pendingValidation?: any };
        
        // Check for expired pending validations (24 hours)
        if (data.pendingValidation?.requestedAt) {
          const reqTime = new Date(data.pendingValidation.requestedAt).getTime();
          const diffHours = (now.getTime() - reqTime) / (1000 * 60 * 60);
          if (diffHours >= 24) {
             // Auto revert: Just strip pending validation on write to DB
             // We do this asynchronously to avoid blocking the render
             setTimeout(() => {
               updateDoc(doc(db, 'vehicles', d.id), { pendingValidation: null }).catch(console.error);
             }, Math.random() * 2000); // jitter to prevent stampede
             delete data.pendingValidation; // also remove locally immediately
          }
        }
        return { id: d.id, ...data };
      });
      setVehicles(loadedVehicles);
    });

    return () => unsubscribe();
  }, [userData]);

  const handleDelete = async (id: string) => {
    await deleteDoc(doc(db, 'vehicles', id));
    setVehicleToDelete(null);
  };

  const handleValidateStatus = async (vehicleId: string, approve: boolean, newStatus?: string) => {
    try {
      const payload: any = { pendingValidation: null };
      if (approve && newStatus) {
        payload.status = newStatus;
      }
      await updateDoc(doc(db, 'vehicles', vehicleId), payload);
    } catch (error) {
      console.error("Error validating status:", error);
    }
  };

  const filteredVehicles = vehicles.filter(v => 
    `${v.make} ${v.model} ${v.year} ${v.vin}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const pendingVehicles = vehicles.filter(v => (v as any).pendingValidation);

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Inventario</h1>
          <p className="text-sm text-slate-500">Gestiona los vehículos de la agencia</p>
        </div>
        <button 
          onClick={() => setSelectedVehicle({} as Vehicle)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Agregar Vehículo
        </button>
      </div>

      {(userData?.role === 'admin' || userData?.role === 'master') && pendingVehicles.length > 0 && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <h3 className="font-bold text-amber-900 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
            Validaciones Pendientes
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pendingVehicles.map(v => (
              <div 
                key={`pending-${v.id}`} 
                className="flex items-center justify-between bg-white px-4 py-3 rounded-lg border border-amber-100 shadow-sm cursor-pointer hover:bg-amber-50/50 transition-colors"
                onClick={() => setSelectedVehicle(v)}
              >
                <div>
                  <div className="font-bold text-slate-800">{v.year} {v.make} {v.model}</div>
                  <div className="text-sm text-slate-600 mt-1">
                    Cambiar a: <strong className="uppercase text-amber-700">{(v as any).pendingValidation.type === 'sold' ? 'Vendido' : 'Reservado'}</strong>
                  </div>
                  <div className="text-xs text-slate-500 mt-1 space-y-0.5">
                    <p><span className="font-medium">Vendedor:</span> {(v as any).pendingValidation.requestedByName || 'Desconocido'}</p>
                    <p><span className="font-medium">Cliente:</span> {(v as any).pendingValidation.clientName || 'Desconocido'}</p>
                  </div>
                </div>
                <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                  <button 
                    onClick={() => handleValidateStatus(v.id, false)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                  >
                    Rechazar
                  </button>
                  <button 
                    onClick={() => handleValidateStatus(v.id, true, (v as any).pendingValidation.type)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-md bg-amber-500 text-white hover:bg-amber-600 transition-colors"
                  >
                    Aprobar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar por marca, modelo, año, VIN..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-auto p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredVehicles.map(vehicle => (
              <div 
                key={vehicle.id} 
                className="border rounded-xl overflow-hidden hover:shadow-md transition-shadow cursor-pointer bg-white group"
                onClick={() => setSelectedVehicle(vehicle)}
              >
                <div className="h-48 bg-slate-100 relative">
                  {vehicle.photoUrl ? (
                    <img src={vehicle.photoUrl} alt={`${vehicle.make} ${vehicle.model}`} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                      <CarIcon className="w-16 h-16" />
                    </div>
                  )}
                  <div className="absolute top-2 right-2 flex gap-2">
                    {(userData?.role === 'admin' || userData?.role === 'master') && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); setVehicleToDelete(vehicle.id); }}
                        className="p-1.5 bg-white/90 rounded-lg text-slate-400 hover:text-red-600 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 text-white text-xs rounded font-medium backdrop-blur-sm">
                    {(vehicle as any).pendingValidation ? (
                      <span className="text-amber-300">
                         Pendiente: {(vehicle as any).pendingValidation.type === 'sold' ? 'Vendido' : 'Reservado'}
                      </span>
                    ) : (
                      vehicle.status === 'available' ? 'Disponible' : vehicle.status === 'sold' ? 'Vendido' : 'Reservado'
                    )}
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-slate-800 line-clamp-1">{vehicle.year} {vehicle.make} {vehicle.model}</h3>
                  <div className="text-xs text-slate-500 mb-2 mt-1 flex justify-between">
                    <span>{vehicle.color}</span>
                    <span>{vehicle.transmission}</span>
                  </div>
                  <div className="text-xs text-slate-500 mb-3 truncate" title={vehicle.vin}>
                    VIN: <span className="font-mono">{vehicle.vin}</span>
                  </div>
                  
                  <div className="flex items-center justify-between mt-4">
                    <span className="text-lg font-bold text-blue-600">${Number(vehicle.price || 0).toLocaleString()}</span>
                  </div>
                  {(userData?.role === 'admin' || userData?.role === 'master') && vehicle.purchasePrice && (
                    <div className="mt-2 text-xs text-slate-500 flex justify-between items-center border-t pt-2">
                       <span>Costo: ${Number(vehicle.purchasePrice).toLocaleString()}</span>
                       <span className="font-semibold text-green-600">
                         Ut: ${Number((vehicle.price || 0) - (vehicle.purchasePrice || 0)).toLocaleString()}
                       </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {filteredVehicles.length === 0 && (
              <div className="col-span-full py-12 text-center text-slate-500 flex flex-col items-center">
                <CarIcon className="w-12 h-12 mb-3 text-slate-300" />
                <p>No se encontraron vehículos.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedVehicle !== undefined && (
        <VehicleDetailModal 
          vehicle={selectedVehicle as Vehicle} 
          onClose={() => setSelectedVehicle(undefined)} 
        />
      )}

      {vehicleToDelete && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-sm overflow-hidden p-6 text-center">
            <h2 className="text-xl font-bold text-slate-800 mb-2">Eliminar Vehículo</h2>
            <p className="text-slate-600 mb-6">¿Estás seguro de que deseas eliminar este vehículo? Esta acción no se puede deshacer.</p>
            <div className="flex gap-4">
              <button 
                onClick={() => setVehicleToDelete(null)}
                className="flex-1 py-2 px-4 bg-slate-100 text-slate-700 font-semibold rounded-lg hover:bg-slate-200 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={() => handleDelete(vehicleToDelete)}
                className="flex-1 py-2 px-4 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
