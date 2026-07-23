import React from "react";
import clsx from "clsx";

interface Props {
  className?: string;
  variant?: "icon" | "full" | "light-full" | "horizontal";
  size?: "sm" | "md" | "lg" | "xl" | "auto";
}

export function NextcarLogo({ className, variant = "full", size = "auto" }: Props) {
  const sizeClasses = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-xl",
    xl: "text-2xl",
    auto: "",
  };

  if (variant === "icon") {
    return (
      <div
        className={clsx(
          "flex items-center justify-center font-black tracking-tighter select-none shrink-0",
          "h-9 w-9 rounded-lg bg-slate-900 dark:bg-slate-800 text-white shadow-sm border border-slate-800 dark:border-slate-700",
          className
        )}
      >
        <span className="text-red-600 font-black text-base">N</span>
        <span className="text-white font-black text-base">C</span>
      </div>
    );
  }

  return (
    <div
      className={clsx(
        "flex items-baseline gap-1.5 font-black tracking-tight select-none shrink-0 whitespace-nowrap",
        sizeClasses[size],
        className
      )}
    >
      <span className="text-slate-900 dark:text-white font-black uppercase text-xl tracking-wider">
        NEXTCAR
      </span>
      <span className="text-red-600 font-black uppercase text-xl tracking-wider">
        CRM
      </span>
    </div>
  );
}
