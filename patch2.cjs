const fs = require('fs');
let content = fs.readFileSync('src/pages/Tasks.tsx', 'utf8');

// Revert the hidden md:block on the main header
content = content.replace(
  `      {/* Header and filters */}
      <div className="hidden md:block p-4 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">`,
  `      {/* Header and filters */}
      <div className="p-2 md:p-4 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">`
);

// We will hide just the filters and extra buttons on mobile
content = content.replace(
  `        {/* Controls bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">`,
  `        {/* Controls bar */}
        <div className="flex items-center justify-between gap-4">`
);

content = content.replace(
  `            <div
              onClick={() => setShowNewTaskModal(true)}
              className="flex items-center p-0.5 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded text-sm font-semibold cursor-pointer hover:bg-green-700 shadow-sm shrink-0"
            >`,
  `            <div
              onClick={() => setShowNewTaskModal(true)}
              className="hidden md:flex items-center p-0.5 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded text-sm font-semibold cursor-pointer hover:bg-green-700 shadow-sm shrink-0"
            >`
);

content = content.replace(
  `          <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <span className="text-xs font-semibold text-gray-500 dark:text-slate-400">`,
  `          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden md:inline text-xs font-semibold text-gray-500 dark:text-slate-400">`
);

fs.writeFileSync('src/pages/Tasks.tsx', content);
console.log('Patched Tasks.tsx again');
