import React, { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { KanbanColumn } from "./KanbanColumn";
import { Client } from "../types";
import { GripHorizontal, ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  column: { id: string; title: string };
  clients: Client[];
  onClientClick: (client: Client) => void;
  tasks?: { clientId: string; dueDate: string; completed: boolean }[];
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
  onTitleChange?: (newTitle: string) => void;
  isFirst?: boolean;
  isLast?: boolean;
  key?: React.Key;
  onAddRight?: () => void;
  autoFocusEdit?: boolean;
}

export function SortableKanbanColumn(props: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `col-${props.column.id}`,
    data: {
      type: "Column",
      column: props.column,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex h-full flex-col shrink-0 md:shrink md:flex-1 md:min-w-[150px] relative w-[85vw] md:w-0 snap-center md:snap-align-none group">
      <KanbanColumn
        {...props}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}
