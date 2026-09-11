import { useEffect, useMemo, useState } from 'react';
import {
  RefreshCw,
  AlertTriangle,
  Building2,
  Users,
  TrendingUp,
  TrendingDown,
  Search,
  ChevronDown,
  ChevronRight,
  Clock,
  DollarSign,
  Activity,
  Car,
  Handshake,
  Trophy,
  MailX,
  ArrowRight,
  Mail,
  Send,
  Eye,
  X,
  CheckCircle2,
  XCircle,
  Plug,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import { PRECIO_POR_USUARIO } from '../lib/subscription';

/**
 * Panel de control de la plataforma, para el usuario master.
 *
 * Todo lo que se ve aqui llega calculado desde el servidor: solo numeros.
 * La sesion del master no lee los contactos, los tratos ni el inventario de
 * ninguna agencia, porque saber cuantos hay no exige poder verlos. Esa es la
 * diferencia entre dar servicio a una agencia y entrar en su informacion.
 *
 * El dinero que se muestra es el de la plataforma -- lo que cobran las
 * suscripciones --, no lo que vende cada agencia. De ellas se ve cuantas
 * ventas registraron, nunca por cuanto.
 */

type Semaforo = 'activa' | 'en-riesgo' | 'estancada' | 'nunca';

interface Agencia {
  id: string;
  nombre: string;
  estado: string;
  diasDePruebaRestantes: number | null;
  creadaEl: string | null;
  usuarios: number;
  usuariosFacturados: number | null;
  sinFacturar: number;
  vehiculos: number;
  contactos: number;
  tratos: number;
  tratosAbiertos: number;
  ventas: number;
  ventas30: number;
  ultimaActividad: string | null;
  diasSinActividad: number | null;
  actividad: Semaforo;
  datos7: number;
  datos30: number;
}

interface Usuario {
  id: string;
  nombre: string;
  correo: string;
  rol: string;
  agencyId: string;
  creadoEl: string | null;
  ultimaActividad: string | null;
  diasSinActividad: number | null;
  actividad: Semaforo;
  datos7: number;
  datos30: number;
  tratosAbiertos: number;
  tratosNuevos7: number;
  ventas7: number;
  ventas30: number;
  tareasPendientes: number;
  tareasVencidas: number;
  recibeCorreos: boolean;
}

type Pestana = 'resumen' | 'agencias' | 'usuarios' | 'correos';

const SEMAFORO: Record<Semaforo, { etiqueta: string; punto: string; chip: string }> = {
  activa: {
    etiqueta: 'Activa',
    punto: 'bg-emerald-500',
    chip: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800',
  },
  'en-riesgo': {
    etiqueta: 'En riesgo',
    punto: 'bg-amber-400',
    chip: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
  },
  estancada: {
    etiqueta: 'Estancada',
    punto: 'bg-red-500',
    chip: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
  },
  nunca: {
    etiqueta: 'Sin datos',
    punto: 'bg-slate-300 dark:bg-slate-600',
    chip: 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
  },
};

const ESTADO: Record<string, { etiqueta: string; chip: string }> = {
  activa: { etiqueta: 'Pagando', chip: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' },
  prueba: { etiqueta: 'En prueba', chip: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' },
  cortesia: { etiqueta: 'Cortesía', chip: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300' },
  'sin acceso': { etiqueta: 'Sin acceso', chip: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' },
};

const ROL: Record<string, string> = {
  admin: 'Admin',
  manager: 'Gerente',
  seller: 'Vendedor',
  taller: 'Taller',
  unassigned: 'Sin rol',
};

const dinero = (n: number) => `$${Math.round(n).toLocaleString('es-MX')}`;

function hace(dias: number | null): string {
  if (dias === null) return 'nunca';
  if (dias <= 0) return 'hoy';
  if (dias === 1) return 'ayer';
  if (dias < 14) return `hace ${dias} días`;
  if (dias < 60) return `hace ${Math.round(dias / 7)} semanas`;
  return `hace ${Math.round(dias / 30)} meses`;
}

function fechaCorta(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

function leerPestana(): Pestana {
  try {
    const v = localStorage.getItem('plataforma.pestana');
    if (v === 'resumen' || v === 'agencias' || v === 'usuarios' || v === 'correos') return v;
  } catch {}
  return 'resumen';
}

// ---------------------------------------------------------------------------

function Tarjeta({
  etiqueta,
  valor,
  detalle,
  icono: Icono,
  tono = 'text-slate-900 dark:text-white',
  tendencia,
  onClick,
}: {
  etiqueta: string;
  valor: string | number;
  detalle?: string;
  icono: any;
  tono?: string;
  tendencia?: { actual: number; anterior: number };
  onClick?: () => void;
}) {
  let delta: React.ReactNode = null;
  if (tendencia) {
    const { actual, anterior } = tendencia;
    const sube = actual > anterior;
    const igual = actual === anterior;
    delta = (
      <span
        className={`inline-flex items-center gap-0.5 text-xs font-semibold ${
          igual ? 'text-slate-400' : sube ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
        }`}
      >
        {!igual && (sube ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />)}
        {igual ? 'igual que' : sube ? 'más que' : 'menos que'} el mes pasado
      </span>
    );
  }
  const Contenedor: any = onClick ? 'button' : 'div';
  return (
    <Contenedor
      onClick={onClick}
      className={`text-left bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4 ${
        onClick ? 'hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-sm transition-all' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{etiqueta}</p>
        <Icono className="w-4 h-4 text-slate-400" />
      </div>
      <p className={`text-2xl font-bold ${tono}`}>{valor}</p>
      {detalle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{detalle}</p>}
      {delta && <div className="mt-1">{delta}</div>}
    </Contenedor>
  );
}

function Chip({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors whitespace-nowrap ${
        activo
          ? 'bg-slate-800 text-white border-slate-800 dark:bg-white dark:text-slate-900 dark:border-white'
          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
      }`}
    >
      {children}
    </button>
  );
}

function PuntoSemaforo({ s }: { s: Semaforo }) {
  return <span className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${SEMAFORO[s].punto}`} />;
}

function Buscador({ valor, onChange, placeholder }: { valor: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative flex-1 min-w-[200px] max-w-sm">
      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
      <input
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/30"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------

export function PlatformPanel() {
  const { currentUser } = useAuth();
  const [datos, setDatos] = useState<any>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pestana, setPestanaEstado] = useState<Pestana>(leerPestana);

  // Filtros compartidos entre pestañas: tocar una agencia en "Agencias" abre
  // sus usuarios en "Usuarios".
  const [filtroAgencia, setFiltroAgencia] = useState<string>('todas');
  const [filtroActividad, setFiltroActividad] = useState<Semaforo | 'todas' | 'estancadas'>('todas');

  const setPestana = (p: Pestana) => {
    setPestanaEstado(p);
    try {
      localStorage.setItem('plataforma.pestana', p);
    } catch {}
  };

  const cargar = async (fresco = false) => {
    if (!currentUser) return;
    setCargando(true);
    setError(null);
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch(`/api/admin/platform-stats${fresco ? '?fresco=1' : ''}`, {
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
    // Se pide al abrir. El servidor guarda el calculo diez minutos.
  }, [currentUser]);

  const agencias: Agencia[] = datos?.agencias || [];
  const usuarios: Usuario[] = datos?.usuarios || [];

  const irAUsuariosDe = (agencyId: string) => {
    setFiltroAgencia(agencyId);
    setFiltroActividad('todas');
    setPestana('usuarios');
  };

  const irAEstancadas = () => {
    setFiltroActividad('estancadas');
    setPestana('agencias');
  };

  const minutosDesde = datos?.generadoEl
    ? Math.max(0, Math.round((Date.now() - new Date(datos.generadoEl).getTime()) / 60000))
    : null;

  return (
    <div className="flex flex-col h-full bg-[#f4f5f5] dark:bg-slate-900 overflow-y-auto">
      <div className="p-4 md:p-6 max-w-7xl mx-auto w-full">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Plataforma</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Cómo va Nextcar CRM: dinero, crecimiento y quién lo está usando. Sin información de los
              clientes de nadie.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {minutosDesde !== null && (
              <span className="text-xs text-slate-400">
                Calculado {minutosDesde === 0 ? 'ahora' : `hace ${minutosDesde} min`}
              </span>
            )}
            <button
              onClick={() => cargar(true)}
              disabled={cargando}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${cargando ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
          </div>
        </div>

        {/* Pestañas */}
        <div className="flex gap-1 border-b border-gray-200 dark:border-slate-700 mb-6 overflow-x-auto">
          {(
            [
              ['resumen', 'Resumen', null],
              ['agencias', 'Agencias', agencias.length],
              ['usuarios', 'Usuarios', usuarios.length],
              ['correos', 'Correos', null],
            ] as [Pestana, string, number | null][]
          ).map(([id, etiqueta, n]) => (
            <button
              key={id}
              onClick={() => setPestana(id)}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors whitespace-nowrap ${
                pestana === id
                  ? 'border-indigo-600 text-indigo-700 dark:text-indigo-300 dark:border-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              {etiqueta}
              {n !== null && datos && (
                <span className="ml-2 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-xs text-slate-600 dark:text-slate-400">
                  {n}
                </span>
              )}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-900 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {cargando && !datos && (
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 py-12 justify-center">
            <RefreshCw className="w-4 h-4 animate-spin" /> Calculando cómo va la plataforma…
          </div>
        )}

        {datos && pestana === 'resumen' && (
          <Resumen datos={datos} agencias={agencias} onEstancadas={irAEstancadas} onAgencia={irAUsuariosDe} />
        )}
        {datos && pestana === 'agencias' && (
          <VistaAgencias
            agencias={agencias}
            usuarios={usuarios}
            filtroActividad={filtroActividad}
            setFiltroActividad={setFiltroActividad}
            onVerUsuarios={irAUsuariosDe}
          />
        )}
        {datos && pestana === 'usuarios' && (
          <VistaUsuarios
            agencias={agencias}
            usuarios={usuarios}
            filtroAgencia={filtroAgencia}
            setFiltroAgencia={setFiltroAgencia}
          />
        )}
        {datos && pestana === 'correos' && <VistaCorreos usuarios={usuarios} />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Resumen

function Resumen({
  datos,
  agencias,
  onEstancadas,
  onAgencia,
}: {
  datos: any;
  agencias: Agencia[];
  onEstancadas: () => void;
  onAgencia: (id: string) => void;
}) {
  const t = datos.totales;
  const ing = datos.ingresos;
  const precio = datos.precioPorUsuario || PRECIO_POR_USUARIO;

  const serie = (datos.serie || []).map((s: any) => ({
    ...s,
    semana: new Date(s.inicio).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }),
  }));

  const pruebasPorVencer = agencias
    .filter((a) => a.estado === 'prueba' && a.diasDePruebaRestantes !== null && a.diasDePruebaRestantes <= 7)
    .sort((a, b) => (a.diasDePruebaRestantes ?? 0) - (b.diasDePruebaRestantes ?? 0));

  const usuariosActivos = (datos.usuarios || []).filter(
    (u: Usuario) => u.actividad === 'activa' || u.actividad === 'en-riesgo',
  ).length;

  return (
    <div className="space-y-6">
      {/* Avisos que piden hacer algo */}
      {(t.usuariosSinFacturar > 0 || t.agenciasEstancadas > 0) && (
        <div className="grid md:grid-cols-2 gap-3">
          {t.usuariosSinFacturar > 0 && (
            <div className="p-4 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 flex gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-900 dark:text-amber-200 text-sm">
                  {t.usuariosSinFacturar} usuario{t.usuariosSinFacturar === 1 ? '' : 's'} que no estás cobrando
                </p>
                <p className="text-sm text-amber-800 dark:text-amber-300 mt-1">
                  Son {dinero(t.usuariosSinFacturar * precio)} al mes. Stripe fija la cantidad al contratar y no
                  se actualiza sola cuando la agencia agrega gente.
                </p>
              </div>
            </div>
          )}
          {t.agenciasEstancadas > 0 && (
            <button
              onClick={onEstancadas}
              className="text-left p-4 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/20 flex gap-3 hover:shadow-sm transition-shadow"
            >
              <Activity className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-bold text-red-900 dark:text-red-200 text-sm">
                  {t.agenciasEstancadas} agencia{t.agenciasEstancadas === 1 ? '' : 's'} sin meter datos en más de{' '}
                  {datos.diasEstancado} días
                </p>
                <p className="text-sm text-red-800 dark:text-red-300 mt-1 flex items-center gap-1">
                  Ver cuáles <ArrowRight className="w-3.5 h-3.5" />
                </p>
              </div>
            </button>
          )}
        </div>
      )}

      {/* Dinero */}
      <section>
        <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">Dinero de la plataforma</h2>
        {ing ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Tarjeta
              etiqueta="Cobrado este mes"
              valor={dinero(ing.cobradoEsteMes)}
              icono={DollarSign}
              tono="text-emerald-700 dark:text-emerald-400"
              tendencia={{ actual: ing.cobradoEsteMes, anterior: ing.cobradoMesAnterior }}
            />
            <Tarjeta etiqueta="Cobrado el mes pasado" valor={dinero(ing.cobradoMesAnterior)} icono={DollarSign} />
            <Tarjeta
              etiqueta="Ingreso mensual recurrente"
              valor={dinero(ing.mensualRecurrente)}
              detalle="Suscripciones activas, antes de descuentos"
              icono={TrendingUp}
            />
            <Tarjeta
              etiqueta="Usuarios que pagan"
              valor={t.usuariosFacturados}
              detalle={`de ${t.usuarios} usuarios en total`}
              icono={Users}
            />
          </div>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-4">
            No se pudo leer Stripe en este momento. El resto del panel sí está al día.
          </p>
        )}
      </section>

      {/* Crecimiento */}
      <section>
        <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">Crecimiento</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Tarjeta
            etiqueta="Agencias nuevas este mes"
            valor={t.agenciasNuevasMes}
            icono={Building2}
            tendencia={{ actual: t.agenciasNuevasMes, anterior: t.agenciasNuevasMesAnterior }}
          />
          <Tarjeta
            etiqueta="Usuarios nuevos este mes"
            valor={t.usuariosNuevosMes}
            icono={Users}
            tendencia={{ actual: t.usuariosNuevosMes, anterior: t.usuariosNuevosMesAnterior }}
          />
          <Tarjeta
            etiqueta="Agencias pagando"
            valor={`${t.activas} de ${t.agencias}`}
            detalle={`${t.enPrueba} en prueba · ${t.cortesia} cortesía · ${t.sinAcceso} sin acceso`}
            icono={Building2}
            tono="text-emerald-700 dark:text-emerald-400"
          />
          <Tarjeta
            etiqueta="Usuarios activos"
            valor={`${usuariosActivos} de ${t.usuarios}`}
            detalle={`Metieron datos en los últimos ${datos.diasEstancado} días`}
            icono={Activity}
          />
        </div>
      </section>

      {/* Graficas */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Altas por semana</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Agencias y usuarios que entraron.</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={serie} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="semana" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(99,102,241,0.06)' }}
                  contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgb(0 0 0 / 0.12)', fontSize: 12 }}
                  labelFormatter={(l) => `Semana del ${l}`}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="agencias" name="Agencias" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="usuarios" name="Usuarios" fill="#a5b4fc" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Uso de la plataforma por semana</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
            Lo que meten las personas. No cuenta lo que entra solo por WhatsApp o la web.
          </p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={serie} margin={{ top: 4, right: -8, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="semana" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                {/* Las ventas van en su propio eje: son decenas contra cientos de
                    datos, y en la misma escala la linea quedaba pegada al suelo. */}
                <YAxis
                  yAxisId="ventas"
                  orientation="right"
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: '#10b981' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(99,102,241,0.06)' }}
                  contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgb(0 0 0 / 0.12)', fontSize: 12 }}
                  labelFormatter={(l) => `Semana del ${l}`}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="contactos" name="Contactos" stackId="u" fill="#0ea5e9" />
                <Bar dataKey="tratos" name="Tratos" stackId="u" fill="#6366f1" />
                <Bar dataKey="tareas" name="Tareas" stackId="u" fill="#a78bfa" />
                <Bar dataKey="notas" name="Notas" stackId="u" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                <Line
                  yAxisId="ventas"
                  dataKey="ventas"
                  name="Ventas (eje derecho)"
                  type="monotone"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Pruebas por vencer: el momento de convertir */}
      <section>
        <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4" /> Pruebas que vencen esta semana
        </h2>
        {pruebasPorVencer.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-4">
            Ninguna agencia termina su prueba en los próximos 7 días.
          </p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {pruebasPorVencer.map((a) => (
              <button
                key={a.id}
                onClick={() => onAgencia(a.id)}
                className="text-left bg-white dark:bg-slate-800 rounded-lg border border-amber-200 dark:border-amber-900 p-4 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-900 dark:text-white truncate">{a.nombre}</span>
                  <span className="text-xs font-bold text-amber-700 dark:text-amber-400 whitespace-nowrap">
                    {a.diasDePruebaRestantes === 0 ? 'vence hoy' : `${a.diasDePruebaRestantes} d`}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-2 text-xs text-slate-500 dark:text-slate-400">
                  <PuntoSemaforo s={a.actividad} />
                  {a.usuarios} usuario{a.usuarios === 1 ? '' : 's'} · último dato {hace(a.diasSinActividad)}
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Totales de uso */}
      <section>
        <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">En toda la plataforma</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Tarjeta etiqueta="Vehículos" valor={t.vehiculos.toLocaleString('es-MX')} icono={Car} />
          <Tarjeta etiqueta="Contactos" valor={t.contactos.toLocaleString('es-MX')} icono={Users} />
          <Tarjeta etiqueta="Tratos" valor={t.tratos.toLocaleString('es-MX')} icono={Handshake} />
          <Tarjeta
            etiqueta="Ventas en 30 días"
            valor={t.ventas30.toLocaleString('es-MX')}
            detalle="Cuántas, no por cuánto"
            icono={Trophy}
            tono="text-emerald-700 dark:text-emerald-400"
          />
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Agencias

type Orden = 'actividad' | 'inactividad' | 'usuarios' | 'nuevas' | 'nombre';

function VistaAgencias({
  agencias,
  usuarios,
  filtroActividad,
  setFiltroActividad,
  onVerUsuarios,
}: {
  agencias: Agencia[];
  usuarios: Usuario[];
  filtroActividad: Semaforo | 'todas' | 'estancadas';
  setFiltroActividad: (v: Semaforo | 'todas' | 'estancadas') => void;
  onVerUsuarios: (id: string) => void;
}) {
  const [busca, setBusca] = useState('');
  const [estado, setEstado] = useState<string>('todos');
  const [orden, setOrden] = useState<Orden>('actividad');
  const [abierta, setAbierta] = useState<string | null>(null);

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const filtradas = agencias.filter((a) => {
      if (q && !a.nombre.toLowerCase().includes(q)) return false;
      if (estado !== 'todos' && a.estado !== estado) return false;
      if (filtroActividad === 'estancadas') return a.actividad === 'estancada' || a.actividad === 'nunca';
      if (filtroActividad !== 'todas' && a.actividad !== filtroActividad) return false;
      return true;
    });
    const dias = (a: Agencia) => (a.diasSinActividad === null ? Infinity : a.diasSinActividad);
    return filtradas.sort((a, b) => {
      switch (orden) {
        case 'inactividad':
          return dias(b) - dias(a);
        case 'usuarios':
          return b.usuarios - a.usuarios;
        case 'nuevas':
          return (b.creadaEl || '').localeCompare(a.creadaEl || '');
        case 'nombre':
          return a.nombre.localeCompare(b.nombre, 'es');
        default:
          return b.datos30 - a.datos30 || dias(a) - dias(b);
      }
    });
  }, [agencias, busca, estado, filtroActividad, orden]);

  const cuenta = (f: (a: Agencia) => boolean) => agencias.filter(f).length;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <Buscador valor={busca} onChange={setBusca} placeholder="Buscar agencia…" />
        <select
          value={orden}
          onChange={(e) => setOrden(e.target.value as Orden)}
          className="px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
        >
          <option value="actividad">Más activas primero</option>
          <option value="inactividad">Más abandonadas primero</option>
          <option value="usuarios">Más usuarios</option>
          <option value="nuevas">Más recientes</option>
          <option value="nombre">Por nombre</option>
        </select>
      </div>

      <div className="flex flex-wrap gap-2 mb-2">
        <span className="text-xs font-semibold text-slate-400 self-center w-16">Estado</span>
        <Chip activo={estado === 'todos'} onClick={() => setEstado('todos')}>Todas · {agencias.length}</Chip>
        {Object.entries(ESTADO).map(([id, e]) => (
          <Chip key={id} activo={estado === id} onClick={() => setEstado(id)}>
            {e.etiqueta} · {cuenta((a) => a.estado === id)}
          </Chip>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 mb-5">
        <span className="text-xs font-semibold text-slate-400 self-center w-16">Actividad</span>
        <Chip activo={filtroActividad === 'todas'} onClick={() => setFiltroActividad('todas')}>Todas</Chip>
        {(Object.keys(SEMAFORO) as Semaforo[]).map((s) => (
          <Chip key={s} activo={filtroActividad === s} onClick={() => setFiltroActividad(s)}>
            <span className="inline-flex items-center gap-1.5">
              <PuntoSemaforo s={s} /> {SEMAFORO[s].etiqueta} · {cuenta((a) => a.actividad === s)}
            </span>
          </Chip>
        ))}
        {filtroActividad === 'estancadas' && (
          <Chip activo onClick={() => setFiltroActividad('todas')}>
            Estancadas o sin datos ✕
          </Chip>
        )}
      </div>

      {lista.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-12">Ninguna agencia con esos filtros.</p>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {lista.map((a) => {
            const suyos = usuarios.filter((u) => u.agencyId === a.id);
            const desplegada = abierta === a.id;
            return (
              <div
                key={a.id}
                className={`bg-white dark:bg-slate-800 rounded-lg border transition-all ${
                  desplegada
                    ? 'border-indigo-300 dark:border-indigo-700 shadow-md md:col-span-2 xl:col-span-3'
                    : 'border-gray-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                <button onClick={() => setAbierta(desplegada ? null : a.id)} className="w-full text-left p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <PuntoSemaforo s={a.actividad} />
                        <span className="font-semibold text-slate-900 dark:text-white truncate">{a.nombre}</span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 ml-[18px]">
                        Último dato {hace(a.diasSinActividad)} · desde {fechaCorta(a.creadaEl)}
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap ${ESTADO[a.estado]?.chip || ''}`}>
                      {ESTADO[a.estado]?.etiqueta || a.estado}
                      {a.diasDePruebaRestantes !== null && ` · ${a.diasDePruebaRestantes}d`}
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-2 mt-4">
                    {[
                      ['Usuarios', a.usuarios],
                      ['Abiertos', a.tratosAbiertos],
                      ['Ventas 30d', a.ventas30],
                      ['Datos 7d', a.datos7],
                    ].map(([k, v]) => (
                      <div key={k as string} className="text-center">
                        <p className="text-lg font-bold text-slate-900 dark:text-white leading-none">{v}</p>
                        <p className="text-[10px] uppercase tracking-wide text-slate-400 mt-1">{k}</p>
                      </div>
                    ))}
                  </div>
                  {a.sinFacturar > 0 && (
                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mt-3">
                      Paga {a.usuariosFacturados} de {a.usuarios} usuarios
                    </p>
                  )}
                </button>

                {desplegada && (
                  <div className="border-t border-gray-100 dark:border-slate-700 p-4">
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-4 text-center">
                      {[
                        ['Vehículos', a.vehiculos],
                        ['Contactos', a.contactos],
                        ['Tratos', a.tratos],
                        ['Ventas', a.ventas],
                        ['Datos 30d', a.datos30],
                        ['Facturados', a.usuariosFacturados ?? '—'],
                      ].map(([k, v]) => (
                        <div key={k as string} className="bg-slate-50 dark:bg-slate-900/50 rounded p-2">
                          <p className="font-bold text-slate-800 dark:text-slate-200">{v}</p>
                          <p className="text-[10px] uppercase tracking-wide text-slate-400">{k}</p>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">Su equipo</p>
                    {suyos.length === 0 ? (
                      <p className="text-sm text-slate-400">Sin usuarios.</p>
                    ) : (
                      <div className="divide-y divide-gray-100 dark:divide-slate-700">
                        {suyos.map((u) => (
                          <div key={u.id} className="flex items-center gap-3 py-2 text-sm">
                            <PuntoSemaforo s={u.actividad} />
                            <span className="font-medium text-slate-800 dark:text-slate-200 truncate flex-1">{u.nombre}</span>
                            <span className="text-xs text-slate-500 w-20">{ROL[u.rol] || u.rol}</span>
                            <span className="text-xs text-slate-500 w-28 text-right">{hace(u.diasSinActividad)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={() => onVerUsuarios(a.id)}
                      className="mt-3 text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1"
                    >
                      Ver el detalle de su equipo <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Usuarios, agrupados por agencia

function VistaUsuarios({
  agencias,
  usuarios,
  filtroAgencia,
  setFiltroAgencia,
}: {
  agencias: Agencia[];
  usuarios: Usuario[];
  filtroAgencia: string;
  setFiltroAgencia: (v: string) => void;
}) {
  const [busca, setBusca] = useState('');
  const [rol, setRol] = useState<string>('todos');
  const [actividad, setActividad] = useState<Semaforo | 'todas'>('todas');
  const [cerradas, setCerradas] = useState<Record<string, boolean>>({});

  const nombreDe = useMemo(() => {
    const m: Record<string, Agencia> = {};
    for (const a of agencias) m[a.id] = a;
    return m;
  }, [agencias]);

  const grupos = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const filtrados = usuarios.filter((u) => {
      if (filtroAgencia !== 'todas' && u.agencyId !== filtroAgencia) return false;
      if (rol === 'admin' && u.rol !== 'admin') return false;
      if (rol === 'seller' && u.rol !== 'seller') return false;
      if (rol === 'otros' && (u.rol === 'admin' || u.rol === 'seller')) return false;
      if (actividad !== 'todas' && u.actividad !== actividad) return false;
      if (q && !`${u.nombre} ${u.correo}`.toLowerCase().includes(q)) return false;
      return true;
    });
    const porAgencia = new Map<string, Usuario[]>();
    for (const u of filtrados) {
      const k = u.agencyId || '';
      if (!porAgencia.has(k)) porAgencia.set(k, []);
      porAgencia.get(k)!.push(u);
    }
    return [...porAgencia.entries()]
      .map(([id, lista]) => ({
        id,
        nombre: id ? nombreDe[id]?.nombre || 'Agencia desconocida' : 'Sin agencia',
        agencia: id ? nombreDe[id] : undefined,
        lista: lista.sort((a, b) => {
          const orden = (r: string) => (r === 'admin' ? 0 : r === 'manager' ? 1 : 2);
          return orden(a.rol) - orden(b.rol) || a.nombre.localeCompare(b.nombre, 'es');
        }),
      }))
      .sort((a, b) => (!a.id ? 1 : !b.id ? -1 : a.nombre.localeCompare(b.nombre, 'es')));
  }, [usuarios, filtroAgencia, rol, actividad, busca, nombreDe]);

  const total = grupos.reduce((s, g) => s + g.lista.length, 0);
  // Al buscar o filtrar por una agencia, todo abierto: el resultado es corto.
  const todoAbierto = busca.trim() !== '' || filtroAgencia !== 'todas';

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <Buscador valor={busca} onChange={setBusca} placeholder="Buscar por nombre o correo…" />
        <select
          value={filtroAgencia}
          onChange={(e) => setFiltroAgencia(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 max-w-[240px]"
        >
          <option value="todas">Todas las agencias</option>
          {[...agencias]
            .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
            .map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre} ({a.usuarios})
              </option>
            ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-2 mb-2">
        <span className="text-xs font-semibold text-slate-400 self-center w-16">Rol</span>
        {[
          ['todos', 'Todos'],
          ['admin', 'Admins'],
          ['seller', 'Vendedores'],
          ['otros', 'Otros'],
        ].map(([id, e]) => (
          <Chip key={id} activo={rol === id} onClick={() => setRol(id)}>
            {e}
          </Chip>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 mb-5">
        <span className="text-xs font-semibold text-slate-400 self-center w-16">Actividad</span>
        <Chip activo={actividad === 'todas'} onClick={() => setActividad('todas')}>Todas</Chip>
        {(Object.keys(SEMAFORO) as Semaforo[]).map((s) => (
          <Chip key={s} activo={actividad === s} onClick={() => setActividad(s)}>
            <span className="inline-flex items-center gap-1.5">
              <PuntoSemaforo s={s} /> {SEMAFORO[s].etiqueta}
            </span>
          </Chip>
        ))}
      </div>

      <p className="text-xs text-slate-400 mb-3">
        {total} usuario{total === 1 ? '' : 's'} en {grupos.length} grupo{grupos.length === 1 ? '' : 's'}
      </p>

      {grupos.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-12">Nadie con esos filtros.</p>
      ) : (
        <div className="space-y-3">
          {grupos.map((g) => {
            const abierto = todoAbierto || !cerradas[g.id];
            return (
              <div key={g.id || 'sin'} className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
                <button
                  onClick={() => setCerradas((c) => ({ ...c, [g.id]: abierto }))}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/40 text-left"
                >
                  {abierto ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                  {g.agencia && <PuntoSemaforo s={g.agencia.actividad} />}
                  <span className="font-semibold text-slate-900 dark:text-white flex-1 truncate">{g.nombre}</span>
                  {g.agencia && (
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${ESTADO[g.agencia.estado]?.chip || ''}`}>
                      {ESTADO[g.agencia.estado]?.etiqueta}
                    </span>
                  )}
                  <span className="text-xs text-slate-500 whitespace-nowrap">
                    {g.lista.length} usuario{g.lista.length === 1 ? '' : 's'}
                  </span>
                </button>

                {abierto && (
                  <div className="overflow-x-auto border-t border-gray-100 dark:border-slate-700">
                    <table className="w-full text-sm min-w-[760px]">
                      <thead className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50/60 dark:bg-slate-900/30">
                        <tr>
                          <th className="text-left font-medium px-4 py-2">Usuario</th>
                          <th className="text-left font-medium px-3 py-2">Rol</th>
                          <th className="text-left font-medium px-3 py-2">Último dato</th>
                          <th className="text-right font-medium px-3 py-2">Datos 7d</th>
                          <th className="text-right font-medium px-3 py-2">Abiertos</th>
                          <th className="text-right font-medium px-3 py-2">Ventas 30d</th>
                          <th className="text-right font-medium px-3 py-2">Vencidas</th>
                          <th className="text-left font-medium px-3 py-2">Alta</th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.lista.map((u) => (
                          <tr key={u.id} className="border-t border-gray-100 dark:border-slate-700/60">
                            <td className="px-4 py-2.5">
                              <div className="font-medium text-slate-900 dark:text-white flex items-center gap-1.5">
                                {u.nombre}
                                {!u.recibeCorreos && (
                                  <span title="Se dio de baja de los correos">
                                    <MailX className="w-3.5 h-3.5 text-slate-400" />
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400">{u.correo}</div>
                            </td>
                            <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">{ROL[u.rol] || u.rol}</td>
                            <td className="px-3 py-2.5">
                              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-medium ${SEMAFORO[u.actividad].chip}`}>
                                <PuntoSemaforo s={u.actividad} />
                                {hace(u.diasSinActividad)}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-right text-slate-700 dark:text-slate-300">{u.datos7}</td>
                            <td className="px-3 py-2.5 text-right text-slate-700 dark:text-slate-300">{u.tratosAbiertos}</td>
                            <td className="px-3 py-2.5 text-right text-slate-700 dark:text-slate-300">{u.ventas30}</td>
                            <td className={`px-3 py-2.5 text-right ${u.tareasVencidas > 0 ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-slate-400'}`}>
                              {u.tareasVencidas}
                            </td>
                            <td className="px-3 py-2.5 text-slate-500 dark:text-slate-400 text-xs whitespace-nowrap">{fechaCorta(u.creadoEl)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Correos de animo y resumen semanal
//
// Decision de Luis: primero con su clic. El automatico nace apagado. Esta
// pantalla dice a quien le toca y por que, deja ver cada correo antes de
// mandarlo y guarda el historial. Los numeros de cada persona solo aparecen en
// la vista previa del correo, que es lo mismo que le va a llegar a ella.

interface DestinatarioFila {
  uid: string;
  nombre: string;
  correo: string;
  rol: string;
  agencyId: string;
  agencia: string;
  tipo: 'semanal' | 'animo' | null;
  motivo: string;
}

const TIPO_CORREO: Record<string, { etiqueta: string; chip: string }> = {
  animo: { etiqueta: 'Ánimo', chip: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800' },
  semanal: { etiqueta: 'Resumen', chip: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700' },
};

function VistaCorreos({ usuarios }: { usuarios: Usuario[] }) {
  const { currentUser } = useAuth();
  const [info, setInfo] = useState<any>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<'todos' | 'animo' | 'semanal' | 'no'>('todos');
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tono: 'ok' | 'mal'; texto: string } | null>(null);
  const [vista, setVista] = useState<{ asunto: string; html: string; para: string } | null>(null);

  const pedir = async (ruta: string, cuerpo?: any) => {
    if (!currentUser) throw new Error('No hay una sesión activa.');
    const token = await currentUser.getIdToken();
    const res = await fetch(ruta, {
      method: cuerpo !== undefined ? 'POST' : 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        ...(cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(cuerpo !== undefined ? { body: JSON.stringify(cuerpo) } : {}),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error || `Error ${res.status}`);
    return json;
  };

  const cargar = async (fresco = false) => {
    setCargando(true);
    setError(null);
    try {
      setInfo(await pedir(`/api/admin/correos${fresco ? '?fresco=1' : ''}`));
    } catch (e: any) {
      setError(e.message || 'No se pudo cargar la lista.');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
  }, [currentUser]);

  const lista: DestinatarioFila[] = info?.destinatarios || [];
  const tocan = lista.filter((d) => d.tipo);
  const visibles = lista.filter((d) =>
    filtro === 'todos' ? true : filtro === 'no' ? !d.tipo : d.tipo === filtro,
  );
  const nombreDe = useMemo(() => {
    const m: Record<string, string> = {};
    for (const u of usuarios) m[u.id] = u.nombre;
    return m;
  }, [usuarios]);

  const marcar = (uid: string) =>
    setMarcados((m) => {
      const n = new Set(m);
      n.has(uid) ? n.delete(uid) : n.add(uid);
      return n;
    });
  const marcablesVisibles = visibles.filter((d) => d.tipo).map((d) => d.uid);
  const todosMarcados = marcablesVisibles.length > 0 && marcablesVisibles.every((u) => marcados.has(u));

  const verPrevia = async (uid: string) => {
    setOcupado(`vista-${uid}`);
    try {
      setVista(await pedir(`/api/admin/correos/vista-previa?uid=${encodeURIComponent(uid)}`));
    } catch (e: any) {
      setAviso({ tono: 'mal', texto: e.message });
    } finally {
      setOcupado(null);
    }
  };

  const enviar = async () => {
    const uids = [...marcados];
    if (uids.length === 0) return;
    if (
      !window.confirm(
        `Vas a mandar ${uids.length} correo${uids.length === 1 ? '' : 's'} a clientes reales.\n\n` +
          'Salen ahora mismo y no se pueden deshacer. ¿Continuar?',
      )
    )
      return;
    setOcupado('enviar');
    setAviso(null);
    try {
      const r = await pedir('/api/admin/correos/enviar', { uids });
      setAviso({
        tono: r.fallidos > 0 ? 'mal' : 'ok',
        texto:
          `Salieron ${r.enviados} de ${uids.length}.` +
          (r.fallidos > 0 ? ` Fallaron ${r.fallidos}: revisa el historial.` : '') +
          (r.omitidos > 0 ? ` ${r.omitidos} ya no les tocaba (alguien les mandó antes).` : ''),
      });
      setMarcados(new Set());
      await cargar(true);
    } catch (e: any) {
      setAviso({ tono: 'mal', texto: e.message });
    } finally {
      setOcupado(null);
    }
  };

  const verificar = async () => {
    setOcupado('verificar');
    setAviso(null);
    try {
      const r = await pedir('/api/admin/correos/verificar', {});
      setAviso(
        r.hostinger === 'ok'
          ? { tono: 'ok', texto: 'Hostinger acepta la conexión con el buzón. Todo listo para mandar desde ahí.' }
          : r.hostinger === 'no-configurado'
          ? { tono: 'mal', texto: 'Hostinger no está configurado: faltan SMTP_HOST, SMTP_USER o SMTP_PASS en las variables del servidor.' }
          : { tono: 'mal', texto: `Hostinger rechazó la conexión: ${r.detalle || 'sin detalle'}. Revisa usuario y contraseña del buzón.` },
      );
    } catch (e: any) {
      setAviso({ tono: 'mal', texto: e.message });
    } finally {
      setOcupado(null);
    }
  };

  const probar = async () => {
    setOcupado('probar');
    setAviso(null);
    try {
      const uid = [...marcados][0] || tocan[0]?.uid;
      const r = await pedir('/api/admin/correos/probar', { uid });
      setAviso(
        r.ok
          ? { tono: 'ok', texto: `Te llegó a ${r.para}, por ${r.via === 'hostinger' ? 'Hostinger' : 'Resend'}: el correo que recibiría ${r.ejemploDe}.` }
          : { tono: 'mal', texto: `No salió: ${r.error || 'sin detalle'}.` },
      );
      await cargar();
    } catch (e: any) {
      setAviso({ tono: 'mal', texto: e.message });
    } finally {
      setOcupado(null);
    }
  };

  const cambiarAutomatico = async (activo: boolean) => {
    if (
      activo &&
      !window.confirm(
        'Desde el próximo lunes a las 9:00 los correos saldrán solos, a todos a los que les toque.\n\n' +
          'Nadie recibe dos por semana y quien se dio de baja no recibe nada. ¿Activar?',
      )
    )
      return;
    setOcupado('auto');
    try {
      await pedir('/api/admin/correos/automatico', { activo });
      await cargar();
    } catch (e: any) {
      setAviso({ tono: 'mal', texto: e.message });
    } finally {
      setOcupado(null);
    }
  };

  if (cargando && !info) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500 py-12 justify-center">
        <RefreshCw className="w-4 h-4 animate-spin" /> Armando la lista de la semana…
      </div>
    );
  }
  if (error && !info) {
    return <div className="p-4 rounded-lg border border-red-200 bg-red-50 text-sm text-red-700">{error}</div>;
  }

  const e = info?.estado || {};
  const nAnimo = lista.filter((d) => d.tipo === 'animo').length;
  const nResumen = lista.filter((d) => d.tipo === 'semanal').length;
  const nNo = lista.filter((d) => !d.tipo).length;

  return (
    <div className="space-y-5">
      {/* Como salen */}
      <div className="grid lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4">
          <div className="flex items-start gap-3">
            {e.via === 'hostinger' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-900 dark:text-white text-sm">
                {e.via === 'hostinger'
                  ? 'Salen por tu buzón de Hostinger'
                  : e.via === 'resend'
                  ? 'Salen por Resend, no por Hostinger'
                  : 'No hay servicio de correo configurado'}
              </p>
              {e.remitente && (
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5 break-all">Remitente: {e.remitente}</p>
              )}
              <p className={`text-sm mt-0.5 ${e.respuestasA ? 'text-slate-600 dark:text-slate-400' : 'text-amber-700 dark:text-amber-400'}`}>
                {e.respuestasA
                  ? `Las respuestas llegan a ${e.respuestasA}`
                  : 'Sin dirección de respuesta: si alguien contesta, la respuesta se pierde (falta CORREO_RESPUESTA).'}
              </p>
              {e.via !== 'hostinger' && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                  Para mandar desde Hostinger faltan SMTP_HOST, SMTP_PORT, SMTP_USER y SMTP_PASS en las variables de
                  entorno de la app en Hostinger.
                </p>
              )}
              <div className="flex flex-wrap gap-2 mt-3">
                <button
                  onClick={verificar}
                  disabled={!!ocupado}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
                >
                  <Plug className="w-4 h-4" /> {ocupado === 'verificar' ? 'Probando…' : 'Probar conexión con Hostinger'}
                </button>
                <button
                  onClick={probar}
                  disabled={!!ocupado || tocan.length === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
                  title="Te manda a ti el correo de alguien de la lista, para ver cómo llega"
                >
                  <Mail className="w-4 h-4" /> {ocupado === 'probar' ? 'Mandando…' : 'Mandarme una prueba'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Automatico */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold text-slate-900 dark:text-white text-sm">Envío automático</p>
            <button
              role="switch"
              aria-checked={!!info?.automatico}
              onClick={() => cambiarAutomatico(!info?.automatico)}
              disabled={!!ocupado}
              className={`relative w-11 h-6 rounded-full transition-colors disabled:opacity-50 ${
                info?.automatico ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  info?.automatico ? 'translate-x-5' : ''
                }`}
              />
            </button>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            {info?.automatico
              ? 'Encendido: salen solos los lunes a las 9:00.'
              : 'Apagado: solo sale lo que tú mandes desde aquí.'}
          </p>
          {info?.ultimoResultadoAutomatico && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              Última vez: semana del {info.ultimoResultadoAutomatico.semana} ·{' '}
              {info.ultimoResultadoAutomatico.enviados} enviados
              {info.ultimoResultadoAutomatico.fallidos > 0 && `, ${info.ultimoResultadoAutomatico.fallidos} fallidos`}
            </p>
          )}
        </div>
      </div>

      {aviso && (
        <div
          className={`flex items-start gap-2 p-3 rounded-lg border text-sm ${
            aviso.tono === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:bg-emerald-900/20 dark:border-emerald-900 dark:text-emerald-300'
              : 'border-red-200 bg-red-50 text-red-800 dark:bg-red-900/20 dark:border-red-900 dark:text-red-300'
          }`}
        >
          {aviso.tono === 'ok' ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 shrink-0 mt-0.5" />}
          <span className="flex-1">{aviso.texto}</span>
          <button onClick={() => setAviso(null)} className="opacity-60 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* La lista de la semana */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700">
        <div className="p-4 border-b border-gray-100 dark:border-slate-700 flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[220px]">
            <h3 className="font-bold text-slate-900 dark:text-white">Esta semana</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {nAnimo} de ánimo · {nResumen} resúmenes · {nNo} no reciben. Nadie recibe dos por semana.
            </p>
          </div>
          <button
            onClick={() => cargar(true)}
            disabled={cargando}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
            title="Recalcular"
          >
            <RefreshCw className={`w-4 h-4 ${cargando ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={enviar}
            disabled={marcados.size === 0 || !!ocupado}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 hover:bg-black dark:bg-white dark:text-slate-900 text-white text-sm font-semibold disabled:opacity-40"
          >
            <Send className="w-4 h-4" />
            {ocupado === 'enviar' ? 'Mandando…' : `Enviar a ${marcados.size} seleccionado${marcados.size === 1 ? '' : 's'}`}
          </button>
        </div>

        <div className="px-4 pt-3 flex flex-wrap gap-2">
          <Chip activo={filtro === 'todos'} onClick={() => setFiltro('todos')}>Todos · {lista.length}</Chip>
          <Chip activo={filtro === 'animo'} onClick={() => setFiltro('animo')}>Ánimo · {nAnimo}</Chip>
          <Chip activo={filtro === 'semanal'} onClick={() => setFiltro('semanal')}>Resumen · {nResumen}</Chip>
          <Chip activo={filtro === 'no'} onClick={() => setFiltro('no')}>No reciben · {nNo}</Chip>
        </div>

        {visibles.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-10">Nadie en este grupo.</p>
        ) : (
          <div className="overflow-x-auto mt-2">
            <table className="w-full text-sm min-w-[720px]">
              <thead className="text-xs text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-2 w-10">
                    <input
                      type="checkbox"
                      checked={todosMarcados}
                      disabled={marcablesVisibles.length === 0}
                      onChange={() =>
                        setMarcados((m) => {
                          const n = new Set(m);
                          todosMarcados ? marcablesVisibles.forEach((u) => n.delete(u)) : marcablesVisibles.forEach((u) => n.add(u));
                          return n;
                        })
                      }
                      className="rounded"
                      title="Marcar todos los que tocan"
                    />
                  </th>
                  <th className="text-left font-medium px-2 py-2">Persona</th>
                  <th className="text-left font-medium px-2 py-2">Agencia</th>
                  <th className="text-left font-medium px-2 py-2">Correo</th>
                  <th className="text-left font-medium px-2 py-2">Por qué</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((d) => (
                  <tr key={d.uid} className={`border-t border-gray-100 dark:border-slate-700/60 ${!d.tipo ? 'opacity-60' : ''}`}>
                    <td className="px-4 py-2.5">
                      <input
                        type="checkbox"
                        checked={marcados.has(d.uid)}
                        disabled={!d.tipo}
                        onChange={() => marcar(d.uid)}
                        className="rounded"
                      />
                    </td>
                    <td className="px-2 py-2.5">
                      <div className="font-medium text-slate-900 dark:text-white">{d.nombre}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {ROL[d.rol] || d.rol} · {d.correo}
                      </div>
                    </td>
                    <td className="px-2 py-2.5 text-slate-600 dark:text-slate-300">{d.agencia}</td>
                    <td className="px-2 py-2.5">
                      {d.tipo ? (
                        <span className={`px-2 py-0.5 rounded-full border text-xs font-semibold ${TIPO_CORREO[d.tipo].chip}`}>
                          {TIPO_CORREO[d.tipo].etiqueta}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-2 py-2.5 text-slate-600 dark:text-slate-400 text-xs">{d.motivo}</td>
                    <td className="px-4 py-2.5 text-right">
                      {d.tipo && (
                        <button
                          onClick={() => verPrevia(d.uid)}
                          disabled={!!ocupado}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50"
                        >
                          <Eye className="w-3.5 h-3.5" /> {ocupado === `vista-${d.uid}` ? 'Abriendo…' : 'Ver correo'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Historial */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700">
        <div className="p-4 border-b border-gray-100 dark:border-slate-700">
          <h3 className="font-bold text-slate-900 dark:text-white">Lo que ya salió</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Los últimos 60 envíos.</p>
        </div>
        {(info?.historial || []).length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">Todavía no se ha mandado ninguno.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <tbody>
                {info.historial.map((h: any) => (
                  <tr key={h.id} className="border-t first:border-t-0 border-gray-100 dark:border-slate-700/60">
                    <td className="px-4 py-2 text-xs text-slate-500 whitespace-nowrap">
                      {new Date(h.enviadoEl).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-2 py-2 font-medium text-slate-800 dark:text-slate-200">{nombreDe[h.uid] || h.uid}</td>
                    <td className="px-2 py-2 text-slate-600 dark:text-slate-400 truncate max-w-[280px]" title={h.asunto}>{h.asunto}</td>
                    <td className="px-2 py-2 text-xs text-slate-500">{h.via === 'hostinger' ? 'Hostinger' : h.via === 'resend' ? 'Resend' : '—'}{h.origen === 'automatico' ? ' · auto' : ''}</td>
                    <td className="px-4 py-2 text-right">
                      {h.ok ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 inline" />
                      ) : (
                        <span title={h.error || ''}>
                          <XCircle className="w-4 h-4 text-red-500 inline" />
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Vista previa: es exactamente lo que le va a llegar */}
      {vista && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setVista(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden" onClick={(ev) => ev.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 p-4 border-b border-gray-200 dark:border-slate-700">
              <div className="min-w-0">
                <p className="text-xs text-slate-500 dark:text-slate-400">Para: {vista.para}</p>
                <p className="font-semibold text-slate-900 dark:text-white truncate">{vista.asunto}</p>
              </div>
              <button onClick={() => setVista(null)} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            {/* sandbox sin permisos: el correo se muestra, no ejecuta nada */}
            <iframe title="Vista previa del correo" srcDoc={vista.html} sandbox="" className="w-full flex-1 min-h-[60vh] bg-white" />
          </div>
        </div>
      )}
    </div>
  );
}
