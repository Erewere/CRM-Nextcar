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
   * Helper para determinar si una etapa es considerada "Ganada" (Won)
   */
  private static isWonStage(status: string = "", pipelineStages: { id: string; title?: string }[] = []): boolean {
    const wonKeywords = [
      "ganado", "won", "vendid", "cerrad", 
      "entregad", "completad", "finalizad", 
      "pagad", "exito", "éxito", "completed", "finish", "listo"
    ];
    const s = String(status || "").toLowerCase();
    if (s === "won") return true;
    if (wonKeywords.some((k) => s.includes(k))) return true;
    
    const stage = pipelineStages.find(st => st.id === status);
    if (stage) {
      const t = String(stage.title || "").toLowerCase();
      const id = String(stage.id || "").toLowerCase();
      if (id === "won") return true;
      return wonKeywords.some((k) => t.includes(k) || id.includes(k));
    }
    return false;
  }

  /**
   * Helper para determinar si una etapa es considerada "Perdida" (Lost)
   */
  private static isLostStage(status: string = "", pipelineStages: { id: string; title?: string }[] = []): boolean {
    const lostKeywords = ["perdid", "lost", "cancelad", "rechazad", "fallid", "abandonad"];
    const s = String(status || "").toLowerCase();
    if (s === "lost") return true;
    if (lostKeywords.some((k) => s.includes(k))) return true;
    
    const stage = pipelineStages.find(st => st.id === status);
    if (stage) {
      const t = String(stage.title || "").toLowerCase();
      const id = String(stage.id || "").toLowerCase();
      if (id === "lost") return true;
      return lostKeywords.some((k) => t.includes(k) || id.includes(k));
    }
    return false;
  }

  /**
   * Analiza el sentimiento y las señales de intención de compra en los comentarios/notas del cliente.
   * Retorna un score de ajuste (positivo o negativo) y factores encontrados.
   */
  public static analyzeNotes(notes: { content: string }[] = []): { scoreAdjust: number, signals: string[] } {
    let scoreAdjust = 0;
    const signals: string[] = [];
    
    if (!notes || notes.length === 0) {
      return { scoreAdjust, signals };
    }

    const hotPatterns = [
      { words: ["por entregarse", "por entregar", "entrega de", "entregar", "entregarse", "espera deposito", "espera depósito", "listo para entregar", "esperando deposito", "esperando depósito"], weight: 35, label: "Vehículo listo por entregarse / Trámite final" },
      { words: ["deposito", "depósito", "apartado", "apartar", "separa", "anticipo", "apartó", "aparto"], weight: 25, label: "Espera depósito / Apartado" },
      { words: ["lo quiere", "comprar", "cerrar", "decidido", "quiere el carro", "quiere el auto"], weight: 20, label: "Alta intención de compra" },
      { words: ["super interesado", "muy interesado", "interesadísimo", "interesadisimo", "encantó", "encanto", "gusto mucho", "gustó mucho"], weight: 15, label: "Fuerte interés expresado" },
      { words: ["crédito aprobado", "credito aprobado", "autorizado", "aprobado", "financiamiento listo"], weight: 15, label: "Financiamiento viable / Aprobado" },
      { words: ["pasa hoy", "pasa mañana", "viene hoy", "viene mañana", "visita", "agenda cita", "agendada"], weight: 10, label: "Cita o visita inminente" },
      { words: ["urge", "inmediato", "ya mismo", "lo antes posible"], weight: 8, label: "Urgencia temporal alta" }
    ];

    const coldPatterns = [
      { words: ["sin dinero", "no tiene dinero", "fuera de presupuesto", "no le alcanza", "no califica", "caro", "alto costo", "no tiene para el enganche"], weight: -20, label: "Obstáculo de presupuesto/financiero" },
      { words: ["no responde", "no contesta", "buzon", "buzón", "sin respuesta", "llamada perdida", "ignora", "enviado a buzon"], weight: -12, label: "Falta de respuesta/contacto" },
      { words: ["compro otro", "compró otro", "ya compro", "ya compró", "adquirió otro", "adquirio otro"], weight: -40, label: "Compró en otra parte" },
      { words: ["ya no quiere", "ya no le interesa", "cancelar", "no interesado", "descartado", "no insistir", "frio", "frío"], weight: -30, label: "Desinterés / Cancelación" },
      { words: ["lo va a pensar", "va a pensar", "pensarlo", "indeciso", "lo esta pensando", "lo está pensando"], weight: -8, label: "Indecisión / En duda" }
    ];

    // Scan all notes (convert to lowercase)
    const combinedText = notes.map(n => (n.content || "").toLowerCase()).join(" | ");

    // Check hot patterns
    hotPatterns.forEach(pattern => {
      if (pattern.words.some(word => combinedText.includes(word))) {
        scoreAdjust += pattern.weight;
        signals.push(`+${pattern.weight} (${pattern.label})`);
      }
    });

    // Check cold patterns
    coldPatterns.forEach(pattern => {
      if (pattern.words.some(word => combinedText.includes(word))) {
        scoreAdjust += pattern.weight;
        signals.push(`${pattern.weight} (${pattern.label})`);
      }
    });

    return {
      scoreAdjust,
      signals
    };
  }

  /**
   * Genera el score del cliente evaluando diversas variables integradas de NEXTCAR CRM.
   * Soporta opcionalmente pipelineStages (para calcular progresión real de la agencia)
   * y clientNotes (para analizar sentimiento e intención de compra en notas y comentarios).
   */
  public static calculateScore(
    client: Client, 
    recentTasks: Task[] = [],
    pipelineStages?: { id: string; title: string }[],
    clientNotes?: any[]
  ): LeadScore {
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

    // 4. Urgencia y Avance en el Pipeline (35 puntos máx)
    const status = client.status?.toLowerCase() || '';
    
    if (pipelineStages && pipelineStages.length > 0) {
      const currentStageIndex = pipelineStages.findIndex(s => s.id === client.status);
      if (currentStageIndex >= 0) {
        const stage = pipelineStages[currentStageIndex];
        const stageTitle = String(stage?.title || "").toLowerCase();
        const stageId = String(stage?.id || "").toLowerCase();
        
        // Detectar si la etapa es de cierre, apartado, depósito o entrega
        const isClosingOrDeliveryStage = 
          stageTitle.includes("cierr") || stageId.includes("cierr") ||
          stageTitle.includes("clos") || stageId.includes("clos") ||
          stageTitle.includes("deposit") || stageId.includes("deposit") ||
          stageTitle.includes("apart") || stageId.includes("apart") ||
          stageTitle.includes("entreg") || stageId.includes("entreg") ||
          stageTitle.includes("anticip") || stageId.includes("anticip") ||
          stageTitle.includes("vendid") || stageId.includes("vendid");

        if (LeadScoringEngine.isLostStage(client.status, pipelineStages)) {
          urgencyScore = -50; // Totalmente frío / perdido
        } else if (LeadScoringEngine.isWonStage(client.status, pipelineStages)) {
          urgencyScore = 35; // Cerrado ganado
        } else if (isClosingOrDeliveryStage) {
          urgencyScore = 35; // Etapa de cierre o entrega activa (máxima urgencia antes de ganar)
        } else {
          // Filtrar etapas que no son perdidas para calcular el progreso real activo
          const activeStages = pipelineStages.filter(s => !LeadScoringEngine.isLostStage(s.id, pipelineStages));
          const activeIndex = activeStages.findIndex(s => s.id === client.status);
          if (activeIndex >= 0 && activeStages.length > 1) {
            // Progresión del pipeline dinámica: de 10 a 35 puntos de forma proporcional (más a la derecha = más puntaje)
            urgencyScore = 10 + Math.round((activeIndex / (activeStages.length - 1)) * 25);
          } else {
            urgencyScore = 18;
          }
        }
      } else {
        // Fallback si no se encuentra en las etapas de la agencia
        if (status === 'won') urgencyScore = 35;
        else if (status === 'lost') urgencyScore = -50;
        else urgencyScore = 15;
      }
    } else {
      // Fallback estático con palabras clave ampliadas (incluyendo "deposito", "espera", etc.)
      if (status === 'won') {
        urgencyScore = 35;
      } else if (status === 'lost') {
        urgencyScore = -50;
      } else if (status.includes('closing') || status.includes('cierre') || status.includes('deposito') || status.includes('espera') || status.includes('entreg')) {
        urgencyScore = 35; // Etapas de cierre o depósito, súper caliente
      } else if (status.includes('meeting') || status.includes('cita') || status.includes('negociacion')) {
        urgencyScore = 25;
      } else if (status.includes('proposal') || status.includes('propuesta') || status.includes('financiamiento')) {
        urgencyScore = 18;
      } else {
        urgencyScore = 10; // Lead inicial
      }
    }

    // 5. Análisis de comentarios/notas (Ajuste dinámico basado en texto - hasta +25 o -40 de impacto real)
    let notesAdjustment = 0;
    if (clientNotes && clientNotes.length > 0) {
      const analysis = LeadScoringEngine.analyzeNotes(clientNotes);
      notesAdjustment = analysis.scoreAdjust;
    }

    // Sumatoria final y cap de 0 a 100
    const rawScore = budgetScore + urgencyScore + activityScore + profileCompleteness + originBonus + tagBonus + notesAdjustment;
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
        urgency: urgencyScore + notesAdjustment, // Reflejar impacto de notas en urgencia/avance
        activity: activityScore,
        profileCompleteness: profileCompleteness
      }
    };
  }
}
