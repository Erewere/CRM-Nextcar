const fs = require('fs');
let content = fs.readFileSync('src/pages/Persons.tsx', 'utf8');

// Add refreshKey to state
const stateLine = `const [importingContacts, setImportingContacts] = useState(false);`;
const newStateLine = `const [importingContacts, setImportingContacts] = useState(false);\n  const [refreshKey, setRefreshKey] = useState(0);`;
content = content.replace(stateLine, newStateLine);

// Add refreshKey to dependency array
const effectStart = `useEffect(() => {
    if (!userData || userData.role === "master") return;`;
const effectDep = `  }, [userData]);`;
const updatedEffectDep = `  }, [userData, refreshKey]);`;

content = content.replace(effectDep, updatedEffectDep);

// Pass onUpdated to ClientDetailModal
const targetModal = `<ClientDetailModal
          client={selectedPerson}
          onClose={() => setSelectedPerson(null)}
        />`;
const replacementModal = `<ClientDetailModal
          client={selectedPerson}
          onClose={() => setSelectedPerson(null)}
          onUpdated={() => setRefreshKey(prev => prev + 1)}
        />`;
content = content.replace(targetModal, replacementModal);

fs.writeFileSync('src/pages/Persons.tsx', content);
console.log('Fixed Persons.tsx refresh');
