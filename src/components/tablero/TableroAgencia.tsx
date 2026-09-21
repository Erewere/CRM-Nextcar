import { useMemo, useState, type ReactNode } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, Legend,
} from "recharts";
import {
  AlertTriangle, Lightbulb, Info, Download, FileSpreadsheet, X, TrendingUp, TrendingDown,
  Car, DollarSign, Users, Clock, Briefcase, Receipt, Gauge,
} from "lucide-react";
import {
  calcularAnalitica, hallazgos as calcularHallazgos, RANGOS_DE_PRECIO, type Hallazgo,
} from "../../lib/analiticaAgencia";
import { descargarExcel, hojasDelReporte } from "../../lib/reporteExcel";

/**
 * El tablero del administrador: lo que vende, lo que tiene, de donde le llegan
 * los clientes y como va su equipo. Reemplaza la consola anterior y la pagina
 * de Inteligencia (que solo contaba deseos anotados en el 1% de los contactos).
 *
 * Colores del manual de marca: negro y gris, y el rojo solo para señalar lo
 * que se eligio o lo que pide atencion.
 */

const NEGRO = "#334155";
const ROJO = "#D6402A";
const GRIS = "#CBD5E1";

type Pestana = "resumen" | "ventas" | "inventario" | "clientes" | "equipo";
type Periodo = "mes" | "3m" | "anio" | "12m";

const PESTANAS: { id: Pestana; nombre: string }[] = [
  { id: "resumen", nombre: "Resumen" },
  { id: "ventas", nombre: "Ventas" },
  { id: "inventario", nombre: "Inventario" },
  { id: "clientes", nombre: "Clientes" },
  { id: "equipo", nombre: "Equipo" },
];

const PERIODOS: { id: Periodo; nombre: string }[] = [
  { id: "mes", nombre: "Este mes" },
  { id: "3m", nombre: "Últimos 3 meses" },
  { id: "anio", nombre: "Este año" },
  { id: "12m", nombre: "Últimos 12 meses" },
];

const DIA = 86_400_000;
const MX = 6 * 3_600_000; // Mexico, UTC-6

function rangoDelPeriodo(p: Periodo, ahora: number) {
  const local = new Date(ahora - MX);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth();
  if (p === "mes") return { desde: Date.UTC(y, m, 1) + MX, hasta: ahora };
  if (p === "anio") return { desde: Date.UTC(y, 0, 1) + MX, hasta: ahora };
  if (p === "3m") return { desde: ahora - 91 * DIA, hasta: ahora };
  return { desde: ahora - 365 * DIA, hasta: ahora };
}

const leer = <T extends string>(clave: string, validos: readonly T[], def: T): T => {
  try {
    const v = localStorage.getItem(clave) as T | null;
    return v && validos.includes(v) ? v : def;
  } catch {
    return def;
  }
};
const guardar = (clave: string, v: string) => {
  try {
    localStorage.setItem(clave, v);
  } catch {
    /* sin almacenamiento: se queda en memoria */
  }
};

const dinero = (n: number) =>
  "$" + new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 }).format(Math.round(n || 0));
const dineroCorto = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")} M` : n >= 1000 ? `$${Math.round(n / 1000)} mil` : dinero(n);
const fechaCorta = (ms: number | null) =>
  ms ? new Date(ms).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "2-digit" }) : "—";

export interface TableroAgenciaProps {
  agencia: string;
  vehiculos: any[];
  costos: Record<string, number>;
  verCostos: boolean;
  clientes: any[];
  tratos: any[];
  usuarios: any[];
  etapas: { id: string; title?: string }[];
  onAbrirVehiculo?: (id: string) => void;
  /** Lo del dia a dia que se queda debajo del resumen (alertas, tareas). */
  pendientes?: ReactNode;
}

export function TableroAgencia(p: TableroAgenciaProps) {
  const [pestana, setPestanaEstado] = useState<Pestana>(() =>
    leer("tablero_pestana", PESTANAS.map((x) => x.id), "resumen"));
  const [periodo, setPeriodoEstado] = useState<Periodo>(() =>
    leer("tablero_periodo", PERIODOS.map((x) => x.id), "12m"));
  const setPestana = (x: Pestana) => { setPestanaEstado(x); guardar("tablero_pestana", x); };
  const setPeriodo = (x: Periodo) => { setPeriodoEstado(x); guardar("tablero_periodo", x); };

  const { a, h } = useMemo(() => {
    const ahora = Date.now();
    const { desde, hasta } = rangoDelPeriodo(periodo, ahora);
    const a = calcularAnalitica({
      ahora, desde, hasta,
      vehiculos: p.vehiculos, costos: p.costos, verCostos: p.verCostos,
      clientes: p.clientes, tratos: p.tratos, usuarios: p.usuarios, etapas: p.etapas,
    });
    return { a, h: calcularHallazgos(a) };
  }, [periodo, p.vehiculos, p.costos, p.verCostos, p.clientes, p.tratos, p.usuarios, p.etapas]);

  const nombrePeriodo = PERIODOS.find((x) => x.id === periodo)!.nombre;

  const exportar = (todo: boolean) => {
    const hojas = hojasDelReporte(a, h, { verCostos: p.verCostos, periodo: nombrePeriodo, agencia: p.agencia || "Agencia" });
    const hoy = new Date(Date.now() - MX).toISOString().slice(0, 10);
    const base = (p.agencia || "agencia").normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
    if (todo) {
      descargarExcel(`${base}-reporte-completo-${hoy}.xlsx`, [
        ...hojas.resumen, ...hojas.ventas, ...hojas.inventario, ...hojas.clientes, ...hojas.equipo,
      ]);
    } else {
      descargarExcel(`${base}-${pestana}-${hoy}.xlsx`, hojas[pestana]);
    }
  };

  return (
    <div className="space-y-4">
      {/* Encabezado: periodo y exportar */}
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded shadow-sm p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Tablero de la agencia</p>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
            {p.agencia || "Tu agencia"}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-lg">
            {PERIODOS.map((x) => (
              <button
                key={x.id}
                onClick={() => setPeriodo(x.id)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${
                  periodo === x.id
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                {x.nombre}
              </button>
            ))}
          </div>
          <button
            onClick={() => exportar(false)}
            className="text-xs font-semibold px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-1.5"
            title="Descarga en Excel lo que ves en esta pestaña"
          >
            <Download className="w-3.5 h-3.5" /> Exportar {PESTANAS.find((x) => x.id === pestana)!.nombre.toLowerCase()}
          </button>
          <button
            onClick={() => exportar(true)}
            className="text-xs font-semibold px-3 py-2 rounded-lg bg-[#D6402A] hover:bg-[#A82A17] text-white flex items-center gap-1.5"
            title="Un libro de Excel con todas las pestañas"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" /> Reporte completo
          </button>
        </div>
      </div>

      {/* Pestañas */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-slate-700 overflow-x-auto">
        {PESTANAS.map((x) => (
          <button
            key={x.id}
            onClick={() => setPestana(x.id)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap transition-colors ${
              pestana === x.id
                ? "border-[#D6402A] text-slate-900 dark:text-white"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            {x.nombre}
          </button>
        ))}
      </div>

      {pestana === "resumen" && (
        <Resumen a={a} h={h} verCostos={p.verCostos} irA={setPestana} periodo={nombrePeriodo} pendientes={p.pendientes} />
      )}
      {pestana === "ventas" && <Ventas a={a} verCostos={p.verCostos} onAbrirVehiculo={p.onAbrirVehiculo} />}
      {pestana === "inventario" && <Inventario a={a} verCostos={p.verCostos} onAbrirVehiculo={p.onAbrirVehiculo} />}
      {pestana === "clientes" && <Clientes a={a} />}
      {pestana === "equipo" && <Equipo a={a} />}
    </div>
  );
}

type A = ReturnType<typeof calcularAnalitica>;

// ---------------------------------------------------------------------------
// Piezas

function Tarjeta({ titulo, children, accion }: { titulo: string; children: ReactNode; accion?: ReactNode }) {
  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded shadow-sm p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{titulo}</h3>
        {accion}
      </div>
      {children}
    </div>
  );
}

function Cambio({ ahora, antes }: { ahora: number; antes: number }) {
  if (!antes && !ahora) return null;
  if (!antes) return <span className="text-[11px] text-slate-400">sin datos antes</span>;
  const pct = Math.round(((ahora - antes) / antes) * 100);
  if (pct === 0) return <span className="text-[11px] text-slate-400">igual que antes</span>;
  const sube = pct > 0;
  return (
    <span className={`text-[11px] font-semibold flex items-center gap-0.5 ${sube ? "text-emerald-600 dark:text-emerald-400" : "text-[#A82A17] dark:text-[#F2705B]"}`}>
      {sube ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {sube ? "+" : ""}{pct}% vs. antes
    </span>
  );
}

function Kpi({ icono: Icono, titulo, valor, pie, onClick }: {
  icono: typeof Car; titulo: string; valor: ReactNode; pie?: ReactNode; onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className="text-left bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded shadow-sm p-4 enabled:hover:border-slate-400 dark:enabled:hover:border-slate-500 enabled:hover:shadow-md transition-all"
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 flex items-center gap-1.5">
        <Icono className="w-3.5 h-3.5" /> {titulo}
      </p>
      <p className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 mt-1">{valor}</p>
      <div className="mt-1 min-h-[16px] text-[11px] text-slate-500">{pie}</div>
    </button>
  );
}

function Vacio({ texto }: { texto: string }) {
  return <p className="text-xs text-slate-400 italic py-8 text-center">{texto}</p>;
}

function Filtro({ texto, quitar }: { texto: string; quitar: () => void }) {
  return (
    <button onClick={quitar} className="text-[11px] font-semibold px-2 py-1 rounded-full bg-[#D6402A]/10 text-[#A82A17] dark:text-[#F2705B] flex items-center gap-1">
      {texto} <X className="w-3 h-3" />
    </button>
  );
}

const ejes = { tick: { fontSize: 11, fill: "#94a3b8" }, axisLine: false, tickLine: false } as const;
const tooltip = { contentStyle: { borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }, cursor: { fill: "rgba(148,163,184,0.12)" } };

/** Barras horizontales donde tocar una barra filtra (y tocarla otra vez quita el filtro). */
function Barras<T extends Record<string, any>>({ datos, clave, valor, elegido, onElegir, formato, alto }: {
  datos: T[]; clave: keyof T & string; valor: keyof T & string; elegido?: string | null;
  onElegir?: (k: string) => void; formato?: (n: number) => string; alto?: number;
}) {
  if (!datos.length) return <Vacio texto="Sin datos en este periodo" />;
  return (
    <div style={{ height: alto ?? Math.max(140, datos.length * 34 + 20) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={datos} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
          <XAxis type="number" hide allowDecimals={false} />
          <YAxis type="category" dataKey={clave as string} width={120} {...ejes} />
          <Tooltip {...tooltip} formatter={(v: any) => (formato ? formato(Number(v)) : v)} />
          <Bar
            dataKey={valor as string}
            radius={[0, 4, 4, 0]}
            onClick={onElegir ? (d: any) => onElegir(String(d?.[clave] ?? d?.payload?.[clave])) : undefined}
            className={onElegir ? "cursor-pointer" : undefined}
            label={{ position: "right", fontSize: 11, fill: "#64748b", formatter: (v: any) => (formato ? formato(Number(v)) : v) }}
          >
            {datos.map((d, i) => (
              <Cell key={i} fill={elegido == null ? NEGRO : String(d[clave]) === elegido ? ROJO : GRIS} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Resumen

const ICONO_HALLAZGO = { alerta: AlertTriangle, oportunidad: Lightbulb, info: Info };

function Hallazgos({ h }: { h: Hallazgo[] }) {
  if (!h.length) {
    return (
      <Tarjeta titulo="Lo que dicen tus números">
        <p className="text-sm text-slate-500">Todavía no hay suficientes ventas o prospectos en este periodo para sacar conclusiones. Prueba con «Últimos 12 meses».</p>
      </Tarjeta>
    );
  }
  return (
    <Tarjeta titulo="Lo que dicen tus números">
      <ul className="space-y-2.5">
        {h.map((x, i) => {
          const Icono = ICONO_HALLAZGO[x.tono];
          return (
            <li key={i} className="flex gap-2.5 items-start">
              <Icono className={`w-4 h-4 mt-0.5 shrink-0 ${x.tono === "alerta" ? "text-[#D6402A]" : x.tono === "oportunidad" ? "text-emerald-600" : "text-slate-400"}`} />
              <p className="text-sm text-slate-700 dark:text-slate-200 leading-snug">{x.texto}</p>
            </li>
          );
        })}
      </ul>
    </Tarjeta>
  );
}

function Resumen({ a, h, verCostos, irA, periodo, pendientes }: {
  a: A; h: Hallazgo[]; verCostos: boolean; irA: (p: Pestana) => void; periodo: string; pendientes?: ReactNode;
}) {
  const r = a.resumen;
  const viejos = a.inventario.lista.filter((v) => v.dias != null && v.dias > 90).length;
  return (
    <div className="space-y-4">
      <Hallazgos h={h} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icono={Car} titulo="Autos vendidos" valor={r.ventas} pie={<Cambio ahora={r.ventas} antes={r.ventasAntes} />} onClick={() => irA("ventas")} />
        <Kpi icono={DollarSign} titulo="Ingresos por ventas" valor={dineroCorto(r.ingresos)} pie={<Cambio ahora={r.ingresos} antes={r.ingresosAntes} />} onClick={() => irA("ventas")} />
        <Kpi icono={Receipt} titulo="Ticket promedio" valor={r.ventas ? dineroCorto(r.ticket) : "—"} pie={r.ventas ? <Cambio ahora={r.ticket} antes={r.ticketAntes} /> : null} onClick={() => irA("ventas")} />
        <Kpi icono={Users} titulo="Prospectos nuevos" valor={r.prospectos} pie={<Cambio ahora={r.prospectos} antes={r.prospectosAntes} />} onClick={() => irA("clientes")} />
        <Kpi icono={Clock} titulo="Días para vender" valor={r.diasParaVender ?? "—"} pie="la mitad se vende en menos" onClick={() => irA("ventas")} />
        <Kpi icono={Car} titulo="Inventario" valor={`${r.inventarioUnidades} autos`} pie={`${dineroCorto(r.inventarioValor)} · ${viejos} con +90 días`} onClick={() => irA("inventario")} />
        {verCostos ? (
          <Kpi icono={Gauge} titulo="Margen bruto" valor={r.margenSobre ? dineroCorto(r.margen) : "—"} pie={r.ventas ? `sobre ${r.margenSobre} de ${r.ventas} ventas con costo` : null} onClick={() => irA("ventas")} />
        ) : (
          <Kpi icono={Gauge} titulo="Conversión" valor={r.prospectos ? `${Math.round((r.ventas / r.prospectos) * 100)}%` : "—"} pie="ventas entre prospectos" onClick={() => irA("clientes")} />
        )}
        <Kpi icono={Briefcase} titulo="Tratos abiertos" valor={r.tratosAbiertos} pie="hoy, en el embudo" onClick={() => irA("equipo")} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Tarjeta titulo="Autos vendidos por mes (12 meses)">
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={a.ventas.porMes} margin={{ left: -20, right: 8, top: 8 }}>
                <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis dataKey="etiqueta" {...ejes} />
                <YAxis allowDecimals={false} {...ejes} />
                <Tooltip {...tooltip} formatter={(v: any, n: any) => (n === "monto" ? dinero(Number(v)) : v)} />
                <Bar dataKey="unidades" name="Autos" fill={NEGRO} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Tarjeta>
        <Tarjeta titulo={`Cómo llegan tus prospectos · ${periodo.toLowerCase()}`} accion={<button onClick={() => irA("clientes")} className="text-[11px] font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white">Ver detalle</button>}>
          <Barras datos={a.clientes.porFuente.slice(0, 6)} clave="etiqueta" valor="prospectos" />
        </Tarjeta>
      </div>

      {pendientes}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ventas

function Ventas({ a, verCostos, onAbrirVehiculo }: { a: A; verCostos: boolean; onAbrirVehiculo?: (id: string) => void }) {
  const [filtro, setFiltro] = useState<{ campo: "tipo" | "marca" | "rango"; valor: string; texto: string } | null>(null);
  const alternar = (campo: "tipo" | "marca" | "rango", valor: string, texto = valor) =>
    setFiltro((f) => (f && f.campo === campo && f.valor === valor ? null : { campo, valor, texto }));

  const rangoDe = (precio: number) =>
    (RANGOS_DE_PRECIO.find((r) => precio >= r.min && precio < r.max) || RANGOS_DE_PRECIO[RANGOS_DE_PRECIO.length - 1]).etiqueta;

  const lista = a.ventas.lista.filter((v) => {
    if (!filtro) return true;
    if (filtro.campo === "tipo") return v.tipo === filtro.valor;
    if (filtro.campo === "marca") return v.marca === filtro.valor;
    return rangoDe(v.precio) === filtro.valor;
  });
  const elegido = (campo: string) => (filtro?.campo === campo ? filtro.valor : null);

  if (!a.ventas.lista.length) {
    return <Tarjeta titulo="Ventas"><Vacio texto="No hay autos vendidos en este periodo. Prueba con un periodo más largo." /></Tarjeta>;
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">Toca una barra para ver solo esos autos en la lista de abajo.</p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Tarjeta titulo="Qué tipo de auto se vende">
          <Barras datos={a.ventas.porTipo} clave="tipo" valor="unidades" elegido={elegido("tipo")} onElegir={(k) => alternar("tipo", k)} />
        </Tarjeta>
        <Tarjeta titulo="A qué precio se vende (el presupuesto real)">
          <Barras datos={a.ventas.porRango} clave="etiqueta" valor="unidades" elegido={elegido("rango")} onElegir={(k) => alternar("rango", k)} />
        </Tarjeta>
        <Tarjeta titulo="Marcas que más se venden">
          <Barras datos={a.ventas.porMarca.slice(0, 8)} clave="marca" valor="unidades" elegido={elegido("marca")} onElegir={(k) => alternar("marca", k)} />
        </Tarjeta>
        <Tarjeta titulo="Por tipo: ticket y rapidez">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-slate-400 text-left">
                <th className="py-1.5">Tipo</th><th className="text-right">Autos</th><th className="text-right">Ticket</th><th className="text-right">Días (mediana)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {a.ventas.porTipo.map((t) => (
                <tr key={t.tipo} onClick={() => alternar("tipo", t.tipo)} className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/40 ${elegido("tipo") === t.tipo ? "text-[#A82A17] dark:text-[#F2705B] font-semibold" : "text-slate-700 dark:text-slate-200"}`}>
                  <td className="py-1.5">{t.tipo}</td>
                  <td className="text-right">{t.unidades}</td>
                  <td className="text-right">{dineroCorto(t.ticket)}</td>
                  <td className="text-right">{t.diasMediana ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {a.ventas.porAnio.length > 0 && (
            <div className="mt-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-1">Año modelo vendido</p>
              <div className="flex flex-wrap gap-1.5">
                {a.ventas.porAnio.map((x) => (
                  <span key={x.rango} className="text-[11px] px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                    {x.rango}: <b>{x.unidades}</b>
                  </span>
                ))}
              </div>
            </div>
          )}
        </Tarjeta>
      </div>

      <Tarjeta titulo={`Autos vendidos (${lista.length})`} accion={filtro && <Filtro texto={filtro.texto} quitar={() => setFiltro(null)} />}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-slate-400 text-left border-b border-slate-100 dark:border-slate-700">
                <th className="py-2">Auto</th><th>Tipo</th><th className="text-right">Precio</th><th className="text-right">Vendido</th><th className="text-right">Días</th>
                {verCostos && <th className="text-right">Margen</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {lista.map((v) => (
                <tr key={v.id} onClick={() => onAbrirVehiculo?.(v.id)} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/40 text-slate-700 dark:text-slate-200">
                  <td className="py-2 font-semibold">{v.auto}</td>
                  <td>{v.tipo}</td>
                  <td className="text-right">{dinero(v.precio)}</td>
                  <td className="text-right">{fechaCorta(v.vendidoEl)}</td>
                  <td className="text-right">{v.dias ?? "—"}</td>
                  {verCostos && <td className="text-right">{v.margen != null ? dinero(v.margen) : <span className="text-slate-400">sin costo</span>}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Tarjeta>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inventario

function Inventario({ a, verCostos, onAbrirVehiculo }: { a: A; verCostos: boolean; onAbrirVehiculo?: (id: string) => void }) {
  const inv = a.inventario;
  const [filtro, setFiltro] = useState<{ campo: "tipo" | "antiguedad"; valor: string } | null>(null);
  const alternar = (campo: "tipo" | "antiguedad", valor: string) =>
    setFiltro((f) => (f && f.campo === campo && f.valor === valor ? null : { campo, valor }));

  const rangoDias = (d: number | null) => {
    if (d == null) return "Sin fecha";
    return d <= 30 ? "0 a 30 días" : d <= 60 ? "31 a 60 días" : d <= 90 ? "61 a 90 días" : "Más de 90 días";
  };
  const lista = inv.lista.filter((v) => {
    if (!filtro) return true;
    return filtro.campo === "tipo" ? v.tipo === filtro.valor : rangoDias(v.dias) === filtro.valor;
  });
  const elegido = (campo: string) => (filtro?.campo === campo ? filtro.valor : null);

  if (!inv.lista.length) {
    return <Tarjeta titulo="Inventario"><Vacio texto="No hay autos disponibles en inventario." /></Tarjeta>;
  }

  const valorViejo = inv.lista.filter((v) => v.dias != null && v.dias > 90).reduce((s, v) => s + v.precio, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icono={Car} titulo="Autos en piso" valor={inv.lista.length} pie={`${inv.lista.filter((v) => v.apartado).length} apartados`} />
        <Kpi icono={DollarSign} titulo="Valor a precio de venta" valor={dineroCorto(a.resumen.inventarioValor)} />
        <Kpi icono={Clock} titulo="Más de 90 días" valor={inv.antiguedad[3].unidades} pie={`${dineroCorto(valorViejo)} parados`} onClick={() => alternar("antiguedad", "Más de 90 días")} />
        <Kpi icono={Briefcase} titulo="Propio / consignación" valor={`${inv.propiedad[0].unidades} / ${inv.propiedad[1].unidades}`} pie={inv.propiedad[2].unidades ? `${inv.propiedad[2].unidades} sin dato` : null} />
      </div>

      <p className="text-xs text-slate-500">Toca una barra para ver solo esos autos en la lista de abajo.</p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Tarjeta titulo="Cuánto tiempo llevan en piso">
          <Barras datos={inv.antiguedad} clave="etiqueta" valor="unidades" elegido={elegido("antiguedad")} onElegir={(k) => alternar("antiguedad", k)} />
        </Tarjeta>
        <Tarjeta titulo={`Lo que vendes vs. lo que tienes (${inv.ventasDe12Meses} ventas en 12 meses)`}>
          {inv.mezcla.length ? (
            <div style={{ height: Math.max(160, inv.mezcla.length * 40 + 40) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={inv.mezcla} layout="vertical" margin={{ left: 8, right: 24 }}>
                  <XAxis type="number" hide domain={[0, 100]} />
                  <YAxis type="category" dataKey="tipo" width={90} {...ejes} />
                  <Tooltip {...tooltip} formatter={(v: any) => `${v}%`} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="pctVentas" name="% de lo que vendes" fill={NEGRO} radius={[0, 4, 4, 0]} className="cursor-pointer" onClick={(d: any) => alternar("tipo", d.tipo)} />
                  <Bar dataKey="pctInventario" name="% de tu piso" fill={GRIS} radius={[0, 4, 4, 0]} className="cursor-pointer" onClick={(d: any) => alternar("tipo", d.tipo)} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <Vacio texto="Sin datos" />}
          <p className="text-[11px] text-slate-500 mt-2">Si la barra negra es más larga que la gris, ese tipo se vende más de lo que tienes: conviene comprar más.</p>
        </Tarjeta>
      </div>

      <Tarjeta
        titulo={`Autos en inventario (${lista.length}) · del más viejo al más nuevo`}
        accion={filtro && <Filtro texto={filtro.valor} quitar={() => setFiltro(null)} />}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-slate-400 text-left border-b border-slate-100 dark:border-slate-700">
                <th className="py-2">Auto</th><th>Tipo</th><th className="text-right">Precio</th><th className="text-right">Días en piso</th><th>Propiedad</th>
                {verCostos && <th className="text-right">Costo</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {lista.map((v) => (
                <tr key={v.id} onClick={() => onAbrirVehiculo?.(v.id)} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/40 text-slate-700 dark:text-slate-200">
                  <td className="py-2 font-semibold">{v.auto}{v.apartado && <span className="ml-2 text-[10px] font-bold uppercase text-slate-400">apartado</span>}</td>
                  <td>{v.tipo}</td>
                  <td className="text-right">{v.precio ? dinero(v.precio) : "—"}</td>
                  <td className={`text-right ${v.dias != null && v.dias > 90 ? "text-[#A82A17] dark:text-[#F2705B] font-semibold" : ""}`}>{v.dias ?? "—"}</td>
                  <td>{v.propiedad}</td>
                  {verCostos && <td className="text-right">{v.costo ? dinero(v.costo) : <span className="text-slate-400">—</span>}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Tarjeta>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Clientes

function Clientes({ a }: { a: A }) {
  const c = a.clientes;
  const [elegida, setElegida] = useState<string | null>(null);
  const fuente = c.porFuente.find((f) => f.etiqueta === elegida);
  const d = c.demanda;
  const presupuestos = d.porPresupuesto.filter((x) => x.clientes > 0);

  return (
    <div className="space-y-4">
      {c.nuevos > 0 && c.sinDato / c.nuevos >= 0.3 && (
        <div className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-3">
          {c.sinDato} de {c.nuevos} prospectos no dicen cómo llegaron. A partir de hoy el CRM lo pide al dar de alta un contacto, así que este dato se irá llenando.
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Tarjeta titulo={`Cómo llegan (${c.nuevos} prospectos nuevos)`}>
          <Barras datos={c.porFuente} clave="etiqueta" valor="prospectos" elegido={elegida} onElegir={(k) => setElegida((x) => (x === k ? null : k))} />
          {fuente && (
            <p className="text-sm text-slate-700 dark:text-slate-200 mt-2">
              <b>{fuente.etiqueta}</b>: {fuente.prospectos} prospectos, {fuente.compraron} compraron ({fuente.conversion}%).
            </p>
          )}
        </Tarjeta>
        <Tarjeta titulo="Qué canal convierte">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-slate-400 text-left">
                <th className="py-1.5">Cómo llegó</th><th className="text-right">Prospectos</th><th className="text-right">Compraron</th><th className="text-right">Conversión</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {c.porFuente.map((f) => (
                <tr key={f.fuente} onClick={() => setElegida((x) => (x === f.etiqueta ? null : f.etiqueta))} className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/40 ${elegida === f.etiqueta ? "text-[#A82A17] dark:text-[#F2705B] font-semibold" : "text-slate-700 dark:text-slate-200"}`}>
                  <td className="py-1.5">{f.etiqueta}</td>
                  <td className="text-right">{f.prospectos}</td>
                  <td className="text-right">{f.compraron}</td>
                  <td className="text-right">{f.conversion}%</td>
                </tr>
              ))}
              {!c.porFuente.length && <tr><td colSpan={4}><Vacio texto="Sin prospectos nuevos en este periodo" /></td></tr>}
            </tbody>
          </table>
          <p className="text-[11px] text-slate-500 mt-2">No cuenta los contactos importados de Google o Excel: esos no llegaron, se subieron.</p>
        </Tarjeta>
      </div>

      <Tarjeta titulo="Prospectos nuevos por mes (12 meses)">
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={c.porMes} margin={{ left: -20, right: 8, top: 8 }}>
              <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="3 3" />
              <XAxis dataKey="etiqueta" {...ejes} />
              <YAxis allowDecimals={false} {...ejes} />
              <Tooltip {...tooltip} />
              <Bar dataKey="prospectos" name="Prospectos" fill={NEGRO} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Tarjeta>

      <Tarjeta titulo={`Lo que buscan los clientes en proceso (${d.conBusqueda} con búsqueda anotada)`}>
        {d.conBusqueda === 0 ? (
          <Vacio texto="Ningún cliente tiene anotado qué auto busca. Se llena en la ficha del contacto, en «Busca auto»." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-1">Tipo</p>
              <Barras datos={d.porTipo} clave="tipo" valor="clientes" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-1">Presupuesto</p>
              <Barras datos={presupuestos} clave="etiqueta" valor="clientes" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-1">Marca</p>
              <Barras datos={d.porMarca} clave="marca" valor="clientes" />
            </div>
          </div>
        )}
      </Tarjeta>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Equipo

function Equipo({ a }: { a: A }) {
  const [orden, setOrden] = useState<"ventas" | "monto" | "prospectos" | "tratosAbiertos">("ventas");
  const lista = [...a.equipo].sort((x, y) => (y[orden] as number) - (x[orden] as number));
  const Th = ({ id, children }: { id: typeof orden; children: ReactNode }) => (
    <th className="text-right">
      <button onClick={() => setOrden(id)} className={`uppercase tracking-wider ${orden === id ? "text-slate-900 dark:text-white" : "hover:text-slate-600"}`}>
        {children}{orden === id ? " ↓" : ""}
      </button>
    </th>
  );
  return (
    <Tarjeta titulo="Tu equipo en el periodo">
      {!lista.length ? <Vacio texto="No hay asesores en la agencia." /> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] text-slate-400 text-left border-b border-slate-100 dark:border-slate-700">
                <th className="py-2 uppercase tracking-wider">Asesor</th>
                <Th id="prospectos">Prospectos nuevos</Th>
                <Th id="tratosAbiertos">Tratos abiertos</Th>
                <Th id="ventas">Ventas</Th>
                <Th id="monto">Monto</Th>
                <th className="text-right uppercase tracking-wider">Conversión</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {lista.map((u) => (
                <tr key={u.id} className="text-slate-700 dark:text-slate-200">
                  <td className="py-2 font-semibold">{u.nombre}</td>
                  <td className="text-right">{u.prospectos}</td>
                  <td className="text-right">{u.tratosAbiertos}</td>
                  <td className="text-right font-semibold">{u.ventas}</td>
                  <td className="text-right">{u.monto ? dinero(u.monto) : "—"}</td>
                  <td className="text-right">{u.conversion != null ? `${u.conversion}%` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[11px] text-slate-500 mt-2">Las ventas de cada asesor salen de sus tratos ganados; toca un encabezado para ordenar.</p>
        </div>
      )}
    </Tarjeta>
  );
}
