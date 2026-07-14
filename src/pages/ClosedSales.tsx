import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { checkIsWon } from "../lib/clientUtils";
import { db } from "../lib/firebase";
import { collection, query, where, onSnapshot, doc, getDoc } from "firebase/firestore";
import { Client, Vehicle, VehicleExpense } from "../types";
import { ClientDetailModal } from "../components/ClientDetailModal";
import { VehicleDetailModal } from "../components/VehicleDetailModal";
import { Search } from "lucide-react";
import clsx from "clsx";

export function ClosedSales() {
  const { userData } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [expenses, setExpenses] = useState<VehicleExpense[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [pipelineStages, setPipelineStages] = useState<{ id: string; title: string }[]>([]);

  useEffect(() => {
    if (!userData?.agencyId && userData?.role !== 'master') return;

    if (userData?.agencyId) {
      getDoc(doc(db, "agencies", userData.agencyId as string))
        .then((docSnap) => {
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
    let expensesQ = query(collection(db, "vehicleExpenses"));

    if (userData?.role !== 'master') {
      clientsQ = query(collection(db, "clients"), where("agencyId", "==", userData.agencyId));
      vehiclesQ = query(collection(db, "vehicles"), where("agencyId", "==", userData.agencyId));
    }

    const unsubClients = onSnapshot(clientsQ, (snap) => {
      setClients(snap.docs.map(d => ({ id: d.id, ...d.data() } as Client)));
    });

    const unsubVehicles = onSnapshot(vehiclesQ, (snap) => {
      setVehicles(snap.docs.map(d => ({ id: d.id, ...d.data() } as Vehicle)));
    });

    let dealsQ = userData?.role !== 'master' ? query(collection(db, "deals"), where("agencyId", "==", userData.agencyId)) : query(collection(db, "deals"));
    const unsubDeals = onSnapshot(dealsQ, (snap) => {
      setDeals(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubExpenses = onSnapshot(expensesQ, (snap) => {
      setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() } as VehicleExpense)));
      setLoading(false);
    });

    return () => {
      unsubClients();
      unsubVehicles();
      unsubExpenses();
      unsubDeals();
    };
  }, [userData]);

  
  const isWon = (status: string = "") => checkIsWon(status, pipelineStages);

  const displayClients = [
    ...deals.map(deal => {
      const person = clients.find(c => c.id === deal.clientId) || {};
      return {
        ...person,
        ...deal,
        id: deal.id,
        originalClientId: deal.clientId,
      } as Client;
    }),
    ...clients.filter(c => !deals.some(d => d.clientId === c.id))
  ];

  const deduplicatedClients = Array.from(new Map(displayClients.map(c => [c.id, c])).values());
  const wonClients = deduplicatedClients.filter(c => isWon(c.status));

  const filteredSales = wonClients.filter(c => {
    const search = searchTerm.toLowerCase();
    const v = vehicles.find(veh => veh.id === c.vehicleId);
    const clientMatch = (c.name || "").toLowerCase().includes(search);
    const vehicleMatch = v ? `${v.make} ${v.model} ${v.year}`.toLowerCase().includes(search) : false;
    return clientMatch || vehicleMatch;
  });

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900">
      <div className="px-4 py-4 md:px-6 md:py-6 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Ventas Cerradas</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Historial de vehículos vendidos</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar venta..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-900 border-transparent rounded-lg text-sm focus:bg-white dark:focus:bg-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-900 w-full md:w-64 transition-all"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-6">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 uppercase text-xs font-semibold">
                <tr>
                  <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">Fecha Venta</th>
                  <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">Vehículo</th>
                  <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">Cliente</th>
                  <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">Método de Pago</th>
                  <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">Precio Venta</th>
                  <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">Costo + Gastos</th>
                  <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">Utilidad</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {filteredSales.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                      No hay ventas cerradas registradas
                    </td>
                  </tr>
                ) : (
                  filteredSales.map((client) => {
                    const vehicle = vehicles.find(v => v.id === client.vehicleId);
                    const sale = client.saleDetails;
                    const vehicleExpenses = expenses.filter(e => e.vehicleId === vehicle?.id);
                    const totalExpenses = vehicleExpenses.reduce((sum, e) => sum + e.amount, 0);
                    
                    const purchasePrice = vehicle?.purchasePrice || 0;
                    const salePrice = sale?.price || vehicle?.price || 0;
                    
                    const costPlusExpenses = purchasePrice + totalExpenses;
                    const utility = salePrice - costPlusExpenses;

                    return (
                      <tr key={client.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          {client.soldAt ? new Date(client.soldAt + "T00:00:00").toLocaleDateString('es-MX', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'}
                        </td>
                        <td className="px-4 py-3">
                          {vehicle ? (
                            <button 
                              onClick={() => setSelectedVehicle(vehicle)}
                              className="font-semibold text-blue-600 dark:text-blue-400 hover:underline text-left flex items-center gap-2"
                            >
                              {vehicle.photoUrl ? (
                                <img src={vehicle.photoUrl} alt="Vehicle" className="w-8 h-8 rounded object-cover" />
                              ) : (
                                <div className="w-8 h-8 rounded bg-slate-200 dark:bg-slate-700" />
                              )}
                              <span>{vehicle.year} {vehicle.make} {vehicle.model}</span>
                            </button>
                          ) : (
                            <span className="text-slate-400">Vehículo no encontrado</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <button 
                            onClick={() => setSelectedClient(client)}
                            className="font-semibold text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
                          >
                            {client.name}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 capitalize">
                            {sale?.method ? sale.method.replace('_', ' ') : 'N/A'}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-200">
                          {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(salePrice)}
                        </td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                          {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(costPlusExpenses)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={clsx(
                            "font-bold",
                            utility >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                          )}>
                            {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(utility)}
                          </span>
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
        />
      )}

      {selectedVehicle && (
        <VehicleDetailModal
          vehicle={selectedVehicle}
          onClose={() => setSelectedVehicle(null)}
        />
      )}
    </div>
  );
}
