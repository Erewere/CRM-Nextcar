const fs = require('fs');
let code = fs.readFileSync('src/pages/Kanban.tsx', 'utf8');

code = code.replace(
  `import { KanbanColumn } from "../components/KanbanColumn";`,
  `import { KanbanColumn } from "../components/KanbanColumn";
import { SortableKanbanColumn } from "../components/SortableKanbanColumn";`
);

code = code.replace(
  `          <div className="flex overflow-x-auto snap-x snap-mandatory md:snap-none items-stretch bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
            {activeColumns.map((col) => {
              const columnClients = filteredClients.filter(
                (c) => c.status === col.id,
              );
              return (
                <KanbanColumn
                  key={col.id}
                  column={col}
                  clients={columnClients}
                  onClientClick={setSelectedClient}
                  tasks={tasks}
                />
              );
            })}
          </div>`,
  `          <div className="flex overflow-x-auto snap-x snap-mandatory md:snap-none items-stretch bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
            <SortableContext items={activeColumns.map(c => \`col-\${c.id}\`)} strategy={horizontalListSortingStrategy}>
              {activeColumns.map((col, index) => {
                const columnClients = filteredClients.filter(
                  (c) => c.status === col.id,
                );
                return (
                  <SortableKanbanColumn
                    key={col.id}
                    column={col}
                    clients={columnClients}
                    onClientClick={setSelectedClient}
                    tasks={tasks}
                    isFirst={index === 0}
                    isLast={index === activeColumns.length - 1}
                    onTitleChange={async (newTitle) => {
                      if (!userData?.agencyId) return;
                      const newColumns = columns.map(c => c.id === col.id ? { ...c, title: newTitle } : c);
                      setColumns(newColumns); // optimistic update
                      try {
                        await updateDoc(doc(db, "agencies", userData.agencyId), { pipelineStages: newColumns });
                      } catch (e) {
                        console.error(e);
                      }
                    }}
                    onMoveLeft={async () => {
                      if (index > 0 && userData?.agencyId) {
                        const newCols = [...activeColumns];
                        const temp = newCols[index];
                        newCols[index] = newCols[index - 1];
                        newCols[index - 1] = temp;
                        const finalCols = [...newCols, ...terminalColumns];
                        setColumns(finalCols);
                        await updateDoc(doc(db, "agencies", userData.agencyId), { pipelineStages: finalCols });
                      }
                    }}
                    onMoveRight={async () => {
                      if (index < activeColumns.length - 1 && userData?.agencyId) {
                        const newCols = [...activeColumns];
                        const temp = newCols[index];
                        newCols[index] = newCols[index + 1];
                        newCols[index + 1] = temp;
                        const finalCols = [...newCols, ...terminalColumns];
                        setColumns(finalCols);
                        await updateDoc(doc(db, "agencies", userData.agencyId), { pipelineStages: finalCols });
                      }
                    }}
                  />
                );
              })}
            </SortableContext>
          </div>`
);

fs.writeFileSync('src/pages/Kanban.tsx', code);
