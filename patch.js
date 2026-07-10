const fs = require('fs');
let code = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');
code = code.replace(
  `          </div>

          <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="flex items-center gap-2 pl-2 border-r border-slate-200 dark:border-slate-700 pr-3">
              <Filter className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                Filtros
              </span>
            </div>
            
            {userData?.role === "admin" && (`,
  `          </div>

          <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
            
            {userData?.role === "admin" && (`
);
fs.writeFileSync('src/pages/Dashboard.tsx', code);
