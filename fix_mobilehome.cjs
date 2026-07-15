const fs = require('fs');
let content = fs.readFileSync('src/pages/mobile/MobileHome.tsx', 'utf8');

content = content.replace(/'pending'\]/g, "'pending'");
content = content.replace(/\[\'pending\'/g, "'pending'");

fs.writeFileSync('src/pages/mobile/MobileHome.tsx', content);
console.log('Fixed mobilehome');
