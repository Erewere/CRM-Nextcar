/**
 * Planes de la suscripción y qué incluye cada uno, en un solo lugar (pantalla y servidor leen esto).
 *
 *  - Básico: el CRM completo.
 *  - Premium: Básico + inteligencia de precios (cotizar un auto, revisión de precios de todo el inventario, precio de mercado
 *    en las tarjetas, calidad de compras y el asistente de IA para precios) + el cotizador de financiamiento.
 *
 * Quién tiene Premium sin pagar el precio Premium:
 *  - las agencias de cortesía (decisión de Luis: es regalo, y regalar el CRM sin lo mejor no tiene sentido);
 *  - las que están en prueba: se prueba todo, para que se vea qué se pierde al elegir Básico.
 */

export type Plan = 'basico' | 'premium';

/** Lo que el plan Premium agrega, para mostrarlo tal cual en Facturación y en los avisos. */
export const INCLUYE_PREMIUM = [
  'Cotizar un auto: cuánto pagar como máximo y en cuánto se vendería',
  'Revisión de precios de todo el inventario contra el mercado',
  'Precio de mercado en cada tarjeta del inventario',
  'Calidad de tus compras y memoria de ventas pasadas',
  'Cotizador de financiamiento para el cliente (PDF)',
  'El asistente de IA (Claude, ChatGPT, Gemini) para precios',
];

export const NOMBRE_PLAN: Record<Plan, string> = { basico: 'Básico', premium: 'Premium' };

export function planDeAgencia(a: any): Plan {
  if (!a) return 'basico';
  if (a.hasFreeAccess) return 'premium';
  if (a.subscriptionStatus === 'trialing') return 'premium';
  return a.plan === 'premium' ? 'premium' : 'basico';
}

/** ¿Puede esta agencia usar la inteligencia de precios y el cotizador de financiamiento? */
export const tienePremium = (a: any): boolean => planDeAgencia(a) === 'premium';

/** Qué plan cobra cada precio de Stripe. `precioPremium` es el id del precio Premium (vacío si aún no existe). */
export function planDePrecio(precioId: string | null | undefined, precioPremium: string | null | undefined): Plan {
  return precioId && precioPremium && precioId === precioPremium ? 'premium' : 'basico';
}
