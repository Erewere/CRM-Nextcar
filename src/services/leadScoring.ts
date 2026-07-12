import { Client, PipelineStage } from "../types";

export const calculateLeadScore = (client: Client, pipelineStages: PipelineStage[]): number => {
  // Determine stage index
  const stageIndex = pipelineStages.findIndex(s => s.id === client.status);
  const totalStages = pipelineStages.length > 0 ? pipelineStages.length : 1;
  
  // Base probability based on stage progression
  let baseProb = 10; 
  if (stageIndex >= 0) {
     baseProb = 20 + Math.floor((stageIndex / totalStages) * 65);
  } else {
     baseProb = 15;
  }
  
  return baseProb;
};
