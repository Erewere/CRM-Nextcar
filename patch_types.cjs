const fs = require('fs');
let content = fs.readFileSync('src/types.ts', 'utf8');

content = content.replace(
  `export interface Agency {
  id: string;
  name: string;
  phoneWhatsApp?: string;
  pipelineStages?: PipelineStage[];
  createdAt: string | Date;
}`,
  `export interface Agency {
  id: string;
  name: string;
  phoneWhatsApp?: string;
  pipelineStages?: PipelineStage[];
  businessHours?: { start: string; end: string };
  createdAt: string | Date;
}`
);

fs.writeFileSync('src/types.ts', content);
console.log('Fixed types.ts');
