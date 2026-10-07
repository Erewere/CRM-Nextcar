import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { ChevronLeft, ChevronRight, Copy, Loader2, Save, Sigma, Target } from "lucide-react";
import { metasApi, useMetas } from "../../lib/metasApi";
import { avanceDeMeta, mesActual, nombreDelMes, sumarMes, TEXTO_ESTADO } from "../../lib/metas";
import { MetaBarra } from "./MetaBarra";

/**
 * Metas del mes del equipo y de cada asesor, y cómo va cada quien.
 * Las fija un administrador o gerente; el avance sale de los tratos ganados.
 */

const dinero = (n: number) => "$" + new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 }).format(Math.round(n || 0));
const num = (s: string) => Number(String(s).replace(/[^\d.]/g, "")) || 0;
const campo = "h-9 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 text-sm text-right text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40";

interface Borrador { equipo: { autos: string; ingresos: string }; vendedores: Record<string, { autos: string; ingresos: string }> }

export function MetasDelEquipo() {
  const [mes, setMes] = useState(mesActual());
  const { datos, error, recargar } = useMetas(mes);
  const [b, setB] = useState<Borrador | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState("");

  // El borrador se arma con lo guardado; lo que se escribe queda como texto (para poder poner decimales).
  useEffect(() => {
    if (!datos) { setB(null); return; }
    const t = (n: number) => (n ? String(n) : "");
    setB({
      equipo: { autos: t(datos.equipo.meta.autos), ingresos: t(datos.equipo.meta.ingresos) },
      vendedores: Object.fromEntries(datos.asesores.map((a) => [a.id, { autos: t(a.meta.autos), ingresos: t(a.meta.ingresos) }])),
    });
    setAviso("");
  }, [datos]);

  const sucio = useMemo(() => {
    if (!datos || !b) return false;
    const t = (n: number) => (n ? String(n) : "");
    if (b.equipo.autos !== t(datos.equipo.meta.autos) || b.equipo.ingresos !== t(datos.equipo.meta.ingresos)) return true;
    return datos.asesores.some((a) => b.vendedores[a.id]?.autos !== t(a.meta.autos) || b.vendedores[a.id]?.ingresos !== t(a.meta.ingresos));
  }, [datos, b]);

  if (error) return <p className="text-sm text-red-700 dark:text-red-400">{error}</p>;
  if (!datos || !b) return <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;

  const puede = datos.puedeFijar;
  const metaEq = num(b.equipo.autos);
  const sumaAutos = Object.values(b.vendedores).reduce((s, v) => s + num(v.autos), 0);
  const sumaIngresos = Object.values(b.vendedores).reduce((s, v) => s + num(v.ingresos), 0);
  const filas = [...datos.asesores].sort((x, y) => y.ventas - x.ventas || y.monto - x.monto);
  const ae = avanceDeMeta(datos.equipo.ventas, num(b.equipo.autos), mes);

  const guardar = async () => {
    setGuardando(true); setAviso("");
    try {
      await metasApi.guardar({
        mes,
        equipo: { autos: num(b.equipo.autos), ingresos: num(b.equipo.ingresos) },
        vendedores: Object.fromEntries(Object.entries(b.vendedores).map(([id, v]) => [id, { autos: num(v.autos), ingresos: num(v.ingresos) }])),
      });
      setAviso("Metas guardadas.");
      await recargar();
    } catch (e: any) { setAviso(e.message); }
    finally { setGuardando(false); }
  };

  const copiar = () => {
    const s = datos.sugerida;
    if (!s) return;
    const t = (n: number) => (n ? String(n) : "");
    setB({
      equipo: { autos: t(s.equipo.autos), ingresos: t(s.equipo.ingresos) },
      vendedores: Object.fromEntries(datos.asesores.map((a) => [a.id, { autos: t(s.vendedores[a.id]?.autos || 0), ingresos: t(s.vendedores[a.id]?.ingresos || 0) }])),
    });
    setAviso("Cargué las metas del mes anterior. Revísalas y guarda.");
  };

  return (
    <div className="space-y-4">
      {/* Mes */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button type="button" aria-label="Mes anterior" onClick={() => setMes(sumarMes(mes, -1))} className="h-9 w-9 rounded-lg border border-slate-300 dark:border-slate-600 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-700"><ChevronLeft className="w-4 h-4" /></button>
          <p className="text-base font-extrabold capitalize text-slate-900 dark:text-white w-44 text-center">{nombreDelMes(mes)}</p>
          <button type="button" aria-label="Mes siguiente" onClick={() => setMes(sumarMes(mes, 1))} className="h-9 w-9 rounded-lg border border-slate-300 dark:border-slate-600 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-700"><ChevronRight className="w-4 h-4" /></button>
          {mes !== mesActual() && <button type="button" onClick={() => setMes(mesActual())} className="text-xs font-bold text-blue-700 hover:underline ml-1">Ir al mes actual</button>}
        </div>
        {puede && (
          <div className="flex flex-wrap items-center gap-2">
            {datos.sugerida && !datos.definida && <button type="button" onClick={copiar} className="h-9 px-3 rounded-lg border border-slate-300 dark:border-slate-600 text-xs font-bold flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-700"><Copy className="w-3.5 h-3.5" /> Copiar las del mes anterior</button>}
            <button type="button" onClick={guardar} disabled={guardando || !sucio} className="h-9 px-4 rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-sm font-bold disabled:opacity-40 flex items-center gap-1.5">
              {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar metas
            </button>
          </div>
        )}
      </div>
      {aviso && <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">{aviso}</p>}

      {/* El equipo */}
      <section className="bg-slate-900 text-white rounded-xl p-4 md:p-5 grid grid-cols-1 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-400 flex items-center gap-1.5"><Target className="w-3.5 h-3.5" /> Meta del equipo</p>
          {metaEq > 0 ? (
            <div className="mt-2"><MetaBarra oscuro ventas={datos.equipo.ventas} meta={metaEq} mes={mes} /></div>
          ) : (
            <p className="text-sm text-white/70 mt-2">{puede ? "Escribe la meta de autos del equipo para ver cómo va." : "Aún no se fija la meta del equipo."}</p>
          )}
          {num(b.equipo.ingresos) > 0 && (
            <div className="mt-3"><MetaBarra oscuro compacta unidad="" ventas={Math.round(datos.equipo.monto)} meta={num(b.equipo.ingresos)} mes={mes} /><p className="text-[11px] text-white/60 mt-1">Ingresos: {dinero(datos.equipo.monto)} de {dinero(num(b.equipo.ingresos))}</p></div>
          )}
        </div>
        {puede ? (
          <div className="grid grid-cols-2 gap-3 content-start">
            <label className="flex flex-col gap-1 text-[11px] font-bold uppercase tracking-wider text-white/60">Meta de autos
              <input value={b.equipo.autos} inputMode="numeric" onChange={(e) => setB({ ...b, equipo: { ...b.equipo, autos: e.target.value } })} className={clsx(campo, "text-base font-bold")} placeholder="0" />
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-bold uppercase tracking-wider text-white/60">Meta de ingresos
              <input value={b.equipo.ingresos} inputMode="decimal" onChange={(e) => setB({ ...b, equipo: { ...b.equipo, ingresos: e.target.value } })} className={clsx(campo, "text-base font-bold")} placeholder="$0" />
            </label>
            <button type="button" onClick={() => setB({ ...b, equipo: { autos: sumaAutos ? String(sumaAutos) : "", ingresos: sumaIngresos ? String(sumaIngresos) : "" } })} className="col-span-2 h-9 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold flex items-center justify-center gap-1.5">
              <Sigma className="w-3.5 h-3.5" /> Sumar las metas de los asesores ({sumaAutos} autos)
            </button>
          </div>
        ) : (
          <div className="text-sm text-white/80 self-center">{ae.estado === "sin-meta" ? "" : `${TEXTO_ESTADO[ae.estado].t}.`}</div>
        )}
      </section>

      {/* Cada asesor */}
      <section className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 md:p-5">
        <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mb-3">Metas por asesor</h3>
        {!filas.length ? <p className="text-sm text-slate-500 py-6 text-center">No hay asesores en la agencia.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-slate-400 text-left border-b border-slate-100 dark:border-slate-700">
                  <th className="py-2">Asesor</th>
                  <th className="text-right w-24">Meta autos</th>
                  <th className="text-right w-32">Meta ingresos</th>
                  <th className="text-right w-16">Ventas</th>
                  <th className="text-right w-28">Monto</th>
                  <th className="w-56 pl-4">Avance</th>
                  <th className="text-right w-20">% del equipo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {filas.map((a) => {
                  const v = b.vendedores[a.id] || { autos: "", ingresos: "" };
                  const meta = num(v.autos);
                  return (
                    <tr key={a.id} className="text-slate-700 dark:text-slate-200 align-middle">
                      <td className="py-2 font-semibold">{a.nombre}</td>
                      <td className="py-1.5 pr-2">{puede ? <input value={v.autos} inputMode="numeric" onChange={(e) => setB({ ...b, vendedores: { ...b.vendedores, [a.id]: { ...v, autos: e.target.value } } })} className={campo} placeholder="0" /> : <span className="block text-right">{meta || "—"}</span>}</td>
                      <td className="py-1.5 pr-2">{puede ? <input value={v.ingresos} inputMode="decimal" onChange={(e) => setB({ ...b, vendedores: { ...b.vendedores, [a.id]: { ...v, ingresos: e.target.value } } })} className={campo} placeholder="$0" /> : <span className="block text-right">{num(v.ingresos) ? dinero(num(v.ingresos)) : "—"}</span>}</td>
                      <td className="text-right font-bold">{a.ventas}</td>
                      <td className="text-right">{a.monto ? dinero(a.monto) : "—"}</td>
                      <td className="pl-4">{meta > 0 ? <MetaBarra compacta ventas={a.ventas} meta={meta} mes={mes} /> : <span className="text-xs text-slate-400">Sin meta</span>}</td>
                      <td className="text-right text-slate-500">{datos.equipo.ventas ? `${Math.round((a.ventas / datos.equipo.ventas) * 100)}%` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-[11px] text-slate-500 mt-3">Una venta es un trato ganado con fecha de venta dentro del mes. «A tiempo» significa que lleva al menos lo que toca a esta altura del mes.</p>
      </section>
    </div>
  );
}
