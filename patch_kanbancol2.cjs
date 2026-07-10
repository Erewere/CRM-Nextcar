const fs = require('fs');
let code = fs.readFileSync('src/components/KanbanColumn.tsx', 'utf8');

code = code.replace(
  `import { GripHorizontal, ChevronLeft, ChevronRight } from "lucide-react";`,
  `import { GripHorizontal, ChevronLeft, ChevronRight, Plus } from "lucide-react";`
);

code = code.replace(
  `  isFirst?: boolean;
  isLast?: boolean;
}`,
  `  isFirst?: boolean;
  isLast?: boolean;
  onAddRight?: () => void;
  autoFocusEdit?: boolean;
}`
);

code = code.replace(
  `  isFirst,
  isLast,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);`,
  `  isFirst,
  isLast,
  onAddRight,
  autoFocusEdit,
}: Props) {
  const [isEditing, setIsEditing] = useState(autoFocusEdit || false);`
);

// We need to make sure autoFocusEdit triggers the input focus even if it was just created.
// We can use a useEffect to watch for autoFocusEdit.
code = code.replace(
  `  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);`,
  `  useEffect(() => {
    if (autoFocusEdit) {
      setIsEditing(true);
    }
  }, [autoFocusEdit]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);`
);

// Now for the + button and adding 'group' class to the column container
code = code.replace(
  `    <div className="flex w-[85vw] md:w-[270px] snap-center md:snap-align-none flex-col shrink-0 border-r border-slate-200 dark:border-slate-700/70 bg-[#F8FAFC] dark:bg-[#0f172a] relative transition-colors h-full">`,
  `    <div className="group flex w-[85vw] md:w-[270px] snap-center md:snap-align-none flex-col shrink-0 border-r border-slate-200 dark:border-slate-700/70 bg-[#F8FAFC] dark:bg-[#0f172a] relative transition-colors h-full">`
);

// And we want the Add button between columns
code = code.replace(
  `          <div className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300 shadow-sm ml-2 shrink-0">
            {clients.length}
          </div>
        </div>`,
  `          <div className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300 shadow-sm ml-2 shrink-0">
            {clients.length}
          </div>
        </div>
        
        {onAddRight && (
          <div className="absolute top-1/2 -right-3 -translate-y-1/2 z-10 opacity-0 group-hover:opacity-100 transition-opacity hidden md:block">
            <button
              onClick={onAddRight}
              className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-md hover:bg-blue-600 hover:scale-110 transition-transform"
              title="Añadir etapa aquí"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        )}`
);

fs.writeFileSync('src/components/KanbanColumn.tsx', code);
