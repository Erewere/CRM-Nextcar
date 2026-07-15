const fs = require('fs');
let content = fs.readFileSync('src/pages/mobile/MobilePersons.tsx', 'utf8');

const replacement = `      <div className="flex-1 overflow-y-auto px-2 py-4 pb-24 space-y-3">
        {filteredClients.map(client => (
          <div key={client.id} className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col">
            <div 
              className="p-4 cursor-pointer active:bg-slate-50 dark:active:bg-slate-700/50 transition-colors"
              onClick={() => setSelectedClient(client)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 w-full">
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold shrink-0">
                    {client.name.substring(0,2).toUpperCase()}
                  </div>
                  
                  <div className="flex flex-col overflow-hidden">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight truncate">
                      {client.name}
                    </h3>
                    {(client.vehicle || client.dealTitle) && (
                      <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400 mt-1">
                        <Car className="w-3.5 h-3.5 shrink-0" />
                        <span className="text-xs font-bold uppercase tracking-wider truncate">{client.vehicle || client.dealTitle}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            {/* Action Bar */}
            <div className="grid grid-cols-6 border-t border-slate-100 dark:border-slate-700/50">
              <a href={client.phone ? "tel:" + client.phone.replace(/\\D/g, '') : undefined} className="flex flex-col items-center justify-center py-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-blue-600 dark:text-blue-400">
                <Phone className="w-4 h-4 mb-1" />
                <span className="text-[9px] font-medium">Llamar</span>
              </a>
              <a target="_blank" rel="noreferrer" href={client.phone ? getWhatsAppLink(client.phone) : undefined} className="flex flex-col items-center justify-center py-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-[#25D366]">
                <MessageCircle className="w-4 h-4 mb-1" />
                <span className="text-[9px] font-medium">WhatsApp</span>
              </a>
              <button onClick={() => setTaskClient(client)} className="flex flex-col items-center justify-center py-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-purple-600 dark:text-purple-400">
                <Calendar className="w-4 h-4 mb-1" />
                <span className="text-[9px] font-medium">Tarea</span>
              </button>
              <button onClick={() => setStageClient(client)} className="flex flex-col items-center justify-center py-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-amber-600 dark:text-amber-400 border-x border-slate-100 dark:border-slate-700/50">
                <Activity className="w-4 h-4 mb-1" />
                <span className="text-[9px] font-medium">Etapa</span>
              </button>
              <button onClick={() => setSelectedClient(client)} className="flex flex-col items-center justify-center py-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400">
                <User className="w-4 h-4 mb-1" />
                <span className="text-[9px] font-medium">Ficha</span>
              </button>
              <button onClick={() => setHistoryClient(client)} className="flex flex-col items-center justify-center py-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 border-l border-slate-100 dark:border-slate-700/50">
                <FileText className="w-4 h-4 mb-1" />
                <span className="text-[9px] font-medium">Notas</span>
              </button>
            </div>
          </div>
        ))}
        {filteredClients.length === 0 && (
          <div className="text-center py-10 text-slate-500">
            No se encontraron contactos.
          </div>
        )}
      </div>`;

const searchStr = `      <div className="flex-1 overflow-y-auto px-2 py-4 pb-24 space-y-3">
        {filteredClients.map(client => (
          <div key={client.id} className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div 
              className="p-4 cursor-pointer active:bg-slate-50 dark:active:bg-slate-700/50 transition-colors"
              onClick={() => setSelectedClient(client)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 w-full">
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold shrink-0">
                    {client.name.substring(0,2).toUpperCase()}
                  </div>
                  
                  <div className="flex flex-col overflow-hidden">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight truncate">
                      {client.name}
                    </h3>
                    {(client.vehicle || client.dealTitle) && (
                      <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400 mt-1">
                        <Car className="w-3.5 h-3.5 shrink-0" />
                        <span className="text-xs font-bold uppercase tracking-wider truncate">{client.vehicle || client.dealTitle}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
        {filteredClients.length === 0 && (
          <div className="text-center py-10 text-slate-500">
            No se encontraron contactos.
          </div>
        )}
      </div>`;

content = content.replace(searchStr, replacement);
fs.writeFileSync('src/pages/mobile/MobilePersons.tsx', content);
console.log('Replaced list rendering');
