const fs = require('fs');
let content = fs.readFileSync('src/pages/Tasks.tsx', 'utf8');

// Undo the bad patch
content = content.replace(
  `          }}
          />
        )}
      </AnimatePresence>
    </div>`,
  `          }}
        />
      )}
    </div>`
);

// Manually replace NewActivityModal properly
content = content.replace(
  `      {/* New/Edit Activity Modal */}
      <AnimatePresence>
        {(showNewTaskModal || editingTask) && (
          <NewActivityModal`,
  `      {/* New/Edit Activity Modal */}
      {(showNewTaskModal || editingTask) && (
        <NewActivityModal`
);

content = content.replace(
  `      {/* New/Edit Activity Modal */}
      {(showNewTaskModal || editingTask) && (
        <NewActivityModal`,
  `      {/* New/Edit Activity Modal */}
      <AnimatePresence>
        {(showNewTaskModal || editingTask) && (
          <NewActivityModal`
);

content = content.replace(
  `              console.error("Error creating task", e);
            }
          }}
        />
      )}

      {/* Client Detail Modal when clicking on a task */}`,
  `              console.error("Error creating task", e);
            }
          }}
          />
        )}
      </AnimatePresence>

      {/* Client Detail Modal when clicking on a task */}`
);

fs.writeFileSync('src/pages/Tasks.tsx', content);
console.log('Fixed Tasks.tsx AnimatePresence');
