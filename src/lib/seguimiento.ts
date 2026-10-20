/**
 * Seguimiento a quienes no responden.
 *
 * Cuando la agencia le escribió a un cliente por el chat del CRM y él no ha contestado, el CRM le programa
 * al vendedor una tarea a las 24 horas, otra a las 72 y una última a las 144 (seis días), contadas desde el
 * ÚLTIMO mensaje que la agencia mandó, cada una con un mensaje sugerido. Si el cliente contesta, las tareas
 * pendientes se quitan solas; si la agencia le vuelve a escribir, la cuenta empieza de nuevo.
 *
 * Son reglas fijas, no inteligencia artificial (el aviso de privacidad del CRM promete que nada sale a una IA):
 * el mensaje es una plantilla que el vendedor revisa y manda él.
 *
 * Ojo con WhatsApp: pasadas 24 horas desde el último mensaje DEL CLIENTE, la API solo deja mandar plantillas
 * aprobadas (que se cobran). Por eso cada tarea sugiere llamar o mandar el mensaje desde el WhatsApp del vendedor.
 */

const HORA = 3_600_000;
export const HORAS_POR_PASO = [24, 72, 144] as const;
export const VENTANA_DIAS_SEGUIMIENTO = 10;

export function pasoQueToca(p: { ahora: number; ultimoMensajeAgencia: number; pasoHecho: number }): number {
  const horas = (p.ahora - p.ultimoMensajeAgencia) / HORA;
  const objetivo = horas >= HORAS_POR_PASO[2] ? 3 : horas >= HORAS_POR_PASO[1] ? 2 : horas >= HORAS_POR_PASO[0] ? 1 : 0;
  // Si el sistema estuvo apagado y ya pasaron varios plazos, se pone solo el que corresponde ahora.
  return objetivo > p.pasoHecho ? objetivo : 0;
}

export const idTareaSeguimiento = (clientId: string, ultimoMensajeAgencia: number, paso: number) =>
  `seguimiento_${clientId}_${ultimoMensajeAgencia}_${paso}`.replace(/[^\w-]/g, '_');

const primerNombre = (n: string) => (String(n || '').trim().split(/\s+/)[0] || '');

export function tareaDeSeguimiento(p: {
  paso: number; clientId: string; agencyId: string; sellerId: string; cliente: string; auto: string;
  ultimoMensajeAgencia: number; hoy: string; ahoraIso: string;
}) {
  const nombre = primerNombre(p.cliente);
  const saludo = `Hola${nombre ? ` ${nombre}` : ''}`;
  const auto = p.auto ? ` el ${p.auto}` : ' tu búsqueda';
  const dias = Math.round(HORAS_POR_PASO[p.paso - 1] / 24);
  const mensajes = [
    `${saludo}, ¿pudiste revisar la información de${auto}? Si tienes alguna duda con gusto te ayudo.`,
    `${saludo}, te escribo para saber si sigues interesado en${auto}. Si prefieres ver otras opciones parecidas, dime qué buscas y te las paso.`,
    `${saludo}, no quiero ser insistente: ¿sigues buscando auto? Si ya no, con gusto cierro tu solicitud; y si cambió algo, aquí estoy para ayudarte.`,
  ];
  const final = p.paso === 3;
  return {
    id: idTareaSeguimiento(p.clientId, p.ultimoMensajeAgencia, p.paso),
    datos: {
      agencyId: p.agencyId, sellerId: p.sellerId, clientId: p.clientId,
      title: `Escribirle a ${p.cliente || 'el cliente'}: lleva ${dias} día${dias === 1 ? '' : 's'} sin contestar${final ? ' (último intento)' : ''}`,
      notes: `Mensaje sugerido (revísalo y mándalo tú):\n«${mensajes[p.paso - 1]}»\n\nSi ya pasaron más de 24 horas desde que el cliente escribió, WhatsApp solo permite plantillas aprobadas desde el CRM (se cobran): llámale, o mándale el mensaje desde tu WhatsApp con el botón de la ficha.${final ? '\n\nEs el último aviso automático de esta ronda: si no contesta, considera cerrarlo como «solo contacto».' : ''}`,
      dueDate: p.hoy,
      completed: false,
      type: 'message',
      seguimiento: true,
      pasoSeguimiento: p.paso,
      createdAt: p.ahoraIso,
      createdByName: 'Seguimiento automático',
    },
  };
}
