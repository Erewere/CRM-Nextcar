const fs = require('fs');
let content = fs.readFileSync('src/components/AiAdvisorPanel.tsx', 'utf8');

// Replace key={rec.clientId} with key={`${rec.clientId}-${idx}`}
content = content.replace(/key=\{rec\.clientId\}/g, "key={`${rec.clientId}-${idx}`}");

fs.writeFileSync('src/components/AiAdvisorPanel.tsx', content);
console.log('Fixed AiAdvisorPanel keys');
