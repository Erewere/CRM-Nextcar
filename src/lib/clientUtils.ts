export function checkIsWon(status: string = "", pipelineStages: {id: string, title?: string}[] = []) {
  const wonKeywords = [
    "ganado", "won", "vendid", "cerrad", 
    "entregad", "completad", "finalizad", 
    "pagad", "exito", "éxito", "completed", "finish", "listo"
  ];
  const s = String(status || "").toLowerCase();
  if (s === "won") return true;
  if (wonKeywords.some((k) => s.includes(k))) return true;
  
  const stage = pipelineStages.find(st => st.id === status);
  if (stage) {
    const t = String(stage.title || "").toLowerCase();
    const id = String(stage.id || "").toLowerCase();
    if (id === "won") return true;
    return wonKeywords.some((k) => t.includes(k) || id.includes(k));
  }
  return false;
}

export function checkIsLost(status: string = "", pipelineStages: {id: string, title?: string}[] = []) {
  const lostKeywords = ["perdid", "lost", "cancelad", "rechazad", "fallid", "abandonad"];
  const s = String(status || "").toLowerCase();
  if (s === "lost") return true;
  if (lostKeywords.some((k) => s.includes(k))) return true;
  
  const stage = pipelineStages.find(st => st.id === status);
  if (stage) {
    const t = String(stage.title || "").toLowerCase();
    const id = String(stage.id || "").toLowerCase();
    if (id === "lost") return true;
    return lostKeywords.some((k) => t.includes(k) || id.includes(k));
  }
  return false;
}

import { Client } from "../types";
export function deduplicateClients(clients: Client[]): Client[] {
  const uniqueClients: Client[] = [];
  const seenNames = new Set<string>();
  for (const c of clients) {
    const nm = String(c.name || "").trim().toLowerCase();
    if (nm && !seenNames.has(nm)) {
      seenNames.add(nm);
      uniqueClients.push(c);
    } else if (!nm) {
      uniqueClients.push(c);
    }
  }
  return uniqueClients;
}

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
