const fs = require('fs');

let content = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

const startMarker = '      {/* Dynamic Filters */}';
const endMarker = '      </div>\n\n      {/* Action Center (Tasks & Alerts) */}';

const startIdx = content.indexOf(startMarker);
const endIdx = content.indexOf(endMarker);

if (startIdx === -1 || endIdx === -1) {
  console.log('not found'); process.exit(1);
}

const replacement = `      {/* Dynamic Filters */}
      <div className="flex flex-wrap gap-2 items-center w-full mb-4">
        <button
          onClick={() => {
            const today = new Date().toISOString().split("T")[0];
            setFilterStartDate(today);
            setFilterEndDate(today);
            setActiveDateFilter("today");
          }}
          className={\`text-sm px-3 py-1.5 rounded-md cursor-pointer transition-colors \${
            activeDateFilter === "today"
              ? "bg-blue-50 text-blue-600 font-medium dark:bg-blue-900/30 dark:text-blue-400"
              : "hover:bg-slate-50 text-slate-600 dark:text-slate-400 dark:hover:bg-slate-800"
          }\`}
        >
          Hoy
        </button>
        <button
          onClick={() => {
            const date = new Date();
            date.setDate(date.getDate() - date.getDay() + 1); // Monday
            const start = date.toISOString().split("T")[0];
            const end = new Date().toISOString().split("T")[0];
            setFilterStartDate(start);
            setFilterEndDate(end);
            setActiveDateFilter("week");
          }}
          className={\`text-sm px-3 py-1.5 rounded-md cursor-pointer transition-colors \${
            activeDateFilter === "week"
              ? "bg-blue-50 text-blue-600 font-medium dark:bg-blue-900/30 dark:text-blue-400"
              : "hover:bg-slate-50 text-slate-600 dark:text-slate-400 dark:hover:bg-slate-800"
          }\`}
        >
          Esta Semana
        </button>
        <button
          onClick={() => {
            const date = new Date();
            const start = new Date(date.getFullYear(), date.getMonth(), 1)
              .toISOString()
              .split("T")[0];
            const end = new Date().toISOString().split("T")[0];
            setFilterStartDate(start);
            setFilterEndDate(end);
            setActiveDateFilter("month");
          }}
          className={\`text-sm px-3 py-1.5 rounded-md cursor-pointer transition-colors \${
            activeDateFilter === "month"
              ? "bg-blue-50 text-blue-600 font-medium dark:bg-blue-900/30 dark:text-blue-400"
              : "hover:bg-slate-50 text-slate-600 dark:text-slate-400 dark:hover:bg-slate-800"
          }\`}
        >
          Este Mes
        </button>
`;

content = content.substring(0, startIdx) + replacement + content.substring(endIdx);
fs.writeFileSync('src/pages/Dashboard.tsx', content);
console.log('Fixed filters style');
