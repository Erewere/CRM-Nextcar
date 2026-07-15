const fs = require('fs');
let content = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

const targetStr = `              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <FunnelChart>
                    <Tooltip
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Funnel
                      dataKey="value"
                      data={funnelData}
                      isAnimationActive
                    >
                      {funnelData.map((entry, index) => (
                        <Cell key={\`cell-\${index}\`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Funnel>
                  </FunnelChart>
                </ResponsiveContainer>
              </div>
            </div>`;
            
const replacementStr = `              <div className="flex flex-col gap-6">
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <FunnelChart>
                      <Tooltip
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      />
                      <Funnel
                        dataKey="value"
                        data={funnelData}
                        isAnimationActive
                      >
                        {funnelData.map((entry, index) => (
                          <Cell key={\`cell-\${index}\`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Funnel>
                    </FunnelChart>
                  </ResponsiveContainer>
                </div>
                
                {buscanAutoClients.length > 0 && (
                  <div className="border-t border-slate-100 dark:border-slate-700 pt-4">
                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                      <Car className="w-4 h-4 text-indigo-500" />
                      Vehículos Buscados
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {buscanAutoClients.slice(0, 6).map(client => (
                        <div key={client.id} className="bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800 rounded-lg p-3 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors cursor-pointer" onClick={() => setSelectedClient(client)}>
                          <p className="text-[11px] font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider truncate mb-1">
                            {client.vehicle || client.dealTitle || "Auto no especificado"}
                          </p>
                          <div className="flex items-center gap-1.5">
                            <div className="w-4 h-4 rounded-full bg-indigo-200 dark:bg-indigo-800 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-[9px] font-bold">
                              {client.name.substring(0,1).toUpperCase()}
                            </div>
                            <span className="text-xs text-slate-600 dark:text-slate-400 truncate font-medium">{client.name}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>`;

if (content.includes(targetStr)) {
  content = content.replace(targetStr, replacementStr);
  fs.writeFileSync('src/pages/Dashboard.tsx', content);
  console.log('Fixed funnel chart and added sought vehicles');
} else {
  console.log('Target string not found');
}
