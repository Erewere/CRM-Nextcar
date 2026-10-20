/**
 * Seguimiento de postventa: lo que se le hace a un cliente DESPUÉS de comprar.
 *
 * Cuando una venta se cierra, el CRM le programa al vendedor cuatro tareas, contadas desde la fecha de
 * la venta: una llamada a la semana, pedir reseña o recomendación al mes, el servicio y la verificación
 * a los seis meses, y el aniversario (seguro, refrendo o tenencia, cambio de auto) al año.
 *
 * Cada tarea tiene un id fijo (trato + paso), así que dos corridas escriben la misma tarea y nunca dos.
 * Las fechas se calculan en hora local de México (no en UTC: un «2026-11-05» leído como UTC cae el 4) y
 * los meses cortos usan su último día. Una tarea cuya fecha ya pasó (venta capturada con retraso) se
 * programa para hoy: sigue valiendo la pena y no debe amanecer «vencida».
 */

export interface PasoPostventa {
  clave: string;
  dias?: number;
  meses?: number;
  tipo: 'call' | 'task';
  titulo: (cliente: string, auto: string) => string;
  notas: string;
}

export const PASOS_POSTVENTA: PasoPostventa[] = [
  {
    clave: 'semana1', dias: 7, tipo: 'call',
    titulo: (c, a) => `Llamar a ${c}: ¿cómo le va con su ${a}?`,
    notas: 'Una semana después de la entrega. Pregunta cómo le va, si tiene dudas y si le falta algo (papeles, placas, accesorios).',
  },
  {
    clave: 'mes1', dias: 30, tipo: 'task',
    titulo: (c) => `Pedir reseña o recomendación a ${c}`,
    notas: 'Un mes después. Pídele una reseña en Google o que recomiende a alguien que ande buscando auto: es la forma más barata de conseguir otro cliente.',
  },
  {
    clave: 'mes6', meses: 6, tipo: 'task',
    titulo: (c, a) => `Servicio y verificación del ${a} de ${c}`,
    notas: 'Seis meses después. Recuérdale su servicio y su verificación vehicular. Si no lo hace contigo, ofrécele una agencia o taller de confianza.',
  },
  {
    clave: 'anio1', meses: 12, tipo: 'call',
    titulo: (c) => `Aniversario de compra de ${c}: seguro, refrendo y cambio de auto`,
    notas: 'Un año después. Recuérdale el refrendo o la tenencia y la renovación del seguro, y pregúntale si ya piensa en cambiar de auto: tú le recibes el suyo.',
  },
];

const dos = (n: number) => String(n).padStart(2, '0');
const aTexto = (d: Date) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;

/** «2026-10-19» (o una fecha ISO) → 'AAAA-MM-DD', o '' si no es una fecha. */
export function soloFecha(v: unknown): string {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(v || ''));
  return m ? m[1] : '';
}

export function sumarDias(fecha: string, dias: number): string {
  const [a, m, d] = fecha.split('-').map(Number);
  return aTexto(new Date(a, m - 1, d + dias, 12));
}

export function sumarMeses(fecha: string, meses: number): string {
  const [a, m, d] = fecha.split('-').map(Number);
  const base = new Date(a, m - 1 + meses, 1, 12);
  const ultimo = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
  base.setDate(Math.min(d, ultimo));
  return aTexto(base);
}

export function fechaDelPaso(venta: string, paso: PasoPostventa, hoy: string): string {
  const fecha = paso.meses ? sumarMeses(venta, paso.meses) : sumarDias(venta, paso.dias || 0);
  return fecha < hoy ? hoy : fecha;
}

export const idDeTareaPostventa = (dealId: string, clave: string) => `postventa_${dealId}_${clave}`.replace(/[^\w-]/g, '_');

export function tareasDePostventa(p: {
  dealId: string; agencyId: string; clientId: string; sellerId: string;
  cliente: string; auto: string; venta: string; hoy: string; ahoraIso: string;
}) {
  const cliente = (p.cliente || 'el cliente').trim();
  const auto = (p.auto || 'auto').trim();
  return PASOS_POSTVENTA.map((paso) => ({
    id: idDeTareaPostventa(p.dealId, paso.clave),
    datos: {
      agencyId: p.agencyId, sellerId: p.sellerId, clientId: p.clientId, dealId: p.dealId,
      title: paso.titulo(cliente, auto),
      notes: paso.notas,
      dueDate: fechaDelPaso(p.venta, paso, p.hoy),
      completed: false,
      type: paso.tipo,
      postventa: true,
      pasoPostventa: paso.clave,
      createdAt: p.ahoraIso,
      createdByName: 'Postventa automática',
    },
  }));
}
