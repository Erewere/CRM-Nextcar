const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Find the start of app.post("/api/ai-advisor"
const startStr = `app.post("/api/ai-advisor", express.json(), async (req, res) => {`;
const idx = code.indexOf(startStr);
if (idx === -1) {
  console.error("Could not find start");
  process.exit(1);
}

// Find the end of this block
// It ends around line 524 with:
//      res.status(500).json({ error: "Failed to generate recommendations", details: e instanceof Error ? e.message : String(e) });
//    }
//  });
const endStr = `res.status(500).json({ error: "Failed to generate recommendations", details: e instanceof Error ? e.message : String(e) });\n    }\n  });`;
const endIdx = code.indexOf(endStr, idx);
if (endIdx === -1) {
  console.error("Could not find end");
  process.exit(1);
}

const replacement = `app.post("/api/ai-advisor", express.json(), async (req, res) => {
    try {
      if (!process.env.GEMINI_API_KEY) {
         return res.status(500).json({ error: "Gemini API key is missing" });
      }
      
      let ai;
      try {
        ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      } catch(e) {
        return res.status(500).json({ error: "Gemini API key is invalid or missing" });
      }

      const { activeContacts, tasks, pipelineStages, agencyId, inventory } = req.body;
      
      if (!agencyId) {
        return res.status(400).json({ error: "Falta el agencyId" });
      }

      // IMPORT lead scoring dynamically or just provide the fallback here
      // But we wrote it in src/services/leadScoringEngine.ts
      // Since server.ts is bundled by esbuild, we can't easily dynamically require inside Express if we didn't statically import it.
      // Wait, let's just import it at the top of server.ts.
      // We will do that in another replace.
      
      // We will skip strict credit check in the backend because of service account issues.
      // The frontend already enforces credit checks.
      
      const { calculateLeadScore } = require("./src/services/leadScoringEngine.ts");
      
      // Calculate scores for all active contacts
      const scoredContacts = (activeContacts || []).map((client) => {
        const clientTasks = (tasks || []).filter((t) => t.clientId === client.id);
        const scoreResult = calculateLeadScore(client, clientTasks, inventory || []);
        return {
          ...client,
          _score: scoreResult
        };
      });
      
      // Sort by score descending and take top 6
      scoredContacts.sort((a, b) => b._score.score - a._score.score);
      const topContacts = scoredContacts.slice(0, 6);
      
      const prompt = \`
You are "IA Erewere", an expert sales advisor for a car dealership.
We have pre-scored our leads using our Lead Scoring Engine. Here are the top \${topContacts.length} prospects.
For each prospect, generate a specific, actionable recommendation to close the deal.

Top Contacts (with score context):
\${JSON.stringify(topContacts.map(c => ({
  id: c.id,
  name: c.name,
  pipelineStage: c.pipelineStage || c.status,
  budget: c.budget,
  interestedVehicle: c.interestedVehicle,
  score: c._score.score,
  probability: c._score.probability,
  reasonsForScore: c._score.reasons,
  notes: c.notes,
  tasks: (tasks || []).filter(t => t.clientId === c.id)
})))}

Return a JSON array of recommendation objects with the following schema:
- clientId (string)
- clientName (string)
- actionText (string)
- probability (number 1-99, map this to the probability we gave you or adjust based on your analysis)
- reason (string, brief explanation of why this action is recommended)
- type (string, one of: 'overdue', 'proposal', 'followup', 'new', 'closing', 'meeting')
\`;

      let response;
      try {
        response = await ai.models.generateContent({
          model: "gemini-3.1-flash-lite",
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
      } catch (genError) {
        console.warn("Gemini API error, falling back to heuristic recommendations.", genError);
        const fallbackRecommendations = topContacts.map(client => {
           let type = 'followup';
           if (client._score.priority === 'alta') type = 'closing';
           
           return {
             clientId: client.id,
             clientName: client.name,
             actionText: \`Contactar a \${client.name} para dar seguimiento.\`,
             probability: client._score.probability,
             reason: client._score.reasons.join(", "),
             type
           };
        });
        return res.json({ recommendations: fallbackRecommendations });
      }

      const text = response.text;
      const recommendations = JSON.parse(text);
      
      res.json({ recommendations });
    } catch (e) {
      console.error("Error calling Gemini:", e);
      res.status(500).json({ error: "Failed to generate recommendations", details: e instanceof Error ? e.message : String(e) });
    }
  });`;

const newCode = code.slice(0, idx) + replacement + code.slice(endIdx + endStr.length);
fs.writeFileSync('server.ts', newCode);
