const fs = require('fs');
let code = fs.readFileSync('src/pages/mobile/MobilePersons.tsx', 'utf8');

code = code.replace(
  'setClients(list);',
  'setClients(list);\n      setSelectedClient(prev => prev ? (list.find(c => c.id === prev.id) || prev) : null);'
);

fs.writeFileSync('src/pages/mobile/MobilePersons.tsx', code);
