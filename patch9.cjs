const fs = require('fs');
let content = fs.readFileSync('src/pages/Tasks.tsx', 'utf8');

content = content.replace(
  `            {/* Mobile List View */}
            <div className="md:hidden flex flex-col bg-white dark:bg-[#111] min-h-full pb-24">
              {sortedTasks.map(({ task, client }) => (`,
  `            {/* Mobile List View */}
            <div className="md:hidden flex flex-col bg-white dark:bg-[#111] min-h-full pb-24">
              {/* Add Task Row (Mobile) */}
              <div 
                className="flex items-center justify-between gap-4 p-4 border-b border-gray-100 dark:border-[#222] cursor-pointer"
                onClick={() => setShowNewTaskModal(true)}
              >
                <div className="flex items-center gap-4">
                  <div className="text-blue-500 shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path>
                      <path d="M12 8v8"></path>
                      <path d="M8 12h8"></path>
                    </svg>
                  </div>
                  <span className="text-[15px] font-medium tracking-wide text-blue-500">
                    Agregar una tarea
                  </span>
                </div>
                <button className="text-gray-400">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
                </button>
              </div>

              {sortedTasks.map(({ task, client }) => (`
);

fs.writeFileSync('src/pages/Tasks.tsx', content);
console.log('Patched Tasks.tsx to add mobile Add Task row');
