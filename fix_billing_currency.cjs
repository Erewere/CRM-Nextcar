const fs = require('fs');
let code = fs.readFileSync('src/pages/Billing.tsx', 'utf8');

code = code.replace(/const PRICE_PER_USER = 199;/g, 'const PRICE_PER_USER = 9;');
code = code.replace(/MXN \/ usuario \/ mes/g, 'USD / usuario / mes');
code = code.replace(/MXN \/ mes/g, 'USD / mes');
code = code.replace(/\$99 MXN/g, '$5 USD');
code = code.replace(/\$399 MXN/g, '$20 USD');

fs.writeFileSync('src/pages/Billing.tsx', code);
