import { useMemo, useState, type ReactNode } from "react";
import { TrendingUp, TrendingDown, ChevronDown, ChevronUp, X } from "lucide-react";
import { calcularAnalitica, hallazgos as calcularHallazgos, RANGOS_DE_PRECIO } from "../../lib/analiticaAgencia";
import {
  PERIODOS, rangoDelPeriodo, leer, guardar, dinero, dineroCorto, ICONO_HALLAZGO,
  type Periodo, type TableroAgenciaProps,
} from "./TableroAgencia";

/**
 * El tablero del administrador en el celular. Mismo calculo y mismas frases
 * que en escritorio (TableroAgencia); aqui sin graficas de recharts, que en
 * 380 px no se leen: barras hechas con CSS que se tocan para filtrar.
 */

type Seccion = "ventas" | "inventario" | "clientes" | "equipo";
const SECCIONES: { id: Seccion; nombre: string }[] = [
  { id: "ventas", nombre: "Ventas" },
  { id: "inventario", nombre: "Inventario" },
  { id: "clientes", nombre: "Clientes" },
  { id: "equipo", nombre: "Equipo" },
];
const CORTO: Record<Periodo, string> = { mes: "Este mes", "3m": "3 meses", anio: "Este año", "12m": "12 meses" };

type A = ReturnType<typeof calcularAnalitica>;

export function TableroMovil(p: TableroAgenciaProps & { parcial?: boolean }) {
  const [periodo, setPeriodoEstado] = useState<Periodo>(() =>
    leer("tablero_periodo", PERIODOS.map((x) => x.id), "12m"));
  const [seccion, setSeccionEstado] = useState<Seccion>(() =>
    leer("tablero_movil_seccion", SECCIONES.map((x) => x.id), "ventas"));
  const [todasLasFrases, setTodasLasFrases] = useState(false);
  const setPeriodo = (x: Periodo) => { setPeriodoEstado(x); guardar("tablero_periodo", x); };
  const setSeccion = (x: Seccion) => { setSeccionEstado(x); guardar("tablero_movil_seccion", x); };

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

  const r = a.resumen;
  const viejos = a.inventario.lista.filter((v) => v.dias != null && v.dias > 90).length;
  const frases = todasLasFrases ? h : h.slice(0, 3);

  return (
    <section className="space-y-3">
      {/* Sin Excel en el movil: decision de Luis. El reporte se baja en la computadora. */}
      <h2 className="text-base font-extrabold tracking-tight text-slate-800 dark:text-white">Tu agencia en números</h2>

      {/* Periodo */}
      <div className="flex gap-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded p-1">
        {PERIODOS.map((x) => (
          <button
            key={x.id}
            onClick={() => setPeriodo(x.id)}
            className={`flex-1 text-[11px] font-bold py-1.5 rounded transition-colors ${
              periodo === x.id ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900" : "text-slate-500"
            }`}
          >
            {CORTO[x.id]}
          </button>
        ))}
      </div>

      {p.parcial && (
        <p className="text-[11px] text-slate-500 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded p-2.5">
          En el celular tienes activado ver solo tus contactos, así que prospectos y equipo cuentan solo los tuyos. Ventas e inventario sí son de toda la agencia.
        </p>
      )}

      {/* Lo que dicen los numeros */}
      {h.length > 0 && (
        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded p-3.5 space-y-2.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Lo que dicen tus números</p>
          {frases.map((x, i) => {
            const Icono = ICONO_HALLAZGO[x.tono];
            return (
              <div key={i} className="flex gap-2 items-start">
                <Icono className={`w-4 h-4 mt-0.5 shrink-0 ${x.tono === "alerta" ? "text-[#D6402A]" : x.tono === "oportunidad" ? "text-emerald-600" : "text-slate-400"}`} />
                <p className="text-[13px] leading-snug text-slate-700 dark:text-slate-200">{x.texto}</p>
              </div>
            );
          })}
          {h.length > 3 && (
            <button onClick={() => setTodasLasFrases((v) => !v)} className="text-[11px] font-bold text-slate-500 flex items-center gap-0.5">
              {todasLasFrases ? <>Ver menos <ChevronUp className="w-3 h-3" /></> : <>Ver {h.length - 3} más <ChevronDown className="w-3 h-3" /></>}
            </button>
          )}
        </div>
      )}

      {/* Numeros clave */}
      <div className="grid grid-cols-2 gap-2.5">
        <Cifra titulo="Autos vendidos" valor={r.ventas} pie={<Cambio ahora={r.ventas} antes={r.ventasAntes} />} />
        <Cifra titulo="Ingresos" valor={dineroCorto(r.ingresos)} pie={<Cambio ahora={r.ingresos} antes={r.ingresosAntes} />} />
        <Cifra titulo="Ticket promedio" valor={r.ventas ? dineroCorto(r.ticket) : "—"} pie={r.diasParaVender != null ? `se vende en ~${r.diasParaVender} días` : null} />
        {p.verCostos ? (
          <Cifra titulo="Margen bruto" valor={r.margenSobre ? dineroCorto(r.margen) : "—"} pie={r.ventas ? `${r.margenSobre} de ${r.ventas} con costo` : null} />
        ) : (
          <Cifra titulo="Conversión" valor={r.prospectos ? `${Math.round((r.ventas / r.prospectos) * 100)}%` : "—"} pie="ventas / prospectos" />
        )}
        <Cifra titulo="Prospectos nuevos" valor={r.prospectos} pie={<Cambio ahora={r.prospectos} antes={r.prospectosAntes} />} />
        <Cifra titulo="Inventario" valor={`${r.inventarioUnidades} autos`} pie={viejos ? <span className="text-[#A82A17] dark:text-[#F2705B] font-semibold">{viejos} con +90 días</span> : dineroCorto(r.inventarioValor)} />
      </div>

      {/* Detalle */}
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded">
        <div className="flex border-b border-gray-200 dark:border-slate-700">
          {SECCIONES.map((x) => (
            <button
              key={x.id}
              onClick={() => setSeccion(x.id)}
              className={`flex-1 py-2.5 text-[12px] font-bold border-b-2 -mb-px ${
                seccion === x.id ? "border-[#D6402A] text-slate-900 dark:text-white" : "border-transparent text-slate-500"
              }`}
            >
              {x.nombre}
            </button>
          ))}
        </div>
        <div className="p-3.5">
          {seccion === "ventas" && <Ventas a={a} onAbrirVehiculo={p.onAbrirVehiculo} />}
          {seccion === "inventario" && <Inventario a={a} onAbrirVehiculo={p.onAbrirVehiculo} />}
          {seccion === "clientes" && <Clientes a={a} />}
          {seccion === "equipo" && <Equipo a={a} />}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

function Cifra({ titulo, valor, pie }: { titulo: string; valor: ReactNode; pie?: ReactNode }) {
  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded p-3">
      <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500">{titulo}</p>
      <p className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-slate-100 mt-0.5">{valor}</p>
      <div className="text-[10px] text-slate-500 min-h-[14px]">{pie}</div>
    </div>
  );
}

function Cambio({ ahora, antes }: { ahora: number; antes: number }) {
  if (!antes) return ahora ? <span className="text-slate-400">sin datos antes</span> : null;
  const pct = Math.round(((ahora - antes) / antes) * 100);
  if (pct === 0) return <span className="text-slate-400">igual que antes</span>;
  const sube = pct > 0;
  return (
    <span className={`font-semibold inline-flex items-center gap-0.5 ${sube ? "text-emerald-600 dark:text-emerald-400" : "text-[#A82A17] dark:text-[#F2705B]"}`}>
      {sube ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {sube ? "+" : ""}{pct}% vs. antes
    </span>
  );
}

function Subtitulo({ children }: { children: ReactNode }) {
  return <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 mb-2">{children}</p>;
}

function Vacio({ texto }: { texto: string }) {
  return <p className="text-xs text-slate-400 italic py-4 text-center">{texto}</p>;
}

/** Una fila con barra. Si se puede tocar, tocarla filtra; otra vez, quita el filtro. */
function Fila({ etiqueta, valor, max, texto, elegido, onClick }: {
  etiqueta: string; valor: number; max: number; texto?: string; elegido?: boolean | null; onClick?: () => void;
}) {
  const ancho = max ? Math.max(3, Math.round((valor / max) * 100)) : 0;
  const color = elegido == null ? "bg-slate-700 dark:bg-slate-300" : elegido ? "bg-[#D6402A]" : "bg-slate-300 dark:bg-slate-600";
  return (
    <button onClick={onClick} disabled={!onClick} className="w-full text-left py-1">
      <div className="flex justify-between text-[12px] mb-0.5">
        <span className={`${elegido ? "font-bold text-[#A82A17] dark:text-[#F2705B]" : "text-slate-700 dark:text-slate-200"}`}>{etiqueta}</span>
        <span className="font-bold text-slate-900 dark:text-slate-100">{texto ?? valor}</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-700">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${ancho}%` }} />
      </div>
    </button>
  );
}

function Filtro({ texto, quitar }: { texto: string; quitar: () => void }) {
  return (
    <button onClick={quitar} className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#D6402A]/10 text-[#A82A17] dark:text-[#F2705B] inline-flex items-center gap-1">
      {texto} <X className="w-3 h-3" />
    </button>
  );
}

function Autos({ lista, onAbrir, extra }: {
  lista: { id: string; auto: string; precio: number; dias: number | null }[];
  onAbrir?: (id: string) => void;
  extra: (v: any) => ReactNode;
}) {
  return (
    <div className="divide-y divide-slate-100 dark:divide-slate-700">
      {lista.map((v) => (
        <button key={v.id} onClick={() => onAbrir?.(v.id)} className="w-full text-left py-2 flex justify-between gap-2 active:bg-slate-50 dark:active:bg-slate-700/40">
          <span className="text-[12px] font-semibold text-slate-800 dark:text-slate-100 truncate">{v.auto}</span>
          <span className="text-[11px] text-slate-500 shrink-0 text-right">{extra(v)}</span>
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------

function Ventas({ a, onAbrirVehiculo }: { a: A; onAbrirVehiculo?: (id: string) => void }) {
  const [filtro, setFiltro] = useState<{ campo: "tipo" | "rango"; valor: string } | null>(null);
  const alternar = (campo: "tipo" | "rango", valor: string) =>
    setFiltro((f) => (f && f.campo === campo && f.valor === valor ? null : { campo, valor }));
  if (!a.ventas.lista.length) return <Vacio texto="No hay autos vendidos en este periodo." />;

  const rangoDe = (precio: number) =>
    (RANGOS_DE_PRECIO.find((r) => precio >= r.min && precio < r.max) || RANGOS_DE_PRECIO[RANGOS_DE_PRECIO.length - 1]).etiqueta;
  const maxTipo = Math.max(...a.ventas.porTipo.map((t) => t.unidades));
  const rangos = a.ventas.porRango.filter((x) => x.unidades > 0);
  const maxRango = Math.max(...rangos.map((x) => x.unidades));
  const lista = a.ventas.lista.filter((v) =>
    !filtro ? true : filtro.campo === "tipo" ? v.tipo === filtro.valor : rangoDe(v.precio) === filtro.valor);

  return (
    <div className="space-y-4">
      <div>
        <Subtitulo>Qué tipo se vende</Subtitulo>
        {a.ventas.porTipo.map((t) => (
          <Fila key={t.tipo} etiqueta={t.tipo} valor={t.unidades} max={maxTipo}
            texto={`${t.unidades} · ${dineroCorto(t.ticket)}`}
            elegido={filtro?.campo === "tipo" ? filtro.valor === t.tipo : null}
            onClick={() => alternar("tipo", t.tipo)} />
        ))}
      </div>
      <div>
        <Subtitulo>A qué precio (el presupuesto real)</Subtitulo>
        {rangos.map((x) => (
          <Fila key={x.rango} etiqueta={x.etiqueta} valor={x.unidades} max={maxRango}
            elegido={filtro?.campo === "rango" ? filtro.valor === x.etiqueta : null}
            onClick={() => alternar("rango", x.etiqueta)} />
        ))}
      </div>
      <div>
        <div className="flex items-center justify-between mb-1">
          <Subtitulo>Vendidos ({lista.length})</Subtitulo>
          {filtro && <Filtro texto={filtro.valor} quitar={() => setFiltro(null)} />}
        </div>
        <Autos lista={lista} onAbrir={onAbrirVehiculo} extra={(v) => <>{dinero(v.precio)}{v.dias != null ? ` · ${v.dias} d` : ""}</>} />
      </div>
    </div>
  );
}

function Inventario({ a, onAbrirVehiculo }: { a: A; onAbrirVehiculo?: (id: string) => void }) {
  const inv = a.inventario;
  const [filtro, setFiltro] = useState<string | null>(null);
  const [todos, setTodos] = useState(false);
  if (!inv.lista.length) return <Vacio texto="No hay autos disponibles en inventario." />;

  const rangoDias = (d: number | null) =>
    d == null ? "Sin fecha" : d <= 30 ? "0 a 30 días" : d <= 60 ? "31 a 60 días" : d <= 90 ? "61 a 90 días" : "Más de 90 días";
  const maxAnt = Math.max(...inv.antiguedad.map((x) => x.unidades));
  const filtrada = inv.lista.filter((v) => !filtro || rangoDias(v.dias) === filtro);
  const lista = todos ? filtrada : filtrada.slice(0, 6);
  const mezcla = inv.mezcla.filter((m) => m.pctVentas > 0 || m.pctInventario > 0);

  return (
    <div className="space-y-4">
      <div>
        <Subtitulo>Cuánto llevan en piso</Subtitulo>
        {inv.antiguedad.map((x) => (
          <Fila key={x.rango} etiqueta={x.etiqueta} valor={x.unidades} max={maxAnt}
            texto={x.unidades ? `${x.unidades} · ${dineroCorto(x.valor)}` : "0"}
            elegido={filtro ? filtro === x.etiqueta : null}
            onClick={x.unidades ? () => setFiltro((f) => (f === x.etiqueta ? null : x.etiqueta)) : undefined} />
        ))}
      </div>
      {inv.ventasDe12Meses > 0 && (
        <div>
          <Subtitulo>Lo que vendes vs. lo que tienes</Subtitulo>
          <div className="space-y-2">
            {mezcla.map((m) => (
              <div key={m.tipo}>
                <div className="flex justify-between text-[12px]">
                  <span className="text-slate-700 dark:text-slate-200">{m.tipo}</span>
                  <span className={`font-semibold ${m.diferencia >= 15 ? "text-emerald-600" : m.diferencia <= -15 ? "text-[#A82A17] dark:text-[#F2705B]" : "text-slate-500"}`}>
                    {m.diferencia >= 15 ? "comprar más" : m.diferencia <= -15 ? "te sobra" : "parejo"}
                  </span>
                </div>
                <div className="grid grid-cols-[76px_1fr] gap-x-2 items-center text-[10px] text-slate-500 whitespace-nowrap">
                  <span>vendes {m.pctVentas}%</span>
                  <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-700"><div className="h-1.5 rounded-full bg-slate-700 dark:bg-slate-300" style={{ width: `${m.pctVentas}%` }} /></div>
                  <span>tienes {m.pctInventario}%</span>
                  <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-700"><div className="h-1.5 rounded-full bg-slate-300 dark:bg-slate-500" style={{ width: `${m.pctInventario}%` }} /></div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5">Con las {inv.ventasDe12Meses} ventas de los últimos 12 meses.</p>
        </div>
      )}
      <div>
        <div className="flex items-center justify-between mb-1">
          <Subtitulo>Del más viejo al más nuevo ({filtrada.length})</Subtitulo>
          {filtro && <Filtro texto={filtro} quitar={() => setFiltro(null)} />}
        </div>
        <Autos lista={lista} onAbrir={onAbrirVehiculo} extra={(v) => (
          <span className={v.dias != null && v.dias > 90 ? "text-[#A82A17] dark:text-[#F2705B] font-semibold" : ""}>
            {v.dias != null ? `${v.dias} d` : "—"} · {dineroCorto(v.precio)}
          </span>
        )} />
        {filtrada.length > 6 && (
          <button onClick={() => setTodos((t) => !t)} className="text-[11px] font-bold text-slate-500 mt-1">
            {todos ? "Ver menos" : `Ver los ${filtrada.length}`}
          </button>
        )}
      </div>
    </div>
  );
}

function Clientes({ a }: { a: A }) {
  const c = a.clientes;
  if (!c.porFuente.length) return <Vacio texto="Sin prospectos nuevos en este periodo." />;
  const max = Math.max(...c.porFuente.map((f) => f.prospectos));
  const d = c.demanda;
  return (
    <div className="space-y-4">
      <div>
        <Subtitulo>Cómo llegan ({c.nuevos}) y cuántos compran</Subtitulo>
        {c.porFuente.map((f) => (
          <Fila key={f.fuente} etiqueta={f.etiqueta} valor={f.prospectos} max={max}
            texto={`${f.prospectos} · ${f.compraron} compraron (${f.conversion}%)`} />
        ))}
        <p className="text-[10px] text-slate-400 mt-1.5">No cuenta contactos importados de Google o Excel.</p>
      </div>
      {d.conBusqueda > 0 && (
        <div>
          <Subtitulo>Lo que buscan ({d.conBusqueda} con búsqueda anotada)</Subtitulo>
          <div className="flex flex-wrap gap-1.5">
            {d.porTipo.map((t) => (
              <span key={t.tipo} className="text-[11px] px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200">{t.tipo}: <b>{t.clientes}</b></span>
            ))}
            {d.porPresupuesto.filter((x) => x.clientes > 0).map((x) => (
              <span key={x.rango} className="text-[11px] px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200">{x.etiqueta}: <b>{x.clientes}</b></span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Equipo({ a }: { a: A }) {
  if (!a.equipo.length) return <Vacio texto="No hay asesores en la agencia." />;
  return (
    <div className="divide-y divide-slate-100 dark:divide-slate-700">
      {a.equipo.map((u) => (
        <div key={u.id} className="py-2.5">
          <div className="flex justify-between items-baseline">
            <span className="text-[13px] font-bold text-slate-800 dark:text-slate-100 truncate">{u.nombre}</span>
            <span className="text-[13px] font-extrabold text-slate-900 dark:text-white shrink-0">{u.ventas} {u.ventas === 1 ? "venta" : "ventas"}</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {u.prospectos} prospectos · {u.tratosAbiertos} tratos abiertos{u.monto ? ` · ${dineroCorto(u.monto)}` : ""}{u.conversion != null ? ` · ${u.conversion}%` : ""}
          </p>
        </div>
      ))}
    </div>
  );
}
