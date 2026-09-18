import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useNavigate } from "react-router";
import { MessageCircle, X, Volume2, AlarmClock } from "lucide-react";
import { db } from "../lib/firebase";
import { useAuth } from "./AuthContext";

/**
 * Chats de clientes esperando respuesta, vigilados en todas las pantallas.
 *
 * Antes, un WhatsApp solo existia mientras alguien tenia abierta la pantalla
 * de Chats: fuera de ella nada avisaba, y el globo del menu contaba solo el
 * chat interno entre agencias. Aqui se escucha el estado del chat que el
 * servidor deja en cada contacto (chatPendiente, chatSinResponder...), NO los
 * mensajes: son unos pocos documentos, no miles.
 *
 * Cuando entra un mensaje nuevo: aviso en pantalla, un sonido corto, aviso de
 * escritorio si la pestaña esta en segundo plano, y el numero en el titulo.
 * Con el CRM cerrado no llega nada: eso necesitaria una app instalada.
 *
 * RECORDATORIO. Mientras un cliente espera, vuelve a avisar cada N minutos
 * (10 por omision; cada agencia lo cambia, o lo apaga, en su documento:
 * `chatsRecordatorioMin`). Pedido de Luis: un lead sin contestar es lo mas
 * caro que le puede pasar a una agencia.
 *
 * Con el CRM abierto en varias pestañas suena UNA vez, no una por pestaña:
 * se coordinan por localStorage.
 */

export interface ChatPendiente {
  clientId: string;
  nombre: string;
  sinResponder: number;
  ultimoEntranteAt: string;
  ultimoTexto: string;
  canal: "whatsapp" | "messenger";
}

interface AvisoDeChat {
  idAviso: string;
  clientId: string | null; // null = recordatorio de varios
  nombre: string;
  texto: string;
  canal: "whatsapp" | "messenger" | "recordatorio";
}

export const RECORDATORIO_POR_OMISION = 10;
export const OPCIONES_DE_RECORDATORIO = [0, 5, 10, 15, 30, 60];

interface Valor {
  pendientes: ChatPendiente[];
  total: number;
  /** La pantalla de Chats avisa que conversacion tiene abierta: esa no suena. */
  setConversacionAbierta: (clientId: string | null) => void;
  sonido: boolean;
  setSonido: (v: boolean) => void;
  /** Minutos entre recordatorios; 0 = apagado. */
  recordatorioMin: number;
}

const Contexto = createContext<Valor>({
  pendientes: [],
  total: 0,
  setConversacionAbierta: () => {},
  sonido: true,
  setSonido: () => {},
  recordatorioMin: RECORDATORIO_POR_OMISION,
});

export const useChatsPendientes = () => useContext(Contexto);

// Roles que atienden clientes. El taller no ve la cartera.
const ROLES = new Set(["master", "admin", "manager", "seller"]);

let audio: AudioContext | null = null;
/** Dos notas cortas, generadas: no hace falta ningun archivo de sonido. */
function sonar() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    audio = audio || new Ctx();
    if (audio.state === "suspended") audio.resume().catch(() => {});
    const t0 = audio.currentTime;
    [
      [880, 0],
      [1318.5, 0.13],
    ].forEach(([frecuencia, retraso]) => {
      const osc = audio!.createOscillator();
      const vol = audio!.createGain();
      osc.type = "sine";
      osc.frequency.value = frecuencia;
      vol.gain.setValueAtTime(0, t0 + retraso);
      vol.gain.linearRampToValueAtTime(0.13, t0 + retraso + 0.02);
      vol.gain.exponentialRampToValueAtTime(0.001, t0 + retraso + 0.22);
      osc.connect(vol).connect(audio!.destination);
      osc.start(t0 + retraso);
      osc.stop(t0 + retraso + 0.25);
    });
  } catch {
    // Sin sonido no se pierde nada: el aviso sigue en pantalla.
  }
}

/**
 * La primera pestaña que reclama algo se queda con el: las demas no suenan.
 * Devuelve true si esta pestaña gano.
 */
function reclamar(clave: string, valor: string): boolean {
  try {
    if (localStorage.getItem(clave) === valor) return false;
    localStorage.setItem(clave, valor);
    return true;
  } catch {
    return true; // sin almacenamiento, mejor avisar de mas que de menos
  }
}

function leerSonido(): boolean {
  try {
    return localStorage.getItem("chats.sonido") !== "no";
  } catch {
    return true;
  }
}

export function ChatsPendientesProvider({ children }: { children: React.ReactNode }) {
  const { userData, agencyData } = useAuth();
  const navigate = useNavigate();
  // useNavigate cambia de identidad en cada cambio de pantalla. Si los efectos
  // dependieran de el, el vigilante se reconectaria a Firestore cada vez que
  // alguien navega, y el reloj del recordatorio volveria a empezar.
  const navRef = useRef(navigate);
  navRef.current = navigate;
  const [pendientes, setPendientes] = useState<ChatPendiente[]>([]);
  const [avisos, setAvisos] = useState<AvisoDeChat[]>([]);
  const [sonido, setSonidoEstado] = useState<boolean>(leerSonido);
  const abierta = useRef<string | null>(null);
  const vistos = useRef<Map<string, string>>(new Map());
  const primeraCarga = useRef(true);
  const sonidoRef = useRef(sonido);
  sonidoRef.current = sonido;

  const setSonido = useCallback((v: boolean) => {
    setSonidoEstado(v);
    try {
      localStorage.setItem("chats.sonido", v ? "si" : "no");
    } catch {}
  }, []);

  const setConversacionAbierta = useCallback((clientId: string | null) => {
    abierta.current = clientId;
    // Abrir el chat es atenderlo en pantalla: su aviso ya no hace falta.
    if (clientId) setAvisos((a) => a.filter((x) => x.clientId !== clientId));
  }, []);

  const abrirChat = useCallback((clientId: string) => {
    setAvisos((a) => a.filter((x) => x.clientId !== clientId));
    navRef.current("/chats", { state: { abrirConversacion: clientId } });
  }, []);

  const agencyId = userData?.agencyId;
  const uid = userData?.id;
  const rol = userData?.role || "";
  const activo = !!agencyId && agencyId !== "unassigned" && ROLES.has(rol);

  useEffect(() => {
    vistos.current = new Map();
    primeraCarga.current = true;
    setPendientes([]);
    if (!activo || !agencyId) return;

    // Solo igualdades: Firestore las resuelve sin indice compuesto. El
    // vendedor ve sus chats; los demas roles, los de toda la agencia.
    const q =
      rol === "seller"
        ? query(
            collection(db, "clients"),
            where("agencyId", "==", agencyId),
            where("sellerId", "==", uid),
            where("chatPendiente", "==", true),
          )
        : query(collection(db, "clients"), where("agencyId", "==", agencyId), where("chatPendiente", "==", true));

    const cancelar = onSnapshot(
      q,
      (snap) => {
        const lista: ChatPendiente[] = [];
        const nuevos: ChatPendiente[] = [];
        snap.docs.forEach((d) => {
          const c: any = d.data();
          if (c.isDeleted) return;
          const p: ChatPendiente = {
            clientId: d.id,
            nombre: c.name || "Cliente",
            sinResponder: Number(c.chatSinResponder) || 1,
            ultimoEntranteAt: c.chatUltimoEntranteAt || "",
            ultimoTexto: c.chatUltimoTexto || "",
            canal: c.chatCanal === "messenger" ? "messenger" : "whatsapp",
          };
          lista.push(p);
          const antes = vistos.current.get(d.id);
          // Solo lo que acaba de llegar. Un chat puede aparecer en esta lista
          // por otras razones -- al ponerse al dia un chat viejo, al sacarlo
          // del archivo, al reasignarlo -- y sonar por un mensaje de hace dos
          // dias seria ruido. Lo viejo lo cubre el recordatorio.
          const reciente = !!p.ultimoEntranteAt && Date.now() - Date.parse(p.ultimoEntranteAt) < 5 * 60_000;
          if (!primeraCarga.current && reciente && (!antes || p.ultimoEntranteAt > antes)) {
            nuevos.push(p);
          }
          vistos.current.set(d.id, p.ultimoEntranteAt);
        });
        lista.sort((a, b) => b.ultimoEntranteAt.localeCompare(a.ultimoEntranteAt));
        setPendientes(lista);
        // Al abrir el CRM no suena por lo que ya estaba esperando: solo por
        // lo que llega mientras esta abierto.
        primeraCarga.current = false;

        for (const n of nuevos) {
          const visible = document.visibilityState === "visible";
          if (visible && abierta.current === n.clientId) continue;
          const aviso: AvisoDeChat = {
            idAviso: `${n.clientId}-${n.ultimoEntranteAt}`,
            clientId: n.clientId,
            nombre: n.nombre,
            texto: n.ultimoTexto || "Mensaje nuevo",
            canal: n.canal,
          };
          // El aviso en pantalla sale en cada pestaña; el sonido y el aviso de
          // escritorio, en una sola.
          const gano = reclamar(`chats.avisado.${n.clientId}`, n.ultimoEntranteAt);
          if (gano && sonidoRef.current) sonar();
          if (visible) {
            setAvisos((a) => [aviso, ...a.filter((x) => x.clientId !== n.clientId)].slice(0, 3));
          } else if (gano && typeof Notification !== "undefined" && Notification.permission === "granted") {
            // En Android, Chrome no deja crear avisos asi (pide un service
            // worker) y lanza error: por eso el try.
            try {
              const aviso = new Notification(`${n.canal === "messenger" ? "Messenger" : "WhatsApp"} de ${n.nombre}`, {
                body: n.ultimoTexto || "Mensaje nuevo",
                icon: "/favicon.svg",
                tag: `chat-${n.clientId}`,
              });
              aviso.onclick = () => {
                window.focus();
                abrirChat(n.clientId);
                aviso.close();
              };
            } catch {}
          }
          if (!visible) {
            // Y queda en pantalla para cuando vuelva a la pestaña.
            setAvisos((a) => [aviso, ...a.filter((x) => x.clientId !== n.clientId)].slice(0, 3));
          }
        }
      },
      (err) => console.error("Chats pendientes:", err),
    );
    return () => cancelar();
  }, [activo, agencyId, uid, rol, abrirChat]);

  // Los avisos en pantalla se van solos a los 10 segundos.
  useEffect(() => {
    if (avisos.length === 0) return;
    const t = setTimeout(() => setAvisos((a) => a.slice(0, -1)), 10_000);
    return () => clearTimeout(t);
  }, [avisos]);

  // Recordatorio: mientras haya clientes esperando mas de N minutos, avisa
  // cada N minutos. El primero llega N minutos despues del mensaje, no antes.
  const recordatorioMin =
    typeof (agencyData as any)?.chatsRecordatorioMin === "number"
      ? (agencyData as any).chatsRecordatorioMin
      : RECORDATORIO_POR_OMISION;
  const pendientesRef = useRef(pendientes);
  pendientesRef.current = pendientes;

  useEffect(() => {
    if (!activo || recordatorioMin <= 0) return;
    const cadaMs = recordatorioMin * 60_000;
    const clave = `chats.recordatorio.${agencyId}.${uid}`;

    const revisar = () => {
      const ahora = Date.now();
      const esperando = pendientesRef.current.filter(
        (p) => p.ultimoEntranteAt && ahora - Date.parse(p.ultimoEntranteAt) >= cadaMs,
      );
      if (esperando.length === 0) return;
      let ultimo = 0;
      try {
        ultimo = Number(localStorage.getItem(clave)) || 0;
      } catch {}
      if (ahora - ultimo < cadaMs) return;
      // Reclamar la vuelta: si otra pestaña ya aviso en este intervalo, esta calla.
      if (!reclamar(clave, String(ahora))) return;

      const nombres = esperando.slice(0, 3).map((p) => p.nombre).join(", ") + (esperando.length > 3 ? "…" : "");
      const masViejo = Math.max(...esperando.map((p) => ahora - Date.parse(p.ultimoEntranteAt)));
      const minutos = Math.round(masViejo / 60_000);
      const espera = minutos >= 120 ? `${Math.round(minutos / 60)} horas` : `${minutos} min`;
      const titulo =
        esperando.length === 1
          ? `${esperando[0].nombre} lleva ${espera} esperando respuesta`
          : `${esperando.length} clientes esperan respuesta`;
      const texto = esperando.length === 1 ? esperando[0].ultimoTexto || "Sin contestar" : `${nombres} · el primero, hace ${espera}`;

      if (sonidoRef.current) sonar();
      if (document.visibilityState !== "visible" && typeof Notification !== "undefined" && Notification.permission === "granted") {
        try {
          const n = new Notification(titulo, { body: texto, icon: "/favicon.svg", tag: "chats-recordatorio" });
          n.onclick = () => {
            window.focus();
            navRef.current("/chats", { state: { filtroChats: "sin-responder" } });
            n.close();
          };
        } catch {}
      }
      setAvisos((a) =>
        [
          { idAviso: `recordatorio-${ahora}`, clientId: esperando.length === 1 ? esperando[0].clientId : null, nombre: titulo, texto, canal: "recordatorio" as const },
          ...a.filter((x) => x.canal !== "recordatorio"),
        ].slice(0, 3),
      );
    };

    const t = setInterval(revisar, 30_000);
    return () => clearInterval(t);
  }, [activo, recordatorioMin, agencyId, uid]);

  // El numero en la pestaña del navegador, para verlo desde otra pestaña.
  const total = pendientes.length;
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\)\s*/, "");
    document.title = total > 0 ? `(${total}) ${base}` : base;
  }, [total]);

  const valor = useMemo(
    () => ({ pendientes, total, setConversacionAbierta, sonido, setSonido, recordatorioMin }),
    [pendientes, total, setConversacionAbierta, sonido, setSonido, recordatorioMin],
  );

  return (
    <Contexto.Provider value={valor}>
      {children}
      {avisos.length > 0 && (
        <div className="fixed z-[200] right-3 left-3 sm:left-auto bottom-20 md:bottom-5 flex flex-col gap-2 sm:w-[360px] pointer-events-none">
          {avisos.map((a) => (
            <div
              key={a.idAviso}
              className="pointer-events-auto bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-xl flex items-start gap-3 p-3.5 animate-in slide-in-from-bottom-2"
              role="alert"
            >
              <button
                onClick={() => {
                  if (a.clientId) abrirChat(a.clientId);
                  else {
                    setAvisos((x) => x.filter((y) => y.idAviso !== a.idAviso));
                    navRef.current("/chats", { state: { filtroChats: "sin-responder" } });
                  }
                }}
                className="flex items-start gap-3 flex-1 min-w-0 text-left"
              >
                <span
                  className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-white ${
                    a.canal === "recordatorio" ? "bg-amber-500" : a.canal === "messenger" ? "bg-blue-600" : "bg-[#25D366]"
                  }`}
                >
                  {a.canal === "recordatorio" ? <AlarmClock className="w-5 h-5" /> : <MessageCircle className="w-5 h-5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    {a.canal === "recordatorio"
                      ? "Sin respuesta · toca para verlos"
                      : `${a.canal === "messenger" ? "Messenger" : "WhatsApp"} · toca para responder`}
                  </span>
                  <span className="block text-sm font-bold text-slate-900 dark:text-white line-clamp-2">{a.nombre}</span>
                  <span className="block text-sm text-slate-600 dark:text-slate-300 line-clamp-2">{a.texto}</span>
                </span>
              </button>
              <button
                onClick={() => setAvisos((x) => x.filter((y) => y.idAviso !== a.idAviso))}
                className="shrink-0 p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                title="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          {!sonido && (
            <p className="pointer-events-auto self-end text-[11px] text-slate-500 bg-white/90 dark:bg-slate-800/90 rounded px-2 py-0.5 flex items-center gap-1">
              <Volume2 className="w-3 h-3" /> Sonido apagado
            </p>
          )}
        </div>
      )}
    </Contexto.Provider>
  );
}
