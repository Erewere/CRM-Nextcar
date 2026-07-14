const fs = require('fs');
let code = fs.readFileSync('src/pages/mobile/MobilePersons.tsx', 'utf8');

const target = `                </div>
              </div>
            </div>
            </div>
          </div>
        ))}
        {filteredClients.length === 0`;

const replacement = `                </div>
              </div>
            </div>
          </div>
        ))}
        {filteredClients.length === 0`;

code = code.replace(target, replacement);
fs.writeFileSync('src/pages/mobile/MobilePersons.tsx', code);
