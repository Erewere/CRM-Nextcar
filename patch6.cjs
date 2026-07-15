const fs = require('fs');
let content = fs.readFileSync('src/pages/Tasks.tsx', 'utf8');

if (!content.includes('import { AnimatePresence }')) {
  content = content.replace(
    `import React, { useEffect, useState, useMemo } from "react";`,
    `import React, { useEffect, useState, useMemo } from "react";\nimport { AnimatePresence } from "motion/react";`
  );
}

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
  `          onSave={async (taskData) => {`,
  `            onSave={async (taskData) => {`
);

content = content.replace(
  `          }}
        />
      )}
    </div>`,
  `          }}
          />
        )}
      </AnimatePresence>
    </div>`
);

fs.writeFileSync('src/pages/Tasks.tsx', content);
console.log('Patched Tasks.tsx for AnimatePresence');
