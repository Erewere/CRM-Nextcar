const fs = require('fs');
let code = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

const regexWon = /  const totalWonAmount = wonContacts\.reduce\(\(sum, contact\) => \{[\s\S]*?return sum \+ \(vehicle\?\.price \|\| 0\);\n  \}, 0\);/;
const replacementWon = `  const totalWonAmount = wonContacts.reduce((sum, contact) => {
    return sum + (contact.saleDetails?.price || vehicles.find((v) => v.id === contact.vehicleId)?.price || 0);
  }, 0);`;

code = code.replace(regexWon, replacementWon);
fs.writeFileSync('src/pages/Dashboard.tsx', code);
