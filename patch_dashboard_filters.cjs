const fs = require('fs');
let content = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

content = content.replace(
  'const [activeDateFilter, setActiveDateFilter] = useState<string>(() => localStorage.getItem("dashboard_activeDateFilter") || "");',
  'const [activeDateFilter, setActiveDateFilter] = useState<string>(() => localStorage.getItem("dashboard_activeDateFilter") || "");\n  const [showMobileFilters, setShowMobileFilters] = useState(false);'
);

content = content.replace(
  '{/* Quick Date Filters */}',
  `{/* Quick Date Filters */}
        <div className="flex xl:hidden w-full justify-end mb-2">
          <button 
            onClick={() => setShowMobileFilters(!showMobileFilters)}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-md text-sm font-medium"
          >
            <Filter className="w-4 h-4" />
            {showMobileFilters ? "Ocultar filtros" : "Mostrar filtros"}
          </button>
        </div>`
);

content = content.replace(
  /<div className="flex flex-wrap gap-2 items-center w-full xl:w-auto">/,
  `<div className={\`flex flex-wrap gap-2 items-center w-full xl:w-auto \${showMobileFilters ? 'flex' : 'hidden xl:flex'}\`}>`
);

content = content.replace(
  /<div className="flex flex-wrap items-center justify-start xl:justify-end gap-3 w-full xl:w-auto">/,
  `<div className={\`flex flex-wrap items-center justify-start xl:justify-end gap-3 w-full xl:w-auto \${showMobileFilters ? 'flex' : 'hidden xl:flex'}\`}>`
);

fs.writeFileSync('src/pages/Dashboard.tsx', content);
console.log('Patched Dashboard.tsx filters');
