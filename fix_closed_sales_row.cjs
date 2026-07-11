const fs = require('fs');
let code = fs.readFileSync('src/pages/ClosedSales.tsx', 'utf8');

code = code.replace(
  /const sale = client\.saleDetails;\n\s*if \(\!sale\) return null;/g,
  `const sale = client.saleDetails || {};`
);

fs.writeFileSync('src/pages/ClosedSales.tsx', code);
