const fs = require('fs');
let code = fs.readFileSync('src/pages/Persons.tsx', 'utf8');

const matchLogic = `
interface MatchLevel {
  level: 'exact' | 'high' | 'medium' | 'low';
  vehicle: Vehicle;
}

const getClientMatches = (client: Client, vehicles: Vehicle[]): MatchLevel[] => {
  const matches: MatchLevel[] = [];
  if (client.status === 'won' || client.status === 'lost') return matches;
  if (!client.wantedVehicle) return matches;
  
  const wv = client.wantedVehicle;
  if (!wv.make && !wv.model && !wv.yearMin && !wv.yearMax && !wv.priceMax && (!wv.bodyType || wv.bodyType === "Cualquiera")) {
    return matches;
  }

  vehicles.forEach(vehicle => {
    if (vehicle.status !== 'available') return; // only match available vehicles
    let isExact = true;
    let isSimilar = true;
    let hasSimilarBase = false;
    let differences = 0;

    const normalize = (str?: string) => (str || "").toLowerCase().replace(/[^a-z0-9]/g, '');
    const checkMatch = (v?: string, w?: string) => {
        const nv = normalize(v);
        const nw = normalize(w);
        if (!nw) return true;
        if (nv.includes(nw) || nw.includes(nv)) return true;
        if ((nv === 'vw' || nv === 'volkswagen') && (nw === 'vw' || nw === 'volkswagen')) return true;
        if ((nv === 'chevy' || nv === 'chevrolet') && (nw === 'chevy' || nw === 'chevrolet')) return true;
        return false;
    };

    const makeMatches = wv.make ? checkMatch(vehicle.make, wv.make) : true;
    const modelMatches = wv.model ? checkMatch(vehicle.model, wv.model) : true;

    if (wv.make && !makeMatches) {
        isExact = false;
        differences += 2;
    }
    if (wv.model && !modelMatches) {
        isExact = false;
        differences += 1;
    }

    const yearMin = wv.yearMin || 0;
    const yearMax = wv.yearMax || 9999;
    if (vehicle.year < yearMin || vehicle.year > yearMax) {
        isExact = false;
        if (vehicle.year < yearMin - 2 || vehicle.year > yearMax + 2) {
            isSimilar = false;
        } else if (vehicle.year < yearMin - 1 || vehicle.year > yearMax + 1) {
            differences += 2;
        } else {
            differences += 1;
        }
    }

    const priceMax = wv.priceMax || Infinity;
    if (vehicle.price > priceMax) {
        isExact = false;
        if (vehicle.price > priceMax * 1.2) {
            isSimilar = false;
        } else if (vehicle.price > priceMax * 1.1) {
            differences += 2;
        } else {
            differences += 1;
        }
    }

    if (wv.bodyType && wv.bodyType !== "Cualquiera") {
        if (!vehicle.bodyType || vehicle.bodyType.toLowerCase() !== wv.bodyType.toLowerCase()) {
            isExact = false;
            differences += 1;
        }
    }

    if (wv.passengers) {
        const vPassengers = vehicle.passengers;
        if (vPassengers !== undefined && vPassengers !== null && String(vPassengers).trim() !== "") {
            if (Number(vPassengers) !== Number(wv.passengers)) {
                isExact = false;
                differences += 1;
            }
        } else {
            isExact = false;
        }
    }

    if (wv.make && makeMatches) hasSimilarBase = true;
    if (wv.model && modelMatches) hasSimilarBase = true;
    if (wv.bodyType && wv.bodyType !== "Cualquiera" && (!vehicle.bodyType || vehicle.bodyType.toLowerCase() === wv.bodyType.toLowerCase())) hasSimilarBase = true;
    if (!wv.make && !wv.bodyType) hasSimilarBase = true;

    if (isExact) {
      matches.push({ vehicle, level: 'exact' });
    } else if (isSimilar && hasSimilarBase) {
      let level: 'high'|'medium'|'low' = 'high';
      if (differences >= 3) level = 'low';
      else if (differences >= 2) level = 'medium';
      
      matches.push({ vehicle, level });
    }
  });

  return matches;
};
`;

code = code.replace('export function Persons() {', matchLogic + '\nexport function Persons() {');
fs.writeFileSync('src/pages/Persons.tsx', code);
