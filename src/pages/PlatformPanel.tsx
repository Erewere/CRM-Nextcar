import { useEffect, useState } from 'react';
import { RefreshCw, AlertTriangle, Building2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { PRECIO_POR_USUARIO } from '../lib/subscription';

/**
 * Panel de control de la plataforma, para el usuario master.
 *
 * Todo lo que se ve aqui llega calculado desde el servidor: solo numeros.
 * La sesion del master no lee los contactos, los tratos ni el inventario de
 * ninguna agencia, porque saber cuantos hay no exige poder verlos. Esa es la
 * diferencia entre dar servicio a una agencia y entrar en su informacion.
 */

interface AgenciaFila {
  id: string;
  nombre: string;
  estado: string;
  diasDePruebaRestantes: number | null;
  usuarios: number;
  usuariosFacturados: number | null;
  sinFacturar: number;
  vehiculos: number;
  contactos: number;
  tratos: number;
}

const COLOR_ESTADO: Record<string, string> = {
  activa: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  prueba: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  cortesia: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
  'sin acceso': 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
};

function Dato({ etiqueta, valor, tono }: { etiqueta: string; valor: string | number; tono?: string }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded border border-gray-200 dark:border-slate-700 p-4">
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{etiqueta}</p>
      <p className={`text-2xl font-bold ${tono || 'text-slate-900 dark:text-white'}`}>{valor}</p>
    </div>
  );
}

export function PlatformPanel() {
  const { currentUser } = useAuth();
  const [datos, setDatos] = useState<any>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = async () => {
    if (!currentUser) return;
    setCargando(true);
    setError(null);
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch('/api/admin/platform-stats', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `Error ${res.status}`);
      setDatos(json);
    } catch (e: any) {
      setError(e.message || 'No se pudieron cargar las estadísticas.');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
    // Se pide una sola vez al abrir. Nada de estar consultando en bucle.
  }, [currentUser]);

  const t = datos?.totales;
  const precio = datos?.precioPorUsuario || PRECIO_POR_USUARIO;
  const agencias: AgenciaFila[] = datos?.agencias || [];

  return (
    <div className="flex flex-col h-full bg-[#f4f5f5] dark:bg-slate-900 overflow-y-auto">
      <div className="p-4 md:p-6 max-w-6xl mx-auto w-full">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Panel de la plataforma
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Cómo va cada agencia, en números. No incluye información de sus clientes.
            </p>
          </div>
          <button
            onClick={cargar}
            disabled={cargando}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded text-sm font-medium disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${cargando ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-900 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {cargando && !datos && (
          <p className="text-sm text-slate-500 dark:text-slate-400">Calculando…</p>
        )}

        {t && (
          <>
            {/* Lo que se cobra hoy contra lo que deberia cobrarse. Stripe fija
                la cantidad de usuarios al contratar y nadie la actualiza, asi
                que una agencia que crece sigue pagando por los del primer dia. */}
            {t.usuariosSinFacturar > 0 && (
              <div className="mb-6 p-4 rounded border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-amber-900 dark:text-amber-200 text-sm">
                      Hay {t.usuariosSinFacturar} usuario{t.usuariosSinFacturar === 1 ? '' : 's'} que no estás cobrando
                    </p>
                    <p className="text-sm text-amber-800 dark:text-amber-300 mt-1">
                      Son ${(t.usuariosSinFacturar * precio).toLocaleString('es-MX')} al mes.
                      La cantidad de usuarios se fija al contratar y no se actualiza
                      sola cuando la agencia agrega gente; hay que ajustarla en Stripe.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">Ingresos</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <Dato
                etiqueta="Cobrado al mes"
                valor={`$${(t.usuariosFacturados * precio).toLocaleString('es-MX')}`}
                tono="text-emerald-700 dark:text-emerald-400"
              />
              <Dato
                etiqueta="Sin cobrar al mes"
                valor={`$${(t.usuariosSinFacturar * precio).toLocaleString('es-MX')}`}
                tono={t.usuariosSinFacturar > 0 ? 'text-amber-700 dark:text-amber-400' : undefined}
              />
              <Dato etiqueta="Usuarios facturados" valor={t.usuariosFacturados} />
              <Dato etiqueta="Usuarios reales" valor={t.usuarios} />
            </div>

            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">Agencias</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
              <Dato etiqueta="Total" valor={t.agencias} />
              <Dato etiqueta="Pagando" valor={t.activas} tono="text-emerald-700 dark:text-emerald-400" />
              <Dato etiqueta="En prueba" valor={t.enPrueba} tono="text-amber-700 dark:text-amber-400" />
              <Dato etiqueta="Cortesía" valor={t.cortesia} />
              <Dato etiqueta="Sin acceso" valor={t.sinAcceso} tono={t.sinAcceso > 0 ? 'text-red-700 dark:text-red-400' : undefined} />
            </div>

            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">Uso</h2>
            <div className="grid grid-cols-3 gap-3 mb-8">
              <Dato etiqueta="Vehículos" valor={t.vehiculos} />
              <Dato etiqueta="Contactos" valor={t.contactos} />
              <Dato etiqueta="Tratos" valor={t.tratos} />
            </div>

            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">
              Detalle por agencia
            </h2>
            <div className="bg-white dark:bg-slate-800 rounded border border-gray-200 dark:border-slate-700 overflow-x-auto">
              <table className="w-full text-sm min-w-[720px]">
                <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-600 dark:text-slate-400">
                  <tr>
                    <th className="text-left font-medium px-4 py-3">Agencia</th>
                    <th className="text-left font-medium px-4 py-3">Estado</th>
                    <th className="text-right font-medium px-4 py-3">Usuarios</th>
                    <th className="text-right font-medium px-4 py-3">Facturados</th>
                    <th className="text-right font-medium px-4 py-3">Vehículos</th>
                    <th className="text-right font-medium px-4 py-3">Contactos</th>
                    <th className="text-right font-medium px-4 py-3">Tratos</th>
                  </tr>
                </thead>
                <tbody>
                  {agencias.map((a) => (
                    <tr key={a.id} className="border-t border-gray-100 dark:border-slate-700">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                          <span className="font-medium text-slate-900 dark:text-white">{a.nombre}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${COLOR_ESTADO[a.estado] || ''}`}>
                          {a.estado}
                          {a.diasDePruebaRestantes !== null && ` · ${a.diasDePruebaRestantes}d`}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{a.usuarios}</td>
                      <td className="px-4 py-3 text-right">
                        {a.usuariosFacturados === null ? (
                          <span className="text-slate-400">—</span>
                        ) : (
                          <span className={a.sinFacturar > 0 ? 'text-amber-700 dark:text-amber-400 font-semibold' : 'text-slate-700 dark:text-slate-300'}>
                            {a.usuariosFacturados}
                            {a.sinFacturar > 0 && ` (faltan ${a.sinFacturar})`}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{a.vehiculos}</td>
                      <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{a.contactos}</td>
                      <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{a.tratos}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-slate-400 mt-4">
              Una raya en Facturados significa que esa agencia no tiene suscripción en
              Stripe: está en prueba, de cortesía o sin acceso.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
