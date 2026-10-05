import React, { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { AlertTriangle, Clock, Globe } from 'lucide-react';
import { auth } from '../../lib/firebase';
import { getApiUrl } from '../../lib/api';

/**
 * La página solo publica autos de agencias conectadas a su cuenta del CRM y
 * aprobadas por Nextcar. Sin esto, una agencia marcaba «Publicar» y sus autos
 * nunca salían sin que nadie supiera por qué.
 */

type Estado = 'aprobado' | 'pendiente' | 'sin-ligar' | 'desconocido';

async function pedir(ruta: string) {
  const token = await auth.currentUser?.getIdToken();
  const r = await fetch(getApiUrl(ruta), { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}

// Una sola consulta por sesión de la pantalla (la respuesta casi no cambia).
let enCurso: Promise<{ estado: Estado; esAdmin: boolean }> | null = null;
function miEstado() {
  if (!enCurso) enCurso = pedir('/api/pagina/mi-estado').catch(() => { enCurso = null; return { estado: 'desconocido' as Estado, esAdmin: false }; });
  return enCurso;
}

/** Junto a «Publicar en nextcar.erewere.com». Solo aparece si hay algo que avisar. */
export function AvisoPaginaWeb({ marcado }: { marcado: boolean }) {
  const [e, setE] = useState<{ estado: Estado; esAdmin: boolean } | null>(null);
  useEffect(() => { let vivo = true; miEstado().then((x) => vivo && setE(x)); return () => { vivo = false; }; }, []);
  if (!e || e.estado === 'aprobado' || e.estado === 'desconocido') return null;

  if (e.estado === 'pendiente') {
    return (
      <p className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-3 py-2 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
        <Clock className="w-4 h-4 shrink-0 mt-px" />
        <span>Tu agencia ya está conectada a la página, pero <b>falta que Nextcar la apruebe</b>. {marcado ? 'Este auto saldrá' : 'Los autos que marques saldrán'} en cuanto se apruebe, sin que hagas nada más.</span>
      </p>
    );
  }
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-3 py-2 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
      <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
      <div className="flex flex-col gap-1.5">
        <span>
          <b>Tu agencia todavía no está conectada a nextcar.erewere.com</b>: {marcado ? 'este auto no va a aparecer' : 'los autos que marques no van a aparecer'} hasta que se conecte y Nextcar la apruebe.
        </span>
        {e.esAdmin ? (
          <Link to="/conectar-pagina" className="self-start inline-flex items-center gap-1.5 rounded-md bg-amber-600 hover:bg-amber-700 text-white font-bold px-3 py-1.5">
            <Globe className="w-3.5 h-3.5" /> Conectar mi agencia a la página
          </Link>
        ) : (
          <span>Pídele al administrador de tu agencia que la conecte desde aquí mismo: es un clic.</span>
        )}
      </div>
    </div>
  );
}

/** Para el administrador de la plataforma: agencias con autos marcados que no salen. */
export function AvisoSinPublicarMaster() {
  const [lista, setLista] = useState<{ agencyId: string; nombre: string; autos: number; estado: Estado }[]>([]);
  useEffect(() => { pedir('/api/pagina/sin-publicar').then((d) => setLista(d.agencias || [])).catch(() => {}); }, []);
  if (!lista.length) return null;
  const total = lista.reduce((n, a) => n + a.autos, 0);
  return (
    <div className="mb-5 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-4 text-amber-900 dark:text-amber-200">
      <p className="font-bold flex items-center gap-2"><Globe className="w-4 h-4" /> {total} {total === 1 ? 'auto marcado para la página no sale' : 'autos marcados para la página no salen'}</p>
      <ul className="mt-2 text-sm flex flex-col gap-1">
        {lista.map((a) => (
          <li key={a.agencyId}>
            <b>{a.nombre}</b> · {a.autos} {a.autos === 1 ? 'auto' : 'autos'} · {a.estado === 'pendiente'
              ? <>conectada, <b>falta que la apruebes</b> en el panel de la página (Agencias)</>
              : <>no ha conectado su cuenta: su administrador debe usar «Conectar mi agencia a la página» en el CRM</>}
          </li>
        ))}
      </ul>
    </div>
  );
}
