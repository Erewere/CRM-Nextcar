const fs = require('fs');
let content = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

// Find the start of the return statement
const returnStart = content.indexOf('  return (\n    <div className="space-y-4 pb-8">');

if (returnStart === -1) {
  console.log('Return start not found'); process.exit(1);
}

// Build the funnel data array
const funnelDataInsertion = `
  const funnelData = [
    { name: 'Prospectos', value: filteredClients.length },
    { name: 'Activos', value: activeContacts.length },
    { name: 'En Cierre', value: activeContacts.filter((c) => {
      const st = String(c.status || "").toLowerCase();
      return st.includes("propuesta") || st.includes("demostracion") || st.includes("negociacion");
    }).length },
    { name: 'Ventas Cerradas', value: wonContacts.length },
  ];
`;

content = content.substring(0, returnStart) + funnelDataInsertion + '\n' + content.substring(returnStart);
fs.writeFileSync('src/pages/Dashboard.tsx', content);
console.log('Added funnelData');
