import React from "react";
import clsx from "clsx";

// El logo de Nextcar: un velocimetro con la aguja en rojo.
//
// Hasta el rediseño de septiembre de 2026 esto no era un logo, era texto con
// estilos --"NEXTCAR" en negro, "CRM" en rojo, y un cuadrito con las letras
// "NC"--. Ahora el dibujo es de verdad.
//
// El icono va como SVG escrito aqui y no como archivo, por dos razones: pesa
// menos que una peticion, y la aguja queda suelta para poder animarla (ver
// `animado`). El lockup completo si va como imagen, porque lleva incrustada la
// tipografia Manrope del diseño y no queremos depender de cargar una fuente.

interface Props {
  className?: string;
  variant?: "icon" | "full" | "light-full" | "horizontal";
  size?: "sm" | "md" | "lg" | "xl" | "auto";
  /** La aguja barre, como el tablero de un coche al encender. Para las esperas. */
  animado?: boolean;
}

/**
 * El icono solo: cuadro redondeado oscuro, arco blanco, aguja roja.
 *
 * El pivote esta en (24, 34): cualquier giro de la aguja tiene que ser
 * alrededor de ese punto o se despega del centro.
 */
export function NextcarIcono({ className, animado = false }: { className?: string; animado?: boolean }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} role="img" aria-label="Nextcar">
      <rect width="48" height="48" rx="11" fill="#0F0F10" />
      <path d="M9 34a15 15 0 1 1 30 0" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" />
      <path
        d="M14 28.25 16.6 29.75M24 22.5V25.5M34 28.25 31.4 29.75"
        stroke="#FFFFFF"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <polygon
        points="25.1,34.8 22.9,33.3 31.3,23.7"
        fill="#D6402A"
        className={animado ? "nextcar-aguja" : undefined}
      />
      <circle cx="24" cy="34" r="2.8" fill="#FFFFFF" />
    </svg>
  );
}

/**
 * La marca sola, sin el cuadro de fondo: el arco toma el color del texto que la
 * rodea y la aguja se queda roja, que es la regla del diseño.
 *
 * Para acompañar texto o sustituir un icono suelto. El cuadro oscuro de
 * `NextcarIcono` se ve como una manchita por debajo de unos 24 px.
 */
export function NextcarMarca({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 30" fill="none" className={className} role="img" aria-label="Nextcar">
      <path d="M3 27a21 21 0 1 1 42 0" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <path
        d="M9.7 18.75 13.2 20.75M24 10.5V14.5M38.3 18.75 34.8 20.75"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <polygon points="25.23,27.86 22.77,26.14 32.6,14.7" fill="#D6402A" />
      <circle cx="24" cy="27" r="3.2" fill="currentColor" />
    </svg>
  );
}

export function NextcarLogo({ className, variant = "full", size = "auto", animado = false }: Props) {
  const alturaIcono = {
    sm: "h-7 w-7",
    md: "h-9 w-9",
    lg: "h-11 w-11",
    xl: "h-14 w-14",
    auto: "h-9 w-9",
  }[size];

  if (variant === "icon") {
    return <NextcarIcono className={clsx(alturaIcono, "shrink-0", className)} animado={animado} />;
  }

  // Dos archivos en vez de uno: la tipografia toma el color que contrasta con el
  // fondo, asi que el lockup claro se lee mal en modo oscuro y al reves.
  return (
    <>
      <img
        src="/logo/lockup-claro.png"
        alt="Nextcar CRM"
        className={clsx("object-contain select-none shrink-0 dark:hidden", className)}
      />
      <img
        src="/logo/lockup-oscuro.png"
        alt="Nextcar CRM"
        className={clsx("object-contain select-none shrink-0 hidden dark:block", className)}
      />
    </>
  );
}
