/**
 * Que le pasa al vehiculo cuando se cierra una venta.
 *
 * Una venta se puede cerrar desde tres sitios -- el embudo, la ficha del
 * contacto y la del propio auto -- y cada uno escribia su propia version de
 * "vendido". Cuando las versiones no coinciden, el auto acaba en un estado
 * que ninguna pantalla sabe leer: el trato dice ganado y el inventario dice
 * disponible. Aqui vive la respuesta unica.
 */

export type DatosDeVenta = {
  clientId?: string | null;
  clientName?: string | null;
  dealId?: string | null;
  precio: number;
  saleDetails?: any;
};

/**
 * Quien cierra la venta, ¿puede confirmarla sin que otro la apruebe?
 *
 * La aprobacion existe para que un vendedor no marque autos como vendidos por
 * su cuenta, sobre todo a un precio distinto del de lista. Un administrador o
 * el dueño no se aprueban a si mismos: ese paso intermedio es justo el que se
 * olvidaba y dejaba el auto disponible despues de haberlo vendido.
 */
export function puedeVenderSinAprobacion(rol?: string | null): boolean {
  return rol === 'admin' || rol === 'master';
}

/**
 * ¿Este contacto (o este trato) es el comprador que tiene registrado el auto?
 *
 * Hace falta preguntarlo porque el documento del vehiculo lo comparten todos
 * los interesados: varias personas pueden llevar el mismo `vehicleId` mientras
 * andan viendo la misma unidad, y solo una lo compro. Escribir el historial de
 * pagos de cualquiera de ellas en el auto pisa el del comprador de verdad, y
 * de ahi vuelve a salir hacia los demas.
 *
 * Si el auto no dice a quien se lo vendieron, la respuesta es que no. Un dato
 * viejo o incompleto no es permiso para escribir encima del historial de una
 * venta: como mucho el auto se queda con un dato desactualizado, que se corrige
 * mirando, mientras que lo otro corrompe registros en silencio.
 */
export function esElCompradorDelVehiculo(
  vehiculo: any,
  clientId?: string | null,
  dealId?: string | null
): boolean {
  if (!vehiculo) return false;
  if (dealId && vehiculo.soldDealId) return vehiculo.soldDealId === dealId;
  if (!clientId) return false;
  return vehiculo.soldToClientId === clientId || vehiculo.buyerId === clientId;
}

/** Lo que se escribe en el vehiculo cuando la venta ya es firme. */
export function vehiculoVendido(v: DatosDeVenta) {
  const hoy = new Date().toISOString().split('T')[0];
  const detalles = v.saleDetails
    ? { ...v.saleDetails, price: v.precio }
    : { price: v.precio, method: 'contado' };

  const payload: any = {
    status: 'sold',
    price: v.precio,
    soldAt: hoy,
    saleDetails: detalles,
    // Si habia una solicitud pendiente, esta venta la resuelve.
    pendingValidation: null,
    updatedAt: new Date().toISOString(),
  };

  if (v.clientId) {
    payload.buyerId = v.clientId;
    payload.soldToClientId = v.clientId;
  }
  if (v.clientName) payload.buyerName = v.clientName;
  // Sin esta referencia la ficha del auto no sabe a que trato pertenece su
  // propia venta, y vuelve a pedir que se le asigne una cada vez que se abre.
  if (v.dealId) payload.soldDealId = v.dealId;

  return payload;
}
