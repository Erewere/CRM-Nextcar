import { motion } from "motion/react";
import React, { useState } from 'react';
import { X } from 'lucide-react';

interface Props {
  onConfirm: (payment: { amount: number; date: string; method: 'efectivo' | 'transferencia' | 'tarjeta' | 'cheque' | 'otro'; notes?: string }) => void;
  onCancel: () => void;
  maxAmount: number;
}

export function PaymentModal({ onConfirm, onCancel, maxAmount }: Props) {
  const [amount, setAmount] = useState<string>(String(maxAmount));
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [method, setMethod] = useState<'efectivo' | 'transferencia' | 'tarjeta' | 'cheque' | 'otro'>('efectivo');
  const [notes, setNotes] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm({
      amount: parseFloat(amount) || 0,
      date,
      method,
      notes
    });
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-end md:items-center justify-center p-0 md:p-4">
      <motion.div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} />
      <motion.div 
        className="bg-white dark:bg-slate-900 md:rounded rounded-t-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col border border-gray-200 dark:border-slate-800 relative z-10"
        initial={{ y: "60vh", scaleX: 0.3, scaleY: 0.05, opacity: 0, borderRadius: "10rem" }}
        animate={{ y: 0, scaleX: 1, scaleY: 1, opacity: 1, borderRadius: "1.5rem" }}
        exit={{ y: "60vh", scaleX: 0.3, scaleY: 0.05, opacity: 0, borderRadius: "10rem", transition: { duration: 0.25, ease: "easeInOut" } }}
        transition={{ type: "spring", damping: 22, stiffness: 280, mass: 0.8 }}
        style={{ transformOrigin: "bottom center" }}
      >
        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-slate-800 bg-emerald-50 dark:bg-emerald-900/20">
          <h2 className="text-lg font-bold text-emerald-800 dark:text-emerald-400">
            Registrar Pago
          </h2>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form id="payment-form" onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Monto ($)
            </label>
            <input
              type="number"
              required
              min="0.01"
              step="0.01"
              max={maxAmount}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Fecha de Pago
            </label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Forma de Pago
            </label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as any)}
              className="w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
            >
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
              <option value="tarjeta">Tarjeta</option>
              <option value="cheque">Cheque</option>
              <option value="otro">Otro</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Notas (Opcional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
              placeholder="Ej. Referencia 123456"
            />
          </div>
        </form>

        <div className="p-4 border-t border-gray-200 dark:border-slate-800 bg-[#f4f5f5] dark:bg-slate-900/50 flex justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="payment-form"
            className="px-4 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded transition-colors shadow-sm"
          >
            Guardar Pago
          </button>
        </div>
      </motion.div>
    </div>
  );
}
