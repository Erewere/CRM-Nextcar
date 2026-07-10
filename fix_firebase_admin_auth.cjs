const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

if (!code.includes('import { getAuth } from "firebase-admin/auth"')) {
  code = code.replace(
    `import { initializeApp, App as FirebaseApp } from "firebase-admin/app";`,
    `import { initializeApp, App as FirebaseApp } from "firebase-admin/app";\nimport { getAuth } from "firebase-admin/auth";`
  );
}

code = code.replace(/getAdminApp\(\)\.auth\(\)/g, `getAuth(getAdminApp()!)`);
code = code.replace(/getAdminApp\(\)\.firestore\(\)/g, `getFirestore(getAdminApp()!)`);

fs.writeFileSync('server.ts', code);
