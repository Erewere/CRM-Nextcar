const fs = require('fs');
let content = fs.readFileSync('src/components/NewActivityModal.tsx', 'utf8');

content = content.replace(
  `        {/* Footer */}
        <div className="px-4 md:px-6 py-4 border-t border-gray-200 dark:border-slate-700 flex flex-col md:flex-row justify-between items-stretch md:items-center bg-gray-50 dark:bg-slate-900 gap-4 mt-auto">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 md:gap-4">
            <button className="hidden md:block p-2 border border-gray-300 rounded hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-600 dark:text-slate-400">
              <Settings className="w-5 h-5" />
            </button>
            <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={syncToCalendar}
                onChange={(e) => setSyncToCalendar(e.target.checked)}
                className="w-4 h-4 shrink-0 rounded border-gray-300 dark:border-slate-600 dark:bg-slate-700 bg-white dark:checked:bg-blue-500 text-blue-600 focus:ring-blue-500"
              />
              <CalendarIcon className="w-4 h-4 shrink-0" /> 
              <span className="truncate">Sincronizar con Google (Calendar / Tasks)</span>
            </label>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 md:gap-4">
            <label className="flex items-center justify-start gap-2 cursor-pointer text-sm font-medium text-gray-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={completed}
                onChange={(e) => setCompleted(e.target.checked)}
                className="w-4 h-4 shrink-0 rounded border-gray-300 dark:border-slate-600 dark:bg-slate-700 bg-white dark:checked:bg-blue-500 text-green-600 focus:ring-green-500"
              />
              Marcar como completa
            </label>
            <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
              <button
                onClick={onClose}
                className="flex-1 sm:flex-none px-4 py-2.5 sm:py-2 border border-gray-300 rounded font-bold text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 text-sm text-center"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  const existingDeal = deals.find(
                    (d) =>
                      String(d.title || "").toLowerCase() ===
                      dealTitle.toLowerCase(),
                  );
                  onSave({
                    title,
                    type,
                    dueDate: date,
                    startTime,
                    endTime,
                    clientId,
                    clientName,
                    clientStatus,
                    dealId: existingDeal?.id || "",
                    dealTitle,
                    organization,
                    notes,
                    completed,
                    syncToCalendar,
                  });
                }}
                className="flex-1 sm:flex-none px-4 py-2.5 sm:py-2 bg-[#2E914F] hover:bg-[#257A41] text-white rounded font-bold text-sm text-center"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>`,
  `        {/* Footer */}
        <div className="px-4 py-4 md:px-6 md:py-4 border-t border-gray-200 dark:border-slate-700 flex flex-col md:flex-row justify-between items-stretch md:items-center bg-gray-50 dark:bg-slate-900 gap-4 shrink-0">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 md:gap-4">
            <button className="hidden md:block p-2 border border-gray-300 rounded hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-600 dark:text-slate-400 shrink-0">
              <Settings className="w-5 h-5" />
            </button>
            <label className="flex items-start md:items-center gap-2.5 cursor-pointer text-xs md:text-sm font-medium text-gray-700 dark:text-slate-300 whitespace-normal leading-tight">
              <input
                type="checkbox"
                checked={syncToCalendar}
                onChange={(e) => setSyncToCalendar(e.target.checked)}
                className="w-4 h-4 mt-0.5 md:mt-0 shrink-0 rounded border-gray-300 dark:border-slate-600 dark:bg-slate-700 bg-white dark:checked:bg-blue-500 text-blue-600 focus:ring-blue-500"
              />
              <div className="flex flex-col md:flex-row md:items-center gap-1.5 md:gap-2">
                <CalendarIcon className="w-4 h-4 hidden md:block shrink-0" /> 
                <span className="flex-1">Sincronizar con Google (Calendar / Tasks)</span>
              </div>
            </label>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            <label className="flex items-center justify-start gap-2.5 cursor-pointer text-sm font-medium text-gray-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={completed}
                onChange={(e) => setCompleted(e.target.checked)}
                className="w-4 h-4 shrink-0 rounded border-gray-300 dark:border-slate-600 dark:bg-slate-700 bg-white dark:checked:bg-blue-500 text-green-600 focus:ring-green-500"
              />
              Marcar como completa
            </label>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={onClose}
                className="flex-1 sm:flex-none px-4 py-2.5 sm:py-2 border border-gray-300 rounded font-bold text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 text-sm text-center"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  const existingDeal = deals.find(
                    (d) =>
                      String(d.title || "").toLowerCase() ===
                      dealTitle.toLowerCase(),
                  );
                  onSave({
                    title,
                    type,
                    dueDate: date,
                    startTime,
                    endTime,
                    clientId,
                    clientName,
                    clientStatus,
                    dealId: existingDeal?.id || "",
                    dealTitle,
                    organization,
                    notes,
                    completed,
                    syncToCalendar,
                  });
                }}
                className="flex-1 sm:flex-none px-4 py-2.5 sm:py-2 bg-[#2E914F] hover:bg-[#257A41] text-white rounded font-bold text-sm text-center"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>`
);

fs.writeFileSync('src/components/NewActivityModal.tsx', content);
console.log('Fixed mobile layout of footer in NewActivityModal.tsx again');
