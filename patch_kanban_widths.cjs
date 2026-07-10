const fs = require('fs');

let kanbanCol = fs.readFileSync('src/components/KanbanColumn.tsx', 'utf8');
kanbanCol = kanbanCol.replace(
  `    <div className="group flex w-[85vw] md:w-[270px] snap-center md:snap-align-none flex-col shrink-0 border-r border-slate-200 dark:border-slate-700/70 bg-[#F8FAFC] dark:bg-[#0f172a] relative transition-colors h-full">`,
  `    <div className="group flex w-full h-full flex-col shrink-0 border-r border-slate-200 dark:border-slate-700/70 bg-[#F8FAFC] dark:bg-[#0f172a] relative transition-colors">`
);
fs.writeFileSync('src/components/KanbanColumn.tsx', kanbanCol);

let sortableCol = fs.readFileSync('src/components/SortableKanbanColumn.tsx', 'utf8');
sortableCol = sortableCol.replace(
  `  return (
    <div ref={setNodeRef} style={style} className="flex h-full flex-col shrink-0 relative">`,
  `  return (
    <div ref={setNodeRef} style={style} className="flex h-full flex-col shrink-0 md:shrink md:flex-1 md:min-w-[150px] md:max-w-xs relative w-[85vw] md:w-0 snap-center md:snap-align-none">`
);
fs.writeFileSync('src/components/SortableKanbanColumn.tsx', sortableCol);
