/**
 * Reglas compartidas para hablar con las APIs de Google.
 *
 * Antes cada pantalla decidia por su cuenta que significaba una respuesta de
 * Google, y no todas coincidian: Correos si reconocia el permiso caducado y
 * Calendario no, de modo que a la hora de conectarse la sincronizacion dejaba
 * de funcionar sin decir por que. Estas dos respuestas viven aqui para que
 * todas las pantallas contesten lo mismo.
 */

/**
 * El permiso que da Google dura una hora y no se renueva solo. Cuando caduca,
 * Google responde 401 y nada mas va a funcionar hasta volver a conectar, asi
 * que conviene parar y decirlo.
 */
export function permisoDeGoogleVencido(res: { status: number }): boolean {
  return res.status === 401;
}

/**
 * El 403 es distinto: el permiso sirve, pero no cubre lo que se pidio. Suele
 * pasar cuando falta autorizar un servicio suelto -- Tareas, por ejemplo --
 * mientras Calendario si funciona. Parar la sincronizacion entera por eso
 * dejaria el boton inservible, asi que se anota y se sigue.
 */
export function permisoNoAlcanza(res: { status: number }): boolean {
  return res.status === 403;
}

export const AVISO_FALTAN_PERMISOS =
  'Google no dejó al CRM usar tu calendario. Vuelve a conectar tu cuenta en Integraciones y acepta el permiso del calendario.';

export const AVISO_RECONECTAR =
  'Se acabó el permiso de tu cuenta de Google. Entra a Integraciones y vuelve a conectarla; el permiso dura una hora.';

/**
 * Google identifica los eventos por un id que solo existe dentro de la cuenta
 * que los creo. Si un usuario conecta otra cuenta de Gmail, esos eventos no
 * aparecen y Google responde 404, lo mismo que responderia si el usuario los
 * hubiera borrado a proposito. Como el CRM reacciona al 404 borrando la
 * actividad, confundir los dos casos borraria actividades buenas.
 *
 * Por eso las actividades quedan marcadas con la cuenta que creo el evento y
 * solo se hace caso al 404 cuando la cuenta conectada es esa misma. Las
 * actividades viejas no traen marca; ahi no hay nada que comparar y se
 * mantiene el comportamiento de siempre.
 */
export function esLaMismaCuentaDeGoogle(
  cuentaDelEvento: string | undefined | null,
  cuentaConectada: string | null
): boolean {
  if (!cuentaDelEvento || !cuentaConectada) return true;
  return cuentaDelEvento.toLowerCase() === cuentaConectada.toLowerCase();
}

/** Datos minimos de una actividad del CRM para llevarla a Google. */
type Actividad = {
  title?: string;
  notes?: string;
  dueDate?: string;
  startTime?: string;
  endTime?: string;
  disponibilidad?: 'ocupado' | 'libre';
};

const zonaHoraria = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Suma un dia a una fecha AAAA-MM-DD sin que la zona horaria la corra. */
function diaSiguiente(fecha: string): string {
  const [a, m, d] = fecha.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + 1)).toISOString().slice(0, 10);
}

function unaHoraDespues(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return '23:59';
  return `${String((h + 1) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Arma el evento de Google que corresponde a una actividad.
 *
 * La hora de una actividad es opcional en el CRM, pero antes se metia tal cual
 * en la fecha del evento: sin hora quedaba '2026-08-19Tundefined:00', que
 * Google rechaza. Peor aun, la conversion de esa fecha para Tareas reventaba
 * antes de llegar a llamar al calendario, asi que una actividad sin hora no
 * llegaba a intentarse siquiera.
 *
 * Ahora, sin hora el evento va de dia completo -- que es lo que significa una
 * actividad sin hora -- y con hora, si no se dijo cuando termina, dura una.
 */
export function eventoDeActividad(a: Actividad) {
  if (!a.dueDate) return null;
  const base = {
    summary: (a.title || '').trim() || 'Actividad',
    description: a.notes || '',
    // Google llama 'transparent' a lo que no bloquea la agenda y 'opaque' a
    // lo que si. Sin esto, toda actividad ocupaba, y un recordatorio de
    // llamada tapaba la agenda igual que una entrega.
    transparency: a.disponibilidad === 'libre' ? 'transparent' : 'opaque',
  };

  if (!a.startTime) {
    // En los eventos de dia completo Google trata el fin como exclusivo: si
    // coincide con el inicio, rechaza la peticion.
    return { ...base, start: { date: a.dueDate }, end: { date: diaSiguiente(a.dueDate) } };
  }

  const fin = a.endTime && a.endTime > a.startTime ? a.endTime : unaHoraDespues(a.startTime);
  return {
    ...base,
    start: { dateTime: `${a.dueDate}T${a.startTime}:00`, timeZone: zonaHoraria() },
    end: { dateTime: `${a.dueDate}T${fin}:00`, timeZone: zonaHoraria() },
  };
}

/** Lo mismo para Tareas de Google. Devuelve null si la fecha no sirve. */
export function tareaDeActividad(a: Actividad) {
  if (!a.dueDate) return null;
  const cuando = new Date(`${a.dueDate}T${a.startTime || '00:00'}:00`);
  if (Number.isNaN(cuando.getTime())) return null;
  return {
    title: (a.title || '').trim() || 'Actividad',
    notes: a.notes || '',
    due: cuando.toISOString(),
  };
}

/** Una fecha AAAA-MM-DD en la zona horaria de quien mira. */
function fechaLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Una hora HH:MM en la zona horaria de quien mira. */
function horaLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * Lo que dice un evento de Google, en el lenguaje de una actividad del CRM.
 *
 * Hace falta para el camino de vuelta: si alguien mueve la cita desde su
 * calendario -- porque el cliente llamo y la cambio --, el CRM tiene que
 * enterarse. Hasta ahora solo miraba si el evento se habia cancelado y la
 * fecha nueva la ignoraba, de modo que el vendedor veia una cosa y el
 * calendario otra.
 */
export function actividadDesdeEvento(evento: any): { dueDate: string; startTime: string; endTime: string } | null {
  const inicio = evento?.start;
  if (!inicio) return null;

  // Evento de dia completo: no lleva hora.
  if (inicio.date) return { dueDate: inicio.date, startTime: '', endTime: '' };

  if (!inicio.dateTime) return null;
  const desde = new Date(inicio.dateTime);
  if (Number.isNaN(desde.getTime())) return null;

  const hasta = new Date(evento?.end?.dateTime || inicio.dateTime);
  return {
    dueDate: fechaLocal(desde),
    startTime: horaLocal(desde),
    endTime: Number.isNaN(hasta.getTime()) ? '' : horaLocal(hasta),
  };
}

/**
 * Quien manda cuando la cita cambio en los dos lados.
 *
 * Gana el que se toco mas tarde. Si al CRM le falta la marca de tiempo -- las
 * actividades viejas no la tienen -- se respeta lo que diga Google, que si la
 * trae siempre: es preferible seguir al calendario que descartar un cambio
 * real por no saber cuando ocurrio.
 */
export function mandaGoogle(evento: any, actividad: { updatedAt?: any }): boolean {
  const enGoogle = Date.parse(evento?.updated || '');
  const enElCrm = Date.parse(
    typeof actividad?.updatedAt === 'string' ? actividad.updatedAt : ''
  );
  if (!Number.isFinite(enGoogle)) return false;
  if (!Number.isFinite(enElCrm)) return true;
  return enGoogle > enElCrm;
}
