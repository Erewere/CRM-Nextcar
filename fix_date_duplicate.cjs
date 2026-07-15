const fs = require('fs');
let content = fs.readFileSync('src/components/NewActivityModal.tsx', 'utf8');

content = content.replace(
  `                />
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="border border-gray-300 rounded p-1.5 text-sm w-32 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>`,
  `                />
              </div>`
);

fs.writeFileSync('src/components/NewActivityModal.tsx', content);
console.log('Fixed duplicated date in NewActivityModal');
