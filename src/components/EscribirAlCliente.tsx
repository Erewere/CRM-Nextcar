import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getApiUrl } from '../lib/api';
import { X, Send, Clock, AlertCircle, FileText } from 'lucide-react';
import clsx from 'clsx';

// Escribirle a un cliente que no acaba de escribir.
//
// Hasta ahora el CRM solo sabia contestar dentro de las 24 h que da Meta. Para
// retomar a un cliente frio habia que entrar a Inventario y mandarle un auto,
// porque compartir vehiculo era lo unico que iba como plantilla — aunque lo que
// se queria fuera solo saludarlo.
//
// Esta ventana decide sola cual de los dos caminos toca, para que el vendedor no
// tenga que saberse la regla de Meta.

interface Props {
  clientId: string;
  nombre: string;
  telefono: string;
  ultimoMensajeEntrante?: string;
  onCerrar: () => void;
}

interface Plantilla { name: string; language: string; category?: string; texto: string; variables: number; }

// Meta cobra por mensaje de plantilla y no todas cuestan igual: una de
// marketing es la mas cara, una de utilidad cuesta bastante menos. Si en
// pantalla se ven iguales, el vendedor elige al azar y la agencia lo paga.
function precio(categoria?: string) {
  if (categoria === 'MARKETING') return { texto: 'Marketing · la más cara', clase: 'text-amber-600 dark:text-amber-400' };
  if (categoria === 'UTILITY') return { texto: 'Utilidad · más barata', clase: 'text-emerald-600 dark:text-emerald-400' };
  if (categoria === 'AUTHENTICATION') return { texto: 'Autenticación', clase: 'text-slate-500' };
  return null;
}

const VENTANA_MS = 24 * 60 * 60 * 1000;

export function EscribirAlCliente({ clientId, nombre, telefono, ultimoMensajeEntrante, onCerrar }: Props) {
  const { currentUser } = useAuth();
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [plantillas, setPlantillas] = useState<Plantilla[] | null>(null);
  const [errorPlantillas, setErrorPlantillas] = useState('');
  const [elegida, setElegida] = useState<Plantilla | null>(null);
  const [valores, setValores] = useState<string[]>([]);

  const horasRestantes = useMemo(() => {
    if (!ultimoMensajeEntrante) return 0;
    const queda = new Date(ultimoMensajeEntrante).getTime() + VENTANA_MS - Date.now();
    return queda > 0 ? queda / 3600000 : 0;
  }, [ultimoMensajeEntrante]);

  const ventanaAbierta = horasRestantes > 0;

  useEffect(() => {
    if (ventanaAbierta || !currentUser) return;
    let vivo = true;
    (async () => {
      try {
        const token = await currentUser.getIdToken();
        const res = await fetch(getApiUrl('/api/meta/templates'), {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!vivo) return;
        if (!res.ok) throw new Error(data.error || 'No se pudieron leer las plantillas');
        setPlantillas(data.plantillas || []);
      } catch (err: any) {
        if (vivo) setErrorPlantillas(err?.message || 'No se pudieron leer las plantillas');
      }
    })();
    return () => { vivo = false; };
  }, [ventanaAbierta, currentUser]);

  // La primera variable de casi todas las plantillas es el nombre; se rellena
  // sola para ahorrarle el tecleo al vendedor, y se puede cambiar.
  const elegirPlantilla = (p: Plantilla) => {
    setElegida(p);
    setValores(Array.from({ length: p.variables }, (_, i) => (i === 0 ? nombre : '')));
  };

  const enviarTextoLibre = async () => {
    if (!texto.trim() || !currentUser) return;
    setEnviando(true);
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch(getApiUrl('/api/meta/send-message'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ clientId, text: texto.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo enviar');
      onCerrar();
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'No se pudo enviar el mensaje');
    } finally {
      setEnviando(false);
    }
  };

  const enviarPlantilla = async () => {
    if (!elegida || !currentUser) return;
    if (valores.some(v => !v.trim())) {
      alert('Rellena todos los datos que pide la plantilla.');
      return;
    }
    setEnviando(true);
    try {
      let destino = (telefono || '').replace(/\D/g, '');
      if (destino.length === 10) destino = '52' + destino;

      const token = await currentUser.getIdToken();
      const res = await fetch(getApiUrl('/api/meta/send-template'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          to: destino,
          clientId,
          templateName: elegida.name,
          language: elegida.language,
          variables: valores.map(v => ({ type: 'text', text: v.trim() })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo enviar');
      onCerrar();
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'No se pudo enviar la plantilla');
    } finally {
      setEnviando(false);
    }
  };

  // Como le va a llegar al cliente, con los huecos ya rellenos.
  const vistaPrevia = useMemo(() => {
    if (!elegida) return '';
    return elegida.texto.replace(/\{\{\s*(\d+)\s*\}\}/g, (_m, n) => valores[Number(n) - 1] || `{{${n}}}`);
  }, [elegida, valores]);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onCerrar}>
      <div
        className="bg-white dark:bg-slate-900 rounded shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="font-extrabold text-slate-800 dark:text-slate-100">Escribirle a {nombre || 'el contacto'}</h3>
            <p className="text-xs text-slate-500">{telefono || 'Sin teléfono'} · WhatsApp</p>
          </div>
          <button onClick={onCerrar} className="p-1 text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {!telefono ? (
          <div className="p-6 text-sm text-slate-600 dark:text-slate-300 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            Este contacto no tiene teléfono, así que no hay a dónde escribirle por WhatsApp.
            Captúralo primero en su ficha.
          </div>
        ) : ventanaAbierta ? (
          <div className="p-4 space-y-3">
            <p className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Te contestó hace poco: quedan {Math.floor(horasRestantes)} horas para escribirle libremente.
            </p>
            <textarea
              autoFocus
              rows={4}
              value={texto}
              onChange={e => setTexto(e.target.value)}
              placeholder="Escribe tu mensaje..."
              className="w-full px-3 py-2 rounded border border-gray-200 dark:border-slate-700 bg-[#f4f5f5] dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <button
              onClick={enviarTextoLibre}
              disabled={!texto.trim() || enviando}
              className="w-full py-2.5 rounded bg-green-600 hover:bg-green-700 text-white font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" /> {enviando ? 'Enviando...' : 'Enviar'}
            </button>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            <div className="p-3 rounded bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                {ultimoMensajeEntrante
                  ? 'Pasaron más de 24 horas desde su último mensaje.'
                  : 'Este contacto nunca te ha escrito por WhatsApp.'}{' '}
                Meta solo permite retomarlo con una <strong>plantilla aprobada</strong>, y esas
                <strong> se cobran por mensaje</strong>. En cuanto conteste, se abre la ventana de
                24 horas y ya le escribes lo que quieras sin costo.
              </span>
            </div>

            {errorPlantillas ? (
              <p className="text-xs text-red-600">{errorPlantillas}</p>
            ) : plantillas === null ? (
              <p className="text-xs text-slate-400">Leyendo tus plantillas aprobadas...</p>
            ) : plantillas.length === 0 ? (
              <p className="text-xs text-slate-500">
                No tienes plantillas aprobadas en español. Se crean y se aprueban en el
                administrador de WhatsApp de Meta.
              </p>
            ) : !elegida ? (
              <div className="space-y-2">
                <p className="text-[11px] font-bold text-slate-500 uppercase">Elige una plantilla</p>
                {plantillas.map(p => (
                  <button
                    key={p.name}
                    onClick={() => elegirPlantilla(p)}
                    className="w-full text-left p-3 rounded border border-gray-200 dark:border-slate-700 hover:border-green-500 transition-colors"
                  >
                    <span className="flex items-center gap-1.5 font-bold text-sm text-slate-800 dark:text-slate-200">
                      <FileText className="w-3.5 h-3.5 text-slate-400" /> {p.name}
                      {precio(p.category) && (
                        <span className={clsx("text-[10px] font-bold ml-auto shrink-0", precio(p.category)!.clase)}>
                          {precio(p.category)!.texto}
                        </span>
                      )}
                    </span>
                    <span className="block text-xs text-slate-500 mt-1 line-clamp-2">{p.texto}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <button onClick={() => setElegida(null)} className="text-xs text-slate-500 hover:text-slate-700">
                  ← Elegir otra plantilla
                </button>
                {valores.map((v, i) => (
                  <div key={i}>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">
                      Dato {i + 1}{i === 0 ? ' (normalmente el nombre)' : ''}
                    </label>
                    <input
                      value={v}
                      onChange={e => setValores(prev => prev.map((x, j) => (j === i ? e.target.value : x)))}
                      className="w-full px-2.5 py-1.5 rounded border border-gray-200 dark:border-slate-700 bg-[#f4f5f5] dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                ))}
                <div>
                  <p className="text-[11px] font-bold text-slate-500 mb-1">Así le va a llegar</p>
                  <p className="p-3 rounded bg-green-600 text-white text-sm whitespace-pre-line">{vistaPrevia}</p>
                </div>
                <button
                  onClick={enviarPlantilla}
                  disabled={enviando}
                  className={clsx(
                    "w-full py-2.5 rounded font-bold text-sm flex items-center justify-center gap-2",
                    "bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
                  )}
                >
                  <Send className="w-4 h-4" /> {enviando ? 'Enviando...' : 'Enviar plantilla'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
