const fs = require('fs');
let content = fs.readFileSync('src/pages/Kanban.tsx', 'utf8');

content = content.replace(
    /await updateDoc\(doc\(db, "deals", clientId\), updates\);/g,
    `await setDoc(doc(db, "deals", clientId), updates, { merge: true });`
);

content = content.replace(
    /await updateDoc\(doc\(db, "deals", client\.id\), updates\);/g,
    `await setDoc(doc(db, "deals", client.id), updates, { merge: true });`
);

fs.writeFileSync('src/pages/Kanban.tsx', content);
