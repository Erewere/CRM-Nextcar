const fs = require('fs');
let code = fs.readFileSync('src/pages/mobile/MobilePersons.tsx', 'utf8');

code = code.replace(
  'if (loading) {',
  'if (loading && clients.length === 0) {'
);

fs.writeFileSync('src/pages/mobile/MobilePersons.tsx', code);
