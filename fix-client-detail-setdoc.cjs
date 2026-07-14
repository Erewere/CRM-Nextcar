const fs = require('fs');
let content = fs.readFileSync('src/components/ClientDetailModal.tsx', 'utf8');

content = content.replace(
    /await updateDoc\(doc\(db, "clients", \(client\.originalClientId \|\| client\.id\) as string\), ([a-zA-Z0-9_]+)\);/g,
    `await setDoc(doc(db, "clients", (client.originalClientId || client.id) as string), $1, { merge: true });`
);

fs.writeFileSync('src/components/ClientDetailModal.tsx', content);
