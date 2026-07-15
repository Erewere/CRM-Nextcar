const fs = require('fs');
let personsContent = fs.readFileSync('src/pages/Persons.tsx', 'utf8');

personsContent = personsContent.replace(`                      </div>
                    {(person.vehicle || person.dealTitle) && (`, `                      </div>
                    )}
                    {(person.vehicle || person.dealTitle) && (`);

personsContent = personsContent.replace(`                    )}
                    )}
                    {matches.length > 0 && (`, `                    )}
                    {matches.length > 0 && (`);

fs.writeFileSync('src/pages/Persons.tsx', personsContent);
console.log('Fixed syntax');
