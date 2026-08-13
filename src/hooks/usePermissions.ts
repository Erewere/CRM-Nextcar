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
    if (puedeRol(rol, permiso)) return true;

    // Excepciones heredadas, previas al catalogo: dos banderas por usuario que
    // amplian lo que puede un vendedor. Se conservan para no retirarle
    // capacidades a quien hoy las tiene. Quedan aqui, en un solo lugar, hasta
    // decidir si esos usuarios pasan a un rol que ya las incluya.
    if (rol === "seller") {
      const u = userData as any;
      if (u?.canManageVehicles && (permiso === "vehiculos.crear" || permiso === "vehiculos.editar")) {
        return true;
      }
      if (u?.canManageExpenses && (permiso === "gastos.ver" || permiso === "gastos.crear")) {
        return true;
      }
    }

    return false;
  };

  return { can, rol, isReadOnly };
}
