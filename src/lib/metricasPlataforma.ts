import { checkIsWon, checkIsLost } from "./clientUtils";

/**
 * Metricas de la plataforma para el panel del master y los correos de animo.
 *
 * Todo aqui es calculo puro: recibe listas de documentos ya leidos y devuelve
 * numeros. Sin Firestore dentro, para poder probarlo con datos inventados.
 *
 * PRIVACIDAD. Lo que sale de este modulo son conteos y fechas. Nunca nombres
 * de clientes, telefonos, autos ni montos de tratos concretos. Los nombres que
 * aparecen son de agencias y de usuarios del CRM, que el master ya administra.
 * El dinero que se reporta es el de la plataforma (suscripciones), no el que
 * factura cada agencia: de ellas se cuenta cuantas ventas, no por cuanto.
 */

export const DIAS_ESTANCADO = 7;
const DIA = 86_400_000;
// Mexico no tiene horario de verano desde 2022: UTC-6 fijo todo el ano.
const DESFASE_MX = -6 * 3_600_000;

/**
 * Lo que mete una persona. Los contactos que entran solos -- desde la web,
 * Marketplace, WhatsApp -- no cuentan como uso: una agencia con anuncios
 * corriendo pareceria activa aunque nadie abriera el CRM en semanas.
 * `/api/public/v1/leads` marca "website" por defecto.
 */
const ORIGENES_HUMANOS = new Set(["", "manual", "excel_import", "google_contacts"]);

export type Semaforo = "activa" | "en-riesgo" | "estancada" | "nunca";

export function aMs(v: any): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const t = Date.parse(v);
    return Number.isNaN(t) ? null : t;
  }
  if (v instanceof Date) return v.getTime();
  if (typeof v.toMillis === "function") return v.toMillis();
  if (typeof v._seconds === "number") return v._seconds * 1000;
  if (typeof v.seconds === "number") return v.seconds * 1000;
  return null;
}

/** 🟢 hasta 3 dias · 🟡 de 4 a 7 · 🔴 mas de 7 · ⚪ nunca metio nada. */
export function semaforo(ultima: number | null, ahora: number): Semaforo {
  if (ultima == null) return "nunca";
  const dias = (ahora - ultima) / DIA;
  if (dias <= 3) return "activa";
  if (dias <= DIAS_ESTANCADO) return "en-riesgo";
  return "estancada";
}

/** Lunes 00:00 hora de Mexico de la semana que contiene `ms`, en ms UTC. */
export function inicioDeSemanaMx(ms: number): number {
  const d = new Date(ms + DESFASE_MX);
  const desdeLunes = (d.getUTCDay() + 6) % 7;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - desdeLunes) - DESFASE_MX;
}

export function estadoDeAgencia(a: any, ahora: number) {
  const finPrueba = aMs(a.trialEndsAt);
  const enPrueba = finPrueba !== null && finPrueba > ahora;
  const estado = a.hasFreeAccess
    ? "cortesia"
    : a.subscriptionStatus === "active"
    ? "activa"
    : enPrueba
    ? "prueba"
    : "sin acceso";
  return {
    estado,
    diasDePruebaRestantes:
      enPrueba && finPrueba ? Math.ceil((finPrueba - ahora) / DIA) : null,
  };
}

type Contadores = {
  ultimaActividad: number | null;
  datos7: number;
  datos30: number;
  tratosAbiertos: number;
  tratosNuevos7: number;
  ventas: number;
  ventas7: number;
  ventas30: number;
  tareasPendientes: number;
  tareasVencidas: number;
};

const vacios = (): Contadores => ({
  ultimaActividad: null,
  datos7: 0,
  datos30: 0,
  tratosAbiertos: 0,
  tratosNuevos7: 0,
  ventas: 0,
  ventas7: 0,
  ventas30: 0,
  tareasPendientes: 0,
  tareasVencidas: 0,
});

export interface EntradaMetricas {
  ahora: number;
  agencias: any[];
  usuarios: any[];
  clientes: any[];
  tratos: any[];
  tareas: any[];
  notas: any[];
  vehiculos: any[];
  /** stripeCustomerId -> usuarios que paga. Sin suscripcion activa, no aparece. */
  facturadosPorCliente?: Record<string, number>;
  semanas?: number;
}

export function calcularMetricas(e: EntradaMetricas) {
  const { ahora } = e;
  const semanas = e.semanas ?? 12;
  const hace7 = ahora - 7 * DIA;
  const hace30 = ahora - 30 * DIA;
  const hoyMx = inicioDeDiaMx(ahora);

  const porAgencia = new Map<string, Contadores>();
  const porUsuario = new Map<string, Contadores>();
  const de = (m: Map<string, Contadores>, k: string) => {
    let c = m.get(k);
    if (!c) m.set(k, (c = vacios()));
    return c;
  };

  const etapasDe = new Map<string, any[]>();
  for (const a of e.agencias) etapasDe.set(a.id, Array.isArray(a.pipelineStages) ? a.pipelineStages : []);

  // Serie semanal. La ultima entrada es la semana en curso.
  const lunesActual = inicioDeSemanaMx(ahora);
  const serie = Array.from({ length: semanas }, (_, i) => ({
    inicio: new Date(lunesActual - (semanas - 1 - i) * 7 * DIA).toISOString(),
    agencias: 0,
    usuarios: 0,
    contactos: 0,
    tratos: 0,
    tareas: 0,
    notas: 0,
    ventas: 0,
  }));
  const primerLunes = lunesActual - (semanas - 1) * 7 * DIA;
  const enSerie = (ms: number | null) => {
    if (ms == null || ms < primerLunes || ms > ahora + DIA) return null;
    const i = Math.floor((inicioDeSemanaMx(ms) - primerLunes) / (7 * DIA));
    return i >= 0 && i < semanas ? serie[i] : null;
  };

  /** Un dato metido por una persona: mueve la ultima actividad y los conteos. */
  const registrar = (agencyId: string, sellerId: string, ms: number | null) => {
    if (ms == null || !agencyId) return;
    for (const c of [de(porAgencia, agencyId), sellerId ? de(porUsuario, sellerId) : null]) {
      if (!c) continue;
      if (c.ultimaActividad == null || ms > c.ultimaActividad) c.ultimaActividad = ms;
      if (ms >= hace7) c.datos7++;
      if (ms >= hace30) c.datos30++;
    }
  };

  const total = { contactos: 0, tratos: 0, vehiculos: 0 };
  const totalesPorAgencia = new Map<string, { contactos: number; tratos: number; vehiculos: number }>();
  const tot = (id: string) => {
    let t = totalesPorAgencia.get(id);
    if (!t) totalesPorAgencia.set(id, (t = { contactos: 0, tratos: 0, vehiculos: 0 }));
    return t;
  };

  for (const c of e.clientes) {
    if (c.isDeleted || !c.agencyId) continue;
    tot(c.agencyId).contactos++;
    total.contactos++;
    if (!ORIGENES_HUMANOS.has(String(c.origin || ""))) continue;
    const ms = aMs(c.createdAt);
    registrar(c.agencyId, c.sellerId || "", ms);
    const s = enSerie(ms);
    if (s) s.contactos++;
  }

  for (const t of e.tratos) {
    if (t.isDeleted || !t.agencyId) continue;
    tot(t.agencyId).tratos++;
    total.tratos++;
    const etapas = etapasDe.get(t.agencyId) || [];
    const ganado = checkIsWon(t.status, etapas);
    const perdido = !ganado && checkIsLost(t.status, etapas);
    const creado = aMs(t.createdAt);
    const vendido = ganado ? aMs(t.soldAt) ?? aMs(t.updatedAt) ?? creado : null;

    const quienes = [de(porAgencia, t.agencyId), t.sellerId ? de(porUsuario, t.sellerId) : null];
    for (const c of quienes) {
      if (!c) continue;
      if (!ganado && !perdido) c.tratosAbiertos++;
      if (creado != null && creado >= hace7) c.tratosNuevos7++;
      if (ganado) {
        c.ventas++;
        if (vendido != null && vendido >= hace7) c.ventas7++;
        if (vendido != null && vendido >= hace30) c.ventas30++;
      }
    }

    // Un trato que llega solo (si algun dia el alta automatica crea tratos
    // con origen) no es alguien trabajando.
    if (t.origin && !ORIGENES_HUMANOS.has(String(t.origin))) continue;
    registrar(t.agencyId, t.sellerId || "", creado);
    // Moverlo de etapa tambien es trabajo.
    const movido = aMs(t.updatedAt);
    if (movido != null && creado != null && movido - creado > 60_000) {
      registrar(t.agencyId, t.sellerId || "", movido);
    }
    const s = enSerie(creado);
    if (s) s.tratos++;
    if (vendido != null) {
      const sv = enSerie(vendido);
      if (sv) sv.ventas++;
    }
  }

  for (const t of e.tareas) {
    if (!t.agencyId) continue;
    // Solo createdAt: la sincronizacion con Google Calendar toca updatedAt
    // sin que nadie haga nada.
    const ms = aMs(t.createdAt);
    registrar(t.agencyId, t.sellerId || "", ms);
    const s = enSerie(ms);
    if (s) s.tareas++;

    if (!t.completed) {
      const vence = fechaDelDiaMx(t.dueDate);
      for (const c of [de(porAgencia, t.agencyId), t.sellerId ? de(porUsuario, t.sellerId) : null]) {
        if (!c) continue;
        c.tareasPendientes++;
        if (vence != null && vence < hoyMx) c.tareasVencidas++;
      }
    }
  }

  for (const n of e.notas) {
    if (!n.agencyId) continue;
    // Las notas que escribe WhatsApp al llegar un mensaje no son de nadie.
    if (n.direction === "inbound") continue;
    const ms = aMs(n.createdAt);
    registrar(n.agencyId, n.sellerId || n.createdBy || "", ms);
    const s = enSerie(ms);
    if (s) s.notas++;
  }

  for (const v of e.vehiculos) {
    if (!v.agencyId) continue;
    tot(v.agencyId).vehiculos++;
    total.vehiculos++;
  }

  // ---- Usuarios ----
  const usuariosPorAgencia = new Map<string, number>();
  const usuarios = e.usuarios
    .filter((u) => u.role !== "master")
    .map((u) => {
      const agencyId = u.agencyId && u.agencyId !== "unassigned" ? u.agencyId : "";
      if (agencyId) usuariosPorAgencia.set(agencyId, (usuariosPorAgencia.get(agencyId) || 0) + 1);
      const c = porUsuario.get(u.id) || vacios();
      const creado = aMs(u.createdAt);
      const s = enSerie(creado);
      if (s) s.usuarios++;
      return {
        id: u.id,
        nombre: u.name || u.email || "Sin nombre",
        correo: u.email || "",
        rol: u.role || "unassigned",
        agencyId,
        creadoEl: creado ? new Date(creado).toISOString() : null,
        ultimaActividad: c.ultimaActividad ? new Date(c.ultimaActividad).toISOString() : null,
        diasSinActividad:
          c.ultimaActividad != null ? Math.floor((ahora - c.ultimaActividad) / DIA) : null,
        actividad: semaforo(c.ultimaActividad, ahora),
        datos7: c.datos7,
        datos30: c.datos30,
        tratosAbiertos: c.tratosAbiertos,
        tratosNuevos7: c.tratosNuevos7,
        ventas7: c.ventas7,
        ventas30: c.ventas30,
        tareasPendientes: c.tareasPendientes,
        tareasVencidas: c.tareasVencidas,
        recibeCorreos: u.correosDeAnimo !== false,
      };
    });

  // ---- Agencias ----
  const facturados = e.facturadosPorCliente || {};
  const agencias = e.agencias.map((a) => {
    const c = porAgencia.get(a.id) || vacios();
    const t = totalesPorAgencia.get(a.id) || { contactos: 0, tratos: 0, vehiculos: 0 };
    const { estado, diasDePruebaRestantes } = estadoDeAgencia(a, ahora);
    const nUsuarios = usuariosPorAgencia.get(a.id) || 0;
    const pagados = a.stripeCustomerId && a.stripeCustomerId in facturados
      ? facturados[a.stripeCustomerId]
      : null;
    const creada = aMs(a.createdAt);
    const s = enSerie(creada);
    if (s) s.agencias++;
    return {
      id: a.id,
      nombre: a.name || "Agencia sin nombre",
      estado,
      diasDePruebaRestantes,
      creadaEl: creada ? new Date(creada).toISOString() : null,
      usuarios: nUsuarios,
      usuariosFacturados: pagados,
      sinFacturar: pagados !== null && nUsuarios > pagados ? nUsuarios - pagados : 0,
      vehiculos: t.vehiculos,
      contactos: t.contactos,
      tratos: t.tratos,
      tratosAbiertos: c.tratosAbiertos,
      tratosNuevos7: c.tratosNuevos7,
      ventas: c.ventas,
      ventas7: c.ventas7,
      ventas30: c.ventas30,
      tareasPendientes: c.tareasPendientes,
      tareasVencidas: c.tareasVencidas,
      ultimaActividad: c.ultimaActividad ? new Date(c.ultimaActividad).toISOString() : null,
      diasSinActividad:
        c.ultimaActividad != null ? Math.floor((ahora - c.ultimaActividad) / DIA) : null,
      actividad: semaforo(c.ultimaActividad, ahora),
      datos7: c.datos7,
      datos30: c.datos30,
    };
  });

  agencias.sort((x, y) => (y.datos30 - x.datos30) || (y.usuarios - x.usuarios));

  const inicioMes = inicioDeMesMx(ahora);
  const inicioMesAnterior = inicioDeMesMx(inicioMes - DIA);
  const altasEntre = (lista: any[], campo: string, desde: number, hasta: number) =>
    lista.filter((x) => {
      const ms = aMs(x[campo]);
      return ms != null && ms >= desde && ms < hasta;
    }).length;
  const usuariosSinMaster = e.usuarios.filter((u) => u.role !== "master");

  return {
    totales: {
      agencias: agencias.length,
      activas: agencias.filter((a) => a.estado === "activa").length,
      enPrueba: agencias.filter((a) => a.estado === "prueba").length,
      cortesia: agencias.filter((a) => a.estado === "cortesia").length,
      sinAcceso: agencias.filter((a) => a.estado === "sin acceso").length,
      usuarios: usuarios.length,
      usuariosFacturados: agencias.reduce((s, a) => s + (a.usuariosFacturados || 0), 0),
      usuariosSinFacturar: agencias.reduce((s, a) => s + a.sinFacturar, 0),
      vehiculos: total.vehiculos,
      contactos: total.contactos,
      tratos: total.tratos,
      ventas30: agencias.reduce((s, a) => s + a.ventas30, 0),
      agenciasEstancadas: agencias.filter((a) => a.actividad === "estancada" || a.actividad === "nunca").length,
      agenciasEnRiesgo: agencias.filter((a) => a.actividad === "en-riesgo").length,
      usuariosEstancados: usuarios.filter((u) => u.actividad === "estancada" || u.actividad === "nunca").length,
      agenciasNuevasMes: altasEntre(e.agencias, "createdAt", inicioMes, ahora + DIA),
      agenciasNuevasMesAnterior: altasEntre(e.agencias, "createdAt", inicioMesAnterior, inicioMes),
      usuariosNuevosMes: altasEntre(usuariosSinMaster, "createdAt", inicioMes, ahora + DIA),
      usuariosNuevosMesAnterior: altasEntre(usuariosSinMaster, "createdAt", inicioMesAnterior, inicioMes),
    },
    agencias,
    usuarios,
    serie,
  };
}

/**
 * `dueDate` llega como "2026-09-10", sin hora. Leido tal cual es medianoche
 * UTC -- las 18:00 del dia anterior en Mexico --, y una tarea que vence hoy
 * saldria como vencida. Se toma como medianoche de Mexico.
 */
function fechaDelDiaMx(v: any): number | null {
  if (typeof v === "string") {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.trim());
    if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3]) - DESFASE_MX;
  }
  return aMs(v);
}

function inicioDeDiaMx(ms: number): number {
  const d = new Date(ms + DESFASE_MX);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - DESFASE_MX;
}

function inicioDeMesMx(ms: number): number {
  const d = new Date(ms + DESFASE_MX);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) - DESFASE_MX;
}
