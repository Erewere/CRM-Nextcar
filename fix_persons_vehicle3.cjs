const fs = require('fs');
let personsContent = fs.readFileSync('src/pages/Persons.tsx', 'utf8');

const targetLines = personsContent.split('\n');
const idx = targetLines.findIndex(line => line.includes('<Phone className="w-3.5 h-3.5 flex-shrink-0" />'));

if (idx !== -1) {
  // It's line `idx`. The block ends at `idx + 2`.
  const insertIdx = idx + 3;
  
  const addition = `                    {(person.vehicle || person.dealTitle) && (
                      <div className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 mt-1.5">
                        <Car className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate font-semibold text-[11px] uppercase tracking-wider">{person.vehicle || person.dealTitle}</span>
                      </div>
                    )}`;
                    
  targetLines.splice(insertIdx, 0, addition);
  personsContent = targetLines.join('\n');
  
  if (!personsContent.includes('Car,') && !personsContent.includes(', Car')) {
    personsContent = personsContent.replace('FileSpreadsheet,', 'FileSpreadsheet,\n  Car,');
  }
  
  fs.writeFileSync('src/pages/Persons.tsx', personsContent);
  console.log('Fixed using array splice!');
} else {
  console.log('Not found via findIndex');
}

