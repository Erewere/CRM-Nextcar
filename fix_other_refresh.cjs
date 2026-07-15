const fs = require('fs');

function fixFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');
  
  if (content.includes('const [refreshKey, setRefreshKey]') || content.includes('onUpdated={() => setRefreshKey')) {
    return; // already fixed
  }

  // Find where selectedClient is defined
  const stateLineMatch = content.match(/const \[selectedClient, setSelectedClient\] = useState<[^>]+>\(null\);/);
  if (!stateLineMatch) return;
  
  const stateLine = stateLineMatch[0];
  const newStateLine = stateLine + '\n  const [refreshKey, setRefreshKey] = useState(0);';
  content = content.replace(stateLine, newStateLine);

  // For Tasks.tsx and ClosedSales.tsx, they might fetch in useEffect. We need to add refreshKey to deps.
  // We'll just look for `}, [userData]);` and replace with `}, [userData, refreshKey]);`
  content = content.replace(/}, \[userData\]\);/g, '}, [userData, refreshKey]);');
  content = content.replace(/}, \[userData, filterSeller\]\);/g, '}, [userData, filterSeller, refreshKey]);');

  const modalStr = /<ClientDetailModal\s+client={selectedClient}\s+onClose={\(\) => setSelectedClient\(null\)}\s*\/>/g;
  content = content.replace(modalStr, `<ClientDetailModal
          client={selectedClient}
          onClose={() => setSelectedClient(null)}
          onUpdated={() => setRefreshKey(prev => prev + 1)}
        />`);

  fs.writeFileSync(filePath, content);
  console.log('Fixed', filePath);
}

fixFile('src/pages/Tasks.tsx');
fixFile('src/pages/ClosedSales.tsx');
