import { checkIsLost, checkIsWon } from "./clientUtils";
import { fuenteDelContacto, etiquetaDeFuente } from "./fuentes";

/**
 * Lead Intelligence: a quién atender HOY y por qué.
 *
 * Antes se ordenaba por un «score» que sumaba datos del perfil (tener teléfono,
 * un presupuesto anotado) y no miraba el tiempo: un prospecto sin contacto en
 * dos meses seguía «caliente». Aquí se mira lo que de verdad indica una venta:
 *
 *  - qué tan avanzado va (etapa, cotización enviada, solicitud de crédito,
 *    prueba de manejo, auto concreto que sigue disponible),
 *  - cuánto lleva en silencio (el enfriamiento pesa mucho),
 *  - si tiene un siguiente paso agendado o una tarea vencida,
 *  - si el auto que quería ya se vendió,
 *  - qué tanto convierte, en esta agencia, el canal por el que llegó.
 *
 * Todo es regla explícita y se calcula aquí, en el navegador, con los datos de
 * la agencia: no sale nada a ningún servicio de IA. Cada puntaje trae sus
 * motivos en palabras y una acción sugerida, para que el vendedor sepa qué
 * hacer sin interpretar un número.
 */

const DIA = 86_400_000;

export type Temperatura = "caliente" | "se-enfria" | "tibio" | "frio";

export interface Motivo { texto: string; tono: "bueno" | "malo" | "neutro" }

export interface ProspectoInteligente {
  cliente: any;
  id: string;
  nombre: string;
  auto: string;
  etapa: string;
  asesor: string;
  puntos: number;                 // 0-100: qué tan probable es que compre
  prioridad: number;              // para ordenar «qué atender hoy»
  temperatura: Temperatura;
  diasSinContacto: number | null;
  motivos: Motivo[];
  accion: string;                 // una frase: qué hacer hoy
  etiquetas: ("sin-paso" | "tarea-vencida" | "auto-vendido" | "cotizado" | "credito")[];
  parecidos: number;              // autos disponibles parecidos al que quería
}

export interface EntradaProspectos {
  ahora?: number;
  /** Tratos/contactos abiertos (los que ya arma el Dashboard). */
  prospectos: any[];
  /** Todos los contactos de la agencia, para medir qué canal convierte. */
  contactos: any[];
  tareas: any[];
  notas: any[];
  vehiculos: any[];
  etapas: { id: string; title?: string }[];
  usuarios: any[];
}

/** Firestore Timestamp, ISO, número o Date → milisegundos (o null). */
export function ms(x: any): number | null {
  if (x === null || x === undefined || x === "") return null;
  if (typeof x === "number") return x;
  if (x instanceof Date) return x.getTime();
  if (typeof x === "string") {
    const t = /^\d{4}-\d{2}-\d{2}$/.test(x) ? Date.parse(`${x}T12:00:00`) : Date.parse(x);
    return Number.isNaN(t) ? null : t;
  }
  if (typeof x.toMillis === "function") return x.toMillis();
  if (typeof x.seconds === "number") return x.seconds * 1000;
  return null;
}

const sinAcentos = (s: string) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const etapaTexto = (e?: { id: string; title?: string }) => sinAcentos(`${e?.title || ""} ${e?.id || ""}`);

/** De cada canal, qué porcentaje de sus contactos terminó comprando (solo con muestra suficiente). */
export function conversionPorCanal(contactos: any[], etapas: EntradaProspectos["etapas"]) {
  const t = new Map<string, { n: number; ganados: number }>();
  for (const c of contactos) {
    if (c.isDeleted) continue;
    const f = fuenteDelContacto(c);
    const x = t.get(f) || { n: 0, ganados: 0 };
    x.n++;
    if (checkIsWon(c.status, etapas)) x.ganados++;
    t.set(f, x);
  }
  const total = [...t.values()].reduce((s, x) => ({ n: s.n + x.n, g: s.g + x.ganados }), { n: 0, g: 0 });
  const base = total.n ? total.g / total.n : 0;
  const r = new Map<string, { tasa: number; n: number; relativo: number }>();
  for (const [f, x] of t) {
    if (x.n < 20 || f === "sin-dato") continue; // con menos no es un dato, es una anécdota
    // Se encoge hacia el promedio de la agencia para que 3 de 4 no parezca «75 %».
    const tasa = (x.ganados + base * 10) / (x.n + 10);
    r.set(f, { tasa, n: x.n, relativo: base > 0 ? tasa / base : 1 });
  }
  return r;
}

export function priorizarProspectos(e: EntradaProspectos): ProspectoInteligente[] {
  const ahora = e.ahora ?? Date.now();
  const etapas = e.etapas;
  const porId = new Map(etapas.map((x) => [x.id, x]));
  const activas = etapas.filter((x) => !checkIsLost(x.id, etapas) && !checkIsWon(x.id, etapas));
  const canales = conversionPorCanal(e.contactos, etapas);
  const nombreUsuario = new Map(e.usuarios.map((u: any) => [u.id, u.name || u.email || ""]));
  const disponibles = e.vehiculos.filter((v: any) => v.status === "available" || !v.status);
  const autoPorId = new Map(e.vehiculos.map((v: any) => [v.id, v]));

  // Índices por contacto y por trato
  const tareasDe = new Map<string, any[]>();
  const notasDe = new Map<string, any[]>();
  const poner = (m: Map<string, any[]>, k: string | undefined, x: any) => { if (k) { const l = m.get(k) || []; l.push(x); m.set(k, l); } };
  for (const t of e.tareas) { poner(tareasDe, t.clientId, t); poner(tareasDe, t.dealId, t); }
  for (const n of e.notas) { poner(notasDe, n.clientId, n); poner(notasDe, n.dealId, n); }

  const salida: ProspectoInteligente[] = [];
  for (const c of e.prospectos) {
    if (c.isDeleted || checkIsWon(c.status, etapas) || checkIsLost(c.status, etapas)) continue;
    const cid = c.originalClientId || c.id;
    const tareas = [...new Map([...(tareasDe.get(c.id) || []), ...(tareasDe.get(cid) || [])].map((t) => [t.id, t])).values()];
    const notas = [...new Map([...(notasDe.get(c.id) || []), ...(notasDe.get(cid) || [])].map((n) => [n.id, n])).values()]
      .sort((a, b) => (ms(b.createdAt) || 0) - (ms(a.createdAt) || 0));

    const motivos: Motivo[] = [];
    const etiquetas: ProspectoInteligente["etiquetas"] = [];
    let p = 30;
    const sube = (n: number, texto: string) => { p += n; motivos.push({ texto, tono: "bueno" }); };
    const baja = (n: number, texto: string) => { p -= n; motivos.push({ texto, tono: "malo" }); };

    // ---- Qué tan avanzado va
    const etapa = porId.get(c.status);
    const txtEtapa = etapaTexto(etapa);
    const nombreEtapa = etapa?.title || "Sin etapa";
    if (activas.length > 1) {
      const i = activas.findIndex((x) => x.id === c.status);
      if (i >= 0) {
        const avance = i / (activas.length - 1);
        const pts = Math.round(avance * 22);
        if (pts >= 8) sube(pts, `Va en «${nombreEtapa}»`);
        p += pts < 8 ? pts : 0;
      }
    }
    const enCredito = /credito/.test(txtEtapa);
    if (enCredito) { sube(12, "Está en crédito"); etiquetas.push("credito"); }
    if (/cierre|apart|anticipo|deposit|entreg/.test(txtEtapa)) sube(14, `Etapa de cierre («${nombreEtapa}»)`);
    if (/prueba|cita|visita/.test(txtEtapa)) sube(8, `Etapa «${nombreEtapa}»`);

    // ---- Señales concretas
    const cotizaciones = notas.filter((n) => n.type === "cotizacion");
    const ultimaCot = cotizaciones.length ? ms(cotizaciones[0].createdAt) : null;
    if (ultimaCot) {
      const d = Math.floor((ahora - ultimaCot) / DIA);
      sube(d <= 14 ? 16 : 8, d === 0 ? "Se le cotizó hoy" : `Se le cotizó hace ${d} día${d === 1 ? "" : "s"}`);
      etiquetas.push("cotizado");
    }
    const pidioCredito = notas.some((n) => n.type === "formulario-web" && /solicitud de cr[eé]dito/i.test(String(n.content || "")));
    if (pidioCredito) { sube(15, "Llenó la solicitud de crédito en la página"); if (!etiquetas.includes("credito")) etiquetas.push("credito"); }
    const probo = tareas.some((t) => /prueba de manejo|test drive/i.test(String(t.title || "")) && (t.completed || (ms(t.dueDate) || 0) >= ahora - 3 * DIA));
    if (probo) sube(10, "Tiene prueba de manejo");

    // ---- El auto que quería
    let parecidos = 0;
    let autoTxt = /^\s*otro( pendiente)?\s*$/i.test(String(c.vehicle || "")) ? "" : (c.vehicle || "");
    const auto: any = c.vehicleId ? autoPorId.get(c.vehicleId) : null;
    if (auto) {
      autoTxt = `${auto.year || ""} ${auto.make || ""} ${auto.model || ""}`.replace(/\s+/g, " ").trim();
      if (auto.status === "sold" || auto.status === "reserved") {
        baja(14, `Su auto (${autoTxt}) ${auto.status === "sold" ? "ya se vendió" : "está apartado"}`);
        etiquetas.push("auto-vendido");
        const precio = Number(auto.price) || 0;
        parecidos = disponibles.filter((v: any) => v.id !== auto.id
          && ((auto.bodyType && v.bodyType && sinAcentos(v.bodyType) === sinAcentos(auto.bodyType)) || !auto.bodyType)
          && (!precio || Math.abs((Number(v.price) || 0) - precio) <= precio * 0.18)).length;
      } else {
        sube(8, "Quiere un auto concreto que sigue disponible");
      }
    }
    const w: any = c.wantedVehicle;
    if (!auto && w && Object.keys(w).length) {
      sube(5, "Ya dijo qué busca");
      const marca = sinAcentos(w.make || w.marca || "");
      const max = Number(w.priceMax) || 0;
      parecidos = disponibles.filter((v: any) => (!marca || sinAcentos(v.make).includes(marca)) && (!max || (Number(v.price) || 0) <= max * 1.05)).length;
      if (parecidos) sube(6, `Tienes ${parecidos} auto${parecidos === 1 ? "" : "s"} que encajan con lo que busca`);
    }

    // ---- Canal de origen (lo que esta agencia ha medido)
    const canal = canales.get(fuenteDelContacto(c));
    if (canal) {
      const pct = Math.round(canal.tasa * 100);
      const prom = Math.round((canal.tasa / (canal.relativo || 1)) * 100);
      if (canal.relativo >= 1.5) sube(5, `Llegó por ${etiquetaDeFuente(fuenteDelContacto(c))}: aquí convierte ${pct}% (el promedio es ${prom}%)`);
      else if (canal.relativo <= 0.5) baja(4, `Llegó por ${etiquetaDeFuente(fuenteDelContacto(c))}: aquí convierte ${pct}% (el promedio es ${prom}%)`);
    }

    const interesSinSilencio = p; // qué tan buena venía la cosa antes de contar el tiempo callado

    // ---- Silencio: lo último que pasó con esta persona
    const toques: number[] = [];
    for (const n of notas) { const t = ms(n.createdAt); if (t) toques.push(t); }
    for (const t of tareas) { if (t.completed) { const m = ms(t.completedAt) || ms(t.dueDate); if (m) toques.push(m); } }
    const act = ms(c.updatedAt); if (act) toques.push(act);
    const nac = ms(c.createdAt); if (nac) toques.push(nac);
    const ultimo = toques.length ? Math.max(...toques) : null;
    const dias = ultimo ? Math.max(0, Math.floor((ahora - ultimo) / DIA)) : null;
    if (dias !== null) {
      if (dias >= 60) baja(40, `Llevas ${dias} días sin contacto`);
      else if (dias >= 30) baja(28, `Llevas ${dias} días sin contacto`);
      else if (dias >= 14) baja(18, `Llevas ${dias} días sin contacto`);
      else if (dias >= 7) baja(9, `Llevas ${dias} días sin contacto`);
      else if (dias <= 2) sube(6, dias === 0 ? "Hubo contacto hoy" : `Hubo contacto hace ${dias} día${dias === 1 ? "" : "s"}`);
    }

    // ---- Siguiente paso y tareas vencidas
    const pendientes = tareas.filter((t) => !t.completed);
    const vencidas = pendientes.filter((t) => { const d = ms(t.dueDate); return d !== null && d < ahora - DIA / 2 && t.type !== "payment"; })
      .sort((a, b) => (ms(a.dueDate) || 0) - (ms(b.dueDate) || 0));
    const futuras = pendientes.filter((t) => { const d = ms(t.dueDate); return d !== null && d >= ahora - DIA / 2 && t.type !== "payment"; });
    if (!pendientes.filter((t) => t.type !== "payment").length) { baja(6, "No tiene siguiente paso agendado"); etiquetas.push("sin-paso"); }
    else if (futuras.length) sube(4, "Tiene un paso agendado");
    if (vencidas.length) { etiquetas.push("tarea-vencida"); baja(5, `Tarea vencida: «${String(vencidas[0].title || "").slice(0, 40)}»`); }

    // ---- Lo que dicen las notas recientes (solo las últimas, y señales claras)
    const recientes = notas.filter((n) => n.type !== "cotizacion" && n.type !== "formulario-web").slice(0, 5);
    const txt = sinAcentos(recientes.map((n) => n.content || "").join(" | "));
    if (/compro otro|ya compro|adquirio otro|ya no le interesa|no interesad|descartad|no insistir/.test(txt)) baja(30, "Las notas dicen que ya no le interesa o compró en otro lado");
    else {
      if (/credito aprobado|autorizado|aprobado/.test(txt)) sube(12, "Su crédito aparece aprobado");
      if (/apartar|deposito|anticipo|aparto/.test(txt)) sube(10, "Habló de apartar o dar anticipo");
      if (/no le alcanza|fuera de presupuesto|no califica|sin dinero/.test(txt)) baja(12, "Hay una objeción de presupuesto");
      if (/lo va a pensar|indeciso/.test(txt)) baja(4, "Dijo que lo pensaría");
    }

    const puntos = Math.max(0, Math.min(100, Math.round(p)));
    // «Se enfría»: venía con buen interés y lleva callado una semana o más.
    const enfriando = interesSinSilencio >= 55 && dias !== null && dias >= 7;
    const temperatura: Temperatura = enfriando ? "se-enfria" : puntos >= 70 ? "caliente" : puntos >= 42 ? "tibio" : "frio";

    // ---- Qué hacer hoy (la primera regla que aplique)
    let accion = "Mantén el contacto y agenda su siguiente paso.";
    if (etiquetas.includes("auto-vendido")) accion = parecidos ? `Su auto ya no está: ofrécele uno de los ${parecidos} parecidos que tienes.` : "Su auto ya no está: pregúntale qué otro le gustaría.";
    else if (vencidas.length) accion = `Cumple la tarea vencida: ${String(vencidas[0].title || "dar seguimiento").slice(0, 60)}.`;
    else if (etiquetas.includes("cotizado") && ultimaCot && ahora - ultimaCot >= 2 * DIA && (dias ?? 0) >= 2) accion = `Llámale: la cotización lleva ${Math.floor((ahora - ultimaCot) / DIA)} días sin respuesta.`;
    else if (etiquetas.includes("credito") && enCredito) accion = "Revisa cómo va su solicitud de crédito y avísale.";
    else if (temperatura === "se-enfria") accion = `Escríbele hoy: ${dias} días sin contacto y tenía buen interés.`;
    else if (parecidos && !auto) accion = `Mándale ${parecidos === 1 ? "el auto" : `los ${parecidos} autos`} que encajan con lo que busca.`;
    else if (etiquetas.includes("sin-paso")) accion = "Agenda su siguiente paso: hoy no tiene ninguno.";
    else if (temperatura === "caliente") accion = "Está caliente: propón cerrar o agendar la visita.";

    // Para ordenar «qué hacer hoy»: lo que se enfría y lo que tiene tarea vencida sube.
    const prioridad = puntos
      + (temperatura === "se-enfria" ? 14 : 0)
      + (etiquetas.includes("tarea-vencida") ? 8 : 0)
      + (etiquetas.includes("auto-vendido") ? 6 : 0)
      + (etiquetas.includes("sin-paso") && puntos >= 45 ? 6 : 0)
      - (temperatura === "frio" ? 20 : 0);

    salida.push({
      cliente: c,
      id: c.id,
      nombre: c.name || c.dealTitle || "Sin nombre",
      auto: autoTxt,
      etapa: nombreEtapa,
      asesor: String(nombreUsuario.get(c.sellerId) || ""),
      puntos, prioridad, temperatura, diasSinContacto: dias,
      motivos: motivos.sort((a, b) => (a.tono === b.tono ? 0 : a.tono === "malo" ? -1 : 1)).slice(0, 6),
      accion, etiquetas, parecidos,
    });
  }
  return salida.sort((a, b) => b.prioridad - a.prioridad);
}

export function resumenDeProspectos(l: ProspectoInteligente[]) {
  return {
    total: l.length,
    calientes: l.filter((x) => x.temperatura === "caliente").length,
    seEnfrian: l.filter((x) => x.temperatura === "se-enfria").length,
    sinPaso: l.filter((x) => x.etiquetas.includes("sin-paso") && x.temperatura !== "frio").length,
    autoVendido: l.filter((x) => x.etiquetas.includes("auto-vendido")).length,
    tareasVencidas: l.filter((x) => x.etiquetas.includes("tarea-vencida")).length,
  };
}
