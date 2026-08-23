import { motion } from "motion/react";
import React, { useState, useEffect } from 'react';
import { X, Calculator, CheckCircle2 } from 'lucide-react';
import { SaleDetails, Task } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface PaymentData {
  amount: number;
  date: string;
  method: 'efectivo' | 'transferencia' | 'tarjeta' | 'cheque' | 'otro';
  notes?: string;
  installmentNumber?: number;
  taskIdToComplete?: string;
  markSaleAsWon?: boolean;
}

interface Props {
  onConfirm: (payment: PaymentData) => void;
  onCancel: () => void;
  maxAmount?: number;
  saleDetails?: SaleDetails | null;
  pendingTasks?: Task[];
  isWon?: boolean;
  clientName?: string;
}

export function PaymentModal({
  onConfirm,
  onCancel,
  maxAmount,
  saleDetails,
  pendingTasks = [],
  isWon = false,
  clientName
}: Props) {
  const { userData } = useAuth();
  const [amount, setAmount] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [method, setMethod] = useState<'efectivo' | 'transferencia' | 'tarjeta' | 'cheque' | 'otro'>('transferencia');
  const [notes, setNotes] = useState<string>('');
  const [selectedInstallmentKey, setSelectedInstallmentKey] = useState<string>('');
  const [markAsWon, setMarkAsWon] = useState<boolean>(!isWon);

  // Compute installment schedule if saleDetails has credito method
  const isCredit = saleDetails?.method === 'credito';
  const termMonths = saleDetails?.termMonths || 0;
  const monthlyPayment = saleDetails?.calculatedMonthlyPayment || 0;
  const downPayment = saleDetails?.downPayment || 0;
  const firstPaymentDate = saleDetails?.firstPaymentDate;
  const existingPayments = saleDetails?.payments || [];

  // Build list of installments
  const installmentsList: Array<{
    key: string;
    label: string;
    amount: number;
    dueDate?: string;
    installmentNumber?: number;
    isDownPayment?: boolean;
    isPaid: boolean;
    taskId?: string;
  }> = [];

  if (isCredit) {
    // 1. Enganche if applicable
    if (downPayment > 0) {
      const isDownPaymentPaid = existingPayments.some(p => p.notes?.toLowerCase().includes('enganche') || p.installmentNumber === 0);
      installmentsList.push({
        key: 'downpayment',
        label: `Enganche ($${downPayment.toLocaleString('es-MX')})`,
        amount: downPayment,
        isDownPayment: true,
        installmentNumber: 0,
        isPaid: isDownPaymentPaid,
      });
    }

    // 2. Monthly installments
    if (termMonths > 0 && firstPaymentDate) {
      let currentDate = new Date(firstPaymentDate);
      currentDate.setHours(12, 0, 0, 0);

      for (let i = 1; i <= termMonths; i++) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const formattedDate = currentDate.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
        
        // Check if installment i is paid
        const isPaid = existingPayments.some(p => p.installmentNumber === i);
        
        // Find matching task if any
        const matchingTask = pendingTasks.find(t => 
          !t.completed && (t.title?.includes(`Pago ${i}/${termMonths}`) || t.title?.includes(`Mensualidad ${i}`))
        );

        installmentsList.push({
          key: `installment-${i}`,
          label: `Mensualidad #${i} de ${termMonths} ($${monthlyPayment.toLocaleString('es-MX', { minimumFractionDigits: 2 })}) - Vence ${formattedDate}`,
          amount: monthlyPayment,
          dueDate: dateStr,
          installmentNumber: i,
          isPaid,
          taskId: matchingTask?.id,
        });

        currentDate.setMonth(currentDate.getMonth() + 1);
      }
    }
  }

  // Pre-select first unpaid installment on mount if available
  useEffect(() => {
    if (installmentsList.length > 0) {
      const firstUnpaid = installmentsList.find(i => !i.isPaid);
      if (firstUnpaid) {
        setSelectedInstallmentKey(firstUnpaid.key);
        setAmount(String(firstUnpaid.amount));
        if (firstUnpaid.isDownPayment) {
          setNotes(`Pago de Enganche${clientName ? ` - ${clientName}` : ''}`);
        } else if (firstUnpaid.installmentNumber) {
          setNotes(`Pago de Mensualidad #${firstUnpaid.installmentNumber}/${termMonths}${clientName ? ` - ${clientName}` : ''}`);
        }
      } else if (maxAmount && maxAmount > 0) {
        setAmount(String(maxAmount));
      }
    } else if (maxAmount && maxAmount > 0) {
      setAmount(String(maxAmount));
    }
  }, []);

  const handleInstallmentChange = (key: string) => {
    setSelectedInstallmentKey(key);
    if (!key) return;

    const selected = installmentsList.find(i => i.key === key);
    if (selected) {
      setAmount(String(selected.amount));
      if (selected.isDownPayment) {
        setNotes(`Pago de Enganche${clientName ? ` - ${clientName}` : ''}`);
      } else if (selected.installmentNumber) {
        setNotes(`Pago de Mensualidad #${selected.installmentNumber}/${termMonths}${clientName ? ` - ${clientName}` : ''}`);
      }
    }
  };

  // El boton no se bloqueaba mientras guardaba, asi que un doble clic --
  // o un clic impaciente en una conexion lenta -- registraba el pago dos
  // veces. Una vez enviado, no se vuelve a enviar.
  const [guardando, setGuardando] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (guardando) return;
    if (userData?.role === 'seller') {
      alert("Solamente los administradores pueden registrar pagos.");
      return;
    }
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) {
      alert("Por favor ingresa un monto válido mayor a 0");
      return;
    }

    const selectedInstallment = installmentsList.find(i => i.key === selectedInstallmentKey);

    setGuardando(true);
    onConfirm({
      amount: parsed,
      date,
      method,
      notes: notes.trim(),
      installmentNumber: selectedInstallment?.installmentNumber,
      taskIdToComplete: selectedInstallment?.taskId,
      markSaleAsWon: !isWon && markAsWon,
    });
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-end md:items-center justify-center p-0 md:p-4">
      <motion.div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} />
      <motion.div 
        className="bg-white dark:bg-slate-900 md:rounded rounded-t-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col border border-gray-200 dark:border-slate-800 relative z-10"
        initial={{ y: "60vh", scaleX: 0.3, scaleY: 0.05, opacity: 0, borderRadius: "10rem" }}
        animate={{ y: 0, scaleX: 1, scaleY: 1, opacity: 1, borderRadius: "1.5rem" }}
        exit={{ y: "60vh", scaleX: 0.3, scaleY: 0.05, opacity: 0, borderRadius: "10rem", transition: { duration: 0.25, ease: "easeInOut" } }}
        transition={{ type: "spring", damping: 22, stiffness: 280, mass: 0.8 }}
        style={{ transformOrigin: "bottom center" }}
      >
        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-slate-800 bg-emerald-50 dark:bg-emerald-900/20">
          <div>
            <h2 className="text-lg font-bold text-emerald-800 dark:text-emerald-400 flex items-center gap-2">
              <Calculator className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              Registrar Pago
            </h2>
            {clientName && (
              <p className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                Cliente: {clientName}
              </p>
            )}
          </div>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form id="payment-form" onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Credit Installments Selector if sale is Crédito Propio */}
          {isCredit && installmentsList.length > 0 && (
            <div className="bg-emerald-50/60 dark:bg-emerald-950/30 p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800/50 space-y-2">
              <label className="block text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
                <span>🗓️ Seleccionar Mensualidad / Cuota</span>
                <span className="text-[10px] font-normal text-slate-500 dark:text-slate-400">
                  Crédito a {termMonths} meses
                </span>
              </label>
              <select
                value={selectedInstallmentKey}
                onChange={(e) => handleInstallmentChange(e.target.value)}
                className="w-full border border-emerald-300 dark:border-emerald-700 rounded-lg px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
              >
                <option value="">-- Pago Libre / Abono Libre --</option>
                {installmentsList.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.isPaid ? '✅ ' : '⏳ '} {item.label}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                Al seleccionar una mensualidad se autocompleta la cantidad exacta y el concepto.
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Monto del Pago ($ MXN)
            </label>
            <input
              type="number"
              inputMode="numeric"
              required
              min="0.01"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2.5 text-base font-bold focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
            />
            {maxAmount && maxAmount > 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex justify-between">
                <span>Saldo pendiente: ${maxAmount.toLocaleString('es-MX')}</span>
                <button
                  type="button"
                  onClick={() => setAmount(String(maxAmount))}
                  className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline"
                >
                  Usar saldo pendiente
                </button>
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Fecha de Pago
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Forma de Pago
              </label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as any)}
                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
              >
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
                <option value="tarjeta">Tarjeta</option>
                <option value="cheque">Cheque</option>
                <option value="otro">Otro</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Notas / Concepto
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
              placeholder="Ej. Pago mensualidad 1 o referencia bancaria"
            />
          </div>

          {/* Mark as won / confirm sale toggle if not won yet */}
          {!isWon && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-lg flex items-start gap-2.5">
              <input
                type="checkbox"
                id="mark-won-checkbox"
                checked={markAsWon}
                onChange={(e) => setMarkAsWon(e.target.checked)}
                className="mt-1 rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
              />
              <label htmlFor="mark-won-checkbox" className="text-xs text-slate-700 dark:text-slate-200 font-medium cursor-pointer">
                <span className="font-bold text-amber-800 dark:text-amber-300">🎉 Confirmar venta como Vendida / Ganada</span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Registra oficialmente este auto como vendido y programa la agenda de pagos correspondiente.
                </p>
              </label>
            </div>
          )}
        </form>

        <div className="p-4 border-t border-gray-200 dark:border-slate-800 bg-[#f4f5f5] dark:bg-slate-900/50 flex justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="payment-form"
            disabled={guardando}
            className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-sm flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{guardando ? "Guardando…" : "Guardar Pago"}</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
