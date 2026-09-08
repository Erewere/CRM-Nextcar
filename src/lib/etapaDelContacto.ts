import {
  collection,
  doc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "./firebase";
import { checkIsWon, checkIsLost, sanitizeFirestoreData } from "./clientUtils";

/**
 * Elegir una etapa en la ficha de un contacto.
 *
 * El embudo se arma solo con tratos: `displayClients` en Kanban recorre
 * `deals`, nunca `clients`. Por eso la etapa guardada en el contacto no movia
 * nada -- se veia en la columna "Etapa" de Personas y en ningun otro lado.
 * Aqui esa eleccion pasa a significar algo.
 *
 * Tres reglas, y las tres salen de casos reales de la agencia:
 *
 * 1. **Si ya hay un trato abierto, se mueve ese.** Un contacto con dos tratos
 *    abiertos por el mismo auto son dos tarjetas compitiendo en el embudo y
 *    dos vendedores creyendo que la venta es suya.
 *
 * 2. **Si sus tratos estan todos cerrados, se abre uno nuevo.** El mismo
 *    cliente que vuelve a comprar un ano despues es normal aqui; reabrir la
 *    venta vieja falsearia el historial.
 *
 * 3. **Las etapas finales no crean nada.** Un trato recien nacido en "Ganados"
 *    seria una venta sin auto, sin importe y sin pagos, contaminando Ventas
 *    Cerradas y los reportes. Y "Contacto" es justamente la etapa que dice
 *    "esto todavia no es un trato" (el CRM la guarda como `lost`).
 */
export type ResultadoEtapa =
  | { accion: "ninguna"; motivo: "sin-etapa" | "etapa-final"; dealId?: undefined }
  | { accion: "movido" | "creado"; motivo?: undefined; dealId: string };

export async function aplicarEtapaAlTrato(datos: {
  clientId: string;
  agencyId: string;
  sellerId: string;
  etapa: string;
  pipelineStages?: { id: string; title?: string }[];
  nombre?: string;
  vehicle?: string | null;
  vehicleId?: string | null;
  esMaster?: boolean;
}): Promise<ResultadoEtapa> {
  const etapa = String(datos.etapa || "").trim();
  const etapas = datos.pipelineStages || [];

  if (!etapa) return { accion: "ninguna", motivo: "sin-etapa" };
  if (checkIsWon(etapa, etapas) || checkIsLost(etapa, etapas)) {
    return { accion: "ninguna", motivo: "etapa-final" };
  }

  // Acotado a la agencia salvo para el master, igual que el resto de
  // consultas de tratos de la aplicacion.
  const consulta =
    !datos.esMaster && datos.agencyId
      ? query(
          collection(db, "deals"),
          where("clientId", "==", datos.clientId),
          where("agencyId", "==", datos.agencyId),
        )
      : query(collection(db, "deals"), where("clientId", "==", datos.clientId));

  const snap = await getDocs(consulta);

  const abierto = snap.docs.find((d) => {
    const s = String(d.data()?.status || "");
    return !checkIsWon(s, etapas) && !checkIsLost(s, etapas);
  });

  if (abierto) {
    await updateDoc(abierto.ref, {
      status: etapa,
      updatedAt: new Date().toISOString(),
    });
    return { accion: "movido", dealId: abierto.id };
  }

  const ref = doc(collection(db, "deals"));
  await setDoc(
    ref,
    sanitizeFirestoreData({
      id: ref.id,
      clientId: datos.clientId,
      agencyId: datos.agencyId,
      sellerId: datos.sellerId,
      title: datos.vehicle
        ? `Trato: ${datos.vehicle}`
        : `Trato con ${datos.nombre || "Cliente"}`,
      status: etapa,
      value: 0,
      vehicle: datos.vehicle || null,
      vehicleId: datos.vehicleId || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
  );
  return { accion: "creado", dealId: ref.id };
}
