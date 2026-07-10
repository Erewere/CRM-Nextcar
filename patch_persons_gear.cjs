const fs = require('fs');
let code = fs.readFileSync('src/pages/Persons.tsx', 'utf8');

code = code.replace(
  `                  {showColSettings && (
                    <div className="absolute right-0 top-full mt-1 w-64 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded shadow-lg p-2 z-50">
                      <div className="text-xs font-bold text-gray-500 dark:text-slate-400 mb-2 uppercase px-2">`,
  `                  {showColSettings && (
                    <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowColSettings(false)} />
                    <div className="absolute right-0 top-full mt-1 w-64 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded shadow-lg p-2 z-50">
                      <div className="text-xs font-bold text-gray-500 dark:text-slate-400 mb-2 uppercase px-2">`
);

code = code.replace(
  `                        </label>
                      ))}
                    </div>
                  )}`,
  `                        </label>
                      ))}
                    </div>
                    </>
                  )}`
);

fs.writeFileSync('src/pages/Persons.tsx', code);
