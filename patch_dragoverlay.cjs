const fs = require('fs');
let code = fs.readFileSync('src/pages/Kanban.tsx', 'utf8');

code = code.replace(
  `          <DragOverlay zIndex={50} dropAnimation={null}>
            {activeClient ? (
              <div className="w-[250px] shadow-2xl opacity-100 rotate-1">
                <ClientCard
                  client={activeClient}
                  tasks={tasks.filter((t) => t.clientId === activeClient.id)}
                />
              </div>
            ) : null}
          </DragOverlay>`,
  `          <DragOverlay zIndex={50} dropAnimation={null}>
            {activeClient ? (
              <div className="w-[250px] shadow-2xl opacity-100 rotate-1">
                <ClientCard
                  client={activeClient}
                  tasks={tasks.filter((t) => t.clientId === activeClient.id)}
                />
              </div>
            ) : activeColumnRef.current ? (
              <div className="w-[270px] shadow-2xl opacity-100 rotate-2">
                <div className="flex flex-col px-4 py-3 shrink-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 relative">
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[14px] font-bold text-slate-800 dark:text-slate-100">{activeColumnRef.current.title}</span>
                  </div>
                </div>
              </div>
            ) : null}
          </DragOverlay>`
);

fs.writeFileSync('src/pages/Kanban.tsx', code);
