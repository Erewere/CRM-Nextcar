import fs from 'fs';
let content = fs.readFileSync('src/components/Layout.tsx', 'utf8');

// Change main background
content = content.replace(
  /<main className="flex-1 flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-900/g,
  '<main className="flex-1 flex flex-col overflow-hidden bg-[#f4f5f5] dark:bg-slate-900'
);

fs.writeFileSync('src/components/Layout.tsx', content, 'utf8');
