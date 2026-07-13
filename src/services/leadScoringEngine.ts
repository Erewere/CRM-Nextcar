export interface LeadScoreResult {
  score: number;
  probability: number;
  priority: "alta" | "media" | "baja";
  reasons: string[];
}

export function calculateLeadScore(
  client: any,
  tasks: any[],
  inventory: any[]
): LeadScoreResult {
  let score = 0;
  const reasons: string[] = [];

  // 1. Etapa actual del pipeline
  const stageWeights: Record<string, number> = {
    'nuevo': 10,
    'contacto': 20,
    'cita': 30,
    'negociacion': 40,
    'cierre': 50,
  };
  const stage = client.pipelineStage || 'nuevo';
  const stageScore = stageWeights[stage] || 10;
  score += stageScore;
  reasons.push(`+${stageScore} por estar en etapa: ${stage}`);

  // 2. Presupuesto definido
  if (client.budget && client.budget > 0) {
    score += 10;
    reasons.push(`+10 por tener presupuesto definido (${client.budget})`);
  }

  // 3. Vehículo definido
  if (client.interestedVehicle) {
    score += 10;
    reasons.push(`+10 por tener vehículo de interés (${client.interestedVehicle})`);

    // 8. Coincidencia con inventario
    const match = inventory.find(
      (v) => 
        (v.model && v.model.toLowerCase() === client.interestedVehicle.toLowerCase()) ||
        (v.make && client.interestedVehicle.toLowerCase().includes(v.make.toLowerCase()))
    );
    if (match) {
      score += 15;
      reasons.push(`+15 porque el vehículo de interés coincide con el inventario disponible`);
    }
  }

  // 4. Fecha del último contacto & 7. Interacciones recientes
  if (client.lastContact) {
    let lastContactDate = new Date(client.lastContact);
    if (typeof client.lastContact === 'object' && client.lastContact.toDate) {
      lastContactDate = client.lastContact.toDate();
    } else if (typeof client.lastContact === 'object' && client.lastContact._seconds) {
       lastContactDate = new Date(client.lastContact._seconds * 1000);
    }

    const daysSinceContact = Math.floor((new Date().getTime() - lastContactDate.getTime()) / (1000 * 3600 * 24));
    
    if (daysSinceContact <= 2) {
      score += 10;
      reasons.push(`+10 por contacto reciente (${daysSinceContact} días)`);
    } else if (daysSinceContact <= 7) {
      score += 5;
      reasons.push(`+5 por contacto en los últimos 7 días`);
    } else if (daysSinceContact > 14) {
      score -= 10;
      reasons.push(`-10 por inactividad (último contacto hace ${daysSinceContact} días)`);
    }
  }

  // 5. Número de seguimientos
  const completedTasks = tasks.filter((t) => t.status === 'completada' || t.status === 'completed');
  if (completedTasks.length > 0) {
    const followupScore = Math.min(completedTasks.length * 2, 10);
    score += followupScore;
    reasons.push(`+${followupScore} por ${completedTasks.length} seguimientos realizados`);
  }

  // 6. Tareas vencidas
  const pendingTasks = tasks.filter((t) => t.status !== 'completada' && t.status !== 'completed');
  const now = new Date();
  let overdueCount = 0;
  pendingTasks.forEach(t => {
    let dueDate = null;
    if (t.dueDate) {
      if (typeof t.dueDate === 'object' && t.dueDate.toDate) {
         dueDate = t.dueDate.toDate();
      } else if (typeof t.dueDate === 'object' && t.dueDate._seconds) {
         dueDate = new Date(t.dueDate._seconds * 1000);
      } else {
         dueDate = new Date(t.dueDate);
      }
    }
    if (dueDate && dueDate < now) {
      overdueCount++;
    }
  });

  if (overdueCount > 0) {
    const penalty = Math.min(overdueCount * -5, -15);
    score += penalty;
    reasons.push(`${penalty} por tener ${overdueCount} tareas vencidas`);
  }

  // Normalize score
  score = Math.max(0, Math.min(score, 100));

  // Determine priority
  let priority: "alta" | "media" | "baja" = "baja";
  if (score >= 70) priority = "alta";
  else if (score >= 40) priority = "media";

  // Calculate probability based on score, but with a slight curve
  const probability = Math.round(score * 0.95);

  return {
    score,
    probability,
    priority,
    reasons
  };
}
