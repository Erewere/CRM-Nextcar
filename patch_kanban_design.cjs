const fs = require('fs');

// Patch KanbanColumn.tsx
let kanbanCol = fs.readFileSync('src/components/KanbanColumn.tsx', 'utf8');
kanbanCol = kanbanCol.replace(
  `    <div className="group flex w-full h-full flex-col shrink-0 border-r border-slate-200 dark:border-slate-700/70 bg-[#F8FAFC] dark:bg-[#0f172a] relative transition-colors">`,
  `    <div className="flex w-full h-full flex-col shrink-0 border-r border-slate-200 dark:border-slate-700/70 bg-[#F8FAFC] dark:bg-[#0f172a] relative transition-colors">`
);

kanbanCol = kanbanCol.replace(
  `      <div
        className={clsx(
          "flex flex-col px-4 py-3 shrink-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 relative",
        )}
      >`,
  `      <div
        className={clsx(
          "group/header flex flex-col px-4 py-3 shrink-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 relative",
        )}
      >`
);

kanbanCol = kanbanCol.replace(
  `        {onAddRight && (
          <div className="absolute top-1/2 -right-3 -translate-y-1/2 z-10 opacity-0 group-hover:opacity-100 transition-opacity hidden md:block">`,
  `        {onAddRight && (
          <div className="absolute top-1/2 -right-3 -translate-y-1/2 z-10 opacity-0 group-hover/header:opacity-100 transition-opacity hidden md:block">`
);

fs.writeFileSync('src/components/KanbanColumn.tsx', kanbanCol);

// Patch ClientCard.tsx
let clientCard = fs.readFileSync('src/components/ClientCard.tsx', 'utf8');
clientCard = clientCard.replace(
  `      className={clsx(
        "group bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm transition-all hover:shadow-md cursor-grab active:cursor-grabbing text-left relative overflow-hidden",
        client.origin === 'whatsapp' && "border-l-4 border-l-green-400"
      )}
    >
      {/* Activity indicator border top (optional, could be dynamically colored based on tasks) */}
      <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-blue-500 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />`,
  `      className={clsx(
        "group bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] hover:-translate-y-1 hover:bg-white/60 dark:hover:bg-slate-800/60 hover:backdrop-blur-xl cursor-grab active:cursor-grabbing text-left relative overflow-hidden",
        client.origin === 'whatsapp' && "border-l-4 border-l-green-400"
      )}
    >
      {/* Modern water-drop / glass highlight effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-400/0 via-blue-300/5 to-indigo-400/10 dark:from-blue-500/0 dark:via-blue-400/5 dark:to-indigo-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none mix-blend-overlay" />
      <div className="absolute -inset-full top-0 left-0 bg-gradient-to-r from-transparent via-white/20 to-transparent dark:via-white/5 opacity-0 group-hover:opacity-100 group-hover:-translate-x-full duration-1000 transition-all ease-out pointer-events-none" />`
);
fs.writeFileSync('src/components/ClientCard.tsx', clientCard);

