const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  `import admin from "firebase-admin";`,
  `import { initializeApp, App as FirebaseApp } from "firebase-admin/app";\nimport { getFirestore, FieldValue, Firestore } from "firebase-admin/firestore";`
);

code = code.replace(
  `let adminApp: admin.app.App | null = null;`,
  `let adminApp: FirebaseApp | null = null;`
);

code = code.replace(
  `      adminApp = admin.initializeApp({`,
  `      adminApp = initializeApp({`
);

code = code.replace(
  `      adminApp = admin.initializeApp();`,
  `      adminApp = initializeApp();`
);

code = code.replace(/admin\.firestore\.FieldValue/g, `FieldValue`);
code = code.replace(/admin\.firestore\.Firestore/g, `Firestore`);

fs.writeFileSync('server.ts', code);
