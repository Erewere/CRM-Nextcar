import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { Client, Vehicle } from '../types';
import { Search, DollarSign, Calendar, CreditCard, User, Car } from 'lucide-react';
import { checkIsWon, deduplicateClients } from '../lib/clientUtils';
import clsx from 'clsx';
import { ClientDetailModal } from '../components/ClientDetailModal';
import { VehicleDetailModal } from '../components/VehicleDetailModal';

export function PaymentInventory() {
  const { userData } = useAuth();
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
      });
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
      setClients(deduplicateClients(raw));
    });

    const unsubVehicles = onSnapshot(vehiclesQ, (snap) => {
      setVehicles(snap.docs.map(d => ({ ...d.data(), id: d.id } as Vehicle)));
    });

    const unsubDeals = onSnapshot(dealsQ, (snap) => {
      setDeals(snap.docs.map(d => ({ ...d.data(), id: d.id }) as any).filter(d => !d.isDeleted));
      setLoading(false);
    });

    return () => {
      unsubStages();
      unsubClients();
      unsubVehicles();
      unsubDeals();
    };
  }, [userData]);

  const isWon = (status: string = "") => checkIsWon(status, pipelineStages);

  const displayClients = [
    ...deals.map(deal => {
      const person = (clients.find(c => c.id === deal.clientId) || {}) as Partial<Client>;
      const mergedSaleDetails = (deal.saleDetails && deal.saleDetails.price !== undefined)
        ? deal.saleDetails
        : (person.saleDetails && person.saleDetails.price !== undefined)
          ? person.saleDetails
          : deal.saleDetails || person.saleDetails;
      const mergedDealValue = deal.saleDetails?.price ?? person.saleDetails?.price ?? deal.value ?? deal.dealValue ?? person.dealValue;
      return {
        ...person,
        ...deal,
        saleDetails: mergedSaleDetails,
        dealValue: mergedDealValue,
        id: deal.id,
        originalClientId: deal.clientId
      } as Client;
    }),
    ...clients.filter(c => !deals.some(d => d.clientId === c.id))
  ];
  const deduplicatedClients = Array.from(new Map(displayClients.map(c => [c.id, c])).values());
  const wonClients = deduplicatedClients.filter(c => isWon(c.status));

  const filteredSales = wonClients.filter(c => {
    const search = searchTerm.toLowerCase();
    const v = vehicles.find(veh => veh.id === c.vehicleId);
    return (
      (c.name || "").toLowerCase().includes(search) ||
      (v ? `${v.make} ${v.model} ${v.year}`.toLowerCase().includes(search) : false)
    );
  }).sort((a, b) => {
    const dateA = a.soldAt ? new Date(a.soldAt).getTime() : 0;
    const dateB = b.soldAt ? new Date(b.soldAt).getTime() : 0;
    return dateB - dateA;
  });

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
                  filteredSales.map((client, idx) => {
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
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 capitalize">
                            {sale?.method ? sale.method.replace('_', ' ') : 'N/A'}
                          </span>
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
