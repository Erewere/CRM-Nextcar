import { jsPDF } from 'jspdf';
import { logo } from './fichaPdf';
import {
  NOMBRE_FUENTE, QUE_REVISA_FUENTE, TEXTO_ESTADO_FUENTE, TEXTO_FUENTE_LIMPIA, TEXTO_VEREDICTO,
  type EstadoFuente, type EvaluacionPlacas,
} from './placasInfo';

/**
 * Constancia de la consulta de antecedentes de un auto, en una hoja carta.
 *
 * Deja por escrito lo que contestó cada fuente —sin reporte de robo, robado,
 * robado y recuperado, aviso ministerial, o que no respondió— junto con los
 * datos del vehículo y sus placas. Hay dos versiones de la misma consulta:
 *
 * - «cliente»: membretada con el logo de la agencia, para entregar o mandar
 *   por WhatsApp al comprador. Dice de dónde salen los datos y que no
 *   sustituye la consulta oficial del REPUVE.
 * - «interna»: para el expediente. Lleva la ficha completa del REPUVE, el
 *   folio de la consulta, quién la hizo y las consultas anteriores.
 *
 * No inventa nada: si una fuente no contestó, lo dice. Un documento que
 * presume limpio lo que nadie revisó es peor que no tenerlo.
 */

export type VarianteConstancia = 'cliente' | 'interna';

export interface DatosConstancia {
  variante: VarianteConstancia;
  evaluacion: EvaluacionPlacas;
  consulta: { id: string; consultado: string; fecha: string; porNombre?: string };
  auto: {
    make?: string; model?: string; year?: any; vin?: string; color?: string; km?: any;
    bodyType?: string; transmission?: string; licensePlate?: string; platesState?: string;
  };
  agencia?: { name?: string; address?: string; phone?: string; logoUrl?: string } | null;
  anteriores?: { fecha: string; veredicto?: string; porNombre?: string }[];
}

const NEGRO = [15, 15, 16] as const;
const CUERPO = [74, 70, 63] as const;
const LINEA = [218, 214, 206] as const;
const CLARO = [246, 245, 242] as const;
const ROJO = [168, 42, 23] as const;
const AMBAR = [146, 64, 14] as const;
const VERDE = [6, 95, 70] as const;
const GRIS = [100, 116, 139] as const;

const COLOR_VEREDICTO = { vigente: ROJO, antecedente: AMBAR, limpio: VERDE, incompleto: GRIS } as const;

/**
 * El veredicto dicho para quien compra el auto. El del CRM está escrito para
 * quien vende («no cierres la operación», «revisa la documentación»), y en una
 * constancia que se entrega eso suena a instrucción interna.
 */
const VEREDICTO_CLIENTE = {
  vigente: 'Con reporte de robo vigente',
  antecedente: 'Con un antecedente, sin reporte vigente',
  limpio: 'Sin reporte de robo en ninguna de las fuentes consultadas',
  incompleto: 'Consulta incompleta: alguna fuente no respondió',
} as const;

/** Qué quiere decir cada resultado, para que la hoja se explique sola. */
const LEYENDA: [string, string][] = [
  ['Sin reporte', 'Esa fuente no tiene ningún registro de robo del vehículo a la fecha de la consulta.'],
  ['Con antecedente', 'Hubo un reporte que ya no está vigente, por ejemplo un vehículo robado y después recuperado. Conviene revisar la documentación.'],
  ['Reporte vigente', 'Hay un reporte activo. No debe cerrarse una operación sobre este vehículo hasta aclararlo con la autoridad.'],
  ['No respondió', 'Esa fuente no contestó en el momento de la consulta; no quiere decir que esté limpia ni que tenga reporte.'],
];
const COLOR_ESTADO: Record<EstadoFuente, readonly number[]> = {
  alerta: ROJO, antecedente: AMBAR, limpio: VERDE, caida: GRIS, sin_dato: GRIS,
};

const fechaLarga = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
};
const fechaHora = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
};

export const folioDeConstancia = (id: string) => `V-${String(id).replace(/[^A-Za-z0-9]/g, '').slice(-7).toUpperCase()}`;

export const nombreDeConstancia = (d: DatosConstancia) => {
  const auto = [d.auto.year, d.auto.make, d.auto.model].filter(Boolean).join(' ').replace(/[^\p{L}\p{N} .-]/gu, '').trim();
  const dia = String(d.consulta.fecha || '').slice(0, 10);
  return `Verificacion ${folioDeConstancia(d.consulta.id)}${auto ? ` ${auto}` : ''} ${dia}.pdf`.replace(/\s+/g, ' ');
};

/** Lo que se escribe en la columna «Resultado» de cada fuente. */
function resultadoDeFuente(clave: string, estado: EstadoFuente) {
  if (estado === 'limpio') return (TEXTO_FUENTE_LIMPIA[clave] || 'Sin reporte').toUpperCase();
  if (estado === 'caida') return 'NO RESPONDIÓ';
  if (estado === 'sin_dato') return 'SIN DATO';
  return (TEXTO_ESTADO_FUENTE[estado] || '').toUpperCase();
}

export async function generarConstanciaPlacas(d: DatosConstancia): Promise<Blob> {
  const { variante, evaluacion: ev, consulta, auto } = d;
  const paraCliente = variante === 'cliente';
  const pdf = new jsPDF({ unit: 'pt', format: 'letter' });
  const W = 612, H = 792, M = 40, ANCHO = W - M * 2;

  const color = (c: readonly number[]) => pdf.setTextColor(c[0], c[1], c[2]);
  const relleno = (c: readonly number[]) => pdf.setFillColor(c[0], c[1], c[2]);
  const borde = (c: readonly number[]) => pdf.setDrawColor(c[0], c[1], c[2]);
  const texto = (t: string | string[], x: number, y: number, tam: number, estilo: 'normal' | 'bold' = 'normal', c: readonly number[] = NEGRO, opc: any = {}) => {
    pdf.setFont('helvetica', estilo); pdf.setFontSize(tam); color(c); pdf.text(t, x, y, opc);
  };
  const partir = (t: string, ancho: number, tam: number, estilo: 'normal' | 'bold' = 'normal') => {
    pdf.setFont('helvetica', estilo); pdf.setFontSize(tam);
    return pdf.splitTextToSize(t, ancho) as string[];
  };

  let y = M;

  // ---- Encabezado: la agencia a la izquierda, el documento a la derecha
  const lg = paraCliente && d.agencia?.logoUrl ? await logo(d.agencia.logoUrl) : null;
  let xTexto = M;
  if (lg) {
    const alto = Math.min(44, 150 / lg.ratio);
    pdf.addImage(lg.src, 'PNG', M, y, alto * lg.ratio, alto);
    xTexto = M + alto * lg.ratio + 12;
  }
  texto(d.agencia?.name || '', xTexto, y + 12, 11.5, 'bold', NEGRO, { maxWidth: 250 });
  const contacto = [d.agencia?.address, d.agencia?.phone ? `Tel. ${d.agencia.phone}` : ''].filter(Boolean).join(' · ');
  if (contacto) texto(partir(contacto, 250, 7.5), xTexto, y + 25, 7.5, 'normal', CUERPO);

  texto('CONSTANCIA DE VERIFICACIÓN', W - M, y + 10, 10.5, 'bold', NEGRO, { align: 'right' });
  texto('DE ANTECEDENTES DEL VEHÍCULO', W - M, y + 22, 8, 'bold', CUERPO, { align: 'right' });
  texto(`Folio ${folioDeConstancia(consulta.id)} · ${fechaLarga(consulta.fecha)}`, W - M, y + 34, 8, 'normal', CUERPO, { align: 'right' });
  if (!paraCliente) texto('USO INTERNO — EXPEDIENTE', W - M, y + 45, 8, 'bold', ROJO, { align: 'right' });

  y += 58;
  borde(LINEA); pdf.setLineWidth(0.8); pdf.line(M, y, W - M, y);
  y += 20;

  // ---- El resultado, hasta arriba y en una sola frase
  const cv = COLOR_VEREDICTO[ev.veredicto];
  relleno(CLARO); pdf.rect(M, y, ANCHO, 46, 'F');
  relleno(cv); pdf.rect(M, y, 4, 46, 'F');
  texto('RESULTADO DE LA CONSULTA', M + 14, y + 16, 7.5, 'bold', CUERPO);
  const frase = paraCliente ? VEREDICTO_CLIENTE[ev.veredicto] : TEXTO_VEREDICTO[ev.veredicto];
  texto(partir(frase, ANCHO - 28, 12.5, 'bold')[0], M + 14, y + 33, 12.5, 'bold', cv);
  y += 54;

  // Cuándo se consultó y con qué dato: sin esto, una constancia no vale nada.
  const quien = consulta.porNombre ? `, por ${consulta.porNombre}` : '';
  texto(`Consulta hecha el ${fechaHora(consulta.fecha)}${quien}. Se consultó ${consulta.consultado.toUpperCase()}.`, M, y, 8, 'normal', CUERPO);
  y += 20;

  // ---- Datos del vehículo
  const f = ev.ficha;
  const km = auto.km === undefined || auto.km === null || auto.km === '' ? '' : `${Number(auto.km).toLocaleString('es-MX')} km`;
  const datos: [string, string][] = [
    ['Marca', String(auto.make || f?.marca || '—')],
    ['Modelo', String(auto.model || f?.modelo || '—')],
    ['Año', String(auto.year || f?.anio || '—')],
    ['NIV (número de serie)', String(auto.vin || f?.vin || '—').toUpperCase()],
    ['Placas', String(auto.licensePlate || f?.placa || '—').toUpperCase()],
    ['Entidad que emplacó', String(auto.platesState || f?.entidad || '—')],
    ['Color', String(auto.color || '—')],
    ['Kilometraje', km || '—'],
    ['Carrocería', String(auto.bodyType || f?.tipo || '—')],
    ['Transmisión', String(auto.transmission || '—')],
  ];
  texto('DATOS DEL VEHÍCULO', M, y, 8, 'bold', CUERPO);
  y += 10;
  const colAncho = ANCHO / 2;
  const filaAlto = 17;
  datos.forEach((par, i) => {
    const col = i % 2, fila = Math.floor(i / 2);
    const x = M + col * colAncho, yy = y + fila * filaAlto;
    if (col === 0 && fila % 2 === 1) { relleno(CLARO); pdf.rect(M, yy - 1, ANCHO, filaAlto, 'F'); }
    texto(par[0], x + 4, yy + 11, 7.5, 'normal', GRIS);
    texto(partir(par[1], colAncho - 110, 9, 'bold')[0], x + 112, yy + 11, 9, 'bold', NEGRO);
  });
  y += Math.ceil(datos.length / 2) * filaAlto + 18;

  // ---- Lo que contestó cada fuente
  texto('LO QUE CONTESTÓ CADA FUENTE', M, y, 8, 'bold', CUERPO);
  y += 12;
  borde(LINEA); pdf.setLineWidth(0.5);
  const xRes = M + 190;
  const fuentes = ev.fuentes || [];
  if (!fuentes.length) {
    // Consultas guardadas antes de que se anotara fuente por fuente.
    const lineas = [...ev.alertas, ...ev.historial];
    texto(lineas.length ? partir(lineas.join(' · '), ANCHO, 9) : 'Sin reportes en ninguna fuente.', M, y + 10, 9, 'normal', NEGRO);
    y += (lineas.length ? partir(lineas.join(' · '), ANCHO, 9).length : 1) * 12 + 10;
  } else {
    for (const fu of fuentes) {
      const detalle = fu.detalle.length ? fu.detalle : [paraCliente ? '' : QUE_REVISA_FUENTE[fu.clave] || ''];
      const lineasDet = detalle.filter(Boolean).flatMap((t) => partir(t, ANCHO - 200, 8));
      const alto = Math.max(filaAlto, 13 + lineasDet.length * 9.5);
      pdf.line(M, y, W - M, y);
      texto(NOMBRE_FUENTE[fu.clave] || fu.clave, M + 2, y + 12, 8.5, 'bold', NEGRO);
      texto(resultadoDeFuente(fu.clave, fu.estado), xRes, y + 12, 8.5, 'bold', COLOR_ESTADO[fu.estado]);
      if (lineasDet.length) texto(lineasDet, xRes, y + 22, 8, 'normal', CUERPO);
      y += alto;
    }
    pdf.line(M, y, W - M, y);
    y += 16;
  }

  if (ev.fuentesCaidas.length) {
    const t = `Fuentes que no respondieron: ${ev.fuentesCaidas.map((k) => NOMBRE_FUENTE[k] || k).join(', ')}. ${
      ev.veredicto === 'incompleto'
        ? 'Mientras no contesten, este resultado no debe tomarse como libre de reportes: hay que repetir la consulta.'
        : 'Son fuentes complementarias y fallan con frecuencia; el resto de las consultas sí respondió.'}`;
    const lineas = partir(t, ANCHO, 8);
    texto(lineas, M, y, 8, 'normal', CUERPO);
    y += lineas.length * 10 + 10;
  }

  // ---- Solo en la del expediente: ficha completa del REPUVE y rastro
  if (!paraCliente) {
    if (f) {
      texto('FICHA COMPLETA DEL REPUVE', M, y, 8, 'bold', CUERPO);
      y += 11;
      const extra = [['Línea', f.linea], ['Complemento', f.complemento], ['Cilindrada', f.cilindrada], ['Cilindros', f.cilindros], ['Tipo', f.tipo], ['Último movimiento', f.movimiento]]
        .filter(([, v]) => String(v || '').trim()) as [string, string][];
      for (const [k, v] of extra) {
        const lineas = partir(String(v), ANCHO - 112, 8);
        texto(k, M + 2, y + 8, 7.5, 'normal', GRIS);
        texto(lineas, M + 112, y + 8, 8, 'normal', NEGRO);
        y += Math.max(12, lineas.length * 9.5);
      }
      y += 8;
    }
    y += 6;
    texto('RASTRO DE LA CONSULTA', M, y, 8, 'bold', CUERPO);
    y += 11;
    const rastro = [
      `Consulta ${consulta.id} · se consultó ${consulta.consultado}`,
      `Hecha el ${fechaHora(consulta.fecha)}${consulta.porNombre ? ` por ${consulta.porNombre}` : ''}`,
      ...(d.anteriores?.length
        ? [`Consultas anteriores de este auto: ${d.anteriores.map((a) => `${fechaHora(a.fecha)}${a.veredicto ? ` (${a.veredicto})` : ''}`).join(' · ')}`]
        : ['Sin consultas anteriores de este auto.']),
    ];
    for (const linea of rastro) {
      const l = partir(linea, ANCHO, 8);
      texto(l, M + 2, y + 8, 8, 'normal', CUERPO);
      y += l.length * 9.5 + 2;
    }
  }

  if (paraCliente) {
    y += 4;
    texto('QUÉ SIGNIFICA CADA RESULTADO', M, y, 8, 'bold', CUERPO);
    y += 12;
    for (const [termino, explicacion] of LEYENDA) {
      const lineas = partir(explicacion, ANCHO - 100, 7.5);
      texto(termino, M + 2, y, 7.5, 'bold', NEGRO);
      texto(lineas, M + 100, y, 7.5, 'normal', CUERPO);
      y += Math.max(12, lineas.length * 9) + 2;
    }
  }

  // ---- Pie: de dónde salen los datos y qué no es este papel
  const pie = [
    'Esta consulta se hizo con PlacasInfo, que pregunta en el Registro Público Vehicular (REPUVE), las fiscalías estatales, el registro de las aseguradoras (OCRA), los avisos ministeriales, el registro de procedencia ilícita de la Ciudad de México y los reportes de robo de Estados Unidos y Canadá.',
    'Documento informativo expedido por la agencia: refleja lo que esas fuentes contestaron el día y la hora de la consulta. No es un documento oficial del REPUVE, no sustituye la consulta en repuve.gob.mx ni la revisión física del vehículo, y lo que esas fuentes registren después puede cambiar.',
  ];
  const lineasPie = pie.flatMap((t) => [...partir(t, ANCHO, 7), '']);
  const altoPie = lineasPie.length * 8.5 + 14;
  const yPie = Math.max(y + 10, H - M - altoPie);
  borde(LINEA); pdf.setLineWidth(0.5); pdf.line(M, yPie - 8, W - M, yPie - 8);
  texto(lineasPie, M, yPie, 7, 'normal', GRIS);
  texto(`Folio ${folioDeConstancia(consulta.id)}`, W - M, H - M + 6, 7, 'normal', GRIS, { align: 'right' });

  return pdf.output('blob');
}
