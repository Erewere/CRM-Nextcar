const fs = require('fs');
let content = fs.readFileSync('src/components/AiAdvisorPanel.tsx', 'utf8');

// just remove everything from the .catch that I accidentally left
content = content.replace(
/\s*\n\s*\.catch\(err => \{ console\.error\(err\); setErrorMsg\(err\.message \|\| "Error al obtener recomendaciones"\); \}\)\n\s*\.finally\(\(\) => setIsLoading\(false\)\);/,
""
);

// wait let's just make sure there are no dangling })
content = content.replace(
/\}\)\n\s*\.catch\(err/g,
"} catch(err"
);

fs.writeFileSync('src/components/AiAdvisorPanel.tsx', content);
