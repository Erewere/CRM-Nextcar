import { Client, Vehicle } from "../../../types";
import { MatchScore } from "../types";

/**
 * Matching Engine
 * 
 * Calcula coincidencias entre las preferencias de un cliente (Lead) 
 * y las especificaciones de un vehículo del inventario de NEXTCAR.
 */
export class MatchingEngine {
  /**
   * Genera el Match Score (0 a 100) y extrae las razones del match.
   */
  public static calculateMatch(client: Client, vehicle: Vehicle): MatchScore {
    let score = 0;
    const reasons: string[] = [];

    const preferences = client.wantedVehicle;
    if (!preferences || Object.keys(preferences).length === 0) {
      return { score: 0, reasons: ["El cliente no tiene preferencias definidas."] };
    }

    // 1. Marca (Hasta 25 puntos)
    if (preferences.make) {
      if (vehicle.make?.toLowerCase() === preferences.make.toLowerCase()) {
        score += 25;
        reasons.push(`La marca (${vehicle.make}) coincide exactamente con su búsqueda.`);
      }
    } else {
      score += 10; // Flexible en marca
    }

    // 2. Modelo (Hasta 25 puntos)
    if (preferences.model && vehicle.model) {
      const prefModel = preferences.model.toLowerCase();
      const vehModel = vehicle.model.toLowerCase();
      if (vehModel.includes(prefModel) || prefModel.includes(vehModel)) {
        score += 25;
        reasons.push(`El modelo (${vehicle.model}) coincide con sus preferencias.`);
      }
    } else {
      score += 10; // Flexible en modelo
    }

    // 3. Presupuesto (Hasta 25 puntos)
    if (preferences.priceMax && vehicle.price) {
      if (vehicle.price <= preferences.priceMax) {
        score += 25;
        reasons.push(`Precio ($${vehicle.price.toLocaleString()}) está dentro de su presupuesto máximo ($${preferences.priceMax.toLocaleString()}).`);
      } else if (vehicle.price <= preferences.priceMax * 1.15) {
        // Tolerancia del 15% (Oportunidad de financiamiento)
        score += 15;
        reasons.push(`Precio ligeramente superior a su presupuesto pero viable mediante financiamiento.`);
      } else {
        reasons.push(`El vehículo excede más del 15% del presupuesto máximo del cliente ($${preferences.priceMax.toLocaleString()}).`);
        return { score: 0, reasons };
      }
    } else {
      score += 15; // Presupuesto abierto
    }

    // 4. Año (Hasta 15 puntos)
    if (preferences.yearMin || preferences.yearMax) {
      const min = preferences.yearMin || 1900;
      const max = preferences.yearMax || 2100;
      if (vehicle.year >= min && vehicle.year <= max) {
        score += 15;
        reasons.push(`El año de fabricación (${vehicle.year}) se ajusta a su requerimiento.`);
      } else {
        reasons.push(`El año (${vehicle.year}) está fuera del rango buscado.`);
      }
    } else {
      score += 10; // Flexible en año
    }

    // 5. Carrocería o Pasajeros (Hasta 10 puntos)
    if (preferences.bodyType && vehicle.bodyType) {
      if (vehicle.bodyType.toLowerCase() === preferences.bodyType.toLowerCase()) {
        score += 10;
        reasons.push(`Tipo de carrocería (${vehicle.bodyType}) ideal para el cliente.`);
      }
    } else if (preferences.passengers && vehicle.passengers) {
      if (vehicle.passengers >= preferences.passengers) {
        score += 10;
        reasons.push(`Cuenta con la capacidad de pasajeros requerida (${vehicle.passengers} asientos).`);
      }
    } else {
      score += 5; // Flexible en características
    }

    return {
      score: Math.min(100, Math.max(0, score)),
      reasons
    };
  }
}
