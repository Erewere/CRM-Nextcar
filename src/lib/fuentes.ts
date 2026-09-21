/**
 * ¿Como llego el cliente?
 *
 * Hasta septiembre de 2026 el CRM no tenia donde anotarlo: `origin` lo pone el
 * sistema (manual, whatsapp, website...) y no distingue a quien vino al piso
 * de quien lo mando un referido. Lo poco que habia vivia en etiquetas libres
 * -- «Piso», «Referido», «Marketplace» --, en solo el 10% de los contactos.
 *
 * Decision de Luis: un campo `fuente` con esta lista fija, obligatorio al dar
 * de alta a mano; lo que entra solo (Marketplace, WhatsApp, web) se llena
 * automatico. Para los contactos de antes, `fuenteDelContacto` lo deduce al
 * vuelo del origen y las etiquetas, sin tocar la base. Lo que no se puede
 * deducir sale como «Sin dato»: un numero inventado seria peor.
 */

export const FUENTES = [
  { id: "piso", etiqueta: "Piso / visita" },
  { id: "facebook", etiqueta: "Facebook / Messenger" },
  { id: "marketplace", etiqueta: "Marketplace" },
  { id: "instagram", etiqueta: "Instagram" },
  { id: "whatsapp", etiqueta: "WhatsApp" },
  { id: "web", etiqueta: "Página web" },
  { id: "referido", etiqueta: "Referido" },
  { id: "mercadolibre", etiqueta: "Mercado Libre" },
  { id: "llamada", etiqueta: "Llamada" },
  { id: "otro", etiqueta: "Otro" },
] as const;

export type FuenteId = (typeof FUENTES)[number]["id"];
export const SIN_DATO = "sin-dato";

const ETIQUETAS: Record<string, string> = Object.fromEntries(FUENTES.map((f) => [f.id, f.etiqueta]));
ETIQUETAS[SIN_DATO] = "Sin dato";

export function etiquetaDeFuente(id: string): string {
  return ETIQUETAS[id] || "Otro";
}

export function esFuenteValida(id: unknown): id is FuenteId {
  return typeof id === "string" && id in ETIQUETAS && id !== SIN_DATO;
}

const sinAcentos = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/**
 * Lo que el sistema anota solo al crear el contacto. `manual`, `excel_import`,
 * `google_contacts` o el asistente de IA no dicen como llego: devuelven null.
 */
export function fuenteDesdeOrigen(origin: unknown): FuenteId | null {
  const o = sinAcentos(String(origin || ""));
  if (!o) return null;
  if (o.includes("marketplace")) return "marketplace";
  if (o === "whatsapp") return "whatsapp";
  if (o === "messenger" || o === "facebook") return "facebook";
  if (o === "instagram") return "instagram";
  if (o === "website" || o === "web" || o.includes(".php") || o.includes("radar")) return "web";
  return null;
}

/** Las etiquetas que las agencias ya usaban para decir de donde venia alguien. */
const POR_ETIQUETA: [RegExp, FuenteId][] = [
  [/^piso$|^visita|^agencia$|^showroom/, "piso"],
  [/referid|recomendad/, "referido"],
  [/marketplace/, "marketplace"],
  [/^facebook|^fb$|messenger/, "facebook"],
  [/instagram|^ig$/, "instagram"],
  [/whats/, "whatsapp"],
  [/^pagina|^web|sitio/, "web"],
  [/mercado ?libre/, "mercadolibre"],
  [/llamada|telefono/, "llamada"],
];

export function fuenteDesdeEtiquetas(tags: unknown): FuenteId | null {
  if (!Array.isArray(tags)) return null;
  for (const t of tags) {
    const x = sinAcentos(String(t || ""));
    for (const [patron, fuente] of POR_ETIQUETA) if (patron.test(x)) return fuente;
  }
  return null;
}

/**
 * La fuente de un contacto: la que se eligio; si no hay, la del origen
 * automatico; si no, la de sus etiquetas; si no, «Sin dato».
 */
export function fuenteDelContacto(c: { fuente?: unknown; origin?: unknown; tags?: unknown }): string {
  if (esFuenteValida(c.fuente)) return c.fuente;
  return fuenteDesdeOrigen(c.origin) || fuenteDesdeEtiquetas(c.tags) || SIN_DATO;
}
