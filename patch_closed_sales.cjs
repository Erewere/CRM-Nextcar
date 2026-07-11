const fs = require('fs');
let code = fs.readFileSync('src/pages/ClosedSales.tsx', 'utf8');

code = code.replace(
  'const wonClients = clients.filter(c => c.status === "won" && c.saleDetails);',
  'const wonClients = clients.filter(c => c.status === "won");'
);

const renderRowRegex = /const sale = client\.saleDetails;\n[\s\S]*?const utility = salePrice - costPlusExpenses;/;
const renderRowReplacement = `const sale = client.saleDetails;
                    const vehicleExpenses = expenses.filter(e => e.vehicleId === vehicle?.id);
                    const totalExpenses = vehicleExpenses.reduce((sum, e) => sum + e.amount, 0);
                    
                    const purchasePrice = vehicle?.purchasePrice || 0;
                    const salePrice = sale?.price || vehicle?.price || 0;
                    
                    const costPlusExpenses = purchasePrice + totalExpenses;
                    const utility = salePrice - costPlusExpenses;`;
code = code.replace(renderRowRegex, renderRowReplacement);

const methodRegex = /<span className="inline-flex items-center px-2 py-0\.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900\/30 dark:text-emerald-400 capitalize">\n\s*\{sale\.method\.replace\('_', ' '\)\}\n\s*<\/span>/;
const methodReplacement = `<span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 capitalize">
                            {sale?.method ? sale.method.replace('_', ' ') : 'N/A'}
                          </span>`;
code = code.replace(methodRegex, methodReplacement);

fs.writeFileSync('src/pages/ClosedSales.tsx', code);
