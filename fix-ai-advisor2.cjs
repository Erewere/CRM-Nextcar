const fs = require('fs');
let content = fs.readFileSync('src/components/AiAdvisorPanel.tsx', 'utf8');

content = content.replace(
  "import { Client, Task, PipelineStage }\nimport { auth } from \"../lib/firebase\"; from '../types';",
  "import { Client, Task, PipelineStage } from '../types';\nimport { auth } from \"../lib/firebase\";"
);

fs.writeFileSync('src/components/AiAdvisorPanel.tsx', content);
