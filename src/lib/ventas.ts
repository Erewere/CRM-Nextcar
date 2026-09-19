import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import { checkIsWon, checkIsLost } from "./clientUtils";

/**
 * Reglas de una venta, en un solo lugar.
 *
 * Un auto puede tener varios tratos asignados a la vez: es normal que dos o
 * tres clientes anden viendo la misma unidad. Lo que no puede es venderse dos
 * veces. Cuando uno de esos tratos se cierra, ese es el unico que registra la
 * venta y sus pagos; los demas siguen su curso o se pierden, pero no la
 * cobran.
 *
 * Sin esta comprobacion, cerrar la venta del mismo auto desde dos tratos
 * dejaba dos ventas del mismo vehiculo, cada una con su saldo, y las cuentas
 * de la agencia contaban esa unidad dos veces.
 */
export interface VentaEnConflicto {
  dealId: string;
  titulo: string;
  cliente?: string;
}

/**
 * Devuelve el trato que ya registra la venta de ese auto, si lo hay.
 * `dealIdActual` se excluye: reabrir o corregir la propia venta es valido.
 */
export async function ventaYaRegistrada(
  vehicleId: string | undefined | null,
  agencyId: string | undefined,
  dealIdActual?: string | null
): Promise<VentaEnConflicto | null> {
  if (!vehicleId || !agencyId) return null;

  const q = query(
    collection(db, "deals"),
    where("agencyId", "==", agencyId),
    where("vehicleId", "==", vehicleId)
  );
  const snap = await getDocs(q);

  for (const d of snap.docs) {
    if (d.id === dealIdActual) continue;
    const datos: any = d.data() || {};
    const esVenta = checkIsWon(datos.status) || Boolean(datos.saleDetails?.price);
    if (esVenta) {
      return {
        dealId: d.id,
        titulo: datos.title || "Trato sin nombre",
        cliente: datos.clientName,
      };
    }
  }
  return null;
}

/** Mensaje para cuando se intenta vender un auto que ya se vendio. */
export function avisoDeVentaDuplicada(conflicto: VentaEnConflicto): string {
  return (
    `Este auto ya está registrado como vendido en "${conflicto.titulo}".\n\n` +
    "Un auto solo puede venderse una vez: ese trato es el que lleva la venta y " +
    "sus pagos. Si la venta buena es esta, primero descarta la otra desde su " +
    "panel de Venta & Pagos."
  );
}

type Etapas = { id: string; title?: string }[];

/** ¿Este trato ya lleva una venta? Ganado, o con precio o pagos registrados. */
export function tratoConVenta(t: any, etapas: Etapas = []): boolean {
  return (
    checkIsWon(t?.status, etapas) ||
    Boolean(t?.saleDetails?.price) ||
    (t?.saleDetails?.payments?.length || 0) > 0
  );
}

const masReciente = (a: any, b: any) =>
  String(b?.updatedAt || b?.createdAt || "").localeCompare(String(a?.updatedAt || a?.createdAt || ""));

/**
 * Cual de los tratos de un contacto es el de esta venta.
 *
 * Cuando la venta se cierra desde la ficha del contacto no hay un trato en la
 * mano, y se tomaba el primero que devolviera la base: en Autos Vrit fue un
 * trato viejo sin auto, mientras el trato de la Urvan quedaba aparte, y la
 * venta acabo duplicada. El orden aqui es el que usaria una persona: el trato
 * de ese mismo auto; si no, el que ya lleve la venta; si no, el abierto con
 * auto asignado; si no, el abierto mas reciente. Un trato de otro auto nunca
 * es esta venta. Sin candidato devuelve null y quien llama crea el trato.
 */
export function elegirTratoDeLaVenta<T extends { id: string }>(
  tratos: T[],
  vehicleId?: string | null,
  etapas: Etapas = []
): T | null {
  const candidatos = tratos
    .filter((t: any) => !t.isDeleted)
    .filter((t: any) => !(vehicleId && t.vehicleId && t.vehicleId !== vehicleId))
    .sort(masReciente);
  const abierto = (t: any) => !checkIsLost(t.status, etapas);
  const mismoAuto = (t: any) => Boolean(vehicleId) && t.vehicleId === vehicleId;
  return (
    candidatos.find((t) => mismoAuto(t) && tratoConVenta(t, etapas)) ||
    candidatos.find((t) => mismoAuto(t) && abierto(t)) ||
    candidatos.find((t) => tratoConVenta(t, etapas)) ||
    candidatos.find((t: any) => abierto(t) && t.vehicleId) ||
    candidatos.find((t) => abierto(t)) ||
    null
  );
}

/**
 * Cual trato se pierde cuando el contacto se marca como perdido desde su
 * ficha. Nunca uno que ya lleve una venta: tomar el primero de la lista podia
 * mandar a "perdido" justo el trato ganado, con sus pagos.
 */
export function elegirTratoAbierto<T extends { id: string }>(
  tratos: T[],
  vehicleId?: string | null,
  etapas: Etapas = []
): T | null {
  const abiertos = tratos
    .filter((t: any) => !t.isDeleted && !tratoConVenta(t, etapas) && !checkIsLost(t.status, etapas))
    .sort(masReciente);
  return (vehicleId && abiertos.find((t: any) => t.vehicleId === vehicleId)) || abiertos[0] || null;
}
