const fs = require('fs');
let code = fs.readFileSync('src/components/KanbanColumn.tsx', 'utf8');

code = code.replace(
  `import { SortableClientCard } from "./ClientCard";
import clsx from "clsx";

interface Props {`,
  `import { SortableClientCard } from "./ClientCard";
import clsx from "clsx";
import { GripHorizontal, ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useRef, useEffect } from "react";

interface Props {`
);

code = code.replace(
  `  key?: React.Key;
}`,
  `  key?: React.Key;
  dragHandleProps?: any;
  onTitleChange?: (newTitle: string) => void;
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
}`
);

code = code.replace(
  `export function KanbanColumn({
  column,
  clients,
  onClientClick,
  tasks = [],
}: Props) {`,
  `export function KanbanColumn({
  column,
  clients,
  onClientClick,
  tasks = [],
  dragHandleProps,
  onTitleChange,
  onMoveLeft,
  onMoveRight,
  isFirst,
  isLast,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(column.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleTitleSubmit = () => {
    if (editValue.trim() && editValue !== column.title && onTitleChange) {
      onTitleChange(editValue.trim());
    } else {
      setEditValue(column.title);
    }
    setIsEditing(false);
  };
`
);

code = code.replace(
  `        <div className="flex items-center justify-between mt-1">
          <span className="text-[14px] font-bold text-slate-800 dark:text-slate-100">
            {column.title}
          </span>
          <div className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300 shadow-sm">
            {clients.length}
          </div>
        </div>`,
  `        <div className="flex items-center justify-between mt-1">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {dragHandleProps && (
              <button {...dragHandleProps} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-grab active:cursor-grabbing hidden md:block" title="Arrastrar etapa">
                <GripHorizontal className="w-4 h-4" />
              </button>
            )}
            
            {/* Mobile Arrows */}
            {onMoveLeft && onMoveRight && (
              <div className="flex items-center md:hidden gap-1 bg-slate-100 dark:bg-slate-700 rounded-md">
                <button onClick={onMoveLeft} disabled={isFirst} className={clsx("p-1", isFirst ? "text-slate-300 dark:text-slate-600" : "text-slate-500 dark:text-slate-300")}>
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button onClick={onMoveRight} disabled={isLast} className={clsx("p-1", isLast ? "text-slate-300 dark:text-slate-600" : "text-slate-500 dark:text-slate-300")}>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {isEditing ? (
              <input
                ref={inputRef}
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={handleTitleSubmit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleTitleSubmit();
                  if (e.key === 'Escape') {
                    setEditValue(column.title);
                    setIsEditing(false);
                  }
                }}
                className="text-[14px] font-bold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800 border border-blue-500 rounded px-1 w-full"
              />
            ) : (
              <span 
                className="text-[14px] font-bold text-slate-800 dark:text-slate-100 truncate cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
                onClick={() => setIsEditing(true)}
                title="Haz clic para editar"
              >
                {column.title}
              </span>
            )}
          </div>
          
          <div className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300 shadow-sm ml-2 shrink-0">
            {clients.length}
          </div>
        </div>`
);

fs.writeFileSync('src/components/KanbanColumn.tsx', code);
