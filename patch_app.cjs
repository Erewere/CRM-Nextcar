const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');
code = code.replace(
  "import { Integrations } from './pages/Integrations';",
  "import { Integrations } from './pages/Integrations';\nimport { ClosedSales } from './pages/ClosedSales';"
);
code = code.replace(
  `<Route path="integrations" element={<ProtectedRoute requireRole={['master', 'admin']}><Integrations /></ProtectedRoute>} />`,
  `<Route path="integrations" element={<ProtectedRoute requireRole={['master', 'admin']}><Integrations /></ProtectedRoute>} />\n            <Route path="closed-sales" element={<ProtectedRoute requireRole={['master', 'admin', 'seller']}><ClosedSales /></ProtectedRoute>} />`
);
fs.writeFileSync('src/App.tsx', code);
