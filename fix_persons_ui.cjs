const fs = require('fs');
let code = fs.readFileSync('src/pages/Persons.tsx', 'utf8');

// Inject match checking in grid view:
const gridMatchCalc = `            {filteredPersons.map((person) => {
              const matches = getClientMatches(person, vehicles);
              return (
              <div
                key={person.id}`;

code = code.replace(/            \{filteredPersons\.map\(\(person\) => \(\n              <div\n                key=\{person\.id\}/, gridMatchCalc);

const gridMatchDisplay = `                    {person.phone && (
                      <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-slate-400 mt-1">
                        <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">{person.phone}</span>
                      </div>
                    )}
                    {matches.length > 0 && (
                      <div className="mt-2">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-[10px] font-bold border border-green-200 dark:border-green-800/50 uppercase tracking-wider">
                          {matches.length} {matches.length === 1 ? 'Posible Match' : 'Posibles Matches'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )})}
          </div>`;

code = code.replace(/                    \{person\.phone && \(\n                      <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-slate-400 mt-1">\n                        <Phone className="w-3\.5 h-3\.5 flex-shrink-0" \/>\n                        <span className="truncate">\{person\.phone\}<\/span>\n                      <\/div>\n                    \)\}\n                  <\/div>\n                <\/div>\n              <\/div>\n            \)\}\)\n          <\/div>/, gridMatchDisplay);

// Inject match checking in list view
const listMatchDisplay = `                        if (col.id === "vehicle") {
                          const matches = getClientMatches(person, vehicles);
                          val = (
                            <div className="flex flex-col gap-1 items-start justify-center min-h-[32px]">
                              <span className="truncate">{person.vehicle || person.dealTitle || "-"}</span>
                              {matches.length > 0 && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-[10px] font-bold border border-green-200 dark:border-green-800/50 uppercase tracking-wider">
                                  {matches.length} {matches.length === 1 ? 'Match' : 'Matches'}
                                </span>
                              )}
                            </div>
                          );
                        }`;

code = code.replace(/                        if \(col\.id === "vehicle"\)\n                          val = person\.vehicle \|\| person\.dealTitle \|\| "";/, listMatchDisplay);

fs.writeFileSync('src/pages/Persons.tsx', code);
