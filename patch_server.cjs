const fs = require('fs');

let code = fs.readFileSync('server.ts', 'utf8');

const importStr = `import { GoogleGenAI, Type } from "@google/genai";\nconst ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });\n`;
if (!code.includes('@google/genai')) {
  code = code.replace(/import express from "express";/, `import express from "express";\n` + importStr);
}

const apiRoute = `
  app.post("/api/ai-advisor", express.json(), async (req, res) => {
    try {
      if (!process.env.GEMINI_API_KEY) {
         return res.status(500).json({ error: "Gemini API key is missing" });
      }
      const { activeContacts, tasks, pipelineStages } = req.body;
      
      const prompt = \`
You are "IA Erewere", an expert sales advisor for a car dealership.
Analyze the following active contacts, their tasks/notes, and the pipeline stages.
Identify up to 6 of the most critical actions to take to close deals.
Take into account:
1. How far along the pipeline stage they are (closer to the end = higher closing probability).
2. The notes and follow-ups in their tasks.
3. Overdue or pending tasks.

Pipeline Stages:
\${JSON.stringify(pipelineStages)}

Active Contacts:
\${JSON.stringify(activeContacts)}

Tasks/Notes:
\${JSON.stringify(tasks)}

Return a JSON array of recommendation objects with the following schema:
- clientId (string)
- clientName (string)
- actionText (string)
- probability (number 1-99, representing probability to close based on stage and notes)
- reason (string, brief explanation of why this action is recommended)
- type (string, one of: 'overdue', 'proposal', 'followup', 'new', 'closing', 'meeting')
\`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                clientId: { type: Type.STRING },
                clientName: { type: Type.STRING },
                actionText: { type: Type.STRING },
                probability: { type: Type.NUMBER },
                reason: { type: Type.STRING },
                type: { type: Type.STRING },
              }
            }
          }
        }
      });
      
      const text = response.text;
      const recommendations = JSON.parse(text);
      res.json({ recommendations });
    } catch (e) {
      console.error("Error calling Gemini:", e);
      res.status(500).json({ error: "Failed to generate recommendations" });
    }
  });
`;

if (!code.includes('/api/ai-advisor')) {
  code = code.replace(/app\.listen\(PORT, "0\.0\.0\.0", \(\) => \{/, apiRoute + '\n  app.listen(PORT, "0.0.0.0", () => {');
}

fs.writeFileSync('server.ts', code);
console.log("Patched server.ts with /api/ai-advisor");
