const fs = require('fs');
let personsContent = fs.readFileSync('src/pages/Persons.tsx', 'utf8');

const target = `{person.phone && (
                      <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-slate-400 mt-1">
                        <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">{person.phone}</span>
                      </div>
                    )}`;

const addition = `
                    {(person.vehicle || person.dealTitle) && (
                      <div className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 mt-1.5">
                        <Car className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate font-semibold text-[11px] uppercase tracking-wider">{person.vehicle || person.dealTitle}</span>
                      </div>
                    )}`;

if (personsContent.includes(target) && !personsContent.includes('person.vehicle || person.dealTitle')) {
  personsContent = personsContent.replace(target, target + addition);
  
  // Also add Car to imports
  if (!personsContent.includes('Car,') && !personsContent.includes(', Car')) {
    personsContent = personsContent.replace('FileSpreadsheet,', 'FileSpreadsheet,\n  Car,');
  }
  
  fs.writeFileSync('src/pages/Persons.tsx', personsContent);
  console.log('Fixed Persons.tsx');
} else {
  console.log('Target not found or already fixed.');
}
