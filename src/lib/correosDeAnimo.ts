import { CONTACTO } from "./plantillasCorreo";

/**
 * Correos de animo y resumen semanal.
 *
 * Calculo puro: recibe las metricas de la plataforma y decide a quien le toca
 * que correo, y como se ve. Sin Firestore ni envio aqui dentro, para poder
 * probarlo antes de que salga un solo correo real.
 *
 * PRIVACIDAD. Los correos solo llevan numeros: cuantos tratos abiertos,
 * cuantas ventas. Nunca el nombre de un cliente, un telefono o un auto. Los
 * correos se reenvian y se quedan en bandejas para siempre.
 *
 * Nadie recibe dos correos la misma semana: al estancado le llega el de animo
 * EN LUGAR del resumen, y ese ya lleva sus numeros. Dos correos seguidos a
 * alguien que se esta alejando lo empujan a darse de baja.
 */

export type TipoCorreo = "semanal" | "animo";

const DIA = 86_400_000;
/** Minimo entre dos correos a la misma persona. Protege del doble clic y de
 *  un envio automatico que se repita tras reiniciar el servidor. */
export const DIAS_ENTRE_CORREOS = 6;
/** Una cuenta recien creada no es "estancada": se le da su primera semana. */
const DIAS_DE_GRACIA = 7;
const ROLES_QUE_RECIBEN = new Set(["admin", "manager", "seller"]);

// Colores del Manual de marca v1.0 (septiembre 2026, en Recursos de Marca).
// La aguja roja es el unico punto de color de la marca: el rojo va en el
// boton de accion y en texto de acento, nunca de relleno. Y dos colores de
// fondo por pieza como maximo: negro y blanco.
const NEGRO = "#0F0F10";
const ROJO_AGUJA = "#D6402A"; // botones de accion
const ROJO_TEXTO = "#A82A17"; // texto rojo sobre fondo claro
const ROJO_CLARO = "#F2705B"; // texto rojo sobre fondo oscuro
const CUERPO = "#4A463F";
const LINEA = "#DAD6CE";
const BLANCO = "#FFFFFF";
// Manrope es la unica familia de la marca. Gmail la ignora y cae al sistema;
// Apple Mail y los demas la muestran.
const FUENTE = "'Manrope',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
// Version principal del logo: sobre oscuro, en encabezado y pie. Fundido
// sobre el negro de la marca, sin transparencia, para que ningun modo oscuro
// de un cliente de correo lo haga desaparecer.
const LOGO = `${CONTACTO.crm}/logo/lockup-correo-oscuro.jpg`;

export interface DatosCorreo {
  tipo: TipoCorreo;
  nombre: string;
  esAdmin: boolean;
  agencia: string;
  nunca: boolean;
  diasSinActividad: number | null;
  tratosAbiertos: number;
  tratosNuevos7: number;
  ventas7: number;
  ventas30: number;
  tareasVencidas: number;
  datos7: number;
  equipoActivo?: number;
  equipoTotal?: number;
  /** Consejo de la semana: el mismo para todos esa semana. */
  consejo: number;
}

export interface Destinatario {
  uid: string;
  nombre: string;
  correo: string;
  rol: string;
  agencyId: string;
  agencia: string;
  /** null = esta semana no le toca, y `motivo` dice por que. */
  tipo: TipoCorreo | null;
  motivo: string;
  datos: DatosCorreo | null;
}

function nombreDePila(nombre: string): string {
  const limpio = String(nombre || "").trim();
  if (!limpio || limpio.includes("@")) return "";
  return limpio.split(/\s+/)[0];
}

export function destinatariosDeLaSemana(
  metricas: { agencias: any[]; usuarios: any[] },
  ahora: number,
  ultimoEnvio: Record<string, number> = {},
): Destinatario[] {
  const agencias = new Map<string, any>(metricas.agencias.map((a) => [a.id, a]));
  const consejo = Math.floor(ahora / (7 * DIA)) % CONSEJOS.length;

  // Cuantos de cada equipo metieron datos esta semana, para el correo del admin.
  const equipo = new Map<string, { activos: number; total: number }>();
  for (const u of metricas.usuarios) {
    // Solo quien vende. El taller no mete clientes: contarlo haria ver al
    // equipo mas flojo de lo que es.
    if (!u.agencyId || !ROLES_QUE_RECIBEN.has(u.rol)) continue;
    const e = equipo.get(u.agencyId) || { activos: 0, total: 0 };
    e.total++;
    if (u.datos7 > 0) e.activos++;
    equipo.set(u.agencyId, e);
  }

  return metricas.usuarios
    .filter((u) => ROLES_QUE_RECIBEN.has(u.rol))
    .map((u): Destinatario => {
      const a = agencias.get(u.agencyId);
      const base = {
        uid: u.id,
        nombre: u.nombre,
        correo: u.correo,
        rol: u.rol,
        agencyId: u.agencyId,
        agencia: a?.nombre || "Sin agencia",
      };
      const no = (motivo: string): Destinatario => ({ ...base, tipo: null, motivo, datos: null });

      if (!a) return no("No pertenece a ninguna agencia");
      // Mandarle "tus tratos abiertos" a quien no puede entrar solo frustra.
      if (a.estado === "sin acceso") return no("Su agencia no tiene acceso");
      if (!u.recibeCorreos) return no("Se dio de baja de estos correos");
      if (!u.correo) return no("No tiene correo");

      const enviado = ultimoEnvio[u.id];
      if (enviado != null && ahora - enviado < DIAS_ENTRE_CORREOS * DIA) {
        const hace = Math.floor((ahora - enviado) / DIA);
        return no(hace === 0 ? "Ya recibió uno hoy" : `Ya recibió uno hace ${hace} día${hace === 1 ? "" : "s"}`);
      }

      const creado = u.creadoEl ? Date.parse(u.creadoEl) : null;
      if (creado != null && ahora - creado < DIAS_DE_GRACIA * DIA) {
        return no("Cuenta nueva: se le da su primera semana");
      }

      // El admin no suele meter datos: los mete su equipo. Si la agencia se
      // mueve, el admin no esta "estancado" aunque el no anote nada.
      const esAdmin = u.rol === "admin" || u.rol === "manager";
      const fuente = esAdmin ? a : u;
      const estancado = fuente.actividad === "estancada" || fuente.actividad === "nunca";
      const e = equipo.get(u.agencyId);

      const datos: DatosCorreo = {
        tipo: estancado ? "animo" : "semanal",
        nombre: nombreDePila(u.nombre),
        esAdmin,
        agencia: a.nombre,
        nunca: fuente.actividad === "nunca",
        diasSinActividad: fuente.diasSinActividad,
        tratosAbiertos: fuente.tratosAbiertos || 0,
        tratosNuevos7: fuente.tratosNuevos7 || 0,
        ventas7: fuente.ventas7 || 0,
        ventas30: fuente.ventas30 || 0,
        tareasVencidas: fuente.tareasVencidas || 0,
        datos7: fuente.datos7 || 0,
        equipoActivo: esAdmin ? e?.activos ?? 0 : undefined,
        equipoTotal: esAdmin ? e?.total ?? 0 : undefined,
        consejo,
      };

      const motivo = !estancado
        ? "Resumen de la semana"
        : datos.nunca
        ? esAdmin
          ? "Su agencia nunca ha metido datos"
          : "Nunca ha metido datos"
        : esAdmin
        ? `Su agencia lleva ${datos.diasSinActividad} días sin datos`
        : `${datos.diasSinActividad} días sin meter datos`;

      return { ...base, tipo: datos.tipo, motivo, datos };
    });
}

// ---------------------------------------------------------------------------
// Consejos: solo cosas que el CRM de verdad hace hoy.

const CONSEJOS: { titulo: string; texto: string }[] = [
  {
    titulo: "Mueve tus tratos desde el celular",
    texto: "En el Embudo toca la tarjeta del cliente y elige la etapa. No hace falta arrastrar ni estar en la computadora.",
  },
  {
    titulo: "Agenda el seguimiento antes de colgar",
    texto: "En la ficha del cliente escribe la tarea y ponle fecha y hora. El CRM te avisa en la campanita cuando toca.",
  },
  {
    titulo: "Anota qué busca cada cliente",
    texto: "Tipo de auto, presupuesto, plazas y transmisión. Cuando entra al inventario un auto que le queda, el CRM te lo marca.",
  },
  {
    titulo: "Manda la ficha del auto con tu logo",
    texto: "Desde Inventario abre el auto y descarga su ficha en PDF, con los datos de tu agencia y tu teléfono. Lista para WhatsApp.",
  },
  {
    titulo: "Da de alta al cliente con su etapa",
    texto: "Si al crear el contacto eliges una etapa, entra directo a tu embudo con su trato. Un paso menos.",
  },
  {
    titulo: "Cierra la venta en el CRM",
    texto: "Al marcar un trato como ganado queda el registro de la venta y sus pagos, y el auto deja de aparecer como disponible.",
  },
  {
    titulo: "Empieza el día por las vencidas",
    texto: "En Tareas y Calendario ves primero lo que se te pasó. Un cliente que espera tu llamada dos días ya está viendo otro auto.",
  },
  {
    titulo: "Las etiquetas te ordenan la cartera",
    texto: "Marca a tus clientes por origen o por lo que buscan, y filtra en Personas en un segundo cuando lanzas una promoción.",
  },
];

// ---------------------------------------------------------------------------
// Armado del correo, con el Manual de marca.

function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** Antetitulo: 700, caja alta, +0.16 em. Rojo texto sobre claro. */
const antetitulo = (t: string) =>
  `<div style="font-family:${FUENTE};font-size:12px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:${ROJO_TEXTO};margin:0 0 10px;">${esc(t)}</div>`;

/** Titulo: 800, -0.02 em. */
const titulo = (t: string) =>
  `<h1 style="font-family:${FUENTE};font-size:27px;font-weight:800;letter-spacing:-0.02em;line-height:1.2;color:${NEGRO};margin:0 0 22px;">${esc(t)}</h1>`;

const p = (html: string, extra = "") =>
  `<p style="font-family:${FUENTE};margin:0 0 16px;color:${CUERPO};font-size:15px;line-height:1.65;${extra}">${html}</p>`;

const fuerte = (t: string | number) => `<strong style="color:${NEGRO};font-weight:700;">${t}</strong>`;

/** El boton de accion: el unico otro elemento rojo que permite el manual. */
function boton(texto: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 8px;">
    <tr><td style="background:${ROJO_AGUJA};border-radius:8px;">
      <a href="${esc(url)}" style="display:inline-block;padding:14px 30px;font-family:${FUENTE};color:${BLANCO};font-size:15px;font-weight:700;letter-spacing:0.01em;text-decoration:none;">${esc(texto)}</a>
    </td></tr>
  </table>`;
}

/** Cuadricula 2 x 2 en blanco con linea. Tablas: lo unico que respetan Outlook y Gmail. */
function cifras(items: [string, number, boolean?][]): string {
  const celda = ([etiqueta, valor, alerta]: [string, number, boolean?]) =>
    `<td width="50%" style="padding:5px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BLANCO};border:1px solid ${LINEA};border-radius:8px;">
        <tr><td style="padding:16px 18px;">
          <div style="font-family:${FUENTE};font-size:30px;font-weight:800;letter-spacing:-0.02em;color:${alerta ? ROJO_TEXTO : NEGRO};line-height:1;">${valor}</div>
          <div style="font-family:${FUENTE};font-size:12px;font-weight:500;color:${CUERPO};margin-top:8px;">${esc(etiqueta)}</div>
        </td></tr>
      </table>
    </td>`;
  const filas: string[] = [];
  for (let i = 0; i < items.length; i += 2) {
    filas.push(`<tr>${celda(items[i])}${items[i + 1] ? celda(items[i + 1]) : '<td width="50%"></td>'}</tr>`);
  }
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:2px -5px 20px;">${filas.join("")}</table>`;
}

/** Aviso: sin relleno de color; una raya negra y la cifra en rojo texto. */
function aviso(html: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:2px 0 20px;">
    <tr><td style="border-left:3px solid ${NEGRO};padding:4px 0 4px 16px;font-family:${FUENTE};color:${CUERPO};font-size:15px;line-height:1.6;">${html}</td></tr>
  </table>`;
}

function consejoHtml(i: number): string {
  const c = CONSEJOS[i % CONSEJOS.length];
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:10px 0 4px;border-top:1px solid ${LINEA};">
    <tr><td style="padding:22px 0 0;">
      <div style="font-family:${FUENTE};font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:${ROJO_TEXTO};">Consejo de la semana</div>
      <div style="font-family:${FUENTE};font-size:16px;font-weight:800;letter-spacing:-0.01em;color:${NEGRO};margin-top:8px;">${esc(c.titulo)}</div>
      <div style="font-family:${FUENTE};font-size:14px;color:${CUERPO};line-height:1.6;margin-top:4px;">${esc(c.texto)}</div>
    </td></tr>
  </table>`;
}

function pasos(items: string[]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;">${items
    .map(
      (t, i) => `<tr>
        <td valign="top" style="width:30px;padding:6px 0;"><div style="width:24px;height:24px;border-radius:12px;background:${NEGRO};color:${BLANCO};font-family:${FUENTE};font-size:12px;font-weight:800;text-align:center;line-height:24px;">${i + 1}</div></td>
        <td style="padding:6px 0 6px 10px;font-family:${FUENTE};color:${CUERPO};font-size:15px;line-height:1.5;">${t}</td>
      </tr>`,
    )
    .join("")}</table>`;
}

function envoltura(tituloDoc: string, cuerpo: string, enlaceBaja: string): string {
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;700;800&display=swap" rel="stylesheet">
<title>${esc(tituloDoc)}</title></head>
<body style="margin:0;padding:0;background:${BLANCO};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BLANCO};padding:24px 10px;">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:${BLANCO};border:1px solid ${LINEA};border-radius:12px;overflow:hidden;">
    <tr><td style="background:${NEGRO};padding:38px 40px;">
      <a href="${esc(CONTACTO.crm)}" style="text-decoration:none;">
        <img src="${esc(LOGO)}" width="220" height="46" alt="Nextcar CRM" style="display:block;border:0;outline:none;width:220px;height:46px;">
      </a>
    </td></tr>
    <tr><td style="padding:38px 40px 14px;">${cuerpo}</td></tr>
    <tr><td style="background:${NEGRO};padding:30px 40px 32px;">
      <p style="font-family:${FUENTE};margin:0 0 8px;color:${BLANCO};font-size:14px;font-weight:700;">¿Algo no te funciona? Contesta este correo y te ayudamos.</p>
      <p style="font-family:${FUENTE};margin:0 0 22px;color:${LINEA};font-size:14px;line-height:1.7;">
        ${esc(CONTACTO.nombre)} · WhatsApp
        <a href="${esc(CONTACTO.whatsappEnlace)}" style="color:${ROJO_CLARO};text-decoration:none;font-weight:700;">${esc(CONTACTO.whatsapp)}</a>
      </p>
      <p style="font-family:${FUENTE};margin:0;color:${LINEA};font-size:12px;line-height:1.6;">
        Te llega porque tienes una cuenta en Nextcar CRM.
        <a href="${esc(enlaceBaja)}" style="color:${LINEA};text-decoration:underline;">Dejar de recibir estos correos</a>.
      </p>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

export function armarCorreo(d: DatosCorreo, enlaceBaja: string): { asunto: string; html: string; texto: string } {
  const hola = d.nombre ? `Hola ${esc(d.nombre)},` : "Hola,";
  const c = CONSEJOS[d.consejo % CONSEJOS.length];
  const lineas: string[] = []; // version en texto plano, para los que no leen HTML
  let asunto: string;
  let cuerpo: string;

  const vencidas = (quien: "tu" | "agencia") =>
    d.tareasVencidas > 0
      ? aviso(
          quien === "tu"
            ? `Tienes <strong style="color:${ROJO_TEXTO};">${plural(d.tareasVencidas, "seguimiento vencido", "seguimientos vencidos")}</strong>. Un cliente sin seguimiento se enfría rápido: dale una llamada hoy.`
            : `Hay <strong style="color:${ROJO_TEXTO};">${plural(d.tareasVencidas, "seguimiento vencido", "seguimientos vencidos")}</strong> en la agencia. Cada uno es un cliente esperando una llamada.`,
        )
      : "";

  if (d.tipo === "semanal") {
    const numeros = cifras([
      ["Tratos abiertos", d.tratosAbiertos],
      ["Tratos nuevos esta semana", d.tratosNuevos7],
      ["Ventas esta semana", d.ventas7],
      ["Ventas en 30 días", d.ventas30],
    ]);
    if (d.esAdmin) {
      asunto =
        d.ventas7 > 0
          ? `${d.agencia} cerró ${plural(d.ventas7, "venta", "ventas")} esta semana`
          : `Así va ${d.agencia} esta semana`;
      const equipo =
        d.equipoTotal && d.equipoTotal > 1
          ? p(
              `Tu equipo: ${fuerte(`${d.equipoActivo} de ${d.equipoTotal}`)} metieron datos esta semana.` +
                (d.equipoActivo! < d.equipoTotal ? ` Vale la pena preguntarle a los demás si necesitan una mano.` : ""),
            )
          : "";
      cuerpo =
        antetitulo(`Resumen de ${d.agencia}`) +
        titulo(d.ventas7 > 0 ? `${plural(d.ventas7, "venta", "ventas")} esta semana` : "Así va tu agencia") +
        p(hola) +
        p(d.ventas7 > 0 ? `Buena semana en ${fuerte(esc(d.agencia))}. Así se ve en números:` : `Así quedó la semana en ${fuerte(esc(d.agencia))}:`) +
        numeros +
        equipo +
        vencidas("agencia") +
        consejoHtml(d.consejo) +
        boton("Abrir el CRM", CONTACTO.crm);
      lineas.push(`Así va ${d.agencia} esta semana:`);
      if (d.equipoTotal && d.equipoTotal > 1) lineas.push(`Tu equipo: ${d.equipoActivo} de ${d.equipoTotal} metieron datos esta semana.`);
    } else {
      asunto =
        d.ventas7 > 0
          ? `${d.nombre ? d.nombre + ", c" : "C"}erraste ${plural(d.ventas7, "venta", "ventas")} esta semana`
          : d.tratosNuevos7 > 0
          ? `Tu semana: ${plural(d.tratosNuevos7, "trato nuevo", "tratos nuevos")} en Nextcar`
          : `Tu resumen de la semana en Nextcar`;
      cuerpo =
        antetitulo("Tu semana en Nextcar") +
        titulo(
          d.ventas7 > 0
            ? `Cerraste ${plural(d.ventas7, "venta", "ventas")}`
            : d.tratosNuevos7 > 0
            ? plural(d.tratosNuevos7, "trato nuevo", "tratos nuevos")
            : "Así quedó tu semana",
        ) +
        p(hola) +
        p(d.ventas7 > 0 ? `Cerraste ${fuerte(plural(d.ventas7, "venta", "ventas"))} esta semana. Así se ve tu Nextcar:` : `Así quedó tu semana en Nextcar CRM:`) +
        numeros +
        vencidas("tu") +
        consejoHtml(d.consejo) +
        boton("Abrir mi CRM", CONTACTO.crm);
      lineas.push(`Así quedó tu semana en Nextcar CRM:`);
    }
    lineas.push(
      `- Tratos abiertos: ${d.tratosAbiertos}`,
      `- Tratos nuevos esta semana: ${d.tratosNuevos7}`,
      `- Ventas esta semana: ${d.ventas7}`,
      `- Ventas en 30 días: ${d.ventas30}`,
    );
    if (d.tareasVencidas > 0) lineas.push(`Seguimientos vencidos: ${d.tareasVencidas}.`);
  } else {
    // Animo. Sin regaños: la historia es de Nextcar, no un reproche.
    const historia = p(
      `En Nextcar lo aprendimos a la mala: en una campaña juntamos ${fuerte("81 conversaciones")} y cerramos ${fuerte("1 venta")}. No faltaban interesados; el seguimiento se perdía en el camino. Un cliente que no se anota es un cliente que se olvida.`,
    );
    const esperando =
      d.tratosAbiertos > 0 || d.tareasVencidas > 0
        ? p(fuerte(d.esAdmin ? "Lo que tiene tu equipo esperando" : "Lo que tienes esperando"), "margin-bottom:8px;") +
          cifras([
            ["Tratos abiertos", d.tratosAbiertos],
            ["Seguimientos vencidos", d.tareasVencidas, d.tareasVencidas > 0],
          ])
        : "";
    const historiaTexto =
      "En Nextcar lo aprendimos a la mala: en una campaña juntamos 81 conversaciones y cerramos 1 venta. El seguimiento se perdía en el camino.";

    if (d.esAdmin) {
      asunto = d.nunca
        ? `${d.agencia} todavía no registra su primer cliente en Nextcar`
        : d.tratosAbiertos > 0
        ? `${d.agencia} tiene ${plural(d.tratosAbiertos, "trato esperando", "tratos esperando")} seguimiento`
        : `¿Cómo van las ventas en ${d.agencia}?`;
      cuerpo =
        antetitulo(d.agencia) +
        titulo(d.nunca ? "Tu agencia está lista para arrancar" : d.tratosAbiertos > 0 ? "Tu equipo tiene clientes esperando" : "¿Cómo va el piso de ventas?") +
        p(hola) +
        p(
          d.nunca
            ? `La cuenta de ${fuerte(esc(d.agencia))} en Nextcar CRM ya está lista, pero todavía no hay ningún cliente registrado.`
            : `${fuerte(esc(d.agencia))} lleva ${d.diasSinActividad} días sin movimiento en Nextcar CRM.`,
        ) +
        historia +
        esperando +
        p(fuerte("Tres cosas para que tu equipo lo retome:"), "margin-bottom:6px;") +
        pasos([
          "Pídele a tu equipo que anote a cada cliente del día, aunque sea solo nombre y teléfono.",
          `Si alguien de tu equipo no tiene cuenta, invítalo desde ${fuerte("Agencias &amp; Usuarios")}.`,
          "Revisa el Embudo una vez al día: en dos minutos ves qué trato lleva días sin moverse.",
        ]) +
        consejoHtml(d.consejo) +
        boton("Entrar a Nextcar CRM", CONTACTO.crm);
      lineas.push(
        d.nunca
          ? `La cuenta de ${d.agencia} en Nextcar CRM ya está lista, pero todavía no hay ningún cliente registrado.`
          : `${d.agencia} lleva ${d.diasSinActividad} días sin movimiento en Nextcar CRM.`,
        "",
        historiaTexto,
        "",
        "Tres cosas para que tu equipo lo retome:",
        "1. Que anoten a cada cliente del día, aunque sea solo nombre y teléfono.",
        "2. Invita a quien no tenga cuenta desde Agencias & Usuarios.",
        "3. Revisa el Embudo una vez al día.",
      );
    } else {
      asunto = d.nunca
        ? `${d.nombre ? d.nombre + ", tu" : "Tu"} Nextcar CRM te está esperando`
        : d.tratosAbiertos > 0
        ? `Tienes ${plural(d.tratosAbiertos, "trato esperando", "tratos esperando")} seguimiento`
        : `${d.nombre ? d.nombre + ", ¿cómo" : "¿Cómo"} van las ventas?`;
      cuerpo =
        antetitulo("Nextcar CRM") +
        titulo(d.nunca ? "Tu cuenta está lista" : d.tratosAbiertos > 0 ? "Tus clientes te esperan" : "¿Retomamos?") +
        p(hola) +
        p(
          d.nunca
            ? "Tu cuenta en Nextcar CRM ya está lista, pero todavía no registras ningún cliente."
            : `Hace ${fuerte(`${d.diasSinActividad} días`)} que no anotas nada en Nextcar CRM.`,
        ) +
        historia +
        esperando +
        p(fuerte("Tres cosas de un minuto para retomar:"), "margin-bottom:6px;") +
        pasos([
          "Anota al último cliente que te escribió, con el auto que le interesa.",
          "Mueve un trato de etapa. Desde el celular basta con tocar la tarjeta.",
          "Agenda tu próximo seguimiento para no depender de la memoria.",
        ]) +
        consejoHtml(d.consejo) +
        boton("Entrar a Nextcar CRM", CONTACTO.crm);
      lineas.push(
        d.nunca
          ? "Tu cuenta en Nextcar CRM ya está lista, pero todavía no registras ningún cliente."
          : `Hace ${d.diasSinActividad} días que no anotas nada en Nextcar CRM.`,
        "",
        historiaTexto,
        "",
        "Tres cosas de un minuto para retomar:",
        "1. Anota al último cliente que te escribió.",
        "2. Mueve un trato de etapa.",
        "3. Agenda tu próximo seguimiento.",
      );
    }
    if (d.tratosAbiertos > 0) lineas.push(`Tratos abiertos esperando: ${d.tratosAbiertos}.`);
  }

  const texto = [
    d.nombre ? `Hola ${d.nombre},` : "Hola,",
    "",
    ...lineas,
    "",
    `Consejo de la semana: ${c.titulo}. ${c.texto}`,
    "",
    `Entra aquí: ${CONTACTO.crm}`,
    "",
    `¿Algo no te funciona? Contesta este correo o escríbenos por WhatsApp al ${CONTACTO.whatsapp}.`,
    "",
    `Dejar de recibir estos correos: ${enlaceBaja}`,
  ].join("\n");

  return { asunto, html: envoltura(asunto, cuerpo, enlaceBaja), texto };
}
