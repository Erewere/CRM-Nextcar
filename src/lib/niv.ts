/**
 * Revisión del NIV (número de serie, VIN) antes de consultarlo en el REPUVE.
 * Todo se calcula aquí, sin conexión: no consulta ningún servicio.
 *
 * - 17 caracteres, sin I, O ni Q (no existen en un NIV).
 * - Dígito verificador (posición 9): obligatorio en autos hechos para
 *   Norteamérica (EUA, Canadá, México). En autos de otros mercados la
 *   posición 9 puede ser otra cosa, así que ahí solo es un aviso suave.
 * - Año modelo (posición 10) y país de fabricación (posición 1).
 */

export interface RevisionNiv {
  niv: string;
  completo: boolean;            // 17 caracteres válidos
  pais: string;
  norteamerica: boolean;
  digitoOk: boolean | null;     // null = no se pudo revisar
  anioModelo: number | null;
  avisos: { tipo: 'error' | 'alerta' | 'info'; texto: string }[];
}

const VALOR: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, J: 1, K: 2, L: 3, M: 4, N: 5,
  P: 7, R: 9, S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
};
const PESOS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];
const LETRAS_ANIO = 'ABCDEFGHJKLMNPRSTVWXY'; // 1980..2000, y otra vuelta 2010..2030

export function limpiarNiv(v?: string) {
  return String(v || '').toUpperCase().replace(/[\s-]+/g, '');
}

function digitoVerificador(niv: string): string | null {
  let suma = 0;
  for (let i = 0; i < 17; i++) {
    const c = niv[i];
    const v = /\d/.test(c) ? Number(c) : VALOR[c];
    if (v === undefined) return null;
    suma += v * PESOS[i];
  }
  const r = suma % 11;
  return r === 10 ? 'X' : String(r);
}

function paisDe(niv: string): { pais: string; norteamerica: boolean } {
  const a = niv[0], b = niv[1] || '';
  if ('145'.includes(a)) return { pais: 'Estados Unidos', norteamerica: true };
  if (a === '2') return { pais: 'Canadá', norteamerica: true };
  if (a === '3' && /[A-W]/.test(b)) return { pais: 'México', norteamerica: true };
  if (a === '3') return { pais: 'Centro o Sudamérica', norteamerica: false };
  if (a === 'J') return { pais: 'Japón', norteamerica: false };
  if (a === 'K') return { pais: 'Corea del Sur', norteamerica: false };
  if (a === 'L') return { pais: 'China', norteamerica: false };
  if (a === 'M') return { pais: 'India, Indonesia o Tailandia', norteamerica: false };
  if (a === 'S') return { pais: 'Reino Unido', norteamerica: false };
  if (a === 'T') return { pais: 'Europa (Suiza, Rep. Checa, Hungría…)', norteamerica: false };
  if (a === 'V') return { pais: /[S-W]/.test(b) ? 'España' : 'Francia', norteamerica: false };
  if (a === 'W') return { pais: 'Alemania', norteamerica: false };
  if (a === 'Y') return { pais: 'Suecia o Finlandia', norteamerica: false };
  if (a === 'Z') return { pais: 'Italia', norteamerica: false };
  if (a === '9') return { pais: 'Brasil', norteamerica: false };
  if (a === '8') return { pais: 'Argentina o Chile', norteamerica: false };
  return { pais: 'Otro país', norteamerica: false };
}

/** Año modelo de la posición 10; de las dos vueltas posibles, la más cercana al año capturado. */
function anioDe(c: string, anioCapturado?: number): number | null {
  let base: number | null = null;
  const i = LETRAS_ANIO.indexOf(c);
  if (i >= 0) base = 1980 + i;
  else if (/[1-9]/.test(c)) base = 2000 + Number(c);
  if (base === null) return null;
  const opciones = [base, base + 30].filter((a) => a <= new Date().getFullYear() + 1);
  if (!opciones.length) return null;
  const ref = anioCapturado || new Date().getFullYear();
  return opciones.sort((x, y) => Math.abs(x - ref) - Math.abs(y - ref))[0];
}

export function revisarNiv(valor?: string, anioCapturado?: number): RevisionNiv {
  const niv = limpiarNiv(valor);
  const avisos: RevisionNiv['avisos'] = [];
  const vacio: RevisionNiv = { niv, completo: false, pais: '', norteamerica: false, digitoOk: null, anioModelo: null, avisos };
  if (!niv) {
    avisos.push({ tipo: 'info', texto: 'Captura el NIV (número de serie) para revisarlo y consultarlo.' });
    return vacio;
  }
  const prohibidas = [...new Set(niv.match(/[IOQ]/g) || [])];
  if (prohibidas.length) avisos.push({ tipo: 'error', texto: `Tiene ${prohibidas.join(', ')}: un NIV nunca lleva I, O ni Q. Seguramente es 1 o 0.` });
  if (/[^A-Z0-9]/.test(niv)) avisos.push({ tipo: 'error', texto: 'Tiene caracteres que no van en un NIV (solo letras y números).' });
  if (niv.length !== 17) {
    avisos.push({ tipo: 'error', texto: `Tiene ${niv.length} caracteres y deben ser 17.` });
    return vacio;
  }
  if (avisos.some((a) => a.tipo === 'error')) return vacio;

  const { pais, norteamerica } = paisDe(niv);
  const esperado = digitoVerificador(niv);
  const digitoOk = esperado === null ? null : esperado === niv[8];
  const anioModelo = anioDe(niv[9], anioCapturado);

  if (digitoOk === false) {
    avisos.push(norteamerica
      ? { tipo: 'alerta', texto: 'El dígito verificador (posición 9) no cuadra. Revisa que esté bien capturado; si lo está, es una señal de alerta: puede ser un NIV alterado.' }
      : { tipo: 'info', texto: 'El dígito verificador no cuadra, pero en autos hechos fuera de Norteamérica eso puede ser normal.' });
  }
  if (anioModelo && anioCapturado && anioModelo !== Number(anioCapturado)) {
    avisos.push({
      tipo: norteamerica ? 'alerta' : 'info',
      texto: `El NIV indica modelo ${anioModelo} y el auto está capturado como ${anioCapturado}.${norteamerica ? ' Revisa cuál es el correcto.' : ' En autos europeos o asiáticos a veces no coincide.'}`,
    });
  }
  return { niv, completo: true, pais, norteamerica, digitoOk, anioModelo, avisos };
}

export const URL_REPUVE = 'https://www2.repuve.gob.mx:8443/ciudadania/';

export type ResultadoRepuve = 'sin_reporte' | 'con_reporte' | 'no_aparece';

export const TEXTO_RESULTADO: Record<ResultadoRepuve, string> = {
  sin_reporte: 'Sin reporte de robo',
  con_reporte: 'Con reporte de robo',
  no_aparece: 'No aparece en el REPUVE',
};

export interface ConsultaRepuve {
  resultado: ResultadoRepuve;
  fecha: string;
  por: string;
  porNombre: string;
  niv: string;
  nota?: string;
}
