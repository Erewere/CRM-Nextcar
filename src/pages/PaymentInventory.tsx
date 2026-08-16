import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { Client, Vehicle } from '../types';
import { Search, User, Car } from 'lucide-react';
import { checkIsWon } from '../lib/clientUtils';
import clsx from 'clsx';
import { ClientDetailModal } from '../components/ClientDetailModal';
import { VehicleDetailModal } from '../components/VehicleDetailModal';

export function PaymentInventory() {
  const { userData } = useAuth();

  if (userData?.role === 'seller') {
    return <Navigate to="/" replace />;
  }

  const [clients, setClients] = useState<Client[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [pipelineStages, setPipelineStages] = useState<{id: string, title: string}[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);

  useEffect(() => {
    if (!userData?.agencyId && userData?.role !== 'master') return;
    
    let unsubStages = () => {};
    // Load Pipeline Stages for won status check
    if (userData.agencyId && userData.agencyId !== "unassigned") {
      unsubStages = onSnapshot(doc(db, "agencies", userData.agencyId), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.pipelineStages && Array.isArray(data.pipelineStages)) {
            setPipelineStages(data.pipelineStages);
          }
        }
      }, (err) => console.error("PaymentInventory stages snapshot error:", err));
    }

    let clientsQ = query(collection(db, "clients"));
    let vehiclesQ = query(collection(db, "vehicles"));
    let dealsQ = query(collection(db, "deals"));
    
    if (userData.role !== 'master') {
      clientsQ = query(collection(db, "clients"), where("agencyId", "==", userData.agencyId));
      vehiclesQ = query(collection(db, "vehicles"), where("agencyId", "==", userData.agencyId));
      dealsQ = query(collection(db, "deals"), where("agencyId", "==", userData.agencyId));
    }

    const unsubClients = onSnapshot(clientsQ, (snap) => {
      const raw = snap.docs.map(d => ({ ...d.data(), id: d.id } as Client)).filter(c => !c.isDeleted);
      setClients(raw);
    }, (err) => console.error("PaymentInventory clients snapshot error:", err));

    const unsubVehicles = onSnapshot(vehiclesQ, (snap) => {
      setVehicles(snap.docs.map(d => ({ ...d.data(), id: d.id } as Vehicle)));
    }, (err) => console.error("PaymentInventory vehicles snapshot error:", err));

    const unsubDeals = onSnapshot(dealsQ, (snap) => {
      setDeals(snap.docs.map(d => ({ ...d.data(), id: d.id }) as any).filter(d => !d.isDeleted));
      setLoading(false);
    }, (err) => {
      console.error("PaymentInventory deals snapshot error:", err);
      setLoading(false);
    });

    return () => {
      unsubStages();
      unsubClients();
      unsubVehicles();
      unsubDeals();
    };
  }, [userData]);

  const isWon = (status: string = "", saleDetails?: any) => {
    return checkIsWon(status, pipelineStages);
  };

  // Helper to merge and deduplicate payments across deal, client, and vehicle
  const getMergedSaleDetails = (dDetails: any, pDetails: any, vDetails: any) => {
    const baseDetails = (dDetails && (dDetails.price !== undefined || dDetails.method))
      ? dDetails
      : (pDetails && (pDetails.price !== undefined || pDetails.method))
        ? pDetails
        : (vDetails || {});

    const dPayments = dDetails?.payments || [];
    const pPayments = pDetails?.payments || [];
    const vPayments = vDetails?.payments || [];

    const paymentMap = new Map();
    [...dPayments, ...pPayments, ...vPayments].forEach(p => {
      if (p) {
        const key = p.id || `${p.date}_${p.amount}_${p.createdAt || ''}`;
        if (!paymentMap.has(key)) {
          paymentMap.set(key, p);
        }
      }
    });

    return {
      ...baseDetails,
      payments: Array.from(paymentMap.values())
    };
  };

  // Build unified list of sales
  const itemsFromDeals = deals.map(deal => {
    const person = (clients.find(c => c.id === deal.clientId) || {}) as Partial<Client>;
    const vehicle = vehicles.find(v => v.id === deal.vehicleId || v.id === person.vehicleId);
    
    const isRecordedBuyer = !!vehicle && (
      vehicle.buyerId === person.id ||
      vehicle.soldToClientId === deal.clientId ||
      vehicle.soldToClientId === person.id
    );
    const dealIsWon = isWon(deal.status) || isWon(person.status) || Boolean(deal.saleDetails?.price || person.saleDetails?.price) || (isRecordedBuyer && (vehicle?.status === 'sold' || Boolean(vehicle?.saleDetails?.price)));

    const mergedSaleDetails = getMergedSaleDetails(deal.saleDetails, person.saleDetails, isRecordedBuyer ? vehicle?.saleDetails : undefined);

    const mergedDealValue = deal.saleDetails?.price ?? person.saleDetails?.price ?? (isRecordedBuyer ? vehicle?.saleDetails?.price : undefined) ?? deal.value ?? deal.dealValue ?? person.dealValue;
    const soldAt = deal.soldAt || person.soldAt || vehicle?.soldAt || deal.updatedAt || person.updatedAt;

    const statusToUse = dealIsWon ? 'won' : (deal.status || person.status || 'lead');

    return {
      ...person,
      ...deal,
      status: statusToUse,
      saleDetails: mergedSaleDetails,
      dealValue: mergedDealValue,
      soldAt,
      id: deal.id,
      originalClientId: deal.clientId,
      vehicleId: deal.vehicleId || person.vehicleId || vehicle?.id,
      vehicle: deal.vehicle || person.vehicle || (vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : undefined)
    } as Client;
  });

  const clientsWithoutDeals = clients.filter(c => !deals.some(d => d.clientId === c.id));
  const itemsFromClients = clientsWithoutDeals.map(person => {
    const vehicle = vehicles.find(v => v.id === person.vehicleId);

    const isRecordedBuyer = !!vehicle && (
      vehicle.buyerId === person.id ||
      vehicle.soldToClientId === person.id
    );
    const personIsWon = isWon(person.status) || Boolean(person.saleDetails?.price) || (isRecordedBuyer && (vehicle?.status === 'sold' || Boolean(vehicle?.saleDetails?.price)));

    const mergedSaleDetails = getMergedSaleDetails(undefined, person.saleDetails, isRecordedBuyer ? vehicle?.saleDetails : undefined);
    const mergedDealValue = person.saleDetails?.price ?? (isRecordedBuyer ? vehicle?.saleDetails?.price : undefined) ?? person.dealValue ?? vehicle?.price;
    const soldAt = person.soldAt || vehicle?.soldAt || person.updatedAt;

    const statusToUse = personIsWon ? 'won' : person.status;

    return {
      ...person,
      status: statusToUse,
      saleDetails: mergedSaleDetails,
      dealValue: mergedDealValue,
      soldAt,
    } as Client;
  });

  const allIncludedVehicleIds = new Set<string>();
  [...itemsFromDeals, ...itemsFromClients].forEach(item => {
    if (item.vehicleId && (isWon(item.status, item.saleDetails) || item.status === 'won')) {
      allIncludedVehicleIds.add(item.vehicleId);
    }
  });

  const soldVehiclesWithoutClientOrDeal = vehicles.filter(v => 
    (v.status === 'sold' || (v.saleDetails && (v.saleDetails.price > 0 || v.saleDetails.method))) &&
    !allIncludedVehicleIds.has(v.id)
  ).map(v => {
    const matchingClient = clients.find(c => 
      ((v.buyerId && c.id === v.buyerId) ||
       (v.soldToClientId && c.id === v.soldToClientId) ||
       ((v as any).pendingValidation?.clientId && c.id === (v as any).pendingValidation.clientId) ||
       (c.vehicleId === v.id && checkIsWon(c.status, pipelineStages)))
    );

    const mergedSaleDetails = getMergedSaleDetails(undefined, matchingClient?.saleDetails, v.saleDetails);
    const price = mergedSaleDetails?.price || v.price || 0;
    
    return {
      id: matchingClient?.id || `v-sold-${v.id}`,
      originalClientId: matchingClient?.id,
      name: matchingClient?.name || (v as any).buyerName || (v.saleDetails as any)?.clientName || (v as any).pendingValidation?.clientName || 'Cliente (Venta de Vehículo)',
      email: matchingClient?.email || '',
      phone: matchingClient?.phone || '',
      vehicleId: v.id,
      vehicle: `${v.year} ${v.make} ${v.model}`,
      status: 'won',
      saleDetails: mergedSaleDetails,
      dealValue: price,
      soldAt: v.soldAt || matchingClient?.soldAt || v.updatedAt,
    } as Client;
  });

  const displayClients = [...itemsFromDeals, ...itemsFromClients, ...soldVehiclesWithoutClientOrDeal];
  const deduplicatedClients = Array.from(new Map(displayClients.map(c => [c.id, c])).values());
  const wonClients = deduplicatedClients.filter(c => isWon(c.status, c.saleDetails) || c.status === 'won' || (c.saleDetails?.payments?.length || 0) > 0 || (c.saleDetails?.price || 0) > 0);

  const filteredSales = wonClients.filter(c => {
    const search = searchTerm.toLowerCase();
    const v = vehicles.find(veh => veh.id === c.vehicleId);
    return (
      (c.name || "").toLowerCase().includes(search) ||
      (c.vehicle || "").toLowerCase().includes(search) ||
      (v ? `${v.make} ${v.model} ${v.year}`.toLowerCase().includes(search) : false)
    );
  }).sort((a, b) => {
    const dateA = a.soldAt ? new Date(a.soldAt).getTime() : 0;
    const dateB = b.soldAt ? new Date(b.soldAt).getTime() : 0;
    return dateB - dateA;
  });

  const getMethodBadge = (saleDetails?: any) => {
    if (!saleDetails?.method) {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
          N/A
        </span>
      );
    }
    const m = saleDetails.method;
    if (m === 'credito' || m === 'credito_propio') {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
          💳 Crédito Propio
        </span>
      );
    }
    if (m === 'credito_bancario') {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
          🏦 Crédito Bancario
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
        💵 Contado
      </span>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#f4f5f5] dark:bg-slate-900">
      <div className="px-4 py-4 md:px-6 md:py-6 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Inventario de Pagos</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Control detallado de ventas y pagos recibidos</p>
        </div>
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por cliente o vehículo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border rounded-lg bg-gray-50 dark:bg-slate-900/50 border-gray-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-6">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left text-sm border-collapse">
              <thead className="bg-[#fcfdfd] dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 font-medium sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-4 py-3">Fecha de Venta</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Vehículo</th>
                  <th className="px-4 py-3">Forma de Pago</th>
                  <th className="px-4 py-3">Precio Acordado</th>
                  <th className="px-4 py-3">Total Pagado</th>
                  <th className="px-4 py-3">Saldo Pendiente</th>
                  <th className="px-4 py-3">Progreso</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {filteredSales.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                      No hay ventas cerradas para mostrar
                    </td>
                  </tr>
                ) : (
                  filteredSales.map((client) => {
                    const vehicle = vehicles.find(v => v.id === client.vehicleId);
                    const sale = client.saleDetails;
                    const price = sale?.price || client.dealValue || vehicle?.price || 0;
                    const payments = sale?.payments || [];
                    const totalPaid = payments.reduce((acc, p) => acc + (p.amount || 0), 0);
                    const balance = Math.max(0, price - totalPaid);
                    const progress = price > 0 ? Math.min(100, Math.round((totalPaid / price) * 100)) : 0;
                    
                    return (
                      <tr key={client.id} className="hover:bg-[#f4f5f5] dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          {client.soldAt ? new Date(client.soldAt + "T00:00:00").toLocaleDateString('es-MX', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'}
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => setSelectedClient(client)} className="font-semibold text-slate-700 dark:text-slate-200 hover:text-emerald-600 hover:underline flex items-center gap-2">
                            <User className="w-4 h-4 text-slate-400" />
                            {client.name}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                           {vehicle ? (
                             <button
                                type="button"
                                onClick={() => setSelectedVehicle(vehicle)}
                                className="font-semibold text-slate-700 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 hover:underline flex items-center gap-2 text-left group transition-colors"
                                title="Ver ficha completa del vehículo"
                              >
                               <Car className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 transition-colors" />
                               <span>{vehicle.year} {vehicle.make} {vehicle.model}</span>
                             </button>
                           ) : client.vehicleId ? (
                             <button
                                type="button"
                                onClick={() => setSelectedVehicle({ id: client.vehicleId, make: client.vehicle || 'Vehículo', model: '', price } as Vehicle)}
                                className="font-semibold text-slate-700 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 hover:underline flex items-center gap-2 text-left group transition-colors"
                                title="Ver ficha completa del vehículo"
                              >
                               <Car className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 transition-colors" />
                               <span>{client.vehicle || "Ver Vehículo"}</span>
                             </button>
                           ) : (
                             <span>{client.vehicle || "N/A"}</span>
                           )}
                        </td>
                        <td className="px-4 py-3">
                          {getMethodBadge(sale)}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-200">
                          {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(price)}
                        </td>
                        <td className="px-4 py-3 font-semibold text-emerald-600 dark:text-emerald-400">
                          {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(totalPaid)}
                        </td>
                        <td className="px-4 py-3 font-semibold text-rose-600 dark:text-rose-400">
                          {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(balance)}
                        </td>
                        <td className="px-4 py-3 w-48">
                          <div className="flex items-center gap-2">
                            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 flex-1">
                              <div 
                                className={clsx("h-2 rounded-full", progress === 100 ? "bg-emerald-500" : "bg-amber-500")}
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium text-slate-600 dark:text-slate-300 w-8">{progress}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selectedClient && (
        <ClientDetailModal
          client={selectedClient}
          onClose={() => setSelectedClient(null)}
          onUpdated={() => {}}
        />
      )}

      {selectedVehicle && (
        <VehicleDetailModal
          vehicle={selectedVehicle}
          onClose={() => setSelectedVehicle(null)}
          clientContext={selectedClient || undefined}
        />
      )}
    </div>
  );
}
