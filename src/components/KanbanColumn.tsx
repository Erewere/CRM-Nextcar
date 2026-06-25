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
    <div className="flex w-[85vw] md:w-[270px] snap-center md:snap-align-none flex-col h-full shrink-0 border-r border-slate-200 dark:border-slate-700/70 bg-[#F8FAFC] dark:bg-[#0f172a] relative transition-colors">
      <div
        className={clsx(
          "flex flex-col px-4 py-3 shrink-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 relative",
        )}
      >
        <div className="absolute top-0 left-0 h-[3px] w-full bg-gradient-to-r from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600">
          {isWon && <div className="h-full bg-gradient-to-r from-emerald-400 to-green-500 w-full" />}
          {isLost && <div className="h-full bg-gradient-to-r from-rose-400 to-red-500 w-full" />}
          {isNew && <div className="h-full bg-gradient-to-r from-blue-400 to-indigo-500 w-full" />}
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[14px] font-bold text-slate-800 dark:text-slate-100">
            {column.title}
          </span>
          <div className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300 shadow-sm">
            {clients.length}
          </div>
        </div>
        <span className="text-[12px] font-medium text-slate-500 dark:text-slate-400 mt-1">
          {clients.length} trato{clients.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={clsx(
          "flex-1 overflow-y-auto p-3 flex flex-col gap-3 min-h-[150px] transition-all duration-300",
          isOver
            ? "bg-blue-50/50 dark:bg-blue-900/20 ring-2 ring-inset ring-blue-400 dark:ring-blue-500/50 shadow-inner"
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
