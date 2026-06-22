import React, { useState, useRef, useEffect } from 'react';
import { 
  X, Phone, Users, Clock, Flag, Mail, Coffee, 
  Calendar as CalendarIcon, FileText, User, Link as LinkIcon, Settings, 
  Building2, Briefcase, ChevronRight, ChevronLeft, CalendarX, Check, Car, PenTool
} from 'lucide-react';
import clsx from 'clsx';
import { Client } from '../types';
import { format, addDays, subDays } from 'date-fns';
import { es } from 'date-fns/locale';

function TimeSelect({ value, onChange, placeholder }: { value: string, onChange: (v: string) => void, placeholder: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const timeOptions = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      const period = h < 12 ? 'a.m.' : 'p.m.';
      const displayH = h === 0 ? 12 : (h > 12 ? h - 12 : h);
      const displayM = m === 0 ? '00' : m;
      const val = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      const label = `${displayH}:${displayM} ${period.padStart(4, ' ')}`;
      timeOptions.push({ value: val, label });
    }
  }

  const selectedOption = timeOptions.find(o => o.value === value);

  useEffect(() => {
    if (isOpen && containerRef.current) {
       const activeEl = containerRef.current.querySelector('.active-time-option');
       if (activeEl) {
         activeEl.scrollIntoView({ block: 'center' });
       }
    }
  }, [isOpen]);

  return (
    <div className="relative" ref={containerRef}>
      <div 
        className={clsx(
          "flex items-center justify-between border rounded p-1.5 text-sm w-[110px] bg-white dark:bg-slate-800 cursor-pointer transition-colors",
          isOpen ? "border-blue-500 ring-1 ring-blue-500" : "border-gray-300 hover:border-gray-400"
        )}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={clsx(selectedOption ? "text-gray-900 dark:text-slate-100" : "text-gray-400")}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        {selectedOption ? (
          <button 
            type="button" 
            onClick={(e) => { e.stopPropagation(); onChange(''); }}
            className="text-gray-400 hover:text-gray-600 dark:text-slate-400 focus:outline-none"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : (
          <div className="w-3.5 h-3.5" />
        )}
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-[120px] max-h-60 overflow-y-auto bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded shadow-lg z-50 py-1">
          {timeOptions.map((option) => {
            const isActive = value === option.value;
            return (
              <div
                key={option.value}
                className={clsx(
                  "px-3 py-2 text-sm cursor-pointer flex justify-between items-center transition-colors",
                  isActive ? "bg-blue-600 text-white active-time-option" : "text-gray-700 dark:text-slate-300 hover:bg-blue-50 hover:text-blue-600"
                )}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
              >
                {option.label}
                {isActive && <Check className="w-4 h-4 ml-2 flex-shrink-0" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface NewActivityModalProps {
  onClose: () => void;
  onSave: (taskData: any) => void;
  clients: Client[];
  deals?: any[];
  currentUser: any;
}

export function NewActivityModal({ onClose, onSave, clients, deals = [], currentUser }: NewActivityModalProps) {
  const [type, setType] = useState('call');
  const [title, setTitle] = useState('Llamada');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [startTime, setStartTime] = useState('12:15');
  const [endTime, setEndTime] = useState('');
  const [notes, setNotes] = useState('');
  const [clientId, setClientId] = useState('');
  const [dealTitle, setDealTitle] = useState('');
  const [organization, setOrganization] = useState('');
  const [completed, setCompleted] = useState(false);
  const [syncToCalendar, setSyncToCalendar] = useState(false);
  const [previewDate, setPreviewDate] = useState(new Date());

  // Handle deal selection logic
  const handleDealChange = (val: string) => {
    setDealTitle(val);
    const existingDeal = deals.find(d => d.title.toLowerCase() === val.toLowerCase());
    if (existingDeal) {
      if (existingDeal.clientId) {
        setClientId(existingDeal.clientId);
        const person = clients.find(c => c.id === existingDeal.clientId);
        if (person && person.organization) {
          setOrganization(person.organization);
        }
      }
    }
  };

  const handleClientChange = (val: string) => {
    setClientId(val);
    const person = clients.find(c => c.id === val);
    if (person && person.organization) {
      setOrganization(person.organization);
    }
  };

  const types = [
    { id: 'call', icon: Phone, label: 'Llamada' },
    { id: 'appointment', icon: User, label: 'Cita' },
    { id: 'test_drive', icon: Car, label: 'Prueba de manejo' },
    { id: 'signature', icon: PenTool, label: 'Firma' },
    { id: 'task', icon: Clock, label: 'Tarea' }
  ];

  const handleTypeSelect = (t: any) => {
    setType(t.id);
    if (!title || types.some(x => x.label === title)) {
      setTitle(t.label);
    }
  };

  const hours = Array.from({ length: 12 }, (_, i) => i + 12); // Simple 12:00 to 23:00

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex justify-center items-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 dark:border-slate-700">
          <h2 className="text-xl font-bold text-gray-800 dark:text-slate-200">Schedule an activity</h2>
          <button onClick={onClose} className="text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:text-slate-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Column - Form */}
          <div className="w-2/3 overflow-y-auto p-6 flex flex-col gap-6">
            
            {/* Title & Type */}
            <div>
              <input 
                type="text" 
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full text-2xl font-medium border border-gray-300 rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none mb-3"
              />
              <div className="flex border border-gray-300 rounded w-fit overflow-hidden">
                {types.map(t => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.id}
                      onClick={() => handleTypeSelect(t)}
                      className={clsx(
                        "p-2 border-r border-gray-300 last:border-r-0 hover:bg-gray-50 dark:bg-slate-900 transition-colors",
                        type === t.id ? "bg-blue-50 text-blue-600" : "text-gray-600 dark:text-slate-400"
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
                  onChange={e => setDate(e.target.value)}
                  className="border border-gray-300 rounded p-1.5 text-sm w-32 focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <TimeSelect value={startTime} onChange={setStartTime} placeholder="h:mm p.m." />
                <span className="text-gray-500 dark:text-slate-400">-</span>
                <TimeSelect value={endTime} onChange={setEndTime} placeholder="h:mm p.m." />
                <input 
                  type="date" 
                  value={date}
                  onChange={e => setDate(e.target.value)}
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
                  onChange={e => setNotes(e.target.value)}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 bg-[#fff9db] p-3 min-h-[100px] outline-none focus:ring-2 focus:ring-blue-500"
                ></textarea>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">Las notas son visibles dentro de Pipedrive, pero no para los invitados al evento</p>
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
                    onChange={e => handleDealChange(e.target.value)}
                    list="deal-options"
                    placeholder="Trato, prospecto o proyecto" 
                    className="w-full border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 py-2 pl-9 pr-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                  />
                  <datalist id="deal-options">
                    {deals.map(d => <option key={d.id} value={d.title} />)}
                  </datalist>
                </div>
                <div className="relative">
                  <User className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                  <select 
                    value={clientId}
                    onChange={e => handleClientChange(e.target.value)}
                    className="w-full border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 py-2 pl-9 pr-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                  >
                    <option value="" disabled hidden>Personas</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                  <input 
                    type="text" 
                    value={organization}
                    onChange={e => setOrganization(e.target.value)}
                    placeholder="Organización" 
                    className="w-full border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 py-2 pl-9 pr-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                  />
                </div>
              </div>
            </div>
            
          </div>

          {/* Right Column - Calendar Preview */}
          <div className="w-1/3 bg-white dark:bg-slate-800 border-l border-gray-200 dark:border-slate-700 flex flex-col">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-800 shadow-sm z-10">
              <span className="font-bold text-gray-800 dark:text-slate-200 text-sm">
                {format(previewDate, "EEEE, MMMM do", { locale: es })}
              </span>
              <div className="flex">
                <button onClick={() => setPreviewDate(subDays(previewDate, 1))} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded text-gray-500 dark:text-slate-400"><ChevronLeft className="w-4 h-4" /></button>
                <button onClick={() => setPreviewDate(addDays(previewDate, 1))} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded text-gray-500 dark:text-slate-400"><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto relative">
              
              {/* Event preview block */}
              <div className="absolute top-[30px] left-12 right-2 bg-blue-600 text-white text-xs font-bold px-2 py-1.5 rounded z-10 flex items-center gap-1 shadow-sm">
                <Phone className="w-3 h-3" /> Llamada
              </div>

              {hours.map((hour, i) => (
                <div key={hour} className="flex h-[60px] border-b border-gray-100 dark:border-slate-700 last:border-b-0 group">
                  <div className="w-12 text-right pr-2 py-1 text-xs text-gray-400 font-medium">{hour}:00</div>
                  <div className="flex-1 border-l border-gray-200 dark:border-slate-700 relative">
                    <div className="hidden group-hover:block absolute inset-0 bg-blue-50/50"></div>
                  </div>
                </div>
              ))}
              
              {/* Current time line mock */}
              <div className="absolute top-[280px] left-0 right-0 border-t border-red-500 z-20 flex items-center">
                <div className="text-[10px] text-red-500 w-12 text-right pr-1 bg-white dark:bg-slate-800 font-bold tracking-tighter -mt-2">23:05</div>
                <div className="w-2 h-2 bg-red-500 rounded-full -ml-1"></div>
              </div>
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
                onChange={e => setSyncToCalendar(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 dark:border-slate-600 dark:bg-slate-700 bg-white dark:checked:bg-blue-500 text-blue-600 focus:ring-blue-500" 
              />
              <CalendarIcon className="w-4 h-4" /> Sincronizar en Calendar
            </label>
          </div>
          
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-700 dark:text-slate-300">
              <input 
                type="checkbox" 
                checked={completed}
                onChange={e => setCompleted(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 dark:border-slate-600 dark:bg-slate-700 bg-white dark:checked:bg-blue-500 text-green-600 focus:ring-green-500" 
              />
              Marcar como completa
            </label>
            <button onClick={onClose} className="px-6 py-2 border border-gray-300 rounded font-bold text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 text-sm">
              Cancelar
            </button>
            <button 
              onClick={() => {
                const existingDeal = deals.find(d => d.title.toLowerCase() === dealTitle.toLowerCase());
                onSave({
                  title,
                  type,
                  dueDate: date,
                  startTime,
                  endTime,
                  clientId,
                  dealId: existingDeal?.id || '',
                  dealTitle,
                  organization,
                  notes,
                  completed,
                  syncToCalendar
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
