const fs = require('fs');
let code = fs.readFileSync('src/pages/Kanban.tsx', 'utf8');

code = code.replace(
  `  const [columns, setColumns] = useState<PipelineStage[]>(DEFAULT_COLUMNS);`,
  `  const [columns, setColumns] = useState<PipelineStage[]>(DEFAULT_COLUMNS);
  const [newColumnId, setNewColumnId] = useState<string | null>(null);`
);

code = code.replace(
  `                    onMoveRight={async () => {
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
                  />`,
  `                    onMoveRight={async () => {
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
                    autoFocusEdit={newColumnId === col.id}
                    onAddRight={async () => {
                      if (!userData?.agencyId) return;
                      const newId = \`stage_\${Date.now()}\`;
                      const newStage = { id: newId, title: "Nueva Etapa" };
                      const newCols = [...activeColumns];
                      newCols.splice(index + 1, 0, newStage);
                      const finalCols = [...newCols, ...terminalColumns];
                      setColumns(finalCols);
                      setNewColumnId(newId);
                      try {
                        await updateDoc(doc(db, "agencies", userData.agencyId), { pipelineStages: finalCols });
                      } catch (e) {
                        console.error(e);
                      }
                    }}
                  />`
);

fs.writeFileSync('src/pages/Kanban.tsx', code);
