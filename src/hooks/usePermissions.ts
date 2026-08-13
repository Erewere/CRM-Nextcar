import { useAuth } from "../contexts/AuthContext";
import { useReadOnly } from "./useReadOnly";
import { can as puedeRol, type Permiso, type Rol } from "../lib/permissions";

/**
 * Punto unico desde el que la interfaz consulta permisos.
 *
 *   const { can } = usePermissions();
 *   {can("vehiculos.costo") && <PrecioDeCompra />}
 *
 * Incluye la restriccion por suscripcion: si la agencia esta en solo lectura,
 * los permisos de escritura se niegan aunque el rol los tenga, para no tener
 * que recordar las dos condiciones en cada pantalla.
 */
export function usePermissions() {
  const { userData } = useAuth();
  const isReadOnly = useReadOnly();
  const rol = (userData?.role as Rol) || "unassigned";

  // Permisos que modifican informacion; se bloquean en modo solo lectura.
  const DE_ESCRITURA: Permiso[] = [
    "vehiculos.crear", "vehiculos.editar", "vehiculos.eliminar", "vehiculos.fotos",
    "gastos.crear",
    "contactos.editar", "contactos.reasignar",
    "tratos.gestionar", "tratos.ajenos", "ventas.cerrar",
    "pagos.gestionar", "usuarios.gestionar",
    "facturacion.gestionar", "integraciones.gestionar",
  ];

  const can = (permiso: Permiso): boolean => {
    if (isReadOnly && DE_ESCRITURA.includes(permiso)) return false;
    return puedeRol(rol, permiso);
  };

  return { can, rol, isReadOnly };
}
