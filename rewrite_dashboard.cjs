const fs = require('fs');

let content = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

// Find the line with {/* Action Center (Tasks & Alerts) */}
const startMarker = '        {/* Action Center (Tasks & Alerts) */}';
const startIdx = content.indexOf(startMarker);
if (startIdx === -1) {
  console.log('not found'); process.exit(1);
}

const replacement = `        {/* Action Center (Tasks & Alerts) */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col overflow-hidden">
          <div className="p-5 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600" />
              Centro de Atención
            </h3>
          </div>
          <div className="p-5 grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4">
            <Link to="/tasks" className="flex flex-col gap-2 justify-between p-4 rounded-lg bg-rose-50 border border-rose-100 hover:bg-rose-100 transition-colors h-full">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-rose-500" />
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Tareas Atrasadas</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Requieren atención urgente</p>
                </div>
              </div>
              <span className="text-rose-600 font-black text-xl">{overdueTasks.length}</span>
            </Link>

            <Link to="/tasks" className="flex flex-col gap-2 justify-between p-4 rounded-lg bg-blue-50 border border-blue-100 hover:bg-blue-100 transition-colors h-full">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-blue-500" />
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Para Hoy</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Actividades programadas</p>
                </div>
              </div>
              <span className="text-blue-600 font-black text-xl">{todayTasks.length}</span>
            </Link>

            <Link to="/tasks" className="flex flex-col gap-2 justify-between p-4 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors h-full">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Esta Semana</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Tareas futuras próximas</p>
                </div>
              </div>
              <span className="text-slate-600 dark:text-slate-400 font-black text-xl">{thisWeekTasks.length}</span>
            </Link>

            {userData?.role === "admin" && inactiveAlerts.length > 0 && (
              <Link to="/users" className="flex flex-col gap-2 justify-between p-4 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 hover:bg-orange-100 transition-colors h-full">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-orange-500" />
                  <div>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Alertas de Inactividad</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Clientes sin atención (&#62;{inactivityAlertDays}d)</p>
                  </div>
                </div>
                <span className="text-orange-600 font-black text-xl">{inactiveAlerts.length}</span>
              </Link>
            )}

            {allClientMatches > 0 && (
              <Link
                to="/persons"
                className="flex flex-col gap-2 justify-between p-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors h-full"
              >
                <div className="flex items-center gap-3">
                  <Target className="w-5 h-5 text-emerald-500" />
                  <div>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      Matches de Inventario
                    </p>
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                      Posibles coincidencias
                    </p>
                  </div>
                </div>
                <span className="text-emerald-600 font-black text-xl">
                  {allClientMatches}
                </span>
              </Link>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Link to="/persons" className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-center hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition-all cursor-pointer group">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">Total Prospectos</p>
            <div className="flex items-baseline gap-2">
              <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100 group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors">{filteredClients.length}</h2>
            </div>
          </Link>
          
          <Link to="/kanban" className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-center relative overflow-hidden hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition-all cursor-pointer group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 group-hover:scale-110 transition-all">
              <Target className="w-16 h-16 text-blue-500" />
            </div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1 relative z-10 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">Activos (En Pipeline)</p>
            <div className="flex items-baseline gap-2 relative z-10">
              <h2 className="text-3xl font-black text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors">{activeContacts.length}</h2>
            </div>
          </Link>

          <Link to="/closed-sales" className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-center hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-700 transition-all cursor-pointer group">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">Ventas Cerradas</p>
            <div className="flex items-baseline gap-2">
              <h2 className="text-3xl font-black text-emerald-600 dark:text-emerald-400 group-hover:text-emerald-700 dark:group-hover:text-emerald-300 transition-colors">{wonContacts.length}</h2>
            </div>
          </Link>

          <Link to="/closed-sales" className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-center hover:shadow-md hover:border-slate-400 dark:hover:border-slate-600 transition-all cursor-pointer group">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1 group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors">Ingresos (Ventas)</p>
            <div className="flex items-baseline gap-2">
              <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(totalWonAmount)}
              </h2>
            </div>
          </Link>
        </div>
      </div>

      {selectedClient && (
        <ClientDetailModal
          client={selectedClient}
          onClose={() => setSelectedClient(null)}
        />
      )}
    </div>
  );
}
`;

content = content.substring(0, startIdx) + replacement;
fs.writeFileSync('src/pages/Dashboard.tsx', content);
console.log('Fixed dashboard layout entirely');
