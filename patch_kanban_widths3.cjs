const fs = require('fs');

let sortableCol = fs.readFileSync('src/components/SortableKanbanColumn.tsx', 'utf8');
sortableCol = sortableCol.replace(
  `md:min-w-[100px]`,
  `md:min-w-[120px]`
);
fs.writeFileSync('src/components/SortableKanbanColumn.tsx', sortableCol);
