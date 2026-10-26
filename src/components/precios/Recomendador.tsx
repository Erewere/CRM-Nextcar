import React, { useEffect, useState } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';
import { auth } from '../../lib/firebase';
import { getApiUrl } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { BuscadorLista } from './BuscadorLista';

/**
 * «¿Cuánto vendería y cuánto pagaría como máximo?» Busca en las ventas pasadas
 * de la agencia los autos más parecidos (src/lib/memoriaOperaciones.ts) y se
 * apoya en el mercado y la guía cuando hay pocos. Es costos: solo para quien los ve.
 */

type Comp = { vehicleId: string; titulo: string; anio: number; km: number | null; precioCompra: number | null; gastos: number; precioVenta: number | null; utilidad: number | null; diasEnInventario: number | null };
type Resultado = {
  precioVentaEsperado: number | null; precioVentaPesimista: number | null; origenPrecioVenta: string; maxCompraPorPesimista: number | null; maxCompraPorGuia: number | null; maxCompraRecomendado: number | null;
  utilidadEsperada: number | null; utilidadPesimista: number | null; margenEsperadoPct: number | null; margenPesimistaPct: number | null;
  gastosEstimados: number; diasEstimados: number | null; diasRango: [number, number] | null; diasBase?: { ventasPropias: number; anunciosMercado: number; tipicaAgencia: boolean }; comercial: string | null; margenObjetivoPct: number;
  confianza: 'alta' | 'media' | 'baja' | 'ninguna'; comparables: number; advertencias: string[]; insights: string[]; comparablesUsados: Comp[];
  estadoGuia?: { estado: 'en-vivo' | 'guardada' | 'no-disponible' | 'manual'; motivo: string; edadDias?: number };
  consulta?: { km: number | null };
  /** Cuánto del «pagar como máximo» se debe al kilometraje (la guía que se muestra es la original). */
  descuentoKm?: { kmUsado: number; kmReferencia: number; porMilKm: number; medido: boolean; anunciosConKm: number; maxSinKm: number; maxConKm: number; guiaCompraSinKm: number; guiaVentaSinKm: number } | null;
  mercado: { n: number; mediana: number; kmAjuste?: KmAjusteMercado | null } | null; guia: { compra: number; venta: number; confianza: string; manual?: boolean; kmAjuste?: KmAjusteGuia | null } | null; fechaAnalisis: string;
};
type KmAjusteMercado = { kmObjetivo: number; kmAnuncios: number; anunciosConKm: number; porMilKm: number; origen: 'anuncios' | 'tipico'; medianaSinAjuste: number };
type KmAjusteGuia = { kmUsado: number; kmReferencia: number; porMilKm: number; ventaSinAjuste: number; compraSinAjuste: number };
/** Una lista de los menús del cotizador (marcas, modelos, años o versiones). */
type Lista = { items: string[]; cargando: boolean; error: boolean };
const SIN_LISTA: Lista = { items: [], cargando: false, error: false };
type Consulta = {
  id: string; fecha: string; marca: string; modelo: string; version: string; anio: number; km: number | null;
  guiaCompra: number | null; guiaVenta: number | null; guiaOrigen: 'autocosmos' | 'guardada' | 'manual' | null;
  porNombre?: string;
};

const dinero = (n: number | null | undefined) => (n || n === 0 ? '$' + Math.round(n).toLocaleString('es-MX') : '—');
const fechaCorta = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};
const ORIGEN_GUIA = { autocosmos: 'Autocosmos', guardada: 'Guía guardada', manual: 'Tu Libro Azul' } as const;
const CONF = {
  alta: { t: 'Confianza alta', c: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  media: { t: 'Confianza media', c: 'bg-sky-50 text-sky-700 border-sky-200' },
  baja: { t: 'Confianza baja', c: 'bg-amber-50 text-amber-700 border-amber-200' },
  ninguna: { t: 'Sin ventas parecidas', c: 'bg-slate-50 text-slate-600 border-slate-200' },
} as const;

async function llamar(ruta: string, metodo = 'GET', cuerpo?: unknown) {
  const token = await auth.currentUser?.getIdToken();
  const r = await fetch(getApiUrl(ruta), { method: metodo, headers: { Authorization: `Bearer ${token}`, ...(cuerpo ? { 'Content-Type': 'application/json' } : {}) }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'No se pudo completar.');
  return d;
}

const campo = 'h-10 w-full px-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm';


/**
 * El efecto del kilometraje, a la vista: una regla con los km normales del año contra los de este auto, y los tres
 * pasos hasta el «pagar como máximo» (lo que da la guía, lo que se quita o pone por los km, y el resultado).
 * La guía de arriba es la original; aquí se explica por qué el máximo no es igual a ella.
 */
export function PanelKilometraje({ d, mercado }: { d: NonNullable<Resultado['descuentoKm']>; mercado: KmAjusteMercado | null }) {
  const km = (n: number) => n.toLocaleString('es-MX');
  const masKm = d.kmUsado > d.kmReferencia;
  const diferencia = d.maxConKm - d.maxSinKm;
  const difKm = Math.abs(d.kmUsado - d.kmReferencia);
  const tope = Math.max(150_000, Math.ceil((Math.max(d.kmUsado, d.kmReferencia) * 1.25) / 10_000) * 10_000);
  const pos = (n: number) => Math.min(100, Math.max(0, (n / tope) * 100));
  const izq = Math.min(pos(d.kmUsado), pos(d.kmReferencia));
  const ancho = Math.abs(pos(d.kmUsado) - pos(d.kmReferencia));
  const sinEfecto = difKm < 2000 || diferencia === 0;
  const color = masKm ? 'bg-amber-400' : 'bg-emerald-500';
  return (
    <section aria-label="Cómo influye el kilometraje" className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 sm:p-5 space-y-4">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Cómo influye el kilometraje</p>
        <p className="text-sm text-slate-700 dark:text-slate-200 mt-1">
          {sinEfecto
            ? <>Este auto tiene {km(d.kmUsado)} km, parecido a lo normal para su año: <b>no cambia el máximo a pagar</b>.</>
            : <>Este auto tiene <b>{km(d.kmUsado)} km</b>, <b className={masKm ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}>{km(difKm)} km {masKm ? 'más' : 'menos'}</b> de lo normal para su año ({km(d.kmReferencia)} km). {masKm ? 'Por eso hay que pagar menos que lo que dice la guía.' : 'Por eso vale algo más que lo que dice la guía.'}</>}
        </p>
      </div>

      {/* La regla: de 0 km hacia la derecha, con lo normal y lo de este auto marcados. */}
      <div className="px-3 pt-6 pb-8">
        <div className="relative h-3 rounded-full bg-slate-200 dark:bg-slate-700">
          <div className={clsx('absolute top-0 h-3 rounded-full', color)} style={{ left: `${izq}%`, width: `${ancho}%` }} />
          <div className="absolute -top-6 -translate-x-1/2 text-center" style={{ left: `${pos(d.kmReferencia)}%` }}>
            <p className="text-[10px] font-semibold text-slate-500 whitespace-nowrap">Normal · {km(d.kmReferencia)}</p>
          </div>
          <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-5 w-5 rounded-full border-2 border-slate-400 bg-white dark:bg-slate-800" style={{ left: `${pos(d.kmReferencia)}%` }} />
          <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-5 w-5 rounded-full border-2 border-white dark:border-slate-800 bg-slate-900 dark:bg-white shadow" style={{ left: `${pos(d.kmUsado)}%` }} />
          <div className="absolute top-7 -translate-x-1/2 text-center" style={{ left: `${pos(d.kmUsado)}%` }}>
            <p className="text-[10px] font-bold text-slate-900 dark:text-white whitespace-nowrap">Este auto · {km(d.kmUsado)}</p>
          </div>
        </div>
        <div className="flex justify-between text-[10px] text-slate-400 mt-1"><span>0 km</span><span>{km(tope)} km</span></div>
      </div>

      {/* Los tres pasos. */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">1 · Tope según la guía</p>
          <p className="text-xl font-extrabold tabular-nums text-slate-900 dark:text-white mt-0.5">{dinero(d.maxSinKm)}</p>
          <p className="text-[11px] text-slate-500">para un auto con los km normales</p>
        </div>
        <div className={clsx('rounded-xl border p-3', sinEfecto ? 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700' : masKm ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800' : 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800')}>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">2 · Por el kilometraje</p>
          <p className="text-xl font-extrabold tabular-nums text-slate-900 dark:text-white mt-0.5">{sinEfecto ? '$0' : `${diferencia < 0 ? '−' : '+'}${dinero(Math.abs(diferencia))}`}</p>
          <p className="text-[11px] text-slate-500">{sinEfecto ? 'sin ajuste' : `tiene ${km(difKm)} km ${masKm ? 'de más' : 'de menos'}`}</p>
        </div>
        <div className="rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider opacity-75">3 · Pagar como máximo</p>
          <p className="text-xl font-extrabold tabular-nums mt-0.5">{dinero(d.maxConKm)}</p>
          <p className="text-[11px] opacity-75">con los km de este auto</p>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Cada 1,000 km de diferencia mueven el precio {d.porMilKm}%{' '}
        {d.medido ? `(medido en ${d.anunciosConKm} anuncios del mercado).` : '(regla de respaldo: no hubo suficientes anuncios con kilometraje para medirlo).'}
        {mercado ? ` Los anuncios del mercado también se llevaron a ${km(mercado.kmObjetivo)} km antes de sacar la mediana.` : ''}
      </p>
    </section>
  );
}

/** `soloCotizar`: la vista del vendedor. Solo la cotización: sin historial, sin margen y sin nada de lo que cuesta o deja cada auto. */
export function Recomendador({ soloCotizar = false }: { soloCotizar?: boolean }) {
  const { userData } = useAuth();
  const [f, setF] = useState({ marca: '', modelo: '', version: '', anio: '', km: '', precioOfrecido: '', guiaCompra: '', guiaVenta: '' });
  const [margen, setMargen] = useState('');
  const [guardado, setGuardado] = useState(false);
  const [r, setR] = useState<Resultado | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [historial, setHistorial] = useState<Consulta[]>([]);
  // Lo que la guía de Autocosmos puso sola en «Libro Azul». Mientras la persona no lo cambie, no cuenta como
  // un Libro Azul escrito a mano: se vuelve a consultar la guía (por ejemplo si cambia el kilometraje).
  const [autoRelleno, setAutoRelleno] = useState<{ compra: string; venta: string } | null>(null);

  // Menús en cascada: marca → modelo → año → versión. Salen de la guía de Autocosmos, para no escribir ni equivocarse.
  const [marcas, setMarcas] = useState<Lista>({ ...SIN_LISTA, cargando: true });
  const [modelos, setModelos] = useState<Lista>(SIN_LISTA);
  const [anios, setAnios] = useState<Lista>(SIN_LISTA);
  const [versiones, setVersiones] = useState<Lista>(SIN_LISTA);
  const cargarLista = (tipo: string, params: Record<string, string>, guardar: (l: Lista) => void, vigente: () => boolean) => {
    guardar({ items: [], cargando: true, error: false });
    llamar(`/api/precios/catalogo?${new URLSearchParams({ tipo, ...params })}`)
      .then((d) => { if (vigente()) guardar({ items: (d.items || []).map(String), cargando: false, error: false }); })
      .catch(() => { if (vigente()) guardar({ items: [], cargando: false, error: true }); });
  };
  useEffect(() => { let vivo = true; cargarLista('marcas', {}, setMarcas, () => vivo); return () => { vivo = false; }; }, []);
  useEffect(() => {
    let vivo = true;
    if (f.marca) cargarLista('modelos', { marca: f.marca }, setModelos, () => vivo); else setModelos(SIN_LISTA);
    return () => { vivo = false; };
  }, [f.marca]);
  useEffect(() => {
    let vivo = true;
    if (f.marca && f.modelo) cargarLista('anios', { marca: f.marca, modelo: f.modelo }, setAnios, () => vivo); else setAnios(SIN_LISTA);
    return () => { vivo = false; };
  }, [f.marca, f.modelo]);
  useEffect(() => {
    let vivo = true;
    if (f.marca && f.modelo && f.anio) cargarLista('versiones', { marca: f.marca, modelo: f.modelo, anio: f.anio }, setVersiones, () => vivo); else setVersiones(SIN_LISTA);
    return () => { vivo = false; };
  }, [f.marca, f.modelo, f.anio]);
  // Si el catálogo no contesta, el formulario sigue con cuadros de texto para no dejar a nadie sin cotizar.
  const aMano = marcas.error;

  const borrarConsulta = async (id: string) => {
    const previo = historial;
    setHistorial((h) => h.filter((c) => c.id !== id));
    try { await llamar(`/api/precios/consultas/${encodeURIComponent(id)}`, 'DELETE'); }
    catch (e: any) { setHistorial(previo); setError(e?.message || 'No se pudo borrar la consulta.'); }
  };
  const vaciarHistorial = async () => {
    if (!window.confirm(`¿Borrar las ${historial.length} consultas del historial? Esto no se puede deshacer.`)) return;
    const previo = historial;
    setHistorial([]);
    try { await llamar('/api/precios/consultas/todas', 'DELETE'); }
    catch (e: any) { setHistorial(previo); setError(e?.message || 'No se pudo vaciar el historial.'); }
  };
  // En el teléfono el resultado queda debajo del formulario, fuera de pantalla: al llegar, se baja hasta él.
  useEffect(() => { if (r) document.getElementById('resultado-cotizacion')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, [r]);
  const cargarHistorial = () => { llamar('/api/precios/consultas').then((d) => setHistorial(d.consultas || [])).catch(() => {}); };
  useEffect(() => { if (soloCotizar) return; llamar('/api/precios/config').then((d) => setMargen(String(d.margenObjetivoPct))).catch(() => {}); cargarHistorial(); }, [soloCotizar]);
  const poner = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const valor = e.target.value;
    setF((x) => {
      const cambiaElAuto = ['marca', 'modelo', 'version', 'anio', 'km'].includes(k);
      // Si cambia el auto, los precios que la guía había llenado sola ya no le corresponden.
      if (cambiaElAuto && autoRelleno && x.guiaCompra === autoRelleno.compra && x.guiaVenta === autoRelleno.venta) {
        return { ...x, [k]: valor, guiaCompra: '', guiaVenta: '' };
      }
      return { ...x, [k]: valor };
    });
    if (['marca', 'modelo', 'version', 'anio', 'km'].includes(k)) setAutoRelleno((a) => (a && f.guiaCompra === a.compra && f.guiaVenta === a.venta ? null : a));
  };

  /** Elegir en un menú: lo que depende de él se vacía (otra marca → otros modelos, otros años, otras versiones). */
  const elegir = (k: 'marca' | 'modelo' | 'anio' | 'version', valor: string) => {
    const dependientes: Record<string, ('modelo' | 'anio' | 'version')[]> = { marca: ['modelo', 'anio', 'version'], modelo: ['anio', 'version'], anio: ['version'], version: [] };
    setF((x) => {
      const nuevo = { ...x, [k]: valor };
      dependientes[k].forEach((d) => { nuevo[d] = ''; });
      if (autoRelleno && x.guiaCompra === autoRelleno.compra && x.guiaVenta === autoRelleno.venta) { nuevo.guiaCompra = ''; nuevo.guiaVenta = ''; }
      return nuevo;
    });
    setAutoRelleno((a) => (a && f.guiaCompra === a.compra && f.guiaVenta === a.venta ? null : a));
  };
  /** Kilometraje con comas mientras se escribe: 81300 → 81,300. */
  const ponerKm = (e: React.ChangeEvent<HTMLInputElement>) => {
    const solo = e.target.value.replace(/[^\d]/g, '').slice(0, 7);
    poner('km')({ target: { value: solo ? Number(solo).toLocaleString('es-MX') : '' } } as React.ChangeEvent<HTMLInputElement>);
  };

  const consultar = async (e: React.FormEvent) => {
    e.preventDefault();
    setCargando(true); setError(''); setR(null);
    try {
      const compraEscrita = autoRelleno && f.guiaCompra === autoRelleno.compra ? '' : f.guiaCompra;
      const ventaEscrita = autoRelleno && f.guiaVenta === autoRelleno.venta ? '' : f.guiaVenta;
      const res: Resultado = await llamar('/api/precios/recomendar', 'POST', {
        marca: f.marca, modelo: f.modelo, version: f.version, anio: Number(f.anio), km: f.km === '' ? null : Number(f.km.replace(/,/g, '')),
        precioOfrecido: f.precioOfrecido ? Number(f.precioOfrecido.replace(/[$,]/g, '')) : null,
        guiaCompra: compraEscrita ? Number(compraEscrita.replace(/[$,]/g, '')) : null,
        guiaVenta: ventaEscrita ? Number(ventaEscrita.replace(/[$,]/g, '')) : null,
      });
      setR(res);
      // Si la guía contestó, llena sola los dos precios del Libro Azul para que se vean ahí.
      if (res.guia && !res.guia.manual) {
        const compra = dinero(res.guia.compra), venta = dinero(res.guia.venta);
        setF((x) => ({ ...x, guiaCompra: compra, guiaVenta: venta }));
        setAutoRelleno({ compra, venta });
      }
      cargarHistorial();
    } catch (er: any) { setError(er.message); } finally { setCargando(false); }
  };

  /** Vuelve a cargar en el formulario un auto del historial. */
  const usarConsulta = (c: Consulta) => {
    setF({ marca: c.marca, modelo: c.modelo, version: c.version || '', anio: String(c.anio), km: c.km ? String(c.km) : '', precioOfrecido: '', guiaCompra: '', guiaVenta: '' });
    setAutoRelleno(null); setR(null);
    document.getElementById('cotizador')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const guardarMargen = async () => {
    try { await llamar('/api/precios/config', 'PUT', { margenObjetivoPct: Number(margen) }); setGuardado(true); setTimeout(() => setGuardado(false), 2000); } catch (er: any) { setError(er.message); }
  };

  const grande = (titulo: string, valor: string, sub?: string, fuente?: string) => (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{titulo}</p>
      <p className="text-2xl font-extrabold tracking-tight mt-1 text-slate-900 dark:text-white">{valor}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
      {fuente && <p className="text-[10px] text-slate-400 mt-1">{fuente}</p>}
    </div>
  );
  const selector = (etiqueta: string, valor: string, alCambiar: (v: string) => void, lista: Lista, o: { vacio: string; deshabilitado?: boolean; requerido?: boolean }) => (
    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 min-w-0">{etiqueta}
      <select required={o.requerido} value={valor} onChange={(e) => alCambiar(e.target.value)} disabled={o.deshabilitado || lista.cargando} className={clsx(campo, 'disabled:opacity-60 truncate')}>
        <option value="">{lista.cargando ? 'Cargando…' : o.vacio}</option>
        {valor && !lista.items.includes(valor) && <option value={valor}>{valor}</option>}
        {lista.items.map((x) => <option key={x} value={x}>{x}</option>)}
      </select>
    </label>
  );
  // De dónde salen los días, en una línea chica.
  const fuenteDias = (b?: Resultado['diasBase']) => {
    if (!b) return undefined;
    if (b.ventasPropias && b.anunciosMercado) return `Tus ${b.ventasPropias} ventas y ${b.anunciosMercado} anuncios de Mercado Libre`;
    if (b.anunciosMercado) return `${b.anunciosMercado} anuncios de Mercado Libre`;
    if (b.ventasPropias) return `Tus ${b.ventasPropias} ventas de este modelo`;
    if (b.tipicaAgencia) return 'Ventas típicas de tu agencia';
    return undefined;
  };

  return (
    <div className="space-y-4">
      <form id="cotizador" onSubmit={consultar} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {aMano ? (
            <>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Marca<input required value={f.marca} onChange={poner('marca')} placeholder="Nissan" className={campo} /></label>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Modelo<input required value={f.modelo} onChange={poner('modelo')} placeholder="Sentra" className={campo} /></label>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Año<input required inputMode="numeric" value={f.anio} onChange={poner('anio')} placeholder="2020" className={campo} /></label>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Versión (opcional)<input value={f.version} onChange={poner('version')} placeholder="Advance" className={campo} /></label>
            </>
          ) : (
            <>
              <BuscadorLista etiqueta="Marca" valor={f.marca} items={marcas.items} alElegir={(v) => elegir('marca', v)} campo={campo} cargando={marcas.cargando} requerido vacio="Escribe para buscar" />
              <BuscadorLista etiqueta="Modelo" valor={f.modelo} items={modelos.items} alElegir={(v) => elegir('modelo', v)} campo={campo} cargando={modelos.cargando} deshabilitado={!f.marca} requerido vacio={f.marca ? 'Escribe para buscar' : 'Primero la marca'} />
              {selector('Año', f.anio, (v) => elegir('anio', v), anios, { vacio: f.modelo ? 'Elige el año' : 'Primero el modelo', deshabilitado: !f.modelo, requerido: true })}
              {selector('Versión (opcional)', f.version, (v) => elegir('version', v), versiones, { vacio: !f.anio ? 'Primero el año' : versiones.items.length ? 'No sé / cualquiera' : 'Sin versiones en la guía', deshabilitado: !f.anio })}
            </>
          )}
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Kilometraje<input required inputMode="numeric" value={f.km} onChange={ponerKm} placeholder="68,000" className={campo} /></label>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Piden (opcional)<input inputMode="numeric" value={f.precioOfrecido} onChange={poner('precioOfrecido')} placeholder="$215,000" className={campo} /></label>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 md:col-span-2">Libro Azul: compra (opcional)<input inputMode="numeric" value={f.guiaCompra} onChange={poner('guiaCompra')} placeholder="$181,000" className={campo} /></label>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 md:col-span-2">Libro Azul: venta (opcional)<input inputMode="numeric" value={f.guiaVenta} onChange={poner('guiaVenta')} placeholder="$207,000" className={campo} /></label>
          <p className="text-xs text-slate-500 md:col-span-2 self-end">
            {autoRelleno && f.guiaCompra === autoRelleno.compra && f.guiaVenta === autoRelleno.venta
              ? 'Los llenó la guía de Autocosmos. Si escribes otros, mandan los tuyos (por ejemplo, de tu Libro Azul).'
              : 'Si los escribes, mandan sobre la guía automática. Con uno solo se calcula el otro. Si los dejas vacíos, se llenan solos con la guía.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button disabled={cargando} className="h-11 sm:h-10 w-full sm:w-auto justify-center px-4 rounded-lg bg-slate-900 dark:bg-white dark:text-slate-900 text-white text-sm font-bold disabled:opacity-50 flex items-center gap-2">
            {cargando && <Loader2 className="w-4 h-4 animate-spin" />} {cargando ? 'Buscando… (puede tardar 15 segundos)' : 'Recomendar precios'}
          </button>
          {!soloCotizar && <div className="ml-auto flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            Margen de referencia
            <input value={margen} onChange={(e) => { setMargen(e.target.value); setGuardado(false); }} disabled={userData?.role !== 'admin'} inputMode="decimal" className="h-9 w-16 px-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-center" /> %
            {userData?.role === 'admin' && <button type="button" onClick={guardarMargen} className="h-9 px-3 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-semibold hover:bg-slate-50">{guardado ? 'Guardado' : 'Guardar'}</button>}
          </div>}
        </div>
        <p className="text-xs text-slate-500">{soloCotizar ? 'El precio lo manda el mercado (esperado = mediana; peor caso = cerca del mínimo).' : 'El precio lo manda el mercado (esperado = mediana; peor caso = cerca del mínimo). El margen de referencia solo avisa si comprar al máximo deja menos ganancia que ese porcentaje.'}</p>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {r && (
        <>
          <div id="resultado-cotizacion" className="scroll-mt-4" />
          {r.guia && (
            <section aria-label="Precios de la guía" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {([
                { t: 'Guía · Compra', v: r.guia.kmAjuste ? r.guia.kmAjuste.compraSinAjuste : r.guia.compra, s: 'lo que paga la agencia' },
                { t: 'Guía · Venta', v: r.guia.kmAjuste ? r.guia.kmAjuste.ventaSinAjuste : r.guia.venta, s: 'lo que paga el cliente' },
              ] as const).map((p) => (
                <div key={p.t} className="rounded-2xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 px-5 py-5 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] opacity-80">{p.t}</p>
                  <p className="text-4xl sm:text-5xl font-extrabold tracking-tight tabular-nums mt-1">{dinero(p.v)}</p>
                  <p className="text-xs opacity-75 mt-2">
                    {p.s} · {r.estadoGuia?.estado === 'manual' ? 'tu Libro Azul' : r.estadoGuia?.estado === 'guardada' ? 'guía guardada' : 'Autocosmos'}
                    {' · '}{r.guia.kmAjuste ? `a ${r.guia.kmAjuste.kmReferencia.toLocaleString('es-MX')} km (lo normal para su año)` : r.consulta?.km ? `${r.consulta.km.toLocaleString('es-MX')} km` : 'km estimado'}
                  </p>
                </div>
              ))}
            </section>
          )}
          {r.descuentoKm && <PanelKilometraje d={r.descuentoKm} mercado={r.mercado?.kmAjuste || null} />}
          <div className="flex flex-wrap items-center gap-2">
            <span className={clsx('inline-flex rounded-full border px-2.5 py-1 text-xs font-bold', CONF[r.confianza].c)}>{CONF[r.confianza].t} · {r.comparables} {r.comparables === 1 ? 'venta parecida' : 'ventas parecidas'}</span>
            {r.mercado && <span className="text-xs text-slate-500">Mercado: {r.mercado.n} anuncios, mediana {dinero(r.mercado.mediana)}{r.mercado.kmAjuste ? ` (ajustada a ${r.mercado.kmAjuste.kmObjetivo.toLocaleString('es-MX')} km; sin ajustar ${dinero(r.mercado.kmAjuste.medianaSinAjuste)})` : ''}</span>}
            {r.guia && <span className="text-xs text-slate-500">· Guía: compra {dinero(r.guia.compra)} / venta {dinero(r.guia.venta)}</span>}
          </div>
          {r.estadoGuia?.estado === 'no-disponible' && (
            <div className="rounded-xl border border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-800 p-4 text-sm text-red-900 dark:text-red-200 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <div><b>No se pudo consultar la guía.</b> {r.estadoGuia.motivo} El «pagar como máximo» de abajo <b>no es confiable</b>: sale solo de anuncios del mercado. Escribe tu Libro Azul arriba y vuelve a consultar, o intenta más tarde.</div>
            </div>
          )}
          {r.estadoGuia?.estado === 'guardada' && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-3 text-sm text-amber-900 dark:text-amber-200">{r.estadoGuia.motivo}</div>
          )}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {grande('Se vendería en (esperado)', dinero(r.precioVentaEsperado), r.origenPrecioVenta === 'mercado' ? 'mediana del precio comercial' : r.origenPrecioVenta === 'ventas-propias' ? 'mediana de tus ventas' : r.origenPrecioVenta === 'guia' ? 'guía de venta' : '')}
            {grande('Peor caso', dinero(r.precioVentaPesimista), 'si no es muy comercial')}
            {grande('Pagar como máximo', dinero(r.maxCompraRecomendado), r.descuentoKm && r.descuentoKm.maxSinKm !== r.descuentoKm.maxConKm ? `${dinero(r.descuentoKm.maxSinKm)} de la guía ${r.descuentoKm.maxConKm < r.descuentoKm.maxSinKm ? 'menos' : 'más'} ${dinero(Math.abs(r.descuentoKm.maxSinKm - r.descuentoKm.maxConKm))} por kilometraje` : r.maxCompraPorGuia !== null ? 'tope de la guía' : 'sin guía: sale del peor caso')}
            {grande('Se vendería en', r.diasEstimados === null ? '—' : `${r.diasEstimados} días`, r.diasRango ? `normalmente entre ${r.diasRango[0]} y ${r.diasRango[1]}` : undefined, fuenteDias(r.diasBase))}
          </div>
          {r.utilidadEsperada != null && r.utilidadPesimista != null && (
            <p className="text-sm text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3">
              Comprando al máximo: <b>{dinero(r.utilidadEsperada)}</b> de ganancia ({r.margenEsperadoPct}%) si se vende al esperado, y <b className={r.utilidadPesimista < 0 ? 'text-red-600' : ''}>{r.utilidadPesimista < 0 ? `pérdida de ${dinero(-r.utilidadPesimista)}` : dinero(r.utilidadPesimista)}</b> ({r.margenPesimistaPct}%) en el peor caso. <span className="text-slate-400">Es informativo: el precio lo manda el mercado.</span>
            </p>
          )}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Conclusiones</p>
            <ul className="space-y-1.5 text-sm text-slate-700 dark:text-slate-300 list-disc pl-5">{r.insights.map((t, i) => <li key={i}>{t}</li>)}</ul>
          </div>
          {r.advertencias.length > 0 && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-4 text-sm text-amber-900 dark:text-amber-200">
              <p className="font-bold flex items-center gap-2 mb-1"><AlertTriangle className="w-4 h-4" /> Ten en cuenta</p>
              <ul className="list-disc pl-5 space-y-1">{r.advertencias.map((t, i) => <li key={i}>{t}</li>)}</ul>
            </div>
          )}
          {(r.comparablesUsados || []).length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto">
              <p className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 dark:border-slate-700">Ventas parecidas que se usaron</p>
              <table className="w-full text-sm min-w-[640px]">
                <tbody>
                  {r.comparablesUsados.map((c) => (
                    <tr key={c.vehicleId} className="border-t first:border-t-0 border-slate-100 dark:border-slate-700">
                      <td className="px-4 py-2 font-medium">{c.titulo}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-500">{c.km ? `${c.km.toLocaleString('es-MX')} km` : '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums">compra {dinero(c.precioCompra)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">venta {dinero(c.precioVenta)}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold text-emerald-700">{dinero(c.utilidad)}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-slate-500">{c.diasEnInventario ?? '—'} días</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {!soloCotizar && (
      <section aria-labelledby="historial-consultas" className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-baseline justify-between gap-2">
          <h3 id="historial-consultas" className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Historial de consultas</h3>
          <span className="text-xs text-slate-500 flex items-center gap-3">
            Las últimas {historial.length ? historial.length : 100} de tu agencia
            {historial.length > 0 && <button type="button" onClick={vaciarHistorial} className="font-semibold text-red-600 hover:underline">Borrar todas</button>}
          </span>
        </div>
        {historial.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">Todavía no hay consultas. Cada vez que recomiendes precios, el auto, el kilometraje y los precios de la guía quedan aquí.</p>
        ) : (
          <>
          <ul className="md:hidden divide-y divide-slate-100 dark:divide-slate-700">
            {historial.map((c) => (
              <li key={c.id} className="px-4 py-3 space-y-2">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-semibold text-sm">{c.marca} {c.modelo}{c.version ? ` ${c.version}` : ''} <span className="text-slate-500 font-normal">{c.anio}</span></p>
                  <span className="text-xs text-slate-500 whitespace-nowrap">{fechaCorta(c.fecha)}</span>
                </div>
                <p className="text-xs text-slate-500">
                  {c.km ? `${c.km.toLocaleString('es-MX')} km` : 'km no indicado'}{c.porNombre ? ` · Consultó ${c.porNombre}` : ''}
                  {c.guiaOrigen && c.guiaOrigen !== 'autocosmos' ? ` · ${ORIGEN_GUIA[c.guiaOrigen]}` : ''}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Guía compra</p><p className="font-extrabold tabular-nums">{dinero(c.guiaCompra)}</p></div>
                  <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Guía venta</p><p className="font-extrabold tabular-nums">{dinero(c.guiaVenta)}</p></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => usarConsulta(c)} className="h-10 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-semibold">Consultar otra vez</button>
                  <button type="button" onClick={() => borrarConsulta(c.id)} aria-label={`Borrar la consulta de ${c.marca} ${c.modelo}`} className="h-10 rounded-lg border border-red-200 text-red-600 text-sm font-semibold dark:border-red-900">Borrar</button>
                </div>
              </li>
            ))}
          </ul>
          <table className="hidden md:table w-full text-sm min-w-[680px]">
            <thead>
              <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="px-4 py-2 font-bold">Fecha</th>
                <th className="px-3 py-2 font-bold">Auto</th>
                <th className="px-3 py-2 font-bold">Consultó</th>
                <th className="px-3 py-2 font-bold text-right">Km</th>
                <th className="px-3 py-2 font-bold text-right">Guía compra</th>
                <th className="px-3 py-2 font-bold text-right">Guía venta</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {historial.map((c) => (
                <tr key={c.id} className="border-t border-slate-100 dark:border-slate-700">
                  <td className="px-4 py-2 whitespace-nowrap text-slate-500">{fechaCorta(c.fecha)}</td>
                  <td className="px-3 py-2 font-medium">
                    {c.marca} {c.modelo}{c.version ? ` ${c.version}` : ''} <span className="text-slate-500 font-normal">{c.anio}</span>
                    {c.guiaOrigen && c.guiaOrigen !== 'autocosmos' && <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">{ORIGEN_GUIA[c.guiaOrigen]}</span>}
                  </td>
                  <td className="px-3 py-2 text-slate-600 dark:text-slate-300 whitespace-nowrap">{c.porNombre || '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-500">{c.km ? c.km.toLocaleString('es-MX') : '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-extrabold">{dinero(c.guiaCompra)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-extrabold">{dinero(c.guiaVenta)}</td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button type="button" onClick={() => usarConsulta(c)} className="h-8 px-3 rounded-lg border border-slate-300 dark:border-slate-600 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-700">Consultar otra vez</button>
                      <button type="button" onClick={() => borrarConsulta(c.id)} aria-label={`Borrar la consulta de ${c.marca} ${c.modelo}`} title="Borrar esta consulta" className="h-8 px-3 rounded-lg border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950">Borrar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </>
        )}
      </section>
      )}
    </div>
  );
}
