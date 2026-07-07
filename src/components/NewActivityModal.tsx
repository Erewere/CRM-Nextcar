import React, { useState, useRef, useEffect } from "react";
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
  const [syncToCalendar, setSyncToCalendar] = useState(false);
  const [clientStatus, setClientStatus] = useState("new");
  const [pipelineStages, setPipelineStages] = useState<
    { id: string; title: string }[]
  >([
    { id: "new", title: "Nuevos" },
    { id: "contacted", title: "Contactados" },
    { id: "negotiation", title: "Negociación" },
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

  const hours = Array.from({ length: 12 }, (_, i) => i + 12); // Simple 12:00 to 23:00

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex justify-center items-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 dark:border-slate-700">
          <h2 className="text-xl font-bold text-gray-800 dark:text-slate-200">
            {initialData ? "Editar actividad" : "Programar actividad"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:text-slate-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-col md:flex-row flex-1 overflow-y-auto md:overflow-hidden">
          {/* Left Column - Form */}
          <div className="w-full md:w-2/3 md:overflow-y-auto p-4 md:p-6 flex flex-col gap-6">
            {/* Title & Type */}
            <div>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full text-2xl font-medium border border-gray-300 rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none mb-3"
              />
              <div className="flex border border-gray-300 rounded w-fit overflow-hidden">
                {types.map((t) => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.id}
                      onClick={() => handleTypeSelect(t)}
                      className={clsx(
                        "p-2 border-r border-gray-300 last:border-r-0 hover:bg-gray-50 dark:bg-slate-900 transition-colors",
                        type === t.id
                          ? "bg-blue-50 text-blue-600"
                          : "text-gray-600 dark:text-slate-400",
                      )}
                      title={t.label}
                    >
                      <Icon className="w-4 h-4" />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Date & Time */}
            <div className="flex items-center gap-4">
              <Clock className="w-5 h-5 text-gray-500 dark:text-slate-400 flex-shrink-0" />
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="border border-gray-300 rounded p-1.5 text-sm w-32 focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <TimeSelect
                  value={startTime}
                  onChange={setStartTime}
                  placeholder="h:mm p.m."
                />
                <span className="text-gray-500 dark:text-slate-400">-</span>
                <TimeSelect
                  value={endTime}
                  onChange={setEndTime}
                  placeholder="h:mm p.m."
                />
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="border border-gray-300 rounded p-1.5 text-sm w-32 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            {/* Priority */}
            <div className="flex items-center gap-4">
              <CalendarIcon className="w-5 h-5 text-gray-500 dark:text-slate-400 flex-shrink-0" />
              <select className="border border-gray-300 rounded p-1.5 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none">
                <option>Prioridad</option>
                <option>Alta</option>
                <option>Media</option>
                <option>Baja</option>
              </select>
            </div>

            {/* Free/Busy */}
            <div className="flex items-center gap-4">
              <CalendarX className="w-5 h-5 text-gray-500 dark:text-slate-400 flex-shrink-0" />
              <select className="border border-gray-300 rounded p-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                <option>Ocupado</option>
                <option>Libre</option>
              </select>
            </div>

            {/* Notes */}
            <div className="flex gap-4">
              <FileText className="w-5 h-5 text-gray-500 dark:text-slate-400 flex-shrink-0 mt-2" />
              <div className="flex-1">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 bg-[#fff9db] p-3 min-h-[100px] outline-none focus:ring-2 focus:ring-blue-500"
                ></textarea>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                  Las notas son visibles dentro de Pipedrive, pero no para los
                  invitados al evento
                </p>
              </div>
            </div>

            {/* User */}
            <div className="flex items-center gap-4">
              <User className="w-5 h-5 text-gray-500 dark:text-slate-400 flex-shrink-0" />
              <select className="flex-1 border border-gray-300 rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                <option>{currentUser?.name || "Usuario"} (Tú)</option>
              </select>
            </div>

            {/* Links (Deal, Person, Org) */}
            <div className="flex gap-4">
              <LinkIcon className="w-5 h-5 text-gray-500 dark:text-slate-400 flex-shrink-0 mt-2" />
              <div className="flex-1 flex flex-col gap-2">
                <div className="relative">
                  <Briefcase className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={dealTitle}
                    onChange={(e) => handleDealChange(e.target.value)}
                    list="deal-options"
                    placeholder="Trato, prospecto o proyecto"
                    className="w-full border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 py-2 pl-9 pr-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <datalist id="deal-options">
                    {deals.map((d) => (
                      <option key={d.id} value={d.title} />
                    ))}
                  </datalist>
                </div>
                <div className="relative" ref={nameInputRef}>
                  <User className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={clientName}
                    autoComplete="off"
                    onChange={handleClientNameChange}
                    onFocus={() => setShowNameSuggestions(true)}
                    placeholder="Personas"
                    className="w-full border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 py-2 pl-9 pr-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  {showNameSuggestions && clientName && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-lg z-50 max-h-48 overflow-y-auto">
                      {clients.filter((p) =>
                        p.name
                          ?.toLowerCase()
                          .includes(clientName.toLowerCase()),
                      ).length > 0 ? (
                        clients
                          .filter((p) =>
                            p.name
                              ?.toLowerCase()
                              .includes(clientName.toLowerCase()),
                          )
                          .map((p) => (
                            <div
                              key={p.id}
                              className="px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                              onClick={() => handleSelectClient(p)}
                            >
                              <div className="font-medium text-slate-900 dark:text-slate-100">
                                {p.name}
                              </div>
                              {p.phone && (
                                <div className="text-xs text-slate-500">
                                  {p.phone}
                                </div>
                              )}
                            </div>
                          ))
                      ) : (
                        <div className="px-3 py-2 text-sm text-slate-500 italic">
                          No hay coincidencias (se guardará como nuevo)
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {!clientId && clientName && (
                  <div className="relative">
                    <Flag className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                    <select
                      value={clientStatus}
                      onChange={(e) => setClientStatus(e.target.value)}
                      className="w-full border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 py-2 pl-9 pr-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      {pipelineStages.map((stage) => (
                        <option key={stage.id} value={stage.id}>
                          Etapa inicial: {stage.title}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="relative">
                  <Building2 className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                    placeholder="Organización"
                    className="w-full border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 py-2 pl-9 pr-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Calendar Preview */}
          <div className="w-full md:w-1/3 bg-white dark:bg-slate-800 border-t md:border-t-0 md:border-l border-gray-200 dark:border-slate-700 flex flex-col min-h-[400px]">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-800 shadow-sm z-10">
              <span className="font-bold text-gray-800 dark:text-slate-200 text-sm">
                {format(previewDate, "EEEE, MMMM do", { locale: es })}
              </span>
              <div className="flex">
                <button
                  onClick={() => setPreviewDate(subDays(previewDate, 1))}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded text-gray-500 dark:text-slate-400"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPreviewDate(addDays(previewDate, 1))}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded text-gray-500 dark:text-slate-400"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div
              className="flex-1 overflow-y-auto relative"
              id="calendar-scroll-container"
            >
              {/* Actual tasks from props */}
              {tasks
                .filter(
                  (t) => t.task.dueDate === format(previewDate, "yyyy-MM-dd"),
                )
                .map((t) => {
                  const tStartHour = parseInt(
                    t.task.startTime?.split(":")[0] || "12",
                  );
                  const tStartMin = parseInt(
                    t.task.startTime?.split(":")[1] || "0",
                  );
                  let durationMins = 60;
                  if (t.task.endTime) {
                    const tEndHour = parseInt(
                      t.task.endTime.split(":")[0] || "13",
                    );
                    const tEndMin = parseInt(
                      t.task.endTime.split(":")[1] || "0",
                    );
                    durationMins =
                      tEndHour * 60 + tEndMin - (tStartHour * 60 + tStartMin);
                  }
                  if (durationMins <= 0) durationMins = 60;
                  const tTop = (tStartHour + tStartMin / 60) * 60;
                  const tHeight = (durationMins / 60) * 60;

                  return (
                    <div
                      key={t.task.id}
                      className="absolute left-12 right-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700/50 text-xs px-2 py-1 rounded z-0 flex flex-col gap-0.5 overflow-hidden opacity-60 pointer-events-none"
                      style={{ top: `${tTop}px`, height: `${tHeight}px` }}
                    >
                      <span className="font-bold line-clamp-1">
                        {t.task.title}
                      </span>
                      {tHeight > 30 && t.client && (
                        <span className="text-[10px] truncate">
                          {t.client.name}
                        </span>
                      )}
                    </div>
                  );
                })}

              {/* Event preview block for the current task being created/edited */}
              {(() => {
                const startH = parseInt(startTime.split(":")[0] || "0");
                const startM = parseInt(startTime.split(":")[1] || "0");
                let endH = parseInt(endTime.split(":")[0] || "-1");
                let endM = parseInt(endTime.split(":")[1] || "0");

                let durationMins = 60;
                if (endTime && endH * 60 + endM > startH * 60 + startM) {
                  durationMins = endH * 60 + endM - (startH * 60 + startM);
                }

                const topPx = (startH + startM / 60) * 60;
                const heightPx = (durationMins / 60) * 60;

                return (
                  <div
                    className="absolute left-12 right-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs px-2 py-1.5 rounded z-10 shadow-md border border-blue-500 overflow-hidden flex flex-col cursor-grab active:cursor-grabbing"
                    style={{
                      top: `${topPx}px`,
                      minHeight: "30px",
                      height: `${heightPx}px`,
                      touchAction: "none"
                    }}
                    id="current-task-preview"
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                  >
                    <div className="flex items-center gap-1 font-bold">
                      {type === "call" && (
                        <Phone className="w-3 h-3 shrink-0" />
                      )}
                      {type === "meeting" && (
                        <Users className="w-3 h-3 shrink-0" />
                      )}
                      {type === "task" && (
                        <Check className="w-3 h-3 shrink-0" />
                      )}
                      {type === "deadline" && (
                        <Flag className="w-3 h-3 shrink-0" />
                      )}
                      {type === "email" && (
                        <Mail className="w-3 h-3 shrink-0" />
                      )}
                      {type === "lunch" && (
                        <Coffee className="w-3 h-3 shrink-0" />
                      )}
                      <span className="truncate">
                        {title || "Nueva actividad"}
                      </span>
                    </div>
                  </div>
                );
              })()}

              {hours.map((hour, i) => (
                <div
                  key={hour}
                  className="flex h-[60px] border-b border-gray-100 dark:border-slate-700 last:border-b-0 group"
                >
                  <div className="w-12 text-right pr-2 py-1 text-xs text-gray-400 font-medium">
                    {hour}:00
                  </div>
                  <div className="flex-1 border-l border-gray-200 dark:border-slate-700 relative">
                    <div className="hidden group-hover:block absolute inset-0 bg-blue-50/50"></div>
                  </div>
                </div>
              ))}

              {/* Current time line */}
              {(() => {
                const now = new Date();
                // Only show if previewDate is today
                if (
                  format(now, "yyyy-MM-dd") !==
                  format(previewDate, "yyyy-MM-dd")
                )
                  return null;
                const nowH = now.getHours();
                const nowM = now.getMinutes();
                const nowTop = (nowH + nowM / 60) * 60;

                return (
                  <div
                    className="absolute left-0 right-0 border-t border-red-500 z-20 flex items-center pointer-events-none"
                    style={{ top: `${nowTop}px` }}
                  >
                    <div className="text-[10px] text-red-500 w-12 text-right pr-1 bg-white dark:bg-slate-800 font-bold tracking-tighter -mt-2.5">
                      {`${nowH.toString().padStart(2, "0")}:${nowM.toString().padStart(2, "0")}`}
                    </div>
                    <div className="w-2 h-2 bg-red-500 rounded-full -ml-1"></div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-slate-700 flex justify-between items-center bg-gray-50 dark:bg-slate-900">
          <div className="flex items-center gap-4">
            <button className="p-2 border border-gray-300 rounded hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-600 dark:text-slate-400">
              <Settings className="w-5 h-5" />
            </button>
            <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={syncToCalendar}
                onChange={(e) => setSyncToCalendar(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 dark:border-slate-600 dark:bg-slate-700 bg-white dark:checked:bg-blue-500 text-blue-600 focus:ring-blue-500"
              />
              <CalendarIcon className="w-4 h-4" /> Sincronizar con Google (Calendar / Tasks)
            </label>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={completed}
                onChange={(e) => setCompleted(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 dark:border-slate-600 dark:bg-slate-700 bg-white dark:checked:bg-blue-500 text-green-600 focus:ring-green-500"
              />
              Marcar como completa
            </label>
            <button
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded font-bold text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 text-sm"
            >
              Cancelar
            </button>
            <button
              onClick={() => {
                const existingDeal = deals.find(
                  (d) =>
                    String(d.title || "").toLowerCase() ===
                    dealTitle.toLowerCase(),
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
                });
              }}
              className="px-6 py-2 bg-[#2E914F] hover:bg-[#257A41] text-white rounded font-bold text-sm"
            >
              Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
