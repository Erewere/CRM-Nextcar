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
