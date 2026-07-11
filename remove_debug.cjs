const fs = require('fs');

let dashboard = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');
const debugRegexDash = /\s*<div className="bg-red-100 text-red-800 p-4 rounded mb-4">[\s\S]*?<\/div>\n/;
dashboard = dashboard.replace(debugRegexDash, '');
fs.writeFileSync('src/pages/Dashboard.tsx', dashboard);

let closedSales = fs.readFileSync('src/pages/ClosedSales.tsx', 'utf8');
const debugRegexClosed = /\s*<div className="bg-red-100 p-2 text-xs">[\s\S]*?<\/div>\n/;
closedSales = closedSales.replace(debugRegexClosed, '');
fs.writeFileSync('src/pages/ClosedSales.tsx', closedSales);

