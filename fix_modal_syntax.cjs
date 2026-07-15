const fs = require('fs');
let content = fs.readFileSync('src/components/NewActivityModal.tsx', 'utf8');

content = content.replace(
  /useEffect\(\(\) => \{\n\s*useEffect\(\(\) => \{/g,
  'useEffect(() => {'
);

fs.writeFileSync('src/components/NewActivityModal.tsx', content);
console.log('Fixed syntax in NewActivityModal.tsx');
