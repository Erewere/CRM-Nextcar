const fs = require('fs');
let content = fs.readFileSync('src/components/Layout.tsx', 'utf8');

content = content.replace(
  '<span className="text-[10px] font-medium">Perfil</span>',
  '<span className="text-[10px] font-medium truncate w-full px-1 text-center">{agencyName || "Perfil"}</span>'
);

fs.writeFileSync('src/components/Layout.tsx', content);
console.log('Fixed Perfil in Layout.tsx');
