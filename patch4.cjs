const fs = require('fs');
let content = fs.readFileSync('src/pages/Tasks.tsx', 'utf8');

content = content.replace(
  `        {/* Right Sidebar */}
        {showRightSidebar ? (
          <div className="w-80 shrink-0 border-l border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col overflow-hidden transition-all duration-300">`,
  `        {/* Right Sidebar */}
        {showRightSidebar ? (
          <div className="hidden md:flex w-80 shrink-0 border-l border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex-col overflow-hidden transition-all duration-300">`
);

content = content.replace(
  `            )}
          </div>
        ) : (
          <div
            className="w-12 shrink-0 border-l border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 flex flex-col items-center py-4 transition-all duration-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800 border-l-4 border-l-blue-500"
            onClick={() => setShowRightSidebar(true)}`,
  `            )}
          </div>
        ) : (
          <div
            className="hidden md:flex w-12 shrink-0 border-l border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 flex-col items-center py-4 transition-all duration-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800 border-l-4 border-l-blue-500"
            onClick={() => setShowRightSidebar(true)}`
);

fs.writeFileSync('src/pages/Tasks.tsx', content);
console.log('Patched Tasks.tsx right sidebar visibility');
