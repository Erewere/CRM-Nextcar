const fs = require('fs');
let code = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

code = code.replace(
  '    vehicles,\n    filterTags,\n  ]);',
  '    vehicles,\n    filterTags,\n    pipelineStages,\n  ]);'
);

fs.writeFileSync('src/pages/Dashboard.tsx', code);

// And ClosedSales.tsx ? ClosedSales doesn't use useMemo for filteredClients?
// Actually ClosedSales does not use useMemo for filteredSales, it calculates it on every render, which is fine since pipelineStages will trigger a re-render.
