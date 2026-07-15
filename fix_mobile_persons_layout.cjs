const fs = require('fs');
let content = fs.readFileSync('src/pages/mobile/MobilePersons.tsx', 'utf8');

const target = `<h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight truncate">
                    {client.name}
                  </h3>
                  {(client.vehicle || client.dealTitle) && (
                    <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400 mt-1">
                      <Car className="w-3.5 h-3.5 shrink-0" />
                      <span className="text-xs font-bold uppercase tracking-wider truncate">{client.vehicle || client.dealTitle}</span>
                    </div>
                  )}`;
                  
const replacement = `<div className="flex flex-col overflow-hidden">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight truncate">
                      {client.name}
                    </h3>
                    {(client.vehicle || client.dealTitle) && (
                      <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400 mt-1">
                        <Car className="w-3.5 h-3.5 shrink-0" />
                        <span className="text-xs font-bold uppercase tracking-wider truncate">{client.vehicle || client.dealTitle}</span>
                      </div>
                    )}
                  </div>`;

if (content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync('src/pages/mobile/MobilePersons.tsx', content);
  console.log('Fixed mobile persons layout');
} else {
  console.log('Not found');
}
