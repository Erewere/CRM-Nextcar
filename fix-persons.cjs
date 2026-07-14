const fs = require('fs');
let code = fs.readFileSync('src/pages/mobile/MobilePersons.tsx', 'utf8');

const target = `                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight mb-1">
                    {client.name}
                  </h3>
                  <p className="text-xs text-slate-500">{client.email || "Sin email"}</p>
                </div>
                {/* Visual Status Indicator or Deal Stage could go here */}
              </div>
            </div>
            
            <div className="grid grid-cols-2 divide-x divide-slate-100 dark:divide-slate-700 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
              <a 
                href={client.phone ? \\\`tel:\\\${client.phone.replace(/\\\\D/g, '')}\\\` : undefined}
                className={\\\`flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors \\\${client.phone ? 'text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30' : 'text-slate-400 pointer-events-none'}\\\`}
                onClick={(e) => e.stopPropagation()}
              >
                <Phone className="w-4 h-4" />
                Llamar
              </a>
              <a 
                href={client.phone ? getWhatsAppLink(client.phone) : undefined}
                target="_blank"
                rel="noopener noreferrer"
                className={\\\`flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors \\\${client.phone ? 'text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/30' : 'text-slate-400 pointer-events-none'}\\\`}
                onClick={(e) => e.stopPropagation()}
              >
                <MessageCircle className="w-4 h-4" />
                WhatsApp
              </a>
            </div>`;

const replacement = `                <div className="flex items-center gap-3 w-full">
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold shrink-0">
                    {client.name.substring(0,2).toUpperCase()}
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight truncate">
                    {client.name}
                  </h3>
                </div>
              </div>
            </div>`;

code = code.replace(target, replacement);
fs.writeFileSync('src/pages/mobile/MobilePersons.tsx', code);
