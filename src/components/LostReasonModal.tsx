import React, { useState } from "react";
import { X, AlertCircle } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string, details: string) => void;
  clientName?: string;
}

const COMMON_REASONS = [
  "Precio muy alto / Falta de presupuesto",
  "Compró en otra agencia",
  "No califica para crédito / financiamiento",
  "Ya no responde / Perdió interés",
  "Prefirió otro modelo / marca",
  "Mala comunicación / Servicio deficiente",
  "Otro"
];

export function LostReasonModal({ isOpen, onClose, onConfirm, clientName }: Props) {
  const [selectedReason, setSelectedReason] = useState("");
  const [details, setDetails] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReason) {
      alert("Por favor selecciona una razón");
      return;
    }
    onConfirm(selectedReason, details);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded shadow-2xl border border-gray-200 dark:border-slate-700 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700 bg-[#f4f5f5] dark:bg-slate-800/50">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-500" />
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
              Registrar Trato Perdido
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {clientName && (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              ¿Por qué se perdió el trato con <strong className="text-slate-900 dark:text-slate-100">{clientName}</strong>?
            </p>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Motivo de pérdida
            </label>
            <select
              required
              value={selectedReason}
              onChange={(e) => setSelectedReason(e.target.value)}
              className="w-full text-sm bg-[#f4f5f5] dark:bg-slate-900/50 text-slate-800 dark:text-slate-100 rounded px-3 py-2.5 border border-gray-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            >
              <option value="" disabled>
                Seleccione un motivo...
              </option>
              {COMMON_REASONS.map((reason) => (
                <option key={reason} value={reason}>
                  {reason}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Detalles adicionales / Notas
            </label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder={
                selectedReason === "Otro"
                  ? "Describe detalladamente la razón..."
                  : "Notas o comentarios adicionales sobre por qué se canceló el trato..."
              }
              required={selectedReason === "Otro"}
              rows={3}
              className="w-full text-sm bg-[#f4f5f5] dark:bg-slate-900/50 text-slate-800 dark:text-slate-100 rounded px-3 py-2 border border-gray-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded hover:bg-[#f4f5f5] dark:hover:bg-slate-700 text-sm transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded text-sm transition-colors shadow-sm shadow-rose-200/50 dark:shadow-none"
            >
              Registrar Pérdida
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
