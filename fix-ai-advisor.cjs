const fs = require('fs');
let content = fs.readFileSync('src/components/AiAdvisorPanel.tsx', 'utf8');

if (!content.includes('import { auth }')) {
  content = content.replace('import { Client, Task, PipelineStage }', 'import { Client, Task, PipelineStage }\nimport { auth } from "../lib/firebase";');
}

content = content.replace(
/const handleAnalyzeWithAI = \(\) => \{[\s\S]*?fetch\("\/api\/ai-advisor", \{[\s\S]*?method: "POST",[\s\S]*?headers: \{ "Content-Type": "application\/json" \},/m,
`const handleAnalyzeWithAI = async () => {
    if (activeContacts.length === 0) return;
    setIsLoading(true);
    setErrorMsg(null);
    
    try {
      const token = await auth.currentUser?.getIdToken();
      
      const res = await fetch("/api/ai-advisor", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": \`Bearer \${token}\`
        },`
);

content = content.replace(
/    \}\)[\s\S]*?\.then\(res => \{[\s\S]*?if \(\!res\.ok\) \{[\s\S]*?return res\.json\(\)\.then\(err => \{ throw new Error\(err\.error \|\| 'Error calling AI'\); \}\);[\s\S]*?\}[\s\S]*?return res\.json\(\);[\s\S]*?\}\)[\s\S]*?\.then\(data => \{/,
`      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error calling AI');
      }
      const data = await res.json();
      
      if (data.recommendations && Array.isArray(data.recommendations)) {`
);

content = content.replace(
/setIsLoading\(false\);[\s\S]*?\}\)[\s\S]*?\.catch\(err => \{[\s\S]*?console\.error\(err\);[\s\S]*?setErrorMsg\(err\.message\);[\s\S]*?setIsLoading\(false\);[\s\S]*?\}\);/m,
`setIsLoading(false);
      } else {
         setErrorMsg("Respuesta inválida de AI.");
         setIsLoading(false);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message);
      setIsLoading(false);
    }`
);

fs.writeFileSync('src/components/AiAdvisorPanel.tsx', content);
