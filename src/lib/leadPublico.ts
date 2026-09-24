/**
 * La puerta publica de leads (POST /api/public/v1/leads): lo que llenan en los
 * formularios de nextcar.erewere.com y otras integraciones.
 *
 * Hasta sep 2026 solo guardaba nombre, telefono, correo y "vehicle", y si el
 * contacto ya existia descartaba todo lo demas: un cliente que pedia credito y
 * luego vendia su auto solo dejaba rastro del primer formulario. Ahora:
 *   - "tipo" (VENDE SU AUTO, QUIERE COMPRAR, CRÉDITO, SOLICITUD DE CRÉDITO,
 *     BUSCA AUTO) queda como etiqueta del contacto y en el trato;
 *   - "notes" (el detalle del formulario) queda como nota en el historial;
 *   - "origin" queda en el trato y en la nota;
 *   - un contacto existente siempre recibe la nota, y un trato nuevo salvo que
 *     ya tenga uno abierto del mismo tipo y el mismo auto;
 *   - para BUSCA AUTO y QUIERE COMPRAR se llena lo que busca (wantedVehicle).
 * Peticiones viejas (sin tipo ni notes) se comportan exactamente como antes.
 *
 * Es publica y sin llave: todo se corta a un largo maximo, se guarda como
 * texto plano (sin etiquetas HTML) y solo se escriben campos conocidos.
 *
 * Logica pura sobre Firestore (sin Express) para poder probarla contra la base
 * sin levantar el servidor. Los ayudantes compartidos llegan en `deps`.
 */

import { checkIsWon, checkIsLost } from "./clientUtils.ts";
import { fuenteDesdeOrigen } from "./fuentes.ts";

type Etapa = { id: string; title?: string };

export interface DepsLead {
  buscarContactoPorTelefono: (db: any, agencyId: string, phone: string) => Promise<any | null>;
  primeraEtapaDelEmbudo: (db: any, agencyId: string) => Promise<{ etapaId: string; etapas: Etapa[] }>;
  camposQueFaltan: (existente: any, entrante: Record<string, any>) => Record<string, any>;
  serverTimestamp: () => any;
  ahora?: () => Date;
}

export const LARGOS = {
  name: 120, phone: 40, email: 160, vehicle: 120, origin: 80, tipo: 40, notes: 4000, sellerId: 64,
};

/** Texto plano, sin etiquetas HTML ni caracteres de control, cortado a `max`. */
export function textoPlano(v: unknown, max: number, multilinea = false): string {
  if (v === null || v === undefined) return "";
  if (typeof v !== "string" && typeof v !== "number") return "";
  let s = String(v)
    .replace(/<[^>]*>/g, " ")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
  s = multilinea
    ? s.replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n")
    : s.replace(/\s+/g, " ");
  return s.trim().slice(0, max).trim();
}

const sinAcentos = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Los tipos conocidos, con su etiqueta legible. */
export const TIPOS: Record<string, string> = {
  "VENDE SU AUTO": "Vende su auto",
  "QUIERE COMPRAR": "Quiere comprar",
  "CRÉDITO": "Crédito",
  "SOLICITUD DE CRÉDITO": "Solicitud de crédito",
  "BUSCA AUTO": "Busca auto",
};

/** Normaliza el tipo que llega ("credito", "Crédito"...) a uno de TIPOS; si no es conocido, texto corto en mayúsculas. */
export function normalizarTipo(v: unknown): string {
  const t = textoPlano(v, LARGOS.tipo);
  if (!t) return "";
  const k = sinAcentos(t).replace(/\s+/g, " ");
  for (const tipo of Object.keys(TIPOS)) if (sinAcentos(tipo) === k) return tipo;
  return t.toUpperCase();
}

const etiquetaDeTipo = (tipo: string) =>
  TIPOS[tipo] || tipo.charAt(0) + tipo.slice(1).toLowerCase();

const mismoAuto = (a: unknown, b: unknown) =>
  sinAcentos(String(a || "")).replace(/\s+/g, " ") === sinAcentos(String(b || "")).replace(/\s+/g, " ");

// Marcas para entender textos libres como «Tiguan 2020» o «busco un Jetta de 250 mil».
const MARCAS = [
  "Acura", "Alfa Romeo", "Audi", "BAIC", "BMW", "Buick", "BYD", "Cadillac", "Chevrolet", "Chirey", "Chrysler",
  "Cupra", "Dodge", "Fiat", "Ford", "GMC", "Honda", "Hyundai", "Infiniti", "Isuzu", "JAC", "Jaguar", "Jeep",
  "Jetour", "Kia", "Land Rover", "Lexus", "Lincoln", "Mazda", "Mercedes-Benz", "Mercedes Benz", "MG", "Mini",
  "Mitsubishi", "Nissan", "Omoda", "Peugeot", "Porsche", "Ram", "Renault", "Seat", "Subaru", "Suzuki", "Tesla",
  "Toyota", "Volkswagen", "VW", "Volvo", "Motornation", "GWM", "Haval",
];
const ALIAS: Record<string, string> = { vw: "Volkswagen", "mercedes benz": "Mercedes-Benz", chevy: "Chevrolet" };

/**
 * Lo que busca el cliente a partir de campos sueltos o de un texto libre. Solo
 * devuelve lo que se pudo entender con seguridad; lo demas se queda fuera.
 */
export function entenderBusqueda(entrada: any, textoLibre: string) {
  const b = entrada && typeof entrada === "object" && !Array.isArray(entrada) ? entrada : {};
  const res: { make?: string; model?: string; yearMin?: number; priceMax?: number } = {};
  let marca = textoPlano(b.marca, 40);
  let modelo = textoPlano(b.modelo, 60);
  let anio = Number(b.anio) || 0;
  let precio = Number(String(b.precioMax ?? "").replace(/[^\d.]/g, "")) || 0;

  if (!marca && !modelo && textoLibre) {
    let t = ` ${textoPlano(textoLibre, 160)} `;
    const a = t.match(/\b(19[89]\d|20[0-4]\d)\b/);
    if (a && !anio) { anio = Number(a[1]); t = t.replace(a[0], " "); }
    const p = t.match(/\$?\s?(\d{2,3}(?:[.,]\d{3})+|\d{2,3})\s*(mil|k)?\b/i);
    if (!precio && p && (p[2] || /\$|\d[.,]\d{3}/.test(p[0]))) {
      const n = Number(p[1].replace(/[.,]/g, ""));
      precio = p[2] ? n * 1000 : n;
      t = t.replace(p[0], " ");
    }
    // Minusculas sin acentos pero SIN recortar, para que las posiciones
    // coincidan con las de `t` (quitar un acento no cambia el largo en NFC).
    const bajo = t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    let encontrada = "";
    let fin = -1;
    for (const m of [...MARCAS, ...Object.keys(ALIAS)].sort((x, y) => y.length - x.length)) {
      const r = new RegExp(`(^|\\s)(${sinAcentos(m).replace(/[-]/g, "[- ]")})(?=\\s|$)`).exec(bajo);
      if (r) { encontrada = m; fin = r.index + r[1].length + r[2].length; break; }
    }
    if (encontrada) {
      marca = ALIAS[sinAcentos(encontrada)] || encontrada;
      const resto = t.slice(fin).replace(/\b(de|del|la|el|un|una|busco|menos|mas|más|hasta|pesos)\b/gi, " ");
      modelo = textoPlano(resto, 60).split(" ").slice(0, 3).join(" ");
    } else {
      // Sin marca reconocible («Tiguan 2020»): lo que escribio queda como modelo.
      const resto = t.replace(/\b(de|del|la|el|un|una|busco|menos|mas|más|hasta|pesos|auto|carro|coche)\b/gi, " ");
      modelo = textoPlano(resto, 60).split(" ").slice(0, 3).join(" ");
    }
  }
  if (marca) res.make = marca;
  if (modelo) res.model = modelo;
  if (anio >= 1980 && anio <= 2050) res.yearMin = anio;
  if (precio >= 10_000 && precio <= 50_000_000) res.priceMax = Math.round(precio);
  return res;
}

function fechaMexico(d: Date) {
  return d.toLocaleString("es-MX", {
    timeZone: "America/Mexico_City", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export interface ResultadoLead {
  status: number;
  body: Record<string, any>;
}

export async function procesarLeadPublico(adminDb: any, cuerpo: any, deps: DepsLead): Promise<ResultadoLead> {
  const b = cuerpo && typeof cuerpo === "object" ? cuerpo : {};
  const agencyId = textoPlano(b.agencyId, 64);
  const name = textoPlano(b.name, LARGOS.name);
  const phone = textoPlano(b.phone, LARGOS.phone);
  const email = textoPlano(b.email, LARGOS.email).toLowerCase();
  const vehicle = textoPlano(b.vehicle, LARGOS.vehicle);
  const originRecibido = textoPlano(b.origin, LARGOS.origin);
  const tipo = normalizarTipo(b.tipo);
  const notes = textoPlano(b.notes, LARGOS.notes, true);
  const sellerId = textoPlano(b.sellerId, LARGOS.sellerId);
  // Formato nuevo = trae tipo o notas. Sin ellos, todo sigue como antes.
  const formatoNuevo = Boolean(tipo || notes);

  if (!agencyId || !name) return { status: 400, body: { error: "agencyId and name are required" } };

  // Esta puerta es publica: quien llama escribe el agencyId a mano. Si no
  // existe, el contacto quedaria en el vacio, sin que ninguna agencia lo vea.
  const agenciaSnap = await adminDb.collection("agencies").doc(agencyId).get();
  if (!agenciaSnap.exists) {
    return { status: 400, body: { error: `La agencia "${agencyId}" no existe. Revisa el agencyId de la integracion.` } };
  }

  let validatedSellerId = "";
  if (sellerId) {
    try {
      const s = await adminDb.collection("users").doc(sellerId).get();
      if (s.exists && s.data()?.agencyId === agencyId) validatedSellerId = sellerId;
    } catch (e) {
      console.warn("Error validating sellerId for public lead:", e);
    }
  }

  const origin = originRecibido || "website";
  const ahora = (deps.ahora || (() => new Date()))();
  const etiquetaTipo = tipo ? etiquetaDeTipo(tipo) : "";
  const busca = tipo === "BUSCA AUTO" || tipo === "QUIERE COMPRAR"
    ? entenderBusqueda(b.busca, tipo === "BUSCA AUTO" ? (textoPlano(b.busca?.texto, 160) || vehicle) : vehicle)
    : {};
  const hayBusqueda = Object.keys(busca).length > 0;

  // Etiquetas que se agregan al contacto: el tipo y, si se lleno lo que busca,
  // «Busca auto» (sin esa etiqueta el CRM borra lo que busca al guardar).
  const etiquetasNuevas = [etiquetaTipo, hayBusqueda ? "Busca auto" : ""]
    .filter(Boolean)
    .filter((e, i, xs) => xs.findIndex((x) => sinAcentos(x) === sinAcentos(e)) === i);

  // ---- ¿Ya lo conocemos? Por telefono y, si no hay, por correo.
  let existente = await deps.buscarContactoPorTelefono(adminDb, agencyId, phone);
  if (!existente && email) {
    const q = await adminDb.collection("clients").where("agencyId", "==", agencyId).where("email", "==", email).limit(5).get();
    existente = q.docs.find((d: any) => !d.data()?.isDeleted) || null;
  }

  let clientId: string;
  let yaExistia = false;
  let datosContacto: any = {};

  if (existente) {
    yaExistia = true;
    clientId = existente.id;
    datosContacto = existente.data() || {};
    // Si llego por correo (el Radar no pide telefono) y ahora trae telefono, se completa.
    const relleno = deps.camposQueFaltan(datosContacto, { name, email, vehicle, phone });
    const cambios: Record<string, any> = { ...relleno, updatedAt: deps.serverTimestamp() };
    if (formatoNuevo) {
      const tags = Array.isArray(datosContacto.tags) ? [...datosContacto.tags] : [];
      for (const e of etiquetasNuevas) if (!tags.some((t) => sinAcentos(String(t)) === sinAcentos(e))) tags.push(e);
      cambios.tags = tags;
      if (hayBusqueda) {
        const actual = datosContacto.wantedVehicle && typeof datosContacto.wantedVehicle === "object" ? datosContacto.wantedVehicle : {};
        const lleno: Record<string, any> = { ...actual };
        for (const [k, v] of Object.entries(busca)) if (lleno[k] === undefined || lleno[k] === null || lleno[k] === "") lleno[k] = v;
        cambios.wantedVehicle = lleno;
      }
    }
    await existente.ref.set(cambios, { merge: true });
  } else {
    const nuevo: Record<string, any> = {
      agencyId,
      name,
      phone,
      email,
      vehicle,
      origin,
      status: "new",
      sellerId: validatedSellerId,
      createdAt: deps.serverTimestamp(),
      updatedAt: deps.serverTimestamp(),
    };
    const f = fuenteDesdeOrigen(origin);
    if (f) nuevo.fuente = f;
    if (formatoNuevo && etiquetasNuevas.length) nuevo.tags = etiquetasNuevas;
    if (hayBusqueda) nuevo.wantedVehicle = busca;
    const ref = await adminDb.collection("clients").add(nuevo);
    clientId = ref.id;
    datosContacto = nuevo;
  }

  // ---- Trato
  let dealId: string | null = null;
  let tratoNuevo = false;
  try {
    const { etapaId, etapas } = await deps.primeraEtapaDelEmbudo(adminDb, agencyId);
    const abiertos = yaExistia
      ? (await adminDb.collection("deals").where("agencyId", "==", agencyId).where("clientId", "==", clientId).get())
          .docs.filter((d: any) => {
            const t = d.data() || {};
            return !t.isDeleted && !checkIsWon(t.status, etapas as Etapa[]) && !checkIsLost(t.status, etapas as Etapa[]);
          })
      : [];

    // Formato viejo: como antes, si ya tiene cualquier trato abierto no se crea
    // otro. Formato nuevo: solo se reusa uno abierto del mismo tipo y mismo auto.
    const reusar: any = formatoNuevo
      ? abiertos.find((d: any) => {
          const t = d.data() || {};
          return (t.tipoSolicitud || "") === tipo && mismoAuto(t.vehicle, vehicle);
        }) || null
      : null;
    const crear = formatoNuevo ? !reusar : abiertos.length === 0;
    if (crear) {
      const ref = adminDb.collection("deals").doc();
      const iso = ahora.toISOString();
      const nombre = datosContacto.name || name;
      const trato: Record<string, any> = {
        id: ref.id,
        clientId,
        agencyId,
        sellerId: validatedSellerId || datosContacto.sellerId || "",
        title: formatoNuevo && etiquetaTipo
          ? `${etiquetaTipo}${vehicle ? ` · ${vehicle}` : ""} — ${nombre}`
          : `Trato con ${nombre || "cliente"}`,
        status: etapaId,
        value: 0,
        vehicle: vehicle || (yaExistia ? datosContacto.vehicle || null : null) || null,
        vehicleId: (yaExistia && !formatoNuevo ? datosContacto.vehicleId : null) || null,
        createdAt: iso,
        updatedAt: iso,
      };
      if (formatoNuevo) {
        if (tipo) trato.tipoSolicitud = tipo;
        trato.origin = origin;
      }
      await ref.set(trato);
      dealId = ref.id;
      tratoNuevo = true;
    } else if (reusar) {
      dealId = reusar.id;
      await reusar.ref.set({ updatedAt: ahora.toISOString() }, { merge: true });
    }
  } catch (e) {
    // El contacto ya quedo guardado; que falle el trato no debe perder el lead.
    console.error("No se pudo crear el trato del lead:", e);
  }

  // ---- Nota en el historial (solo formato nuevo; las peticiones viejas no dejaban nota)
  if (formatoNuevo) {
    try {
      const encabezado = [
        `Formulario de la página${etiquetaTipo ? `: ${etiquetaTipo.toUpperCase()}` : ""}`,
        `Fecha: ${fechaMexico(ahora)}`,
        `Origen: ${origin}`,
        vehicle ? `Auto: ${vehicle}` : "",
        yaExistia ? "(Cliente que ya estaba en el CRM)" : "",
      ].filter(Boolean).join("\n");
      await adminDb.collection("notes").add({
        agencyId,
        clientId,
        ...(dealId ? { dealId } : {}),
        content: textoPlano(`${encabezado}${notes ? `\n\n${notes}` : ""}`, LARGOS.notes + 600, true),
        type: "formulario-web",
        ...(tipo ? { tipoSolicitud: tipo } : {}),
        origin,
        direction: "inbound",
        createdAt: ahora.toISOString(),
        createdByName: "Página web",
      });
    } catch (e) {
      console.error("No se pudo guardar la nota del lead:", e);
    }

    // Que la etiqueta exista en el catalogo de la agencia (para filtrar y elegirla).
    for (const e of etiquetasNuevas) {
      try {
        const ya = await adminDb.collection("agency_tags").where("agencyId", "==", agencyId).get();
        if (!ya.docs.some((d: any) => sinAcentos(String(d.data()?.name || "")) === sinAcentos(e))) {
          const r = adminDb.collection("agency_tags").doc();
          await r.set({ id: r.id, name: e, agencyId, createdAt: ahora.toISOString() });
        }
      } catch {
        /* sin catalogo no pasa nada: la etiqueta ya esta en el contacto */
      }
    }
  }

  if (yaExistia) {
    return { status: 200, body: { success: true, leadId: clientId, dealId, yaExistia: true, ...(formatoNuevo ? { tratoNuevo } : {}) } };
  }
  return { status: 201, body: { success: true, leadId: clientId, dealId, ...(formatoNuevo ? { yaExistia: false, tratoNuevo } : {}) } };
}
