import React from "react";
import clsx from "clsx";

interface Props {
  className?: string;
  variant?: "icon" | "full" | "light-full";
  size?: "sm" | "md" | "lg" | "xl" | "auto";
}

export function NextcarLogo({ className, variant = "full", size = "auto" }: Props) {
  // Size classes mapping
  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-16 w-16",
    xl: "h-24 w-24",
    auto: "h-full w-full",
  };

  const isIconOnly = variant === "icon";

  // Center vertically based on layout type
  const dy = isIconOnly ? 8 : -4;

  const y1 = 24 + dy; // 32 for icon, 20 for full
  const y2 = 60 + dy; // 68 for icon, 56 for full
  const y3 = 34 + dy; // 42 for icon, 30 for full
  const y4 = 50 + dy; // 58 for icon, 46 for full
  const y5 = 42 + dy; // 50 for icon, 38 for full

  // Futuristic, perfectly parallel slanted vector paths
  const leftBarPath = `M 0 ${y1} L 12 ${y1} L 22 ${y2} L 10 ${y2} Z`;

  const mainBodyPath = `M 16 ${y1} L 28 ${y1} L 38 ${y2} L 50 ${y2} L 76 ${y2} A 18 18 0 0 0 94 ${y5} A 18 18 0 0 0 76 ${y1} L 62 ${y1} L 50 ${y1} L 26 ${y2} Z M 62 ${y3} L 76 ${y3} A 8 8 0 0 1 84 ${y5} A 8 8 0 0 1 76 ${y4} L 62 ${y4} Z M 28 ${y1} L 50 ${y1} L 38 ${y2} Z`;

  const redBlockPath = `M 88 ${y1} L 100 ${y1} L 90 ${y3} L 78 ${y3} Z`;

  return (
    <div className={clsx("flex items-center justify-center select-none", sizeClasses[size], className)}>
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full object-contain"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {/* High-fidelity 3D metallic chrome gradient */}
          <linearGradient id="chromeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="20%" stopColor="#E2E8F0" />
            <stop offset="40%" stopColor="#94A3B8" />
            <stop offset="60%" stopColor="#F8FAFC" />
            <stop offset="85%" stopColor="#475569" />
            <stop offset="100%" stopColor="#CBD5E1" />
          </linearGradient>

          {/* Glowing crimson red gradient for the accent mark */}
          <linearGradient id="redGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#EF4444" />
            <stop offset="55%" stopColor="#DC2626" />
            <stop offset="100%" stopColor="#991B1B" />
          </linearGradient>
          
          {/* Subtle drop shadow for 3D depth */}
          <filter id="logoShadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000000" floodOpacity="0.5" />
          </filter>
        </defs>

        {/* --- NC Symbol --- */}
        <g filter="url(#logoShadow)">
          {/* Left slanted bar */}
          <path d={leftBarPath} fill="url(#chromeGradient)" />
          
          {/* Main body with C cutout and N triangle cutout */}
          <path d={mainBodyPath} fill="url(#chromeGradient)" fillRule="evenodd" />

          {/* Slanted red accent block */}
          <path d={redBlockPath} fill="url(#redGradient)" />
        </g>

        {/* --- Text Content (Hidden if variant is 'icon') --- */}
        {!isIconOnly && (
          <g>
            {/* NEXTCAR TEXT */}
            <text
              x="50"
              y="78"
              textAnchor="middle"
              fontFamily="'Inter', 'Space Grotesk', sans-serif"
              fontSize="12.5"
              fontWeight="900"
              letterSpacing="2.5"
            >
              <tspan fill={variant === "light-full" ? "#1E293B" : "#F8FAFC"}>NEXT</tspan>
              <tspan fill="url(#redGradient)">CAR</tspan>
            </text>
            
            {/* CRM subtitle with flanking lines */}
            <text
              x="50"
              y="91"
              textAnchor="middle"
              fill="#64748B"
              fontFamily="'JetBrains Mono', monospace"
              fontSize="6.5"
              fontWeight="700"
              letterSpacing="3"
            >
              CRM
            </text>
            
            {/* Left line */}
            <line
              x1="12"
              y1="89"
              x2="38"
              y2="89"
              stroke={variant === "light-full" ? "#CBD5E1" : "#334155"}
              strokeWidth="0.75"
            />
            {/* Right line */}
            <line
              x1="62"
              y1="89"
              x2="88"
              y2="89"
              stroke={variant === "light-full" ? "#CBD5E1" : "#334155"}
              strokeWidth="0.75"
            />
          </g>
        )}
      </svg>
    </div>
  );
}
