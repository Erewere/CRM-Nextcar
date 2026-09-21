import { checkIsWon, checkIsLost } from "./clientUtils";
import { fuenteDelContacto, etiquetaDeFuente, SIN_DATO, FUENTES } from "./fuentes";

/**
 * Los numeros del negocio de una agencia, para el tablero del administrador.
 *
 * Calculo puro: recibe documentos ya leidos y devuelve numeros. Sin Firestore
 * aqui dentro, para poder probarlo con datos inventados.
 *
 * De donde sale cada cosa, medido en la base en septiembre de 2026:
 * - UNA VENTA es un auto con estado vendido. Ahi el 100% trae fecha y precio;
 *   el precio en el trato (saleDetails.price) solo esta en el 10%.
 * - El tipo de auto (bodyType) esta en el 100%, escrito de varias formas
 *   («Sedán», «SEDAN»): se unifica aqui.
 * - El costo vive aparte (vehicleFinancials) y solo lo ve quien puede ver
 *   costos; esta en la mitad de los autos, asi que el margen dice sobre
 *   cuantos se calcula.
 * - Los contactos importados de Google o Excel no son prospectos que
 *   llegaron: son una libreta que se subio de golpe (hay 999 de Google).
 */

const DIA = 86_400_000;

export const RANGOS_DE_PRECIO = [
  { id: "r1", etiqueta: "Menos de $200 mil", min: 0, max: 200_000 },
  { id: "r2", etiqueta: "$200 – $300 mil", min: 200_000, max: 300_000 },
  { id: "r3", etiqueta: "$300 – $400 mil", min: 300_000, max: 400_000 },
  { id: "r4", etiqueta: "$400 – $500 mil", min: 400_000, max: 500_000 },
  { id: "r5", etiqueta: "Más de $500 mil", min: 500_000, max: Infinity },
];

export const RANGOS_DE_ANTIGUEDAD = [
  { id: "a1", etiqueta: "0 a 30 días", min: 0, max: 31 },
  { id: "a2", etiqueta: "31 a 60 días", min: 31, max: 61 },
  { id: "a3", etiqueta: "61 a 90 días", min: 61, max: 91 },
  { id: "a4", etiqueta: "Más de 90 días", min: 91, max: Infinity },
];

const ORIGENES_IMPORTADOS = new Set(["google_contacts", "excel_import"]);

export function aMs(v: any): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const t = Date.parse(v);
    return Number.isNaN(t) ? null : t;
  }
  if (v instanceof Date) return v.getTime();
  if (typeof v.toMillis === "function") return v.toMillis();
  if (typeof v.seconds === "number") return v.seconds * 1000;
  if (typeof v._seconds === "number") return v._seconds * 1000;
  return null;
}

const sinAcentos = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** «SEDAN», «sedan» y «Sedán» son lo mismo. */
export function normalizarTipo(bodyType: unknown): string {
  const t = sinAcentos(String(bodyType || ""));
  if (!t) return "Sin tipo";
  if (t.includes("sedan")) return "Sedán";
  if (t === "suv" || t.includes("suv") || t.includes("camioneta")) return "SUV";
  if (t.includes("hatch") || t === "hb") return "Hatchback";
  if (t.includes("pick")) return "Pickup";
  if (t.includes("minivan")) return "Minivan";
  if (t === "van" || t.includes("van")) return "Van";
  if (t.includes("4x4")) return "4x4";
  if (t.includes("coup")) return "Coupé";
  if (t.includes("convert")) return "Convertible";
  const s = String(bodyType).trim();
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

const estaVendido = (v: any) => ["sold", "vendido", "vendidos"].includes(sinAcentos(String(v.status || "")));
const nombreDelAuto = (v: any) => [v.make, v.model, v.year].filter(Boolean).join(" ") || "Auto sin nombre";
const precioDe = (v: any) => Number(v?.saleDetails?.price) || Number(v?.price) || 0;
const mediana = (xs: number[]) => {
  if (xs.length === 0) return null;
  const o = [...xs].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : Math.round((o[m - 1] + o[m]) / 2);
};
const enRango = <T extends { min: number; max: number }>(rangos: T[], x: number) =>
  rangos.find((r) => x >= r.min && x < r.max) || rangos[rangos.length - 1];

function rangoDeAnio(anio: number, actual: number): string {
  if (!anio) return "Sin año";
  const edad = actual - anio;
  if (edad <= 2) return `${actual - 2} o más nuevo`;
  if (edad <= 5) return `${actual - 5} a ${actual - 3}`;
  if (edad <= 10) return `${actual - 10} a ${actual - 6}`;
  return `${actual - 11} o más viejo`;
}

/** Mes en hora de Mexico (UTC-6, sin horario de verano desde 2022). */
function claveDeMes(ms: number): string {
  const d = new Date(ms - 6 * 3_600_000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function ultimos12Meses(ahora: number): { clave: string; etiqueta: string }[] {
  const d = new Date(ahora - 6 * 3_600_000);
  const meses: { clave: string; etiqueta: string }[] = [];
  for (let i = 11; i >= 0; i--) {
    const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1));
    const clave = `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, "0")}`;
    const etiqueta = x.toLocaleDateString("es-MX", { month: "short", year: "2-digit", timeZone: "UTC" });
    meses.push({ clave, etiqueta });
  }
  return meses;
}

export interface EntradaAnalitica {
  ahora: number;
  desde: number;
  hasta: number;
  vehiculos: any[];
  /** vehicleId -> costo de compra. Vacio si quien mira no puede ver costos. */
  costos: Record<string, number>;
  verCostos: boolean;
  clientes: any[];
  tratos: any[];
  usuarios: any[];
  etapas: { id: string; title?: string }[];
}

export function calcularAnalitica(e: EntradaAnalitica) {
  const { ahora, desde, hasta } = e;
  const largo = Math.max(DIA, hasta - desde);
  const antesDesde = desde - largo;
  const enPeriodo = (ms: number | null) => ms != null && ms >= desde && ms < hasta;
  const enAnterior = (ms: number | null) => ms != null && ms >= antesDesde && ms < desde;
  const anioActual = new Date(ahora).getFullYear();

  // ---------- Ventas: autos vendidos ----------
  const vendidos = e.vehiculos
    .filter(estaVendido)
    .map((v) => {
      const vendidoEl = aMs(v.soldAt) ?? aMs(v.updatedAt);
      const llego = aMs(v.receivedAt) ?? aMs(v.createdAt);
      const precio = precioDe(v);
      const costo = e.verCostos ? e.costos[v.id] || 0 : 0;
      return {
        id: v.id as string,
        auto: nombreDelAuto(v),
        tipo: normalizarTipo(v.bodyType),
        marca: String(v.make || "Sin marca").trim(),
        anio: Number(v.year) || 0,
        transmision: String(v.transmission || ""),
        precio,
        vendidoEl,
        dias: vendidoEl != null && llego != null ? Math.max(0, Math.round((vendidoEl - llego) / DIA)) : null,
        costo: costo > 0 ? costo : null,
        margen: costo > 0 ? precio - costo : null,
        compradorId: (v.soldToClientId || v.buyerId || null) as string | null,
      };
    });

  const ventas = vendidos.filter((v) => enPeriodo(v.vendidoEl)).sort((a, b) => (b.vendidoEl || 0) - (a.vendidoEl || 0));
  const ventasAntes = vendidos.filter((v) => enAnterior(v.vendidoEl));
  const suma = (xs: { precio: number }[]) => xs.reduce((s, x) => s + x.precio, 0);

  const agrupar = <K extends string>(xs: typeof ventas, clave: (v: (typeof ventas)[number]) => K) => {
    const m = new Map<K, typeof ventas>();
    for (const v of xs) {
      const k = clave(v);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(v);
    }
    return m;
  };

  const porTipo = [...agrupar(ventas, (v) => v.tipo)].map(([tipo, xs]) => ({
    tipo,
    unidades: xs.length,
    monto: suma(xs),
    ticket: Math.round(suma(xs) / xs.length),
    diasMediana: mediana(xs.map((x) => x.dias).filter((d): d is number => d != null)),
  })).sort((a, b) => b.unidades - a.unidades || b.monto - a.monto);

  const porMarca = [...agrupar(ventas, (v) => v.marca)].map(([marca, xs]) => ({
    marca, unidades: xs.length, monto: suma(xs),
  })).sort((a, b) => b.unidades - a.unidades || b.monto - a.monto);

  const porRango = RANGOS_DE_PRECIO.map((r) => {
    const xs = ventas.filter((v) => enRango(RANGOS_DE_PRECIO, v.precio).id === r.id);
    return { rango: r.id, etiqueta: r.etiqueta, unidades: xs.length, monto: suma(xs) };
  });

  const porAnio = [...agrupar(ventas, (v) => rangoDeAnio(v.anio, anioActual))].map(([rango, xs]) => ({
    rango, unidades: xs.length, monto: suma(xs),
  })).sort((a, b) => b.rango.localeCompare(a.rango));

  const meses = ultimos12Meses(ahora);
  const porMes = meses.map((m) => {
    const xs = vendidos.filter((v) => v.vendidoEl != null && claveDeMes(v.vendidoEl) === m.clave);
    return { mes: m.clave, etiqueta: m.etiqueta, unidades: xs.length, monto: suma(xs) };
  });

  const conCosto = ventas.filter((v) => v.margen != null);

  // ---------- Inventario: lo que no se ha vendido ----------
  const inventario = e.vehiculos
    .filter((v) => !estaVendido(v))
    .map((v) => {
      const llego = aMs(v.receivedAt) ?? aMs(v.createdAt);
      const own = sinAcentos(String(v.ownership || ""));
      return {
        id: v.id as string,
        auto: nombreDelAuto(v),
        tipo: normalizarTipo(v.bodyType),
        marca: String(v.make || "Sin marca").trim(),
        anio: Number(v.year) || 0,
        precio: Number(v.price) || 0,
        dias: llego != null ? Math.max(0, Math.round((ahora - llego) / DIA)) : null,
        propiedad: own.startsWith("consig") ? "Consignación" : own === "propio" ? "Propio" : "Sin dato",
        apartado: sinAcentos(String(v.status || "")).startsWith("reserv") || sinAcentos(String(v.status || "")).startsWith("apart"),
        costo: e.verCostos ? e.costos[v.id] || null : null,
      };
    })
    .sort((a, b) => (b.dias ?? -1) - (a.dias ?? -1));

  const invPorTipo = [...new Set(inventario.map((v) => v.tipo))].map((tipo) => {
    const xs = inventario.filter((v) => v.tipo === tipo);
    return { tipo, unidades: xs.length, valor: xs.reduce((s, x) => s + x.precio, 0) };
  }).sort((a, b) => b.unidades - a.unidades);

  const antiguedad = RANGOS_DE_ANTIGUEDAD.map((r) => {
    const xs = inventario.filter((v) => v.dias != null && v.dias >= r.min && v.dias < r.max);
    return { rango: r.id, etiqueta: r.etiqueta, unidades: xs.length, valor: xs.reduce((s, x) => s + x.precio, 0) };
  });

  const propiedad = ["Propio", "Consignación", "Sin dato"].map((p) => ({
    etiqueta: p, unidades: inventario.filter((v) => v.propiedad === p).length,
  }));

  // Lo que vendo contra lo que tengo. Las ventas son de los ultimos 12 meses,
  // no del periodo: un mes suelto trae dos o tres ventas y no dice nada.
  const hace12 = ahora - 365 * DIA;
  const vendidos12 = vendidos.filter((v) => v.vendidoEl != null && v.vendidoEl >= hace12);
  const tipos = [...new Set([...vendidos12.map((v) => v.tipo), ...inventario.map((v) => v.tipo)])];
  const mezcla = tipos.map((tipo) => {
    const pv = vendidos12.length ? vendidos12.filter((v) => v.tipo === tipo).length / vendidos12.length : 0;
    const pi = inventario.length ? inventario.filter((v) => v.tipo === tipo).length / inventario.length : 0;
    return {
      tipo,
      pctVentas: Math.round(pv * 100),
      pctInventario: Math.round(pi * 100),
      diferencia: Math.round((pv - pi) * 100),
    };
  }).sort((a, b) => b.diferencia - a.diferencia);

  // ---------- Clientes ----------
  const vivos = e.clientes.filter((c) => !c.isDeleted);
  const llegaron = vivos.filter((c) => !ORIGENES_IMPORTADOS.has(String(c.origin || "")));
  const nuevos = llegaron.filter((c) => enPeriodo(aMs(c.createdAt)));
  const nuevosAntes = llegaron.filter((c) => enAnterior(aMs(c.createdAt)));

  const compradores = new Set<string>();
  for (const v of vendidos) if (v.compradorId) compradores.add(v.compradorId);
  for (const t of e.tratos) {
    if (!t.isDeleted && t.clientId && checkIsWon(t.status, e.etapas)) compradores.add(t.clientId);
  }

  const porFuente = [...FUENTES.map((f) => f.id as string), SIN_DATO].map((fuente) => {
    const xs = nuevos.filter((c) => fuenteDelContacto(c) === fuente);
    const compraron = xs.filter((c) => compradores.has(c.id)).length;
    return {
      fuente,
      etiqueta: etiquetaDeFuente(fuente),
      prospectos: xs.length,
      compraron,
      conversion: xs.length ? Math.round((compraron / xs.length) * 100) : 0,
    };
  }).filter((f) => f.prospectos > 0).sort((a, b) => b.prospectos - a.prospectos);

  const clientesPorMes = meses.map((m) => ({
    mes: m.clave,
    etiqueta: m.etiqueta,
    prospectos: llegaron.filter((c) => {
      const t = aMs(c.createdAt);
      return t != null && claveDeMes(t) === m.clave;
    }).length,
  }));

  // Lo que buscan los que siguen en proceso: lo que antes hacia Inteligencia.
  const buscando = vivos.filter((c) => {
    const w = c.wantedVehicle;
    return w && (w.bodyType || w.priceMax || w.make) && !compradores.has(c.id);
  });
  const demandaPorTipo = [...new Set(buscando.map((c) => normalizarTipo(c.wantedVehicle.bodyType)))]
    .filter((t) => t !== "Sin tipo")
    .map((tipo) => ({ tipo, clientes: buscando.filter((c) => normalizarTipo(c.wantedVehicle.bodyType) === tipo).length }))
    .sort((a, b) => b.clientes - a.clientes);
  const demandaPorPresupuesto = RANGOS_DE_PRECIO.map((r) => ({
    rango: r.id,
    etiqueta: r.etiqueta,
    clientes: buscando.filter((c) => {
      const p = Number(c.wantedVehicle.priceMax) || 0;
      return p > 0 && enRango(RANGOS_DE_PRECIO, p).id === r.id;
    }).length,
  }));
  const demandaPorMarca = [...new Set(buscando.map((c) => String(c.wantedVehicle.make || "").trim()).filter(Boolean))]
    .map((marca) => ({ marca, clientes: buscando.filter((c) => String(c.wantedVehicle.make || "").trim() === marca).length }))
    .sort((a, b) => b.clientes - a.clientes)
    .slice(0, 8);

  // ---------- Equipo ----------
  const vehiculoPorId = new Map(e.vehiculos.map((v) => [v.id, v]));
  const equipo = e.usuarios
    .filter((u) => u.role === "seller" || u.role === "admin" || u.role === "manager")
    .map((u) => {
      const suyos = e.tratos.filter((t) => !t.isDeleted && t.sellerId === u.id);
      const ganados = suyos.filter((t) => {
        if (!checkIsWon(t.status, e.etapas)) return false;
        return enPeriodo(aMs(t.soldAt) ?? aMs(t.updatedAt));
      });
      const monto = ganados.reduce((s, t) => {
        const v = t.vehicleId ? vehiculoPorId.get(t.vehicleId) : null;
        return s + (Number(t.saleDetails?.price) || (v ? precioDe(v) : 0) || Number(t.value) || 0);
      }, 0);
      const prospectos = nuevos.filter((c) => c.sellerId === u.id).length;
      const abiertos = suyos.filter((t) => !checkIsWon(t.status, e.etapas) && !checkIsLost(t.status, e.etapas)).length;
      return {
        id: u.id as string,
        nombre: String(u.name || u.email || "Sin nombre"),
        rol: String(u.role),
        prospectos,
        tratosAbiertos: abiertos,
        ventas: ganados.length,
        monto,
        conversion: prospectos ? Math.round((ganados.length / prospectos) * 100) : null,
      };
    })
    .sort((a, b) => b.ventas - a.ventas || b.monto - a.monto || b.prospectos - a.prospectos);

  const ingresos = suma(ventas);
  const ingresosAntes = suma(ventasAntes);

  return {
    resumen: {
      ventas: ventas.length,
      ventasAntes: ventasAntes.length,
      ingresos,
      ingresosAntes,
      ticket: ventas.length ? Math.round(ingresos / ventas.length) : 0,
      ticketAntes: ventasAntes.length ? Math.round(ingresosAntes / ventasAntes.length) : 0,
      prospectos: nuevos.length,
      prospectosAntes: nuevosAntes.length,
      diasParaVender: mediana(ventas.map((v) => v.dias).filter((d): d is number => d != null)),
      margen: conCosto.reduce((s, v) => s + (v.margen || 0), 0),
      margenSobre: conCosto.length,
      inventarioUnidades: inventario.length,
      inventarioValor: inventario.reduce((s, v) => s + v.precio, 0),
      tratosAbiertos: e.tratos.filter((t) => !t.isDeleted && !checkIsWon(t.status, e.etapas) && !checkIsLost(t.status, e.etapas)).length,
    },
    ventas: { lista: ventas, porTipo, porMarca, porRango, porAnio, porMes },
    inventario: {
      lista: inventario,
      porTipo: invPorTipo,
      antiguedad,
      propiedad,
      estancados: inventario.filter((v) => v.dias != null && v.dias > 60),
      mezcla,
      ventasDe12Meses: vendidos12.length,
    },
    clientes: {
      nuevos: nuevos.length,
      porFuente,
      porMes: clientesPorMes,
      sinDato: nuevos.filter((c) => fuenteDelContacto(c) === SIN_DATO).length,
      demanda: { conBusqueda: buscando.length, porTipo: demandaPorTipo, porPresupuesto: demandaPorPresupuesto, porMarca: demandaPorMarca },
    },
    equipo,
  };
}

export type Analitica = ReturnType<typeof calcularAnalitica>;

// ---------------------------------------------------------------------------
// Lo que dicen los numeros, en palabras.
//
// El administrador no tiene por que leer graficas: aqui se escriben las pocas
// frases que valen dinero. Cada regla solo habla con datos suficientes -- con
// dos ventas no hay tendencia, y una frase segura sobre nada engaña mas que
// un silencio.

export interface Hallazgo {
  tono: "alerta" | "oportunidad" | "info";
  texto: string;
}

const pesos = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")} millones` : `$${Math.round(n / 1000).toLocaleString("es-MX")} mil`;

export function hallazgos(a: Analitica): Hallazgo[] {
  const h: Hallazgo[] = [];
  const inv = a.inventario;

  // 1. Autos que se estan quedando.
  const viejos = inv.lista.filter((v) => v.dias != null && v.dias > 90);
  if (inv.lista.length >= 3 && viejos.length / inv.lista.length >= 0.3) {
    h.push({
      tono: "alerta",
      texto: `${viejos.length} de tus ${inv.lista.length} autos llevan más de 90 días en piso: ${pesos(viejos.reduce((s, v) => s + v.precio, 0))} parados. Revisa sus precios o su publicación.`,
    });
  }

  // 2. Lo que vendo contra lo que tengo (ventas de 12 meses).
  if (inv.ventasDe12Meses >= 3 && inv.lista.length >= 3) {
    const faltan = inv.mezcla.filter((m) => m.diferencia >= 15 && m.pctVentas >= 20);
    if (faltan.length) {
      const nombres = faltan.map((m) => m.tipo).join(" y ");
      const vendo = faltan.reduce((s, m) => s + m.pctVentas, 0);
      const tengo = faltan.reduce((s, m) => s + m.pctInventario, 0);
      const verbo = faltan.length > 1 ? "son" : "es";
      h.push({
        tono: "oportunidad",
        texto: tengo === 0
          ? `${nombres} ${verbo} el ${vendo}% de lo que vendes y hoy no tienes ${faltan.length > 1 ? "ninguno de esos" : "ninguno"} en piso. Conviene conseguir.`
          : `${nombres} ${verbo} el ${vendo}% de lo que vendes, pero solo el ${tengo}% de tu piso. Conviene conseguir más.`,
      });
    }
    const sobra = [...inv.mezcla].reverse().find((m) => m.diferencia <= -15 && m.pctInventario >= 20);
    if (sobra) {
      h.push({
        tono: "alerta",
        texto: `Tienes mucho ${sobra.tipo}: es el ${sobra.pctInventario}% de tu piso y ${sobra.pctVentas === 0 ? "no has vendido ninguno en 12 meses" : `solo el ${sobra.pctVentas}% de tus ventas`}.`,
      });
    }
  }

  // 3. El presupuesto real de quien compra.
  if (a.ventas.lista.length >= 3) {
    const top = [...a.ventas.porRango].sort((x, y) => y.unidades - x.unidades)[0];
    if (top && top.unidades >= 2) {
      h.push({
        tono: "info",
        // "La mayoria" solo si de verdad es mas de la mitad.
        texto: `${top.unidades * 2 > a.ventas.lista.length ? "La mayoría de tus ventas" : "Lo que más se vendió"} fue de ${top.etiqueta.charAt(0).toLowerCase() + top.etiqueta.slice(1)} (${top.unidades} de ${a.ventas.lista.length}). Ese es el presupuesto real de tu cliente.`,
      });
    }
  }

  // 4. Que canal trae clientes que compran.
  const fuentes = a.clientes.porFuente.filter((f) => f.fuente !== "sin-dato");
  if (fuentes.length >= 2) {
    const masProspectos = fuentes[0];
    const conVolumen = fuentes.filter((f) => f.prospectos >= 5);
    const mejor = [...conVolumen].sort((x, y) => y.conversion - x.conversion)[0];
    if (masProspectos.prospectos >= 10 && masProspectos.compraron === 0 && mejor && mejor.compraron > 0) {
      h.push({
        tono: "alerta",
        texto: `${masProspectos.etiqueta} te trae más prospectos (${masProspectos.prospectos}) pero ninguno ha comprado. ${mejor.etiqueta} convierte el ${mejor.conversion}%: ahí rinde más cada peso.`,
      });
    } else if (mejor && mejor.compraron > 0 && mejor.fuente !== masProspectos.fuente) {
      h.push({
        tono: "oportunidad",
        texto: `${masProspectos.etiqueta} trae más prospectos, pero ${mejor.etiqueta} es el canal que más convierte (${mejor.conversion}%).`,
      });
    }
  }

  // 5. Que tipo se vende mas rapido.
  const conDias = a.ventas.porTipo.filter((t) => t.diasMediana != null && t.unidades >= 2);
  if (conDias.length >= 2) {
    const rapido = [...conDias].sort((x, y) => (x.diasMediana ?? 0) - (y.diasMediana ?? 0))[0];
    h.push({ tono: "info", texto: `${rapido.tipo} es lo que más rápido se vende: la mitad en menos de ${rapido.diasMediana} días.` });
  }

  // 6. Datos que faltan para poder decir mas.
  if (a.clientes.nuevos >= 10 && a.clientes.sinDato / a.clientes.nuevos >= 0.3) {
    h.push({
      tono: "info",
      texto: `${Math.round((a.clientes.sinDato / a.clientes.nuevos) * 100)}% de tus prospectos no dicen cómo llegaron. Desde hoy se pide al darlos de alta.`,
    });
  }

  return h.slice(0, 5);
}
