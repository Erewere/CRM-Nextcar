const fs = require('fs');
let content = fs.readFileSync('src/components/AiAdvisorPanel.tsx', 'utf8');

content = content.replace(
/body: JSON\.stringify\(\{\n\s*agencyId,\n\s*activeContacts: activeContacts\.slice\(0, 10\),\n\s*tasks,\n\s*pipelineStages\n\s*\}\);\n\s*if \(\!res\.ok\) \{/,
`body: JSON.stringify({
          agencyId,
          activeContacts: activeContacts.slice(0, 10),
          tasks,
          pipelineStages
        })
      });
      if (!res.ok) {`
);
fs.writeFileSync('src/components/AiAdvisorPanel.tsx', content);
