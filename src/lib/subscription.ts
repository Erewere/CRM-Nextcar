/**
 * Reglas de acceso por suscripcion, en un solo lugar.
 *
 * Antes este calculo estaba repetido en useReadOnly, App y Layout, y en las
 * tres copias se consultaba primero createdAt y solo despues trialEndsAt.
 * Como createdAt siempre existe, trialEndsAt nunca llegaba a leerse y las
 * prorrogas de prueba no surtian efecto.
 */

const DURACION_PRUEBA_DIAS = 30;
const MS_POR_DIA = 24 * 60 * 60 * 1000;

/** Acepta Timestamp de Firestore, {seconds}, Date o cadena ISO. */
export function toDate(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val.toDate === "function") {
    const d = val.toDate();
    return isNaN(d.getTime()) ? null : d;
  }
  if (val.seconds) return new Date(val.seconds * 1000);
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Fecha en que termina la prueba. Manda trialEndsAt cuando existe, para que
 * una prorroga concedida desde el panel se respete; si no hay, se calcula a
 * partir de la fecha de alta.
 */
export function getTrialEnd(agencyData: any): Date | null {
  if (!agencyData) return null;

  const explicito = toDate(agencyData.trialEndsAt);
  if (explicito) return explicito;

  const creada = toDate(agencyData.createdAt);
  if (creada) return new Date(creada.getTime() + DURACION_PRUEBA_DIAS * MS_POR_DIA);

  return null;
}

/** Dias que faltan para que termine la prueba; null si no esta en prueba. */
export function getTrialDaysLeft(agencyData: any): number | null {
  if (agencyData?.subscriptionStatus !== "trialing") return null;
  const fin = getTrialEnd(agencyData);
  if (!fin) return null;
  return Math.max(0, Math.ceil((fin.getTime() - Date.now()) / MS_POR_DIA));
}

/** True si la agencia puede operar: acceso gratuito, suscripcion activa o prueba vigente. */
export function hasActiveAccess(agencyData: any): boolean {
  if (!agencyData) return false;
  if (agencyData.hasFreeAccess) return true;
  if (agencyData.subscriptionStatus === "active") return true;

  if (agencyData.subscriptionStatus === "trialing") {
    const fin = getTrialEnd(agencyData);
    if (fin && fin > new Date()) return true;
  }

  return false;
}
