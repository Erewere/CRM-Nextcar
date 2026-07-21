import React, { useState, useEffect, useMemo } from 'react';
import { X, Download, Filter, Calendar, TrendingUp, DollarSign } from 'lucide-react';
import { Client, Vehicle, VehicleExpense } from '../types';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import * as XLSX from 'xlsx';
import { format, isAfter, isBefore, subMonths, subWeeks, subYears, startOfMonth, endOfMonth, startOfWeek, endOfWeek, parseISO, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';

interface AgencyRevenueModalProps {
  isOpen: boolean;
  onClose: () => void;
  wonContacts: Client[];
  vehicles: Vehicle[];
}

type DateFilter = 'all' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'last_3_months' | 'this_year';

export function AgencyRevenueModal({ isOpen, onClose, wonContacts, vehicles }: AgencyRevenueModalProps) {
  const { userData } = useAuth();
  const [expenses, setExpenses] = useState<VehicleExpense[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');

  useEffect(() => {
    if (isOpen && userData?.agencyId) {
      fetchExpenses();
    }
  }, [isOpen, userData?.agencyId]);

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const q = userData?.role === 'master' 
        ? query(collection(db, "vehicleExpenses"))
        : query(collection(db, "vehicleExpenses"), where("agencyId", "==", userData?.agencyId));
      
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as VehicleExpense));
      setExpenses(data);
    } catch (error) {
      console.error("Error fetching expenses", error);
    }
    setLoading(false);
  };

  const filteredData = useMemo(() => {
    const now = new Date();
    
    let startDate: Date | null = null;
    let endDate: Date | null = null;

    switch (dateFilter) {
      case 'this_week':
        startDate = startOfWeek(now, { weekStartsOn: 1 });
        endDate = endOfWeek(now, { weekStartsOn: 1 });
        break;
      case 'last_week':
        startDate = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
        endDate = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
        break;
      case 'this_month':
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
        break;
      case 'last_month':
        startDate = startOfMonth(subMonths(now, 1));
        endDate = endOfMonth(subMonths(now, 1));
        break;
      case 'last_3_months':
        startDate = startOfMonth(subMonths(now, 3));
        endDate = endOfMonth(now);
        break;
      case 'this_year':
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31);
        break;
      case 'all':
      default:
        break;
    }

    const filteredContacts = wonContacts.filter(contact => {
      if (!startDate || !endDate) return true;
      const soldDate = contact.soldAt ? new Date(contact.soldAt) : (contact.updatedAt ? new Date(contact.updatedAt) : new Date());
      return isAfter(soldDate, startOfDay(startDate)) && isBefore(soldDate, endOfDay(endDate));
    });

    return filteredContacts.map(contact => {
      const vehicle = vehicles.find(v => v.id === contact.vehicleId);
      const vehicleExpenses = vehicle ? expenses.filter(e => e.vehicleId === vehicle.id) : [];
      const totalExpenses = vehicleExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
      
      const salePrice = contact.dealValue || vehicle?.price || 0;
      const purchasePrice = vehicle?.purchasePrice || 0;
      const profit = salePrice - purchasePrice - totalExpenses;

      return {
        contact,
        vehicle,
        salePrice,
        purchasePrice,
        totalExpenses,
        profit,
        date: contact.soldAt || contact.updatedAt
      };
    }).sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
  }, [wonContacts, vehicles, expenses, dateFilter]);

  const totals = useMemo(() => {
    return filteredData.reduce((acc, row) => ({
      salePrice: acc.salePrice + row.salePrice,
      purchasePrice: acc.purchasePrice + row.purchasePrice,
      totalExpenses: acc.totalExpenses + row.totalExpenses,
      profit: acc.profit + row.profit,
    }), { salePrice: 0, purchasePrice: 0, totalExpenses: 0, profit: 0 });
  }, [filteredData]);

  const handleExportExcel = () => {
    const exportData = filteredData.map(row => ({
      'Fecha Venta': row.date ? format(new Date(row.date), 'dd/MM/yyyy') : 'N/A',
      'Cliente': row.contact.name,
      'Vehículo': row.vehicle ? `${row.vehicle.make} ${row.vehicle.model} ${row.vehicle.year}` : 'N/A',
      'VIN': row.vehicle?.vin || 'N/A',
      'Precio de Venta': row.salePrice,
      'Costo (Compra)': row.purchasePrice,
      'Gastos': row.totalExpenses,
      'Utilidad Neta': row.profit
    }));

    // Add totals row
    exportData.push({
      'Fecha Venta': 'TOTALES',
      'Cliente': '',
      'Vehículo': '',
      'VIN': '',
      'Precio de Venta': totals.salePrice,
      'Costo (Compra)': totals.purchasePrice,
      'Gastos': totals.totalExpenses,
      'Utilidad Neta': totals.profit
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ingresos");
    XLSX.writeFile(wb, `Reporte_Ingresos_LUHO_${format(new Date(), 'dd-MM-yyyy')}.xlsx`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-lg">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Análisis de Ingresos</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Desglose de ventas, costos y utilidad</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as DateFilter)}
              className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
            >
              <option value="all">Todo el tiempo</option>
              <option value="this_week">Esta Semana</option>
              <option value="last_week">Semana Pasada</option>
              <option value="this_month">Este Mes</option>
              <option value="last_month">Mes Pasado</option>
              <option value="last_3_months">Últimos 3 Meses</option>
              <option value="this_year">Este Año</option>
            </select>
          </div>
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            Exportar a Excel
          </button>
        </div>

        {/* Totals Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Ventas Totales</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white">
              {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totals.salePrice)}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Costo (Vehículos)</p>
            <p className="text-xl font-bold text-red-600 dark:text-red-400">
              {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totals.purchasePrice)}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Gastos Totales</p>
            <p className="text-xl font-bold text-orange-600 dark:text-orange-400">
              {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totals.totalExpenses)}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/50">
            <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">Utilidad Neta</p>
            <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
              {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totals.profit)}
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex justify-center items-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-800/50 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Fecha</th>
                  <th className="px-6 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Cliente</th>
                  <th className="px-6 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Vehículo</th>
                  <th className="px-6 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Venta</th>
                  <th className="px-6 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Costo</th>
                  <th className="px-6 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Gastos</th>
                  <th className="px-6 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Utilidad</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700 bg-white dark:bg-slate-900">
                {filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">
                      No hay ventas registradas en este periodo.
                    </td>
                  </tr>
                ) : (
                  filteredData.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">
                        {row.date ? format(new Date(row.date), 'dd/MM/yyyy') : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-white">
                        {row.contact.name}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                        {row.vehicle ? `${row.vehicle.make} ${row.vehicle.model} ${row.vehicle.year}` : 'Vehículo eliminado'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-white text-right font-medium">
                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(row.salePrice)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 dark:text-red-400 text-right">
                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(row.purchasePrice)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-orange-600 dark:text-orange-400 text-right">
                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(row.totalExpenses)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-emerald-600 dark:text-emerald-400 text-right font-bold">
                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(row.profit)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
