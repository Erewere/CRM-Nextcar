const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const promptSearch = `notes: c.notes,
  tasks: (tasks || []).filter(t => t.clientId === c.id)`;
const promptReplace = `notes: c.notes ? c.notes.substring(0, 200) : "",
  tasks: (tasks || []).filter(t => t.clientId === c.id).map(t => ({ title: t.title, status: t.status, dueDate: t.dueDate }))`;
code = code.replace(promptSearch, promptReplace);

const parseSearch = `const text = response.text;
      const recommendations = JSON.parse(text);`;
const parseReplace = `const text = response.text;
      let cleanedText = text.trim();
      if (cleanedText.startsWith('\`\`\`json')) {
        cleanedText = cleanedText.replace(/^\`\`\`json/, '').replace(/\`\`\`$/, '').trim();
      } else if (cleanedText.startsWith('\`\`\`')) {
        cleanedText = cleanedText.replace(/^\`\`\`/, '').replace(/\`\`\`$/, '').trim();
      }
      
      const recommendations = JSON.parse(cleanedText);`;
code = code.replace(parseSearch, parseReplace);

fs.writeFileSync('server.ts', code);
