const fs = require('fs');
let code = fs.readFileSync('src/components/ClientDetailModal.tsx', 'utf8');

const search = `                  {(formData.wantedVehicle?.make || formData.tags?.some(t => t.toLowerCase().includes('busca de auto') || t.toLowerCase().includes('compra'))) && (
                    <button
                      type="button"
                      onClick={() => setShowWantedVehicleMenu(true)}
                      className="mt-3 w-full text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 py-1.5 rounded transition-colors"
                    >
                      Ver / Editar Búsqueda de Auto
                    </button>
                  )}`;

const replace = `                  {(formData.wantedVehicle?.make || formData.tags?.some(t => t.toLowerCase().includes('busca de auto') || t.toLowerCase().includes('compra'))) && (
                    <div className="mt-3 flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => setShowWantedVehicleMenu(true)}
                        className="w-full text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-800/50 py-1.5 rounded transition-colors"
                      >
                        Ver / Editar Búsqueda de Auto
                      </button>
                      
                      {(() => {
                        if (!formData.wantedVehicle) return null;
                        const matches = getClientMatches(formData as Client, inventoryVehicles);
                        if (matches.length === 0) return null;
                        
                        return (
                          <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50 rounded-lg shadow-sm">
                            <h4 className="text-xs font-bold text-green-800 dark:text-green-300 mb-2 flex items-center gap-1.5">
                              <Target className="w-3.5 h-3.5" />
                              Posibles Matches en Inventario ({matches.length})
                            </h4>
                            <div className="flex flex-col gap-1.5 max-h-[150px] overflow-y-auto pr-1">
                              {matches.map((m, idx) => (
                                <div key={m.vehicle.id || idx} className="flex flex-col p-2 bg-white dark:bg-slate-800 rounded border border-green-100 dark:border-green-800/30 text-xs">
                                  <div className="flex justify-between items-start mb-1">
                                    <span className="font-bold text-slate-800 dark:text-slate-200">
                                      {m.vehicle.year} {m.vehicle.make} {m.vehicle.model}
                                    </span>
                                    <span className="font-semibold text-green-700 dark:text-green-400">
                                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(m.vehicle.price)}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className={\`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded \${
                                      m.level === 'exact' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300' :
                                      m.level === 'high' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300' :
                                      m.level === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300' :
                                      'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300'
                                    }\`}>
                                      {m.level === 'exact' ? 'Exacto' : m.level === 'high' ? 'Muy Similar' : m.level === 'medium' ? 'Similar' : 'Posible'}
                                    </span>
                                    <span className="text-gray-500 dark:text-slate-400 truncate">
                                      VIN: {m.vehicle.vin}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}`;

code = code.replace(search, replace);
fs.writeFileSync('src/components/ClientDetailModal.tsx', code);
