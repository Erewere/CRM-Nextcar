import { Moon, Sun, Sunrise, Sunset } from "lucide-react";

/** Saludo según la hora del aparato: días, tardes o noches, con su sol o su luna. */
export function saludoDelDia(ahora = new Date()) {
  const h = ahora.getHours();
  if (h >= 5 && h < 12) return { texto: "Buenos días", Icono: h < 8 ? Sunrise : Sun, color: "text-amber-400" };
  if (h >= 12 && h < 18) return { texto: "Buenas tardes", Icono: Sun, color: "text-amber-400" };
  if (h >= 18 && h < 20) return { texto: "Buenas tardes", Icono: Sunset, color: "text-orange-400" };
  return { texto: "Buenas noches", Icono: Moon, color: "text-indigo-300" };
}

export function SaludoDelDia({ nombre, className = "", tam = "text-xl" }: { nombre?: string; className?: string; tam?: string }) {
  const s = saludoDelDia();
  const primero = String(nombre || "").trim().split(/\s+/)[0];
  return (
    <span className={`inline-flex items-center gap-2 font-extrabold tracking-tight ${tam} ${className}`}>
      <s.Icono className={`w-[1.1em] h-[1.1em] shrink-0 ${s.color}`} aria-hidden />
      {s.texto}{primero ? `, ${primero}` : ""}
    </span>
  );
}
