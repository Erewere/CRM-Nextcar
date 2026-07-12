import { Client, Task, PipelineStage } from "../types";
import { calculateLeadScore } from "./leadScoring";

export interface AIRecommendation {
  clientId: string;
  clientName: string;
  actionText: string;
  probability: number;
  reason: string;
  type: 'overdue' | 'proposal' | 'followup' | 'new' | 'closing' | 'meeting';
}

export const generateRecommendations = (
  activeContacts: Client[],
  tasks: Task[],
  pipelineStages: PipelineStage[]
): AIRecommendation[] => {
  const recs: AIRecommendation[] = [];
  const now = new Date();

  activeContacts.forEach(contact => {
    let baseProb = calculateLeadScore(contact, pipelineStages);

    // Check tasks for this contact
    const contactTasks = tasks.filter(t => t.dealId === contact.id || t.clientId === (contact as any).originalClientId || t.clientId === contact.id);
    const overdueTasks = contactTasks.filter(t => !t.completed && t.dueDate && new Date(t.dueDate) < now);
    const pendingTasks = contactTasks.filter(t => !t.completed && t.dueDate && new Date(t.dueDate) >= now);

    let actionText = "";
    let reason = "";
    let type: AIRecommendation['type'] = 'new';

    if (overdueTasks.length > 0) {
      actionText = `Llamar a ${contact.name}`;
      reason = "Seguimiento urgente";
      type = 'overdue';
      baseProb -= 5;
    } else if (pendingTasks.length > 0) {
       const nextTask = pendingTasks[0];
       if (nextTask.title.toLowerCase().includes("cotiza") || nextTask.title.toLowerCase().includes("propuesta")) {
          actionText = `Enviar cotización a ${contact.name}`;
          reason = "Avanzar a propuesta";
          type = 'proposal';
          baseProb += 5;
       } else {
          actionText = `Seguimiento a ${contact.name}`;
          reason = "Mantener contacto";
          type = 'followup';
       }
    } else {
       // No active tasks, we need to suggest an action based on stage
       const stageIndex = pipelineStages.findIndex(s => s.id === contact.status);
       const stageTitle = stageIndex >= 0 ? pipelineStages[stageIndex].title.toLowerCase() : "";
       
       if (stageTitle.includes("nuevo") || stageTitle.includes("prospect")) {
          actionText = `Contactar a ${contact.name}`;
          reason = "Nuevo prospecto";
          type = 'new';
       } else if (stageTitle.includes("cotiza") || stageTitle.includes("propuesta")) {
          actionText = `Enviar cotización a ${contact.name}`;
          reason = "Esperando propuesta";
          type = 'proposal';
          baseProb += 5;
       } else if (stageTitle.includes("negocia") || stageTitle.includes("cierre")) {
          actionText = `Cerrar venta con ${contact.name}`;
          reason = "Etapa final";
          type = 'closing';
          baseProb += 10;
       } else {
          actionText = `Agendar cita con ${contact.name}`;
          reason = "Sin actividad próxima";
          type = 'meeting';
       }
    }

    recs.push({
      clientId: contact.id,
      clientName: contact.name,
      actionText,
      probability: Math.max(5, Math.min(99, baseProb)),
      reason,
      type
    });
  });

  // Sort by probability descending
  return recs.sort((a, b) => b.probability - a.probability);
};
