const fs = require('fs');
const content = fs.readFileSync('src/pages/Persons.tsx', 'utf8');
const lines = content.split('\n');

const statsStart = lines.findIndex(l => l.includes('const getPersonStats ='));
let statsEnd = statsStart;
let bracketCount = 0;
for (let i = statsStart; i < lines.length; i++) {
  const openCount = (lines[i].match(/\{/g) || []).length;
  const closeCount = (lines[i].match(/\}/g) || []).length;
  bracketCount += openCount - closeCount;
  if (bracketCount === 0 && i > statsStart) {
    statsEnd = i;
    break;
  }
}

const statsFunc = lines.slice(statsStart, statsEnd + 1);

const filterStart = lines.findIndex(l => l.includes('const filteredPersons = React.useMemo('));

// remove from old pos
const newLines = [...lines.slice(0, statsStart), ...lines.slice(statsEnd + 1)];

// insert before filterStart
const realFilterStart = newLines.findIndex(l => l.includes('const filteredPersons = React.useMemo('));
newLines.splice(realFilterStart, 0, ...statsFunc);

fs.writeFileSync('src/pages/Persons.tsx', newLines.join('\n'));
