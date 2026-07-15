const fs = require('fs');
let content = fs.readFileSync('src/pages/Tasks.tsx', 'utf8');

if (!content.includes('getDoc,')) {
  content = content.replace(
    `  getDocs,`,
    `  getDocs,
  getDoc,`
  );
}

fs.writeFileSync('src/pages/Tasks.tsx', content);
console.log('Added getDoc to Tasks.tsx');
