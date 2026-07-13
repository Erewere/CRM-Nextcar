import { Vehicle } from "../../../types";
import { OpportunityGenerator } from "../services/opportunityGenerator";
import { Opportunity } from "../types";

/**
 * Use Case: Procesar un nuevo vehículo que ingresa al inventario
 * 
 * Flujo:
 * 1. Se registra el nuevo vehículo en DB.
 * 2. Se invoca este caso de uso asíncrono (ej. Cloud Function).
 * 3. Se obtiene un lote de los prospectos activos directamente en el engine.
 * 4. El motor genera oportunidades y las guarda en Firestore.
 * 5. (Opcional) Se notifica a los asesores.
 */
export class ProcessNewVehicleUseCase {
  
  public static async execute(newVehicle: Vehicle): Promise<Opportunity[]> {
    console.log(`[LeadIntelligence] Iniciando análisis para vehículo: ${newVehicle.make} ${newVehicle.model}`);
    
    // Ejecutar Matching y guardar resultados
    const opportunities = await OpportunityGenerator.generateAndSaveForNewVehicle(newVehicle);
    
    if (opportunities.length > 0) {
      console.log(`[LeadIntelligence] Se encontraron y guardaron ${opportunities.length} oportunidades de negocio.`);
      // En producción: NotificarAsesores(opportunities);
    } else {
      console.log(`[LeadIntelligence] No hay prospectos compatibles en este momento para este vehículo.`);
    }

    return opportunities;
  }
}
