/**
 * Cantidades en letra para contratos: 389000 → «TRESCIENTOS OCHENTA Y NUEVE MIL
 * PESOS 00/100 M.N.».
 */

const UNIDADES = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE',
  'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE',
  'VEINTE', 'VEINTIUNO', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE'];
const DECENAS = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
const CENTENAS = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

function hasta999(n: number): string {
  if (n === 0) return '';
  if (n === 100) return 'CIEN';
  const c = Math.floor(n / 100), r = n % 100;
  let txt = CENTENAS[c];
  if (r) {
    const dec = r < 30 ? UNIDADES[r] : `${DECENAS[Math.floor(r / 10)]}${r % 10 ? ` Y ${UNIDADES[r % 10]}` : ''}`;
    txt = txt ? `${txt} ${dec}` : dec;
  }
  return txt;
}

/** Número entero a letra (hasta cientos de millones). «UNO» se vuelve «UN» antes de MIL/MILLONES/PESOS. */
export function enteroALetras(n: number): string {
  n = Math.floor(Math.abs(n));
  if (n === 0) return 'CERO';
  const millones = Math.floor(n / 1_000_000), miles = Math.floor((n % 1_000_000) / 1000), resto = n % 1000;
  const partes: string[] = [];
  if (millones) partes.push(millones === 1 ? 'UN MILLÓN' : `${hasta999(millones).replace(/UNO$/, 'UN')} MILLONES`);
  if (miles) partes.push(miles === 1 ? 'MIL' : `${hasta999(miles).replace(/UNO$/, 'UN')} MIL`);
  if (resto) partes.push(hasta999(resto));
  return partes.join(' ').replace(/VEINTIUN\b(?!O)/g, 'VEINTIÚN');
}

export function pesosALetras(cantidad: number): string {
  const entero = Math.floor(Math.abs(cantidad || 0));
  const centavos = Math.round((Math.abs(cantidad || 0) - entero) * 100);
  let letras = enteroALetras(entero).replace(/VEINTIUNO$/, 'VEINTIÚN').replace(/UNO$/, 'UN');
  // «UN MILLÓN DE PESOS», «DOS MILLONES DE PESOS»
  if (/MILL(ÓN|ONES)$/.test(letras)) letras += ' DE';
  return `${letras} ${entero === 1 ? 'PESO' : 'PESOS'} ${String(centavos).padStart(2, '0')}/100 M.N.`;
}
