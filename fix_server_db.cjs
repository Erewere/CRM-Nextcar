const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  `return getClientFirestore(clientApp);`,
  `return getClientFirestore(clientApp, "ai-studio-e65d5185-219a-4e1d-a330-044b1109696a");`
);

fs.writeFileSync('server.ts', code);
