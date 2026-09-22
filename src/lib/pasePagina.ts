import { createHmac, randomBytes, timingSafeEqual } from "crypto";

/**
 * El pase con el que el CRM le dice a nextcar.erewere.com «esta persona es
 * administradora de esta agencia». Asi una agencia entra a la pagina con su
 * cuenta del CRM sin que la pagina vea nunca su contrasena (decision de Luis,
 * sep 2026: una sola cuenta, la del CRM).
 *
 * Formato: base64url(JSON) + "." + base64url(HMAC-SHA256(JSON, secreto)).
 * El secreto vive en PAGINA_NEXTCAR_SECRETO (Hostinger del CRM) y en la
 * configuracion de la pagina; lo pone Luis en los dos lados, nunca en el chat.
 * Dura dos minutos y trae un nonce para que la pagina no acepte el mismo dos
 * veces. Lo mismo firma las llamadas de la pagina al CRM (firmaDeLlamada).
 */

export const DURACION_PASE_S = 120;

/** Solo aqui puede regresar un pase: nunca a una direccion que venga en la URL. */
export const REGRESO_PAGINA = "https://www.nextcar.erewere.com/entrar-crm.php";

export interface DatosPase {
  uid: string;
  email: string;
  nombre: string;
  agencyId: string;
  agencia: string;
  rol: string;
}

const b64url = (b: Buffer) => b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const firmar = (texto: string, secreto: string) => b64url(createHmac("sha256", secreto).update(texto).digest());

export function firmarPase(datos: DatosPase, secreto: string, ahora = Date.now()): string {
  const cuerpo = JSON.stringify({
    ...datos,
    exp: Math.floor(ahora / 1000) + DURACION_PASE_S,
    nonce: b64url(randomBytes(16)),
  });
  const parte = b64url(Buffer.from(cuerpo, "utf8"));
  return `${parte}.${firmar(parte, secreto)}`;
}

/** Para pruebas y para el lado del CRM; la pagina hace lo mismo en PHP. */
export function leerPase(pase: string, secreto: string, ahora = Date.now()): (DatosPase & { exp: number; nonce: string }) | null {
  const [parte, firma] = String(pase || "").split(".");
  if (!parte || !firma) return null;
  const esperada = Buffer.from(firmar(parte, secreto));
  const recibida = Buffer.from(firma);
  if (esperada.length !== recibida.length || !timingSafeEqual(esperada, recibida)) return null;
  try {
    const datos = JSON.parse(Buffer.from(parte.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
    if (!datos.exp || datos.exp < Math.floor(ahora / 1000)) return null;
    return datos;
  } catch {
    return null;
  }
}

/**
 * Llamadas de la pagina al CRM (su inventario completo, por ejemplo): la
 * pagina manda X-Nextcar-Tiempo (segundos) y X-Nextcar-Firma =
 * HMAC(tiempo + "." + agencyId). Se aceptan cinco minutos de desfase.
 */
export function firmaDeLlamadaValida(agencyId: string, tiempo: string, firma: string, secreto: string, ahora = Date.now()): boolean {
  const t = Number(tiempo);
  if (!agencyId || !Number.isFinite(t) || Math.abs(Math.floor(ahora / 1000) - t) > 300) return false;
  const esperada = Buffer.from(firmar(`${t}.${agencyId}`, secreto));
  const recibida = Buffer.from(String(firma || ""));
  return esperada.length === recibida.length && timingSafeEqual(esperada, recibida);
}

/** Las cabeceras firmadas para llamar a la pagina (misma regla, al reves). */
export function cabecerasFirmadas(id: string, secreto: string, ahora = Date.now()): Record<string, string> {
  const t = String(Math.floor(ahora / 1000));
  return { "X-Nextcar-Tiempo": t, "X-Nextcar-Firma": firmar(`${t}.${id}`, secreto) };
}
