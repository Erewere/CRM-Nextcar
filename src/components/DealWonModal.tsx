import { motion } from "motion/react";
import React, { useState, useEffect } from 'react';
import { X, Calculator } from 'lucide-react';
import { Client, SaleDetails } from '../types';

interface Props {
  client: Client;
  onConfirm: (details: SaleDetails) => void;
  onCancel: () => void;
}

export function DealWonModal({ client, onConfirm, onCancel }: Props) {
  const [method, setMethod] = useState<'contado' | 'credito' | 'credito_bancario'>('contado');
  const [price, setPrice] = useState<string>(client.dealValue ? String(client.dealValue) : '');
  const [downPayment, setDownPayment] = useState<string>('');
  const [termMonths, setTermMonths] = useState<string>('24');
  const [interestRate, setInterestRate] = useState<string>('1.5');
  const [interestType, setInterestType] = useState<'mensual' | 'anual'>('mensual');
  const [firstPaymentDate, setFirstPaymentDate] = useState<string>(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );

  const [summary, setSummary] = useState<SaleDetails | null>(null);

  useEffect(() => {
    const p = parseFloat(price) || 0;
    
    if (method === 'contado' || method === 'credito_bancario') {
      setSummary({
        method,
        price: p,
      });
      return;
    }

    const dp = parseFloat(downPayment) || 0;
    const t = parseInt(termMonths) || 0;
    const rate = parseFloat(interestRate) || 0;

    const amountToFinance = Math.max(0, p - dp);
    
    let totalInterest = 0;
    if (interestType === 'mensual') {
      // interes global fijo mensual
      totalInterest = amountToFinance * (rate / 100) * t;
    } else {
      // interes global fijo anual
      totalInterest = amountToFinance * (rate / 100) * (t / 12);
    }

    const totalAmount = amountToFinance + totalInterest;
    const monthlyPayment = t > 0 ? totalAmount / t : 0;

    setSummary({
      method,
      price: p,
      downPayment: dp,
      termMonths: t,
      interestRate: rate,
      interestType,
      calculatedTotalInterest: totalInterest,
      calculatedTotalAmount: totalAmount,
      calculatedMonthlyPayment: monthlyPayment,
      firstPaymentDate,
    });
  }, [method, price, downPayment, termMonths, interestRate, interestType, firstPaymentDate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (summary) {
      onConfirm(summary);
    }
  };

  const formatMoney = (val: number) => {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 md:p-4">
      <motion.div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} />
      <motion.div 
        className="bg-white dark:bg-slate-900 md:rounded-xl rounded-t-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800 relative z-10"
        initial={{ y: "60vh", scaleX: 0.3, scaleY: 0.05, opacity: 0, borderRadius: "10rem" }}
        animate={{ y: 0, scaleX: 1, scaleY: 1, opacity: 1, borderRadius: "1.5rem" }}
        exit={{ y: "60vh", scaleX: 0.3, scaleY: 0.05, opacity: 0, borderRadius: "10rem", transition: { duration: 0.25, ease: "easeInOut" } }}
        transition={{ type: "spring", damping: 22, stiffness: 280, mass: 0.8 }}
        style={{ transformOrigin: "bottom center" }}
      >
        <div className="flex justify-between items-center p-4 border-b border-slate-100 dark:border-slate-800 bg-emerald-50 dark:bg-emerald-900/20">
          <h2 className="text-lg font-bold text-emerald-800 dark:text-emerald-400 flex items-center gap-2">
            🎉 ¡Trato Ganado!
          </h2>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[70vh]">
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
            Por favor, completa los detalles de la venta para <strong>{client.name}</strong>.
          </p>

          <form id="deal-won-form" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Método de Venta
              </label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as any)}
                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
              >
                <option value="contado">Contado</option>
                <option value="credito_bancario">Crédito Bancario</option>
                <option value="credito">Crédito Propio (In-house)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Precio de Venta ($)
              </label>
              <input
                type="number" inputMode="numeric" pattern="[0-9]*"
                required
                min="0"
                step="any"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
                placeholder="Ej. 150000"
              />
            </div>

            {method === 'credito' && (
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4">
                <h3 className="text-sm font-bold flex items-center gap-2 text-slate-800 dark:text-slate-200">
                  <Calculator className="w-4 h-4 text-blue-500" />
                  Estructura de Financiamiento
                </h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Enganche ($)
                    </label>
                    <input
                      type="number" inputMode="numeric" pattern="[0-9]*"
                      required
                      min="0"
                      step="any"
                      value={downPayment}
                      onChange={(e) => setDownPayment(e.target.value)}
                      className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Plazo (Meses)
                    </label>
                    <input
                      type="number" inputMode="numeric" pattern="[0-9]*"
                      required
                      min="1"
                      step="1"
                      value={termMonths}
                      onChange={(e) => setTermMonths(e.target.value)}
                      className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
                      placeholder="24"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Tasa de Interés (%)
                    </label>
                    <input
                      type="number" inputMode="numeric" pattern="[0-9]*"
                      required
                      min="0"
                      step="any"
                      value={interestRate}
                      onChange={(e) => setInterestRate(e.target.value)}
                      className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
                      placeholder="1.5"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Primer Pago
                    </label>
                    <input
                      type="date"
                      required
                      value={firstPaymentDate}
                      onChange={(e) => setFirstPaymentDate(e.target.value)}
                      className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Tipo de Tasa
                    </label>
                    <select
                      value={interestType}
                      onChange={(e) => setInterestType(e.target.value as any)}
                      className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
                    >
                      <option value="mensual">Mensual</option>
                      <option value="anual">Anual</option>
                    </select>
                  </div>
                </div>

                {summary && summary.calculatedTotalAmount !== undefined && (
                  <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 rounded-lg">
                    <div className="text-xs text-blue-600 dark:text-blue-400 mb-2 font-medium">Resumen (Interés Global Fijo)</div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-600 dark:text-slate-400">Monto a financiar:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {formatMoney((summary.price || 0) - (summary.downPayment || 0))}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-600 dark:text-slate-400">Intereses a cobrar:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {formatMoney(summary.calculatedTotalInterest || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm mb-2 pb-2 border-b border-blue-200 dark:border-blue-800">
                      <span className="text-slate-600 dark:text-slate-400">Total a pagar (s/enganche):</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {formatMoney(summary.calculatedTotalAmount || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm font-bold">
                      <span className="text-blue-800 dark:text-blue-300">Mensualidad ({summary.termMonths} meses):</span>
                      <span className="text-blue-800 dark:text-blue-300">
                        {formatMoney(summary.calculatedMonthlyPayment || 0)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </form>
        </div>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="deal-won-form"
            className="px-4 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-sm"
          >
            Guardar Venta
          </button>
        </div>
      </motion.div>
    </div>
  );
}
