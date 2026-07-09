const fs = require('fs');
let code = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

const regex = /\{userData\?\.role === "admin" && \(\s*<select[\s\S]*?Limpiar Filtros\s*<\/button>\s*\)\}\s*<\/div>\s*<\/div>\s*<\/div>/;

const dashboardWidgets = `
      {/* END FILTERS */}
      </div>
      </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-center">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Total Prospectos</p>
          <div className="flex items-baseline gap-2">
            <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100">{filteredClients.length}</h2>
          </div>
        </div>
        
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-center relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Target className="w-16 h-16 text-blue-500" />
          </div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1 relative z-10">Activos (En Pipeline)</p>
          <div className="flex items-baseline gap-2 relative z-10">
            <h2 className="text-3xl font-black text-blue-600 dark:text-blue-400">{activeContacts.length}</h2>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-center">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Ventas Cerradas</p>
          <div className="flex items-baseline gap-2">
            <h2 className="text-3xl font-black text-emerald-600 dark:text-emerald-400">{wonContacts.length}</h2>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-center">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Ingresos (Ventas)</p>
          <div className="flex items-baseline gap-2">
            <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100">
              {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(totalWonAmount)}
            </h2>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col min-h-[350px]">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-6">
            Embudo de Ventas (Pipeline)
          </h3>
          {pipelineData.length > 0 ? (
            <div className="flex-1 w-full h-full min-h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pipelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} dy={10} />
                  <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {pipelineData.map((entry, index) => {
                      const isActive = selectedStage === entry.id || !selectedStage;
                      return (
                        <Cell
                          key={\`cell-\${index}\`}
                          fill={isActive ? COLORS[index % COLORS.length] : '#cbd5e1'}
                          className="cursor-pointer transition-all duration-300 hover:opacity-80"
                          onClick={() => setSelectedStage(selectedStage === entry.id ? null : entry.id)}
                        />
                      );
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
             <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
                No hay oportunidades activas para mostrar.
             </div>
          )}
        </div>

        {/* Action Center (Tasks & Alerts) */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col overflow-hidden">
          <div className="p-5 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600" />
              Centro de Atención
            </h3>
          </div>
          <div className="p-5 flex-1 space-y-4">
            <Link to="/tasks" className="block flex items-center justify-between p-3 rounded-lg bg-rose-50 border border-rose-100 hover:bg-rose-100 transition-colors">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-rose-500" />
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Tareas Atrasadas</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Requieren atención urgente</p>
                </div>
              </div>
              <span className="text-rose-600 font-black text-xl">{overdueTasks.length}</span>
            </Link>

            <Link to="/tasks" className="block flex items-center justify-between p-3 rounded-lg bg-blue-50 border border-blue-100 hover:bg-blue-100 transition-colors">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-blue-500" />
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Para Hoy</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Actividades programadas</p>
                </div>
              </div>
              <span className="text-blue-600 font-black text-xl">{todayTasks.length}</span>
            </Link>

            <Link to="/tasks" className="block flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
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
              <Link to="/users" className="block flex items-center justify-between p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 hover:bg-orange-100 transition-colors">
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
                className="block flex items-center justify-between p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
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
      </div>
`;

if (code.match(regex)) {
  const replacement = code.match(regex)[0] + dashboardWidgets;
  code = code.replace(regex, replacement);
  fs.writeFileSync('src/pages/Dashboard.tsx', code);
  console.log("Successfully rebuilt dashboard layout");
} else {
  console.log("Regex did not match");
}
