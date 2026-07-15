const fs = require('fs');
let content = fs.readFileSync('src/pages/Tasks.tsx', 'utf8');

// 1. Remove sync button inactive state
content = content.replace(
  `            {googleToken ? (
              <button
                onClick={handleSyncCalendar}
                disabled={isSyncing}
                className="text-[10px] font-bold text-green-600 border border-green-200 bg-green-50 hover:bg-green-100 px-2 py-0.5 rounded-full uppercase cursor-pointer transition-colors"
              >
                {isSyncing ? 'Sincronizando...' : 'Sincronización Activa (Actualizar)'}
              </button>
            ) : (
              <button
                onClick={handleSyncCalendar}
                disabled={isSyncing}
                className="text-[10px] font-bold text-red-500 border border-red-200 bg-red-50 hover:bg-red-100 px-2 py-0.5 rounded-full uppercase cursor-pointer transition-colors disabled:opacity-50"
              >
                {isSyncing ? 'Conectando...' : 'Sincronización Inactiva (Conectar)'}
              </button>
            )}`,
  `            {googleToken ? (
              <button
                onClick={handleSyncCalendar}
                disabled={isSyncing}
                className="text-[10px] font-bold text-green-600 border border-green-200 bg-green-50 hover:bg-green-100 px-2 py-0.5 rounded-full uppercase cursor-pointer transition-colors"
              >
                {isSyncing ? 'Sincronizando...' : 'Sincronización Activa (Actualizar)'}
              </button>
            ) : null}`
);

// 2. Hide filter bar on mobile
content = content.replace(
  `        {/* Action types filters */}
        <div className="flex items-center gap-3 mt-4 overflow-x-auto pb-1 text-xs font-bold scrollbar-hide">`,
  `        {/* Action types filters */}
        <div className="hidden md:flex items-center gap-3 mt-4 overflow-x-auto pb-1 text-xs font-bold scrollbar-hide">`
);

// 3. Optimize calendar grid for mobile
content = content.replace(
  `              {calendarMode === "month" && (
                <div className="overflow-x-auto flex-1">
                  <div className="min-w-[500px] h-full flex flex-col">
                    {/* Calendar Grid Header */}`,
  `              {calendarMode === "month" && (
                <div className="overflow-x-auto flex-1">
                  <div className="min-w-full md:min-w-[500px] h-full flex flex-col">
                    {/* Calendar Grid Header */}`
);

// 4. Optimize time column
content = content.replace(
  `                  {/* Time Column */}
                  <div className="w-16 shrink-0 border-r border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 sticky left-0 z-20">
                    <div className="h-16 border-b border-gray-200 dark:border-slate-700 sticky top-0 bg-gray-50 dark:bg-slate-900 z-30" />
                    {Array.from({ length: 24 }, (_, i) => (
                      <div
                        key={i}
                        className="h-24 border-b border-gray-200 dark:border-slate-700 text-[10px] text-gray-500 dark:text-slate-400 text-right pr-2 pt-1 font-medium"
                      >
                        {i.toString().padStart(2, "0")}:00
                      </div>
                    ))}
                  </div>`,
  `                  {/* Time Column */}
                  <div className="w-10 md:w-16 shrink-0 border-r border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 sticky left-0 z-20">
                    <div className="h-16 border-b border-gray-200 dark:border-slate-700 sticky top-0 bg-gray-50 dark:bg-slate-900 z-30" />
                    {Array.from({ length: 24 }, (_, i) => (
                      <div
                        key={i}
                        className="h-24 border-b border-gray-200 dark:border-slate-700 text-[10px] text-gray-500 dark:text-slate-400 text-right pr-1 md:pr-2 pt-1 font-medium leading-[1.1]"
                      >
                        {i.toString().padStart(2, "0")}
                        <span className="hidden md:inline">:00</span>
                      </div>
                    ))}
                  </div>`
);

// 5. Optimize days columns
content = content.replace(
  `                  {/* Days Columns */}
                  <div
                    className={clsx(
                      "flex-1 flex",
                      calendarMode === "week" && "min-w-[700px]",
                    )}
                  >
                    {calendarDays.map((day, i) => {
                      const dateStr = format(day, "yyyy-MM-dd");
                      const dayTasks = baseFilteredTasks.filter((t) => {
                        if (dragState && dragState.taskId === t.task.id) {
                          return dragState.currentDate === dateStr;
                        }
                        return t.task.dueDate === dateStr;
                      });

                      return (
                        <div
                          key={i}
                          className="flex-1 flex flex-col border-r border-gray-200 dark:border-slate-700 min-w-[100px]"
                        >`,
  `                  {/* Days Columns */}
                  <div
                    className={clsx(
                      "flex-1 flex",
                      calendarMode === "week" && "min-w-full md:min-w-[700px]",
                    )}
                  >
                    {calendarDays.map((day, i) => {
                      const dateStr = format(day, "yyyy-MM-dd");
                      const dayTasks = baseFilteredTasks.filter((t) => {
                        if (dragState && dragState.taskId === t.task.id) {
                          return dragState.currentDate === dateStr;
                        }
                        return t.task.dueDate === dateStr;
                      });

                      return (
                        <div
                          key={i}
                          className="flex-1 flex flex-col border-r border-gray-200 dark:border-slate-700 min-w-0 md:min-w-[100px]"
                        >`
);

// 6. Hide header controls on mobile and add FAB
content = content.replace(
  `    <div className="flex flex-col h-full bg-[#f4f5f5]">
      {/* Header and filters */}
      <div className="p-4 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">`,
  `    <div className="flex flex-col h-full bg-[#f4f5f5] relative">
      {/* FAB for mobile */}
      <button
        onClick={() => setShowNewTaskModal(true)}
        className="md:hidden fixed bottom-[80px] right-4 w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg z-50 hover:bg-blue-700 active:scale-95 transition-transform"
      >
        <span className="text-2xl font-light mb-0.5">+</span>
      </button>

      {/* Header and filters */}
      <div className="hidden md:block p-4 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">`
);

fs.writeFileSync('src/pages/Tasks.tsx', content);
console.log('Patched Tasks.tsx');
