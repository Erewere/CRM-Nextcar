const fs = require('fs');

// 1. Fix Persons.tsx
let personsContent = fs.readFileSync('src/pages/Persons.tsx', 'utf8');

// Add Car icon to import
if (!personsContent.includes('Car,') && !personsContent.includes(', Car') && personsContent.includes('lucide-react')) {
  personsContent = personsContent.replace('FileSpreadsheet,', 'FileSpreadsheet,\n  Car,');
}

// Add vehicle to grid view
const gridPhoneMatch = `{person.phone && (
                      <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-slate-400 mt-1">
                        <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">{person.phone}</span>
                      </div>
                    )}`;

const vehicleGridAddition = `
                    {(person.vehicle || person.dealTitle) && (
                      <div className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 mt-1.5">
                        <Car className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate font-semibold text-xs uppercase tracking-wider">{person.vehicle || person.dealTitle}</span>
                      </div>
                    )}
                    {matches && matches.length > 0 && (
                      <div className="mt-1.5">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-[10px] font-bold border border-green-200 dark:border-green-800/50 uppercase tracking-wider">
                          {matches.length} {matches.length === 1 ? 'Match' : 'Matches'}
                        </span>
                      </div>
                    )}
`;

if (personsContent.includes(gridPhoneMatch) && !personsContent.includes('person.vehicle || person.dealTitle')) {
  personsContent = personsContent.replace(gridPhoneMatch, gridPhoneMatch + vehicleGridAddition);
  fs.writeFileSync('src/pages/Persons.tsx', personsContent);
  console.log('Fixed Persons.tsx');
} else {
  console.log('Could not find gridPhoneMatch in Persons.tsx or already fixed');
}

// 2. Fix MobilePersons.tsx
let mobilePersonsContent = fs.readFileSync('src/pages/mobile/MobilePersons.tsx', 'utf8');

if (!mobilePersonsContent.includes('Car') && mobilePersonsContent.includes('lucide-react')) {
  mobilePersonsContent = mobilePersonsContent.replace('User } from', 'User, Car } from');
}

// We need to fetch vehicles in MobilePersons.tsx to compute matches, wait!
// The user said "los autos que esta buscando las personas", not necessarily matches, but it's good to have them.
// Let's just add the vehicle string in MobilePersons.tsx first.

const mobileClientCardMatch = `<h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight truncate">
                    {client.name}
                  </h3>`;

const mobileVehicleAddition = `
                  <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight truncate">
                    {client.name}
                  </h3>
                  {(client.vehicle || client.dealTitle) && (
                    <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400 mt-1">
                      <Car className="w-3.5 h-3.5 shrink-0" />
                      <span className="text-xs font-bold uppercase tracking-wider truncate">{client.vehicle || client.dealTitle}</span>
                    </div>
                  )}
`;

if (mobilePersonsContent.includes(mobileClientCardMatch) && !mobilePersonsContent.includes('client.vehicle || client.dealTitle')) {
  mobilePersonsContent = mobilePersonsContent.replace(mobileClientCardMatch, mobileVehicleAddition);
  fs.writeFileSync('src/pages/mobile/MobilePersons.tsx', mobilePersonsContent);
  console.log('Fixed MobilePersons.tsx');
} else {
  console.log('Could not find mobileClientCardMatch in MobilePersons.tsx or already fixed');
}

