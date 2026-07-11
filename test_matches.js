const fs = require('fs');
// mock data
const vehicles = [
  { id: 'v1', make: 'Honda', model: 'CRV', year: 2022, price: 25000, bodyType: 'SUV', passengers: '5', status: 'available' },
  { id: 'v2', make: 'Toyota', model: 'Corolla', year: 2020, price: 18000, bodyType: 'Sedan', passengers: '5', status: 'available' },
  { id: 'v3', make: 'Ford', model: 'Focus', year: 2019, price: 15000, bodyType: 'Hatchback', passengers: '5', status: 'available' },
];

const wv = {
  make: 'Honda',
  bodyType: 'SUV',
  passengers: '5',
  priceMax: 30000
};

const normalize = (str) => (str || "").toLowerCase().replace(/[^a-z0-9]/g, '');
const checkMatch = (v, w) => {
    const nv = normalize(v);
    const nw = normalize(w);
    if (!nw) return true;
    if (nv.includes(nw) || nw.includes(nv)) return true;
    if ((nv === 'vw' || nv === 'volkswagen') && (nw === 'vw' || nw === 'volkswagen')) return true;
    if ((nv === 'chevy' || nv === 'chevrolet') && (nw === 'chevy' || nw === 'chevrolet')) return true;
    return false;
};

const matches = [];
vehicles.forEach(vehicle => {
    if (vehicle.status !== 'available') return;
    let isExact = true;
    let isSimilar = true;
    let differences = 0;

    if (wv.bodyType && wv.bodyType !== "Cualquiera") {
        if (!vehicle.bodyType || vehicle.bodyType.toLowerCase() !== wv.bodyType.toLowerCase()) {
            isExact = false;
            isSimilar = false; 
        }
    }

    if (wv.passengers && String(wv.passengers).trim() !== "") {
        const vPassengers = vehicle.passengers;
        if (vPassengers !== undefined && vPassengers !== null && String(vPassengers).trim() !== "") {
            if (Number(vPassengers) !== Number(wv.passengers)) {
                isExact = false;
                isSimilar = false;
            }
        } else {
            isExact = false;
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
            differences += 3;
        } else if (vehicle.year < yearMin - 1 || vehicle.year > yearMax + 1) {
            differences += 2;
        } else {
            differences += 1;
        }
    }

    if (!isSimilar) return;

    if (isExact) {
      matches.push({ vehicle, level: 'exact' });
    } else {
      let level = 'high';
      if (differences >= 4) level = 'low';
      else if (differences >= 2) level = 'medium';
      matches.push({ vehicle, level, differences });
    }
});
console.log(matches);
