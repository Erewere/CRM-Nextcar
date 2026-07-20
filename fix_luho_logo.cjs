const fs = require('fs');

const svgCode = `
import React, { useState } from "react";
import clsx from "clsx";

interface Props {
  className?: string;
  variant?: "icon" | "full" | "light-full";
  size?: "sm" | "md" | "lg" | "xl" | "auto";
}

export function LuhoLogo({ className, variant = "full", size = "auto" }: Props) {
  const [imageError, setImageError] = useState(false);

  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-16 w-16",
    xl: "h-24 w-24",
    auto: "h-full w-full",
  };

  const isIconOnly = variant === "icon";
  const isLight = variant === "light-full";
  const darkNavy = "currentColor";
  const blueColor = "#004AAD";

  // Intentamos cargar la imagen subida
  if (!imageError) {
    return (
      <div className={clsx("flex items-center justify-center select-none", sizeClasses[size], className)}>
        <img 
          src={isIconOnly ? "/luho-icon.png" : "/luho-logo.png"} 
          alt="LUHO CRM" 
          className="w-full h-full object-contain"
          onError={() => setImageError(true)}
        />
      </div>
    );
  }

  // Fallback al SVG si la imagen no se encuentra
  if (isIconOnly) {
    return (
      <div className={clsx("flex items-center justify-center select-none text-[#0B132B] dark:text-white", sizeClasses[size], className)}>
        <svg
          viewBox="0 0 300 150"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full object-contain"
          preserveAspectRatio="xMidYMid meet"
        >
          <g transform="translate(0, 30) scale(1.2)">
            <path d="M 40 66 C 70 52, 110 40, 155 40 C 200 40, 240 48, 285 66 C 240 50, 200 44, 155 44 C 105 44, 70 54, 40 66 Z" fill={darkNavy} />
            <path d="M 40 66 C 60 62, 80 62, 100 66 C 75 66, 50 72, 38 78 C 50 72, 60 70, 70 70 C 60 70, 50 68, 40 66 Z" fill={darkNavy} />
            <path d="M 100 54 C 130 47, 170 47, 205 52 C 225 55, 235 60, 245 66 L 95 66 C 98 60, 105 57, 100 54 Z" fill={darkNavy} />
          </g>
        </svg>
      </div>
    );
  }

  return (
    <div className={clsx("flex items-center justify-center select-none text-[#0B132B] dark:text-white", sizeClasses[size], className)}>
      <svg
        viewBox="0 0 300 150"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full object-contain"
        preserveAspectRatio="xMidYMid meet"
      >
        <g>
          <path d="M 40 66 C 70 52, 110 40, 155 40 C 200 40, 240 48, 285 66 C 240 50, 200 44, 155 44 C 105 44, 70 54, 40 66 Z" fill={darkNavy} />
          <path d="M 40 66 C 60 62, 80 62, 100 66 C 75 66, 50 72, 38 78 C 50 72, 60 70, 70 70 C 60 70, 50 68, 40 66 Z" fill={darkNavy} />
          <path d="M 100 54 C 130 47, 170 47, 205 52 C 225 55, 235 60, 245 66 L 95 66 C 98 60, 105 57, 100 54 Z" fill={darkNavy} />
        </g>
        <g transform="translate(150, 105)">
          <text x="-4" y="0" textAnchor="end" fontFamily="Arial, system-ui, sans-serif" fontWeight="900" fontSize="46" letterSpacing="1" fill={darkNavy}>LU</text>
          <text x="4" y="0" textAnchor="start" fontFamily="Arial, system-ui, sans-serif" fontWeight="900" fontSize="46" letterSpacing="1" fill={blueColor}>HO</text>
        </g>
        <g transform="translate(150, 128)">
          <line x1="-110" y1="-5" x2="-35" y2="-5" stroke={darkNavy} strokeWidth="2"/>
          <text x="0" y="0" textAnchor="middle" fontFamily="Arial, system-ui, sans-serif" fontWeight="700" fontSize="14" letterSpacing="6" fill={darkNavy}>CRM</text>
          <line x1="32" y1="-5" x2="110" y2="-5" stroke={darkNavy} strokeWidth="2"/>
        </g>
      </svg>
    </div>
  );
}
`;

fs.writeFileSync('src/components/LuhoLogo.tsx', svgCode, 'utf8');
