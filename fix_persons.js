const fs = require('fs');
let code = fs.readFileSync('src/pages/Persons.tsx', 'utf8');
code = code.replace(/const uniqueClients: Client\[\] = \[\];[\s\S]*?setPersons\(uniqueClients\);/m, 'setPersons(deduplicateClients(allClients));');
fs.writeFileSync('src/pages/Persons.tsx', code);
