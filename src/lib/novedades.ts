/**
 * Novedades que se cuentan en los correos de los lunes: SOLO lo que la persona ve y puede probar, dicho como lo vería
 * ella. Nada de lo que se hizo por dentro (arreglos del servidor, seguridad, cobros): eso no le sirve a quien vende autos.
 *
 * Cómo se usa: se agrega un renglón arriba, con la fecha desde la que se cuenta y, si se quiere, hasta cuándo. Cada lunes
 * el correo lleva 3 novedades de las vigentes para esa persona, rotando, así que una semana no repite lo de la anterior
 * mientras haya más que contar. Si no hay ninguna vigente, el correo no lleva el bloque.
 *
 * Reglas para escribirlas: una frase de qué ganas, una de dónde probarlo. Sin palabras técnicas.
 */

export interface Novedad {
  id: string;
  /** Primer día (AAAA-MM-DD) en que se cuenta. */
  desde: string;
  /** Último día en que se cuenta; sin esto, 5 semanas desde `desde`. */
  hasta?: string;
  /** Quién la ve: administradores, vendedores o todos. */
  para: "todos" | "admin" | "vendedor";
  titulo: string;
  texto: string;
  /** Dónde probarla, en una línea. */
  probar: string;
}

export const NOVEDADES: Novedad[] = [
  {
    id: "antecedentes-vin",
    desde: "2026-10-23",
    para: "admin",
    titulo: "Revisa si un auto tiene reporte de robo con solo el VIN",
    texto: "Escribe el VIN al dar de alta un auto y el CRM llena sus datos y revisa REPUVE, fiscalías y avisos. Te deja una constancia lista para enseñarle al cliente. Tus primeras 3 consultas son de regalo.",
    probar: "Inventario → Nuevo auto → escribe el VIN → «Llenar con el VIN».",
  },
  {
    id: "cotizar-auto",
    desde: "2026-10-22",
    para: "todos",
    titulo: "Cotiza el auto de un cliente en segundos, estando con él",
    texto: "Dile cuánto podrías pagar por su auto y en cuánto se vendería, con la guía y el mercado a la vista.",
    probar: "En el celular toca el + y elige «Cotizar auto».",
  },
  {
    id: "inicio-lo-de-hoy",
    desde: "2026-10-21",
    para: "todos",
    titulo: "Lo primero que ves en el celular es lo que toca hacer hoy",
    texto: "Chats sin contestar, citas, tareas vencidas y pagos, de lo más urgente a lo que puede esperar. Tocas uno y vas directo a atenderlo.",
    probar: "Abre el CRM en tu celular: está en Inicio.",
  },
  {
    id: "ficha-cliente-celular",
    desde: "2026-10-22",
    para: "todos",
    titulo: "La ficha del cliente en el celular, más rápida",
    texto: "Llamas, escribes por WhatsApp, agendas y anotas desde la misma pantalla. El registro rápido queda siempre abajo, a un toque.",
    probar: "Directorio → toca cualquier cliente.",
  },
  {
    id: "enganche-por-confirmar",
    desde: "2026-10-21",
    para: "admin",
    titulo: "Los enganches que anota tu vendedor te llegan a confirmar",
    texto: "Cuando un vendedor registra una venta con enganche, te aparece un aviso para que lo confirmes como pago. Hasta entonces no suma al saldo del cliente, así que las cuentas no se inflan.",
    probar: "Mira la campanita o abre la venta desde Pagos.",
  },
  {
    id: "actualizar-celular",
    desde: "2026-10-21",
    para: "todos",
    titulo: "El CRM te avisa cuando hay una versión nueva",
    texto: "En el celular sale un aviso con el botón «Actualizar». Ya no hace falta cerrar la aplicación para ver lo nuevo.",
    probar: "Cuando salga el aviso, tócalo.",
  },
  {
    id: "borrar-consultas-precio",
    desde: "2026-10-21",
    para: "admin",
    titulo: "Borra y revisa quién consultó el precio de un auto",
    texto: "El historial de consultas de precios ahora guarda quién hizo cada una, y puedes borrar las que ya no quieres ver.",
    probar: "Inventario → Revisión de precios → Recomendar precios.",
  },
];

const DIA = 86_400_000;
const fecha = (s: string) => Date.parse(`${s}T12:00:00`);

/** Las novedades vigentes para esta persona, en el orden en que se cuentan. */
export function novedadesVigentes(esAdmin: boolean, hoy = Date.now()): Novedad[] {
  return NOVEDADES.filter((n) => {
    if (n.para === "admin" && !esAdmin) return false;
    if (n.para === "vendedor" && esAdmin) return false;
    const ini = fecha(n.desde);
    const fin = n.hasta ? fecha(n.hasta) + DIA : ini + 35 * DIA;
    return hoy >= ini && hoy < fin;
  });
}

/**
 * Las 3 de esta semana: rotan de a tres desde la semana en que salió la primera, para que el lunes siguiente no repita.
 * Con tres o menos vigentes, salen todas.
 */
export function novedadesDeLaSemana(esAdmin: boolean, hoy = Date.now(), cuantas = 3): Novedad[] {
  const lista = novedadesVigentes(esAdmin, hoy);
  if (lista.length <= cuantas) return lista;
  const primera = Math.min(...lista.map((n) => fecha(n.desde)));
  const semana = Math.max(0, Math.floor((hoy - primera) / (7 * DIA)));
  return Array.from({ length: cuantas }, (_, i) => lista[(semana * cuantas + i) % lista.length]);
}
