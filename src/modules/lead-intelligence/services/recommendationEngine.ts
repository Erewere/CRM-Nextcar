import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { Client, Task } from "../../../types";
import { Recommendation, LeadScore } from "../types";
import { LeadScoringEngine } from './scoringEngine';

/**
 * Recommendation Engine
 * 
 * Basado en el score y el historial del cliente (Tareas desde Firestore),
 * sugiere la siguiente mejor acción accionable para el asesor.
 */
export class RecommendationEngine {
  
  /**
   * Obtiene la recomendación de siguiente acción consultando dinámicamente
   * el historial de tareas desde Firebase Firestore.
   */
  public static async getNextActionForClient(client: Client): Promise<{ action: Recommendation, score: LeadScore }> {
    // 1. Obtener tareas asociadas al cliente desde Firestore
    const tasksRef = collection(db, "tasks");
    const tasksQuery = query(
      tasksRef,
      where("clientId", "==", client.id)
    );
    const snapshot = await getDocs(tasksQuery);
    
    const allTasks: Task[] = [];
    snapshot.forEach(docSnap => {
      allTasks.push({ ...docSnap.data(), id: docSnap.id } as Task);
    });

    const pendingTasks = allTasks.filter(t => !t.completed);
    
    // 2. Calcular Score actualizado
    const score = LeadScoringEngine.calculateScore(client, allTasks);

    // 3. Evaluar el árbol de decisiones para la recomendación
    
    // Regla 1: Hay tareas atrasadas
    const overdueTasks = pendingTasks.filter(t => new Date(t.dueDate) < new Date());
    if (overdueTasks.length > 0) {
      return {
        score,
        action: {
          actionText: `Completar seguimiento atrasado: ${overdueTasks[0].title}`,
          actionType: "followup",
          priority: "high",
          reason: "Hay un seguimiento programado que ya expiró y requiere atención inmediata."
        }
      };
    }

    // Regla 2: Alta intención de compra pero falta empuje final
    if (score.score >= 75 && pendingTasks.length === 0) {
      return {
        score,
        action: {
          actionText: "Programar cita de cierre o demostración final",
          actionType: "appointment",
          priority: "high",
          reason: "El prospecto tiene una alta probabilidad de compra. Es el momento de cerrar."
        }
      };
    }

    // Regla 3: Falta de cualificación del perfil
    if (score.factors.profileCompleteness < 15) {
      return {
        score,
        action: {
          actionText: "Contactar para perfilar presupuesto y preferencias de vehículo",
          actionType: "call",
          priority: "medium",
          reason: "Falta información clave para poder recomendarle un vehículo adecuadamente."
        }
      };
    }

    // Regla 4: Lead activo pero sin un paso claro
    if (score.score > 40 && pendingTasks.length === 0) {
      return {
        score,
        action: {
          actionText: "Enviar propuesta o inventario nuevo acorde a su búsqueda",
          actionType: "finance",
          priority: "medium",
          reason: "El lead está tibio; hay que mantenerlo nutrido con información de valor."
        }
      };
    }

    // Regla Default: Enfriamiento
    return {
      score,
      action: {
        actionText: "Recontactar en 7 días para retomar seguimiento",
        actionType: "followup",
        priority: "low",
        reason: "Baja probabilidad de conversión actual. Mantener en el radar a mediano plazo.",
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    };
  }
}
