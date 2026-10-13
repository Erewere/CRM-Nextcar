/**
 * Tipos de actividad que se pueden programar (llamada, mensaje, cita…).
 *
 * Las tareas guardan `type`, pero muchas se crearon sin él o con «call» por
 * omisión, así que para clasificarlas manda el título cuando dice claramente de
 * qué es («Mandar mensaje», «Cita con…»), y si no, el tipo guardado.
 */
export type TipoActividad = "call" | "message" | "appointment" | "test_drive" | "signature" | "task" | "payment";

export const TIPOS_ACTIVIDAD: { id: Exclude<TipoActividad, "payment">; etiqueta: string }[] = [
  { id: "call", etiqueta: "Llamada" },
  { id: "message", etiqueta: "Mensaje" },
  { id: "appointment", etiqueta: "Cita" },
  { id: "test_drive", etiqueta: "Prueba de manejo" },
  { id: "signature", etiqueta: "Firma" },
  { id: "task", etiqueta: "Tarea" },
];

export function tipoDeTarea(t: { type?: string; title?: string }): TipoActividad {
  if (t.type === "payment") return "payment";
  const s = String(t.title || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (/llama/.test(s)) return "call";
  if (/mensaje|whatsapp|escribir|escribele|msj/.test(s)) return "message";
  if (/cita|reunion|junta|meet/.test(s)) return "appointment";
  if (/prueba|manejo|test/.test(s)) return "test_drive";
  if (/firma|contrato/.test(s)) return "signature";
  const guardado = TIPOS_ACTIVIDAD.find((x) => x.id === t.type)?.id;
  return guardado && guardado !== "call" ? guardado : "task";
}
