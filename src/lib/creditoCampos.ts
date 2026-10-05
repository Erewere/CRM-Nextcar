/**
 * Solicitudes de crédito: qué datos se piden al cliente y cómo se llenan los
 * formatos de los bancos.
 *
 * Los formatos NO están fijos en el código. Cada banco tiene en la base su PDF
 * (subido desde el CRM) y un «mapa»: para cada campo del PDF, qué dato del
 * cliente lleva. Cuando un banco cambia su formato se sube el nuevo; los
 * campos que se llamen igual conservan su dato y los nuevos se acomodan en la
 * pantalla de formatos. Este archivo lo usan el navegador y el servidor.
 */

export type TipoDato = 'texto' | 'numero' | 'fecha' | 'opcion' | 'tel' | 'email';

export interface CampoForm {
  k: string;                 // ruta en los datos: «dom.calle»
  e: string;                 // etiqueta
  t?: TipoDato;
  ops?: [string, string][];  // opciones: [valor, etiqueta]
  req?: boolean;
  mayus?: boolean;
  ayuda?: string;
  ancho?: 1 | 2 | 3;         // columnas en computadora (de 3)
  si?: (d: any) => boolean;  // solo se pide si…
}

export interface SeccionForm {
  id: string;
  titulo: string;
  corto: string;
  descripcion?: string;
  opcional?: boolean;
  si?: (d: any) => boolean;
  campos: CampoForm[];
}

const SI_NO: [string, string][] = [['si', 'Sí'], ['no', 'No']];
const ESTADOS_CIVILES: [string, string][] = [
  ['soltero', 'Soltero(a)'], ['union_libre', 'Unión libre'], ['casado_separados', 'Casado(a), bienes separados'],
  ['casado_mancomunados', 'Casado(a), sociedad conyugal'], ['divorciado', 'Divorciado(a)'], ['viudo', 'Viudo(a)'], ['separado', 'Separado(a)'],
];
const TIPOS_EMPLEO: [string, string][] = [
  ['empleado', 'Empleado'], ['actividad_empresarial', 'Negocio propio (actividad empresarial)'], ['independiente', 'Independiente / honorarios'],
  ['jubilado', 'Jubilado'], ['pensionado', 'Pensionado'], ['socio', 'Socio o accionista'],
];
const SECTORES: [string, string][] = [['comercio', 'Comercio'], ['servicios', 'Servicios'], ['manufactura', 'Manufactura / industria'], ['transporte', 'Transporte']];
const ESTUDIOS: [string, string][] = [
  ['primaria', 'Primaria'], ['secundaria', 'Secundaria'], ['preparatoria', 'Preparatoria'], ['universidad', 'Universidad'],
  ['maestria', 'Maestría'], ['doctorado', 'Doctorado'], ['sin_estudios', 'Sin estudios'],
];
const VIVIENDA: [string, string][] = [
  ['propia', 'Propia (pagada)'], ['pagandola', 'Propia, la estoy pagando'], ['hipoteca', 'Con hipoteca'],
  ['renta', 'Rentada'], ['familia', 'Vivo con familiares'], ['otro', 'Otro'],
];
const FUNCIONES_PEP: [string, string][] = [
  ['jefe_estado', 'Jefe de Estado'], ['jefe_gobierno', 'Jefe de Gobierno'], ['judicial', 'Judicial (alto rango)'],
  ['funcionario_gubernamental', 'Funcionario gubernamental'], ['secretario_estado', 'Secretario de Estado'],
  ['secretario_gobierno', 'Secretario de Gobierno y Finanzas'], ['procurador', 'Procurador General'],
  ['funcionario_partido', 'Funcionario de partido político'], ['militar', 'Militar (alto rango)'], ['diputado', 'Diputado'],
  ['lider_politico', 'Líder político'], ['empresa_estatal', 'Funcionario de empresa estatal'], ['otro', 'Otro'],
];
const PARENTESCOS_PEP: [string, string][] = [
  ['hermano', 'Hermano(a)'], ['hijo', 'Hijo(a)'], ['abuelo', 'Abuelo(a)'], ['padre', 'Madre / padre'], ['nieto', 'Nieto(a)'], ['conyuge', 'Cónyuge'],
];

const domicilio = (p: string, req = false): CampoForm[] => [
  { k: `${p}.calle`, e: 'Calle', req, ancho: 2 },
  { k: `${p}.numExt`, e: 'Número exterior', req },
  { k: `${p}.numInt`, e: 'Número interior' },
  { k: `${p}.colonia`, e: 'Colonia', req },
  { k: `${p}.cp`, e: 'Código postal', req },
  { k: `${p}.municipio`, e: 'Municipio o alcaldía', req },
  { k: `${p}.ciudad`, e: 'Ciudad', req },
  { k: `${p}.estado`, e: 'Estado', req },
];

const casado = (d: any) => ['casado_separados', 'casado_mancomunados', 'union_libre'].includes(d?.estadoCivil);

export const SECCIONES: SeccionForm[] = [
  {
    id: 'personales', titulo: 'Tus datos', corto: 'Datos personales',
    campos: [
      { k: 'nombres', e: 'Nombre(s)', req: true },
      { k: 'apellidoPaterno', e: 'Apellido paterno', req: true },
      { k: 'apellidoMaterno', e: 'Apellido materno' },
      { k: 'fechaNacimiento', e: 'Fecha de nacimiento', t: 'fecha', req: true },
      { k: 'genero', e: 'Género', t: 'opcion', ops: [['F', 'Femenino'], ['M', 'Masculino']], req: true },
      { k: 'nacionalidad', e: 'Nacionalidad', t: 'opcion', ops: [['mexicana', 'Mexicana'], ['extranjera', 'Extranjera']], req: true },
      { k: 'paisNacimiento', e: 'País de nacimiento', req: true },
      { k: 'estadoNacimiento', e: 'Estado de nacimiento', req: true },
      { k: 'ciudadNacimiento', e: 'Ciudad de nacimiento', req: true },
      { k: 'email', e: 'Correo electrónico', t: 'email', req: true, ancho: 2 },
      { k: 'celular', e: 'Celular', t: 'tel', req: true },
      { k: 'companiaCelular', e: 'Compañía del celular', t: 'opcion', ops: [['Telcel', 'Telcel'], ['AT&T', 'AT&T'], ['Movistar', 'Movistar'], ['Bait', 'Bait'], ['Otra', 'Otra']] },
      { k: 'telefonoFijo', e: 'Teléfono fijo', t: 'tel' },
      { k: 'rfc', e: 'RFC con homoclave', req: true, mayus: true, ayuda: '13 caracteres; viene en tu constancia de situación fiscal.' },
      { k: 'curp', e: 'CURP', req: true, mayus: true },
      { k: 'identificacion', e: 'Identificación', t: 'opcion', ops: [['ine', 'INE'], ['pasaporte', 'Pasaporte'], ['cedula', 'Cédula profesional'], ['fm', 'FM2 / FM3']], req: true },
      { k: 'identificacionNumero', e: 'Número de la identificación', req: true, ayuda: 'En la INE: el código de abajo a la derecha (OCR o CIC).' },
      { k: 'estadoCivil', e: 'Estado civil', t: 'opcion', ops: ESTADOS_CIVILES, req: true },
      { k: 'dependientes', e: 'Dependientes económicos', t: 'numero' },
      { k: 'estudios', e: 'Último grado de estudios', t: 'opcion', ops: ESTUDIOS },
      { k: 'profesion', e: 'Profesión u oficio' },
    ],
  },
  {
    id: 'domicilio', titulo: 'Dónde vives', corto: 'Domicilio',
    campos: [
      ...domicilio('dom', true),
      { k: 'dom.anios', e: 'Años viviendo ahí', t: 'numero', req: true },
      { k: 'dom.meses', e: 'y meses', t: 'numero' },
      { k: 'vivienda', e: 'Tu vivienda es', t: 'opcion', ops: VIVIENDA, req: true },
      { k: 'renta', e: 'Renta mensual ($)', t: 'numero', si: (d) => d?.vivienda === 'renta' },
    ],
  },
  {
    id: 'empleo', titulo: 'Tu trabajo', corto: 'Empleo',
    campos: [
      { k: 'emp.tipo', e: '¿Cómo recibes tus ingresos?', t: 'opcion', ops: TIPOS_EMPLEO, req: true, ancho: 3 },
      { k: 'emp.empresa', e: 'Empresa o negocio', req: true, ancho: 2 },
      { k: 'emp.puesto', e: 'Puesto', req: true },
      { k: 'emp.giro', e: 'Giro o actividad de la empresa', req: true, ancho: 2 },
      { k: 'emp.sector', e: 'Sector', t: 'opcion', ops: SECTORES },
      { k: 'emp.tipoEmpresa', e: 'La empresa es', t: 'opcion', ops: [['privada', 'Privada'], ['publica', 'Pública / gobierno']] },
      { k: 'emp.altaHacienda', e: '¿Estás dado de alta en Hacienda?', t: 'opcion', ops: SI_NO },
      { k: 'emp.anios', e: 'Antigüedad (años)', t: 'numero', req: true },
      { k: 'emp.meses', e: 'y meses', t: 'numero' },
      { k: 'emp.telefono', e: 'Teléfono del trabajo', t: 'tel', req: true },
      { k: 'emp.extension', e: 'Extensión' },
      { k: 'emp.ingresoFijo', e: 'Ingreso mensual fijo, antes de impuestos ($)', t: 'numero', req: true, ancho: 2 },
      { k: 'emp.ingresoVariable', e: 'Ingreso variable ($)', t: 'numero' },
      { k: 'emp.comprobacion', e: 'Compruebas tus ingresos con', t: 'opcion', ops: [['nomina', 'Recibos de nómina'], ['estados', 'Estados de cuenta']], req: true },
      ...domicilio('emp.dom', true),
      { k: 'ant.empresa', e: 'Empleo anterior: empresa', ancho: 2, si: (d) => Number(d?.emp?.anios || 0) < 1, req: true },
      { k: 'ant.telefono', e: 'Teléfono', t: 'tel', si: (d) => Number(d?.emp?.anios || 0) < 1 },
      { k: 'ant.anios', e: 'Años ahí', t: 'numero', si: (d) => Number(d?.emp?.anios || 0) < 1 },
      { k: 'ant.meses', e: 'y meses', t: 'numero', si: (d) => Number(d?.emp?.anios || 0) < 1 },
    ],
  },
  {
    id: 'referencias', titulo: 'Referencias', corto: 'Referencias',
    descripcion: 'Dos personas que te conozcan y no vivan contigo.',
    campos: [
      { k: 'ref1.nombres', e: 'Referencia 1 · Nombre(s)', req: true },
      { k: 'ref1.apellidoPaterno', e: 'Apellido paterno', req: true },
      { k: 'ref1.apellidoMaterno', e: 'Apellido materno' },
      { k: 'ref1.telefono', e: 'Teléfono', t: 'tel', req: true },
      ...domicilio('ref1.dom', false),
      { k: 'ref2.nombres', e: 'Referencia 2 (familiar) · Nombre(s)', req: true },
      { k: 'ref2.apellidoPaterno', e: 'Apellido paterno', req: true },
      { k: 'ref2.apellidoMaterno', e: 'Apellido materno' },
      { k: 'ref2.parentesco', e: 'Parentesco', req: true },
      { k: 'ref2.telefono', e: 'Teléfono', t: 'tel', req: true },
      ...domicilio('ref2.dom', false),
      { k: 'ref3.nombreCompleto', e: 'Arrendador (a quien le rentas) · Nombre completo', ancho: 2, si: (d) => d?.vivienda === 'renta' },
      { k: 'ref3.telefono', e: 'Teléfono', t: 'tel', si: (d) => d?.vivienda === 'renta' },
      { k: 'ref3.direccion', e: 'Dirección', ancho: 3, si: (d) => d?.vivienda === 'renta' },
    ],
  },
  {
    id: 'banco', titulo: 'Preguntas del banco', corto: 'Preguntas',
    campos: [
      { k: 'pep.es', e: '¿Eres o has sido persona políticamente expuesta (funcionario público de alto nivel)?', t: 'opcion', ops: SI_NO, req: true, ancho: 3 },
      { k: 'pep.funcion', e: '¿Qué función?', t: 'opcion', ops: FUNCIONES_PEP, si: (d) => d?.pep?.es === 'si' },
      { k: 'pep.funcionOtro', e: 'Especifica', si: (d) => d?.pep?.es === 'si' && d?.pep?.funcion === 'otro' },
      { k: 'pep.relacion', e: '¿Tienes relación con alguien que lo sea o lo haya sido?', t: 'opcion', ops: SI_NO, req: true, ancho: 3 },
      { k: 'pep.parentesco', e: 'Parentesco', t: 'opcion', ops: PARENTESCOS_PEP, si: (d) => d?.pep?.relacion === 'si' },
      { k: 'pep.nombre', e: 'Nombre de esa persona', si: (d) => d?.pep?.relacion === 'si' },
      { k: 'pep.funcionPariente', e: 'Su función', si: (d) => d?.pep?.relacion === 'si' },
      { k: 'tercero.es', e: '¿Actúas a nombre de otra persona?', t: 'opcion', ops: SI_NO, req: true, ancho: 3 },
      { k: 'tercero.nombre', e: 'Especifica', si: (d) => d?.tercero?.es === 'si' },
      { k: 'bancoDomiciliacion', e: 'Banco donde tienes tu cuenta (para domiciliar pagos)' },
      { k: 'esClienteBanco', e: '¿Ya eres cliente del banco al que se envía?', t: 'opcion', ops: SI_NO },
      { k: 'publicidad', e: '¿Aceptas que el banco use tus datos para publicidad?', t: 'opcion', ops: SI_NO },
    ],
  },
  {
    id: 'conyuge', titulo: 'Tu cónyuge', corto: 'Cónyuge', opcional: true, si: casado,
    descripcion: 'Opcional. Solo si el banco lo pide.',
    campos: [
      { k: 'cony.nombres', e: 'Nombre(s)' },
      { k: 'cony.apellidoPaterno', e: 'Apellido paterno' },
      { k: 'cony.apellidoMaterno', e: 'Apellido materno' },
      { k: 'cony.fechaNacimiento', e: 'Fecha de nacimiento', t: 'fecha' },
      { k: 'cony.nacionalidad', e: 'Nacionalidad', t: 'opcion', ops: [['mexicana', 'Mexicana'], ['extranjera', 'Extranjera']] },
      { k: 'cony.lugarNacimiento', e: 'Lugar de nacimiento' },
      { k: 'cony.email', e: 'Correo', t: 'email' },
      { k: 'cony.rfc', e: 'RFC', mayus: true },
      { k: 'cony.curp', e: 'CURP', mayus: true },
      { k: 'cony.emp.tipo', e: 'Ocupación', t: 'opcion', ops: TIPOS_EMPLEO },
      { k: 'cony.emp.empresa', e: 'Empresa' },
      { k: 'cony.emp.puesto', e: 'Puesto' },
      { k: 'cony.emp.giro', e: 'Actividad' },
      { k: 'cony.emp.anios', e: 'Antigüedad (años)', t: 'numero' },
      { k: 'cony.emp.telefono', e: 'Teléfono del trabajo', t: 'tel' },
      { k: 'cony.emp.ingreso', e: 'Ingreso mensual ($)', t: 'numero' },
    ],
  },
  {
    id: 'extras', titulo: 'Patrimonio y beneficiario', corto: 'Patrimonio', opcional: true,
    descripcion: 'Opcional: terrenos o casas a tu nombre, y beneficiario.',
    campos: [
      { k: 'pat1.descripcion', e: 'Propiedad 1 · Descripción' }, { k: 'pat1.direccion', e: 'Dirección' }, { k: 'pat1.valor', e: 'Valor comercial ($)', t: 'numero' },
      { k: 'pat2.descripcion', e: 'Propiedad 2 · Descripción' }, { k: 'pat2.direccion', e: 'Dirección' }, { k: 'pat2.valor', e: 'Valor comercial ($)', t: 'numero' },
      { k: 'ben.nombres', e: 'Beneficiario · Nombre(s)' }, { k: 'ben.apellidoPaterno', e: 'Apellido paterno' }, { k: 'ben.apellidoMaterno', e: 'Apellido materno' },
      { k: 'ben.parentesco', e: 'Parentesco' }, { k: 'ben.telefono', e: 'Teléfono', t: 'tel' }, { k: 'ben.porcentaje', e: 'Porcentaje (%)', t: 'numero' },
    ],
  },
];

/** Documentos que se piden desde el principio (Luis: no mayores a 3 meses). */
export const DOCUMENTOS_CREDITO: { tipo: string; etiqueta: string; ayuda: string; req: boolean }[] = [
  { tipo: 'ine', etiqueta: 'INE (frente y vuelta)', ayuda: 'Las dos caras, legibles.', req: true },
  { tipo: 'domicilio', etiqueta: 'Comprobante de domicilio', ayuda: 'Luz, agua, teléfono o predial, de no más de 3 meses.', req: true },
  { tipo: 'ingresos', etiqueta: 'Comprobantes de ingresos', ayuda: 'Recibos de nómina o estados de cuenta de los últimos 3 meses.', req: true },
  { tipo: 'constancia', etiqueta: 'Constancia de situación fiscal', ayuda: 'Del SAT, de no más de 3 meses.', req: true },
  { tipo: 'otro', etiqueta: 'Otro documento', ayuda: 'Lo que te pida tu asesor.', req: false },
];

// ===================== Lectura de los datos =====================

export function leer(o: any, ruta: string): any {
  return ruta.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);
}

export function poner(o: any, ruta: string, valor: any) {
  const partes = ruta.split('.');
  const copia = { ...(o || {}) };
  let cur: any = copia;
  partes.forEach((k, i) => {
    if (i === partes.length - 1) cur[k] = valor;
    else { cur[k] = { ...(cur[k] || {}) }; cur = cur[k]; }
  });
  return copia;
}

export function seccionesVisibles(d: any) {
  return SECCIONES.filter((s) => !s.si || s.si(d));
}

export function camposVisibles(s: SeccionForm, d: any) {
  return s.campos.filter((c) => !c.si || c.si(d));
}

/** Qué falta: requeridos vacíos de las secciones visibles. */
export function faltantes(d: any): { seccion: string; campo: CampoForm }[] {
  const r: { seccion: string; campo: CampoForm }[] = [];
  for (const s of seccionesVisibles(d)) {
    if (s.opcional) continue;
    for (const c of camposVisibles(s, d)) {
      const v = leer(d, c.k);
      if (c.req && (v === undefined || v === null || String(v).trim() === '')) r.push({ seccion: s.id, campo: c });
    }
  }
  return r;
}

export function avanceDatos(d: any) {
  let total = 0, llenos = 0;
  for (const s of seccionesVisibles(d)) {
    if (s.opcional) continue;
    for (const c of camposVisibles(s, d)) {
      if (!c.req) continue;
      total++;
      const v = leer(d, c.k);
      if (v !== undefined && v !== null && String(v).trim() !== '') llenos++;
    }
  }
  return total ? Math.round((llenos / total) * 100) : 0;
}

// ===================== Catálogo para el mapa de los formatos =====================

export interface ClaveCatalogo { clave: string; etiqueta: string; grupo: string; ops?: [string, string][] }

/** Datos que se calculan a partir de lo capturado (para formatos que los piden separados o juntos). */
const DERIVADOS: ClaveCatalogo[] = [
  { clave: 'hoy.dia', etiqueta: 'Fecha de la solicitud · día', grupo: 'Solicitud' },
  { clave: 'hoy.mes', etiqueta: 'Fecha de la solicitud · mes', grupo: 'Solicitud' },
  { clave: 'hoy.anio', etiqueta: 'Fecha de la solicitud · año', grupo: 'Solicitud' },
  { clave: 'hoy.completa', etiqueta: 'Fecha de la solicitud (dd/mm/aaaa)', grupo: 'Solicitud' },
  { clave: 'lugar', etiqueta: 'Lugar (ciudad, estado)', grupo: 'Solicitud' },
  { clave: 'op.precio', etiqueta: 'Precio del auto', grupo: 'Solicitud' },
  { clave: 'op.enganche', etiqueta: 'Enganche', grupo: 'Solicitud' },
  { clave: 'op.plazo', etiqueta: 'Plazo (meses)', grupo: 'Solicitud' },
  { clave: 'op.financiar', etiqueta: 'Monto a financiar', grupo: 'Solicitud' },
  { clave: 'op.auto', etiqueta: 'Auto (año, marca, modelo)', grupo: 'Solicitud' },
  { clave: 'agencia.nombre', etiqueta: 'Nombre de la agencia', grupo: 'Solicitud' },
  { clave: 'nombreCompleto', etiqueta: 'Nombre completo', grupo: 'Tus datos' },
  { clave: 'primerNombre', etiqueta: 'Primer nombre', grupo: 'Tus datos' },
  { clave: 'segundoNombre', etiqueta: 'Segundo nombre', grupo: 'Tus datos' },
  { clave: 'nac.dia', etiqueta: 'Nacimiento · día', grupo: 'Tus datos' },
  { clave: 'nac.mes', etiqueta: 'Nacimiento · mes', grupo: 'Tus datos' },
  { clave: 'nac.anio', etiqueta: 'Nacimiento · año', grupo: 'Tus datos' },
  { clave: 'lugarNacimiento', etiqueta: 'Lugar de nacimiento (ciudad, estado)', grupo: 'Tus datos' },
  { clave: 'celular.lada', etiqueta: 'Celular · lada', grupo: 'Tus datos' },
  { clave: 'celular.numero', etiqueta: 'Celular · número sin lada', grupo: 'Tus datos' },
  { clave: 'dom.calleNumero', etiqueta: 'Domicilio · calle y número', grupo: 'Dónde vives' },
  { clave: 'dom.completo', etiqueta: 'Domicilio completo en una línea', grupo: 'Dónde vives' },
  { clave: 'dom.pais', etiqueta: 'País de domicilio', grupo: 'Dónde vives' },
  { clave: 'dom.telefono.lada', etiqueta: 'Teléfono de casa · lada', grupo: 'Dónde vives' },
  { clave: 'dom.telefono.numero', etiqueta: 'Teléfono de casa · número', grupo: 'Dónde vives' },
  { clave: 'emp.telefono.lada', etiqueta: 'Teléfono del trabajo · lada', grupo: 'Tu trabajo' },
  { clave: 'emp.telefono.numero', etiqueta: 'Teléfono del trabajo · número', grupo: 'Tu trabajo' },
  { clave: 'emp.dom.calleNumero', etiqueta: 'Domicilio del trabajo · calle y número', grupo: 'Tu trabajo' },
  { clave: 'emp.ingresoTotal', etiqueta: 'Ingreso mensual total', grupo: 'Tu trabajo' },
  { clave: 'emp.situacion', etiqueta: 'Situación laboral (fijo/independiente/jubilado/pensionado)', grupo: 'Tu trabajo',
    ops: [['fijo', 'Fijo'], ['independiente', 'Independiente'], ['jubilado', 'Jubilado'], ['pensionado', 'Pensionado']] },
  { clave: 'ant.telefono.lada', etiqueta: 'Empleo anterior · lada', grupo: 'Tu trabajo' },
  { clave: 'ant.telefono.numero', etiqueta: 'Empleo anterior · número', grupo: 'Tu trabajo' },
  ...['ref1', 'ref2', 'ben'].flatMap((r) => [
    { clave: `${r}.nombreCompleto`, etiqueta: `${r === 'ben' ? 'Beneficiario' : `Referencia ${r.slice(-1)}`} · nombre completo`, grupo: r === 'ben' ? 'Patrimonio y beneficiario' : 'Referencias' },
    { clave: `${r}.telefono.lada`, etiqueta: `${r === 'ben' ? 'Beneficiario' : `Referencia ${r.slice(-1)}`} · lada`, grupo: r === 'ben' ? 'Patrimonio y beneficiario' : 'Referencias' },
    { clave: `${r}.telefono.numero`, etiqueta: `${r === 'ben' ? 'Beneficiario' : `Referencia ${r.slice(-1)}`} · número`, grupo: r === 'ben' ? 'Patrimonio y beneficiario' : 'Referencias' },
  ]),
  { clave: 'ref1.direccion', etiqueta: 'Referencia 1 · dirección en una línea', grupo: 'Referencias' },
  { clave: 'ref2.direccion', etiqueta: 'Referencia 2 · dirección en una línea', grupo: 'Referencias' },
  { clave: 'ref2.nombreParentesco', etiqueta: 'Referencia 2 · «nombre / parentesco»', grupo: 'Referencias' },
  { clave: 'cony.nombreCompleto', etiqueta: 'Cónyuge · nombre completo', grupo: 'Tu cónyuge' },
  { clave: 'cony.nac.dia', etiqueta: 'Cónyuge · nacimiento día', grupo: 'Tu cónyuge' },
  { clave: 'cony.nac.mes', etiqueta: 'Cónyuge · nacimiento mes', grupo: 'Tu cónyuge' },
  { clave: 'cony.nac.anio', etiqueta: 'Cónyuge · nacimiento año', grupo: 'Tu cónyuge' },
  { clave: 'cony.emp.telefono.lada', etiqueta: 'Cónyuge · teléfono trabajo lada', grupo: 'Tu cónyuge' },
  { clave: 'cony.emp.telefono.numero', etiqueta: 'Cónyuge · teléfono trabajo número', grupo: 'Tu cónyuge' },
];

export function catalogo(): ClaveCatalogo[] {
  const desdeForm: ClaveCatalogo[] = SECCIONES.flatMap((s) => s.campos.map((c) => ({ clave: c.k, etiqueta: c.e, grupo: s.titulo, ops: c.ops })));
  return [...DERIVADOS, ...desdeForm];
}

// ===================== De los datos a «plano» (lo que va en el PDF) =====================

function partirTel(t?: string) {
  const n = String(t || '').replace(/\D/g, '').slice(-10);
  if (n.length < 10) return { lada: '', numero: n };
  const dos = /^(33|55|56|81)/.test(n);
  return { lada: n.slice(0, dos ? 2 : 3), numero: n.slice(dos ? 2 : 3) };
}
const unir = (...p: any[]) => p.map((x) => String(x ?? '').trim()).filter(Boolean).join(' ');
const domLinea = (d: any) => d ? [unir(d.calle, d.numExt, d.numInt ? `int. ${d.numInt}` : ''), d.colonia, d.municipio, d.ciudad, d.estado, d.cp ? `C.P. ${d.cp}` : ''].filter((x) => String(x || '').trim()).join(', ') : '';
const dmy = (f?: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(f || '')); return m ? { dia: m[3], mes: m[2], anio: m[1] } : { dia: '', mes: '', anio: '' }; };
const pesos = (n: any) => (n === '' || n == null || Number.isNaN(Number(n)) ? '' : Number(n).toLocaleString('es-MX', { maximumFractionDigits: 2 }));

/** Todos los valores, en texto, listos para el PDF. Las opciones guardan su valor interno. */
export function aplanar(datos: any, extra: { operacion?: any; agencia?: any; auto?: string; fecha?: Date } = {}): Record<string, string> {
  const d = datos || {};
  const p: Record<string, string> = {};
  const recorrer = (o: any, pref: string) => {
    if (o == null) return;
    if (typeof o === 'object' && !Array.isArray(o)) { Object.entries(o).forEach(([k, v]) => recorrer(v, pref ? `${pref}.${k}` : k)); return; }
    p[pref] = String(o);
  };
  recorrer(d, '');
  const hoy = extra.fecha || new Date();
  p['hoy.dia'] = String(hoy.getDate()).padStart(2, '0');
  p['hoy.mes'] = String(hoy.getMonth() + 1).padStart(2, '0');
  p['hoy.anio'] = String(hoy.getFullYear());
  p['hoy.completa'] = `${p['hoy.dia']}/${p['hoy.mes']}/${p['hoy.anio']}`;
  const nombres = String(d.nombres || '').trim().split(/\s+/);
  p.primerNombre = nombres[0] || '';
  p.segundoNombre = nombres.slice(1).join(' ');
  p.nombreCompleto = unir(d.nombres, d.apellidoPaterno, d.apellidoMaterno);
  const n = dmy(d.fechaNacimiento); p['nac.dia'] = n.dia; p['nac.mes'] = n.mes; p['nac.anio'] = n.anio;
  p.lugarNacimiento = [d.ciudadNacimiento, d.estadoNacimiento].filter(Boolean).join(', ');
  const cel = partirTel(d.celular); p['celular.lada'] = cel.lada; p['celular.numero'] = cel.numero;
  const fijo = partirTel(d.telefonoFijo || d.celular); p['dom.telefono.lada'] = fijo.lada; p['dom.telefono.numero'] = fijo.numero;
  p['dom.calleNumero'] = unir(d.dom?.calle, d.dom?.numExt, d.dom?.numInt ? `int. ${d.dom.numInt}` : '');
  p['dom.completo'] = domLinea(d.dom);
  p['dom.pais'] = 'México';
  p.lugar = [d.dom?.ciudad, d.dom?.estado].filter(Boolean).join(', ') || String(extra.agencia?.ciudad || '');
  const tel = partirTel(d.emp?.telefono); p['emp.telefono.lada'] = tel.lada; p['emp.telefono.numero'] = tel.numero;
  p['emp.dom.calleNumero'] = unir(d.emp?.dom?.calle, d.emp?.dom?.numExt);
  p['emp.ingresoTotal'] = pesos(Number(d.emp?.ingresoFijo || 0) + Number(d.emp?.ingresoVariable || 0));
  p['emp.situacion'] = ({ empleado: 'fijo', socio: 'fijo', actividad_empresarial: 'independiente', independiente: 'independiente', jubilado: 'jubilado', pensionado: 'pensionado' } as Record<string, string>)[d.emp?.tipo] || '';
  ['emp.ingresoFijo', 'emp.ingresoVariable', 'renta', 'cony.emp.ingreso', 'pat1.valor', 'pat2.valor'].forEach((k) => { if (p[k]) p[k] = pesos(p[k]); });
  const ant = partirTel(d.ant?.telefono); p['ant.telefono.lada'] = ant.lada; p['ant.telefono.numero'] = ant.numero;
  for (const r of ['ref1', 'ref2', 'ben']) {
    p[`${r}.nombreCompleto`] = unir(d[r]?.nombres, d[r]?.apellidoPaterno, d[r]?.apellidoMaterno);
    const t = partirTel(d[r]?.telefono); p[`${r}.telefono.lada`] = t.lada; p[`${r}.telefono.numero`] = t.numero;
  }
  p['ref1.direccion'] = domLinea(d.ref1?.dom);
  p['ref2.direccion'] = domLinea(d.ref2?.dom);
  p['ref2.nombreParentesco'] = [p['ref2.nombreCompleto'], d.ref2?.parentesco].filter(Boolean).join(' / ');
  p['cony.nombreCompleto'] = unir(d.cony?.nombres, d.cony?.apellidoPaterno, d.cony?.apellidoMaterno);
  const cn = dmy(d.cony?.fechaNacimiento); p['cony.nac.dia'] = cn.dia; p['cony.nac.mes'] = cn.mes; p['cony.nac.anio'] = cn.anio;
  const ct = partirTel(d.cony?.emp?.telefono); p['cony.emp.telefono.lada'] = ct.lada; p['cony.emp.telefono.numero'] = ct.numero;
  const op = extra.operacion || {};
  p['op.precio'] = op.precio ? pesos(op.precio) : '';
  p['op.enganche'] = op.enganche ? pesos(op.enganche) : '';
  p['op.plazo'] = op.plazo ? String(op.plazo) : '';
  p['op.financiar'] = op.precio ? pesos(Math.max(0, Number(op.precio) - Number(op.enganche || 0))) : '';
  p['op.auto'] = extra.auto || '';
  p['agencia.nombre'] = String(extra.agencia?.name || '');
  return p;
}

/** Texto para un campo de texto: si la clave es de opción, su etiqueta. */
export function textoDe(plano: Record<string, string>, clave: string) {
  const v = plano[clave] ?? '';
  const def = catalogo().find((c) => c.clave === clave);
  if (def?.ops && v) return def.ops.find(([val]) => val === v)?.[1] ?? v;
  return v;
}

// ===================== Formatos =====================

export interface CampoPdf { nombre: string; tipo: 'texto' | 'opcion' | 'otro'; valores?: string[]; pagina: number; x: number; y: number; w: number; h: number;
  /** Cada casilla de un grupo, con su valor y su lugar (para el mapa numerado). */
  cajas?: { valor: string; pagina: number; x: number; y: number }[] }
export interface MapeoCampo { clave?: string; fijo?: string; opciones?: Record<string, string> }
export interface FormatoCredito {
  id: string;
  clave: string;
  nombre: string;
  agencyId: string | null;
  version: number;
  campos: CampoPdf[];
  mapa: Record<string, MapeoCampo>;
  mayusculas: boolean;
  actualizadoEl?: string;
}

/** Abre un PDF de banco (también los cifrados sin contraseña de apertura). */
export async function abrirPdf(bytes: ArrayBuffer | Uint8Array) {
  const { PDFDocument } = await import('@cantoo/pdf-lib');
  return PDFDocument.load(bytes as any, { password: '' } as any);
}

/** Los campos de un PDF, para el mapa. */
export async function camposDelPdf(bytes: ArrayBuffer | Uint8Array): Promise<CampoPdf[]> {
  const pdf: any = await abrirPdf(bytes);
  const paginas = pdf.getPages();
  const lista: CampoPdf[] = [];
  for (const f of pdf.getForm().getFields()) {
    const tipoClase = f.constructor.name;
    const tipo: CampoPdf['tipo'] = tipoClase === 'PDFTextField' ? 'texto' : (tipoClase === 'PDFRadioGroup' || tipoClase === 'PDFCheckBox') ? 'opcion' : 'otro';
    const widgets = f.acroField.getWidgets();
    const w0 = widgets[0];
    const r = w0?.getRectangle?.() || { x: 0, y: 0, width: 0, height: 0 };
    const pRef = w0?.P?.();
    let pagina = 1;
    if (pRef) { const i = paginas.findIndex((pg: any) => pg.ref === pRef); if (i >= 0) pagina = i + 1; }
    const valores = tipo === 'opcion' ? [...new Set(widgets.map((w: any) => String(w.getOnValue?.() ?? '').replace(/^\//, '')).filter(Boolean))] as string[] : undefined;
    const paginaDe = (w: any) => { const ref = w?.P?.(); const i = ref ? paginas.findIndex((pg: any) => pg.ref === ref) : -1; return i >= 0 ? i + 1 : pagina; };
    const cajas = tipo === 'opcion' ? widgets.map((w: any) => { const rr = w.getRectangle(); return { valor: String(w.getOnValue?.() ?? '').replace(/^\//, ''), pagina: paginaDe(w), x: Math.round(rr.x), y: Math.round(rr.y + rr.height) }; }) : undefined;
    lista.push({ nombre: f.getName(), tipo, ...(valores ? { valores } : {}), ...(cajas ? { cajas } : {}), pagina, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) });
  }
  return lista;
}

/** Llena el PDF del banco con los datos según su mapa. Devuelve los bytes del PDF llenado. */
export async function llenarFormato(bytes: ArrayBuffer | Uint8Array, formato: Pick<FormatoCredito, 'mapa' | 'mayusculas'>, plano: Record<string, string>, opciones: { fijar?: boolean } = {}): Promise<Uint8Array> {
  const lib: any = await import('@cantoo/pdf-lib');
  const pdf: any = await abrirPdf(bytes);
  const form = pdf.getForm();
  const fuente = await pdf.embedFont(lib.StandardFonts.Helvetica);
  // Tamaño de letra que cabe en la casilla: muchos formatos dejan la letra en
  // «automático» y en casillas chicas (día, mes) el texto salía cortado.
  const ajustarLetra = (f: any, texto: string) => {
    try {
      if (f.isCombed?.() || f.isMultiline?.()) return;
      const r = f.acroField.getWidgets()[0]?.getRectangle();
      if (!r || !texto) return;
      const da = String(f.acroField.getDefaultAppearance?.() || '');
      const m = /(\d+(?:\.\d+)?)\s+Tf/.exec(da);
      const base = m && Number(m[1]) > 0 ? Number(m[1]) : 10;
      const porAlto = (r.height - 2) * 0.8;
      const ancho1 = fuente.widthOfTextAtSize(texto, 1) || 1;
      const porAncho = (r.width - 3) / ancho1;
      f.setFontSize(Math.max(4, Math.min(base, porAlto, porAncho)));
    } catch { /* se queda el tamaño del formato */ }
  };
  for (const [nombre, m] of Object.entries(formato.mapa || {})) {
    let f: any;
    try { f = form.getField(nombre); } catch { continue; }
    if (!f || (!m.clave && m.fijo === undefined)) continue;
    const clase = f.constructor.name;
    if (clase === 'PDFTextField') {
      let texto = m.fijo !== undefined && m.fijo !== '' ? m.fijo : textoDe(plano, m.clave || '');
      if (formato.mayusculas) texto = texto.toUpperCase();
      const max = f.getMaxLength?.();
      // Si no cabe, en números se quedan las últimas cifras (2026 → 26).
      if (max && texto.length > max) texto = /^\d+$/.test(texto) ? texto.slice(-max) : texto.slice(0, max);
      try { f.setText(texto || ''); ajustarLetra(f, texto); } catch { /* campo raro: se deja vacío */ }
    } else if (clase === 'PDFRadioGroup' || clase === 'PDFCheckBox') {
      const valorCrm = m.fijo !== undefined && m.fijo !== '' ? m.fijo : (plano[m.clave || ''] ?? '');
      const valorPdf = m.opciones ? m.opciones[valorCrm] : undefined;
      // Se marca a bajo nivel: hay formatos con varias casillas del mismo
      // nombre, cada una con su valor, que la librería no sabe elegir.
      const ninguno = !valorPdf;
      f.acroField.dict.set(lib.PDFName.of('V'), lib.PDFName.of(ninguno ? 'Off' : valorPdf));
      for (const w of f.acroField.getWidgets()) {
        const on = String(w.getOnValue?.() ?? '').replace(/^\//, '');
        w.setAppearanceState(lib.PDFName.of(!ninguno && on === valorPdf ? on : 'Off'));
      }
    }
  }
  try {
    form.updateFieldAppearances(fuente);
    // Que los visores usen este dibujo (con la letra ya ajustada a cada
    // casilla) en vez de redibujar a su manera y cortar el texto.
    form.acroForm.dict.set(lib.PDFName.of('NeedAppearances'), lib.PDFBool.False);
  } catch { /* se quedan las apariencias del lector */ }
  // Los datos se fijan en la hoja: así se ven igual en cualquier programa
  // (Vista Previa de la Mac redibujaba y cortaba las casillas chicas) y nadie
  // los cambia por accidente. Si algo está mal, se corrige en el CRM.
  if (opciones.fijar !== false) {
    try { form.flatten({ updateFieldAppearances: false }); } catch { /* se queda editable */ }
  }
  // Los formatos cifrados (como el de Hey) traen índices viejos que siguen
  // diciendo «cifrado»: se quitan para que cualquier programa lo abra bien.
  try {
    const N = (n: string) => lib.PDFName.of(n);
    for (const [ref, obj] of pdf.context.enumerateIndirectObjects()) {
      const o: any = obj;
      const dict = o?.dict || (o?.constructor?.name === 'PDFDict' ? o : null);
      const esXref = dict && String(dict.get?.(N('Type')) || '') === '/XRef';
      const esCifrado = dict && dict.has?.(N('StmF')) && dict.has?.(N('O')) && dict.has?.(N('U'));
      if (o?.constructor?.name === 'PDFInvalidObject' || esXref || esCifrado) pdf.context.delete(ref);
    }
  } catch { /* sin limpiar: igual se puede abrir */ }
  return pdf.save({ updateFieldAppearances: false, useObjectStreams: false });
}

/** Al subir una versión nueva: conserva el mapa de los campos que siguen existiendo. */
export function heredarMapa(anterior: Record<string, MapeoCampo>, campos: CampoPdf[]) {
  const nombres = new Set(campos.map((c) => c.nombre));
  const mapa: Record<string, MapeoCampo> = {};
  let conservados = 0;
  for (const [k, v] of Object.entries(anterior || {})) if (nombres.has(k)) { mapa[k] = v; conservados++; }
  const sinAcomodar = campos.filter((c) => c.tipo !== 'otro' && !mapa[c.nombre]).length;
  return { mapa, conservados, sinAcomodar };
}

/** Datos inventados para la vista previa de un formato. */
export const DATOS_DE_MUESTRA: any = {
  nombres: 'MARÍA FERNANDA', apellidoPaterno: 'PRUEBA', apellidoMaterno: 'MUESTRA', fechaNacimiento: '1990-05-14', genero: 'F',
  nacionalidad: 'mexicana', paisNacimiento: 'México', estadoNacimiento: 'Jalisco', ciudadNacimiento: 'Guadalajara',
  email: 'correo@ejemplo.com', celular: '3312345678', companiaCelular: 'Telcel', rfc: 'PUMM900514AB1', curp: 'PUMM900514MJCRSR09',
  identificacion: 'ine', identificacionNumero: '1234567890123', estadoCivil: 'casado_separados', dependientes: '2', estudios: 'universidad', profesion: 'Contadora',
  dom: { calle: 'Av. Ejemplo', numExt: '123', numInt: '4', colonia: 'Centro', cp: '44100', municipio: 'Guadalajara', ciudad: 'Guadalajara', estado: 'Jalisco', anios: '5', meses: '2' },
  vivienda: 'renta', renta: '9000',
  emp: { tipo: 'empleado', empresa: 'Empresa de Muestra SA de CV', puesto: 'Coordinadora', giro: 'Comercio de refacciones', sector: 'comercio', tipoEmpresa: 'privada', altaHacienda: 'si', anios: '4', meses: '0', telefono: '3398765432', extension: '12', ingresoFijo: '38000', ingresoVariable: '2000', comprobacion: 'nomina',
    dom: { calle: 'Calle Trabajo', numExt: '500', colonia: 'Industrial', cp: '44940', municipio: 'Guadalajara', ciudad: 'Guadalajara', estado: 'Jalisco' } },
  ref1: { nombres: 'PEDRO', apellidoPaterno: 'REFERENCIA', apellidoMaterno: 'UNO', telefono: '3311112222', dom: { calle: 'Calle Uno', numExt: '1', colonia: 'Americana', ciudad: 'Guadalajara', estado: 'Jalisco', cp: '44160' } },
  ref2: { nombres: 'ANA', apellidoPaterno: 'REFERENCIA', apellidoMaterno: 'DOS', parentesco: 'Hermana', telefono: '3333334444', dom: { calle: 'Calle Dos', numExt: '2', colonia: 'Providencia', ciudad: 'Zapopan', estado: 'Jalisco', cp: '45040' } },
  ref3: { nombreCompleto: 'JOSÉ ARRENDADOR', telefono: '3355556666', direccion: 'Calle Tres 3, Zapopan, Jal.' },
  pep: { es: 'no', relacion: 'no' }, tercero: { es: 'no' }, bancoDomiciliacion: 'BBVA', esClienteBanco: 'no', publicidad: 'no',
};
