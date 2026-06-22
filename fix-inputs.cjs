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
        ['rounded border-gray-300', 'rounded border-gray-300 dark:border-slate-600 dark:bg-slate-700 bg-white dark:checked:bg-blue-500'],
        ['class="w-full border border-gray-300 rounded', 'className="w-full border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200'],
        ['className="w-full border border-gray-300 rounded', 'className="w-full border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200'],
        ['className="w-full pl-10 pr-4 py-2 border rounded-lg', 'className="w-full pl-10 pr-4 py-2 border rounded-lg bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'],
        ['className="w-full px-3 py-2 border rounded-lg"', 'className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"'],
        ['className="w-full px-3 py-2 border rounded-lg ', 'className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 '],
        ['className="flex-1 px-4 py-2 border rounded-lg', 'className="flex-1 px-4 py-2 border rounded-lg bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200']
      ];

      let changed = false;
      for (const [search, replace] of replacements) {
        if (content.includes(search)) {
          content = content.replace(new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replace);
        }
      }
      fs.writeFileSync(fullPath, content, 'utf8');
    }
  }
};

applyDarkMode(path.join(__dirname, 'src/pages'));
applyDarkMode(path.join(__dirname, 'src/components'));
console.log('Done mapping inputs classes');
