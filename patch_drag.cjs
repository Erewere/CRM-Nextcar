const fs = require('fs');
let code = fs.readFileSync('src/pages/Kanban.tsx', 'utf8');

code = code.replace(
  `  const handleDragStart = (event: any) => {
    setActiveId(event.active.id);
    const client = clients.find((c) => c.id === event.active.id);
    if (client) {
      activeOriginalStatusRef.current = client.status || null;
    }
  };`,
  `  const activeColumnRef = React.useRef<any>(null);

  const handleDragStart = (event: any) => {
    setActiveId(event.active.id);
    
    if (event.active.data.current?.type === "Column") {
      activeColumnRef.current = event.active.data.current.column;
      return;
    }
    
    const client = clients.find((c) => c.id === event.active.id);
    if (client) {
      activeOriginalStatusRef.current = client.status || null;
    }
  };`
);

code = code.replace(
  `  const handleDragEnd = async (event: any) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;`,
  `  const handleDragEnd = async (event: any) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;
    
    if (active.data.current?.type === "Column" && userData?.agencyId) {
      const activeId = active.id.replace('col-', '');
      const overId = over.id.replace('col-', '');
      
      if (activeId !== overId) {
        const oldIndex = activeColumns.findIndex(c => c.id === activeId);
        const newIndex = activeColumns.findIndex(c => c.id === overId);
        
        if (oldIndex !== -1 && newIndex !== -1) {
          const newCols = arrayMove(activeColumns, oldIndex, newIndex);
          const finalCols = [...newCols, ...terminalColumns];
          setColumns(finalCols);
          try {
            await updateDoc(doc(db, "agencies", userData.agencyId), { pipelineStages: finalCols });
          } catch(e) {
            console.error(e);
          }
        }
      }
      return;
    }`
);

fs.writeFileSync('src/pages/Kanban.tsx', code);
