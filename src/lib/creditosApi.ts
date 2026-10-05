import { auth } from './firebase';
import { getApiUrl } from './api';
import { aplanar, llenarFormato, type FormatoCredito } from './creditoCampos';

/** Llamadas al servidor para las solicitudes de crédito (con la sesión del usuario). */
async function api(ruta: string, init: RequestInit = {}) {
  const token = await auth.currentUser?.getIdToken();
  const r = await fetch(getApiUrl(ruta), { ...init, headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` } });
  return r;
}

async function json(r: Response) {
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.error || `Error ${r.status}`);
  return d;
}

export const creditosApi = {
  lista: async (clientId?: string) => (await json(await api(`/api/creditos${clientId ? `?clientId=${encodeURIComponent(clientId)}` : ''}`))).solicitudes as any[],
  crear: async (cuerpo: any) => (await json(await api('/api/creditos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) }))).solicitud,
  ver: async (id: string) => (await json(await api(`/api/creditos/${id}`))).solicitud,
  cambiar: async (id: string, cambios: any) => (await json(await api(`/api/creditos/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cambios) }))).solicitud,
  liga: async (id: string) => json(await api(`/api/creditos/${id}/liga`, { method: 'POST' })) as Promise<{ url: string; vence: string }>,
  quitarLiga: async (id: string) => json(await api(`/api/creditos/${id}/liga`, { method: 'DELETE' })),
  subir: async (id: string, archivo: File | Blob, tipo: string, nombre: string, banco?: string) => (await json(await api(`/api/creditos/${id}/documentos`, {
    method: 'POST', body: archivo,
    headers: { 'Content-Type': archivo.type || 'application/octet-stream', 'X-Tipo': tipo, 'X-Nombre': encodeURIComponent(nombre), ...(banco ? { 'X-Banco': banco } : {}) },
  }))).documento,
  archivo: async (id: string, docId: string) => { const r = await api(`/api/creditos/${id}/documentos/${docId}`); if (!r.ok) throw new Error('No se pudo abrir el archivo.'); return r.blob(); },
  quitarArchivo: async (id: string, docId: string) => json(await api(`/api/creditos/${id}/documentos/${docId}`, { method: 'DELETE' })),
  formatos: async () => (await json(await api('/api/creditos/formatos'))).formatos as FormatoCredito[],
  pdfFormato: async (fid: string) => { const r = await api(`/api/creditos/formatos/${fid}/pdf`); if (!r.ok) throw new Error('No se pudo bajar el formato del banco.'); return r.arrayBuffer(); },
  subirFormato: async (archivo: File, nombre: string, reemplaza?: string, global?: boolean) => json(await api('/api/creditos/formatos', {
    method: 'POST', body: archivo,
    headers: { 'Content-Type': 'application/pdf', 'X-Nombre': encodeURIComponent(nombre), ...(reemplaza ? { 'X-Reemplaza': reemplaza } : {}), ...(global ? { 'X-Global': '1' } : {}) },
  })) as Promise<{ formato: FormatoCredito; conservados: number; sinAcomodar: number }>,
  guardarFormato: async (fid: string, cambios: any) => json(await api(`/api/creditos/formatos/${fid}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cambios) })),
};

/** Lo que usa la liga del cliente (sin sesión: el token es la llave). */
export const ligaApi = {
  ver: async (token: string) => json(await fetch(getApiUrl(`/api/solicitud/${token}`))),
  guardar: async (token: string, datos: any) => json(await fetch(getApiUrl(`/api/solicitud/${token}`), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ datos }) })),
  subir: async (token: string, archivo: File | Blob, tipo: string, nombre: string, banco?: string) => (await json(await fetch(getApiUrl(`/api/solicitud/${token}/documentos`), {
    method: 'POST', body: archivo,
    headers: { 'Content-Type': archivo.type || 'application/octet-stream', 'X-Tipo': tipo, 'X-Nombre': encodeURIComponent(nombre), ...(banco ? { 'X-Banco': banco } : {}) },
  }))).documento,
  quitar: async (token: string, docId: string) => json(await fetch(getApiUrl(`/api/solicitud/${token}/documentos/${docId}`), { method: 'DELETE' })),
  pdfFormato: async (token: string, fid: string) => { const r = await fetch(getApiUrl(`/api/solicitud/${token}/formatos/${fid}/pdf`)); if (!r.ok) throw new Error('No se pudo bajar la solicitud del banco.'); return r.arrayBuffer(); },
  enviar: async (token: string) => json(await fetch(getApiUrl(`/api/solicitud/${token}/enviar`), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acepta: true }) })),
};

/** La solicitud del banco ya llenada, lista para firmar. */
export async function solicitudLlenada(bytesFormato: ArrayBuffer, formato: Pick<FormatoCredito, 'mapa' | 'mayusculas'>, datos: any, extra: { operacion?: any; agencia?: any; auto?: string }) {
  const plano = aplanar(datos, extra);
  const bytes = await llenarFormato(bytesFormato, formato, plano);
  return new Blob([bytes], { type: 'application/pdf' });
}

/** Descargar en la computadora; compartir en el teléfono. */
export async function descargarOCompartirArchivos(archivos: File[], titulo: string, texto?: string) {
  const enTelefono = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));
  if (enTelefono && navigator.share && navigator.canShare?.({ files: archivos })) {
    try { await navigator.share({ title: titulo, text: texto, files: archivos }); return 'compartido'; } catch { /* lo cerraron: se descarga */ }
  }
  for (const a of archivos) {
    const url = URL.createObjectURL(a);
    const el = document.createElement('a');
    el.href = url; el.download = a.name;
    document.body.appendChild(el); el.click(); document.body.removeChild(el);
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
  return 'descargado';
}
