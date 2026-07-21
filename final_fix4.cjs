const fs = require('fs');
let content = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

const idx = content.lastIndexOf('No hay coincidencias automáticas');
if (idx !== -1) {
  const goodStart = content.substring(0, idx);
  const goodTail = `No hay coincidencias automáticas de alto score en este momento.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {selectedClient && (
        <ClientDetailModal
          client={selectedClient}
          onClose={() => setSelectedClient(null)}
          onUpdated={() => setRefreshKey(prev => prev + 1)}
        />
      )}
      <AgencyRevenueModal 
        isOpen={isRevenueModalOpen} 
        onClose={() => setIsRevenueModalOpen(false)} 
        wonContacts={wonContacts} 
        vehicles={vehicles} 
      />
    </div>
  );
}
`;
  content = goodStart + goodTail;
}

content = content.replace(/\{\/\* End of Right Column \*\/\}/g, '');
fs.writeFileSync('src/pages/Dashboard.tsx', content, 'utf8');
