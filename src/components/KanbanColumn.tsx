import React from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Client } from "../types";
import { SortableClientCard } from "./ClientCard";
import clsx from "clsx";

interface Props {
  column: { id: string; title: string };
  clients: Client[];
  onClientClick: (client: Client) => void;
  tasks?: { clientId: string; dueDate: string; completed: boolean }[];
  key?: React.Key;
}

export function KanbanColumn({
  column,
  clients,
  onClientClick,
  tasks = [],
}: Props) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  });

  const lowerTitle = String(column.title || "").toLowerCase();
  const isWon =
    column.id === "won" ||
    lowerTitle.includes("ganad") ||
    lowerTitle.includes("vendid");
  const isLost = column.id === "lost" || lowerTitle.includes("perdid");
  const isNew = column.id === "new" || lowerTitle.includes("nuev");

  return (
    <div className="flex w-[85vw] md:w-[270px] snap-center md:snap-align-none flex-col h-full shrink-0 border-r border-slate-200 dark:border-slate-700/70 bg-[#F3F4F6] relative">
      <div
        className={clsx(
          "flex flex-col px-3 py-3 shrink-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 relative",
        )}
      >
        <div className="absolute bottom-0 left-0 h-[2px] w-full bg-slate-200">
          {isWon && <div className="h-full bg-green-500 w-full" />}
          {isLost && <div className="h-full bg-red-400 w-full" />}
          {isNew && <div className="h-full bg-blue-400 w-full" />}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-bold text-slate-800 dark:text-slate-200">
            {column.title}
          </span>
          {/* Progress circle mock */}
          <div className="w-4 h-4 rounded-full border-2 border-slate-200 dark:border-slate-700 border-t-green-500 transform rotate-45"></div>
        </div>
        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1">
          {clients.length} trato{clients.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={clsx(
          "flex-1 overflow-y-auto p-2 flex flex-col gap-2 min-h-[150px] transition-all duration-300 rounded-b-lg",
          isOver
            ? "bg-blue-50/80 ring-2 ring-inset ring-blue-400 shadow-inner scale-[1.01]"
            : "",
        )}
      >
        <SortableContext
          id={column.id}
          items={clients.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          {clients.map((client) => (
            <SortableClientCard
              key={client.id}
              client={client}
              onClick={() => onClientClick(client)}
              tasks={tasks.filter((t) => t.clientId === client.id)}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}
