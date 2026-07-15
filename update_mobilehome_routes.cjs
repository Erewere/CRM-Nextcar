const fs = require('fs');
let content = fs.readFileSync('src/pages/mobile/MobileHome.tsx', 'utf8');

content = content.replace(
  `onClick={() => navigate('/tasks')}`,
  `onClick={() => navigate('/tasks', { state: { filterDate: 'overdue', filterStatus: ['pending'] } })}`
);
content = content.replace(
  `onClick={() => navigate('/tasks')}`,
  `onClick={() => navigate('/tasks', { state: { filterDate: 'today', filterType: 'meeting', filterStatus: ['pending'] } })}`
);
content = content.replace(
  `onClick={() => navigate('/tasks')}`,
  `onClick={() => navigate('/tasks', { state: { filterDate: 'today', filterStatus: ['pending'] } })}`
);

fs.writeFileSync('src/pages/mobile/MobileHome.tsx', content);
console.log('Updated MobileHome routes');
