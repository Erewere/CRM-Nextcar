const fs = require('fs');
let content = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

if (!content.includes('import { MobileClientDetail } from "./mobile/MobileClientDetail";')) {
  content = content.replace('import { MobileHome } from "./mobile/MobileHome";', 'import { MobileHome } from "./mobile/MobileHome";\nimport { MobileClientDetail } from "./mobile/MobileClientDetail";');
}

const isMobileReturnBlock = `
  if (isMobile) {
    return (
      <>
        <MobileHome 
          userName={userData?.name || userData?.email || "Asesor"}
          agencyId={userData?.agencyId || ""}
          clients={clients}
          activeContacts={activeContacts}
          tasks={tasks}
          pipelineStages={pipelineStages}
          onSelectClient={setSelectedClient}
        />
        {selectedClient && (
          <div className="fixed inset-0 z-[100] bg-slate-900">
             <MobileClientDetail
                client={selectedClient}
                onClose={() => setSelectedClient(null)}
                onUpdated={() => setRefreshKey((prev) => prev + 1)}
             />
          </div>
        )}
      </>
    );
  }

  return (
`;

content = content.replace('  return (\n    <div className="space-y-4 pb-8">', isMobileReturnBlock + '    <div className="space-y-4 pb-8">');

// We also need to remove `{isMobile ? (` occurrences in the JSX, wait, let me just check if I can remove them safely.
// Let's just leave the isMobile ternary logic as is, or remove it using a regex. 
// If isMobile is true, it returns early now, so the JSX logic for isMobile ? will never hit `true`.
// That means the code will just render the `false` branch in the main layout (which is desktop).
// We don't have to remove it immediately, but it's cleaner.

fs.writeFileSync('src/pages/Dashboard.tsx', content);
console.log('Updated Dashboard.tsx');
