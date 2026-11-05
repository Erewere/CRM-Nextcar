import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";

/**
 * Lo gastado en cada auto (reparacion, tramites, lo que se le invirtio), sumado
 * por auto: vehicleId -> total. Junto con el precio de compra da lo invertido,
 * que es la base del ROI del tablero.
 *
 * Solo se consulta si `activo`: quien no puede ver costos no necesita los
 * gastos, y asi no se abre una conexion de mas.
 */
export function useGastosPorAuto(activo: boolean) {
  const { userData } = useAuth();
  const [gastos, setGastos] = useState<Record<string, number>>({});
  const agencyId = userData?.agencyId;
  const esMaster = userData?.role === "master";

  useEffect(() => {
    if (!activo || (!agencyId && !esMaster)) {
      setGastos({});
      return;
    }
    const consulta = esMaster
      ? query(collection(db, "vehicleExpenses"))
      : query(collection(db, "vehicleExpenses"), where("agencyId", "==", agencyId));
    return onSnapshot(
      consulta,
      (snap) => {
        const mapa: Record<string, number> = {};
        snap.forEach((d) => {
          const g = d.data();
          const monto = Number(g.amount);
          if (g.vehicleId && Number.isFinite(monto)) mapa[g.vehicleId] = (mapa[g.vehicleId] || 0) + monto;
        });
        setGastos(mapa);
      },
      (err) => {
        console.error("Error cargando gastos de autos:", err);
        setGastos({});
      },
    );
  }, [activo, agencyId, esMaster]);

  return gastos;
}
