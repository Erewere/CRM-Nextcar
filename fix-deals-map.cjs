const fs = require('fs');

function fixDealsMap(file) {
    if (!fs.existsSync(file)) return;
    let content = fs.readFileSync(file, 'utf8');

    content = content.replace(
        /originalClientId: person\.id,/g,
        `originalClientId: deal.clientId,`
    );

    fs.writeFileSync(file, content);
}

fixDealsMap('src/pages/Dashboard.tsx');
fixDealsMap('src/pages/Kanban.tsx');
fixDealsMap('src/pages/ClosedSales.tsx');
