import { Client, Task } from "../../../types";
import { LeadScore } from "../types";

/**
 * Lead Scoring Engine
 * 
 * Calcula la probabilidad de conversión de un Lead (Score de 0 a 100)
 * basándose en su perfil, origen, historial de interacción y estatus del CRM.
 */
export class LeadScoringEngine {
  /**
   * Genera el score del cliente evaluando diversas variables integradas de Nextcar CRM.
   */
  public static calculateScore(client: Client, recentTasks: Task[] = []): LeadScore {
    let budgetScore = 0;
    let urgencyScore = 0;
    let activityScore = 0;
    let profileCompleteness = 0;

    // 1. Completitud del perfil y Origen (25 puntos máx)
    if (client.phone) profileCompleteness += 10;
    if (client.email) profileCompleteness += 5;
    if (client.wantedVehicle && Object.keys(client.wantedVehicle).length > 0) {
      profileCompleteness += 10;
    }
    
    // Bonus oculto por origen del lead
    let originBonus = 0;
    if (client.origin === 'whatsapp') originBonus = 5; // Alta conversión empírica
    if (client.origin === 'web') originBonus = 3;

    // Bonus por Tags (ej. Si el asesor lo marcó como hot_lead o VIP)
    let tagBonus = 0;
    if (client.tags && client.tags.length > 0) {
      if (client.tags.some(t => t.toLowerCase().includes('hot') || t.toLowerCase().includes('vip'))) {
        tagBonus = 10;
      }
    }

    // 2. Presupuesto (20 puntos máx)
    if (client.wantedVehicle?.priceMax) {
      // Si el cliente tiene un presupuesto claro y alto, demuestra mayor intencionalidad o viabilidad
      if (client.wantedVehicle.priceMax > 150000) budgetScore = 20; 
      else budgetScore = 15;
    } else {
      budgetScore = 5; // Si no hay presupuesto, no sabemos qué tan viable es
    }

    // 3. Actividad reciente / Interacciones (30 puntos máx)
    // Evaluamos en base a las tareas registradas (llamadas, citas, correos)
    const completedTasks = recentTasks.filter(t => t.completed);
    if (completedTasks.length >= 4) activityScore = 30;
    else if (completedTasks.length >= 2) activityScore = 20;
    else if (completedTasks.length === 1) activityScore = 10;

    // Penalti por falta de seguimiento
    if (completedTasks.length === 0 && recentTasks.length > 0) {
      // Tiene tareas pendientes pero ninguna completada (abandono relativo)
      activityScore = -5;
    }

    // 4. Urgencia y Avance en el Pipeline (25 puntos máx)
    // Se mapea con el ID o string de status en Nextcar
    const status = client.status?.toLowerCase() || '';
    if (status === 'won') {
      urgencyScore = 25; // Cerrado ganado, máxima probabilidad consolidada
    } else if (status.includes('closing') || status.includes('cierre')) {
      urgencyScore = 25;
    } else if (status.includes('meeting') || status.includes('cita') || status.includes('negociacion')) {
      urgencyScore = 20;
    } else if (status.includes('proposal') || status.includes('propuesta') || status.includes('financiamiento')) {
      urgencyScore = 15;
    } else if (status === 'lost') {
      urgencyScore = -50; // Totalmente frío
    } else {
      urgencyScore = 5; // Lead nuevo o en etapas iniciales
    }

    // Sumatoria final y cap de 0 a 100
    const rawScore = budgetScore + urgencyScore + activityScore + profileCompleteness + originBonus + tagBonus;
    const totalScore = Math.min(100, Math.max(0, rawScore));

    // Categorización
    let category: "Alta" | "Media" | "Baja" = "Baja";
    if (totalScore >= 75) category = "Alta";
    else if (totalScore >= 45) category = "Media";

    return {
      score: totalScore,
      probabilityCategory: category,
      factors: {
        budget: budgetScore,
        urgency: urgencyScore,
        activity: activityScore,
        profileCompleteness: profileCompleteness
      }
    };
  }
}
