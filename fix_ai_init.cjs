const fs = require('fs');

let code = fs.readFileSync('server.ts', 'utf8');

const badInit = 'const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });';
code = code.replace(badInit, '');

const lazyInit = `
      let ai;
      try {
        ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      } catch(e) {
        return res.status(500).json({ error: "Gemini API key is invalid or missing" });
      }
`;

code = code.replace(/const \{ activeContacts, tasks, pipelineStages \} = req\.body;/, lazyInit + '\n      const { activeContacts, tasks, pipelineStages } = req.body;');

fs.writeFileSync('server.ts', code);
console.log("Fixed AI init");
