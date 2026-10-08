import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";

/**
 * Un trato que se marca como perdido ya no tiene venta. Si traía una (porque
 * antes estuvo ganado), se limpia en los tres lugares donde vive: el trato, la
 * referencia del contacto y el estado del auto. Sin esto la venta quedaba
 * "huérfana" en Pagos y en Personas, y el botón Descartar venta ya no aparece
 * porque el trato dejó de estar ganado.
 */
export async function quitarVentaDeTratoPerdido(dealId: string | null | undefined): Promise<void> {
  if (!dealId) return;
  try {
    const refTrato = doc(db, "deals", dealId);
    const t: any = (await getDoc(refTrato)).data();
    if (!t || (!t.saleDetails && !t.soldAt)) return;
    const ahora = new Date().toISOString();
    await updateDoc(refTrato, { saleDetails: null, soldAt: null, updatedAt: ahora });

    if (t.clientId) {
      const refContacto = doc(db, "clients", t.clientId);
      const c: any = (await getDoc(refContacto)).data();
      if (c && (!c.ventaDealId || c.ventaDealId === dealId)) {
        await updateDoc(refContacto, { saleDetails: null, soldAt: null, ventaDealId: null, dealValue: null, updatedAt: ahora });
      }
    }
    if (t.vehicleId) {
      const refAuto = doc(db, "vehicles", t.vehicleId);
      const a: any = (await getDoc(refAuto)).data();
      if (a && a.soldDealId === dealId) {
        await updateDoc(refAuto, { status: "available", saleDetails: null, soldAt: null, buyerId: null, soldToClientId: null, soldDealId: null, updatedAt: ahora });
      }
    }
  } catch (e) {
    console.error("quitarVentaDeTratoPerdido:", e);
  }
}
