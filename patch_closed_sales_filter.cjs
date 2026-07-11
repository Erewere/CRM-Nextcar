const fs = require('fs');
let code = fs.readFileSync('src/pages/ClosedSales.tsx', 'utf8');

code = code.replace(
  'const clientMatch = c.name.toLowerCase().includes(search);',
  'const clientMatch = (c.name || "").toLowerCase().includes(search);'
);

fs.writeFileSync('src/pages/ClosedSales.tsx', code);
