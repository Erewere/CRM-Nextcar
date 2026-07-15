const fs = require('fs');
let content = fs.readFileSync('src/pages/mobile/MobileTasks.tsx', 'utf8');

content = content.replace(
  `        <NewActivityModal
          onClose={() => setShowNewTaskModal(false)}
          onSave={fetchTasks}
        />`,
  `        <NewActivityModal
          onClose={() => setShowNewTaskModal(false)}
          onSave={fetchTasks}
          clients={[]}
          currentUser={userData}
        />`
);

fs.writeFileSync('src/pages/mobile/MobileTasks.tsx', content);
console.log('Fixed MobileTasks.tsx');
