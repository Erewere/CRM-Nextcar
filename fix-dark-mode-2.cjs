const fs = require('fs');
const path = require('path');

const applyDarkMode = (dir) => {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      applyDarkMode(fullPath);
    } else if (fullPath.endsWith('.tsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      const replacements = [
        ['text-gray-900', 'text-gray-900 dark:text-slate-100'],
        ['text-gray-800', 'text-gray-800 dark:text-slate-200'],
        ['text-slate-900', 'text-slate-900 dark:text-slate-100'],
        ['text-slate-800', 'text-slate-800 dark:text-slate-200'],
        ['text-slate-700', 'text-slate-700 dark:text-slate-300'],
        ['bg-white', 'bg-white dark:bg-slate-800'],
        ['bg-[#fcfdfd]', 'bg-[#fcfdfd] dark:bg-slate-900'],
        ['border-gray-200', 'border-gray-200 dark:border-slate-700'],
        ['border-slate-200', 'border-slate-200 dark:border-slate-700'],
        ['bg-gray-50', 'bg-gray-50 dark:bg-slate-900'],
        ['bg-slate-50', 'bg-slate-50 dark:bg-slate-900'],
        ['w-full text-sm py-1 border-b', 'w-full bg-transparent dark:text-slate-200 text-sm py-1 border-b'],
        ['bg-slate-100', 'bg-slate-100 dark:bg-slate-700'],
        ['focus:bg-white', 'focus:bg-white dark:focus:bg-slate-800']
      ];

      for (const [search, replace] of replacements) {
        const splits = content.split(search);
        let newContent = splits[0];
        for (let i = 1; i < splits.length; i++) {
          const before = newContent.slice(-6);
          const after = splits[i].slice(0, 15);
          
          if (before.includes('dark:') || after.includes('dark:')) {
             newContent += search + splits[i];
          } else {
             newContent += replace + splits[i];
          }
        }
        content = newContent;
      }
      fs.writeFileSync(fullPath, content, 'utf8');
    }
  }
};

applyDarkMode(path.join(__dirname, 'src/pages'));
applyDarkMode(path.join(__dirname, 'src/components'));
console.log('Done mapping dark mode classes');
