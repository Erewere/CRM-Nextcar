import React, { useState, useRef, useEffect } from "react";
import { X, Check } from "lucide-react";
import clsx from "clsx";

export function TimeSelect({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const timeOptions = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      const period = h < 12 ? "a.m." : "p.m.";
      const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const displayM = m === 0 ? "00" : m;
      const val = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
      const label = `${displayH}:${displayM} ${period.padStart(4, " ")}`;
      timeOptions.push({ value: val, label });
    }
  }

  const selectedOption = timeOptions.find((o) => o.value === value);

  useEffect(() => {
    if (isOpen && containerRef.current) {
      const activeEl = containerRef.current.querySelector(
        ".active-time-option",
      ) as HTMLElement;
      const dropdownEl = containerRef.current.querySelector(
        ".overflow-y-auto",
      ) as HTMLElement;
      if (activeEl && dropdownEl) {
        const elTop = activeEl.offsetTop;
        const elHeight = activeEl.offsetHeight;
        const dropdownHeight = dropdownEl.offsetHeight;
        dropdownEl.scrollTop = elTop - dropdownHeight / 2 + elHeight / 2;
      }
    }
  }, [isOpen]);

  return (
    <div className="relative" ref={containerRef}>
      <div
        className={clsx(
          "flex items-center justify-between border rounded p-1.5 text-sm w-[130px] bg-white dark:bg-slate-800 cursor-pointer transition-colors",
          isOpen
            ? "border-blue-500 ring-1 ring-blue-500"
            : "border-gray-300 hover:border-gray-400",
        )}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span
          className={clsx(
            selectedOption
              ? "text-gray-900 dark:text-slate-100"
              : "text-gray-400",
          )}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        {selectedOption ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
            className="text-gray-400 hover:text-gray-600 dark:text-slate-400 focus:outline-none"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : (
          <div className="w-3.5 h-3.5" />
        )}
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-[140px] max-h-[350px] overflow-y-auto bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded shadow-lg z-50 py-1">
          {timeOptions.map((option) => {
            const isActive = value === option.value;
            return (
              <div
                key={option.value}
                className={clsx(
                  "px-3 py-2 text-sm cursor-pointer flex justify-between items-center transition-colors",
                  isActive
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white active-time-option"
                    : "text-gray-700 dark:text-slate-300 hover:bg-blue-50 hover:text-blue-600",
                )}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
              >
                {option.label}
                {isActive && <Check className="w-4 h-4 ml-2 flex-shrink-0" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
