import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { InventoryIntelligence } from '../modules/lead-intelligence/services/inventoryIntelligence';
import { DemandPattern } from '../modules/lead-intelligence/types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp, AlertCircle, RefreshCw, Car, DollarSign, Search, Sparkles, MessageSquare, ExternalLink, ShieldAlert, BadgeCheck } from 'lucide-react';
import { useSharedInventoryMatches } from '../hooks/useSharedInventoryMatches';
import { VehicleDetailModal } from '../components/VehicleDetailModal';
import { Vehicle, Client } from '../types';

export function IntelligenceDashboard() {
  const { userData } = useAuth();
  const [loading, setLoading] = useState(true);
  const [demandPatterns, setDemandPatterns] = useState<DemandPattern[]>([]);
  const [error, setError] = useState('');

  // Shared Inventory Matches
  const { ownAgencySharing, matches, loading: matchesLoading } = useSharedInventoryMatches();
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

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
        <div className="bg-white rounded shadow-sm border border-gray-200 p-12 text-center">
          <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No hay suficientes datos</h3>
          <p className="text-gray-500">
            No se encontraron patrones de demanda claros en los prospectos actuales. Asegúrate de registrar las preferencias de vehículos de tus clientes.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Top Demand Chart */}
          <div className="lg:col-span-2 bg-white rounded shadow-sm border border-gray-200 p-6">
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
            <div className="bg-white rounded shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Recomendaciones de Compra</h2>
              <div className="space-y-4">
                {demandPatterns.filter(p => p.opportunityLevel === 'high' || p.opportunityLevel === 'medium').slice(0, 4).map((pattern, idx) => (
                  <div key={idx} className="p-4 rounded border border-gray-100 bg-gray-50 flex flex-col gap-2">
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
            
            <div className="bg-[#E4002B]/10 rounded border border-[#E4002B]/20 p-6">
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

        {/* Oportunidades de Inventario Compartido (Matches de Red) */}
        <div className="bg-white rounded shadow-sm border border-gray-200 p-6 mt-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-500 animate-pulse" />
                Matches de Inventario Compartido
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                Cruza las especificaciones que tus prospectos buscan con los vehículos disponibles de otras agencias.
              </p>
            </div>
            {matches.length > 0 && (
              <span className="bg-amber-100 text-amber-800 text-xs font-bold px-3 py-1 rounded-full">
                {matches.length} Matches Encontrados
              </span>
            )}
          </div>

          {!ownAgencySharing ? (
            <div className="p-5 bg-amber-50 rounded border border-amber-200 flex items-start gap-4">
              <ShieldAlert className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-sm text-amber-850">Compartir Inventario Desactivado</h4>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Para poder ver y aprovechar los matches con los vehículos compartidos de otras agencias de la red LUHO, debes activar <strong>Compartir mi Inventario</strong> en la sección de tu Agencia (Usuarios y Agencia).
                </p>
              </div>
            </div>
          ) : matches.length === 0 ? (
            <div className="text-center py-10 bg-[#f4f5f5] rounded border border-dashed border-gray-200">
              <Car className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">No hay coincidencias activas</p>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Cuando un prospecto tenga preferencias de auto especificadas (marca, modelo, año, precio) y coincida con el auto de otra agencia que comparta su inventario, lo verás listado aquí.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {matches.map((match, idx) => (
                <div key={idx} className="bg-[#f4f5f5] border border-gray-200 rounded p-4 flex flex-col justify-between shadow-sm hover:shadow-sm transition-shadow">
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full border border-amber-200/50">
                        Match {match.score}%
                      </span>
                      <span className="text-xs font-bold text-slate-500 max-w-[150px] truncate">
                        {match.agencyName}
                      </span>
                    </div>

                    {/* Vehicle details */}
                    <div className="flex items-center gap-3 bg-white p-2.5 rounded border border-gray-200 mb-4">
                      <div className="w-12 h-12 rounded bg-slate-100 flex items-center justify-center shrink-0 overflow-hidden">
                        {match.vehicle.photoUrl ? (
                          <img src={match.vehicle.photoUrl} alt="auto" className="w-full h-full object-cover rounded" referrerPolicy="no-referrer" />
                        ) : (
                          <Car className="w-6 h-6 text-slate-400" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-black text-slate-800 truncate">
                          {match.vehicle.make} {match.vehicle.model}
                        </h4>
                        <p className="text-[10px] text-slate-500 mt-0.5 font-bold">
                          {match.vehicle.year} • ${match.vehicle.price?.toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {/* Client details */}
                    <div className="space-y-1 text-xs mb-4">
                      <div className="text-slate-500 font-bold">Prospecto Buscando:</div>
                      <div className="font-extrabold text-slate-900 flex items-center gap-1.5">
                        <BadgeCheck className="w-4 h-4 text-emerald-500" />
                        {match.client.name}
                      </div>
                      {match.client.wantedVehicle && (
                        <p className="text-[11px] text-slate-600 italic mt-0.5 leading-relaxed">
                          Busca: {match.client.wantedVehicle.make || "Cualquiera"} {match.client.wantedVehicle.model || ""} ({match.client.wantedVehicle.yearMin || "cualquiera"} - {match.client.wantedVehicle.yearMax || "cualquiera"}) max ${match.client.wantedVehicle.priceMax?.toLocaleString() || "cualquiera"}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-2 pt-3 border-t border-gray-200">
                    <button
                      onClick={() => {
                        setSelectedVehicle(match.vehicle);
                        setSelectedClient(match.client);
                      }}
                      className="py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Ver Auto
                    </button>
                    <a
                      href={`https://wa.me/${match.client.phone?.replace(/[^0-9]/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-2 px-3 bg-emerald-50 hover:bg-emerald-500 text-emerald-700 rounded text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      Chat Cliente
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </>
      )}

      {/* Render matching modal */}
      {selectedVehicle && selectedClient && (
        <VehicleDetailModal
          vehicle={selectedVehicle}
          clientContext={selectedClient}
          onClose={() => {
            setSelectedVehicle(null);
            setSelectedClient(null);
          }}
        />
      )}
    </div>
  );
}
