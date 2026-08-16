/**
 * Catalogo unico de permisos.
 *
 * Toda la aplicacion pregunta aqui "puede este usuario hacer X", en vez de
 * comparar roles en cada pantalla. Antes la misma pregunta se respondia en
 * casi doscientos lugares distintos y con criterios que no siempre coincidian:
 * un administrador podia reasignar un trato desde la ficha del contacto pero
 * no arrastrarlo en el embudo, porque cada archivo tenia su propia version de
 * la regla.
 *
 * Los roles son una plantilla comun para todas las agencias. Si hace falta una
 * combinacion distinta, se agrega un rol aqui y queda disponible para todas.
 */

export type Rol =
  | "master"
  | "admin"
  | "manager"
  | "seller"
  | "taller"
  | "unassigned";

export type Permiso =
  // Inventario
  | "vehiculos.ver"
  | "vehiculos.crear"
  | "vehiculos.editar"
  | "vehiculos.eliminar"
  | "vehiculos.fotos"
  | "vehiculos.precio"        // precio de venta al publico
  | "vehiculos.costo"         // precio de compra y margen
  | "vehiculos.propietario"   // quien compro el auto, desde su ficha
  | "vehiculos.compartido"    // inventario de otras agencias asociadas
  // Gastos
  | "gastos.ver"
  | "gastos.crear"
  // Contactos
  | "contactos.ver"
  | "contactos.editar"
  | "contactos.reasignar"
  // Embudo
  | "tratos.ver"
  | "tratos.gestionar"
  | "tratos.ajenos"           // operar tratos de otros asesores
  | "tratos.eliminar"         // borrar un trato: se pierde su historial
  | "ventas.cerrar"
  // Administracion de la agencia
  | "pagos.gestionar"
  | "reportes.ver"
  | "usuarios.gestionar"
  | "facturacion.gestionar"
  | "integraciones.gestionar";

/** Todo lo que puede hacerse dentro de una agencia. */
const TODOS: Permiso[] = [
  "vehiculos.ver", "vehiculos.crear", "vehiculos.editar", "vehiculos.eliminar",
  "vehiculos.fotos", "vehiculos.precio", "vehiculos.costo", "vehiculos.propietario",
  "vehiculos.compartido",
  "gastos.ver", "gastos.crear",
  "contactos.ver", "contactos.editar", "contactos.reasignar",
  "tratos.ver", "tratos.gestionar", "tratos.ajenos", "tratos.eliminar",
  "ventas.cerrar",
  "pagos.gestionar", "reportes.ver", "usuarios.gestionar",
  "facturacion.gestionar", "integraciones.gestionar",
];

const PERMISOS_POR_ROL: Record<Rol, Permiso[]> = {
  // Opera la plataforma. Su alcance sobre los datos de las agencias se acota
  // por separado; aqui se le concede todo para no romper el funcionamiento
  // actual mientras se implementa esa separacion.
  master: TODOS,

  admin: TODOS,

  manager: [
    "vehiculos.ver", "vehiculos.crear", "vehiculos.editar",
    "vehiculos.fotos", "vehiculos.precio", "vehiculos.costo", "vehiculos.propietario",
    "vehiculos.compartido",
    "gastos.ver", "gastos.crear",
    "contactos.ver", "contactos.editar", "contactos.reasignar",
    "tratos.ver", "tratos.gestionar", "tratos.ajenos", "tratos.eliminar",
    "ventas.cerrar",
    "pagos.gestionar", "reportes.ver",
  ],

  seller: [
    "vehiculos.ver", "vehiculos.fotos", "vehiculos.precio", "vehiculos.propietario",
    "contactos.ver", "contactos.editar",
    "tratos.ver", "tratos.gestionar", "ventas.cerrar",
  ],

  // Registra autos, sube fotos y captura gastos. No ve costos ni la cartera
  // de clientes; del comprador solo alcanza a verlo desde la ficha del auto.
  taller: [
    "vehiculos.ver", "vehiculos.crear", "vehiculos.editar",
    "vehiculos.fotos", "vehiculos.propietario",
    "gastos.ver", "gastos.crear",
  ],

  unassigned: [],
};

/** Nombre visible de cada rol. */
export const NOMBRE_ROL: Record<Rol, string> = {
  master: "Master",
  admin: "Administrador",
  manager: "Gerente",
  seller: "Vendedor",
  taller: "Taller",
  unassigned: "Pendiente",
};

/** Descripcion corta, para la pantalla de usuarios. */
export const DESCRIPCION_ROL: Record<Rol, string> = {
  master: "Opera la plataforma completa.",
  admin: "Control total de la agencia, incluidos usuarios y facturación.",
  manager: "Supervisa el embudo y el inventario, y ve costos y reportes.",
  seller: "Atiende sus propios clientes y tratos. No ve costos de compra.",
  taller: "Registra autos, sube fotos y captura gastos. No ve costos ni clientes.",
  unassigned: "Sin rol asignado. No puede usar el CRM.",
};

/** Roles que un administrador puede asignar dentro de su agencia. */
export const ROLES_ASIGNABLES: Rol[] = ["admin", "manager", "seller", "taller"];

/** Responde si el rol tiene concedido el permiso. */
export function can(rol: string | undefined | null, permiso: Permiso): boolean {
  if (!rol) return false;
  const permisos = PERMISOS_POR_ROL[rol as Rol];
  if (!permisos) return false;
  return permisos.includes(permiso);
}

/** Version para varios permisos: exige todos. */
export function canAll(rol: string | undefined | null, permisos: Permiso[]): boolean {
  return permisos.every((p) => can(rol, p));
}

/** Version para varios permisos: basta con uno. */
export function canAny(rol: string | undefined | null, permisos: Permiso[]): boolean {
  return permisos.some((p) => can(rol, p));
}

/** Lista completa de permisos de un rol, para mostrarla en la interfaz. */
export function permisosDe(rol: string | undefined | null): Permiso[] {
  if (!rol) return [];
  return PERMISOS_POR_ROL[rol as Rol] || [];
}
