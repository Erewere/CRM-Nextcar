/** Documentos que el cliente debe entregar antes de mandar la solicitud a los bancos. */
export const DOCS_REQUERIDOS = ['ine', 'domicilio', 'ingresos', 'constancia'] as const;

export const NOMBRE_DOC: Record<string, string> = {
  ine: 'INE',
  domicilio: 'comprobante de domicilio',
  ingresos: 'comprobante de ingresos',
  constancia: 'constancia de situación fiscal',
};

/** Los que faltan, en palabras. `tipos` es la lista de tipos ya subidos. */
export function documentosQueFaltan(tipos: string[] = []): string[] {
  return DOCS_REQUERIDOS.filter((t) => !tipos.includes(t)).map((t) => NOMBRE_DOC[t]);
}
