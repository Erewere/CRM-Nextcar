const fs = require('fs');

function deduplicateDisplayClients(file) {
    if (!fs.existsSync(file)) return;
    let content = fs.readFileSync(file, 'utf8');

    // Dashboard.tsx
    if (file.includes('Dashboard.tsx')) {
        content = content.replace(
            /return \[\.\.\.dealClients, \.\.\.legacyClients\];/,
            `const allClients = [...dealClients, ...legacyClients];
    return Array.from(new Map(allClients.map(c => [c.id, c])).values());`
        );
    }
    // Kanban.tsx
    if (file.includes('Kanban.tsx')) {
        content = content.replace(
            /\];\n\n  const filteredClients =/g,
            `];\n  const deduplicatedClients = Array.from(new Map(displayClients.map(c => [c.id, c])).values());\n\n  const filteredClients =\n    selectedSellerId === "all" ? deduplicatedClients : deduplicatedClients.filter((c) => c.sellerId === selectedSellerId);`
        );
    }
    // ClosedSales.tsx
    if (file.includes('ClosedSales.tsx')) {
        content = content.replace(
            /const wonClients = displayClients\.filter\(c => isWon\(c\.status\)\);/g,
            `const deduplicatedClients = Array.from(new Map(displayClients.map(c => [c.id, c])).values());
  const wonClients = deduplicatedClients.filter(c => isWon(c.status));`
        );
    }

    fs.writeFileSync(file, content);
}

deduplicateDisplayClients('src/pages/Dashboard.tsx');
deduplicateDisplayClients('src/pages/Kanban.tsx');
deduplicateDisplayClients('src/pages/ClosedSales.tsx');
