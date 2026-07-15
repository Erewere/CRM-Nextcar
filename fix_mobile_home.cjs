const fs = require('fs');
let content = fs.readFileSync('src/pages/mobile/MobileHome.tsx', 'utf8');

// Replace the imports to include calculateLeadScore
if (!content.includes('import { calculateLeadScore }')) {
  content = content.replace('import { AiAdvisorPanel } from "../../components/AiAdvisorPanel";', 'import { AiAdvisorPanel } from "../../components/AiAdvisorPanel";\nimport { calculateLeadScore } from "../../services/leadScoring";');
}

// Replace the priority and leadScore calculation logic
const badLogic = `    // Clientes prioritarios (Alta temperatura o etapa avanzada)
    const priority = activeContacts.filter(c => {
      const stage = pipelineStages.find(s => s.id === c.pipelineStageId);
      const isAdvanced = stage && stage.probability >= 70;
      return c.temperature === "alta" || isAdvanced;
    }).slice(0, 5);

    // Lead score alto
    const topScores = [...activeContacts]
      .filter(c => typeof c.leadScore === 'number' && c.leadScore > 0)
      .sort((a, b) => (b.leadScore || 0) - (a.leadScore || 0))
      .slice(0, 5);`;

const goodLogic = `    // Calculate scores for all active contacts
    const scoredContacts = activeContacts.map(c => ({
      ...c,
      calculatedScore: calculateLeadScore(c, pipelineStages)
    }));

    // Clientes prioritarios (Etapa avanzada o score alto)
    const priority = scoredContacts.filter(c => {
      const stageIndex = pipelineStages.findIndex(s => s.id === c.status);
      const isAdvanced = stageIndex >= pipelineStages.length - 2 && pipelineStages.length > 2; // Últimas dos etapas
      return isAdvanced || c.calculatedScore >= 70;
    }).slice(0, 5);

    // Lead score alto
    const topScores = [...scoredContacts]
      .sort((a, b) => b.calculatedScore - a.calculatedScore)
      .slice(0, 5);`;

content = content.replace(badLogic, goodLogic);

// Replace {client.leadScore} with {client.calculatedScore}
content = content.replace('{client.leadScore}', '{client.calculatedScore}');

fs.writeFileSync('src/pages/mobile/MobileHome.tsx', content);
console.log('Fixed MobileHome.tsx');
