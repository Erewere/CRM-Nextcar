const fs = require('fs');
let lines = fs.readFileSync('src/pages/Inventory.tsx', 'utf8').split('\n');

const ReactImportIndex = lines.findIndex(l => l.startsWith('import React'));

// Lines 0 to ReactImportIndex - 1 are the bad injections
const injected = lines.slice(0, ReactImportIndex);
lines = lines.slice(ReactImportIndex);

// We know the injected lines are the two functions and the modal.
// The functions end at line: `  };` right before `      {showImportExcel && (`
let splitIdx = injected.findIndex(l => l.includes('{showImportExcel && ('));

const injectedFuncs = injected.slice(0, splitIdx);
const injectedModal = injected.slice(splitIdx);

// Now we insert injectedFuncs inside `export function Inventory() {` just before `useEffect`
const useEffectIdx = lines.findIndex(l => l.includes('useEffect(() => {'));
lines.splice(useEffectIdx, 0, ...injectedFuncs);

// And injectedModal right before the last `</div>`
const lastDivIdx = lines.lastIndexOf('    </div>');
lines.splice(lastDivIdx, 0, ...injectedModal);

fs.writeFileSync('src/pages/Inventory.tsx', lines.join('\n'));
