const fs = require('fs');
let content = fs.readFileSync('src/pages/Tasks.tsx', 'utf8');

content = content.replace(
    /await setDoc\(doc\(db, "deals", finalDealId\), \{\n\s*clientId: finalClientId, \}, \{ merge: true \}\n\s*\}\);/g,
    `await setDoc(doc(db, "deals", finalDealId), {\n                    clientId: finalClientId,\n                  }, { merge: true });`
);

fs.writeFileSync('src/pages/Tasks.tsx', content);
