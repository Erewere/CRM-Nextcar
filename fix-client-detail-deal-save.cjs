const fs = require('fs');
let content = fs.readFileSync('src/components/ClientDetailModal.tsx', 'utf8');

content = content.replace(
    /if \(client\.originalClientId\) \{/g,
    `if (client.originalClientId && client.originalClientId !== client.id) {`
);

fs.writeFileSync('src/components/ClientDetailModal.tsx', content);
