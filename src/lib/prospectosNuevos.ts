import { checkIsLost, checkIsWon } from './clientUtils';
import { etiquetaDeFuente, fuenteDelContacto } from './fuentes';

/**
 * Prospectos nuevos y cuánto llevan esperando.
 *
 * Un prospecto «nuevo» es alguien que LLEGÓ solo (WhatsApp, Messenger, formulario de la página,
 * Marketplace…) en los últimos 14 días y todavía no está ganado ni perdido. Se dice que está
 * «sin atender» mientras nadie de la agencia haya hecho nada con él DESPUÉS de que llegó:
 *  - contestarle por el chat,
 *  - escribir una nota (o cotizarle, o cambiar el estado de un auto),
 *  - completar una tarea suya,
 *  - moverlo de la primera etapa del embudo,
 *  - o apretar «Ya lo atendí».
 * Un contacto dado de alta a mano NO cuenta: quien lo captura ya habló con él.
 * Si el mismo cliente vuelve a llenar un formulario, la espera se cuenta desde esa nueva llegada.
 *
 * La espera se mide solo dentro del horario de la agencia (por omisión 8:00 a 21:00): un mensaje
 * que llega a las 11 de la noche no debe amanecer «tarde».
 */

const MIN = 60_000;
const DIA = 86_400_000;
export const VENTANA_DIAS = 14;

export type NivelEspera = 'nuevo' | 'ya' | 'tarde' | 'critico';

export interface ProspectoNuevo {
  id: string;
  cliente: any;
  nombre: string;
  telefono: string;
  origen: string;
  tipo: string;
  auto: string;
  llegada: string;
  /** Minutos de espera dentro del horario. Si ya lo atendieron: lo que tardaron en el primer contacto. */
  minutos: number;
  atendido: boolean;
  primerContacto: string | null;
  nivel: NivelEspera;
  sellerId: string;
  sinAsignar: boolean;
  preferido: boolean;
  ultimoTexto: string;
}

const ms = (v: any): number => {
  if (!v) return 0;
  if (typeof v === 'string') { const t = Date.parse(v); return Number.isFinite(t) ? t : 0; }
  if (typeof v.toDate === 'function') return v.toDate().getTime();
  const s = v.seconds ?? v._seconds;
  return typeof s === 'number' ? s * 1000 : 0;
};

const sinAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** ¿Llegó solo? Lo capturado a mano, importado o creado por el asistente no cuenta. */
export function esEntrante(c: { origin?: unknown }): boolean {
  const o = sinAcentos(String(c.origin || ''));
  if (!o) return false;
  return !(o.startsWith('manual') || o.includes('import') || o.includes('excel') || o.includes('google') || o === 'ia' || o.includes('asistente') || o.includes('mcp'));
}

function parseHora(h: string | undefined, porOmision: number): number {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(h || ''));
  return m ? Number(m[1]) * 60 + Number(m[2]) : porOmision;
}

/** Minutos entre dos momentos que caen dentro del horario de la agencia (hora local de quien mira). */
export function minutosEnHorario(desde: number, hasta: number, horario?: { start?: string; end?: string }): number {
  if (hasta <= desde) return 0;
  const ini = parseHora(horario?.start, 8 * 60);
  const fin = parseHora(horario?.end, 21 * 60);
  if (fin <= ini) return Math.round((hasta - desde) / MIN); // horario raro: se cuenta todo
  let total = 0;
  const dia = new Date(desde); dia.setHours(0, 0, 0, 0);
  for (let t = dia.getTime(), guarda = 0; t < hasta && guarda < 40; t += DIA, guarda++) {
    const d = new Date(t);
    const abre = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, ini).getTime();
    const cierra = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, fin).getTime();
    const a = Math.max(abre, desde), b = Math.min(cierra, hasta);
    if (b > a) total += b - a;
  }
  return Math.round(total / MIN);
}

/** «WhatsApp», «Página web»… Un origen que es una dirección (el formulario de una página) se dice «Página web». */
export function etiquetaDelOrigen(c: any): string {
  const f = etiquetaDeFuente(fuenteDelContacto(c));
  if (f !== 'Sin dato') return f;
  return String(c.origin || '').includes('.') ? 'Página web' : String(c.origin || 'Sin dato');
}

export function nivelDeEspera(minutos: number): NivelEspera {
  return minutos <= 15 ? 'nuevo' : minutos <= 60 ? 'ya' : minutos <= 240 ? 'tarde' : 'critico';
}

export function prospectosNuevos(p: {
  clientes: any[]; notas: any[]; tareas: any[]; etapas: { id: string; title?: string }[];
  ahora?: number; horario?: { start?: string; end?: string };
}): ProspectoNuevo[] {
  const ahora = p.ahora ?? Date.now();
  const desde = ahora - VENTANA_DIAS * DIA;
  const primera = p.etapas[0]?.id;

  const notasDe = new Map<string, any[]>();
  (p.notas || []).forEach((n) => { if (n?.clientId) notasDe.set(n.clientId, [...(notasDe.get(n.clientId) || []), n]); });
  const tareasDe = new Map<string, any[]>();
  (p.tareas || []).forEach((t) => { if (t?.clientId) tareasDe.set(t.clientId, [...(tareasDe.get(t.clientId) || []), t]); });

  const salida: ProspectoNuevo[] = [];
  for (const c of p.clientes) {
    if (!c || c.isDeleted || !esEntrante(c)) continue;
    if (checkIsWon(c.status, p.etapas) || checkIsLost(c.status, p.etapas)) continue;
    const notas = notasDe.get(c.id) || [];
    const formularios = notas.filter((n) => n.type === 'formulario-web');
    const llegada = Math.max(ms(c.createdAt), ...formularios.map((n) => ms(n.createdAt)));
    if (!llegada || llegada < desde) continue;

    // Cualquier cosa hecha por la agencia después de que llegó (con un minuto de margen: lo que el sistema anota al crear).
    const toques: number[] = [];
    const despues = (t: number) => t > llegada + MIN;
    if (despues(ms(c.primerContactoAt))) toques.push(ms(c.primerContactoAt));
    if (despues(ms(c.chatUltimoSalienteAt))) toques.push(ms(c.chatUltimoSalienteAt));
    notas.forEach((n) => { if (n.type !== 'formulario-web' && despues(ms(n.createdAt))) toques.push(ms(n.createdAt)); });
    (tareasDe.get(c.id) || []).forEach((t) => {
      const fin = ms(t.completedAt) || (t.completed ? ms(t.updatedAt) : 0);
      if (t.completed && despues(fin)) toques.push(fin);
    });
    const movido = !!primera && c.status && c.status !== primera;
    if (movido) toques.push(ms(c.updatedAt) > llegada ? ms(c.updatedAt) : llegada + MIN + 1);

    const atendido = toques.length > 0;
    const primerToque = atendido ? Math.min(...toques) : 0;
    const minutos = minutosEnHorario(llegada, atendido ? primerToque : ahora, p.horario);
    const ultimaForma = [...formularios].sort((a, b) => ms(b.createdAt) - ms(a.createdAt))[0];
    const lineaAuto = ultimaForma ? String(ultimaForma.content || '').split('\n').find((l) => /^auto:/i.test(l.trim())) : '';

    salida.push({
      id: c.id, cliente: c,
      nombre: String(c.name || 'Sin nombre'), telefono: String(c.phone || ''),
      origen: etiquetaDelOrigen(c),
      tipo: String(ultimaForma?.tipoSolicitud || ''),
      auto: lineaAuto ? lineaAuto.replace(/^auto:\s*/i, '').trim() : String(c.vehicle || ''),
      llegada: new Date(llegada).toISOString(), minutos, atendido,
      primerContacto: atendido ? new Date(primerToque).toISOString() : null,
      nivel: nivelDeEspera(minutos),
      sellerId: String(c.sellerId || ''), sinAsignar: !c.sellerId, preferido: !!c.preferido,
      ultimoTexto: String(c.chatUltimoTexto || ''),
    });
  }
  return salida.sort((a, b) => (a.atendido === b.atendido ? (a.atendido ? b.llegada.localeCompare(a.llegada) : b.minutos - a.minutos) : a.atendido ? 1 : -1));
}

/** «hace 25 min», «hace 3 h», «hace 2 días»: para lo que lleva esperando. */
export function textoDeEspera(minutos: number): string {
  if (minutos < 1) return 'recién llegó';
  if (minutos < 60) return `${minutos} min`;
  const h = Math.floor(minutos / 60);
  if (h < 24) return `${h} h${minutos % 60 ? ` ${minutos % 60} min` : ''}`;
  const d = Math.floor(h / 24);
  return `${d} día${d === 1 ? '' : 's'}`;
}

export function resumenDeRespuesta(lista: ProspectoNuevo[]) {
  const sin = lista.filter((x) => !x.atendido);
  const atendidos = lista.filter((x) => x.atendido).map((x) => x.minutos).sort((a, b) => a - b);
  const mediana = atendidos.length ? atendidos[Math.floor(atendidos.length / 2)] : null;
  return {
    sinAtender: sin.length,
    sinAsignar: sin.filter((x) => x.sinAsignar).length,
    masViejoMin: sin.length ? Math.max(...sin.map((x) => x.minutos)) : 0,
    criticos: sin.filter((x) => x.nivel === 'critico' || x.nivel === 'tarde').length,
    atendidos: atendidos.length,
    respuestaTipicaMin: mediana,
  };
}
