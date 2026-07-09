const fs = require('fs');
let code = fs.readFileSync('src/pages/Inventory.tsx', 'utf8');

const targetStr = `  clients.forEach(c => {
    if (!c.wantedVehicle) return;`;

const replaceStr = `  clients.forEach(c => {
    if (c.status === 'won' || c.status === 'lost') return;
    if (!c.wantedVehicle) return;`;

code = code.replace(targetStr, replaceStr);

fs.writeFileSync('src/pages/Inventory.tsx', code);
