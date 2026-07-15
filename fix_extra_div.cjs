const fs = require('fs');
let content = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

const targetStr = `          </Link>
        </div>
      </div>

      {selectedClient && (`;

content = content.replace(targetStr, `          </Link>
        </div>

      {selectedClient && (`);

fs.writeFileSync('src/pages/Dashboard.tsx', content);
console.log('Fixed extra div');
