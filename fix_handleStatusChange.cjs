const fs = require('fs');
let code = fs.readFileSync('src/components/ClientDetailModal.tsx', 'utf8');

const oldHandleStatusChangeRegex = /  const handleStatusChange = async \(newStatus: string\) => \{[\s\S]*?console\.error\("Error updating status:", err\);\n      \}\n    \}\n  \};/;

const newHandleStatusChange = `  const handleStatusChange = async (newStatus: string) => {
    if (newStatus === "won") {
      setShowDealWonModal(true);
      return;
    }

    setFormData((prev) => {
      const updates: Partial<Client> = { status: newStatus };
      return { ...prev, ...updates };
    });

    if (!isNew && client.id) {
      try {
        const updates: any = {
          status: newStatus,
          updatedAt: new Date().toISOString(),
        };
        await updateDoc(doc(db, "clients", client.id as string), updates);
      } catch (err) {
        console.error("Error updating status:", err);
      }
    }
  };

  const handleDealWonConfirm = async (saleDetails: any) => {
    setShowDealWonModal(false);
    
    setFormData((prev) => {
      const updates: Partial<Client> = { 
        status: "won",
        soldAt: new Date().toISOString().split('T')[0],
        saleDetails 
      };
      return { ...prev, ...updates };
    });

    if (!isNew && client.id) {
      try {
        const updates: any = {
          status: "won",
          soldAt: new Date().toISOString().split('T')[0],
          saleDetails,
          updatedAt: new Date().toISOString(),
        };
        await updateDoc(doc(db, "clients", client.id as string), updates);
        
        if (formData.vehicleId) {
          await updateDoc(doc(db, "vehicles", formData.vehicleId), {
            pendingValidation: {
              type: "sold",
              requestedBy: userData?.id,
              requestedByName: userData?.name || userData?.email,
              clientId: client.id,
              clientName: client.name || formData.name,
              requestedAt: new Date().toISOString(),
            },
          });
        }
        
        await createPaymentTasks(db, {...client, ...formData}, saleDetails, userData);
      } catch (err) {
        console.error("Error updating status:", err);
      }
    }
  };
  
  const handlePaymentConfirm = async (payment: any) => {
    setShowPaymentModal(false);
    if (!formData.saleDetails) return;
    
    const newPayment = {
      ...payment,
      id: Math.random().toString(36).substr(2, 9)
    };
    
    const updatedSaleDetails = {
      ...formData.saleDetails,
      payments: [...(formData.saleDetails.payments || []), newPayment]
    };
    
    setFormData(prev => ({
      ...prev,
      saleDetails: updatedSaleDetails
    }));
    
    if (!isNew && client.id) {
      try {
        await updateDoc(doc(db, "clients", client.id as string), {
          saleDetails: updatedSaleDetails,
          updatedAt: new Date().toISOString()
        });
      } catch (err) {
        console.error("Error saving payment", err);
      }
    }
  };`;

if (!code.includes('handlePaymentConfirm')) {
  code = code.replace(oldHandleStatusChangeRegex, newHandleStatusChange);
}

// Add modals
const renderReturn = `  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/50 backdrop-blur-sm">`;

const replaceReturn = `  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/50 backdrop-blur-sm">
      {showDealWonModal && <DealWonModal client={{...client, ...formData} as Client} onConfirm={handleDealWonConfirm} onCancel={() => setShowDealWonModal(false)} />}
      {showPaymentModal && formData.saleDetails && (
        <PaymentModal
          maxAmount={Math.max(0, formData.saleDetails.price - (formData.saleDetails.payments?.reduce((a, p) => a + p.amount, 0) || 0))}
          onConfirm={handlePaymentConfirm}
          onCancel={() => setShowPaymentModal(false)}
        />
      )}`;

if (!code.includes('<DealWonModal')) {
  code = code.replace(renderReturn, replaceReturn);
}

fs.writeFileSync('src/components/ClientDetailModal.tsx', code);
