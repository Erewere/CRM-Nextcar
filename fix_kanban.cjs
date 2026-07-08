const fs = require('fs');
let code = fs.readFileSync('src/pages/Kanban.tsx', 'utf8');

code = code.replace(/      \/\/ we only need to persist to Firebase if the status is different from start\s+try \{\s+\/\/ we only need to persist to Firebase if the status is different from start\s+try \{/, `      // we only need to persist to Firebase if the status is different from start\n      try {`);

fs.writeFileSync('src/pages/Kanban.tsx', code);
