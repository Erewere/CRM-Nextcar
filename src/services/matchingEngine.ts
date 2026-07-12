import { Client, Vehicle } from "../types";

export type MatchLevel = 'exact' | 'high' | 'medium' | 'low';
export interface ClientMatch {
  vehicle: Vehicle;
  level: MatchLevel;
  score: number;
}

export const getClientMatches = (client: Client, vehicles: Vehicle[]): ClientMatch[] => {
  const matches: ClientMatch[] = [];
  if (client.status === 'won' || client.status === 'lost') return matches;
  if (!client.wantedVehicle) return matches;
  
  const wv = client.wantedVehicle;
  if (!wv.make && !wv.model && !wv.yearMin && !wv.yearMax && !wv.priceMax && (!wv.bodyType || wv.bodyType === "Cualquiera") && !wv.passengers) {
    return matches;
  }

  vehicles.forEach(vehicle => {
    if (vehicle.status !== 'available') return; 
    let score = 100;

    const normalize = (str?: string) => (str || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '');
    const checkMatch = (v?: string, w?: string) => {
        const nv = normalize(v);
        const nw = normalize(w);
        if (!nw) return true;
        if (nv.includes(nw) || nw.includes(nv)) return true;
        if ((nv === 'vw' || nv === 'volkswagen') && (nw === 'vw' || nw === 'volkswagen')) return true;
        if ((nv === 'chevy' || nv === 'chevrolet') && (nw === 'chevy' || nw === 'chevrolet')) return true;
        return false;
    };

    // 1. Tipo de Auto (Body Type) - MAIN FILTER
    if (wv.bodyType && wv.bodyType !== "Cualquiera") {
        const vBody = normalize(vehicle.bodyType);
        const wBody = normalize(wv.bodyType);
        if (!vBody || (vBody !== wBody && !vBody.includes(wBody) && !wBody.includes(vBody))) {
            score -= 70; // Huge penalty for wrong body type
        }
    }

    // 2. Pasajeros
    if (wv.passengers && String(wv.passengers).trim() !== "") {
        const vPassengers = vehicle.passengers;
        if (vPassengers !== undefined && vPassengers !== null && String(vPassengers).trim() !== "") {
            const diff = Math.abs(Number(vPassengers) - Number(wv.passengers));
            if (diff > 0) {
                score -= (diff * 20); // Penalty per passenger diff
            }
        } else {
            score -= 10;
        }
    }

    // 3. Precio
    const priceMax = wv.priceMax || Infinity;
    if (vehicle.price > priceMax) {
        if (vehicle.price > priceMax * 1.2) {
            score -= 40;
        } else if (vehicle.price > priceMax * 1.1) {
            score -= 20;
        } else {
            score -= 10;
        }
    } else if (vehicle.price < priceMax * 0.5) {
        // Way too cheap, might not be what they want, but small penalty
        score -= 5;
    }

    // 4. Marca & Modelo
    const makeMatches = wv.make ? checkMatch(vehicle.make, wv.make) : true;
    const modelMatches = wv.model ? checkMatch(vehicle.model, wv.model) : true;

    if (wv.make && !makeMatches) {
        score -= 20;
    }
    if (wv.model && !modelMatches) {
        score -= 15;
    }

    // 5. Año
    const yearMin = wv.yearMin || 0;
    const yearMax = wv.yearMax || 9999;
    if (vehicle.year < yearMin || vehicle.year > yearMax) {
        if (vehicle.year < yearMin - 2 || vehicle.year > yearMax + 2) {
            score -= 30;
        } else if (vehicle.year < yearMin - 1 || vehicle.year > yearMax + 1) {
            score -= 15;
        } else {
            score -= 5;
        }
    }

    // Final decision
    if (score < 40) return; // Ignore terrible matches

    let level: MatchLevel = 'low';
    if (score >= 95) level = 'exact';
    else if (score >= 80) level = 'high';
    else if (score >= 60) level = 'medium';

    matches.push({ vehicle, level, score });
  });

  return matches.sort((a, b) => b.score - a.score);
};
