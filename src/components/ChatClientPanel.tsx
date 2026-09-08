import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { getApiUrl } from '../lib/api';
import {
  User, Phone, Mail, MapPin, Car, Tag, StickyNote, Megaphone,
  Check, Search, X, Briefcase, History, MessageSquarePlus, Target,
} from 'lucide-react';
import clsx from 'clsx';
import { EscribirAlCliente } from './EscribirAlCliente';
import { ResumenBusquedaAuto } from './ResumenBusquedaAuto';

// El panel de la derecha del chat. Nace de una necesidad concreta: en Messenger
// Meta no da telefono ni nombre real, asi que el vendedor tiene que capturarlos
// mientras conversa. Salir a la ficha del contacto y volver perdia el hilo de la
// charla; aqui se escribe sin soltar la conversacion.

interface Props {
  clientId: string;
  canal: 'whatsapp' | 'messenger';
  onCerrar?: () => void;
}

interface Etiqueta { id: string; name: string; }
interface AutoLite { id: string; make: string; model: string; year: number; price: number; status: string; }

const CAMPOS = [
  { clave: 'name', etiqueta: 'Nombre completo', icono: User, tipo: 'text', placeholder: '¿Cómo se llama?' },
  { clave: 'phone', etiqueta: 'Teléfono', icono: Phone, tipo: 'tel', placeholder: '10 dígitos' },
  { clave: 'email', etiqueta: 'Correo', icono: Mail, tipo: 'email', placeholder: 'correo@ejemplo.com' },
  { clave: 'address', etiqueta: 'Dirección', icono: MapPin, tipo: 'text', placeholder: 'Ciudad o dirección' },
] as const;

export function ChatClientPanel({ clientId, canal, onCerrar }: Props) {
  const { userData, currentUser } = useAuth();
  const [cliente, setCliente] = useState<any>(null);
  const [borrador, setBorrador] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);

  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([]);
  const [autos, setAutos] = useState<AutoLite[]>([]);
  const [buscaAuto, setBuscaAuto] = useState('');
  const [abriendoAutos, setAbriendoAutos] = useState(false);

  const [notas, setNotas] = useState<any[]>([]);
  const [notaNueva, setNotaNueva] = useState('');
  const [tratos, setTratos] = useState<any[]>([]);
  const [creandoTrato, setCreandoTrato] = useState(false);
  const [escribiendo, setEscribiendo] = useState(false);

  useEffect(() => {
    if (!clientId || !userData?.agencyId) return;
    const q = query(collection(db, 'clients'), where('agencyId', '==', userData.agencyId));
    const unsub = onSnapshot(q, (snap) => {
      const d = snap.docs.find(x => x.id === clientId);
      if (!d) return;
      const data = { id: d.id, ...(d.data() as any) };
      setCliente(data);
      // El borrador solo se recarga si el vendedor no esta escribiendo, para que
      // un mensaje entrante no le borre lo que lleva tecleado.
      setBorrador(prev => Object.keys(prev).length ? prev : {
        name: data.name || '', phone: data.phone || '',
        email: data.email || '', address: data.address || '',
      });
    });
    return () => unsub();
  }, [clientId, userData?.agencyId]);

  // Al cambiar de conversacion, el borrador de la anterior no debe viajar.
  useEffect(() => { setBorrador({}); setGuardado(false); }, [clientId]);

  useEffect(() => {
    if (!userData?.agencyId) return;
    getDocs(query(collection(db, 'agency_tags'), where('agencyId', '==', userData.agencyId)))
      .then(s => setEtiquetas(s.docs.map(d => ({ id: d.id, name: d.data().name }))))
      .catch(err => console.error('Error cargando etiquetas:', err));
  }, [userData?.agencyId]);

  useEffect(() => {
    if (!userData?.agencyId || !abriendoAutos || autos.length) return;
    getDocs(query(collection(db, 'vehicles'), where('agencyId', '==', userData.agencyId)))
      .then(s => setAutos(s.docs
        .map(d => ({ id: d.id, ...(d.data() as any) }))
        .filter((v: any) => v.status !== 'sold' && v.status !== 'vendido')))
      .catch(err => console.error('Error cargando inventario:', err));
  }, [userData?.agencyId, abriendoAutos, autos.length]);

  // Las dos consultas llevan agencyId ademas del contacto: las reglas rechazan
  // una consulta entera si no puede demostrar de antemano que todo lo que va a
  // devolver es de mi agencia. Sin ese filtro, la lista sale vacia sin error
  // visible.
  useEffect(() => {
    if (!clientId || !userData?.agencyId) return;
    const unsub = onSnapshot(
      query(collection(db, 'notes'),
        where('agencyId', '==', userData.agencyId),
        where('clientId', '==', clientId)),
      (snap) => setNotas(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))),
      (err) => console.error('Error cargando notas:', err));
    return () => unsub();
  }, [clientId, userData?.agencyId]);

  useEffect(() => {
    if (!clientId || !userData?.agencyId) return;
    const unsub = onSnapshot(
      query(collection(db, 'deals'),
        where('agencyId', '==', userData.agencyId),
        where('clientId', '==', clientId)),
      (snap) => setTratos(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })).filter(t => !t.isDeleted)),
      (err) => console.error('Error cargando tratos:', err));
    return () => unsub();
  }, [clientId, userData?.agencyId]);

  const sucio = useMemo(() => {
    if (!cliente) return false;
    return CAMPOS.some(c => (borrador[c.clave] ?? '') !== (cliente[c.clave] || ''));
  }, [borrador, cliente]);

  const guardarDatos = async () => {
    if (!cliente || !sucio) return;
    setGuardando(true);
    try {
      const cambios: any = { updatedAt: new Date().toISOString() };
      CAMPOS.forEach(c => { cambios[c.clave] = (borrador[c.clave] ?? '').trim(); });
      await updateDoc(doc(db, 'clients', cliente.id), cambios);
      setGuardado(true);
      setTimeout(() => setGuardado(false), 2500);
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'No se pudieron guardar los datos');
    } finally {
      setGuardando(false);
    }
  };

  const alternarEtiqueta = async (nombre: string) => {
    if (!cliente) return;
    const actuales: string[] = Array.isArray(cliente.tags) ? cliente.tags : [];
    const nuevas = actuales.includes(nombre)
      ? actuales.filter(t => t !== nombre)
      : [...actuales, nombre];
    try {
      await updateDoc(doc(db, 'clients', cliente.id), { tags: nuevas, updatedAt: new Date().toISOString() });
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'No se pudo cambiar la etiqueta');
    }
  };

  const elegirAuto = async (v: AutoLite | null) => {
    if (!cliente) return;
    try {
      await updateDoc(doc(db, 'clients', cliente.id), {
        vehicle: v ? `${v.make} ${v.model} ${v.year}` : '',
        vehicleId: v ? v.id : '',
        updatedAt: new Date().toISOString(),
      });
      setAbriendoAutos(false);
      setBuscaAuto('');
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'No se pudo asignar el vehículo');
    }
  };

  const agregarNota = async () => {
    if (!notaNueva.trim() || !cliente) return;
    try {
      await addDoc(collection(db, 'notes'), {
        agencyId: cliente.agencyId,
        clientId: cliente.id,
        content: notaNueva.trim(),
        type: 'manual',
        createdAt: new Date().toISOString(),
        ...(userData?.id ? { createdBy: userData.id } : {}),
        ...(userData?.name ? { createdByName: userData.name } : {}),
      });
      setNotaNueva('');
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'No se pudo guardar la nota');
    }
  };

  const convertirEnTrato = async () => {
    if (!cliente || !currentUser) return;
    setCreandoTrato(true);
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch(getApiUrl('/api/clients/crear-trato'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ clientId: cliente.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo crear el trato');
      if (data.yaExistia) alert('Este contacto ya tiene un trato abierto en el embudo.');
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'No se pudo crear el trato');
    } finally {
      setCreandoTrato(false);
    }
  };

  const autosFiltrados = useMemo(() => {
    const t = buscaAuto.trim().toLowerCase();
    const lista = t
      ? autos.filter(v => `${v.make} ${v.model} ${v.year}`.toLowerCase().includes(t))
      : autos;
    return lista.slice(0, 40);
  }, [autos, buscaAuto]);

  const tratosAbiertos = tratos.filter(t => t.status !== 'won' && t.status !== 'lost');
  const referral = cliente?.messengerReferral;
  const faltaTelefono = canal === 'messenger' && !(cliente?.phone || '').trim();

  if (!cliente) {
    return <div className="p-6 text-sm text-slate-400">Cargando ficha...</div>;
  }

  return (
    <div className="h-full overflow-y-auto bg-white dark:bg-slate-900 text-sm">
      <div className="p-4 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between">
        <h3 className="font-extrabold text-slate-800 dark:text-slate-100">Ficha del contacto</h3>
        {onCerrar && (
          <button onClick={onCerrar} className="p-1 text-slate-400 hover:text-slate-700 xl:hidden">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* En Messenger el contacto llega sin telefono: sin el no hay a quien
          llamar ni por donde seguir si se cierra la ventana de Meta. */}
      {faltaTelefono && (
        <div className="m-4 p-3 rounded bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 text-xs">
          Este contacto llegó por Messenger, así que <strong>no trae teléfono</strong>.
          Pídeselo en la conversación y captúralo aquí: es lo que permite seguirlo
          después.
        </div>
      )}

      <div className="p-4 space-y-3 border-b border-gray-200 dark:border-slate-800">
        {CAMPOS.map(campo => {
          const Icono = campo.icono;
          return (
            <div key={campo.clave}>
              <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                <Icono className="w-3 h-3" /> {campo.etiqueta}
              </label>
              <input
                type={campo.tipo}
                value={borrador[campo.clave] ?? ''}
                onChange={e => setBorrador(p => ({ ...p, [campo.clave]: e.target.value }))}
                placeholder={campo.placeholder}
                className="w-full px-2.5 py-1.5 rounded border border-gray-200 dark:border-slate-700 bg-[#f4f5f5] dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
              />
            </div>
          );
        })}
        {(sucio || guardado) && (
          <button
            onClick={guardarDatos}
            disabled={guardando || !sucio}
            className={clsx(
              "w-full py-2 rounded font-bold text-sm transition-colors flex items-center justify-center gap-2",
              guardado && !sucio
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                : "bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
            )}
          >
            {guardado && !sucio
              ? <><Check className="w-4 h-4" /> Guardado</>
              : guardando ? 'Guardando...' : 'Guardar datos'}
          </button>
        )}
      </div>

      {/* Escribirle por WhatsApp aunque no haya escrito el */}
      {(cliente.phone || '').trim() && (
        <div className="p-4 border-b border-gray-200 dark:border-slate-800">
          <button
            onClick={() => setEscribiendo(true)}
            className="w-full py-2 rounded border border-green-600 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/30 font-bold text-sm flex items-center justify-center gap-2"
          >
            <MessageSquarePlus className="w-4 h-4" /> Escribirle por WhatsApp
          </button>
        </div>
      )}

      {escribiendo && (
        <EscribirAlCliente
          clientId={cliente.id}
          nombre={cliente.name || ''}
          telefono={cliente.phone || ''}
          ultimoMensajeEntrante={cliente.lastWhatsappInboundAt}
          onCerrar={() => setEscribiendo(false)}
        />
      )}

      {/* Lo que busca, para tenerlo a la vista mientras se conversa: es lo que
          permite ofrecerle algo sin salir a consultar su ficha. */}
      {cliente.wantedVehicle && (
        <div className="p-4 border-b border-gray-200 dark:border-slate-800">
          <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-2">
            <Target className="w-3 h-3" /> Lo que busca
          </label>
          <ResumenBusquedaAuto buscado={cliente.wantedVehicle} compacto />
        </div>
      )}

      {/* Vehiculo de interes */}
      <div className="p-4 border-b border-gray-200 dark:border-slate-800">
        <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-2">
          <Car className="w-3 h-3" /> Vehículo de interés
        </label>
        {cliente.vehicle ? (
          <div className="flex items-center gap-2">
            <span className="flex-1 px-2.5 py-1.5 rounded bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300 font-semibold text-xs">
              {cliente.vehicle}
            </span>
            <button onClick={() => elegirAuto(null)} className="p-1.5 text-slate-400 hover:text-red-600" title="Quitar">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : !abriendoAutos ? (
          <button
            onClick={() => setAbriendoAutos(true)}
            className="w-full py-2 rounded border border-dashed border-gray-300 dark:border-slate-700 text-slate-500 hover:border-green-500 hover:text-green-600 text-xs font-semibold"
          >
            Asignar un auto del inventario
          </button>
        ) : (
          <div>
            <div className="relative mb-2">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                autoFocus
                value={buscaAuto}
                onChange={e => setBuscaAuto(e.target.value)}
                placeholder="Buscar por marca o modelo..."
                className="w-full pl-8 pr-2 py-1.5 rounded border border-gray-200 dark:border-slate-700 bg-[#f4f5f5] dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div className="max-h-52 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 rounded border border-gray-200 dark:border-slate-700">
              {autosFiltrados.length === 0 ? (
                <p className="p-3 text-xs text-slate-400 text-center">Sin autos disponibles.</p>
              ) : autosFiltrados.map(v => (
                <button
                  key={v.id}
                  onClick={() => elegirAuto(v)}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs"
                >
                  <span className="font-bold text-slate-700 dark:text-slate-200">{v.make} {v.model} {v.year}</span>
                  {v.price ? <span className="text-slate-400 ml-1.5">${v.price.toLocaleString('es-MX')}</span> : null}
                </button>
              ))}
            </div>
            <button onClick={() => setAbriendoAutos(false)} className="mt-2 text-xs text-slate-500 hover:text-slate-700">
              Cancelar
            </button>
          </div>
        )}
      </div>

      {/* Etiquetas del equipo */}
      <div className="p-4 border-b border-gray-200 dark:border-slate-800">
        <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-2">
          <Tag className="w-3 h-3" /> Etiquetas
        </label>
        {etiquetas.length === 0 ? (
          <p className="text-xs text-slate-400">Sin etiquetas configuradas en la agencia.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {etiquetas.map(et => {
              const puesta = Array.isArray(cliente.tags) && cliente.tags.includes(et.name);
              return (
                <button
                  key={et.id}
                  onClick={() => alternarEtiqueta(et.name)}
                  className={clsx(
                    "px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors",
                    puesta
                      ? "bg-green-600 text-white border-green-600"
                      : "bg-transparent text-slate-500 border-gray-200 dark:border-slate-700 hover:border-green-500"
                  )}
                >
                  {et.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Convertir en trato */}
      <div className="p-4 border-b border-gray-200 dark:border-slate-800">
        <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-2">
          <Briefcase className="w-3 h-3" /> Embudo
        </label>
        {tratosAbiertos.length > 0 ? (
          <p className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5" /> Ya está en el embudo ({tratosAbiertos.length} trato{tratosAbiertos.length > 1 ? 's' : ''} abierto{tratosAbiertos.length > 1 ? 's' : ''}).
          </p>
        ) : (
          <>
            <button
              onClick={convertirEnTrato}
              disabled={creandoTrato}
              className="w-full py-2 rounded bg-slate-800 hover:bg-slate-900 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-white text-white font-bold text-sm disabled:opacity-50"
            >
              {creandoTrato ? 'Creando...' : 'Convertir en trato'}
            </button>
            <p className="text-[11px] text-slate-400 mt-1.5">
              Entra a la primera etapa del embudo con el vehículo y el vendedor que tenga puestos.
            </p>
          </>
        )}
        {tratos.length > tratosAbiertos.length && (
          <p className="text-[11px] text-slate-500 mt-2 flex items-center gap-1.5">
            <History className="w-3 h-3" />
            {tratos.length - tratosAbiertos.length} trato(s) cerrado(s) antes — no es un contacto nuevo.
          </p>
        )}
      </div>

      {/* De donde llego */}
      {referral && (
        <div className="p-4 border-b border-gray-200 dark:border-slate-800">
          <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-2">
            <Megaphone className="w-3 h-3" /> De dónde llegó
          </label>
          <div className="text-xs text-slate-600 dark:text-slate-300 space-y-0.5">
            {referral.source && <p>Origen: <strong>{referral.source}</strong></p>}
            {referral.adId && <p>Anuncio: <strong>{referral.adId}</strong></p>}
            {referral.ref && <p>Etiqueta: <strong>{referral.ref}</strong></p>}
          </div>
        </div>
      )}

      {/* Notas */}
      <div className="p-4">
        <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-2">
          <StickyNote className="w-3 h-3" /> Notas
        </label>
        <div className="flex gap-2 mb-3">
          <input
            value={notaNueva}
            onChange={e => setNotaNueva(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); agregarNota(); } }}
            placeholder="Escribe una nota..."
            className="flex-1 px-2.5 py-1.5 rounded border border-gray-200 dark:border-slate-700 bg-[#f4f5f5] dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <button
            onClick={agregarNota}
            disabled={!notaNueva.trim()}
            className="px-3 rounded bg-green-600 hover:bg-green-700 text-white text-xs font-bold disabled:opacity-50"
          >
            Añadir
          </button>
        </div>
        {notas.length === 0 ? (
          <p className="text-xs text-slate-400">Sin notas todavía.</p>
        ) : (
          <div className="space-y-2">
            {notas.slice(0, 15).map(n => (
              <div key={n.id} className="p-2.5 rounded bg-[#f4f5f5] dark:bg-slate-800 text-xs">
                <p className="text-slate-700 dark:text-slate-300 whitespace-pre-line break-words">{n.content}</p>
                <p className="text-[10px] text-slate-400 mt-1">
                  {n.createdByName || 'Sistema'} · {new Date(n.createdAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
