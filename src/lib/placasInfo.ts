/**
 * Cómo leer una respuesta de PlacasInfo (API V2).
 *
 * Sigue al pie de la letra su guía «Cómo interpretar el resultado»: se decide
 * por los códigos numéricos, nunca por los textos, y una fuente que falló NO
 * es una fuente limpia. Si alguna de las importantes (PGJ, OCRA, avisos,
 * REPUVE) no respondió, el resultado es «incompleto» aunque no haya alertas.
 */

export type VeredictoPlacas = 'vigente' | 'antecedente' | 'limpio' | 'incompleto';

export interface EvaluacionPlacas {
  veredicto: VeredictoPlacas;
  alertas: string[];        // reportes vigentes: detener la operación
  historial: string[];      // antecedentes: revisar documentación
  fuentesCaidas: string[];  // no se pudo preguntar: repetir la consulta
  ficha?: { marca?: string; modelo?: string; anio?: string; vin?: string; placa?: string; entidad?: string; movimiento?: string };
}

export const TEXTO_VEREDICTO: Record<VeredictoPlacas, string> = {
  vigente: 'Reporte vigente: no cierres la operación',
  antecedente: 'Con antecedentes: revisa la documentación',
  limpio: 'Sin reportes en ninguna fuente',
  incompleto: 'Resultado incompleto: alguna fuente no respondió',
};

export const NOMBRE_FUENTE: Record<string, string> = {
  pgj: 'Fiscalías (PGJ)', ocra: 'Aseguradoras (OCRA)', aviso: 'Avisos ministeriales',
  rapi: 'Procedencia ilícita (RAPI)', carfax: 'Robo EE. UU./Canadá', repuve: 'REPUVE',
};

const esObj = (x: any) => !!x && typeof x === 'object' && !Array.isArray(x);

/** Las cuatro formas de error: {error}, 401 de reCaptcha, y error de gateway. */
function conError(s: any) {
  return esObj(s) && ('error' in s || ('statusCode' in s && !('data' in s)) || ('path' in s && 'status' in s));
}

/** Objeto, lista, XCURSOR o vacío → lista de registros. */
function registros(s: any): any[] {
  if (esObj(s) && Array.isArray(s.XCURSOR)) s = s.XCURSOR;
  else if (esObj(s) && esObj(s.data) && Array.isArray(s.data.XCURSOR)) s = s.data.XCURSOR;
  if (Array.isArray(s)) return s.filter(esObj);
  if (esObj(s) && Object.keys(s).length && !conError(s) && !('message' in s && Object.keys(s).length === 1)) return [s];
  return [];
}

const t = (x: any) => (x === null || x === undefined ? '' : String(x).trim());
const entre = (...p: any[]) => { const v = p.map(t).filter(Boolean); return v.length ? ` (${v.join(', ')})` : ''; };

export function evaluarPlacas(r: any): EvaluacionPlacas {
  const alertas: string[] = [];
  const historial: string[] = [];
  const caidas: string[] = [];

  // PGJ — Fiscalías
  const pgj = r?.pgj;
  if (conError(pgj)) caidas.push('pgj');
  for (const rep of registros(pgj)) {
    const e = Number(rep.ID_ESTATUS_VHI_ROBO);
    if (e === 1) alertas.push(`Fiscalía: ROBADO, sin recuperar${entre(rep.FTE_VHI_ROBO, rep.FECHA_ROBO && `robo ${rep.FECHA_ROBO}`)}`);
    else if (e === 4 || e === 12) historial.push(`Fiscalía: robado y ${e === 12 ? 'entregado' : 'recuperado'}${entre(rep.FTE_VHI_ROBO, rep.FECHA_ROBO && `robo ${rep.FECHA_ROBO}`, rep.FEC_ACT_REC && `recuperado ${rep.FEC_ACT_REC}`)}`);
  }

  // OCRA — aseguradoras. conReporteRoboRecuperacion es TEXTO "true"/"false";
  // manda roboORecuperacion (1 = robo vigente aunque el texto diga «localizado»).
  const ocra = r?.ocra;
  if (conError(ocra)) caidas.push('ocra');
  else if (esObj(ocra) && String(ocra.conReporteRoboRecuperacion).toLowerCase() === 'true') {
    const vigente = Number(ocra.reporte?.roboORecuperacion) === 1;
    const estatus = t(ocra.vehiculo?.estatusVehiculo);
    if (vigente) {
      const robo = ocra.reporteRobo || {};
      alertas.push(`Aseguradoras: robo vigente${estatus ? ` [${estatus}]` : ''}${entre(robo.tipoRobo, robo.estado, robo.fechaRobo)}`);
    } else {
      const rec = ocra.reporteRecuperacion || {};
      historial.push(`Aseguradoras: robado y recuperado${estatus ? ` [${estatus}]` : ''}${entre(rec.fechaRecuperacion && `recuperado ${rec.fechaRecuperacion}`)}`);
    }
  }

  // AVISO — avisos ministeriales: 1 o 3 vigente; 0, 2 o ausente = cancelado.
  const aviso = r?.aviso;
  if (conError(aviso)) caidas.push('aviso');
  for (const av of registros(aviso)) {
    if (!(av.NIV || av.TIPO_DELITO)) continue;
    const detalle = `${t(av.TIPO_DELITO) || 'aviso'}${entre(av.FISCALIA, av.FECHA_ALTA && `alta ${av.FECHA_ALTA}`)}`;
    const mov = av.ID_MOVIMIENTO === undefined || av.ID_MOVIMIENTO === null ? null : Number(av.ID_MOVIMIENTO);
    if (mov === 1 || mov === 3) alertas.push(`Aviso ministerial vigente: ${detalle}`);
    else historial.push(`Aviso ministerial cancelado: ${detalle}`);
  }

  // RAPI — procedencia ilícita CDMX (tiene_delito es booleano de verdad).
  // Solo CDMX y falla seguido: si no respondió se avisa, pero no vuelve
  // «incompleto» el resultado (la función de su guía ni siquiera lo revisa).
  const rapi = r?.rapi;
  const rapiCaido = conError(rapi);
  if (!rapiCaido && esObj(rapi) && rapi.tiene_delito === true) {
    const estado = t(rapi.estado_vehiculo).toUpperCase();
    const txt = `Procedencia ilícita (CDMX): ${t(rapi.delito) || 'con delito'}${estado ? ` [${estado}]` : ''}`;
    (estado === 'PROCEDENCIA ILICITA' || estado === 'ROBADO' ? alertas : historial).push(txt);
  }

  // CARFAX — EE. UU./Canadá. Falla muy seguido: se avisa, pero no vuelve
  // «incompleto» el resultado. Un robo:true sí es alerta (a verificar).
  const carfax = r?.carfax;
  let carfaxSinDato = false;
  if (esObj(carfax)) {
    const robo = carfax.data?.robo;
    if (robo === true) alertas.push('EE. UU./Canadá: con reporte de robo (verificar: puede seguir marcado aunque ya se recuperó)');
    else if (robo !== false) carfaxSinDato = true;
  } else carfaxSinDato = true;

  // REPUVE — ficha técnica; BAJA es señal suave.
  const repuve = r?.repuve;
  if (conError(repuve)) caidas.push('repuve');
  const fichas = registros(repuve);
  for (const reg of fichas) {
    if (Number(reg.TIPO_MOVIMIENTO) === 2) { historial.push(`REPUVE: vehículo con BAJA${entre(reg.FECHA_ACTUALIZA)}`); break; }
  }
  const f = fichas[0];
  const ficha = f ? {
    marca: t(f.MARCA), modelo: t(f.MODELO), anio: t(f.ANIO_MODELO), vin: t(f.VIN), placa: t(f.PLACA),
    entidad: t(f.ENTIDAD_EMPLACO), movimiento: t(f.MOVIMIENTO),
  } : undefined;

  const fuentesCaidas = [...caidas, ...(rapiCaido ? ['rapi'] : []), ...(carfaxSinDato ? ['carfax'] : [])];
  const veredicto: VeredictoPlacas = alertas.length ? 'vigente'
    : caidas.length ? 'incompleto'
      : historial.length ? 'antecedente' : 'limpio';
  return { veredicto, alertas, historial, fuentesCaidas, ...(ficha ? { ficha } : {}) };
}

/** ¿Ya llegó la respuesta completa, o sigue «processing»? */
export function respuestaLista(r: any) {
  if (!esObj(r)) return false;
  if (String(r.status || '').toLowerCase() === 'processing') return false;
  return ['repuve', 'pgj', 'ocra', 'aviso', 'carfax'].some((k) => k in r);
}
