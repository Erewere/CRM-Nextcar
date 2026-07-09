const fs = require('fs');
let code = fs.readFileSync('src/pages/Inventory.tsx', 'utf8');

const targetStr = `    // Passengers
    if (wv.passengers) {
        const vPassengers = vehicle.passengers;
        if (vPassengers !== undefined && vPassengers !== null && String(vPassengers).trim() !== "") {
            if (Number(vPassengers) !== Number(wv.passengers)) {
                isExact = false;
                // Si el cliente pide un número específico de pasajeros, es un requerimiento fuerte (ej. SUV de 3 filas)
                // No sugerimos como similar si no coincide el número de pasajeros
                isSimilar = false; 
            }
        } else {
            // Si el vehículo no tiene pasajeros definidos y piden cantidad, no lo recomendamos.
            isExact = false;
            isSimilar = false;
        }
    }`;

const replaceStr = `    // Passengers
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
    }`;

code = code.replace(targetStr, replaceStr);

// Also body type strict match:
const targetBodyType = `    // Body Type
    if (wv.bodyType && wv.bodyType !== "Cualquiera") {
        if (vehicle.bodyType !== wv.bodyType) {
            isExact = false;
            differences += 2;
        }
    }`;

const replaceBodyType = `    // Body Type
    if (wv.bodyType && wv.bodyType !== "Cualquiera") {
        if (!vehicle.bodyType || vehicle.bodyType.toLowerCase() !== wv.bodyType.toLowerCase()) {
            isExact = false;
            differences += 1;
        }
    }`;
code = code.replace(targetBodyType, replaceBodyType);

fs.writeFileSync('src/pages/Inventory.tsx', code);
