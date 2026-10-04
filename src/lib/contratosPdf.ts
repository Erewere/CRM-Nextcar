import { jsPDF } from 'jspdf';
import { logo } from './fichaPdf';
import { pesosALetras } from './numeroALetras';

/**
 * Contrato de compraventa y carta responsiva de un auto usado, prellenados
 * con los datos del CRM. Son modelos: la agencia debe revisarlos con su
 * abogado, y para vender a consumidores la NOM-122-SCFI pide usar el
 * contrato de adhesión registrado ante Profeco.
 *
 * Nada de lo que se captura aquí (identificaciones, domicilios) se guarda:
 * solo va al PDF.
 */

export interface Parte {
  nombre: string;
  domicilio: string;
  identificacion: string;   // «INE 1234567890123»
  telefono?: string;
  representante?: string;   // si es la agencia (persona moral)
}

export interface DatosDocumentos {
  operacion: 'venta' | 'compra';
  vendedor: Parte;
  comprador: Parte;
  vehiculo: {
    marca: string; modelo: string; anio: string; color: string; carroceria: string;
    niv: string; motor: string; placas: string; estadoPlacas: string; km: string; factura: string;
  };
  precio: number;
  formaDePago: string;
  fecha: string;            // AAAA-MM-DD
  hora: string;             // HH:MM
  ciudad: string;
  documentosEntregados: string[];
  garantia: string;
  diasCambioPropietario: number;
  testigos: string[];
  incluir: { contrato: boolean; responsiva: boolean; cartaFactura?: boolean };
  /** Carta factura: cuántos días vale y por qué la agencia guarda la factura original. */
  cartaFactura?: { vigenciaDias: number; resguardo: string };
  agencia?: { name?: string; logoUrl?: string } | null;
}

const W = 612, H = 792, M = 56, ANCHO = W - 2 * M;
const NEGRO = [15, 23, 42] as const;
const GRIS = [100, 116, 139] as const;

const pesos = (n: number) => `$${(Number(n) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dato = (v: string, falta = '__________________') => (String(v || '').trim() || falta);

export function fechaEnLetra(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return '____ de ____________ de ______';
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Escritor con cursor: párrafos justificados que saltan de hoja solos. */
class Escritor {
  y = M;
  constructor(public pdf: jsPDF, private pie: string) {}

  nuevaHoja() {
    this.numerar();
    this.pdf.addPage('letter', 'portrait');
    this.y = M;
  }
  numerar() {
    this.pdf.setFont('helvetica', 'normal'); this.pdf.setFontSize(8); this.pdf.setTextColor(...GRIS);
    this.pdf.text(this.pie, M, H - 30);
  }
  espacio(alto: number) { if (this.y + alto > H - 60) this.nuevaHoja(); }

  titulo(t: string, tam = 14) {
    this.espacio(tam * 2);
    this.pdf.setFont('helvetica', 'bold'); this.pdf.setFontSize(tam); this.pdf.setTextColor(...NEGRO);
    this.pdf.text(t, W / 2, this.y, { align: 'center' });
    this.y += tam + 8;
  }

  subtitulo(t: string) {
    this.espacio(30);
    this.pdf.setFont('helvetica', 'bold'); this.pdf.setFontSize(10.5); this.pdf.setTextColor(...NEGRO);
    this.pdf.text(t, M, this.y);
    this.y += 15;
  }

  /** Párrafo justificado (la última línea va a la izquierda). */
  parrafo(texto: string, opciones: { negritas?: boolean; tam?: number; sangria?: number } = {}) {
    const tam = opciones.tam || 10.5, inter = tam * 1.42, x = M + (opciones.sangria || 0), ancho = ANCHO - (opciones.sangria || 0);
    this.pdf.setFont('helvetica', opciones.negritas ? 'bold' : 'normal'); this.pdf.setFontSize(tam); this.pdf.setTextColor(...NEGRO);
    const lineas: string[] = this.pdf.splitTextToSize(texto, ancho);
    lineas.forEach((linea, i) => {
      this.espacio(inter);
      // Al saltar de hoja el pie cambia la letra: se vuelve a poner en cada renglón.
      this.pdf.setFont('helvetica', opciones.negritas ? 'bold' : 'normal'); this.pdf.setFontSize(tam); this.pdf.setTextColor(...NEGRO);
      const palabras = linea.trim().split(/\s+/);
      if (i === lineas.length - 1 || palabras.length < 2) {
        this.pdf.text(linea.trim(), x, this.y);
      } else {
        const anchoPalabras = palabras.reduce((s, p) => s + this.pdf.getTextWidth(p), 0);
        const hueco = (ancho - anchoPalabras) / (palabras.length - 1);
        let cx = x;
        for (const p of palabras) { this.pdf.text(p, cx, this.y); cx += this.pdf.getTextWidth(p) + hueco; }
      }
      this.y += inter;
    });
    this.y += 6;
  }

  /** Tabla de dos columnas etiqueta / valor. */
  datos(filas: [string, string][]) {
    const col = 150;
    filas.forEach(([e, v]) => {
      this.pdf.setFontSize(10);
      const lineas: string[] = this.pdf.splitTextToSize(v, ANCHO - col);
      this.espacio(lineas.length * 14 + 2);
      this.pdf.setFont('helvetica', 'bold'); this.pdf.setTextColor(...GRIS);
      this.pdf.text(e, M, this.y);
      this.pdf.setFont('helvetica', 'normal'); this.pdf.setTextColor(...NEGRO);
      this.pdf.text(lineas, M + col, this.y);
      this.y += lineas.length * 14;
    });
    this.y += 6;
  }

  firmas(personas: { rol: string; nombre: string }[]) {
    // Tres firmas caben en un renglón (vendedor, comprador y un testigo); con cuatro, dos y dos.
    const porRenglon = personas.length === 3 ? 3 : 2, separacion = porRenglon === 3 ? 24 : 40;
    const anchoFirma = (ANCHO - separacion * (porRenglon - 1)) / porRenglon;
    for (let i = 0; i < personas.length; i += porRenglon) {
      this.espacio(90);
      this.y += 52;
      personas.slice(i, i + porRenglon).forEach((p, k) => {
        const x = M + k * (anchoFirma + separacion);
        this.pdf.setDrawColor(...NEGRO); this.pdf.setLineWidth(0.8);
        this.pdf.line(x, this.y, x + anchoFirma, this.y);
        this.pdf.setFont('helvetica', 'bold'); this.pdf.setFontSize(9.5); this.pdf.setTextColor(...NEGRO);
        this.pdf.text(p.rol, x + anchoFirma / 2, this.y + 13, { align: 'center' });
        this.pdf.setFont('helvetica', 'normal');
        this.pdf.text(this.pdf.splitTextToSize(p.nombre || '', anchoFirma).slice(0, 2), x + anchoFirma / 2, this.y + 25, { align: 'center' });
      });
      this.y += 34;
    }
  }
}

function descripcionVehiculo(v: DatosDocumentos['vehiculo']): [string, string][] {
  return [
    ['Marca', dato(v.marca)],
    ['Modelo / versión', dato(v.modelo)],
    ['Año modelo', dato(v.anio)],
    ['Color', dato(v.color)],
    ['Tipo', dato(v.carroceria)],
    ['NIV (número de serie)', dato(v.niv)],
    ['Número de motor', dato(v.motor)],
    ['Placas', `${dato(v.placas)}${v.estadoPlacas ? ` (${v.estadoPlacas})` : ''}`],
    ['Kilometraje', v.km ? `${v.km} km` : dato('')],
    ['Factura', dato(v.factura)],
  ];
}

function parteTexto(p: Parte, rol: string) {
  const rep = p.representante ? `, representada en este acto por ${p.representante}` : '';
  return `${rol}: ${dato(p.nombre)}${rep}, con domicilio en ${dato(p.domicilio)}, quien se identifica con ${dato(p.identificacion)}${p.telefono ? ` y teléfono ${p.telefono}` : ''}.`;
}

function contrato(e: Escritor, d: DatosDocumentos) {
  const v = d.vehiculo;
  e.titulo('CONTRATO DE COMPRAVENTA DE VEHÍCULO USADO');
  e.parrafo(`Contrato de compraventa que celebran, por una parte, ${dato(d.vendedor.nombre)}, a quien en lo sucesivo se le denominará «EL VENDEDOR», y por la otra ${dato(d.comprador.nombre)}, a quien en lo sucesivo se le denominará «EL COMPRADOR», al tenor de las siguientes declaraciones y cláusulas.`);

  e.subtitulo('DECLARACIONES');
  e.parrafo(`I. ${parteTexto(d.vendedor, 'Declara EL VENDEDOR llamarse')}`);
  e.parrafo(`II. ${parteTexto(d.comprador, 'Declara EL COMPRADOR llamarse')}`);
  e.parrafo('III. Declara EL VENDEDOR que es legítimo propietario del vehículo objeto de este contrato, que tiene facultades para venderlo, que se encuentra libre de todo gravamen, adeudo o limitación de dominio, y que no tiene reporte de robo ni está relacionado con procedimiento judicial o administrativo alguno.');
  e.parrafo('IV. Declara EL COMPRADOR que conoce el vehículo, que lo ha revisado y probado a su entera satisfacción, y que es su voluntad adquirirlo en el estado en que se encuentra.');

  e.subtitulo('CLÁUSULAS');
  e.parrafo('PRIMERA. Objeto. EL VENDEDOR vende y EL COMPRADOR adquiere el vehículo usado con las siguientes características:', { negritas: false });
  e.datos(descripcionVehiculo(v));
  e.parrafo(`SEGUNDA. Precio. El precio pactado es de ${pesos(d.precio)} (${pesosALetras(d.precio)}), que EL COMPRADOR cubre de la siguiente forma: ${dato(d.formaDePago)}.`);
  e.parrafo(`TERCERA. Entrega. EL VENDEDOR entrega el vehículo a EL COMPRADOR en ${dato(d.ciudad)}, el ${fechaEnLetra(d.fecha)} a las ${dato(d.hora, '____')} horas, junto con los siguientes documentos y accesorios: ${d.documentosEntregados.length ? d.documentosEntregados.join(', ') : '________________________________________'}.`);
  e.parrafo(`CUARTA. Estado del vehículo. EL COMPRADOR recibe el vehículo en el estado físico y mecánico en que se encuentra, con un kilometraje de ${v.km ? `${v.km} km` : '__________ km'}, mismo que declara conocer y aceptar.`);
  e.parrafo(`QUINTA. Garantía. ${String(d.garantia || '').trim() || 'El vehículo se vende sin garantía adicional a la que, en su caso, conserve del fabricante.'}`);
  e.parrafo('SEXTA. Saneamiento. EL VENDEDOR se obliga al saneamiento para el caso de evicción en términos de la legislación civil aplicable, y responde de cualquier reporte de robo, gravamen, adeudo, multa, infracción o hecho ocurrido con el vehículo antes de la fecha y hora de entrega.');
  e.parrafo('SÉPTIMA. Responsabilidad. A partir de la fecha y hora de entrega, EL COMPRADOR asume toda la responsabilidad civil, penal, administrativa y fiscal derivada de la posesión, uso y circulación del vehículo, incluidas multas, infracciones, accidentes y daños a terceros.');
  e.parrafo(`OCTAVA. Cambio de propietario. EL COMPRADOR se obliga a realizar el trámite de cambio de propietario ante la autoridad correspondiente dentro de los ${d.diasCambioPropietario || 30} días naturales siguientes a la firma de este contrato. EL VENDEDOR se obliga a firmar y entregar los documentos necesarios para ello.`);
  e.parrafo(`NOVENA. Jurisdicción. Para la interpretación y cumplimiento de este contrato, las partes se someten a las leyes y tribunales competentes de ${dato(d.ciudad)}, renunciando a cualquier otro fuero que pudiera corresponderles por razón de su domicilio presente o futuro.`);
  e.parrafo(`Leído que fue el presente contrato y enteradas las partes de su contenido y alcance legal, lo firman por duplicado en ${dato(d.ciudad)}, el ${fechaEnLetra(d.fecha)}.`);
  e.firmas([
    { rol: 'EL VENDEDOR', nombre: d.vendedor.representante ? `${d.vendedor.nombre}\n${d.vendedor.representante}` : d.vendedor.nombre },
    { rol: 'EL COMPRADOR', nombre: d.comprador.representante ? `${d.comprador.nombre}\n${d.comprador.representante}` : d.comprador.nombre },
    ...d.testigos.filter((t) => t.trim()).map((t) => ({ rol: 'TESTIGO', nombre: t })),
  ]);
}

function responsiva(e: Escritor, d: DatosDocumentos) {
  const v = d.vehiculo;
  e.titulo('CARTA RESPONSIVA DE COMPRAVENTA DE VEHÍCULO');
  e.y += 4;
  e.parrafo(`En ${dato(d.ciudad)}, siendo las ${dato(d.hora, '____')} horas del ${fechaEnLetra(d.fecha)}, ${dato(d.vendedor.nombre)}${d.vendedor.representante ? `, representada por ${d.vendedor.representante}` : ''} («EL VENDEDOR»), con domicilio en ${dato(d.vendedor.domicilio)}, identificado con ${dato(d.vendedor.identificacion)}, hace constar que en esta fecha y hora vende y entrega a ${dato(d.comprador.nombre)}${d.comprador.representante ? `, representada por ${d.comprador.representante}` : ''} («EL COMPRADOR»), con domicilio en ${dato(d.comprador.domicilio)}, identificado con ${dato(d.comprador.identificacion)}, el siguiente vehículo:`);
  e.datos(descripcionVehiculo(v));
  e.parrafo(`Precio de la operación: ${pesos(d.precio)} (${pesosALetras(d.precio)}). Forma de pago: ${dato(d.formaDePago)}.`);
  e.parrafo(`Documentos y accesorios que se entregan: ${d.documentosEntregados.length ? d.documentosEntregados.join(', ') : '________________________________________'}.`);
  e.parrafo('EL VENDEDOR declara que el vehículo es de su legítima propiedad, que se encuentra libre de gravámenes y adeudos y sin reporte de robo, y se hace responsable de cualquier situación legal, fiscal o administrativa relacionada con el vehículo ocurrida antes de la fecha y hora señaladas.');
  e.parrafo('A partir de la fecha y hora señaladas, EL COMPRADOR se hace responsable del vehículo, de su uso y de los daños que con él se causen, así como de las infracciones, multas, accidentes o cualquier hecho en que participe, liberando a EL VENDEDOR de toda responsabilidad posterior a la entrega.');
  e.parrafo(`EL COMPRADOR se compromete a realizar el cambio de propietario dentro de los ${d.diasCambioPropietario || 30} días naturales siguientes.`);
  e.firmas([
    { rol: 'EL VENDEDOR', nombre: d.vendedor.representante ? `${d.vendedor.nombre}\n${d.vendedor.representante}` : d.vendedor.nombre },
    { rol: 'EL COMPRADOR', nombre: d.comprador.representante ? `${d.comprador.nombre}\n${d.comprador.representante}` : d.comprador.nombre },
    ...d.testigos.filter((t) => t.trim()).map((t) => ({ rol: 'TESTIGO', nombre: t })),
  ]);
}

function sumarDias(iso: string, dias: number) {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + dias);
  return d.toLocaleDateString('en-CA');
}

function cartaFactura(e: Escritor, d: DatosDocumentos) {
  const agencia = d.vendedor;
  const cf = d.cartaFactura || { vigenciaDias: 30, resguardo: '' };
  const vigencia = Number(cf.vigenciaDias) || 30;
  e.titulo('CARTA FACTURA');
  e.pdf.setFont('helvetica', 'normal'); e.pdf.setFontSize(10.5); e.pdf.setTextColor(...NEGRO);
  e.pdf.text(`${dato(d.ciudad)}, a ${fechaEnLetra(d.fecha)}`, W - M, e.y, { align: 'right' });
  e.y += 26;
  e.parrafo('A QUIEN CORRESPONDA:', { negritas: true });
  e.parrafo(`${dato(agencia.nombre)}${agencia.representante ? `, por conducto de ${agencia.representante}` : ''}, con domicilio en ${dato(agencia.domicilio)}, hace constar que el ${fechaEnLetra(d.fecha)} vendió a ${dato(d.comprador.nombre)}, con domicilio en ${dato(d.comprador.domicilio)}, el vehículo con las siguientes características:`);
  e.datos([
    ['Marca', dato(d.vehiculo.marca)],
    ['Modelo / versión', dato(d.vehiculo.modelo)],
    ['Año modelo', dato(d.vehiculo.anio)],
    ['Color', dato(d.vehiculo.color)],
    ['NIV (número de serie)', dato(d.vehiculo.niv)],
    ['Número de motor', dato(d.vehiculo.motor)],
    ['Factura', dato(d.vehiculo.factura)],
  ]);
  const resguardo = String(cf.resguardo || '').trim();
  e.parrafo(`La factura original del vehículo queda en resguardo de ${dato(agencia.nombre)}${resguardo ? ` ${resguardo.replace(/^[,.\s]+/, '')}` : ''}${/[.]$/.test(resguardo) ? '' : '.'}`);
  e.parrafo(`Por medio de la presente se autoriza a ${dato(d.comprador.nombre)} a circular con el vehículo descrito y a realizar los trámites de alta de placas, tarjeta de circulación, pago de derechos y verificación ante las autoridades correspondientes.`);
  e.parrafo(`Esta carta factura tiene una vigencia de ${vigencia} días naturales a partir de su fecha de expedición, es decir, hasta el ${fechaEnLetra(sumarDias(d.fecha, vigencia))}.`);
  if (agencia.telefono) e.parrafo(`Para cualquier aclaración o para confirmar la autenticidad de este documento, comunicarse al teléfono ${agencia.telefono}.`);
  e.y += 6;
  e.parrafo('ATENTAMENTE', { negritas: true });
  // Firma a la izquierda y, a su altura, el espacio para el sello de la agencia.
  e.espacio(110);
  const ySello = e.y;
  e.firmas([{ rol: dato(agencia.nombre, ''), nombre: agencia.representante || '' }]);
  e.pdf.setDrawColor(...GRIS); e.pdf.setLineWidth(0.6);
  e.pdf.setLineDashPattern([3, 3], 0);
  e.pdf.roundedRect(W - M - 140, ySello + 10, 140, 80, 6, 6, 'S');
  e.pdf.setLineDashPattern([], 0);
  e.pdf.setFont('helvetica', 'normal'); e.pdf.setFontSize(8.5); e.pdf.setTextColor(...GRIS);
  e.pdf.text('Sello de la agencia', W - M - 70, ySello + 54, { align: 'center' });
}

export async function generarDocumentosVenta(d: DatosDocumentos): Promise<Blob> {
  const pdf = new jsPDF({ unit: 'pt', format: 'letter' });
  const lg = await logo(d.agencia?.logoUrl || undefined);
  const pie = `${d.vehiculo.marca} ${d.vehiculo.modelo} ${d.vehiculo.anio} · NIV ${d.vehiculo.niv || '—'}`;
  const e = new Escritor(pdf, pie);
  const encabezado = () => {
    if (lg) {
      const h = Math.min(34, 140 / lg.ratio);
      pdf.addImage(lg.src, 'PNG', M, M - 14, h * lg.ratio, h);
      e.y = M + h + 10;
    }
  };
  let primero = true;
  for (const [incluir, escribir] of [[d.incluir.contrato, contrato], [d.incluir.responsiva, responsiva], [!!d.incluir.cartaFactura && d.operacion === 'venta', cartaFactura]] as const) {
    if (!incluir) continue;
    if (!primero) e.nuevaHoja();
    primero = false;
    encabezado();
    escribir(e, d);
  }
  e.numerar();
  return pdf.output('blob');
}
