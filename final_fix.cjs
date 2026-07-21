const fs = require('fs');
let content = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

// Insert closing div for Right Column
content = content.replace(
  '                  )}\n{/* Top Inventory Matches */}',
  '                  )}\n                </div> {/* End of Right Column */}\n{/* Top Inventory Matches */}'
);

// We need to fix the end of the file. Let's find exactly the end of Top Inventory Matches and put the right tags.
// Let's replace from "No hay coincidencias automáticas..." to the end.
const target = 'No hay coincidencias automáticas de alto score en este momento.\\n                        </div>\\n                      )}\\n                    </div>\\n                  </div>';

// Oh wait, I don't need regex for this, just use JS split.
const idx = content.lastIndexOf('No hay coincidencias automáticas');
if (idx !== -1) {
  const goodStart = content.substring(0, idx);
  // find the next closing div of Top Inventory Matches
  // It's `</div>` on 1555, then `)}` on 1556, then `</div>` on 1557, `</div>` on 1558.
  // We can just reconstruct the tail from `No hay coincidencias` onwards.
  const goodTail = `No hay coincidencias automáticas de alto score en este momento.
                        </div>
                      )}
                    </div>
                  </div> {/* End of Top Inventory Matches */}
                </div> {/* End of Seller Main Grid */}
              </div> {/* End of Seller View */}
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

fs.writeFileSync('src/pages/Dashboard.tsx', content, 'utf8');
