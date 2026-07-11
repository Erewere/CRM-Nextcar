const fs = require('fs');
let code = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

const debugCode = `
      <div className="bg-red-100 text-red-800 p-4 rounded mb-4 text-xs">
        <p><strong>Debug:</strong></p>
        <p>Total clients: {clients.length}</p>
        <p>Pipeline stages: {JSON.stringify(pipelineStages.map(s => s.id + '/' + s.title))}</p>
        <p>Client statuses: {JSON.stringify(Array.from(new Set(clients.map(c => c.status))))}</p>
        <p>Won clients (isWon): {clients.filter(c => isWon(c.status)).length}</p>
      </div>
`;

code = code.replace(
  '<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 relative z-10">',
  debugCode + '\n<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 relative z-10">'
);
fs.writeFileSync('src/pages/Dashboard.tsx', code);
