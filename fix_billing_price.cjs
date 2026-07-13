const fs = require('fs');
let code = fs.readFileSync('src/pages/Billing.tsx', 'utf8');

code = code.replace(/const PRICE_PER_USER = 9;/g, 'const PRICE_PER_USER = 9.99;');

fs.writeFileSync('src/pages/Billing.tsx', code);
