const fs = require('fs');
let content = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

const targetStr = `          <div className="grid grid-cols-2 gap-4">
            <Link to="/persons" className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-center">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Total Prospectos</p>
              <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100">{filteredClients.length}</h2>
            </Link>
            <Link to="/kanban" className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-center">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Activos</p>
              <h2 className="text-2xl font-black text-blue-600 dark:text-blue-400">{activeContacts.length}</h2>
            </Link>
            <Link to="/closed-sales" className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-center">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Ventas Cerradas</p>
              <h2 className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{wonContacts.length}</h2>
            </Link>
            <Link to="/closed-sales" className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-center">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Ingresos</p>
              <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(totalWonAmount)}
              </h2>
            </Link>
          </div>
        </>`;
        
const replacementStr = `          <div className="grid grid-cols-2 gap-4">
            <Link to="/persons" className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-center">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Total Prospectos</p>
              <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100">{filteredClients.length}</h2>
            </Link>
            <Link to="/kanban" className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-center">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Activos</p>
              <h2 className="text-2xl font-black text-blue-600 dark:text-blue-400">{activeContacts.length}</h2>
            </Link>
            <Link to="/closed-sales" className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-center">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Ventas Cerradas</p>
              <h2 className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{wonContacts.length}</h2>
            </Link>
            <Link to="/closed-sales" className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-center">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Ingresos</p>
              <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(totalWonAmount)}
              </h2>
            </Link>
          </div>
          
          {buscanAutoClients.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 mt-4">
              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                <Car className="w-4 h-4 text-indigo-500" />
                Vehículos Buscados
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
        </>`;

if (content.includes(targetStr)) {
  content = content.replace(targetStr, replacementStr);
  fs.writeFileSync('src/pages/Dashboard.tsx', content);
  console.log('Fixed mobile dashboard vehicles');
} else {
  console.log('Target string not found');
}
