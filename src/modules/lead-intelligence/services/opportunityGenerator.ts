import { collection, query, where, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { Client, Vehicle } from "../../../types";
import { MatchScore, Opportunity } from "../types";
import { MatchingEngine } from "./matchingEngine";
import { LeadScoringEngine } from "./scoringEngine";

/**
 * Opportunity Generator
 * 
 * Detecta automáticamente cuando una unidad nueva hace match con los prospectos
 * de la base de datos, creando oportunidades.
 */
export class OpportunityGenerator {
  /**
   * Genera oportunidades para un nuevo vehículo entrante cruzándolo contra
   * un lote de prospectos activos de la agencia, y las guarda en Firestore.
   */
  public static async generateAndSaveForNewVehicle(vehicle: Vehicle): Promise<Opportunity[]> {
    const opportunities: Opportunity[] = [];

    if (!vehicle.agencyId) {
      throw new Error("El vehículo debe pertenecer a una agencia para generar oportunidades.");
    }

    // 1. Obtener prospectos activos de la agencia desde Firestore
    const clientsRef = collection(db, "clients");
    const activeClientsQuery = query(
      clientsRef,
      where("agencyId", "==", vehicle.agencyId)
    );
    
    const snapshot = await getDocs(activeClientsQuery);
    const activeClients: Client[] = [];
    
    snapshot.forEach(docSnap => {
      const data = docSnap.data() as Client;
      // Filtramos en memoria los estados que no queremos para evitar 
      // limitaciones de consultas complejas en Firestore ('not-in')
      if (data.status !== 'won' && data.status !== 'lost') {
        activeClients.push({ ...data, id: docSnap.id });
      }
    });

    // 2. Ejecutar Matching Engine para cada lead
    for (const client of activeClients) {
      const match: MatchScore = MatchingEngine.calculateMatch(client, vehicle);
      
      // Consideramos oportunidad solo si el score de match es alto (ej. > 70)
      if (match.score >= 70) {
        // Obtenemos el score del lead para priorizar y enriquecer la oportunidad
        // (asumiendo array vacío de tareas recientes por eficiencia del proceso batch)
        const leadScore = LeadScoringEngine.calculateScore(client, []).score;

        opportunities.push({
          id: `opp_${client.id}_${vehicle.id}`,
          clientId: client.id,
          vehicleId: vehicle.id,
          matchScore: match.score,
          leadScore: leadScore,
          status: "new",
          createdAt: new Date(),
          reasons: match.reasons
        });
      }
    }

    // 3. Ordenar de mejor a peor oportunidad combinando ambos scores
    opportunities.sort((a, b) => (b.matchScore + b.leadScore) - (a.matchScore + a.leadScore));

    // 4. Guardar los matches en Firestore mediante un batch (Operación atómica)
    if (opportunities.length > 0) {
      const batch = writeBatch(db);
      
      for (const opp of opportunities) {
        // En Firestore no podemos guardar objetos Date nativos directamente dentro de arrays de razones u otros,
        // pero createdAt como Date es aceptado. 
        // Usamos el ID determinista para evitar duplicados si el proceso corre dos veces
        const oppRef = doc(db, "opportunities", opp.id);
        batch.set(oppRef, {
          ...opp,
          createdAt: opp.createdAt.toISOString() // Para consistencia de lectura/escritura
        });
      }
      
      await batch.commit();
      console.log(`[OpportunityGenerator] Se guardaron ${opportunities.length} oportunidades en Firestore.`);
    }

    return opportunities;
  }
}
