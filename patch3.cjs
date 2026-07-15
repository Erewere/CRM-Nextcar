const fs = require('fs');
let content = fs.readFileSync('src/pages/Tasks.tsx', 'utf8');

content = content.replace(
  `              {/* Calendar Controls */}
              <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900">`,
  `              {/* Calendar Controls */}
              <div className="flex items-center justify-between p-1.5 md:p-3 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900">`
);

content = content.replace(
  `                <div className="font-bold text-gray-800 dark:text-slate-200 text-sm capitalize">
                  {calendarMode === "day"`,
  `                <div className="font-bold text-gray-800 dark:text-slate-200 text-[10px] md:text-sm capitalize truncate max-w-[120px] md:max-w-none text-right">
                  {calendarMode === "day"`
);

content = content.replace(
  `                          {/* Day Header */}
                          <div className="h-16 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 sticky top-0 z-10 flex flex-col items-center justify-center shrink-0">`,
  `                          {/* Day Header */}
                          <div className="h-12 md:h-16 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 sticky top-0 z-10 flex flex-col items-center justify-center shrink-0">`
);

content = content.replace(
  `                            <span className="text-[10px] uppercase text-gray-500 dark:text-slate-400 font-bold mb-1">
                              {format(day, "eee", { locale: es })}
                            </span>
                            <span
                              className={clsx(
                                "text-lg font-bold w-8 h-8 flex items-center justify-center rounded-full",`,
  `                            <span className="text-[8px] md:text-[10px] uppercase text-gray-500 dark:text-slate-400 font-bold mb-0.5 md:mb-1">
                              {format(day, "eee", { locale: es })}
                            </span>
                            <span
                              className={clsx(
                                "text-sm md:text-lg font-bold w-6 h-6 md:w-8 md:h-8 flex items-center justify-center rounded-full",`
);

fs.writeFileSync('src/pages/Tasks.tsx', content);
console.log('Patched Tasks.tsx for spacing');
