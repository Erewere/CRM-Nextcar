import { useEffect, useMemo, useState } from "react";
import { collection, query, where, onSnapshot, doc, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { Vehicle } from "../types";
import { can } from "../lib/permissions";

/**
 * El precio de compra de cada auto.
 *
 * Vive en la coleccion vehicleFinancials y no dentro del vehiculo, porque
 * Firestore concede o niega documentos completos: no sabe esconder un campo.
 * Mientras el costo estuvo dentro del vehiculo, ocultarlo en pantalla era
 * cosmetico -- cualquiera con acceso al inventario podia leerlo consultando la
 * base directamente. Separado, la regla puede negarlo sin negar el auto.
 *
 * Quien no tiene el permiso de costo ni siquiera consulta esta coleccion: la
 * regla se lo negaria. Para esa persona los costos simplemente no existen, y
 * las pantallas muestran lo que ya mostraban cuando el dato venia vacio.
 */
export function useCostosVehiculos() {
  const { userData } = useAuth();
  const [costos, setCostos] = useState<Record<string, number>>({});

  const puedeVerCostos = can(userData?.role, "vehiculos.costo");
  const agencyId = userData?.agencyId;
  const esMaster = userData?.role === "master";

  useEffect(() => {
    if (!puedeVerCostos || (!agencyId && !esMaster)) {
      setCostos({});
      return;
    }

    // El master no pertenece a una agencia operativa; la regla le permite la
    // coleccion completa.
    const consulta = esMaster
      ? query(collection(db, "vehicleFinancials"))
      : query(collection(db, "vehicleFinancials"), where("agencyId", "==", agencyId));

    const cancelar = onSnapshot(
      consulta,
      (snap) => {
        const mapa: Record<string, number> = {};
        snap.forEach((d) => {
          const valor = Number(d.data().purchasePrice);
          if (!Number.isNaN(valor)) mapa[d.id] = valor;
        });
        setCostos(mapa);
      },
      (err) => {
        console.error("Error cargando costos de vehiculos:", err);
        setCostos({});
      }
    );

    return () => cancelar();
  }, [puedeVerCostos, agencyId, esMaster]);

  return useMemo(
    () => ({
      puedeVerCostos,

      /** Costo de un auto, o 0 si no se conoce o no se tiene permiso. */
      costoDe: (vehicleId?: string) => (vehicleId ? costos[vehicleId] || 0 : 0),

      /**
       * Devuelve los autos con su costo puesto de vuelta, para que las
       * pantallas sigan leyendo vehicle.purchasePrice como siempre.
       */
      conCosto: <T extends Vehicle>(vehiculos: T[]): T[] =>
        vehiculos.map((v) =>
          v.id && costos[v.id] !== undefined
            ? ({ ...v, purchasePrice: costos[v.id] } as T)
            : v
        ),
    }),
    [costos, puedeVerCostos]
  );
}

/**
 * Guarda el costo de un auto en su lugar aparte.
 *
 * Se usa al dar de alta o editar un vehiculo. Si el costo viene vacio no se
 * escribe nada, para no crear registros en cero que despues parezcan datos.
 */
export async function guardarCosto(
  vehicleId: string,
  agencyId: string,
  purchasePrice: number | undefined | null
): Promise<void> {
  if (purchasePrice === undefined || purchasePrice === null || Number.isNaN(Number(purchasePrice))) {
    return;
  }
  await setDoc(
    doc(db, "vehicleFinancials", vehicleId),
    {
      vehicleId,
      agencyId,
      purchasePrice: Number(purchasePrice),
      actualizadoEl: new Date().toISOString(),
    },
    { merge: true }
  );
}
