const fs = require('fs');
let code = fs.readFileSync('src/pages/mobile/MobilePersons.tsx', 'utf8');

const replacement = `                <div className="flex items-center gap-3 w-full">
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold shrink-0">
                    {client.name.substring(0,2).toUpperCase()}
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight truncate">
                    {client.name}
                  </h3>
                </div>
              </div>
            </div>`;

// Delete everything between `<div className="flex items-center justify-between">` and the closing of the main card div.
const startStr = `<div className="flex items-center justify-between">`;
const endStr = `            </div>
          </div>
        ))}
        {filteredClients.length === 0`;

const startIdx = code.indexOf(startStr);
const endIdx = code.indexOf(endStr);

if (startIdx !== -1 && endIdx !== -1) {
  code = code.substring(0, startIdx + startStr.length) + '\n' + replacement + '\n' + code.substring(endIdx);
  fs.writeFileSync('src/pages/mobile/MobilePersons.tsx', code);
  console.log('Success');
} else {
  console.log('Not found');
}
