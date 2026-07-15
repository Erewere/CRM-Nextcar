const fs = require('fs');
let content = fs.readFileSync('src/pages/mobile/MobileHome.tsx', 'utf8');

content = content.replace(
  `combined.sort((a, b) => (a.task.time || "").localeCompare(b.task.time || ""));`,
  `combined.sort((a, b) => (a.task.startTime || "").localeCompare(b.task.startTime || ""));`
);

content = content.replace(
  `task.status === "completed"`,
  `task.completed === true`
);

content = content.replace(
  `{task.time && (`,
  `{task.startTime && (`
);

content = content.replace(
  `{task.time}`,
  `{task.startTime}`
);

fs.writeFileSync('src/pages/mobile/MobileHome.tsx', content);
console.log('Fixed MobileHome.tsx');
