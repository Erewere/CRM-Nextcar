/**
 * El estado de cuenta de una venta: qué se pagó, qué falta y qué va atrasado.
 *
 * Una sola regla, la usan el servidor y todas las pantallas. Antes cada
 * pantalla calculaba a su manera (una mensualidad «pagada» si había un pago
 * con su número, el enganche si la nota decía «enganche»…) y no coincidían.
 *
 * Cómo se aplica el dinero, como en cualquier crédito:
 *  1. lo que se registra como enganche (o comisión) cubre el pago inicial:
 *     el enganche, más la comisión por apertura si se pagó de contado;
 *  2. todo lo demás (y lo que sobre del enganche) cubre las mensualidades
 *     en orden, la más vieja primero. Un pago grande cubre varias; uno
 *     chico deja la mensualidad «parcial».
 * Los pagos anulados no cuentan, pero no se borran: quedan en el historial.
 */

/**
 * «descuento» no es dinero recibido: son los intereses que se le perdonan al
 * cliente que liquida antes. Cubre mensualidades como un pago, pero no suma
 * en «pagado».
 */
export type ConceptoPago = 'enganche' | 'comision' | 'mensualidad' | 'abono' | 'liquidacion' | 'pago' | 'descuento' | 'devolucion';
// «devolucion» es dinero que la agencia le regresa al cliente (por ejemplo, el auto que
// dejó a cuenta vale más que el que compra): resta de lo pagado.
export type FormaPago = 'efectivo' | 'transferencia' | 'tarjeta' | 'cheque' | 'auto' | 'otro';

export interface PagoVenta {
  id: string;
  monto: number;
  fecha: string;            // AAAA-MM-DD (el día en que se recibió)
  forma: FormaPago | string;
  concepto: ConceptoPago;
  nota?: string;
  anulado?: boolean;
  motivoAnulacion?: string;
  anuladoPorNombre?: string;
  anuladoEn?: string;
  registradoPorNombre?: string;
  registradoEn?: string;
  origen?: 'crm' | 'migrado';
}

export interface PlanVenta {
  method?: 'contado' | 'credito' | 'credito_bancario' | string;
  price?: number;
  downPayment?: number;
  termMonths?: number;
  interestRate?: number;
  interestType?: string;
  firstPaymentDate?: string;
  calculatedMonthlyPayment?: number;
  calculatedTotalAmount?: number;
  calculatedTotalInterest?: number;
  /** Comisión por apertura, como en la cotización: % sobre lo que se financia. */
  comisionPct?: number;
  comisionMonto?: number;
  comisionFinanciada?: boolean;
  /** Lo que se financia: precio − enganche (+ comisión si va financiada). */
  montoFinanciado?: number;
}

export type EstadoMensualidad = 'pagada' | 'parcial' | 'atrasada' | 'por-vencer' | 'pendiente';

export interface Mensualidad {
  n: number;
  fecha: string;
  monto: number;
  cubierto: number;
  estado: EstadoMensualidad;
  diasAtraso: number;
}

export interface EstadoDeCuenta {
  esCredito: boolean;
  precio: number;
  enganche: number;
  enganchePagado: number;
  comision: number;
  comisionFinanciada: boolean;
  pagoInicial: number;        // enganche + comisión de contado
  pagoInicialPagado: number;
  financiado: number;
  interes: number;
  totalAPagar: number;   // lo que el cliente paga en total (con intereses)
  pagado: number;          // dinero recibido, menos lo devuelto
  aFavor: number;          // lo que el cliente pagó de más y falta devolverle
  descontado: number;      // intereses perdonados por liquidar antes
  saldo: number;
  liquidada: boolean;
  mensualidad: number;
  mensualidades: Mensualidad[];
  pagadas: number;
  atrasadas: number;
  montoAtrasado: number;
  proxima: Mensualidad | null;
}

export const NOMBRE_CONCEPTO: Record<string, string> = {
  enganche: 'Enganche', devolucion: 'Devolución al cliente', comision: 'Comisión por apertura', mensualidad: 'Mensualidad', abono: 'Abono', liquidacion: 'Liquidación', pago: 'Pago',
};
export const NOMBRE_FORMA: Record<string, string> = {
  efectivo: 'Efectivo', transferencia: 'Transferencia', tarjeta: 'Tarjeta', cheque: 'Cheque', auto: 'Auto a cuenta', otro: 'Otro',
};
export const NOMBRE_METODO: Record<string, string> = {
  contado: 'Contado', credito: 'Crédito de la casa', credito_bancario: 'Crédito bancario',
};

const centavos = (n: any) => Math.round((Number(n) || 0) * 100) / 100;

/** AAAA-MM-DD + n meses, en hora local; un día 31 cae en el último día de los meses cortos. */
export function fechaDelPago(primera: string, mesesDespues: number) {
  const [a, m, d] = String(primera).slice(0, 10).split('-').map(Number);
  const base = new Date(a, m - 1 + mesesDespues, 1, 12);
  const ultimoDia = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
  base.setDate(Math.min(d, ultimoDia));
  const mm = String(base.getMonth() + 1).padStart(2, '0'), dd = String(base.getDate()).padStart(2, '0');
  return `${base.getFullYear()}-${mm}-${dd}`;
}

export function hoyISO(ahora = new Date()) {
  return `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`;
}

const diasEntre = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00`) - Date.parse(`${a}T12:00:00`)) / 86400000);

export const pagosActivos = (pagos: PagoVenta[]) =>
  pagos.filter((p) => !p.anulado).sort((a, b) => `${a.fecha}|${a.registradoEn || ''}`.localeCompare(`${b.fecha}|${b.registradoEn || ''}`));

export function estadoDeCuenta(plan: PlanVenta | null | undefined, pagos: PagoVenta[], hoy = hoyISO()): EstadoDeCuenta {
  const p = plan || {};
  const esCredito = p.method === 'credito';
  const precio = centavos(p.price);
  const activos = pagosActivos(pagos);
  const recibido = activos.filter((x) => x.concepto !== 'descuento' && x.concepto !== 'devolucion').reduce((s, x) => s + (Number(x.monto) || 0), 0);
  const devuelto = activos.filter((x) => x.concepto === 'devolucion').reduce((s, x) => s + (Number(x.monto) || 0), 0);
  const pagado = centavos(recibido - devuelto);
  const descontado = centavos(activos.filter((x) => x.concepto === 'descuento').reduce((s, x) => s + (Number(x.monto) || 0), 0));

  if (!esCredito) {
    const saldo = Math.max(0, centavos(precio - pagado - descontado));
    return {
      esCredito, precio, enganche: 0, enganchePagado: 0, comision: 0, comisionFinanciada: false, pagoInicial: 0, pagoInicialPagado: 0, financiado: 0, interes: 0, totalAPagar: precio,
      pagado, aFavor: Math.max(0, centavos(pagado + descontado - precio)), descontado, saldo, liquidada: precio > 0 && saldo <= 0.5, mensualidad: 0, mensualidades: [], pagadas: 0, atrasadas: 0,
      montoAtrasado: 0, proxima: null,
    };
  }

  const enganche = centavos(p.downPayment);
  const comision = centavos(p.comisionMonto);
  const comisionFinanciada = !!p.comisionFinanciada;
  const pagoInicial = centavos(enganche + (comisionFinanciada ? 0 : comision));
  const financiado = centavos(p.montoFinanciado) || Math.max(0, centavos(precio - enganche + (comisionFinanciada ? comision : 0)));
  const plazo = Math.max(0, Math.floor(Number(p.termMonths) || 0));
  const totalFinanciado = centavos(p.calculatedTotalAmount) || financiado;
  const interes = Math.max(0, centavos(totalFinanciado - financiado));
  const mensualidad = centavos(p.calculatedMonthlyPayment) || (plazo ? centavos(totalFinanciado / plazo) : 0);

  // 1) pago inicial: enganche (+ comisión de contado)
  const deInicial = activos.filter((x) => x.concepto === 'enganche' || x.concepto === 'comision').reduce((s, x) => s + (Number(x.monto) || 0), 0);
  const pagoInicialPagado = Math.min(pagoInicial, centavos(deInicial));
  const enganchePagado = Math.min(enganche, pagoInicialPagado);
  // 2) mensualidades en orden con todo lo demás
  let bolsa = centavos(pagado + descontado - pagoInicialPagado);
  const mensualidades: Mensualidad[] = [];
  for (let n = 1; n <= plazo; n++) {
    // la última absorbe el redondeo para que la suma dé el total exacto
    const monto = n === plazo ? centavos(totalFinanciado - mensualidad * (plazo - 1)) : mensualidad;
    const cubierto = Math.min(monto, Math.max(0, centavos(bolsa)));
    bolsa = centavos(bolsa - cubierto);
    const fecha = p.firstPaymentDate ? fechaDelPago(p.firstPaymentDate, n - 1) : '';
    const completa = monto - cubierto <= 0.5;
    const dias = fecha ? diasEntre(fecha, hoy) : 0;
    const estado: EstadoMensualidad = completa ? 'pagada'
      : fecha && dias > 0 ? 'atrasada'
        : cubierto > 0 ? 'parcial'
          : fecha && dias >= -7 ? 'por-vencer' : 'pendiente';
    mensualidades.push({ n, fecha, monto, cubierto, estado, diasAtraso: estado === 'atrasada' ? dias : 0 });
  }

  const totalAPagar = centavos(pagoInicial + totalFinanciado);
  const saldo = Math.max(0, centavos(totalAPagar - pagado - descontado));
  const atrasadasL = mensualidades.filter((m) => m.estado === 'atrasada');
  return {
    esCredito, precio, enganche, enganchePagado, comision, comisionFinanciada, pagoInicial, pagoInicialPagado, financiado, interes, totalAPagar, pagado, aFavor: Math.max(0, centavos(pagado + descontado - totalAPagar)), descontado, saldo,
    liquidada: totalAPagar > 0 && saldo <= 0.5,
    mensualidad, mensualidades,
    pagadas: mensualidades.filter((m) => m.estado === 'pagada').length,
    atrasadas: atrasadasL.length,
    montoAtrasado: centavos(atrasadasL.reduce((s, m) => s + (m.monto - m.cubierto), 0)),
    proxima: mensualidades.find((m) => m.estado !== 'pagada') || null,
  };
}

/** Lo que se le sugiere cobrar ahora: el enganche si falta, si no la siguiente mensualidad. */
export function cobroSugerido(ec: EstadoDeCuenta): { concepto: ConceptoPago; monto: number; etiqueta: string } {
  if (!ec.esCredito) return { concepto: 'pago', monto: ec.saldo, etiqueta: ec.saldo ? 'Saldo pendiente' : '' };
  if (ec.pagoInicial > 0 && ec.pagoInicialPagado < ec.pagoInicial - 0.5) {
    const conComision = ec.comision > 0 && !ec.comisionFinanciada;
    return { concepto: 'enganche', monto: centavos(ec.pagoInicial - ec.pagoInicialPagado), etiqueta: conComision ? 'Enganche y comisión' : 'Enganche' };
  }
  const m = ec.proxima;
  if (!m) return { concepto: 'abono', monto: 0, etiqueta: '' };
  return { concepto: 'mensualidad', monto: centavos(m.monto - m.cubierto), etiqueta: `Mensualidad ${m.n} de ${ec.mensualidades.length}` };
}

/**
 * Los pagos con la forma vieja (dentro de saleDetails.payments) → la nueva.
 * El concepto se deduce de cómo se capturó: número 0 o nota «enganche» =
 * enganche; con número de mensualidad = mensualidad; en contado = pago.
 */
export function deFormaVieja(p: any, esCredito: boolean): PagoVenta {
  const nota = String(p?.notes || '');
  const guardado = String(p?.concepto || '');
  const concepto: ConceptoPago = ['enganche', 'comision', 'mensualidad', 'abono', 'liquidacion', 'pago', 'descuento', 'devolucion'].includes(guardado) ? guardado as ConceptoPago
    : !esCredito ? 'pago'
    : (p?.installmentNumber === 0 || /enganche/i.test(nota)) ? 'enganche'
      : (Number(p?.installmentNumber) > 0 || /mensualidad/i.test(nota)) ? 'mensualidad' : 'abono';
  return {
    id: String(p?.id || ''),
    monto: centavos(p?.amount),
    fecha: String(p?.date || '').slice(0, 10),
    forma: String(p?.method || 'otro'),
    concepto,
    ...(nota ? { nota } : {}),
    registradoEn: String(p?.createdAt || ''),
    origen: 'migrado',
  };
}

/** Y al revés, para las pantallas y reportes que todavía leen saleDetails.payments. */
export function aFormaVieja(p: PagoVenta) {
  return {
    id: p.id,
    amount: p.concepto === 'devolucion' ? -p.monto : p.monto,
    date: p.fecha,
    method: p.forma,
    notes: p.nota || NOMBRE_CONCEPTO[p.concepto] || '',
    concepto: p.concepto,
    ...(p.concepto === 'enganche' ? { installmentNumber: 0 } : {}),
    createdAt: p.registradoEn || '',
  };
}

/** La misma clave por contenido de siempre, para juntar copias de un pago sin perder dos abonos reales iguales. */
export const claveDePagoViejo = (p: any) => `${p?.date || ''}|${Number(p?.amount) || 0}|${p?.method || ''}|${p?.installmentNumber ?? ''}`;

/** Junta las listas de pagos de varias copias (trato, contacto, auto): por cada clave se queda el máximo de una sola lista, no la suma. */
export function fusionarPagosViejos(...listas: (any[] | undefined | null)[]) {
  const fusion = new Map<string, any[]>();
  for (const lista of listas) {
    const grupos = new Map<string, any[]>();
    for (const p of lista || []) if (p) grupos.set(claveDePagoViejo(p), [...(grupos.get(claveDePagoViejo(p)) || []), p]);
    grupos.forEach((ps, k) => { if (ps.length > (fusion.get(k)?.length || 0)) fusion.set(k, ps); });
  }
  return Array.from(fusion.values()).flat().sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
}

/**
 * Las cuentas del crédito de la casa al registrar la venta: las mismas de la
 * cotización (interés global fijo mensual; comisión % sobre lo financiado,
 * dentro del financiamiento o de contado).
 */
export function calcularCreditoCasa(d: { precio: number; enganche: number; meses: number; tasaMensual: number; comisionPct: number; comisionFinanciada: boolean }) {
  const precio = Math.max(0, Number(d.precio) || 0);
  const enganche = Math.min(precio, Math.max(0, Number(d.enganche) || 0));
  const base = Math.max(0, precio - enganche);
  const comision = centavos(base * Math.max(0, Number(d.comisionPct) || 0) / 100);
  const financiado = centavos(base + (d.comisionFinanciada ? comision : 0));
  const meses = Math.max(0, Math.floor(Number(d.meses) || 0));
  const interes = centavos(financiado * (Math.max(0, Number(d.tasaMensual) || 0) / 100) * meses);
  const totalFinanciado = centavos(financiado + interes);
  const mensualidad = meses ? totalFinanciado / meses : 0;
  const pagoInicial = centavos(enganche + (d.comisionFinanciada ? 0 : comision));
  return { precio, enganche, base, comision, financiado, meses, interes, totalFinanciado, mensualidad, pagoInicial, totalAPagar: centavos(pagoInicial + totalFinanciado) };
}

/**
 * Liquidar el crédito antes de tiempo.
 *
 * Cada mensualidad es una parte de capital (lo financiado entre el plazo) y
 * una de interés (el interés total entre el plazo). Para liquidar hoy se
 * debe: lo que falte del pago inicial + el capital de todas las mensualidades
 * que faltan + el interés de las que ya vencieron (fecha de hoy o antes).
 * El interés de las que aún no vencen es lo que se puede descontar.
 */
export function liquidacionAnticipada(plan: PlanVenta | null | undefined, pagos: PagoVenta[], hoy = hoyISO()) {
  const ec = estadoDeCuenta(plan, pagos, hoy);
  if (!ec.esCredito || ec.liquidada) return null;
  const plazo = ec.mensualidades.length || 1;
  const capitalMes = ec.financiado / plazo;
  let capital = 0, interesVencido = 0, interesFuturo = 0;
  for (const m of ec.mensualidades) {
    const falta = Math.max(0, m.monto - m.cubierto);
    if (falta <= 0.005 || m.monto <= 0) continue;
    const proporcion = falta / m.monto;
    const cap = Math.min(capitalMes, m.monto) * proporcion;
    const int = falta - cap;
    capital += cap;
    if (m.fecha && m.fecha <= hoy) interesVencido += int; else interesFuturo += int;
  }
  const inicialPendiente = Math.max(0, ec.pagoInicial - ec.pagoInicialPagado);
  const sinDescuento = centavos(ec.saldo);
  const descuento = centavos(interesFuturo);
  return {
    inicialPendiente: centavos(inicialPendiente),
    capital: centavos(capital),
    interesVencido: centavos(interesVencido),
    interesFuturo: descuento,
    sinDescuento,
    conDescuento: centavos(sinDescuento - descuento),
  };
}

/**
 * Qué cubrió un pago: el estado de cuenta justo antes y justo después de él
 * (mismo orden en que se aplica el dinero). Para el recibo.
 */
export function aplicacionDelPago(plan: PlanVenta | null | undefined, pagos: PagoVenta[], pagoId: string) {
  const activos = pagosActivos(pagos);
  const i = activos.findIndex((p) => p.id === pagoId);
  if (i < 0) return null;
  const antes = estadoDeCuenta(plan, activos.slice(0, i));
  const despues = estadoDeCuenta(plan, activos.slice(0, i + 1));
  const cubre: { n: number; monto: number; completa: boolean }[] = [];
  despues.mensualidades.forEach((m, k) => {
    const delta = centavos(m.cubierto - (antes.mensualidades[k]?.cubierto || 0));
    if (delta > 0.004) cubre.push({ n: m.n, monto: delta, completa: m.monto - m.cubierto <= 0.5 });
  });
  return {
    saldoAntes: antes.saldo,
    saldoDespues: despues.saldo,
    inicial: centavos(despues.pagoInicialPagado - antes.pagoInicialPagado),
    cubre,
    plazo: despues.mensualidades.length,
    proxima: despues.proxima,
    liquidada: despues.liquidada,
  };
}
