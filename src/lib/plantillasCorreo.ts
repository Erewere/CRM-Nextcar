/**
 * Los correos que manda el CRM por su cuenta.
 *
 * Viven aparte del servidor a proposito: son texto que un humano va a leer y
 * que se va a querer retocar sin entrar en la logica de crear usuarios. Aqui
 * solo se arma el mensaje; quien lo envia es `server.ts`.
 *
 * Se escriben con estilos dentro de cada etiqueta y con tablas, que es feo de
 * leer pero es lo unico que respetan los programas de correo: Outlook y Gmail
 * recortan las hojas de estilo y no entienden flexbox.
 */

const AZUL = "#2563eb";
const TINTA = "#0f172a";
const GRIS = "#64748b";
const BORDE = "#e2e8f0";

/**
 * Contacto de Nextcar que aparece al pie de todos los correos.
 *
 * Va a nombre del equipo y no de una persona: quien recibe esto es un cliente
 * nuevo, y si el dia de mañana contesta alguien mas, el correo no se queda
 * desmintiendose a si mismo.
 */
export const CONTACTO = {
  nombre: "Equipo Nextcar",
  correo: "contacto@erewere.com",
  // Dos formas del mismo numero: una para leerla y otra para el enlace, que
  // exige el codigo de pais y sin espacios.
  whatsapp: "461 239 9969",
  whatsappEnlace: "https://wa.me/524612399969",
  sitio: "https://nextcar.erewere.com",
  crm: "https://crm.erewere.com",
};

/**
 * El nombre de alguien puede traer `<`, `&` o comillas. Sin escaparlos, un
 * apellido con un simbolo raro rompe el correo entero o, peor, deja meter
 * etiquetas en un mensaje que sale a nombre de la empresa.
 */
function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function boton(texto: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0;">
    <tr><td style="background:${AZUL};border-radius:10px;">
      <a href="${esc(url)}" style="display:inline-block;padding:14px 28px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;">${esc(texto)}</a>
    </td></tr>
  </table>`;
}

function dato(etiqueta: string, valor: string): string {
  return `<tr>
    <td style="padding:6px 0;color:${GRIS};font-size:13px;width:110px;">${esc(etiqueta)}</td>
    <td style="padding:6px 0;color:${TINTA};font-size:15px;font-weight:600;">${esc(valor)}</td>
  </tr>`;
}

/** Lo que hace el CRM, dicho para quien vende autos. */
const PARA_QUE_SIRVE = `
  <p style="margin:0 0 12px;color:${TINTA};font-size:15px;line-height:1.6;">
    Nextcar CRM es donde va a vivir tu operación diaria:
  </p>
  <ul style="margin:0 0 20px;padding-left:20px;color:${TINTA};font-size:15px;line-height:1.7;">
    <li>Tus <strong>autos</strong>, con fotos, precio, gastos y a quién se le vendió.</li>
    <li>Tus <strong>clientes</strong>, y en qué punto va cada uno: quién apenas preguntó, quién ya vino a verlo y quién está por firmar.</li>
    <li>Tus <strong>pagos</strong>, incluidas las mensualidades de los créditos, con aviso de quién te debe.</li>
    <li>Tus <strong>citas</strong>, con recordatorio antes de cada una.</li>
  </ul>
  <p style="margin:0 0 12px;color:${GRIS};font-size:14px;line-height:1.6;">
    La idea es simple: que ningún cliente se te enfríe por olvido y que sepas
    de memoria cuánto dejó cada auto.
  </p>`;

function envoltura(
  titulo: string,
  cuerpo: string,
  pie: string = "Recibes este correo porque se creó una cuenta a tu nombre en Nextcar CRM.",
): string {
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(titulo)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 12px;">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid ${BORDE};border-radius:14px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <tr><td style="padding:26px 32px 0;">
      <span style="font-size:19px;font-weight:800;letter-spacing:-0.3px;color:${TINTA};">NEXTCAR</span><span style="font-size:19px;font-weight:800;color:#dc2626;"> CRM</span>
    </td></tr>
    <tr><td style="padding:20px 32px 8px;">${cuerpo}</td></tr>
    <tr><td style="padding:20px 32px 28px;border-top:1px solid ${BORDE};">
      <p style="margin:16px 0 6px;color:${TINTA};font-size:14px;font-weight:600;">¿Dudas? Escríbenos, contestamos rápido.</p>
      <p style="margin:0;color:${GRIS};font-size:14px;line-height:1.7;">
        ${esc(CONTACTO.nombre)}<br>
        WhatsApp: <a href="${esc(CONTACTO.whatsappEnlace)}" style="color:${AZUL};text-decoration:none;font-weight:600;">${esc(CONTACTO.whatsapp)}</a><br>
        <a href="mailto:${esc(CONTACTO.correo)}" style="color:${AZUL};text-decoration:none;">${esc(CONTACTO.correo)}</a><br>
        <a href="${esc(CONTACTO.sitio)}" style="color:${AZUL};text-decoration:none;">${esc(CONTACTO.sitio.replace(/^https?:\/\//, ""))}</a>
      </p>
    </td></tr>
  </table>
  <p style="max-width:560px;margin:14px auto 0;color:#94a3b8;font-size:12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    ${esc(pie)}
  </p>
</td></tr></table>
</body></html>`;
}

/**
 * Al administrador que acaba de registrarse el solo.
 *
 * No lleva contraseña ni liga para crearla: ya la eligio el mismo hace un
 * momento. Mandarle una liga aqui solo sembraria la duda de si la que puso
 * sirve o no.
 */
export function correoBienvenidaAdmin(d: {
  nombre: string;
  agencia: string;
  usuario: string;
}): { subject: string; html: string } {
  const cuerpo = `
    <h1 style="margin:0 0 6px;color:${TINTA};font-size:23px;font-weight:800;line-height:1.3;">
      Bienvenido, ${esc(d.nombre)}
    </h1>
    <p style="margin:0 0 22px;color:${GRIS};font-size:15px;line-height:1.6;">
      Tu CRM para <strong style="color:${TINTA};">${esc(d.agencia)}</strong> ya está listo.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#f8fafc;border:1px solid ${BORDE};border-radius:10px;padding:14px 18px;margin:0 0 24px;">
      ${dato("Entras con", d.usuario)}
      ${dato("Tu agencia", d.agencia)}
      <tr><td colspan="2" style="padding:10px 0 0;color:${GRIS};font-size:13px;line-height:1.5;">
        Tu contraseña es la que elegiste al registrarte.
      </td></tr>
    </table>

    ${PARA_QUE_SIRVE}
    ${boton("Entrar al CRM", CONTACTO.crm)}

    <p style="margin:0 0 8px;color:${GRIS};font-size:14px;line-height:1.6;">
      Un consejo para empezar: <strong style="color:${TINTA};">carga primero tus autos</strong>.
      Con el inventario dentro, todo lo demás —clientes, citas, pagos— se
      engancha solo.
    </p>`;

  return {
    subject: `Tu CRM de ${d.agencia} ya está listo`,
    html: envoltura(`Bienvenido a Nextcar CRM`, cuerpo),
  };
}

/**
 * A quien da de alta el administrador.
 *
 * Este no eligio contraseña porque no se registro el: se la crea desde la liga
 * del correo. Va una liga y no una contraseña temporal para que ninguna
 * contraseña viaje escrita en un correo, que ademas suele acabar reenviado.
 */
export function correoInvitacionEquipo(d: {
  nombre: string;
  agencia: string;
  usuario: string;
  invitadoPor: string;
  ligaContrasena: string;
}): { subject: string; html: string } {
  const cuerpo = `
    <h1 style="margin:0 0 6px;color:${TINTA};font-size:23px;font-weight:800;line-height:1.3;">
      ${esc(d.nombre)}, ya tienes acceso
    </h1>
    <p style="margin:0 0 22px;color:${GRIS};font-size:15px;line-height:1.6;">
      <strong style="color:${TINTA};">${esc(d.invitadoPor)}</strong> te agregó al
      CRM de <strong style="color:${TINTA};">${esc(d.agencia)}</strong>.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#f8fafc;border:1px solid ${BORDE};border-radius:10px;padding:14px 18px;margin:0 0 4px;">
      ${dato("Entras con", d.usuario)}
      ${dato("Tu agencia", d.agencia)}
    </table>

    <p style="margin:18px 0 0;color:${TINTA};font-size:15px;line-height:1.6;">
      Falta un paso: <strong>elige tu contraseña</strong>. Nadie más la va a
      conocer, ni siquiera quien te agregó.
    </p>
    ${boton("Crear mi contraseña", d.ligaContrasena)}
    <p style="margin:-14px 0 24px;color:${GRIS};font-size:13px;line-height:1.5;">
      Si el botón no abre, copia esta dirección en tu navegador:<br>
      <span style="color:${AZUL};word-break:break-all;">${esc(d.ligaContrasena)}</span>
    </p>

    ${PARA_QUE_SIRVE}

    <p style="margin:0 0 8px;color:${GRIS};font-size:14px;line-height:1.6;">
      Después de crear tu contraseña, entra en
      <a href="${esc(CONTACTO.crm)}" style="color:${AZUL};text-decoration:none;">${esc(CONTACTO.crm.replace(/^https?:\/\//, ""))}</a>
      con el correo de arriba.
    </p>`;

  return {
    subject: `${d.invitadoPor} te agregó al CRM de ${d.agencia}`,
    html: envoltura(`Tu acceso a Nextcar CRM`, cuerpo),
  };
}

/**
 * Invitación en frío a una agencia que todavía no usa el CRM.
 *
 * A diferencia de los correos de arriba, aquí no hay cuenta creada: quien lee
 * esto no conoce Nextcar. El correo tiene que explicarse solo, como si fuera
 * el home de una página, y la anécdota del 81-a-1 la vivimos nosotros mismos
 * vendiendo autos — no es un caso de estudio prestado.
 */
export function correoInvitacionAgencia(d: {
  agencia: string;
  ciudad?: string;
}): { subject: string; html: string } {
  const saludo = d.ciudad ? `${d.agencia} (${d.ciudad})` : d.agencia;

  const cuerpo = `
    <p style="margin:0 0 4px;color:${AZUL};font-size:13px;font-weight:700;letter-spacing:0.4px;text-transform:uppercase;">
      Una invitación de Nextcar
    </p>
    <h1 style="margin:0 0 14px;color:${TINTA};font-size:24px;font-weight:800;line-height:1.3;">
      Lo construimos para nosotros.<br>Se lo abrimos a ${esc(saludo)}.
    </h1>
    <p style="margin:0 0 22px;color:${GRIS};font-size:15px;line-height:1.65;">
      Somos una agencia de seminuevos, como la suya. Nextcar CRM nació de
      nuestra propia operación y hoy lo usamos todos los días para vender
      autos — ahora lo ponemos a disposición de otras agencias en Guanajuato
      y Querétaro.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#f8fafc;border:1px solid ${BORDE};border-radius:10px;padding:16px 18px;margin:0 0 26px;">
      <tr><td style="color:${TINTA};font-size:15px;line-height:1.6;">
        En una sola campaña generamos <strong>81 conversaciones</strong> por
        WhatsApp y Meta — y cerramos <strong>1 venta</strong>. No porque
        faltaran interesados, sino porque el seguimiento se perdía en el
        camino. <span style="color:${GRIS};">Por eso existe Nextcar CRM.</span>
      </td></tr>
    </table>

    <h2 style="margin:0 0 12px;color:${TINTA};font-size:17px;font-weight:800;">
      Qué va a encontrar ${esc(d.agencia)}
    </h2>
    <ul style="margin:0 0 24px;padding-left:20px;color:${TINTA};font-size:15px;line-height:1.8;">
      <li><strong>Tablero de negociaciones</strong> — cada cliente en su etapa, desde el primer mensaje hasta la firma, sin post-its ni WhatsApp perdido.</li>
      <li><strong>Leads automáticos de WhatsApp y Meta</strong> — entran solos al CRM; nadie los captura a mano.</li>
      <li><strong>Equipo de ventas</strong> — se asignan los clientes, se mide a cada vendedor y ninguno se queda sin dueño.</li>
      <li><strong>Inventario y pagos</strong> — autos, gastos, consignaciones y mensualidades de crédito en un solo lugar.</li>
      <li><strong>Reportes reales</strong> — qué campaña y qué vendedor están cerrando ventas de verdad.</li>
    </ul>

    <p style="margin:0 0 6px;color:${GRIS};font-size:14px;line-height:1.6;">
      Nos encantaría mostrárselo en una llamada de 15 minutos, sin costo ni compromiso.
    </p>
    ${boton("Conocer Nextcar CRM", CONTACTO.crm)}
    <p style="margin:-14px 0 0;color:${GRIS};font-size:13px;line-height:1.5;">
      ¿Prefiere WhatsApp? Escríbanos directo:
      <a href="${esc(CONTACTO.whatsappEnlace)}" style="color:${AZUL};text-decoration:none;font-weight:600;">${esc(CONTACTO.whatsapp)}</a>
    </p>`;

  return {
    subject: `${d.agencia}: el CRM que usamos en Nextcar, ahora para su agencia`,
    html: envoltura(
      `Conozca Nextcar CRM`,
      cuerpo,
      `Le escribimos porque ${esc(d.agencia)} aparece en nuestro directorio de agencias de seminuevos en Guanajuato y Querétaro. Si prefiere no recibir más correos de este tipo, respóndanos y lo quitamos de la lista.`,
    ),
  };
}
