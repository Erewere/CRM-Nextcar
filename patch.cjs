const fs = require('fs');
let code = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');
code = code.replace(
  /<div className="flex flex-wrap items-center gap-3 bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">[\s\S]*?<div className="flex items-center gap-2 pl-2 border-r border-slate-200 dark:border-slate-700 pr-3">[\s\S]*?<Filter className="w-4 h-4 text-slate-400" \/>[\s\S]*?<span className="text-sm font-semibold text-slate-600 dark:text-slate-400">[\s\S]*?Filtros[\s\S]*?<\/span>[\s\S]*?<\/div>/,
  '<div className="flex flex-wrap items-center justify-start xl:justify-end gap-3 w-full xl:w-auto">'
);
fs.writeFileSync('src/pages/Dashboard.tsx', code);
