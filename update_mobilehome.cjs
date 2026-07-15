const fs = require('fs');
let content = fs.readFileSync('src/pages/mobile/MobileHome.tsx', 'utf8');

if (!content.includes('agencyName?: string;')) {
  content = content.replace('agencyId: string;', 'agencyId: string;\n  agencyName?: string;');
}

content = content.replace(
  'agencyId, \n  clients,',
  'agencyId, \n  agencyName, \n  clients,'
);

const headerReplacement = `<div className="px-5 pt-6 pb-4 bg-white dark:bg-slate-800 shadow-sm sticky top-0 z-10">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
          {greeting}, <span className="text-blue-600 dark:text-blue-400">{userName.split(' ')[0]}</span>
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 capitalize">
          {formattedDate} {agencyName ? \` • \${agencyName}\` : ''}
        </p>
      </div>`;

content = content.replace(
  /<div className="px-5 pt-6 pb-4 bg-white dark:bg-slate-800 shadow-sm sticky top-0 z-10">[\s\S]*?<\/div>/,
  headerReplacement
);

fs.writeFileSync('src/pages/mobile/MobileHome.tsx', content);
console.log("Updated MobileHome");
