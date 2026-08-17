/**
 * Quita los contactos borrados de una lista.
 *
 * Borrar un contacto no lo elimina de la base: le pone isDeleted y lo
 * esconde. Once pantallas respetaban esa marca y once no, asi que un contacto
 * borrado seguia apareciendo en el buscador de la ficha del auto, en el movil
 * y en las coincidencias, mientras en Personas ya no estaba. Al intentar
 * volver a crearlo, el CRM decia que ya existia.
 */
export function sinBorrados<T extends { isDeleted?: boolean }>(lista: T[]): T[] {
  return lista.filter((c) => !c.isDeleted);
}

export function sanitizeFirestoreData<T>(obj: T): T {
  if (obj === undefined) return null as unknown as T;
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return obj as unknown as T;
  
  if (Array.isArray(obj)) {
    return obj
      .filter((item) => item !== undefined)
      .map((item) => sanitizeFirestoreData(item)) as unknown as T;
  }
  
  const sanitized: any = {};
  for (const [key, value] of Object.entries(obj as any)) {
    if (value !== undefined) {
      sanitized[key] = sanitizeFirestoreData(value);
    }
  }
  return sanitized as T;
}

export function checkIsWon(status: string = "", pipelineStages: {id: string, title?: string}[] = []) {
  const s = String(status || "").trim().toLowerCase();
  if (s === "won" || s === "ganado" || s === "ganados" || s === "sold" || s === "vendido" || s === "vendidos") return true;

  const wonKeywords = ["ganad", "won", "cerrado ganado", "venta ganada"];
  if (wonKeywords.some((k) => s.includes(k))) return true;

  const stage = pipelineStages.find(st => st.id === status);
  if (stage) {
    const t = String(stage.title || "").trim().toLowerCase();
    const id = String(stage.id || "").trim().toLowerCase();
    if (id === "won" || id === "ganado" || id === "ganados" || id === "sold" || id === "vendido" || id === "vendidos") return true;
    if (t === "ganado" || t === "ganados" || t === "won" || t === "vendido" || t === "vendidos") return true;
    return wonKeywords.some((k) => t.includes(k) || id.includes(k));
  }
  return false;
}

export function checkIsLost(status: string = "", pipelineStages: {id: string, title?: string}[] = []) {
  const s = String(status || "").trim().toLowerCase();
  if (s === "lost" || s === "perdido" || s === "perdidos" || s === "cancelado" || s === "rechazado") return true;

  const lostKeywords = ["perdid", "lost", "descartad"];
  if (lostKeywords.some((k) => s.includes(k))) return true;

  const stage = pipelineStages.find(st => st.id === status);
  if (stage) {
    const t = String(stage.title || "").trim().toLowerCase();
    const id = String(stage.id || "").trim().toLowerCase();
    if (id === "lost" || id === "perdido" || id === "perdidos" || id === "cancelado" || id === "rechazado") return true;
    if (t === "perdido" || t === "perdidos" || t === "lost" || t === "cancelado" || t === "rechazado") return true;
    return lostKeywords.some((k) => t.includes(k) || id.includes(k));
  }
  return false;
}

import { Client } from "../types";
export function getVehicleOfInterestText(client: Client): string {
  // If they have a specific vehicle selected/assigned already (and it's not a placeholder/Otro pendiente)
  if (client.vehicle && client.vehicle !== 'Otro pendiente' && client.vehicle !== 'Sin vehículo de interés') {
    return client.vehicle;
  }

  // If we have a wantedVehicle object
  const wv = client.wantedVehicle;
  if (wv) {
    const parts: string[] = [];
    
    // 1. Body type or placeholder "Auto"
    if (wv.bodyType && wv.bodyType !== 'Cualquiera') {
      parts.push(wv.bodyType);
    }
    
    // 2. Make & Model
    if (wv.make && wv.make !== 'Cualquiera') {
      parts.push(wv.make);
    }
    if (wv.model) {
      parts.push(wv.model);
    }

    // 3. Year range
    if (wv.yearMin || wv.yearMax) {
      if (wv.yearMin && wv.yearMax) {
        if (wv.yearMin === wv.yearMax) {
          parts.push(`${wv.yearMin}`);
        } else {
          parts.push(`${wv.yearMin}-${wv.yearMax}`);
        }
      } else if (wv.yearMin) {
        parts.push(`Año ≥${wv.yearMin}`);
      } else if (wv.yearMax) {
        parts.push(`Año ≤${wv.yearMax}`);
      }
    }

    // 4. Price Max
    if (wv.priceMax) {
      const formattedPrice = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 }).format(wv.priceMax);
      parts.push(`menos de $${formattedPrice}`);
    }

    if (parts.length > 0) {
      return `Busca: ${parts.join(' ')}`;
    }
  }

  // Fallback: If no wantedVehicle fields are filled, but they have 'Otro pendiente' or 'Sin vehículo de interés',
  // we could check if tags or other notes are present, but "Buscando auto" is much better.
  return "Buscando auto";
}
