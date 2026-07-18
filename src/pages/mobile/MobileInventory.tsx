import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { Vehicle, Client } from '../../types';
import { 
  Car as CarIcon, Search, Share2, DollarSign, Calendar, SlidersHorizontal, 
  Sparkles, ExternalLink, MessageSquare, ShieldAlert, Award 
} from 'lucide-react';
import clsx from 'clsx';
import { ShareVehicleModal } from '../../components/ShareVehicleModal';
import { getVehicleMatches } from '../Inventory';
import { useSharedInventoryMatches } from '../../hooks/useSharedInventoryMatches';
import { VehicleDetailModal } from '../../components/VehicleDetailModal';
import { deduplicateClients } from '../../lib/clientUtils';

export function MobileInventory() {
  const { userData } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [vehicleToShare, setVehicleToShare] = useState<Vehicle | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  
  const [activeTab, setActiveTab] = useState<'my' | 'shared'>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('tab') === 'shared' ? 'shared' : 'my';
  });

  const [sharedSubTab, setSharedSubTab] = useState<'matches' | 'all'>('matches');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    if (tabParam === 'shared') {
      setActiveTab('shared');
    } else if (tabParam === 'my') {
      setActiveTab('my');
    }
  }, [window.location.search]);

  // Filters state
  const [filterOwnership, setFilterOwnership] = useState<string>('all');
  const [filterBodyType, setFilterBodyType] = useState<string>('all');

  // Shared matches state
  const { 
    ownAgencySharing, 
    matches: sharedMatches, 
    loading: sharedLoading,
    otherVehicles,
    sharingAgencies 
  } = useSharedInventoryMatches();
  
  const [selectedSharedVehicle, setSelectedSharedVehicle] = useState<Vehicle | null>(null);
  const [selectedSharedClient, setSelectedSharedClient] = useState<Client | null>(null);

  useEffect(() => {
    if (!userData?.agencyId && userData?.role !== 'master') return;

    let q = query(collection(db, 'vehicles'));
    let clientsQ = query(collection(db, 'clients'));

    if (userData?.role !== 'master') {
      q = query(collection(db, 'vehicles'), where('agencyId', '==', userData.agencyId));
      clientsQ = query(collection(db, 'clients'), where('agencyId', '==', userData.agencyId));
    }

    const unsubscribeVehicles = onSnapshot(q, (snapshot) => {
      const loadedVehicles = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Vehicle));
      setVehicles(loadedVehicles);
      setLoading(false);
    });

    const unsubscribeClients = onSnapshot(clientsQ, (snapshot) => {
      const rawClients = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Client));
      setClients(deduplicateClients(rawClients));
    });

    return () => {
      unsubscribeVehicles();
      unsubscribeClients();
    };
  }, [userData]);

  // Extract unique body types dynamically
  const uniqueBodyTypes = React.useMemo(() => {
    let list: Vehicle[] = [];
    if (activeTab === 'shared') {
      list = sharedSubTab === 'matches' ? sharedMatches.map(m => m.vehicle) : otherVehicles;
    } else {
      list = vehicles;
    }
    const types = list
      .map(v => v.bodyType)
      .filter((t): t is string => !!t && t.trim() !== "");
    return Array.from(new Set(types));
  }, [vehicles, sharedMatches, otherVehicles, activeTab, sharedSubTab]);

  const filteredVehicles = vehicles.filter(v => {
    const searchLower = searchTerm.toLowerCase();
    const isSold = v.status === 'sold';
    if (isSold) return false;
    
    const matchesSearch = (
      v.make.toLowerCase().includes(searchLower) ||
      v.model.toLowerCase().includes(searchLower) ||
      v.year.toString().includes(searchLower) ||
      (v.vin || '').toLowerCase().includes(searchLower)
    );

    const matchesOwnership = filterOwnership === 'all' || (v.ownership || 'propio') === filterOwnership;
    const matchesBodyType = filterBodyType === 'all' || v.bodyType?.toLowerCase() === filterBodyType.toLowerCase();

    return matchesSearch && matchesOwnership && matchesBodyType;
  });

  const filteredSharedMatches = sharedMatches.filter(m => {
    const v = m.vehicle;
    const matchesOwnership = filterOwnership === 'all' || (v.ownership || 'propio') === filterOwnership;
    const matchesBodyType = filterBodyType === 'all' || v.bodyType?.toLowerCase() === filterBodyType.toLowerCase();
    return matchesOwnership && matchesBodyType;
  });

  const filteredOtherVehicles = otherVehicles.filter(v => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = (
      v.make.toLowerCase().includes(searchLower) ||
      v.model.toLowerCase().includes(searchLower) ||
      v.year.toString().includes(searchLower) ||
      (v.vin || '').toLowerCase().includes(searchLower)
    );

    const matchesBodyType = filterBodyType === 'all' || v.bodyType?.toLowerCase() === filterBodyType.toLowerCase();

    return matchesSearch && matchesBodyType;
  });

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  const activeCount = activeTab === 'my' 
    ? filteredVehicles.length 
    : (sharedSubTab === 'matches' ? filteredSharedMatches.length : filteredOtherVehicles.length);

  return (
    <div className="flex flex-col h-full overflow-hidden relative">
      {/* Header with Title and Tab Selector */}
      <div className="px-4 py-4 shrink-0 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 z-10 sticky top-0 space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Inventario
          </h1>
          <span className="text-sm font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full">
            {activeCount} Autos
          </span>
        </div>

        {/* Tab Selection */}
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('my')}
            className={clsx(
              "flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5",
              activeTab === 'my'
                ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
            )}
          >
            Mis Vehículos
          </button>
          <button
            onClick={() => setActiveTab('shared')}
            className={clsx(
              "flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 relative",
              activeTab === 'shared'
                ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
            )}
          >
            <Sparkles className={clsx("w-3.5 h-3.5", activeTab === 'shared' ? "text-amber-500" : "text-slate-400")} />
            <span>Red Nextcar</span>
            {ownAgencySharing && sharedMatches.length > 0 && (
              <span className="bg-amber-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full animate-pulse shrink-0">
                {sharedMatches.length}
              </span>
            )}
          </button>
        </div>
        
        {/* Filter Controls Row */}
        <div className="flex flex-col gap-2">
          {(activeTab === 'my' || (activeTab === 'shared' && sharedSubTab === 'all')) && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar marca, modelo o año..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          )}
          
          <div className="flex gap-2">
            <select
              value={filterBodyType}
              onChange={(e) => setFilterBodyType(e.target.value)}
              className="w-full text-xs bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500 transition-colors text-slate-600 dark:text-slate-300 font-medium capitalize"
            >
              <option value="all">Carrocería: Todos</option>
              {uniqueBodyTypes.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main content body with its own scroll container */}
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-28">
        {activeTab === 'my' ? (
          /* My Inventory Tab */
          <div className="space-y-4">
            {filteredVehicles.map((vehicle, idx) => {
              const matches = getVehicleMatches(vehicle, clients);

              return (
                <div 
                  key={`${vehicle.id}-${idx}`} 
                  onClick={() => setSelectedVehicle(vehicle)}
                  className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col cursor-pointer active:scale-[0.99] transition-transform"
                >
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

                    {vehicle.ownership === 'consignacion' && (
                      <div className="absolute top-3 right-3 bg-purple-600/95 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-sm">
                        Consignación
                      </div>
                    )}
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

                    {/* Datos principales badges */}
                    <div className="flex flex-wrap gap-1.5">
                      {vehicle.transmission && (
                        <span className="text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2.5 py-0.5 rounded-full capitalize">
                          {vehicle.transmission}
                        </span>
                      )}
                      {vehicle.color && (
                        <span className="text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2.5 py-0.5 rounded-full capitalize">
                          {vehicle.color}
                        </span>
                      )}
                      {vehicle.bodyType && (
                        <span className="text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2.5 py-0.5 rounded-full capitalize">
                          {vehicle.bodyType}
                        </span>
                      )}
                      {vehicle.cylinders && (
                        <span className="text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2.5 py-0.5 rounded-full">
                          {vehicle.cylinders} cil
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between mt-1">
                      <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                        <SlidersHorizontal className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-medium">{(vehicle.km ?? 0).toLocaleString()} km</span>
                      </div>
                      <div className="text-lg font-bold text-green-600 dark:text-green-400 flex items-center">
                        <DollarSign className="w-5 h-5 -mr-1" />
                        {vehicle.price?.toLocaleString()}
                      </div>
                    </div>

                    {/* Local Matches Display */}
                    {matches.length > 0 && (
                      <div className="mt-1 bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 rounded-xl p-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5 text-blue-800 dark:text-blue-300 font-extrabold text-[11px] mb-2">
                          <Sparkles className="w-3.5 h-3.5 text-blue-500 animate-pulse" />
                          <span>¡Tienes {matches.length} {matches.length === 1 ? 'cliente interesado!' : 'clientes interesados!'}</span>
                        </div>
                        <div className="space-y-1.5">
                          {matches.slice(0, 3).map((m, mIdx) => (
                            <div key={`local-match-${mIdx}`} className="flex justify-between items-center text-[10px] bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-100 dark:border-slate-700 shadow-xs">
                              <div className="min-w-0 flex-1 pr-2">
                                <span className="font-extrabold text-slate-800 dark:text-slate-200 block truncate">
                                  {m.client.name}
                                </span>
                                <span className="text-slate-400 dark:text-slate-500 text-[9px] block mt-0.5">
                                  Match {m.level === 'exact' ? 'Perfecto' : m.level === 'high' ? 'Muy Alto' : 'Medio'}
                                </span>
                              </div>
                              <a
                                href={`https://wa.me/${m.client.phone?.replace(/[^0-9]/g, "")}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-bold text-[9px] transition-colors shrink-0 shadow-sm"
                              >
                                <MessageSquare className="w-3 h-3" />
                                WhatsApp
                              </a>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-700 mt-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setVehicleToShare(vehicle);
                        }}
                        className="w-full flex items-center justify-center gap-2 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 py-2.5 rounded-xl font-semibold transition-colors text-sm border border-slate-200/50 dark:border-slate-700"
                      >
                        <Share2 className="w-4 h-4" />
                        Compartir Ficha Técnica
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            {filteredVehicles.length === 0 && (
              <div className="text-center py-10 text-slate-500">
                No se encontraron vehículos.
              </div>
            )}
          </div>
        ) : (
          /* Red Nextcar Tab */
          <div className="space-y-4">
            {!ownAgencySharing ? (
              <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-2xl border border-amber-200 dark:border-amber-900/60 flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-xs font-extrabold text-amber-800 dark:text-amber-400">Acceso a Red Inactivo</h4>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                    Para visualizar y compartir las coincidencias con autos de otras agencias Nextcar, debes activar <strong>Compartir mi Inventario</strong> en la configuración de la Agencia.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Sub-tabs inside Shared View */}
                <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl mb-4 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setSharedSubTab('matches')}
                    className={clsx(
                      "flex-1 py-1.5 rounded-lg text-center transition-colors flex items-center justify-center gap-1.5",
                      sharedSubTab === 'matches'
                        ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    Matches ({filteredSharedMatches.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSharedSubTab('all')}
                    className={clsx(
                      "flex-1 py-1.5 rounded-lg text-center transition-colors flex items-center justify-center gap-1.5",
                      sharedSubTab === 'all'
                        ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    <CarIcon className="w-3.5 h-3.5 text-blue-500" />
                    Catálogo Completo ({filteredOtherVehicles.length})
                  </button>
                </div>

                {sharedSubTab === 'matches' ? (
                  /* Matches Sub-tab */
                  filteredSharedMatches.length === 0 ? (
                    <div className="p-8 text-center bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 py-12">
                      <CarIcon className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400">No hay coincidencias en red en este momento.</p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 max-w-[240px] mx-auto">
                        Cuando otras agencias compartan autos que coincidan con los gustos de tus clientes, los verás aquí.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {filteredSharedMatches.map((match, idx) => (
                        <div key={`shared-match-${idx}`} className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between">
                          <div className="flex justify-between items-start mb-3">
                            <span className="text-[9px] font-black uppercase tracking-wider px-2.5 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full border border-amber-200/20">
                              Match {match.score}%
                            </span>
                            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 max-w-[150px] truncate bg-slate-100 dark:bg-slate-900/60 px-2 py-0.5 rounded-md">
                              {match.agencyName}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 mb-3.5">
                            <div className="w-12 h-12 rounded-lg bg-slate-200 dark:bg-slate-800 flex items-center justify-center shrink-0 overflow-hidden border border-black/5">
                              {match.vehicle.photoUrl ? (
                                <img src={match.vehicle.photoUrl} alt="auto" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <CarIcon className="w-6 h-6 text-slate-400" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 truncate">
                                {match.vehicle.make} {match.vehicle.model}
                              </h4>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium flex flex-wrap items-center gap-x-1 gap-y-0.5">
                                <span>{match.vehicle.year}</span>
                                <span className="text-slate-300 dark:text-slate-700">•</span>
                                <span>{(match.vehicle.km ?? 0).toLocaleString()} km</span>
                                {match.vehicle.transmission && (
                                  <>
                                    <span className="text-slate-300 dark:text-slate-700">•</span>
                                    <span className="capitalize">{match.vehicle.transmission}</span>
                                  </>
                                )}
                                <span className="text-slate-300 dark:text-slate-700">•</span>
                                <span className="font-extrabold text-green-600 dark:text-green-400">${match.vehicle.price?.toLocaleString()}</span>
                              </p>
                            </div>
                          </div>

                          <div className="text-xs text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
                            El cliente <span className="font-extrabold text-slate-900 dark:text-white">{match.client.name}</span> busca:{" "}
                            <span className="italic font-medium text-slate-800 dark:text-slate-300">
                              {match.client.wantedVehicle?.make || "Cualquiera"} {match.client.wantedVehicle?.model || ""}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100 dark:border-slate-700/60">
                            <button
                              onClick={() => {
                                setSelectedSharedVehicle(match.vehicle);
                                setSelectedSharedClient(match.client);
                              }}
                              className="py-2.5 px-3 bg-slate-100 dark:bg-slate-700 hover:bg-amber-500 hover:text-white dark:hover:bg-amber-600 text-[11px] font-bold rounded-xl text-slate-700 dark:text-slate-200 transition-colors flex items-center justify-center gap-1.5"
                            >
                              <ExternalLink className="w-4 h-4" />
                              Ver Auto
                            </button>
                            <a
                              href={`https://wa.me/${match.client.phone?.replace(/[^0-9]/g, "")}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="py-2.5 px-3 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-500 hover:text-white text-[11px] font-bold rounded-xl text-emerald-700 dark:text-emerald-300 transition-colors flex items-center justify-center gap-1.5"
                            >
                              <MessageSquare className="w-4 h-4" />
                              WhatsApp
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  /* Full Shared Catalog Sub-tab */
                  filteredOtherVehicles.length === 0 ? (
                    <div className="p-8 text-center bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 py-12">
                      <Search className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400">No hay autos en la red con los filtros aplicados.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {filteredOtherVehicles.map((vehicle, idx) => {
                        const agencyName = sharingAgencies[vehicle.agencyId] || "Agencia Externa";
                        return (
                          <div 
                            key={`shared-all-${vehicle.id}-${idx}`} 
                            onClick={() => setSelectedVehicle(vehicle)}
                            className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col cursor-pointer active:scale-[0.99] transition-transform"
                          >
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
                              <div className="absolute top-3 right-3 bg-blue-600 text-white text-[10px] font-black px-2.5 py-1 rounded-md shadow-sm">
                                {agencyName}
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

                              {/* Datos principales badges */}
                              <div className="flex flex-wrap gap-1.5">
                                {vehicle.transmission && (
                                  <span className="text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2.5 py-0.5 rounded-full capitalize">
                                    {vehicle.transmission}
                                  </span>
                                )}
                                {vehicle.color && (
                                  <span className="text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2.5 py-0.5 rounded-full capitalize">
                                    {vehicle.color}
                                  </span>
                                )}
                                {vehicle.bodyType && (
                                  <span className="text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2.5 py-0.5 rounded-full capitalize">
                                    {vehicle.bodyType}
                                  </span>
                                )}
                                {vehicle.cylinders && (
                                  <span className="text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2.5 py-0.5 rounded-full">
                                    {vehicle.cylinders} cil
                                  </span>
                                )}
                              </div>
                              
                              <div className="flex items-center justify-between mt-1">
                                <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                                  <SlidersHorizontal className="w-4 h-4 text-slate-400" />
                                  <span className="text-sm font-medium">{(vehicle.km ?? 0).toLocaleString()} km</span>
                                </div>
                                <div className="text-lg font-bold text-green-600 dark:text-green-400 flex items-center">
                                  <DollarSign className="w-5 h-5 -mr-1" />
                                  {vehicle.price?.toLocaleString()}
                                </div>
                              </div>

                              <div className="pt-3 border-t border-slate-100 dark:border-slate-700 mt-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setVehicleToShare(vehicle);
                                  }}
                                  className="w-full flex items-center justify-center gap-2 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 py-2.5 rounded-xl font-semibold transition-colors text-sm border border-slate-200/50 dark:border-slate-700"
                                >
                                  <Share2 className="w-4 h-4" />
                                  Compartir Ficha Técnica
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )
                )}
              </>
            )}
          </div>
        )}
      </div>

      {vehicleToShare && (
        <ShareVehicleModal
          vehicle={vehicleToShare}
          onClose={() => setVehicleToShare(null)}
        />
      )}

      {selectedVehicle && (
        <VehicleDetailModal
          vehicle={selectedVehicle}
          onClose={() => setSelectedVehicle(null)}
        />
      )}

      {selectedSharedVehicle && selectedSharedClient && (
        <VehicleDetailModal
          vehicle={selectedSharedVehicle}
          clientContext={selectedSharedClient}
          onClose={() => {
            setSelectedSharedVehicle(null);
            setSelectedSharedClient(null);
          }}
        />
      )}
    </div>
  );
}
