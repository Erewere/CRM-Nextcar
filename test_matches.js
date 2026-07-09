const fs = require('fs');

let inventoryCode = fs.readFileSync('src/pages/Inventory.tsx', 'utf8');

// We will inject getClientVehicleMatches into Persons.tsx
