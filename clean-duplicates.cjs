const fs = require('fs');
const path = require('path');

const cleanDuplicates = (dir) => {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      cleanDuplicates(fullPath);
    } else if (fullPath.endsWith('.tsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      const replacements = [
        ['bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200', 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'],
        ['bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800', 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'],
        ['text-slate-800 dark:text-slate-200 dark:text-slate-100', 'text-slate-800 dark:text-slate-200'],
        ['text-gray-900 dark:text-slate-100 dark:text-slate-100', 'text-gray-900 dark:text-slate-100']
      ];

      for (const [search, replace] of replacements) {
        if (content.includes(search)) {
          content = content.replace(new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replace);
        }
      }
      fs.writeFileSync(fullPath, content, 'utf8');
    }
  }
};

cleanDuplicates(path.join(__dirname, 'src'));
console.log('Done cleaning duplicates');
