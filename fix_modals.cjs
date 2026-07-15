const fs = require('fs');
let content = fs.readFileSync('src/pages/mobile/MobilePersons.tsx', 'utf8');

const modalStr = `      {historyClient && (
        <MobileClientDetail 
           client={historyClient} 
           onClose={() => setHistoryClient(null)} 
           onUpdated={fetchClients}
           scrollToHistory={true}
        />
      )}
      {taskClient && (
        <NewActivityModal
          onClose={() => setTaskClient(null)}
          onSave={() => { setTaskClient(null); fetchClients(); }}
          clients={clients}
          currentUser={userData}
          initialData={{ clientId: taskClient.id }}
        />
      )}
      {stageClient && (
        <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-black/60 p-4" onClick={() => setStageClient(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white">Cambiar Etapa</h3>
              <button onClick={() => setStageClient(null)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-2 max-h-[60vh] overflow-y-auto">
              {pipelineStages.map(stage => (
                <button
                  key={stage.id}
                  onClick={async () => {
                    try {
                      await updateDoc(doc(db, "clients", stageClient.id), { status: stage.id, updatedAt: new Date().toISOString() });
                      setStageClient(null);
                      fetchClients();
                    } catch (err) {
                      console.error(err);
                    }
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl font-medium text-slate-700 dark:text-slate-300 transition-colors flex items-center justify-between"
                >
                  {stage.title}
                  {stageClient.status === stage.id && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}`;

content = content.replace(/    <\/div>\n  \};\n\}/, modalStr + '\n    </div>\n  );\n}');

if (!content.includes('{historyClient && (')) {
  // alternative replace strategy
  const parts = content.split('    </div>\n  );\n}');
  if (parts.length === 2) {
    content = parts[0] + modalStr + '\n    </div>\n  );\n}';
  }
}

fs.writeFileSync('src/pages/mobile/MobilePersons.tsx', content);
console.log('Fixed modals');
