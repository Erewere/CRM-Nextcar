const fs = require('fs');
let code = fs.readFileSync('src/pages/mobile/MobilePersons.tsx', 'utf8');

const target = `  const getWhatsAppLink = (phone: string) => {
    let cleaned = phone.replace(/\\\\D/g, '');
    if (cleaned.length === 10) cleaned = '52' + cleaned;
    return \\\`https://wa.me/\\\${cleaned}\\\`;
  };`;
  
const replacement = `  const getWhatsAppLink = (phone: string) => {
    let cleaned = phone.replace(/\\D/g, '');
    if (cleaned.length === 10) cleaned = '52' + cleaned;
    return \`https://wa.me/\${cleaned}\`;
  };`;

// Just find the function directly
code = code.replace(/const getWhatsAppLink = \(phone: string\) => \{[\s\S]*?\};/m, replacement);
fs.writeFileSync('src/pages/mobile/MobilePersons.tsx', code);
