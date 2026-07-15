const fs = require('fs');
let content = fs.readFileSync('src/pages/Tasks.tsx', 'utf8');

content = content.replace(/stroke-width/g, 'strokeWidth');
content = content.replace(/stroke-linecap/g, 'strokeLinecap');
content = content.replace(/stroke-linejoin/g, 'strokeLinejoin');

fs.writeFileSync('src/pages/Tasks.tsx', content);
console.log('Fixed SVG DOM properties in Tasks.tsx');
