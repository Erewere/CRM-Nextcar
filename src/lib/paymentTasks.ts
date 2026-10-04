import { collection, doc, Firestore, getDocs, query, setDoc, where } from 'firebase/firestore';

/**
 * Tareas de cobro de un crédito de la casa: una por mensualidad.
 *
 * Se llamaba desde cinco lugares (embudo, ficha del cliente, página del auto,
 * pago que marca la venta, teléfono) y cada llamada las creaba otra vez: con
 * un doble clic en «Trato ganado», o al registrar después un pago, el cliente
 * quedaba con todos los pagos repetidos. Ahora:
 *  - cada tarea tiene un id fijo (cliente + primera fecha + plazo + número),
 *    así que si dos llamadas llegan a la vez escriben la misma tarea, no dos;
 *  - antes de crear, se revisa si ya existen las tareas de este crédito.
 *
 * Las fechas se calculan en hora local: antes «2026-11-05» se leía como
 * medianoche de Londres y en México caía el 4. Y si el primer pago es un 31,
 * los meses cortos usan su último día en vez de brincarse al mes siguiente.
 */

function fechaDelPago(primera: string, mesesDespues: number) {
  const [a, m, d] = primera.slice(0, 10).split('-').map(Number);
  const base = new Date(a, m - 1 + mesesDespues, 1, 12);
  const ultimoDia = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
  base.setDate(Math.min(d, ultimoDia));
  const mm = String(base.getMonth() + 1).padStart(2, '0'), dd = String(base.getDate()).padStart(2, '0');
  return `${base.getFullYear()}-${mm}-${dd}`;
}

export const createPaymentTasks = async (db: Firestore, client: any, saleDetails: any, userData: any) => {
  if (!saleDetails || saleDetails.method !== 'credito' || !saleDetails.firstPaymentDate || !saleDetails.termMonths) return;
  if (!client?.id || !client?.agencyId) return;

  const term = parseInt(saleDetails.termMonths) || 0;
  if (term <= 0) return;
  const paymentAmount = Number(saleDetails.calculatedMonthlyPayment) || 0;
  const primera = String(saleDetails.firstPaymentDate).slice(0, 10);
  const titulo = (i: number) => `Pago ${i}/${term} - Crédito de ${client.name}`;
  const idDe = (i: number) => `pago_${client.id}_${primera}_${term}_${i}`.replace(/[^\w-]/g, '_');

  // ¿Ya están? Se buscan las tareas de cobro del cliente con la misma primera
  // fecha y plazo (también las creadas antes de este cambio, con otro id).
  try {
    const existentes = await getDocs(query(
      collection(db, 'tasks'),
      where('agencyId', '==', client.agencyId),
      where('clientId', '==', client.id),
      where('type', '==', 'payment'),
    ));
    const fechas = new Set(existentes.docs.map((d) => `${(d.data() as any).title}|${(d.data() as any).dueDate}`));
    if (fechas.has(`${titulo(1)}|${fechaDelPago(primera, 0)}`) || existentes.docs.some((d) => d.id === idDe(1))) return;
  } catch {
    // Si no se pudo revisar, el id fijo evita de todos modos los duplicados.
  }

  for (let i = 1; i <= term; i++) {
    await setDoc(doc(db, 'tasks', idDe(i)), {
      agencyId: client.agencyId,
      sellerId: userData?.id || client.sellerId,
      clientId: client.id,
      title: titulo(i),
      notes: `Monto a cobrar: $${paymentAmount.toFixed(2)}`,
      dueDate: fechaDelPago(primera, i - 1),
      completed: false,
      type: 'payment',
      createdAt: new Date().toISOString(),
    });
  }
};
