const fs = require('fs');

let content = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

const returnStartMarker = '  return (\n    <div className="space-y-4 pb-8">';
const startIdx = content.indexOf(returnStartMarker);

if (startIdx === -1) {
  console.log('Return not found');
  process.exit(1);
}

const replacement = `  return (
    <div className="space-y-4 pb-8">
      {/* AI Advisor Panel */}
      <AiAdvisorPanel 
        userName={userData?.name || userData?.email || "Asesor"}
        agencyId={userData?.agencyId || ''}
        activeContacts={activeContacts}
        tasks={tasks}
        pipelineStages={pipelineStages}
      />

      {isMobile ? (
        <div className="flex border-b border-gray-200 dark:border-slate-700 mb-6 mt-4">
          <button
            onClick={() => {
              const today = new Date().toISOString().split("T")[0];
              setFilterStartDate(today);
              setFilterEndDate(today);
              setActiveDateFilter("today");
            }}
            className={\`py-2 px-4 border-b-2 font-medium text-sm transition-colors \${
              activeDateFilter === "today"
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200"
            }\`}
          >
            Hoy
          </button>
          <button
            onClick={() => {
              const date = new Date();
              date.setDate(date.getDate() - date.getDay() + 1); // Monday
              const start = date.toISOString().split("T")[0];
              const end = new Date().toISOString().split("T")[0];
              setFilterStartDate(start);
              setFilterEndDate(end);
              setActiveDateFilter("week");
            }}
            className={\`py-2 px-4 border-b-2 font-medium text-sm transition-colors \${
              activeDateFilter === "week"
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200"
            }\`}
          >
            Esta Semana
          </button>
          <button
            onClick={() => {
              const date = new Date();
              const start = new Date(date.getFullYear(), date.getMonth(), 1)
                .toISOString()
                .split("T")[0];
              const end = new Date().toISOString().split("T")[0];
              setFilterStartDate(start);
              setFilterEndDate(end);
              setActiveDateFilter("month");
            }}
            className={\`py-2 px-4 border-b-2 font-medium text-sm transition-colors \${
              activeDateFilter === "month"
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200"
            }\`}
          >
            Este Mes
          </button>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 w-full bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex flex-wrap gap-2 items-center w-full lg:w-auto">
            <div className="flex items-center gap-2 pr-3 border-r border-slate-200 dark:border-slate-700 hidden sm:flex">
              <Filter className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                Filtros
              </span>
            </div>
            <button
              onClick={() => {
                const today = new Date().toISOString().split("T")[0];
                setFilterStartDate(today);
                setFilterEndDate(today);
                setActiveDateFilter("today");
              }}
              className={\`text-xs font-medium px-3 py-1.5 rounded-full transition-colors \${
                activeDateFilter === "today"
                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20"
                  : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300"
              }\`}
            >
              Hoy
            </button>
            <button
              onClick={() => {
                const date = new Date();
                date.setDate(date.getDate() - date.getDay() + 1); // Monday
                const start = date.toISOString().split("T")[0];
                const end = new Date().toISOString().split("T")[0];
                setFilterStartDate(start);
                setFilterEndDate(end);
                setActiveDateFilter("week");
              }}
              className={\`text-xs font-medium px-3 py-1.5 rounded-full transition-colors \${
                activeDateFilter === "week"
                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20"
                  : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300"
              }\`}
            >
              Esta Semana
            </button>
            <button
              onClick={() => {
                const date = new Date();
                const start = new Date(date.getFullYear(), date.getMonth(), 1)
                  .toISOString()
                  .split("T")[0];
                const end = new Date().toISOString().split("T")[0];
                setFilterStartDate(start);
                setFilterEndDate(end);
                setActiveDateFilter("month");
              }}
              className={\`text-xs font-medium px-3 py-1.5 rounded-full transition-colors \${
                activeDateFilter === "month"
                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20"
                  : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300"
              }\`}
            >
              Este Mes
            </button>
            <button
              onClick={() => {
                setFilterStartDate("");
                setFilterEndDate("");
                setActiveDateFilter("all");
              }}
              className={\`text-xs font-medium px-3 py-1.5 rounded-full transition-colors \${
                activeDateFilter === "all"
                  ? "bg-gradient-to-r from-slate-600 to-slate-700 text-white shadow-md"
                  : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300"
              }\`}
            >
              Todos
            </button>
          </div>
        </div>
      )}

      {isMobile ? (
        <>
          {/* Mobile Action Center */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col overflow-hidden">
            <div className="p-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                Centro de Atención
              </h3>
            </div>
            <div className="p-4 grid grid-cols-2 gap-3">
              <Link to="/tasks" className="flex flex-col gap-1 justify-between p-3 rounded-lg bg-rose-50 border border-rose-100 hover:bg-rose-100 transition-colors">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-500" />
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight">Atrasadas</p>
                </div>
                <span className="text-rose-600 font-black text-lg">{overdueTasks.length}</span>
              </Link>
              <Link to="/tasks" className="flex flex-col gap-1 justify-between p-3 rounded-lg bg-blue-50 border border-blue-100 hover:bg-blue-100 transition-colors">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-500" />
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight">Para Hoy</p>
                </div>
                <span className="text-blue-600 font-black text-lg">{todayTasks.length}</span>
              </Link>
              <Link to="/tasks" className="flex flex-col gap-1 justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight">Esta Sem.</p>
                </div>
                <span className="text-slate-600 dark:text-slate-400 font-black text-lg">{thisWeekTasks.length}</span>
              </Link>
              {allClientMatches > 0 && (
                <Link to="/persons" className="flex flex-col gap-1 justify-between p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition-colors">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-emerald-500" />
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight">Matches</p>
                  </div>
                  <span className="text-emerald-600 font-black text-lg">{allClientMatches}</span>
                </Link>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
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
        </>
      ) : (
        <>
          {/* Desktop Layout */}
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

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <Filter className="w-5 h-5 text-blue-600" />
                  Embudo de Ventas
                </h3>
              </div>
              <div className="h-[300px]">
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
            </div>
            
            <div className="lg:col-span-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col overflow-hidden">
              <div className="p-5 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  Centro de Atención
                </h3>
              </div>
              <div className="p-5 flex flex-col gap-4">
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
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Alertas Inactividad</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Sin atención (&#62;{inactivityAlertDays}d)</p>
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
                          Matches Inventario
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
        </>
      )}

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
console.log('Restored Desktop Dashboard correctly');
