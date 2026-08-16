import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import { checkIsWon } from "./clientUtils";

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
