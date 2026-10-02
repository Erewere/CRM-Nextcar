import { motion } from "motion/react";
import React, { useState, useEffect } from 'react';
import { getApiUrl } from '../lib/api';
import { X, Search, Check, Send, AlertCircle, Car, MessageCircle, FileText } from 'lucide-react';
import { generarFichaPdf, descargarOCompartir } from '../lib/fichaPdf';
import { abrirWhatsApp, SelectorWhatsApp } from '../lib/whatsappApp';
import { ElegirFotosFicha, fotosInicialesDeFicha, MAX_FOTOS_FICHA } from './auto/ElegirFotosFicha';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { Client, Vehicle } from '../types';
import clsx from 'clsx';

interface Props {
  vehicle: Vehicle;
  onClose: () => void;
}

export function ShareVehicleModal({ vehicle, onClose }: Props) {
  const { userData, currentUser, agencyData } = useAuth();
  // Forma gratis: en el teléfono, primero se arma la ficha y luego se comparte
  // con un segundo toque (el teléfono solo deja compartir justo tras un toque).
  const [fichaLista, setFichaLista] = useState<File | null>(null);
  const [preparando, setPreparando] = useState(false);
  const [hecho, setHecho] = useState<'' | 'gratis' | 'plantilla'>('');
  // Las fotos de la ficha: las que se recordaron para este auto o las primeras tres.
  const todasLasFotos = (vehicle.photoUrls?.length ? vehicle.photoUrls : vehicle.photoUrl ? [vehicle.photoUrl] : []).filter(Boolean) as string[];
  const [fotosFicha, setFotosFicha] = useState<string[]>(fotosInicialesDeFicha(todasLasFotos, (vehicle as any).fotosFicha));
  const [eligiendoFotos, setEligiendoFotos] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!userData) return;
    const fetchClients = async () => {
      try {
        let q = query(
          collection(db, 'clients'),
          where('agencyId', '==', userData.agencyId)
        );
        if (userData.role === 'seller') {
           q = query(
             collection(db, 'clients'),
             where('agencyId', '==', userData.agencyId),
             where('sellerId', '==', userData.id)
           );
        }
        
        const snap = await getDocs(q);
        const list = snap.docs.map(d => ({ ...d.data(), id: d.id } as Client)).filter(c => !c.isDeleted);
        setClients(list);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchClients();
  }, [userData]);

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (c.phone && c.phone.includes(searchTerm))
  );

  const enTelefono = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));
  const titulo = `${vehicle.year || ''} ${vehicle.make || ''} ${vehicle.model || ''}`.trim();
  const mensajeGratis = (c: Client | null) =>
    `Hola${c?.name ? ` ${String(c.name).split(' ')[0]}` : ''}, te comparto el ${titulo} en $${Number(vehicle.price || 0).toLocaleString('es-MX')}.` +
    (vehicle.websiteUrl ? `\nAquí ves todas las fotos: ${vehicle.websiteUrl}` : '') +
    `\nTe mando su ficha con los datos.`;
  const nombreFicha = `${titulo}.pdf`.replace(/[^\w áéíóúñÁÉÍÓÚÑ.-]+/g, '');

  const anotarEnHistorial = async (c: Client | null, como: string) => {
    if (!c) return;
    const n: Record<string, any> = {
      clientId: c.id,
      agencyId: userData?.agencyId || '',
      content: `Compartido por WhatsApp (${como}): ${titulo} - $${Number(vehicle.price || 0).toLocaleString('es-MX')}`,
      type: 'whatsapp',
      createdAt: new Date().toISOString(),
    };
    if (userData?.id) { n.createdBy = userData.id; n.sellerId = userData.id; }
    if (userData?.name) n.createdByName = userData.name;
    await addDoc(collection(db, 'notes'), n).catch((e) => console.error(e));
  };

  const armarFicha = () => generarFichaPdf({
    auto: vehicle,
    agencia: agencyData as any,
    fotosElegidas: fotosFicha,
    asesor: { name: userData?.name, phone: (userData as any)?.phone, email: userData?.email },
  });

  /** Gratis, desde el WhatsApp del vendedor: mensaje con la liga + la ficha en PDF. */
  const mandarGratis = async () => {
    if (enTelefono) {
      setPreparando(true);
      try {
        const blob = await armarFicha();
        setFichaLista(new File([blob], nombreFicha, { type: 'application/pdf' }));
      } catch (e: any) {
        alert(`No se pudo armar la ficha. ${e?.message || ''}`);
      } finally {
        setPreparando(false);
      }
      return;
    }
    // Computadora: se abre el chat del cliente con el mensaje (antes de esperar,
    // para que el navegador no lo bloquee) y se descarga la ficha para adjuntarla.
    abrirWhatsApp(selectedClient?.phone, mensajeGratis(selectedClient));
    setPreparando(true);
    try {
      const blob = await armarFicha();
      await descargarOCompartir(blob, nombreFicha, titulo);
      await anotarEnHistorial(selectedClient, 'gratis');
      setHecho('gratis');
      setSuccess(true);
    } catch (e: any) {
      alert(`Se abrió WhatsApp, pero no se pudo armar la ficha. ${e?.message || ''}`);
    } finally {
      setPreparando(false);
    }
  };

  const compartirFicha = async () => {
    if (!fichaLista) return;
    try {
      if (navigator.canShare?.({ files: [fichaLista] })) {
        await navigator.share({ files: [fichaLista], text: mensajeGratis(selectedClient), title: titulo });
      } else {
        await descargarOCompartir(fichaLista, nombreFicha, titulo);
      }
      await anotarEnHistorial(selectedClient, 'gratis');
      setHecho('gratis');
      setSuccess(true);
    } catch { /* si cierran el menú, no pasa nada */ }
  };

  const handleSend = async () => {
    if (!selectedClient) return;
    setSending(true);
    
    try {
      // Format phone (add country code if needed, assuming +52 for Mexico for now if missing)
      let phone = selectedClient.phone.replace(/\D/g, '');
      if (phone.length === 10) phone = '52' + phone;

      // Send Template
      const idToken = await currentUser?.getIdToken();
      const res = await fetch(getApiUrl('/api/meta/send-template'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify({
          to: phone,
          clientId: selectedClient.id,
          templateName: 'vehicle_recommendation',
          variables: [
             { type: "text", text: selectedClient.name },
             { type: "text", text: `${vehicle.make} ${vehicle.model} ${vehicle.year}` },
             { type: "text", text: `$${vehicle.price?.toLocaleString()}` }
          ]
        })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error sending message');
      
      await anotarEnHistorial(selectedClient, 'plantilla oficial');
      setHecho('plantilla');
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 4000);
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'Error al enviar el mensaje');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex flex-col justify-end md:items-center md:justify-center p-0 md:p-4">
      <motion.div className="absolute inset-0" onClick={onClose} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} />
      <motion.div 
        className="bg-white dark:bg-slate-900 w-full h-[90dvh] md:h-auto md:max-h-[85vh] md:max-w-md md:rounded rounded-t-3xl flex flex-col shadow-2xl relative z-10"
        initial={{ y: "60vh", scaleX: 0.3, scaleY: 0.05, opacity: 0, borderRadius: "10rem" }}
        animate={{ y: 0, scaleX: 1, scaleY: 1, opacity: 1, borderRadius: "1.5rem" }}
        exit={{ y: "60vh", scaleX: 0.3, scaleY: 0.05, opacity: 0, borderRadius: "10rem", transition: { duration: 0.25, ease: "easeInOut" } }}
        transition={{ type: "spring", damping: 22, stiffness: 280, mass: 0.8 }}
        style={{ transformOrigin: "bottom center" }}
      >
        
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-800 shrink-0">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Compartir Vehículo</h2>
          <button onClick={onClose} className="p-2 -mr-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full bg-slate-100 dark:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {success ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
              <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{hecho === 'gratis' ? '¡Listo!' : 'Plantilla enviada a Meta'}</h3>
            <p className="text-slate-500 dark:text-slate-400">
              {hecho === 'gratis'
                ? `Termina el envío en tu WhatsApp${!enTelefono ? ': adjunta la ficha que se descargó' : ''}. Quedó anotado en el historial de ${selectedClient?.name || 'el cliente'}.`
                : `En el chat de ${selectedClient?.name || 'el cliente'} verás si le llegó, si lo leyó o por qué no le llegó.`}
            </p>
          </div>
        ) : (
          <>
            <div className="p-4 bg-[#f4f5f5] dark:bg-slate-800/50 shrink-0 flex gap-4 items-center">
               <div className="w-16 h-12 bg-slate-200 dark:bg-slate-700 rounded overflow-hidden shrink-0">
                  {vehicle.photoUrls?.[0] || vehicle.photoUrl ? (
                    <img src={vehicle.photoUrls?.[0] || vehicle.photoUrl} className="w-full h-full object-cover" alt="" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><Car className="w-6 h-6 text-slate-400" /></div>
                  )}
               </div>
               <div className="min-w-0">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">{vehicle.make} {vehicle.model}</h4>
                  <p className="text-xs text-slate-500">${vehicle.price?.toLocaleString()}</p>
               </div>
            </div>

            <div className="p-4 shrink-0 border-b border-gray-200 dark:border-slate-800">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar cliente..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded pl-9 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {loading ? (
                <div className="flex justify-center p-8"><div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>
              ) : filteredClients.length === 0 ? (
                <div className="text-center p-8 text-slate-500">No se encontraron clientes</div>
              ) : (
                <div className="space-y-1">
                  {filteredClients.map(c => (
                    <button
                      key={`client-${c.id}`}
                      onClick={() => setSelectedClient(c)}
                      className={clsx(
                        "w-full flex items-center justify-between p-3 rounded text-left transition-colors",
                        selectedClient?.id === c.id 
                          ? "bg-blue-50 dark:bg-blue-900/30 ring-1 ring-blue-500" 
                          : "hover:bg-[#f4f5f5] dark:hover:bg-slate-800"
                      )}
                    >
                      <div>
                        <div className="font-semibold text-sm text-slate-900 dark:text-white">{c.name}</div>
                        <div className="text-xs text-slate-500">{c.phone || "Sin teléfono"}</div>
                      </div>
                      {selectedClient?.id === c.id && (
                        <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-white">
                          <Check className="w-3 h-3" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 pb-safe flex flex-col gap-2">
              {todasLasFotos.length > MAX_FOTOS_FICHA && !fichaLista && (
                <button type="button" onClick={() => setEligiendoFotos(true)} className="self-center text-xs font-bold text-blue-700 dark:text-blue-400 hover:underline">
                  Fotos de la ficha: {fotosFicha.length} elegidas · cambiar
                </button>
              )}
              {fichaLista ? (
                <button onClick={compartirFicha} className="w-full bg-green-700 hover:bg-green-800 text-white rounded py-3.5 font-bold flex items-center justify-center gap-2">
                  <FileText className="w-5 h-5" /> Compartir ficha por WhatsApp
                </button>
              ) : (
                <button
                  disabled={!selectedClient || preparando || (!enTelefono && !selectedClient?.phone)}
                  onClick={mandarGratis}
                  className="w-full bg-green-700 hover:bg-green-800 text-white rounded py-3 font-bold flex flex-col items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="flex items-center gap-2"><MessageCircle className="w-5 h-5" /> {preparando ? 'Armando la ficha…' : 'Mandar gratis desde mi WhatsApp'}</span>
                  <span className="text-[11px] font-medium opacity-90">Mensaje con la liga del auto + la ficha en PDF</span>
                </button>
              )}
              {!enTelefono || !fichaLista ? <SelectorWhatsApp className="justify-center" /> : null}
              <button
                disabled={!selectedClient || sending || !selectedClient?.phone}
                onClick={handleSend}
                className="w-full border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-200 rounded py-2.5 font-bold flex flex-col items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? (
                  <div className="w-5 h-5 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span className="flex items-center gap-2 text-sm"><Send className="w-4 h-4" /> Plantilla oficial de la agencia</span>
                    <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400">Meta cobra cada envío · solo texto, sin foto · úsala si el cliente no te ha escrito</span>
                  </>
                )}
              </button>
              {selectedClient && !selectedClient.phone && (
                <div className="flex items-center gap-1.5 text-xs text-amber-600 justify-center">
                  <AlertCircle className="w-4 h-4" />
                  El cliente no tiene teléfono registrado{enTelefono ? ': con «gratis» eliges el contacto en WhatsApp' : ''}
                </div>
              )}
            </div>
          </>
        )}
      </motion.div>
      {eligiendoFotos && (
        <ElegirFotosFicha
          fotos={todasLasFotos}
          inicial={fotosFicha}
          puedeRecordar={false}
          generando={false}
          textoBoton="Usar estas fotos"
          onCancelar={() => setEligiendoFotos(false)}
          onGenerar={(elegidas) => { setFotosFicha(elegidas); setFichaLista(null); setEligiendoFotos(false); }}
        />
      )}
    </div>
  );
}
