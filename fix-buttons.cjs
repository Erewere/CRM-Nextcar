const fs = require('fs');
let code = fs.readFileSync('src/pages/Persons.tsx', 'utf8');

code = code.replace(
  'className="flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-rose-100 text-rose-700 rounded font-semibold hover:bg-rose-200 shadow-sm text-xs md:text-sm"',
  'className="hidden md:flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-rose-100 text-rose-700 rounded font-semibold hover:bg-rose-200 shadow-sm text-xs md:text-sm"'
);

code = code.replace(
  'className="flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-white dark:bg-slate-800 border border-gray-300 text-gray-700 dark:text-slate-300 rounded font-semibold hover:bg-gray-50 dark:bg-slate-900 shadow-sm text-xs md:text-sm cursor-pointer"',
  'className="hidden md:flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-white dark:bg-slate-800 border border-gray-300 text-gray-700 dark:text-slate-300 rounded font-semibold hover:bg-gray-50 dark:bg-slate-900 shadow-sm text-xs md:text-sm cursor-pointer"'
);

code = code.replace(
  'className="flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-white dark:bg-slate-800 border border-gray-300 text-gray-700 dark:text-slate-300 rounded font-semibold hover:bg-gray-50 dark:bg-slate-900 shadow-sm text-xs md:text-sm"',
  'className="hidden md:flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-white dark:bg-slate-800 border border-gray-300 text-gray-700 dark:text-slate-300 rounded font-semibold hover:bg-gray-50 dark:bg-slate-900 shadow-sm text-xs md:text-sm"'
);

fs.writeFileSync('src/pages/Persons.tsx', code);
