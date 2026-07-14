const fs = require('fs');
let code = fs.readFileSync('src/pages/mobile/MobileClientDetail.tsx', 'utf8');

// Add notes state and fetch
code = code.replace(
  `  const [noteSuccess, setNoteSuccess] = useState(false);`,
  `  const [noteSuccess, setNoteSuccess] = useState(false);
  const [notes, setNotes] = useState<any[]>([]);

  useEffect(() => {
    const loadNotes = async () => {
      try {
        const q = query(collection(db, "notes"), where("clientId", "==", client.id));
        const s = await getDocs(q);
        const n = s.docs.map((d) => ({ id: d.id, ...d.data() }) as any);
        n.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setNotes(n);
      } catch (error) {
        console.error("Error loading notes:", error);
      }
    };
    loadNotes();
  }, [client.id]);`
);

// We need to refresh notes after adding a new one
code = code.replace(
  `      setTimeout(() => setNoteSuccess(false), 2000);
      onUpdated();
    } catch (err) {`,
  `      setTimeout(() => setNoteSuccess(false), 2000);
      onUpdated();
      
      // refresh notes
      const q = query(collection(db, "notes"), where("clientId", "==", client.id));
      const s = await getDocs(q);
      const n = s.docs.map((d) => ({ id: d.id, ...d.data() }) as any);
      n.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setNotes(n);
    } catch (err) {`
);

// Style the pipeline stages. Currently they are:
// <div className="bg-white dark:bg-slate-800 p-6 mb-2 shadow-sm border-y border-slate-200 dark:border-slate-700">
//   <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-3">Etapa del Embudo</h3>
//   <div className="flex overflow-x-auto pb-2 -mx-2 px-2 snap-x hide-scrollbar gap-2">
const stageTarget = `<div className="bg-white dark:bg-slate-800 p-6 mb-2 shadow-sm border-y border-slate-200 dark:border-slate-700">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-3">Etapa del Embudo</h3>
          <div className="flex overflow-x-auto pb-2 -mx-2 px-2 snap-x hide-scrollbar gap-2">
            {pipelineStages.map((stage) => {
              const isActive = currentStatus === stage.id;
              return (
                <button
                  key={stage.id}
                  onClick={() => handleStatusChange(stage.id)}
                  className={clsx(
                    "shrink-0 snap-center px-4 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap transition-all border",
                    isActive 
                      ? "bg-blue-600 border-blue-600 text-white shadow-md" 
                      : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-blue-400"
                  )}
                >
                  {stage.title || stage.name}
                </button>
              );
            })}
          </div>
        </div>`;

const stageReplacement = `        <div className="bg-white dark:bg-slate-800 p-4 mb-2 shadow-sm border-y border-slate-200 dark:border-slate-700">
          <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Etapa del Embudo</h3>
          <div className="flex overflow-x-auto pb-2 -mx-4 px-4 snap-x hide-scrollbar gap-2 scroll-smooth">
            {pipelineStages.map((stage, idx) => {
              const isActive = currentStatus === stage.id;
              const isPast = pipelineStages.findIndex(s => s.id === currentStatus) > idx;
              return (
                <button
                  key={stage.id}
                  onClick={() => handleStatusChange(stage.id)}
                  className={clsx(
                    "flex items-center shrink-0 snap-center px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all",
                    isActive 
                      ? "bg-blue-600 text-white shadow-md ring-2 ring-blue-600 ring-offset-2 dark:ring-offset-slate-800" 
                      : isPast
                        ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800/50"
                        : "bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-blue-400"
                  )}
                >
                  {stage.title || stage.name}
                </button>
              );
            })}
          </div>
        </div>`;

code = code.replace(stageTarget, stageReplacement);

// Display the notes below the quick note section
const endTarget = `          </div>
        </div>
      </div>
    </div>`;

const endReplacement = `          </div>
        </div>

        {/* Historial (Notas) */}
        <div className="bg-white dark:bg-slate-800 p-6 mb-2 shadow-sm border-y border-slate-200 dark:border-slate-700">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4">Historial</h3>
          {notes.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">No hay registros en el historial.</p>
          ) : (
            <div className="space-y-4">
              {notes.map(note => (
                <div key={note.id} className="relative pl-4 border-l-2 border-slate-200 dark:border-slate-700 pb-2 last:border-0 last:pb-0">
                  <div className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600" />
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      {note.createdByName || "Usuario"}
                    </span>
                    <span className="text-xs text-slate-400">
                      {format(new Date(note.createdAt), "dd MMM, HH:mm")}
                    </span>
                  </div>
                  <p className="text-sm text-slate-800 dark:text-slate-200">{note.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>`;

code = code.replace(endTarget, endReplacement);
fs.writeFileSync('src/pages/mobile/MobileClientDetail.tsx', code);
