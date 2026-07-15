const fs = require('fs');
let code = fs.readFileSync('src/pages/mobile/MobileHome.tsx', 'utf8');

// Import MobileClientDetail
if (!code.includes('MobileClientDetail')) {
  code = code.replace(
    'import clsx from "clsx";',
    'import clsx from "clsx";\nimport { MobileClientDetail } from "./MobileClientDetail";'
  );
}

// Add state for selectedClient
if (!code.includes('selectedClient, setSelectedClient')) {
  code = code.replace(
    'const [loading, setLoading] = useState(true);',
    'const [loading, setLoading] = useState(true);\n  const [selectedClient, setSelectedClient] = useState<Client | null>(null);'
  );
}

// Render MobileClientDetail
if (!code.includes('<MobileClientDetail')) {
  code = code.replace(
    '    </div>\n  );\n}\n',
    '      {selectedClient && (\n        <div className="fixed inset-0 z-[100] bg-slate-900">\n          <MobileClientDetail\n            client={selectedClient}\n            onClose={() => setSelectedClient(null)}\n            onUpdated={() => { /* Fetch handled by listeners elsewhere or we could reload */ }}\n          />\n        </div>\n      )}\n    </div>\n  );\n}\n'
  );
}

// Make task cards clickable
code = code.replace(
  '                <div className="flex items-start gap-3">',
  '                <div className="flex items-start gap-3" onClick={() => client && setSelectedClient(client)}>'
);

// We should also adjust the task click handler so clicking the card opens the client, but clicking the checkmark toggles status
// We need to prevent event bubbling on the checkmark button
code = code.replace(
  'onClick={() => toggleTaskStatus(task)}',
  'onClick={(e) => { e.stopPropagation(); toggleTaskStatus(task); }}'
);

fs.writeFileSync('src/pages/mobile/MobileHome.tsx', code);
