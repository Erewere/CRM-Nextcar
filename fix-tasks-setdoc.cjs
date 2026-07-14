const fs = require('fs');
let content = fs.readFileSync('src/pages/Tasks.tsx', 'utf8');

content = content.replace(
    /await updateDoc\(doc\(db, "clients", newTaskClientId\), {([\s\S]*?)}\)\.catch\(\(\) => {}\);/g,
    `await setDoc(doc(db, "clients", newTaskClientId), {$1}, { merge: true }).catch(() => {});`
);

content = content.replace(
    /await updateDoc\(doc\(db, "clients", finalClientId\), {([\s\S]*?)}\);/g,
    `await setDoc(doc(db, "clients", finalClientId), {$1}, { merge: true });`
);

fs.writeFileSync('src/pages/Tasks.tsx', content);
