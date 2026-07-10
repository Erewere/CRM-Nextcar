const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  `const adminDb = getAdminApp().firestore();`,
  `const adminDb = getFirestore(getAdminApp()!);`
);

code = code.replace(
  `const adminDb = getAdminApp().firestore();`,
  `const adminDb = getFirestore(getAdminApp()!);`
);

fs.writeFileSync('server.ts', code);
