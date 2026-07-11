import { addDoc, collection, Firestore } from 'firebase/firestore';

export const createPaymentTasks = async (db: Firestore, client: any, saleDetails: any, userData: any) => {
  if (saleDetails.method !== 'credito' || !saleDetails.firstPaymentDate || !saleDetails.termMonths) return;
  
  const term = parseInt(saleDetails.termMonths) || 0;
  const paymentAmount = saleDetails.calculatedMonthlyPayment || 0;
  let currentDate = new Date(saleDetails.firstPaymentDate);
  currentDate.setHours(12, 0, 0, 0);

  for (let i = 1; i <= term; i++) {
    const taskData = {
      agencyId: client.agencyId,
      sellerId: userData?.id || client.sellerId,
      clientId: client.id,
      title: `Pago ${i}/${term} - Crédito de ${client.name}`,
      notes: `Monto a cobrar: $${paymentAmount.toFixed(2)}`,
      dueDate: currentDate.toISOString().split('T')[0],
      completed: false,
      type: "payment",
      createdAt: new Date().toISOString(),
    };
    
    await addDoc(collection(db, "tasks"), taskData);

    currentDate.setMonth(currentDate.getMonth() + 1);
  }
};
