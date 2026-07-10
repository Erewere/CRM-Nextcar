const fs = require('fs');

let sortableCol = fs.readFileSync('src/components/SortableKanbanColumn.tsx', 'utf8');
sortableCol = sortableCol.replace(
  `className="flex h-full flex-col shrink-0 md:shrink md:flex-1 md:min-w-[150px] md:max-w-xs relative w-[85vw] md:w-0 snap-center md:snap-align-none"`,
  `className="flex h-full flex-col shrink-0 md:shrink md:flex-1 md:min-w-[100px] relative w-[85vw] md:w-0 snap-center md:snap-align-none group"`
);
fs.writeFileSync('src/components/SortableKanbanColumn.tsx', sortableCol);
