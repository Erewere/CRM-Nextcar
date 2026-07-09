const fs = require('fs');
let code = fs.readFileSync('src/pages/Persons.tsx', 'utf8');

const regex = /                    \{person\.phone && \(\s*<div className="flex items-center gap-1 text-sm text-gray-500 dark:text-slate-400 mt-1">\s*<Phone className="w-3\.5 h-3\.5 flex-shrink-0" \/>\s*<span className="truncate">\{person\.phone\}<\/span>\s*<\/div>\s*\)\}\s*<\/div>\s*<\/div>\s*<\/div>\s*\)\}\)\s*<\/div>/g;

const matchDisplay = `                    {person.phone && (
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
            );})}
          </div>`;

code = code.replace(regex, matchDisplay);
fs.writeFileSync('src/pages/Persons.tsx', code);
