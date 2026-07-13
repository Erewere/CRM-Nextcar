import { Client, Task } from "../../../types";
import { LeadScoringEngine } from "../services/scoringEngine";
import { RecommendationEngine } from "../services/recommendationEngine";
import { ClientIntelligence } from "../types";

/**
 * Use Case: Evaluar el perfil de un cliente
 * 
 * Flujo:
 * 1. El usuario abre el perfil de un cliente (o un proceso batch lo actualiza).
 * 2. Se obtienen los datos actuales del cliente y sus tareas.
 * 3. Se genera la Recomendación de siguiente acción (que incluye el Score internamente).
 * 4. Se enriquece la vista del cliente.
 */
export class EvaluateClientProfileUseCase {
  
  public static async execute(client: Client): Promise<ClientIntelligence> {
    
    // 2 y 3. Generar sugerencia de próxima acción (y score integrado)
    const { action, score } = await RecommendationEngine.getNextActionForClient(client);
    
    // 4. Devolver perfil enriquecido
    return {
      ...client,
      leadScore: score.score,
      leadScoreDetails: score,
      nextRecommendedAction: action
    };
  }
}
