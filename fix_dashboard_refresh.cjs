const fs = require('fs');
let content = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

const stateLine = `const [selectedClient, setSelectedClient] = useState<Client | null>(null);`;
const newStateLine = `const [selectedClient, setSelectedClient] = useState<Client | null>(null);\n  const [refreshKey, setRefreshKey] = useState(0);`;
content = content.replace(stateLine, newStateLine);

const effectDep = `  }, [userData]);`;
const newEffectDep = `  }, [userData, refreshKey]);`;
content = content.replace(effectDep, newEffectDep);

const modalStr = `<ClientDetailModal
          client={selectedClient}
          onClose={() => setSelectedClient(null)}
        />`;
const newModalStr = `<ClientDetailModal
          client={selectedClient}
          onClose={() => setSelectedClient(null)}
          onUpdated={() => setRefreshKey(prev => prev + 1)}
        />`;
content = content.replace(modalStr, newModalStr);

fs.writeFileSync('src/pages/Dashboard.tsx', content);
console.log('Fixed Dashboard refresh');
