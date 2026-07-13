const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

if (!code.includes('import { calculateLeadScore }')) {
  code = `import { calculateLeadScore } from "./src/services/leadScoringEngine.ts";\n` + code;
}

code = code.replace(/const { calculateLeadScore } = require\("\.\/src\/services\/leadScoringEngine\.ts"\);/g, '');
fs.writeFileSync('server.ts', code);
