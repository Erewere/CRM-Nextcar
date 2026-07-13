import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { Client } from "../../../types";
import { DemandPattern } from "../types";

/**
 * Inventory Intelligence
 * 
 * Analiza la demanda global de los clientes de una agencia para 
 * sugerir qué vehículos comprar o conseguir.
 */
export class InventoryIntelligence {
  
  /**
   * Analiza todos los clientes activos de una agencia para detectar patrones 
   * de demanda, agrupando las búsquedas y calculando los promedios de presupuesto.
   */
  public static async analyzeDemandForAgency(agencyId: string): Promise<DemandPattern[]> {
    if (!agencyId) {
      throw new Error("El agencyId es requerido para analizar la demanda.");
    }

    // 1. Obtener prospectos activos de la agencia desde Firestore
    const clientsRef = collection(db, "clients");
    const activeClientsQuery = query(
      clientsRef,
      where("agencyId", "==", agencyId)
    );
    
    const snapshot = await getDocs(activeClientsQuery);
    const clients: Client[] = [];
    
    snapshot.forEach(docSnap => {
      const data = docSnap.data() as Client;
      if (data.status !== 'won' && data.status !== 'lost') {
        clients.push({ ...data, id: docSnap.id });
      }
    });

    const demandMap = new Map<string, { count: number, budgetSum: number, name: string }>();

    for (const client of clients) {
      if (!client.wantedVehicle) continue;

      const v = client.wantedVehicle;
      
      // Creamos una clave de agrupación para agregar los datos
      if (v.make || v.bodyType || v.model) {
        const make = v.make?.toUpperCase() || 'CUALQUIER MARCA';
        const model = v.model?.toUpperCase() || '';
        const bodyType = v.bodyType?.toUpperCase() || 'CUALQUIER TIPO';
        
        let key = `${make}`;
        if (model) key += ` ${model}`;
        key += ` - ${bodyType}`;
        
        const existing = demandMap.get(key) || { count: 0, budgetSum: 0, name: key };
        existing.count += 1;
        if (v.priceMax) existing.budgetSum += v.priceMax;
        
        demandMap.set(key, existing);
      }
    }

    const patterns: DemandPattern[] = [];
    
    // Transformar a DemandPattern y ordenar
    demandMap.forEach((value, key) => {
      // Ignorar ruido (ej. buscar al menos 2 personas)
      if (value.count < 1) return; // En un escenario real con muchos datos, se sube a > 3 o 5.

      let level: "high" | "medium" | "low" = "low";
      if (value.count >= 5) level = "high";
      else if (value.count >= 2) level = "medium";

      const parts = key.split('-');
      const makeModel = parts[0].trim();
      const makeModelParts = makeModel.split(' ');
      const make = makeModelParts[0];
      const model = makeModelParts.slice(1).join(' ');
      const bodyType = parts[1]?.trim() || '';

      patterns.push({
        make: make === 'CUALQUIER MARCA' ? undefined : make,
        model: model || undefined,
        bodyType: bodyType === 'CUALQUIER TIPO' ? undefined : bodyType,
        searchVolume: value.count,
        averageBudget: value.count > 0 && value.budgetSum > 0 ? Math.round(value.budgetSum / value.count) : 0,
        opportunityLevel: level
      });
    });

    // Ordenar de mayor a menor demanda
    return patterns.sort((a, b) => b.searchVolume - a.searchVolume);
  }
}
