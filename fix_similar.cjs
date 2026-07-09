const fs = require('fs');
let code = fs.readFileSync('src/pages/Inventory.tsx', 'utf8');

const targetStr = `    if (wv.make && makeMatches) hasSimilarBase = true;
    if (wv.bodyType && wv.bodyType !== "Cualquiera" && vehicle.bodyType === wv.bodyType) hasSimilarBase = true;`;

const replaceStr = `    if (wv.make && makeMatches) hasSimilarBase = true;
    if (wv.model && modelMatches) hasSimilarBase = true;
    if (wv.bodyType && wv.bodyType !== "Cualquiera" && (!vehicle.bodyType || vehicle.bodyType.toLowerCase() === wv.bodyType.toLowerCase())) hasSimilarBase = true;`;

code = code.replace(targetStr, replaceStr);

fs.writeFileSync('src/pages/Inventory.tsx', code);
