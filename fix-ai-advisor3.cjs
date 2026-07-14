const fs = require('fs');
let content = fs.readFileSync('src/components/AiAdvisorPanel.tsx', 'utf8');

content = content.replace(
  "        pipelineStages\n      });",
  "        pipelineStages\n      })});"
);

fs.writeFileSync('src/components/AiAdvisorPanel.tsx', content);
