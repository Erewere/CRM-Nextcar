const fs = require('fs');
let content = fs.readFileSync('src/pages/Kanban.tsx', 'utf8');

content = content.replace(
    /title: \`Trato con \$\{client\.name\}\`,\n\s*value: 0/g,
    `title: \`Trato con \$\{client.name\}\`,\n            value: client.dealValue ? Number(client.dealValue) : 0,\n            vehicle: client.vehicle || null,\n            vehicleId: client.vehicleId || null`
);

fs.writeFileSync('src/pages/Kanban.tsx', content);
