const fs = require('fs');
let code = fs.readFileSync('src/pages/ClosedSales.tsx', 'utf8');

const debugCode = `
        <div className="bg-red-100 p-2 text-xs">
          Debug info: 
          Total clients: {clients.length}, 
          Won clients (before search): {wonClients.length}, 
          Filtered (search term: '{searchTerm}'): {filteredSales.length},
          All statuses: {Array.from(new Set(clients.map(c => c.status))).join(", ")}
        </div>
`;

code = code.replace(
  '<div className="flex-1 overflow-auto p-4 md:p-6">',
  '<div className="flex-1 overflow-auto p-4 md:p-6">\n' + debugCode
);

fs.writeFileSync('src/pages/ClosedSales.tsx', code);
