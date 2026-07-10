const fs = require('fs');
let code = fs.readFileSync('src/components/SortableKanbanColumn.tsx', 'utf8');

code = code.replace(
  `  onTitleChange?: (newTitle: string) => void;
  isFirst?: boolean;
  isLast?: boolean;
  key?: React.Key;
}`,
  `  onTitleChange?: (newTitle: string) => void;
  isFirst?: boolean;
  isLast?: boolean;
  key?: React.Key;
  onAddRight?: () => void;
  autoFocusEdit?: boolean;
}`
);

fs.writeFileSync('src/components/SortableKanbanColumn.tsx', code);
