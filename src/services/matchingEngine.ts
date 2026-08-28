import { Client, Vehicle } from "../types";

export type MatchLevel = 'exact' | 'high' | 'medium' | 'low';
export interface ClientMatch {
  vehicle: Vehicle;
  level: MatchLevel;
  score: number;
}

/**
 * Que autos del inventario le sirven a un cliente.
 *
 * El criterio de fondo cambio: antes casi todo restaba puntos y casi nada
 * descalificaba, asi que el cliente acababa viendo autos que no le servian.
 * Lo que un cliente pide no siempre es una preferencia -- a veces es un
 * requisito, y un auto que no lo cumple no es una coincidencia peor, es que no
 * es una coincidencia.
 *
 * Se descarta un auto cuando no puede cumplir lo pedido:
 *  - Otra carroceria de la que pidio.
 *  - Menos pasajeros de los que necesita: quien pide siete no cabe en cinco.
 *  - Fuera de su rango de precio, por arriba o por abajo.
 *
 * Lo demas resta puntos, que es lo apropiado para lo que si es preferencia.
 */
/**
 * En que segmento juega cada marca.
 *
 * 2 = premium, 1 = generalista. No es un juicio sobre los autos: es que quien
 * busca en un segmento no acepta el otro hacia abajo, aunque el precio cuadre.
 * Una marca que no este en la lista se trata como generalista, que es el caso
 * mas comun y el que no descarta nada de mas.
 */
const MARCAS_PREMIUM = [
  'porsche', 'mercedes', 'mercedesbenz', 'bmw', 'audi', 'lexus', 'jaguar',
  'landrover', 'rangerover', 'volvo', 'infiniti', 'cadillac', 'lincoln',
  'tesla', 'alfaromeo', 'maserati', 'bentley', 'ferrari', 'lamborghini',
  'astonmartin', 'mini', 'genesis', 'acura',
];

/**
 * Automatica o estandar, sin importar como este escrito.
 *
 * En el inventario aparece como «Automática», «Automatica», «Manual»,
 * «Estándar» o «Std» segun quien lo capturo.
 */
function tipoDeTransmision(v?: string): 'auto' | 'manual' | null {
  const t = (v || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (!t.trim()) return null;
  if (t.includes("auto") || t.includes("cvt") || t.includes("tiptronic") || t.includes("dsg")) return 'auto';
  if (t.includes("man") || t.includes("estand") || t.includes("standard") || t.includes("std") || t.includes("sincron")) return 'manual';
  return null;
}

function nivelDeMarca(marca?: string): number {
  const m = (marca || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, '');
  if (!m) return 1;
  return MARCAS_PREMIUM.some((p) => m.includes(p) || p.includes(m)) ? 2 : 1;
}

export const getClientMatches = (client: Client, vehicles: Vehicle[]): ClientMatch[] => {
  const matches: ClientMatch[] = [];
  if (client.status === 'won' || client.status === 'lost') return matches;
  if (!client.wantedVehicle) return matches;

  const wv = client.wantedVehicle;
  if (!wv.make && !wv.model && !wv.yearMin && !wv.yearMax && !wv.priceMax && !wv.priceMin && (!wv.bodyType || wv.bodyType === "Cualquiera") && !wv.passengers && !wv.transmission && !wv.kmMax) {
    return matches;
  }

  const normalize = (str?: string) => (str || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, '');
  const checkMatch = (v?: string, w?: string) => {
    const nv = normalize(v);
    const nw = normalize(w);
    if (!nw) return true;
    if (nv.includes(nw) || nw.includes(nv)) return true;
    if ((nv === 'vw' || nv === 'volkswagen') && (nw === 'vw' || nw === 'volkswagen')) return true;
    if ((nv === 'chevy' || nv === 'chevrolet') && (nw === 'chevy' || nw === 'chevrolet')) return true;
    return false;
  };

  /**
   * El piso del presupuesto.
   *
   * Si no lo escribieron, se deduce del maximo. Un presupuesto es un segmento,
   * no solo un techo: quien puede pagar un millon no anda buscando un auto de
   * trescientos mil, y ofrecerselo se lee como que no le entendieron.
   */
  const suelo = wv.priceMin && wv.priceMin > 0
    ? wv.priceMin
    : (wv.priceMax ? wv.priceMax * 0.6 : 0);
  const sueloDuro = wv.priceMin && wv.priceMin > 0
    ? wv.priceMin * 0.9   // lo dijo el: se respeta casi al pie de la letra
    : (wv.priceMax ? wv.priceMax * 0.5 : 0); // deducido: mas margen

  vehicles.forEach(vehicle => {
    if (vehicle.status && vehicle.status !== 'available') return;
    if ((vehicle as any).pendingValidation) return;
    let score = 100;

    // 1. Carroceria: es un requisito, no una preferencia.
    if (wv.bodyType && wv.bodyType !== "Cualquiera") {
      const vBody = normalize(vehicle.bodyType);
      const wBody = normalize(wv.bodyType);
      if (!vBody) {
        score -= 25; // el auto no lo tiene capturado; no se puede afirmar que sirva
      } else if (vBody !== wBody && !vBody.includes(wBody) && !wBody.includes(vBody)) {
        return;
      }
    }

    // 2. Pasajeros. Quien pide siete no cabe en cinco; al reves si cabe.
    if (wv.passengers && Number(wv.passengers) > 0) {
      const pide = Number(wv.passengers);
      const tiene = Number(vehicle.passengers);
      if (!vehicle.passengers || Number.isNaN(tiene)) {
        // Sin el dato no se puede afirmar que sirva. Antes esto restaba menos
        // que equivocarse, asi que un auto sin capturar puntuaba mas alto que
        // uno que sabiamos que no servia.
        score -= 30;
      } else if (tiene < pide) {
        return;
      } else if (tiene > pide) {
        score -= Math.min(15, (tiene - pide) * 5);
      }
    }

    // 3. Precio: un rango, no un techo.
    if (wv.priceMax && vehicle.price > wv.priceMax) {
      if (vehicle.price > wv.priceMax * 1.15) return;
      score -= vehicle.price > wv.priceMax * 1.08 ? 25 : 10;
    }
    if (sueloDuro > 0 && vehicle.price > 0 && vehicle.price < sueloDuro) {
      return;
    }
    if (suelo > 0 && vehicle.price > 0 && vehicle.price < suelo) {
      // Entre el piso duro y el piso: cabe, pero es de otro segmento.
      const quePorcion = vehicle.price / suelo;
      score -= quePorcion < 0.85 ? 30 : 15;
    }

    // 4. Marca y modelo.
    //
    // La marca importa, pero no al pie de la letra: a quien pide un Honda se
    // le puede enseñar un Nissan parecido. Lo que no se puede es cruzar de
    // segmento hacia abajo -- quien anda viendo un Mercedes o un Porsche no
    // quiere que le ofrezcan un Honda, por bueno que este.
    //
    // El precio solo no distingue esto: un Mercedes usado puede costar lo
    // mismo que un Honda nuevo y no son la misma busqueda.
    if (wv.make && !checkMatch(vehicle.make, wv.make)) {
      const nivelPedido = nivelDeMarca(wv.make);
      const nivelDelAuto = nivelDeMarca(vehicle.make);
      if (nivelPedido > nivelDelAuto) {
        return; // pidio una marca de mas nivel; esta no lo sustituye
      }
      // De igual nivel, o de mas nivel dentro de su presupuesto: se enseña,
      // con su resta por no ser la marca que pidio.
      score -= nivelPedido < nivelDelAuto ? 15 : 25;
    }
    if (wv.model && !checkMatch(vehicle.model, wv.model)) score -= 25;

    // 5. Transmision.
    //
    // Descarta, no resta: quien no maneja estandar no compra un estandar por
    // muy bueno que sea, y a quien la quiere estandar no le sirve otra cosa.
    // Es de los motivos de rechazo mas comunes y hasta ahora no se preguntaba.
    if (wv.transmission && wv.transmission !== "Cualquiera") {
      const q = tipoDeTransmision(wv.transmission);
      const t = tipoDeTransmision(vehicle.transmission);
      if (!t) {
        score -= 20; // el auto no lo tiene capturado
      } else if (q && t !== q) {
        return;
      }
    }

    // 6. Kilometraje maximo.
    if (wv.kmMax && wv.kmMax > 0) {
      const km = Number(vehicle.km);
      if (!vehicle.km || Number.isNaN(km)) {
        score -= 10;
      } else if (km > wv.kmMax * 1.15) {
        return;
      } else if (km > wv.kmMax) {
        score -= 15;
      }
    }

    // 7. Año.
    const yearMin = wv.yearMin || 0;
    const yearMax = wv.yearMax || 9999;
    if (vehicle.year < yearMin || vehicle.year > yearMax) {
      if (vehicle.year < yearMin - 2 || vehicle.year > yearMax + 2) score -= 40;
      else if (vehicle.year < yearMin - 1 || vehicle.year > yearMax + 1) score -= 20;
      else score -= 8;
    }

    // Por debajo de esto no vale la pena enseñarlo: un vendedor que recibe
    // sugerencias malas deja de mirarlas, y entonces tampoco ve las buenas.
    if (score < 55) return;

    let level: MatchLevel = 'low';
    if (score >= 95) level = 'exact';
    else if (score >= 80) level = 'high';
    else if (score >= 65) level = 'medium';

    matches.push({ vehicle, level, score });
  });

  return matches.sort((a, b) => b.score - a.score);
};
