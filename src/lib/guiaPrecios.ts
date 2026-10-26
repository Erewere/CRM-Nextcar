/**
 * Precio de venta y de compra de un auto según la guía de Autocosmos.
 *
 * Lo consulta la página Nextcar (api/search-autocosmos.php). Solo viaja marca,
 * modelo y año: ningún dato de clientes y ninguna IA, como promete el aviso de
 * privacidad del CRM.
 *
 * De dónde sale cada número:
 *  - Venta = precio de la guía de Autocosmos para esa versión.
 *  - Compra = 87% de la venta. Es la relación fija entre compra y venta del
 *    Libro Azul (medida en 15 autos de 80 mil a 5 millones: siempre entre
 *    86.8% y 87.6%). La calcula la página, aquí solo se redondea.
 *
 * Qué tan confiable es (medido contra el Libro Azul, oct 2026):
 *  - Autos comunes y de gama media (BMW, Audi, Chevrolet...): a ±5%.
 *  - Porsche Cayenne: entre 5 y 10% por debajo.
 *  - Porsche 911: ~25% por debajo. Ahí la guía NO sirve.
 * Por eso cada resultado trae `confianza`, y la pantalla no enseña números
 * cuando es «baja».
 */

import { kmTipico, factorPorKm, PCT_POR_MIL_KM, DIFERENCIA_MINIMA_KM } from './kilometraje';

export const URL_GUIA = 'https://www.nextcar.erewere.com/api/search-autocosmos.php';
/** Autocosmos no consulta modelos de 2014 o anteriores (regla del revisor de precios). */
export const ANIO_MINIMO_GUIA = 2015;
export const FACTOR_COMPRA = 0.87;

export type ConfianzaGuia = 'alta' | 'media' | 'baja';

export interface GuiaPrecio {
  venta: number;
  compra: number;
  ventaMin: number;
  ventaMax: number;
  /** Versión de la guía a la que se parece el auto; vacío si se usó un rango. */
  version: string;
  /** Cuántas versiones tiene la guía para ese año. */
  versiones: number;
  confianza: ConfianzaGuia;
  /** Una línea para la persona: por qué esta confianza. */
  motivo: string;
  fecha: string;
  /** El kilometraje se descuenta aquí, no en Autocosmos (ver kilometraje.ts). Solo viene si se dio el km del auto. */
  kmAjuste?: {
    kmUsado: number;
    /** El kilometraje típico de la edad del auto, al que Autocosmos dio su precio. */
    kmReferencia: number;
    porMilKm: number;
    /** Los precios al kilometraje típico, antes de descontar. */
    ventaSinAjuste: number;
    compraSinAjuste: number;
    ventaMinSinAjuste: number;
    ventaMaxSinAjuste: number;
  };
}

/** «4 pts. GL MID, 1.6l, TM6, a/ac.» → «GL MID». Para buscar en Mercado Libre y en las ventas propias. */
export function nombreCortoVersion(v: string): string {
  const sinPuertas = String(v || '').replace(/^\s*\d+\s*pts?\.?\s*/i, '');
  return sinPuertas.split(',')[0].trim().slice(0, 40);
}

/** ¿Es una versión copiada de la guía («4 pts. GL MID, 1.6l, …») y no algo escrito a mano («Advance»)? */
export const esVersionDeGuia = (v: string) => /pts\.?/i.test(v) && v.includes(',');

/**
 * Aplica el descuento por kilometraje a una guía pedida al kilometraje típico. Se puede volver a llamar con otro
 * porcentaje: siempre parte de los precios sin ajustar (`kmAjuste`), nunca de los ya descontados.
 */
export function ajustarGuiaPorKm(g: GuiaPrecio, km: number | null | undefined, kmReferencia: number, porMilKm = PCT_POR_MIL_KM): GuiaPrecio {
  if (km == null || !Number.isFinite(Number(km)) || Number(km) < 0) return g;
  const kmUsado = Math.round(Number(km));
  const base = g.kmAjuste
    ? { venta: g.kmAjuste.ventaSinAjuste, compra: g.kmAjuste.compraSinAjuste, ventaMin: g.kmAjuste.ventaMinSinAjuste, ventaMax: g.kmAjuste.ventaMaxSinAjuste }
    : { venta: g.venta, compra: g.compra, ventaMin: g.ventaMin, ventaMax: g.ventaMax };
  const f = Math.abs(kmUsado - kmReferencia) < DIFERENCIA_MINIMA_KM ? 1 : factorPorKm(kmUsado, kmReferencia, porMilKm);
  return {
    ...g,
    venta: f === 1 ? base.venta : redondear500(base.venta * f),
    compra: f === 1 ? base.compra : redondear500(base.compra * f),
    ventaMin: f === 1 ? base.ventaMin : redondear500(base.ventaMin * f),
    ventaMax: f === 1 ? base.ventaMax : redondear500(base.ventaMax * f),
    kmAjuste: { kmUsado, kmReferencia, porMilKm, ventaSinAjuste: base.venta, compraSinAjuste: base.compra, ventaMinSinAjuste: base.ventaMin, ventaMaxSinAjuste: base.ventaMax },
  };
}

const MARCAS_SIN_GUIA = ['ferrari', 'lamborghini', 'mclaren', 'maserati', 'bentley', 'rolls-royce', 'rolls royce', 'aston martin', 'lotus', 'bugatti'];
const MODELOS_PORSCHE_SIN_GUIA = ['911', '718', 'taycan', 'panamera', 'boxster', 'cayman'];

const quitarAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Autocosmos manda «Coup&#xE9;»: se vuelve «Coupé». */
const decodificar = (s: string) =>
  String(s || '')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, '&');

const palabras = (s: string) =>
  quitarAcentos(decodificar(s).toLowerCase()).split(/[^a-z0-9]+/).filter(Boolean);

/** Palabras que no distinguen una versión de otra. */
const PALABRAS_VACIAS = new Set(['xdrive', 'sdrive', 'quattro', 'aut', 'auto', 'automatico', 'automatica', 'man', 'manual', 'std', 'pts', 'puertas', 'dr']);

const redondear500 = (n: number) => Math.round(n / 500) * 500;
const mediana = (xs: number[]) => {
  const o = [...xs].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
};

interface VersionGuia { version: string; venta: number; compra: number }

/**
 * Elige qué versión de la guía es el auto. Las palabras del modelo después de
 * la primera («Pathfinder Advance» → «advance») se buscan en el nombre de cada
 * versión. Si una sola gana, es esa; si no hay empate claro, se da un rango.
 */
export function interpretarGuia(
  respuesta: any, marca: string, modelo: string, anio: number | string, fecha = new Date().toISOString(),
  /** La versión tal cual la da la guía (elegida de la lista): si existe, es esa y no hay que adivinar. */
  versionExacta = '',
): GuiaPrecio | null {
  if (!respuesta?.success || !Array.isArray(respuesta.versiones) || !respuesta.versiones.length) return null;
  // Una estimación hecha con Mercado Libre NO es la guía: no se usa aquí.
  if (!String(respuesta.url_fuente || '').includes('autocosmos.com.mx')) return null;
  if (respuesta.versiones.some((v: any) => v?.es_estimacion)) return null;

  const todas: VersionGuia[] = respuesta.versiones
    .map((v: any) => {
      const venta = Number(v?.precio_venta ?? v?.precio_guia) || 0;
      return {
        version: decodificar(String(v?.version || '')),
        venta,
        compra: Number(v?.precio_compra_ref) || redondear500(venta * FACTOR_COMPRA),
      };
    })
    .filter((v: VersionGuia) => v.venta > 0);
  if (!todas.length) return null;

  const palabrasMarca = new Set(palabras(marca));
  const palabrasModelo = palabras(modelo);
  // La primera palabra es el modelo base (ya se buscó con ella); lo demás es la versión.
  const deVersion = palabrasModelo.slice(1).filter((p) => p.length >= 2 && !palabrasMarca.has(p) && !PALABRAS_VACIAS.has(p));
  // «40i», «118i», «2.0»: el dato que más distingue una versión pesa el triple que «sport» o «advance».
  const peso = (p: string) => (/\d/.test(p) ? 3 : 1);

  let elegidas = todas;
  let version = '';
  let confianza: ConfianzaGuia = 'media';
  let motivo = 'La guía tiene varias versiones y no se pudo saber cuál es: es un rango.';

  const clave = (x: string) => palabras(x).join(' ');
  const iguales = versionExacta ? todas.filter((v) => clave(v.version) === clave(versionExacta)) : [];
  if (todas.length === 1) {
    elegidas = todas;
    version = todas[0].version;
    confianza = 'alta';
    motivo = 'La guía tiene una sola versión para este año.';
  } else if (iguales.length === 1) {
    elegidas = iguales;
    version = iguales[0].version;
    confianza = 'alta';
    motivo = 'La versión que elegiste es la de la guía.';
  } else if (deVersion.length) {
    const puntos = todas.map((v) => {
      const enVersion = new Set(palabras(v.version));
      return deVersion.filter((p) => enVersion.has(p)).reduce((t, p) => t + peso(p), 0);
    });
    const mejor = Math.max(...puntos);
    if (mejor > 0) {
      const ganadoras = todas.filter((_, i) => puntos[i] === mejor);
      elegidas = ganadoras;
      if (ganadoras.length === 1) {
        version = ganadoras[0].version;
        confianza = 'alta';
        motivo = 'La versión coincide con la de la guía.';
      } else {
        motivo = `${ganadoras.length} versiones de la guía se parecen: es un rango.`;
      }
    }
  }

  const ventas = elegidas.map((v) => v.venta);
  const ventaMin = Math.min(...ventas);
  const ventaMax = Math.max(...ventas);

  // Un rango muy ancho no es un precio: la distancia entre versiones es mayor que lo que ayuda.
  if (elegidas.length > 1 && ventaMax > ventaMin * 1.35) {
    confianza = 'baja';
    motivo = 'Las versiones de este modelo cuestan muy distinto y no se pudo saber cuál es.';
  }

  // Marcas y modelos donde la guía queda corta (medido contra el Libro Azul).
  const m = quitarAcentos(marca.toLowerCase()).trim();
  if (MARCAS_SIN_GUIA.some((x) => m.includes(x))) {
    confianza = 'baja';
    motivo = 'En autos de lujo y deportivos la guía queda muy corta.';
  } else if (m.includes('porsche')) {
    if (palabrasModelo.some((p) => MODELOS_PORSCHE_SIN_GUIA.includes(p))) {
      confianza = 'baja';
      motivo = 'En deportivos Porsche la guía queda ~25% por debajo del mercado.';
    } else if (confianza === 'alta') {
      confianza = 'media';
      motivo = 'En Porsche la guía suele quedar entre 5 y 10% por debajo del mercado.';
    }
  }

  // La guía se pide siempre al kilometraje típico de la edad del auto; el descuento por kilómetros se hace después
  // (ajustarGuiaPorKm). Si la página tuvo que estimarlo por su cuenta, igual es el típico.

  const venta = redondear500(elegidas.length === 1 ? elegidas[0].venta : mediana(ventas));
  const compra = redondear500(elegidas.length === 1 ? elegidas[0].compra : mediana(elegidas.map((v) => v.compra)));
  void anio;
  return { venta, compra, ventaMin, ventaMax, version, versiones: todas.length, confianza, motivo, fecha };
}

async function pedirGuia(marca: string, modelo: string, anio: number | string, km: number): Promise<any> {
  const qs = new URLSearchParams({ marca, modelo, anio: String(anio || ''), km: String(Math.round(km)) });
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 45000);
  try {
    const r = await fetch(`${URL_GUIA}?${qs}`, { signal: ctl.signal });
    // 404 = Autocosmos no tiene ese modelo: es una respuesta, no un fallo.
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

/**
 * null = no hay guía para este auto (modelo viejo o Autocosmos no lo tiene).
 * Si la página no responde, lanza: quien llama decide si reintenta.
 *
 * `km` es el kilometraje del auto. A Autocosmos se le pide el precio al kilometraje típico de la edad y el
 * descuento por kilómetros se aplica aquí (ver kilometraje.ts). Sin `km` queda el precio típico, con confianza media.
 * `versionExacta`: la versión copiada de la lista de la guía; si se da, se usa esa sin adivinar.
 */
export async function consultarGuia(marca: string, modelo: string, anio: number | string, km?: number | null, versionExacta = ''): Promise<GuiaPrecio | null> {
  if (!marca || !modelo || !(Number(anio) >= ANIO_MINIMO_GUIA)) return null;
  const completo = String(modelo).trim();
  const palabrasCompleto = completo.split(/\s+/);
  const kmRef = kmTipico(anio);
  // Modelo completo; si Autocosmos no lo conoce, las dos primeras palabras («Serie 1») y luego solo la primera.
  const intentos = [completo, palabrasCompleto.slice(0, 2).join(' '), palabrasCompleto[0]]
    .filter((x, i, l) => x && l.indexOf(x) === i);
  for (const q of intentos) {
    const g = interpretarGuia(await pedirGuia(marca, q, anio, kmRef), marca, completo, anio, undefined, versionExacta);
    if (!g) continue;
    const conKm = ajustarGuiaPorKm(g, km, kmRef);
    if (km == null && conKm.confianza === 'alta') {
      return { ...conKm, confianza: 'media', motivo: `${conKm.motivo} No se dio el kilometraje: se usó el típico de la edad.` };
    }
    return conKm;
  }
  return null;
}
