import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useVolver } from '../hooks/useVolver';
import { Recomendador } from '../components/precios/Recomendador';

/**
 * Cotizar un auto: cuánto pagar como máximo y en cuánto se vendería. Es lo único de «Revisión de precios» que ven los
 * vendedores. Cada consulta queda en el historial con quién la hizo; ese historial solo lo ve el administrador (y el
 * gerente). Al vendedor el servidor le contesta sin lo que revelaría costos o ganancias de la agencia.
 */
export function Cotizar() {
  const { userData } = useAuth();
  const volver = useVolver('/');
  const esVendedor = userData?.role === 'seller';
  return (
    <div className="flex flex-col h-full bg-[#f4f5f5] dark:bg-slate-900 overflow-y-auto">
      <div className="p-4 md:p-6 max-w-5xl mx-auto w-full space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={volver} className="h-9 w-9 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 flex items-center justify-center hover:bg-slate-50" aria-label="Volver">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">Cotizar auto</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Cuánto pagar como máximo por un auto y en cuánto se vendería.</p>
          </div>
        </div>
        <Recomendador soloCotizar={esVendedor} />
      </div>
    </div>
  );
}
