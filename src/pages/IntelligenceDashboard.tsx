import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { InventoryIntelligence } from '../modules/lead-intelligence/services/inventoryIntelligence';
import { DemandPattern } from '../modules/lead-intelligence/types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp, AlertCircle, RefreshCw, Car, DollarSign, Search } from 'lucide-react';

export function IntelligenceDashboard() {
  const { userData } = useAuth();
  const [loading, setLoading] = useState(true);
  const [demandPatterns, setDemandPatterns] = useState<DemandPattern[]>([]);
  const [error, setError] = useState('');

  const loadData = async () => {
    if (!userData?.agencyId) return;
    try {
      setLoading(true);
      setError('');
      const patterns = await InventoryIntelligence.analyzeDemandForAgency(userData.agencyId);
      setDemandPatterns(patterns);
    } catch (err: any) {
      setError(err.message || 'Error al cargar la inteligencia de inventario.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [userData?.agencyId]);

  const topDemand = demandPatterns.slice(0, 5);

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'high': return 'text-green-600 bg-green-50 border-green-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-gray-600 bg-gray-50 border-gray-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getChartColor = (level: string) => {
    switch (level) {
      case 'high': return '#16a34a';
      case 'medium': return '#ca8a04';
      case 'low': return '#9ca3af';
      default: return '#9ca3af';
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-[#E4002B]" />
            Inteligencia Comercial
          </h1>
          <p className="text-gray-500 mt-1">Análisis de demanda y recomendaciones de inventario.</p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#E4002B]"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar Datos
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-md flex items-center gap-2 border border-red-200">
          <AlertCircle className="h-5 w-5" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#E4002B]"></div>
        </div>
      ) : demandPatterns.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No hay suficientes datos</h3>
          <p className="text-gray-500">
            No se encontraron patrones de demanda claros en los prospectos actuales. Asegúrate de registrar las preferencias de vehículos de tus clientes.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Top Demand Chart */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-6">Volumen de Búsqueda (Top 5)</h2>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topDemand} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis 
                    dataKey={(v) => `${v.make || 'Cualquiera'} ${v.model || ''}`} 
                    type="category" 
                    width={120}
                    tick={{ fill: '#4b5563', fontSize: 12 }}
                  />
                  <RechartsTooltip 
                    formatter={(value: number) => [`${value} prospectos`, 'Búsquedas']}
                    labelFormatter={(label) => `Vehículo: ${label}`}
                  />
                  <Bar dataKey="searchVolume" radius={[0, 4, 4, 0]}>
                    {topDemand.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getChartColor(entry.opportunityLevel)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Key Insights */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Recomendaciones de Compra</h2>
              <div className="space-y-4">
                {demandPatterns.filter(p => p.opportunityLevel === 'high' || p.opportunityLevel === 'medium').slice(0, 4).map((pattern, idx) => (
                  <div key={idx} className="p-4 rounded-lg border border-gray-100 bg-gray-50 flex flex-col gap-2">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <Car className="h-5 w-5 text-gray-500" />
                        <span className="font-semibold text-gray-900">
                          {pattern.make || 'Marca flexible'} {pattern.model || ''}
                        </span>
                      </div>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getLevelColor(pattern.opportunityLevel)}`}>
                        {pattern.opportunityLevel === 'high' ? 'Alta Demanda' : 'Media Demanda'}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 flex justify-between">
                      <span>Buscado por {pattern.searchVolume} leads</span>
                      {pattern.averageBudget > 0 && (
                        <span className="flex items-center text-gray-900 font-medium">
                          <DollarSign className="h-3 w-3 text-gray-500" />
                          {pattern.averageBudget.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="bg-[#E4002B]/10 rounded-xl border border-[#E4002B]/20 p-6">
              <h3 className="font-medium text-[#E4002B] mb-2 flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Oportunidad Detectada
              </h3>
              <p className="text-sm text-gray-700">
                Basado en tu base de datos, adquirir unidades del modelo <strong>{topDemand[0]?.make} {topDemand[0]?.model}</strong> garantizará ventas rápidas con un precio promedio de <strong>${topDemand[0]?.averageBudget?.toLocaleString()}</strong>.
              </p>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
