import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";

/**
 * Un trato con auto asignado nunca debe valer $0: si su valor está vacío se
 * toma el precio del auto. No toca un valor ya escrito (ni el de una venta
 * cerrada, que vive en saleDetails). Se llama al cambiar un trato de etapa.
 * Devuelve el valor puesto, o null si no hizo falta o no se pudo.
 */
export async function completarValorDelTrato(dealId: string | null | undefined): Promise<number | null> {
  if (!dealId) return null;
  try {
    const ref = doc(db, "deals", dealId);
    const d: any = (await getDoc(ref)).data();
    if (!d || Number(d.value) > 0 || Number(d.saleDetails?.price) > 0 || !d.vehicleId) return null;
    const v: any = (await getDoc(doc(db, "vehicles", d.vehicleId))).data();
    const precio = Number(v?.price) || 0;
    if (precio <= 0) return null;
    await updateDoc(ref, { value: precio, dealValue: precio });
    return precio;
  } catch (e) {
    console.error("completarValorDelTrato:", e);
    return null;
  }
}
