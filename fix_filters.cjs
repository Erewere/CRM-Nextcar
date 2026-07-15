const fs = require('fs');
let content = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

const startMarker = '      {/* Dynamic Filters */}';
const startIdx = content.indexOf(startMarker);

const endMarker = '{/* Action Center (Tasks & Alerts) */}';
const endIdx = content.indexOf(endMarker);

if (startIdx === -1 || endIdx === -1) {
  console.log('not found'); process.exit(1);
}

const replacement = `      {/* Dynamic Filters */}
      <div className="flex border-b border-gray-200 dark:border-slate-700 mb-6 mt-4">
        <button
          onClick={() => {
            const today = new Date().toISOString().split("T")[0];
            setFilterStartDate(today);
            setFilterEndDate(today);
            setActiveDateFilter("today");
          }}
          className={\`py-2 px-4 border-b-2 font-medium text-sm transition-colors \${
            activeDateFilter === "today"
              ? "border-blue-500 text-blue-600 dark:text-blue-400"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200"
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
          className={\`py-2 px-4 border-b-2 font-medium text-sm transition-colors \${
            activeDateFilter === "week"
              ? "border-blue-500 text-blue-600 dark:text-blue-400"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200"
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
          className={\`py-2 px-4 border-b-2 font-medium text-sm transition-colors \${
            activeDateFilter === "month"
              ? "border-blue-500 text-blue-600 dark:text-blue-400"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200"
          }\`}
        >
          Este Mes
        </button>
      </div>

        `;

content = content.substring(0, startIdx) + replacement + content.substring(endIdx);
fs.writeFileSync('src/pages/Dashboard.tsx', content);
console.log('Fixed filters style properly');
