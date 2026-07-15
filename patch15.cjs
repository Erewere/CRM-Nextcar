const fs = require('fs');
let content = fs.readFileSync('src/components/NewActivityModal.tsx', 'utf8');

content = content.replace(
  `className="bg-white dark:bg-slate-800 md:rounded-lg rounded-t-3xl shadow-2xl w-full max-w-5xl h-[90vh] md:h-[85vh] flex flex-col overflow-hidden relative z-10"`,
  `className="bg-white dark:bg-slate-800 md:rounded-lg rounded-t-3xl shadow-2xl w-full max-w-5xl h-[90dvh] md:h-[85vh] flex flex-col overflow-hidden relative z-10"`
);

fs.writeFileSync('src/components/NewActivityModal.tsx', content);
console.log('Fixed dvh in NewActivityModal.tsx');
