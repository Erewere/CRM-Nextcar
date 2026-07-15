const fs = require('fs');
let code = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

code = code.replace(
  /<Link\n                  to="\/kanban"\n                  key=\{client\.id\}\n                  className="block p-4 border/g,
  '<button\n                  onClick={() => setSelectedClient(client)}\n                  key={client.id}\n                  className="block text-left w-full p-4 border'
);

fs.writeFileSync('src/pages/Dashboard.tsx', code);
