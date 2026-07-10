const fs = require('fs');
let code = fs.readFileSync('src/pages/Tasks.tsx', 'utf8');

code = code.replace(
  `                <button
                  onClick={() => setShowColumnSettings(!showColumnSettings)}
                  className="flex items-center justify-center p-1.5 border border-gray-300 rounded hover:bg-gray-50 dark:bg-slate-900 shadow-sm text-gray-700 dark:text-slate-300"
                >
                  <Settings className="w-4 h-4" />
                </button>
                {showColumnSettings && (
                  <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowColumnSettings(false)} />
                  <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-gray-200 dark:border-slate-700 z-50 p-3 text-sm">`,
  `                <div className="relative">
                  <button
                    onClick={() => setShowColumnSettings(!showColumnSettings)}
                    className="flex items-center justify-center p-1.5 border border-gray-300 rounded hover:bg-gray-50 dark:bg-slate-900 shadow-sm text-gray-700 dark:text-slate-300"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                  {showColumnSettings && (
                    <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowColumnSettings(false)} />
                    <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-gray-200 dark:border-slate-700 z-50 p-3 text-sm">`
);

code = code.replace(
  `                      ))}
                    </div>
                  </div>
                  </>
                )}`,
  `                      ))}
                    </div>
                  </div>
                  </>
                )}
                </div>`
);

fs.writeFileSync('src/pages/Tasks.tsx', code);
