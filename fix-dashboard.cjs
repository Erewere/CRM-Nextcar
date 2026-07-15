const fs = require('fs');
let code = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

// Import ClientDetailModal if not already
if (!code.includes('ClientDetailModal')) {
  code = code.replace(
    'import { AiAdvisorPanel } from "../components/AiAdvisorPanel";',
    'import { AiAdvisorPanel } from "../components/AiAdvisorPanel";\nimport { ClientDetailModal } from "../components/ClientDetailModal";'
  );
}

// Add state for selectedClient
if (!code.includes('selectedClient, setSelectedClient')) {
  code = code.replace(
    'const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);',
    'const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);\n  const [selectedClient, setSelectedClient] = useState<Client | null>(null);'
  );
}

// Render ClientDetailModal
if (!code.includes('<ClientDetailModal')) {
  code = code.replace(
    '    </div>\n  );\n}\n',
    '      {selectedClient && (\n        <ClientDetailModal\n          client={selectedClient}\n          onClose={() => setSelectedClient(null)}\n          onUpdated={() => {\n            // The snapshot listener handles the refresh\n          }}\n        />\n      )}\n    </div>\n  );\n}\n'
  );
}

// Change Link for wanted vehicles
code = code.replace(
  /<Link to="\/persons" state=\{\{ clientId: client.id \}\} key=\{client.id\} className="block p-4/g,
  '<button onClick={() => setSelectedClient(client)} key={client.id} className="block text-left w-full p-4'
);
code = code.replace(
  /                  <\/p>\n                <\/Link>/g,
  '                  </p>\n                </button>'
);

// Change Link for recently added
code = code.replace(
  /<Link\n                  to="\/persons"\n                  state=\{\{ clientId: client.id \}\}\n                  key=\{client.id\}\n                  className="bg-slate-50/g,
  '<button\n                  onClick={() => setSelectedClient(client)}\n                  key={client.id}\n                  className="block text-left w-full bg-slate-50'
);
code = code.replace(
  /                  <\/div>\n                <\/Link>/g,
  '                  </div>\n                </button>'
);

fs.writeFileSync('src/pages/Dashboard.tsx', code);
