import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot, doc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { Client, Vehicle } from "../types";
import { getClientMatches } from "../services/matchingEngine";
import { getApiUrl } from "../lib/api";

export interface SharedMatch {
  client: Client;
  vehicle: Vehicle;
  score: number;
  level: 'exact' | 'high' | 'medium' | 'low';
  agencyName: string;
}

/**
 * Inventario de las agencias asociadas, pedido una sola vez para toda la
 * aplicacion.
 *
 * Este hook se invoca desde ocho lugares, y cuatro de ellos (Layout,
 * TaskReminders, NotificationsPopover y SharedMatchNotifications) viven en el
 * marco: estan montados a la vez en todas las pantallas. Cada invocacion
 * levantaba su propio temporizador de un minuto contra cada agencia asociada,
 * de modo que corrian unas cinco copias del mismo ciclo en paralelo. Eran
 * decenas de miles de lecturas al dia para mostrar un inventario que casi
 * nunca cambia.
 *
 * Ahora hay un solo temporizador y un solo resultado, compartido por todos los
 * que lo pidan.
 */
const REFRESCO_MS = 5 * 60 * 1000;

type Escucha = (vehiculos: Vehicle[]) => void;

const compartido = {
  clave: "",
  claveDeseada: "",
  vehiculos: [] as Vehicle[],
  momento: 0,
  enCurso: null as Promise<void> | null,
  escuchas: new Set<Escucha>(),
  temporizador: null as ReturnType<typeof setInterval> | null,
};

async function pedirInventario(ids: string[]): Promise<Vehicle[]> {
  const partes = await Promise.all(
    ids.map(async (agencyId) => {
      try {
        const res = await fetch(
          getApiUrl(`/api/public/v1/inventory?agencyId=${encodeURIComponent(agencyId)}`)
        );
        if (!res.ok) return [];
        const data = await res.json();
        return (data.vehicles || []).map((v: any) => ({ ...v, agencyId }));
      } catch (err) {
        console.error(`Error loading shared inventory from agency ${agencyId}:`, err);
        return [];
      }
    })
  );
  return partes.flat() as Vehicle[];
}

function refrescarCompartido(clave: string, forzar: boolean): void {
  compartido.claveDeseada = clave;
  if (compartido.enCurso) return;

  const vigente = compartido.clave === clave && Date.now() - compartido.momento < REFRESCO_MS;
  if (vigente && !forzar) return;

  compartido.enCurso = pedirInventario(clave.split(","))
    .then((vehiculos) => {
      compartido.clave = clave;
      compartido.vehiculos = vehiculos;
      compartido.momento = Date.now();
      compartido.escuchas.forEach((avisar) => avisar(vehiculos));
    })
    .catch((err) => {
      console.error("Error loading available vehicles for matches:", err);
    })
    .finally(() => {
      compartido.enCurso = null;
      // Si la lista de agencias cambio mientras se pedia, se vuelve a pedir.
      // Se compara contra lo que se acaba de pedir, no contra lo ultimo que
      // llego: si la peticion fallo, no debe reintentar en bucle.
      if (compartido.claveDeseada !== clave) {
        refrescarCompartido(compartido.claveDeseada, true);
      }
    });
}

/**
 * Entrega el inventario compartido. Lo pueden pedir cuantas pantallas quieran:
 * todas reciben el mismo resultado y entre todas provocan una sola consulta.
 */
export function useInventarioCompartido(ids: string[], activo: boolean): Vehicle[] {
  const clave = ids.slice().sort().join(",");
  const [vehiculos, setVehiculos] = useState<Vehicle[]>(
    () => (compartido.clave === clave ? compartido.vehiculos : [])
  );

  useEffect(() => {
    if (!activo || !clave) {
      setVehiculos([]);
      return;
    }

    const escucha: Escucha = (v) => setVehiculos(v);
    compartido.escuchas.add(escucha);

    // Si otro componente ya lo trajo, se aprovecha sin volver a pedirlo.
    if (compartido.clave === clave && compartido.momento) {
      setVehiculos(compartido.vehiculos);
    }
    refrescarCompartido(clave, compartido.clave !== clave);

    if (!compartido.temporizador) {
      compartido.temporizador = setInterval(() => {
        if (compartido.clave) refrescarCompartido(compartido.clave, true);
      }, REFRESCO_MS);
    }

    return () => {
      compartido.escuchas.delete(escucha);
      // El temporizador se apaga cuando ya nadie mira el inventario compartido.
      if (compartido.escuchas.size === 0 && compartido.temporizador) {
        clearInterval(compartido.temporizador);
        compartido.temporizador = null;
      }
    };
  }, [clave, activo]);

  return vehiculos;
}

export function useSharedInventoryMatches() {
  const { userData } = useAuth();
  const [ownAgencySharing, setOwnAgencySharing] = useState(false);
  const [sharingAgencies, setSharingAgencies] = useState<Record<string, string>>({});
  const [clients, setClients] = useState<Client[]>([]);
  const [matches, setMatches] = useState<SharedMatch[]>([]);
  const [loading, setLoading] = useState(true);

  // 1. Listen to own agency's sharing status
  useEffect(() => {
    if (!userData?.agencyId || userData.role === 'master' || userData.role === 'seller') {
      setLoading(false);
      return;
    }

    const unsubscribeOwn = onSnapshot(doc(db, "agencies", userData.agencyId), (snap) => {
      if (snap.exists()) {
        setOwnAgencySharing(!!snap.data().shareInventory);
      }
    }, (err) => {
      console.error("Error loading own agency sharing:", err);
    });

    return () => unsubscribeOwn();
  }, [userData]);

  // 2. Listen to other sharing agencies
  useEffect(() => {
    if (!userData?.agencyId || userData.role === 'master' || userData.role === 'seller') return;

    const unsubscribeAgencies = onSnapshot(collection(db, "agencies"), (snap) => {
      const agenciesMap: Record<string, string> = {};
      snap.forEach((d) => {
        const data = d.data();
        if (d.id !== userData.agencyId && data.shareInventory === true) {
          agenciesMap[d.id] = data.name || "Agencia Externa";
        }
      });
      setSharingAgencies(agenciesMap);
    }, (err) => {
      console.error("Error loading other sharing agencies:", err);
    });

    return () => unsubscribeAgencies();
  }, [userData]);

  // 3. Listen to our active clients (not won, not lost) that have wantedVehicle
  useEffect(() => {
    if (!userData?.agencyId || userData.role === 'master' || userData.role === 'seller') return;

    const agencyQuery = where("agencyId", "==", userData.agencyId);
    const clientsQ = query(collection(db, "clients"), agencyQuery);

    const unsubscribeClients = onSnapshot(clientsQ, (snap) => {
      const activeClients: Client[] = [];
      snap.forEach((d) => {
        const c = { id: d.id, ...d.data() } as Client;
        if (
          c.status !== "won" &&
          c.status !== "lost" &&
          c.status !== "Ganado" &&
          c.status !== "Perdido" &&
          c.wantedVehicle &&
          (c.wantedVehicle.make ||
            c.wantedVehicle.model ||
            c.wantedVehicle.priceMax ||
            c.wantedVehicle.yearMin ||
            (c.wantedVehicle.bodyType && c.wantedVehicle.bodyType !== "Cualquiera"))
        ) {
          activeClients.push(c);
        }
      });
      setClients(activeClients);
    }, (err) => {
      console.error("Error loading active clients for matches:", err);
    });

    return () => unsubscribeClients();
  }, [userData]);

  // 4. Available vehicles from other agencies (only if we are sharing)
  const otherVehicles = useInventarioCompartido(
    Object.keys(sharingAgencies),
    !!userData?.agencyId &&
      userData.role !== 'master' &&
      userData.role !== 'seller' &&
      ownAgencySharing
  );

  // 5. Calculate matches whenever clients or otherVehicles change
  useEffect(() => {
    if (!ownAgencySharing || clients.length === 0 || otherVehicles.length === 0) {
      setMatches([]);
      setLoading(false);
      return;
    }

    const calculated: SharedMatch[] = [];
    clients.forEach((client) => {
      const clientMatches = getClientMatches(client, otherVehicles);
      clientMatches.forEach((m) => {
        const isDismissed = client.dismissedMatches?.includes(`${m.vehicle.id}_${m.vehicle.price || 0}`);
        if (isDismissed) return;
        calculated.push({
          client,
          vehicle: m.vehicle,
          score: m.score,
          level: m.level,
          agencyName: sharingAgencies[m.vehicle.agencyId] || "Agencia Externa",
        });
      });
    });

    // Sort by score descending
    calculated.sort((a, b) => b.score - a.score);
    setMatches(calculated);
    setLoading(false);
  }, [clients, otherVehicles, sharingAgencies, ownAgencySharing]);

  return {
    ownAgencySharing,
    sharingAgenciesCount: Object.keys(sharingAgencies).length,
    sharingAgencies,
    otherVehicles,
    matches,
    loading,
  };
}
