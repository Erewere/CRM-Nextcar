import React, { useState, useRef, useEffect } from "react";
import { motion } from "motion/react";
import {
  X,
  Phone,
  Users,
  Clock,
  Flag,
  Mail,
  Coffee,
  Calendar as CalendarIcon,
  FileText,
  User,
  Link as LinkIcon,
  Settings,
  Building2,
  Briefcase,
  ChevronRight,
  ChevronLeft,
  CalendarX,
  Check,
  Car,
  PenTool,
} from "lucide-react";
import clsx from "clsx";
import { Client } from "../types";
import { useAuth } from "../contexts/AuthContext";
import { getDoc, onSnapshot, doc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { format, addDays, subDays } from "date-fns";
import { es } from "date-fns/locale";
import { TimeSelect } from "./TimeSelect";

interface NewActivityModalProps {
  onClose: () => void;
  onSave: (taskData: any) => void;
  clients: Client[];
  deals?: any[];
  currentUser: any;
  initialData?: any;
  tasks?: any[];
}

export function NewActivityModal({
  onClose,
  onSave,
  clients,
  deals = [],
  currentUser,
  initialData,
  tasks = [],
}: NewActivityModalProps) {
  const [type, setType] = useState(initialData?.type || "call");
  const [title, setTitle] = useState(initialData?.title || "Llamada");
  const [date, setDate] = useState(
    initialData?.dueDate || format(new Date(), "yyyy-MM-dd"),
  );

  const getDefaultStartTime = () => {
    const now = new Date();
    let mins = now.getMinutes();
    let hrs = now.getHours();
    mins = Math.ceil(mins / 15) * 15;
    if (mins >= 60) {
      mins = 0;
      hrs += 1;
    }
    hrs = hrs % 24;
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
  };

  const [startTime, setStartTime] = useState(
    initialData?.startTime || getDefaultStartTime(),
  );
  const [endTime, setEndTime] = useState(initialData?.endTime || "");
  const [notes, setNotes] = useState(initialData?.notes || "");
  const [clientId, setClientId] = useState(initialData?.clientId || "");
  const [businessHours, setBusinessHours] = useState({ start: 8, end: 20 });
  const { userData, googleAccount, googleToken } = useAuth();
  const googleConectado = Boolean(googleAccount || googleToken);

  const handleSaveClick = () => {
    const existingDeal = deals.find(
      (d) => String(d.title || "").toLowerCase() === dealTitle.toLowerCase()
    );
    onSave({
      title,
      type,
      dueDate: date,
      startTime,
      endTime,
      clientId,
      clientName,
      clientStatus,
      dealId: existingDeal?.id || "",
      dealTitle,
      organization,
      notes,
      completed,
      syncToCalendar,
      disponibilidad,
    });
  };

  useEffect(() => {
    if (!userData || userData.role === "master") return;
    
    if (userData.agencyId && userData.agencyId !== "unassigned") {
      const unsubscribe = onSnapshot(doc(db, "agencies", userData.agencyId), (snap) => {
        if (snap.exists() && snap.data().businessHours) {
          const bh = snap.data().businessHours;
          setBusinessHours({
            start: parseInt(bh.start.split(":")[0], 10),
            end: parseInt(bh.end.split(":")[0], 10)
          });
        }
      });
      return () => unsubscribe();
    }
  }, [userData]);

  const [clientName, setClientName] = useState(() => {
    if (initialData?.clientName) return initialData.clientName;
    if (initialData?.clientId) {
      const c = clients.find((cl) => cl.id === initialData.clientId);
      return c ? c.name : "";
    }
    return "";
  });
  const [showNameSuggestions, setShowNameSuggestions] = useState(false);
  const nameInputRef = useRef<HTMLDivElement>(null);

  const dragRef = useRef<{ startY: number, startTop: number, durationMins: number, isDragging: boolean }>({ startY: 0, startTop: 0, durationMins: 60, isDragging: false });

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const startH = parseInt(startTime.split(":")[0] || "0");
    const startM = parseInt(startTime.split(":")[1] || "0");
    let endH = parseInt(endTime.split(":")[0] || "-1");
    let endM = parseInt(endTime.split(":")[1] || "0");
    
    let durationMins = 60;
    if (endTime && (endH * 60 + endM) > (startH * 60 + startM)) {
      durationMins = (endH * 60 + endM) - (startH * 60 + startM);
    }

    dragRef.current = {
      startY: e.clientY,
      startTop: (startH + startM / 60) * 60,
      durationMins,
      isDragging: true
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.isDragging) return;
    const deltaY = e.clientY - dragRef.current.startY;
    let newTop = dragRef.current.startTop + deltaY;
    
    // snap to 15 mins (15px)
    newTop = Math.round(newTop / 15) * 15;
    
    if (newTop < 0) newTop = 0; 
    if (newTop > 24 * 60 - 15) newTop = 24 * 60 - 15; 

    const newH = Math.floor(newTop / 60);
    const newM = newTop % 60;
    const newStartTimeStr = `${newH.toString().padStart(2, "0")}:${newM.toString().padStart(2, "0")}`;
    
    setStartTime(newStartTimeStr);
    
    if (endTime) {
       let endTotal = newH * 60 + newM + dragRef.current.durationMins;
       if (endTotal >= 24 * 60) endTotal = 24 * 60 - 1; // max 23:59
       const newEndH = Math.floor(endTotal / 60);
       const newEndM = endTotal % 60;
       setEndTime(`${newEndH.toString().padStart(2, "0")}:${newEndM.toString().padStart(2, "0")}`);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current.isDragging) {
      dragRef.current.isDragging = false;
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        nameInputRef.current &&
        !nameInputRef.current.contains(e.target as Node)
      ) {
        setShowNameSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const initialDealTitle =
    initialData?.dealTitle ||
    (initialData?.dealId
      ? deals.find((d) => d.id === initialData.dealId)?.title
      : "") ||
    "";
  const [dealTitle, setDealTitle] = useState(initialDealTitle);
  const [organization, setOrganization] = useState(
    initialData?.organization || "",
  );
  const [completed, setCompleted] = useState(initialData?.completed || false);
  // Conectar la cuenta de Google ya es la decision de sincronizar; no tiene
  // sentido volver a pedirla en cada actividad. La casilla queda encendida
  // por omision y sigue ahi para la excepcion: una actividad suelta que no
  // quieres en tu calendario.
  const [syncToCalendar, setSyncToCalendar] = useState(
    Boolean(initialData?.googleEventId) || googleConectado
  );
  const [casillaTocada, setCasillaTocada] = useState(false);

  // El permiso de Google llega un instante despues de abrir la pantalla, asi
  // que al primer dibujo todavia no se sabe si hay cuenta. Cuando se sabe, se
  // ajusta -- salvo que la persona ya la haya movido a mano.
  useEffect(() => {
    if (casillaTocada) return;
    setSyncToCalendar(Boolean(initialData?.googleEventId) || googleConectado);
  }, [googleConectado, casillaTocada, initialData?.googleEventId]);
  const [disponibilidad, setDisponibilidad] = useState<'ocupado' | 'libre'>(
    initialData?.disponibilidad || 'ocupado'
  );
  const [clientStatus, setClientStatus] = useState("new");
  const [pipelineStages, setPipelineStages] = useState<
    { id: string; title: string }[]
  >([
    { id: "new", title: "Nuevos" },
    { id: "contacted", title: "Contactados" },
    { id: "negotiation", title: "Negociación" },
    { id: "credito", title: "Crédito" },
    { id: "won", title: "Ganados" },
    { id: "lost", title: "Perdidos" },
  ]);

  useEffect(() => {
    if (currentUser?.agencyId) {
      import("firebase/firestore").then(({ doc, getDoc }) => {
        import("../lib/firebase").then(({ db }) => {
          getDoc(doc(db, "agencies", currentUser.agencyId as string))
            .then((docSnap) => {
              if (docSnap.exists()) {
                const data = docSnap.data();
                if (
                  data.pipelineStages &&
                  Array.isArray(data.pipelineStages) &&
                  data.pipelineStages.length > 0
                ) {
                  setPipelineStages(data.pipelineStages);
                  setClientStatus(data.pipelineStages[0].id);
                }
              }
            })
            .catch(console.error);
        });
      });
    }
  }, [currentUser?.agencyId]);

  const [previewDate, setPreviewDate] = useState<Date>(
    initialData?.dueDate
      ? new Date(initialData.dueDate + "T00:00:00")
      : new Date(),
  );

  useEffect(() => {
    // Attempt to scroll the calendar view to the current task or current time
    const container = document.getElementById("calendar-scroll-container");
    if (container) {
      const taskPreview = document.getElementById("current-task-preview");
      if (taskPreview) {
        const topPx = parseInt(taskPreview.style.top || "0");
        container.scrollTop = Math.max(0, topPx - 100);
      } else {
        const now = new Date();
        const topPx = (now.getHours() + now.getMinutes() / 60) * 60;
        container.scrollTop = Math.max(0, topPx - 100);
      }
    }
  }, [startTime, previewDate]);

  useEffect(() => {
    if (date) {
      const [y, m, d] = date.split("-");
      if (y && m && d) {
        const newDate = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
        if (
          !isNaN(newDate.getTime()) &&
          format(previewDate, "yyyy-MM-dd") !== date
        ) {
          setPreviewDate(newDate);
        }
      }
    }
  }, [date]);

  // Sync date back if previewDate is changed by the arrows
  useEffect(() => {
    const formatted = format(previewDate, "yyyy-MM-dd");
    if (date !== formatted) {
      setDate(formatted);
    }
  }, [previewDate]);

  // Handle deal selection logic
  const handleDealChange = (val: string) => {
    setDealTitle(val);
    const existingDeal = deals.find(
      (d) => String(d.title || "").toLowerCase() === val.toLowerCase(),
    );
    if (existingDeal) {
      if (existingDeal.clientId) {
        setClientId(existingDeal.clientId);
        const person = clients.find((c) => c.id === existingDeal.clientId);
        if (person) {
          setClientName(person.name);
          if (person.organization) {
            setOrganization(person.organization);
          }
        }
      }
    }
  };

  const handleClientNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setClientName(e.target.value);
    setClientId("");
    setShowNameSuggestions(true);
  };

  const handleSelectClient = (person: Client) => {
    setClientId(person.id as string);
    setClientName(person.name);
    if (person.organization) {
      setOrganization(person.organization);
    }
    setShowNameSuggestions(false);
  };

  const types = [
    { id: "call", icon: Phone, label: "Llamada" },
    { id: "appointment", icon: User, label: "Cita" },
    { id: "test_drive", icon: Car, label: "Prueba de manejo" },
    { id: "signature", icon: PenTool, label: "Firma" },
    { id: "task", icon: Clock, label: "Tarea" },
  ];

  const handleTypeSelect = (t: any) => {
    setType(t.id);
    if (!title || types.some((x) => x.label === title)) {
      setTitle(t.label);
    }
  };

  // Las 24 horas: el bloque de la actividad se coloca por hora * 60 px, así
  // que la rejilla tiene que empezar en las 00:00 o todo queda desfasado.
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const aMin = (h?: string) => {
    if (!h || !h.includes(":")) return null;
    const [a, b] = h.split(":").map((x) => parseInt(x, 10));
    return Number.isNaN(a) ? null : a * 60 + (b || 0);
  };
  const deMin = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  const ini = aMin(startTime);
  const fin = aMin(endTime);
  const duracion = ini !== null && fin !== null && fin > ini ? fin - ini : null;

  // Otras actividades del mismo día que se empalman con esta.
  const empalmes = (tasks || []).filter((t) => {
    if (!t?.task || t.task.id === initialData?.id || t.task.completed) return false;
    if (t.task.dueDate !== date || !t.task.startTime) return false;
    const a = aMin(t.task.startTime); const b = aMin(t.task.endTime) ?? (a !== null ? a + 60 : null);
    if (a === null || b === null || ini === null) return false;
    const miFin = fin !== null && fin > ini ? fin : ini + 60;
    return a < miFin && b > ini;
  });

  const hoyISO = format(new Date(), "yyyy-MM-dd");
  const atajos: { t: string; d: number }[] = [
    { t: "Hoy", d: 0 }, { t: "Mañana", d: 1 }, { t: "En 2 días", d: 2 }, { t: "Próx. semana", d: 7 },
  ];
  const campo = "w-full h-10 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-3 text-sm focus:ring-2 focus:ring-blue-500/40 outline-none";
  const etiqueta = "block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5";
  const personaElegida = clientId ? clients.find((c) => c.id === clientId) : null;
  const sugerencias = clientName ? clients.filter((p) => p.name?.toLowerCase().includes(clientName.toLowerCase())).slice(0, 8) : [];

  return (
    <div className="fixed inset-0 z-50 flex justify-center items-end md:items-center p-0 md:p-4">
      <motion.div className="absolute inset-0 bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.div
        className="bg-white dark:bg-slate-800 md:rounded-2xl shadow-2xl w-full max-w-5xl h-[100dvh] md:h-[88vh] flex flex-col overflow-hidden relative z-10"
        initial={{ y: "60vh", scaleX: 0.3, scaleY: 0.05, opacity: 0, borderRadius: "10rem" }}
        animate={{ y: 0, scaleX: 1, scaleY: 1, opacity: 1, borderRadius: "1.25rem" }}
        exit={{ y: "60vh", scaleX: 0.3, scaleY: 0.05, opacity: 0, borderRadius: "10rem", transition: { duration: 0.25, ease: "easeInOut" } }}
        transition={{ type: "spring", damping: 22, stiffness: 280, mass: 0.8 }}
        style={{ transformOrigin: "bottom center" }}
      >
        {/* Encabezado */}
        <div className="flex justify-between items-center px-4 md:px-6 py-3.5 border-b border-slate-200 dark:border-slate-700">
          <button onClick={onClose} className="text-slate-500 dark:text-slate-400 md:hidden text-sm font-semibold">Cancelar</button>
          <div className="flex-1 md:flex-none text-center md:text-left">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Tareas y calendario</p>
            <h2 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">{initialData?.id ? "Editar actividad" : "Nueva actividad"}</h2>
          </div>
          <button onClick={handleSaveClick} className="text-blue-600 dark:text-blue-400 font-bold md:hidden text-sm">Guardar</button>
          <button onClick={onClose} aria-label="Cerrar" className="hidden md:flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex flex-col md:flex-row flex-1 overflow-y-auto overflow-x-hidden md:overflow-hidden">
          {/* Formulario */}
          <div className="w-full md:w-[58%] md:overflow-y-auto p-4 md:p-6 flex flex-col gap-5">
            {/* Qué */}
            <div>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="¿Qué hay que hacer?"
                className="w-full text-xl font-bold text-slate-900 dark:text-white bg-transparent border-0 border-b-2 border-slate-200 dark:border-slate-600 focus:border-blue-600 px-0 py-2 outline-none"
              />
              <div className="flex flex-wrap gap-1.5 mt-3">
                {types.map((t, idx) => {
                  const Icon = t.icon;
                  return (
                    <button
                      type="button"
                      key={`${t.id}-${idx}`}
                      onClick={() => handleTypeSelect(t)}
                      aria-pressed={type === t.id}
                      className={clsx(
                        "h-9 px-3 rounded-full border text-xs font-bold flex items-center gap-1.5 transition-colors",
                        type === t.id
                          ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white"
                          : "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700",
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" /> {t.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Con quién: lo más importante de una actividad */}
            <div>
              <span className={etiqueta}>Con quién</span>
              <div className="flex flex-col gap-2">
                <div className="relative" ref={nameInputRef}>
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                  <input
                    type="text"
                    value={clientName}
                    autoComplete="off"
                    onChange={handleClientNameChange}
                    onFocus={() => setShowNameSuggestions(true)}
                    placeholder="Buscar persona por nombre…"
                    className={clsx(campo, "pl-9", personaElegida && "border-emerald-400 dark:border-emerald-600")}
                  />
                  {personaElegida && <Check className="w-4 h-4 text-emerald-600 absolute right-3 top-3" />}
                  {showNameSuggestions && clientName && !personaElegida && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50 max-h-52 overflow-y-auto">
                      {sugerencias.length > 0 ? sugerencias.map((p) => (
                        <div key={`client-${p.id}`} className="px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer" onClick={() => handleSelectClient(p)}>
                          <div className="font-semibold text-slate-900 dark:text-slate-100">{p.name}</div>
                          {p.phone && <div className="text-xs text-slate-500">{p.phone}</div>}
                        </div>
                      )) : (
                        <div className="px-3 py-2 text-sm text-slate-500 italic">No hay coincidencias: se creará como contacto nuevo.</div>
                      )}
                    </div>
                  )}
                </div>
                <div className="relative">
                  <Briefcase className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                  <input
                    type="text"
                    value={dealTitle}
                    onChange={(e) => handleDealChange(e.target.value)}
                    list="deal-options"
                    placeholder="Trato (opcional)"
                    className={clsx(campo, "pl-9")}
                  />
                  <datalist id="deal-options">
                    {deals.map((d) => <option key={`deal-${d.id}`} value={d.title} />)}
                  </datalist>
                </div>
                {!clientId && clientName && (
                  <div className="relative">
                    <Flag className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                    <select value={clientStatus} onChange={(e) => setClientStatus(e.target.value)} className={clsx(campo, "pl-9")}>
                      {pipelineStages.map((stage) => <option key={`stage-${stage.id}`} value={stage.id}>Etapa inicial del contacto nuevo: {stage.title}</option>)}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Cuándo */}
            <div>
              <span className={etiqueta}>Cuándo</span>
              <div className="flex flex-wrap gap-1.5 mb-2.5">
                {atajos.map(({ t, d }) => {
                  const f = format(addDays(new Date(`${hoyISO}T00:00:00`), d), "yyyy-MM-dd");
                  return (
                    <button type="button" key={t} onClick={() => setDate(f)} aria-pressed={date === f}
                      className={clsx("h-8 px-3 rounded-full text-xs font-bold border transition-colors", date === f ? "bg-blue-600 text-white border-blue-600" : "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700")}>
                      {t}
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={clsx(campo, "sm:w-40")} />
                <TimeSelect value={startTime} onChange={setStartTime} placeholder="Inicio" minHour={businessHours.start} maxHour={businessHours.end} />
                <span className="text-slate-400 hidden sm:block">a</span>
                <TimeSelect value={endTime} onChange={setEndTime} placeholder="Fin (opcional)" minHour={businessHours.start} maxHour={businessHours.end} />
              </div>
              {ini !== null && (
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className="text-[11px] font-semibold text-slate-500">Duración:</span>
                  {[15, 30, 60, 90].map((m) => (
                    <button type="button" key={m} onClick={() => setEndTime(deMin(ini + m))} aria-pressed={duracion === m}
                      className={clsx("h-7 px-2.5 rounded-full text-[11px] font-bold border", duracion === m ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900" : "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300")}>
                      {m < 60 ? `${m} min` : m === 60 ? "1 h" : "1.5 h"}
                    </button>
                  ))}
                </div>
              )}
              {empalmes.length > 0 && (
                <p className="mt-2 text-xs font-semibold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg px-3 py-2">
                  Ojo: a esa hora ya tienes {empalmes.length === 1 ? `«${empalmes[0].task.title}»` : `${empalmes.length} actividades`}.
                </p>
              )}
            </div>

            {/* Notas */}
            <div>
              <span className={etiqueta}>Notas</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Lo que hay que recordar o decirle…"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-3 text-sm min-h-[84px] outline-none focus:ring-2 focus:ring-blue-500/40"
              />
              <p className="text-[11px] text-slate-500 mt-1">Viajan a tu Google Calendar como descripción del evento.</p>
            </div>

            {/* Calendario de Google */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-3 flex flex-col gap-2.5">
              <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-slate-700 dark:text-slate-200">
                <input type="checkbox" checked={syncToCalendar} onChange={(e) => { setCasillaTocada(true); setSyncToCalendar(e.target.checked); }} className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                <CalendarIcon className="w-4 h-4 shrink-0" /> Poner en mi Google Calendar
              </label>
              {syncToCalendar && (
                <div className="flex items-center gap-2 pl-6">
                  <CalendarX className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="text-xs text-slate-600 dark:text-slate-300">Mostrarme como</span>
                  <div className="flex gap-0.5 bg-slate-200/70 dark:bg-slate-800 p-0.5 rounded-lg">
                    {(["ocupado", "libre"] as const).map((v) => (
                      <button type="button" key={v} onClick={() => setDisponibilidad(v)} aria-pressed={disponibilidad === v}
                        className={clsx("h-7 px-3 rounded-md text-xs font-bold", disponibilidad === v ? "bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm" : "text-slate-500")}>
                        {v === "ocupado" ? "Ocupado" : "Libre"}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <p className="text-[11px] text-slate-500 pl-6 -mt-1">Asignada a {currentUser?.name || "ti"}.</p>
            </div>
          </div>

          {/* Tu día */}
          <div className="hidden md:flex md:w-[42%] bg-slate-50 dark:bg-slate-900/40 border-l border-slate-200 dark:border-slate-700 flex-col min-h-[400px]">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-800">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Tu día</p>
                <span className="font-extrabold text-slate-900 dark:text-white text-sm capitalize">{format(previewDate, "EEEE d 'de' MMMM", { locale: es })}</span>
              </div>
              <div className="flex gap-1">
                <button type="button" onClick={() => setPreviewDate(subDays(previewDate, 1))} aria-label="Día anterior" className="h-8 w-8 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-500"><ChevronLeft className="w-4 h-4" /></button>
                <button type="button" onClick={() => setPreviewDate(addDays(previewDate, 1))} aria-label="Día siguiente" className="h-8 w-8 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-500"><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto relative" id="calendar-scroll-container">
              {tasks.filter((t) => t.task.dueDate === format(previewDate, "yyyy-MM-dd") && t.task.id !== initialData?.id).map((t, idx) => {
                const a = aMin(t.task.startTime) ?? 12 * 60;
                const b = aMin(t.task.endTime);
                const dur = b !== null && b > a ? b - a : 60;
                return (
                  <div key={`${t.task.id}-${idx}`} className={clsx("absolute left-12 right-2 text-xs px-2 py-1 rounded-md z-0 flex flex-col gap-0.5 overflow-hidden pointer-events-none border", t.task.completed ? "bg-slate-100 text-slate-400 border-slate-200 line-through" : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700/50 opacity-80")} style={{ top: `${a}px`, height: `${dur}px` }}>
                    <span className="font-bold line-clamp-1">{t.task.startTime ? "" : "Sin hora · "}{t.task.title}</span>
                    {dur > 30 && t.client && <span className="text-[10px] truncate">{t.client.name}</span>}
                  </div>
                );
              })}

              {(() => {
                const a = ini ?? 0;
                const dur = duracion ?? 60;
                return (
                  <div
                    className="absolute left-12 right-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs px-2 py-1.5 rounded-md z-10 shadow-md border border-blue-500 overflow-hidden flex flex-col cursor-grab active:cursor-grabbing"
                    style={{ top: `${a}px`, minHeight: "30px", height: `${dur}px`, touchAction: "none" }}
                    id="current-task-preview"
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                  >
                    <div className="flex items-center gap-1 font-bold">
                      {type === "call" && <Phone className="w-3 h-3 shrink-0" />}
                      {type === "appointment" && <User className="w-3 h-3 shrink-0" />}
                      {type === "test_drive" && <Car className="w-3 h-3 shrink-0" />}
                      {type === "signature" && <PenTool className="w-3 h-3 shrink-0" />}
                      {type === "task" && <Check className="w-3 h-3 shrink-0" />}
                      <span className="truncate">{title || "Nueva actividad"}</span>
                    </div>
                    <span className="text-[10px] opacity-90">{startTime}{endTime ? ` – ${endTime}` : ""} · arrástrala para cambiar la hora</span>
                  </div>
                );
              })()}

              {hours.map((hour) => (
                <div key={hour} className="flex h-[60px] border-b border-slate-200/70 dark:border-slate-700 last:border-b-0">
                  <div className="w-12 text-right pr-2 py-1 text-[11px] text-slate-400 font-medium">{String(hour).padStart(2, "0")}:00</div>
                  <div className="flex-1 border-l border-slate-200 dark:border-slate-700" />
                </div>
              ))}

              {(() => {
                const now = new Date();
                if (format(now, "yyyy-MM-dd") !== format(previewDate, "yyyy-MM-dd")) return null;
                const nowTop = (now.getHours() + now.getMinutes() / 60) * 60;
                return (
                  <div className="absolute left-0 right-0 border-t border-red-500 z-20 flex items-center pointer-events-none" style={{ top: `${nowTop}px` }}>
                    <div className="text-[10px] text-red-500 w-12 text-right pr-1 bg-slate-50 dark:bg-slate-900 font-bold tracking-tighter -mt-2.5">
                      {`${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`}
                    </div>
                    <div className="w-2 h-2 bg-red-500 rounded-full -ml-1" />
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Pie */}
        <div className="px-4 md:px-6 py-3.5 pb-safe md:pb-3.5 border-t border-slate-200 dark:border-slate-700 flex flex-col md:flex-row justify-between items-stretch md:items-center bg-slate-50 dark:bg-slate-900 gap-3 shrink-0">
          <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-slate-700 dark:text-slate-300">
            <input type="checkbox" checked={completed} onChange={(e) => setCompleted(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
            Ya está hecha
          </label>
          <div className="hidden md:flex items-center gap-2">
            <button onClick={onClose} className="h-10 px-4 border border-slate-300 dark:border-slate-600 rounded-lg font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm">Cancelar</button>
            <button onClick={handleSaveClick} className="h-10 px-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-sm">{initialData?.id ? "Guardar cambios" : "Guardar actividad"}</button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
