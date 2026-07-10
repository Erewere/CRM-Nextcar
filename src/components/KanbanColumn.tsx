import React from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Client } from "../types";
import { SortableClientCard } from "./ClientCard";
import clsx from "clsx";
import { GripHorizontal, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useState, useRef, useEffect } from "react";

interface Props {
  column: { id: string; title: string };
  clients: Client[];
  onClientClick: (client: Client) => void;
  tasks?: { clientId: string; dueDate: string; completed: boolean }[];
  key?: React.Key;
  dragHandleProps?: any;
  onTitleChange?: (newTitle: string) => void;
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
  onAddRight?: () => void;
  autoFocusEdit?: boolean;
}

export function KanbanColumn({
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
  onAddRight,
  autoFocusEdit,
}: Props) {
  const [isEditing, setIsEditing] = useState(autoFocusEdit || false);
  const [editValue, setEditValue] = useState(column.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocusEdit) {
      setIsEditing(true);
    }
  }, [autoFocusEdit]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
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

  const totalValue = clients.reduce((acc, client) => acc + (Number(client.dealValue) || 0), 0);
  const formattedValue = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(totalValue);

  return (
    <div className="flex w-full h-full flex-col shrink-0 border-r border-slate-200 dark:border-slate-700/70 bg-[#F8FAFC] dark:bg-[#0f172a] relative transition-colors">
      <div
        className={clsx(
          "group/header flex flex-col px-4 py-3 shrink-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 relative",
        )}
      >
        <div className="absolute top-0 left-0 h-[3px] w-full bg-gradient-to-r from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600">
          {isWon && <div className="h-full bg-gradient-to-r from-emerald-400 to-green-500 w-full" />}
          {isLost && <div className="h-full bg-gradient-to-r from-rose-400 to-red-500 w-full" />}
          {isNew && <div className="h-full bg-gradient-to-r from-blue-400 to-indigo-500 w-full" />}
        </div>
        <div className="flex flex-wrap items-center justify-between mt-1 gap-x-2">
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
        </div>
        
        {onAddRight && (
          <div className="absolute top-1/2 -right-3 -translate-y-1/2 z-10 opacity-0 group-hover/header:opacity-100 transition-opacity hidden md:block">
            <button
              onClick={onAddRight}
              className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-md hover:bg-blue-600 hover:scale-110 transition-transform"
              title="Añadir etapa aquí"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between mt-1 gap-x-2">
          <span className="text-[12px] font-medium text-slate-500 dark:text-slate-400">
            {clients.length} contacto{clients.length !== 1 ? "s" : ""}
          </span>
          {totalValue > 0 && (
            <span className="text-[12px] font-semibold text-emerald-600 dark:text-emerald-400">
              {formattedValue}
            </span>
          )}
        </div>
      </div>

      <div
        ref={setNodeRef}
        className={clsx(
          "flex-1 p-3 flex flex-col gap-3 min-h-[150px] transition-all duration-300",
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
          {clients.map((client) => {
            return (
              <SortableClientCard
                key={client.id}
                client={client}
                onClick={() => onClientClick(client)}
                tasks={tasks.filter((t) => t.clientId === client.id)}
              />
            );
          })}
        </SortableContext>
      </div>
    </div>
  );
}
