import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { Vehicle, Client } from '../types';
import { Plus, Car as CarIcon, Search, Trash2, Edit2, LayoutGrid, List, Settings, Target } from 'lucide-react';
import { VehicleDetailModal } from '../components/VehicleDetailModal';
import clsx from 'clsx';

export type MatchLevel = 'exact' | 'high' | 'medium' | 'low';

export interface VehicleMatch {
  client: Client;
  level: MatchLevel;
}

export const getVehicleMatches = (vehicle: Vehicle, clients: Client[]): VehicleMatch[] => {
  const matches: VehicleMatch[] = [];

  clients.forEach(c => {
    if (!c.wantedVehicle) return;
    const wv = c.wantedVehicle;
    
    // Si no hay ningún criterio, no hacemos match
    if (!wv.make && !wv.model && !wv.yearMin && !wv.yearMax && !wv.priceMax && (!wv.bodyType || wv.bodyType === "Cualquiera")) {
      return;
    }

    let isExact = true;
    let isSimilar = true;
    let hasSimilarBase = false;
    let differences = 0;

    // Make & Model
    const makeMatches = wv.make ? vehicle.make.toLowerCase().includes(wv.make.toLowerCase()) : true;
    const modelMatches = wv.model ? vehicle.model.toLowerCase().includes(wv.model.toLowerCase()) : true;

    if (wv.make && !makeMatches) {
        isExact = false;
        differences += 2;
    }
    if (wv.model && !modelMatches) {
        isExact = false;
        differences += 1;
    }

    // Year
    const yearMin = wv.yearMin || 0;
    const yearMax = wv.yearMax || 9999;
    if (vehicle.year < yearMin || vehicle.year > yearMax) {
        isExact = false;
        if (vehicle.year < yearMin - 2 || vehicle.year > yearMax + 2) {
            isSimilar = false; // Not even similar
        } else if (vehicle.year < yearMin - 1 || vehicle.year > yearMax + 1) {
            differences += 2;
        } else {
            differences += 1;
        }
    }

    // Price
    const priceMax = wv.priceMax || Infinity;
    if (vehicle.price > priceMax) {
        isExact = false;
        if (vehicle.price > priceMax * 1.2) {
            isSimilar = false; // More than 20% over budget
        } else if (vehicle.price > priceMax * 1.1) {
            differences += 2;
        } else {
            differences += 1;
        }
    }

    // Body Type
    if (wv.bodyType && wv.bodyType !== "Cualquiera") {
        if (vehicle.bodyType !== wv.bodyType) {
            isExact = false;
            differences += 2;
        }
    }
    
    // Passengers
    if (wv.passengers) {
        const vPassengers = vehicle.passengers;
        if (vPassengers !== undefined && vPassengers !== null && String(vPassengers).trim() !== "") {
            if (Number(vPassengers) !== Number(wv.passengers)) {
                isExact = false;
                // Si el cliente pide un número específico de pasajeros, es un requerimiento fuerte (ej. SUV de 3 filas)
                // No sugerimos como similar si no coincide el número de pasajeros
                isSimilar = false; 
            }
        } else {
            // Si el vehículo no tiene pasajeros definidos y piden cantidad, no lo recomendamos.
            isExact = false;
            isSimilar = false;
        }
    }

    if (wv.make && makeMatches) hasSimilarBase = true;
    if (wv.bodyType && wv.bodyType !== "Cualquiera" && vehicle.bodyType === wv.bodyType) hasSimilarBase = true;
    if (!wv.make && !wv.bodyType) hasSimilarBase = true; // Si solo busca por precio/año, es base
    
    if (isExact) {
      matches.push({ client: c, level: 'exact' });
    } else if (isSimilar && hasSimilarBase) {
      let level: MatchLevel = 'high';
      if (differences >= 3) level = 'low';
      else if (differences >= 2) level = 'medium';
      
      matches.push({ client: c, level });
    }
  });

  return matches;
};

export function Inventory() {
  const { userData } = useAuth();
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null | undefined>(undefined);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const [vehicleToDelete, setVehicleToDelete] = useState<string | null>(null);

  const [columns, setColumns] = useState([
    { id: 'year', label: 'Año', visible: true, width: 100 },
    { id: 'make', label: 'Marca', visible: true, width: 150 },
    { id: 'model', label: 'Modelo', visible: true, width: 150 },
    { id: 'color', label: 'Color', visible: true, width: 120 },
    { id: 'transmission', label: 'Transmisión', visible: true, width: 150 },
    { id: 'bodyType', label: 'Carrocería', visible: true, width: 150 },
    { id: 'price', label: 'Precio', visible: true, width: 150 },
    { id: 'purchasePrice', label: 'Costo', visible: true, width: 150 },
    { id: 'vin', label: 'VIN', visible: true, width: 220 },
    { id: 'status', label: 'Estado', visible: true, width: 120 },
    { id: 'km', label: 'Km', visible: false, width: 120 },
    { id: 'cylinders', label: 'Cilindros', visible: false, width: 120 },
    { id: 'liters', label: 'Motor (L)', visible: false, width: 120 },
    { id: 'receivedAt', label: 'F. Recepción', visible: false, width: 150 },
    { id: 'equipment', label: 'Equipamiento', visible: false, width: 200 }
  ]);
  const [showColSettings, setShowColSettings] = useState(false);
  const [resizingCol, setResizingCol] = useState<string | null>(null);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartWidth, setDragStartWidth] = useState(0);

  useEffect(() => {
    if (!resizingCol) return;
    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - dragStartX;
      setColumns(cols => cols.map(c => c.id === resizingCol ? { ...c, width: Math.max(50, dragStartWidth + delta) } : c));
    };
    const handleMouseUp = () => setResizingCol(null);
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingCol, dragStartX, dragStartWidth]);

  const handleMouseDown = (e: React.MouseEvent, colId: string, currentWidth: number) => {
    setResizingCol(colId);
    setDragStartX(e.clientX);
    setDragStartWidth(currentWidth);
    e.preventDefault();
    e.stopPropagation();
  };

  const toggleColumn = (id: string) => {
    setColumns(cols => cols.map(c => c.id === id ? { ...c, visible: !c.visible } : c));
  };

  useEffect(() => {
    if (!userData?.agencyId && userData?.role !== 'master') return;

    let q = query(collection(db, 'vehicles'));
    let clientsQ = query(collection(db, 'clients'));

    if (userData?.role !== 'master') {
      q = query(collection(db, 'vehicles'), where('agencyId', '==', userData.agencyId));
      clientsQ = query(collection(db, 'clients'), where('agencyId', '==', userData.agencyId));
    }

    const unsubscribeVehicles = onSnapshot(q, (snapshot) => {
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

    const unsubscribeClients = onSnapshot(clientsQ, (snapshot) => {
      setClients(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Client)));
    });

    return () => {
      unsubscribeVehicles();
      unsubscribeClients();
    };
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
    `${v.make} ${v.model} ${v.year} ${v.vin} ${v.bodyType} ${v.status} ${v.transmission} ${v.color} ${v.equipment || ''}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const pendingVehicles = vehicles.filter(v => (v as any).pendingValidation);

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-200">Inventario</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Gestiona los vehículos de la agencia</p>
        </div>
        <button 
          onClick={() => setSelectedVehicle({} as Vehicle)}
          className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2"
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
                className="flex items-center justify-between bg-white dark:bg-slate-800 px-4 py-3 rounded-lg border border-amber-100 shadow-sm cursor-pointer hover:bg-amber-50/50 transition-colors"
                onClick={() => setSelectedVehicle(v)}
              >
                <div>
                  <div className="font-bold text-slate-800 dark:text-slate-200">{v.year} {v.make} {v.model}</div>
                  <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Cambiar a: <strong className="uppercase text-amber-700">{(v as any).pendingValidation.type === 'sold' ? 'Vendido' : 'Reservado'}</strong>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 space-y-0.5">
                    <p><span className="font-medium">Vendedor:</span> {(v as any).pendingValidation.requestedByName || 'Desconocido'}</p>
                    <p><span className="font-medium">Cliente:</span> {(v as any).pendingValidation.clientName || 'Desconocido'}</p>
                  </div>
                </div>
                <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                  <button 
                    onClick={() => handleValidateStatus(v.id, false)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 transition-colors"
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

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar por marca, modelo, año, VIN, carrocería..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-700 rounded-lg shrink-0">
            <button
              onClick={() => setViewMode('grid')}
              className={clsx(
                "p-1.5 rounded-md transition-colors",
                viewMode === 'grid' ? "bg-white dark:bg-slate-800 text-blue-600 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-300"
              )}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={clsx(
                "p-1.5 rounded-md transition-colors",
                viewMode === 'list' ? "bg-white dark:bg-slate-800 text-blue-600 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-300"
              )}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        {viewMode === 'grid' ? (
          <div className="flex-1 overflow-auto p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredVehicles.map(vehicle => {
                const matches = getVehicleMatches(vehicle, clients);
                const totalMatches = matches.length;

                return (
              <div 
                key={vehicle.id} 
                className="border rounded-xl overflow-hidden hover:shadow-md transition-shadow cursor-pointer bg-white dark:bg-slate-800 group relative"
                onClick={() => setSelectedVehicle(vehicle)}
              >
                {totalMatches > 0 && (
                  <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
                    {matches.map((match, idx) => {
                      let bgColor = 'bg-indigo-500';
                      let label = `¡Exacto! (${match.client.name})`;
                      if (match.level === 'high') { bgColor = 'bg-emerald-500'; label = `Muy similar (${match.client.name})`; }
                      if (match.level === 'medium') { bgColor = 'bg-yellow-500'; label = `Algo similar (${match.client.name})`; }
                      if (match.level === 'low') { bgColor = 'bg-orange-500'; label = `Posible match (${match.client.name})`; }

                      return (
                        <div 
                          key={idx}
                          onClick={(e) => { e.stopPropagation(); navigate('/persons', { state: { clientId: match.client.id } }); }}
                          className={`${bgColor} hover:brightness-110 transition-all text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-md flex items-center gap-1 w-max cursor-pointer`}
                          title="Ver cliente"
                        >
                          <Target className="w-3 h-3" /> {label}
                        </div>
                      )
                    })}
                  </div>
                )}
                <div className="h-48 bg-slate-100 dark:bg-slate-700 relative">
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
                        className="p-1.5 bg-white dark:bg-slate-800/90 rounded-lg text-slate-400 hover:text-red-600 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
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
                  <h3 className="font-bold text-slate-800 dark:text-slate-200 line-clamp-1">{vehicle.year} {vehicle.make} {vehicle.model}</h3>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mb-2 mt-1 flex justify-between">
                    <span>{vehicle.color} • {vehicle.km?.toLocaleString() || 0} km</span>
                    <span>{vehicle.transmission}</span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mb-2 mt-1 flex justify-between">
                    <span>Motor: {vehicle.cylinders || 4} cil, {vehicle.liters || 0}L</span>
                    <span>Días Inv: {
                      vehicle.receivedAt && !isNaN(new Date(vehicle.receivedAt).getTime())
                        ? Math.floor((new Date().getTime() - new Date(vehicle.receivedAt).getTime()) / (1000 * 3600 * 24)) 
                        : 'N/A'
                    }</span>
                  </div>
                  {vehicle.equipment && (
                    <div className="text-xs text-slate-500 dark:text-slate-400 mb-2 truncate" title={vehicle.equipment}>
                      Eq: {vehicle.equipment}
                    </div>
                  )}
                  <div className="text-xs text-slate-500 dark:text-slate-400 mb-3 truncate" title={vehicle.vin}>
                    VIN: <span className="font-mono">{vehicle.vin}</span>
                  </div>
                  
                  <div className="flex items-center justify-between mt-4">
                    <span className="text-lg font-bold text-blue-600">${Number(vehicle.price || 0).toLocaleString()}</span>
                  </div>
                  {(userData?.role === 'admin' || userData?.role === 'master') && vehicle.purchasePrice && (
                    <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 flex justify-between items-center border-t pt-2">
                       <span>Costo: ${Number(vehicle.purchasePrice).toLocaleString()}</span>
                       <span className="font-semibold text-green-600">
                         Ut: ${Number((vehicle.price || 0) - (vehicle.purchasePrice || 0)).toLocaleString()}
                       </span>
                    </div>
                  )}
                </div>
              </div>
              );
            })}
            {filteredVehicles.length === 0 && (
              <div className="col-span-full py-12 text-center text-slate-500 dark:text-slate-400 flex flex-col items-center">
                <CarIcon className="w-12 h-12 mb-3 text-slate-300" />
                <p>No se encontraron vehículos.</p>
              </div>
            )}
          </div>
        </div>
        ) : (
          <div className="flex-1 overflow-auto bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700">
            <table className="w-full min-w-[1000px] text-left text-sm border-collapse table-fixed select-none">
              <thead className="bg-[#fcfdfd] dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 font-medium sticky top-0 z-10 shadow-sm">
                <tr>
                  {columns.filter(c => c.visible).map(col => (
                    <th key={col.id} className="relative border-r border-gray-200 dark:border-slate-700 truncate group" style={{ width: col.width }}>
                      <div className="px-4 py-3 truncate">{col.label}</div>
                      <div 
                        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-400 z-20 transition-colors opacity-0 group-hover:opacity-100"
                        onMouseDown={(e) => handleMouseDown(e, col.id, col.width)}
                      />
                    </th>
                  ))}
                  <th className="w-10 relative" style={{ width: 40 }}>
                    <button type="button" onClick={() => setShowColSettings(!showColSettings)} className="w-full h-full flex items-center justify-center p-3 hover:bg-gray-100 dark:hover:bg-slate-700 outline-none">
                      <Settings className="w-4 h-4 text-gray-400 hover:text-gray-600 dark:text-slate-400 transition-colors" />
                    </button>
                    {showColSettings && (
                      <div className="absolute right-0 top-full mt-1 w-64 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded shadow-lg p-2 z-50">
                        <div className="text-xs font-bold text-gray-500 dark:text-slate-400 mb-2 uppercase px-2">Columnas visibles</div>
                        {columns.map(col => (
                          <label key={col.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 dark:bg-slate-900 rounded cursor-pointer text-gray-700 dark:text-slate-300">
                            <input type="checkbox" checked={col.visible} onChange={() => toggleColumn(col.id)} className="rounded border-gray-300 dark:border-slate-600 dark:bg-slate-700 bg-white dark:checked:bg-blue-500" />
                            <span className="truncate">{col.label}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-800">
                {filteredVehicles.map(vehicle => {
                  const matches = getVehicleMatches(vehicle, clients);
                  const totalMatches = matches.length;

                  return (
                  <tr key={vehicle.id} className="border-b border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:bg-slate-900 group/row cursor-pointer" onClick={() => setSelectedVehicle(vehicle)}>
                    {columns.filter(c => c.visible).map(col => {
                      let val: React.ReactNode = '';
                      if (col.id === 'year') val = vehicle.year;
                      if (col.id === 'make') val = (
                        <div className="flex items-center gap-1">
                          {matches.map((match, idx) => {
                            let textColor = 'text-indigo-500';
                            let title = `¡Exacto! (${match.client.name})`;
                            if (match.level === 'high') { textColor = 'text-emerald-500'; title = `Muy similar (${match.client.name})`; }
                            if (match.level === 'medium') { textColor = 'text-yellow-500'; title = `Algo similar (${match.client.name})`; }
                            if (match.level === 'low') { textColor = 'text-orange-500'; title = `Posible match (${match.client.name})`; }
                            return (
                              <button
                                key={idx}
                                onClick={(e) => { e.stopPropagation(); navigate('/persons', { state: { clientId: match.client.id } }); }}
                                className={`p-0.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors`}
                                title={title}
                              >
                                <Target className={`w-4 h-4 ${textColor}`} />
                              </button>
                            );
                          })}
                          <span className="font-medium text-blue-600">{vehicle.make}</span>
                        </div>
                      );
                      if (col.id === 'model') val = vehicle.model;
                      if (col.id === 'color') val = vehicle.color;
                      if (col.id === 'transmission') val = vehicle.transmission;
                      if (col.id === 'bodyType') val = vehicle.bodyType;
                      if (col.id === 'price') val = `$${Number(vehicle.price || 0).toLocaleString()}`;
                      if (col.id === 'purchasePrice') val = (userData?.role === 'admin' || userData?.role === 'master') && vehicle.purchasePrice ? `$${Number(vehicle.purchasePrice).toLocaleString()}` : '-';
                      if (col.id === 'vin') val = <span className="font-mono text-xs">{vehicle.vin}</span>;
                      if (col.id === 'status') val = (vehicle as any).pendingValidation ? <span className="text-amber-600">Pendiente: {(vehicle as any).pendingValidation.type === 'sold' ? 'Vendido' : 'Reservado'}</span> : vehicle.status === 'available' ? 'Disponible' : vehicle.status === 'sold' ? 'Vendido' : 'Reservado';
                      if (col.id === 'km') val = vehicle.km?.toLocaleString() || '0';
                      if (col.id === 'cylinders') val = vehicle.cylinders || '4';
                      if (col.id === 'liters') val = vehicle.liters || '0';
                      if (col.id === 'receivedAt') val = vehicle.receivedAt && typeof vehicle.receivedAt === 'string' ? vehicle.receivedAt.split('T')[0] : '-';
                      if (col.id === 'equipment') val = vehicle.equipment || '-';
                      
                      return (
                        <td key={col.id} className="px-4 py-2 border-r border-gray-100 dark:border-slate-700 text-gray-600 dark:text-slate-400 truncate" style={{ width: col.width, maxWidth: col.width }}>
                          {val}
                        </td>
                      );
                    })}
                    <td className="px-4 py-2 text-center text-gray-400 group-hover/row:text-gray-600 dark:text-slate-400">
                      {(userData?.role === 'admin' || userData?.role === 'master') ? (
                        <button 
                          onClick={(e) => { e.stopPropagation(); setVehicleToDelete(vehicle.id); }}
                          className="p-1 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      ) : '...'}
                    </td>
                  </tr>
                  );
                })}
                {filteredVehicles.length === 0 && (
                  <tr>
                    <td colSpan={columns.filter(c => c.visible).length + 1} className="px-4 py-8 text-center text-gray-500 dark:text-slate-400 font-medium border-b border-gray-100 dark:border-slate-700">
                      No se encontraron vehículos.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedVehicle !== undefined && (
        <VehicleDetailModal 
          vehicle={selectedVehicle as Vehicle} 
          onClose={() => setSelectedVehicle(undefined)} 
        />
      )}

      {vehicleToDelete && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg w-full max-w-sm overflow-hidden p-6 text-center">
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">Eliminar Vehículo</h2>
            <p className="text-slate-600 dark:text-slate-400 mb-6">¿Estás seguro de que deseas eliminar este vehículo? Esta acción no se puede deshacer.</p>
            <div className="flex gap-4">
              <button 
                onClick={() => setVehicleToDelete(null)}
                className="flex-1 py-2 px-4 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-lg hover:bg-slate-200 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={() => handleDelete(vehicleToDelete)}
                className="flex-1 py-2 px-4 bg-gradient-to-r from-rose-500 to-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors"
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
