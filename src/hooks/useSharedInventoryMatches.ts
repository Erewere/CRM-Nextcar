import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot, doc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { Client, Vehicle } from "../types";
import { getClientMatches } from "../services/matchingEngine";

export interface SharedMatch {
  client: Client;
  vehicle: Vehicle;
  score: number;
  level: 'exact' | 'high' | 'medium' | 'low';
  agencyName: string;
}

export function useSharedInventoryMatches() {
  const { userData } = useAuth();
  const [ownAgencySharing, setOwnAgencySharing] = useState(false);
  const [sharingAgencies, setSharingAgencies] = useState<Record<string, string>>({});
  const [otherVehicles, setOtherVehicles] = useState<Vehicle[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [matches, setMatches] = useState<SharedMatch[]>([]);
  const [loading, setLoading] = useState(true);

  // 1. Listen to own agency's sharing status
  useEffect(() => {
    if (!userData?.agencyId || userData.role === 'master') {
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
    if (!userData?.agencyId || userData.role === 'master') return;

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
    if (!userData?.agencyId || userData.role === 'master') return;

    const agencyQuery = where("agencyId", "==", userData.agencyId);
    let clientsQ = query(collection(db, "clients"), agencyQuery);

    if (userData.role === "seller") {
      clientsQ = query(
        collection(db, "clients"),
        agencyQuery,
        where("sellerId", "==", userData.id)
      );
    }

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

  // 4. Listen to available vehicles from other agencies (only if we are sharing)
  useEffect(() => {
    if (!userData?.agencyId || userData.role === 'master') return;
    
    // We only load shared vehicles if we are sharing ourselves to keep it fair and secure,
    // but we can load them anyway to calculate matches or conditionally restrict. Let's load them!
    const sharingIds = Object.keys(sharingAgencies);
    if (sharingIds.length === 0) {
      setOtherVehicles([]);
      return;
    }

    // Load available vehicles. Since Firestore "in" operator has a max of 30, we can fetch all "available" vehicles
    // and filter them in memory, or query them. Fetching all available vehicles is very standard.
    const vehiclesQ = query(
      collection(db, "vehicles"),
      where("status", "==", "available")
    );

    const unsubscribeVehicles = onSnapshot(vehiclesQ, (snap) => {
      const list: Vehicle[] = [];
      snap.forEach((d) => {
        const v = { id: d.id, ...d.data() } as Vehicle;
        if (v.agencyId !== userData.agencyId && sharingAgencies[v.agencyId]) {
          list.push(v);
        }
      });
      setOtherVehicles(list);
    }, (err) => {
      console.error("Error loading available vehicles for matches:", err);
    });

    return () => unsubscribeVehicles();
  }, [sharingAgencies, userData]);

  // 5. Calculate matches whenever clients or otherVehicles change
  useEffect(() => {
    if (clients.length === 0 || otherVehicles.length === 0) {
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
  }, [clients, otherVehicles, sharingAgencies]);

  return {
    ownAgencySharing,
    sharingAgenciesCount: Object.keys(sharingAgencies).length,
    sharingAgencies,
    otherVehicles,
    matches,
    loading,
  };
}
