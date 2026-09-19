/**
 * La fecha de hoy (AAAA-MM-DD) en la hora de quien usa el CRM.
 *
 * `new Date().toISOString()` da la fecha de Londres: en Mexico, de las 6 de la
 * tarde en adelante ya es "mañana", y una venta cerrada el 18 en la tarde
 * quedaba anotada el 19.
 */
export function hoyLocal(fecha: Date = new Date()): string {
  const a = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, "0");
  const d = String(fecha.getDate()).padStart(2, "0");
  return `${a}-${m}-${d}`;
}
