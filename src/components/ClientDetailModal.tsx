import React, { useState, useEffect, useRef } from "react";
import imageCompression from "browser-image-compression";
import { Client, Task, ClientFile, Vehicle } from "../types";
import { getClientMatches } from "../pages/Persons";
import { useAuth } from "../contexts/AuthContext";
import { db, storage } from "../lib/firebase";
import {
  doc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  orderBy,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import {
  X,
  FileText,
  Upload,
  Calendar,
  CheckSquare,
  Phone,
  MessageCircle,
  MoreHorizontal,
  User,
  Tag,
  Clock,
  Building2,
  Eye,
  Users,
  Edit2, Target, Calculator,
} from "lucide-react";
import clsx from "clsx";
import { TimeSelect } from "./TimeSelect";
import { DealWonModal } from "./DealWonModal";
import { PaymentModal } from "./PaymentModal";
import { createPaymentTasks } from "../lib/paymentTasks";

interface Props {
  client: Client | Partial<Client>;
  initialStatus?: string;
  onClose: () => void;
}

export function ClientDetailModal({
  client,
  initialStatus = "new",
  onClose,
}: Props) {
  const { userData } = useAuth();
  const isNew = !client.id;
  const [showDealWonModal, setShowDealWonModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [formData, setFormData] = useState<Partial<Client>>(
    isNew
      ? {
          status: initialStatus,
          origin: "manual",
          agencyId: userData?.agencyId,
          sellerId: userData?.id,
          tags: [],
        }
      : { tags: [], ...client },
  );
  const [tasks, setTasks] = useState<Task[]>([]);
  const [files, setFiles] = useState<ClientFile[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [inventoryVehicles, setInventoryVehicles] = useState<Vehicle[]>([]);
  const [agencyUsers, setAgencyUsers] = useState<any[]>([]);

  useEffect(() => {
    if (!userData?.agencyId) return;
    const loadUsers = async () => {
      const q = query(
        collection(db, "users"),
        where("agencyId", "==", userData.agencyId),
      );
      const s = await getDocs(q);
      setAgencyUsers(s.docs.map((d) => ({ id: d.id, ...d.data() })));
    };
    loadUsers();
  }, [userData?.agencyId]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);

  useEffect(() => {
    if (!userData) return;
    const fetchAvailableTags = async () => {
      const agencyId = userData?.agencyId || "master_agency";
      try {
        const q = query(
          collection(db, "agency_tags"),
          where("agencyId", "==", agencyId),
        );
        const snap = await getDocs(q);
        if (snap.empty) {
          setAvailableTags(["Venta", "Compra", "Busca de auto", "Crédito"]);
        } else {
          setAvailableTags(
            Array.from(
              new Set(snap.docs.map((doc) => doc.data().name).filter(Boolean)),
            ),
          );
        }
      } catch (err) {
        console.error("Error loading tags:", err);
        setAvailableTags(["Venta", "Compra", "Busca de auto", "Crédito"]);
      }
    };
    fetchAvailableTags();
  }, [userData]);

  const handleTagToggle = (tag: string) => {
    setFormData((prev) => {
      const currentTags = prev.tags || [];
      const updatedTags = currentTags.includes(tag)
        ? currentTags.filter((t) => t !== tag)
        : [...currentTags, tag];
      return { ...prev, tags: updatedTags };
    });
  };

  const [activeTab, setActiveTab] = useState<"activity" | "notes" | "files">(
    "activity",
  );
  const [showFullAddress, setShowFullAddress] = useState(
    !!(client.street || client.exteriorNumber || client.neighborhood || client.city || client.zipCode)
  );
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDate, setNewTaskDate] = useState("");
  const getDefaultTime = () => {
    const now = new Date();
    let mins = now.getMinutes();
    let hrs = now.getHours();
    mins = Math.ceil(mins / 15) * 15;
    if (mins === 60) {
      mins = 0;
      hrs += 1;
    }
    hrs = hrs % 24;
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
  };

  const [newTaskTime, setNewTaskTime] = useState(getDefaultTime());
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [newNoteContent, setNewNoteContent] = useState("");
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
    if (userData?.agencyId) {
      import("firebase/firestore").then(({ doc, getDoc }) => {
        getDoc(doc(db, "agencies", userData.agencyId as string))
          .then((docSnap) => {
            if (docSnap.exists()) {
              const data = docSnap.data();
              if (
                data.pipelineStages &&
                Array.isArray(data.pipelineStages) &&
                data.pipelineStages.length > 0
              ) {
                setPipelineStages(data.pipelineStages);
                setFormData((prev) => {
                  if (isNew && prev.status === "new") {
                    return { ...prev, status: data.pipelineStages[0].id };
                  }
                  return prev;
                });
              }
            }
          })
          .catch(console.error);
      });
    }
  }, [userData?.agencyId, isNew]);

  useEffect(() => {
    if (userData?.agencyId) {
      const q = query(
        collection(db, "vehicles"),
        where("agencyId", "==", userData.agencyId),
        where("status", "==", "available"),
      );
      getDocs(q)
        .then((snap) => {
          setInventoryVehicles(
            snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Vehicle),
          );
        })
        .catch(console.error);
    } else if (userData?.role === "master") {
      const q = query(
        collection(db, "vehicles"),
        where("status", "==", "available"),
      );
      getDocs(q)
        .then((snap) => {
          setInventoryVehicles(
            snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Vehicle),
          );
        })
        .catch(console.error);
    }
  }, [userData]);

  useEffect(() => {
    if (isNew) return;
    // Load tasks
    const loadTasks = async () => {
      let q = query(
        collection(db, "tasks"),
        where("clientId", "==", client.id),
      );
      if (userData?.role === "seller") {
        q = query(
          collection(db, "tasks"),
          where("clientId", "==", client.id),
          where("sellerId", "==", userData.id),
        );
      }
      const s = await getDocs(q);
      const t = s.docs.map((d) => ({ id: d.id, ...d.data() }) as Task);
      t.sort(
        (a, b) =>
          new Date(b.createdAt as string).getTime() -
          new Date(a.createdAt as string).getTime(),
      );
      setTasks(t);
    };
    // Load files
    const loadFiles = async () => {
      const q = query(
        collection(db, "files"),
        where("clientId", "==", client.id),
      );
      const s = await getDocs(q);
      const f = s.docs.map((d) => ({ id: d.id, ...d.data() }) as ClientFile);
      f.sort(
        (a, b) =>
          new Date(b.uploadedAt as string).getTime() -
          new Date(a.uploadedAt as string).getTime(),
      );
      setFiles(f);
    };
    // Load notes
    const loadNotes = async () => {
      const q = query(
        collection(db, "notes"),
        where("clientId", "==", client.id),
      );
      const s = await getDocs(q);
      const n = s.docs.map((d) => ({ id: d.id, ...d.data() }) as any);
      n.sort(
        (a, b) =>
          new Date(b.createdAt as string).getTime() -
          new Date(a.createdAt as string).getTime(),
      );
      setNotes(n);
    };
    loadTasks();
    loadFiles();
    loadNotes();
  }, [client.id, isNew]);

  const [existingPersons, setExistingPersons] = useState<Client[]>([]);
  const [showNameSuggestions, setShowNameSuggestions] = useState(false);
  const [showPhoneSuggestions, setShowPhoneSuggestions] = useState(false);
  const nameInputRef = useRef<HTMLDivElement>(null);
  const phoneInputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        nameInputRef.current &&
        !nameInputRef.current.contains(e.target as Node)
      ) {
        setShowNameSuggestions(false);
      }
      if (
        phoneInputRef.current &&
        !phoneInputRef.current.contains(e.target as Node)
      ) {
        setShowPhoneSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (userData?.agencyId && isNew) {
      const fetchPersons = async () => {
        let q = query(
          collection(db, "clients"),
          where("agencyId", "==", userData.agencyId),
        );
        if (userData.role === "seller") {
          q = query(
            collection(db, "clients"),
            where("agencyId", "==", userData.agencyId),
            where("sellerId", "==", userData.id),
          );
        }
        try {
          const snap = await getDocs(q);
          setExistingPersons(
            snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Client),
          );
        } catch (e) {
          console.error(e);
        }
      };
      fetchPersons();
    }
  }, [userData, isNew]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, name: e.target.value }));
    setShowNameSuggestions(true);
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, phone: e.target.value }));
    setShowPhoneSuggestions(true);
  };

  const handleSelectPerson = (person: Client) => {
    setFormData((prev) => ({
      ...prev,
      name: person.name,
      email: person.email || prev.email,
      phone: person.phone || prev.phone,
      organization: person.organization || prev.organization,
      address: person.address || prev.address,
    }));
    setShowNameSuggestions(false);
    setShowPhoneSuggestions(false);
  };

  const handleStatusChange = async (newStatus: string) => {
    if (newStatus === "won") {
      setShowDealWonModal(true);
      return;
    }

    setFormData((prev) => {
      const updates: Partial<Client> = { status: newStatus };
      return { ...prev, ...updates };
    });

    if (!isNew && client.id) {
      try {
        const updates: any = {
          status: newStatus,
          updatedAt: new Date().toISOString(),
        };
        await updateDoc(doc(db, "clients", client.id as string), updates);
      } catch (err) {
        console.error("Error updating status:", err);
      }
    }
  };

  const handleDealWonConfirm = async (saleDetails: any) => {
    setShowDealWonModal(false);
    
    setFormData((prev) => {
      const updates: Partial<Client> = { 
        status: "won",
        soldAt: new Date().toISOString().split('T')[0],
        saleDetails 
      };
      return { ...prev, ...updates };
    });

    if (!isNew && client.id) {
      try {
        const updates: any = {
          status: "won",
          soldAt: new Date().toISOString().split('T')[0],
          saleDetails,
          updatedAt: new Date().toISOString(),
        };
        await updateDoc(doc(db, "clients", client.id as string), updates);
        
        if (formData.vehicleId) {
          await updateDoc(doc(db, "vehicles", formData.vehicleId), {
            pendingValidation: {
              type: "sold",
              requestedBy: userData?.id,
              requestedByName: userData?.name || userData?.email,
              clientId: client.id,
              clientName: client.name || formData.name,
              requestedAt: new Date().toISOString(),
            },
          });
        }
        
        await createPaymentTasks(db, {...client, ...formData}, saleDetails, userData);
      } catch (err) {
        console.error("Error updating status:", err);
      }
    }
  };
  
  const handlePaymentConfirm = async (payment: any) => {
    setShowPaymentModal(false);
    if (!formData.saleDetails) return;
    
    const newPayment = {
      ...payment,
      id: Math.random().toString(36).substr(2, 9)
    };
    
    const updatedSaleDetails = {
      ...formData.saleDetails,
      payments: [...(formData.saleDetails.payments || []), newPayment]
    };
    
    setFormData(prev => ({
      ...prev,
      saleDetails: updatedSaleDetails
    }));
    
    if (!isNew && client.id) {
      try {
        await updateDoc(doc(db, "clients", client.id as string), {
          saleDetails: updatedSaleDetails,
          updatedAt: new Date().toISOString()
        });
      } catch (err) {
        console.error("Error saving payment", err);
      }
    }
  };

  const [showWantedVehicleMenu, setShowWantedVehicleMenu] = useState(false);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!userData || !formData.agencyId || formData.agencyId === "unassigned") {
      alert("Debes pertenecer a una agencia para guardar clientes.");
      return;
    }

    const hasBuscaAutoTag = formData.tags?.some(t => 
      t.toLowerCase().includes('busca de auto') || 
      t.toLowerCase().includes('busca auto') ||
      t.toLowerCase().includes('buscan auto') ||
      t.toLowerCase().includes('compra')
    );

    // Intercept to show the Wanted Vehicle form if needed
    if (hasBuscaAutoTag && !showWantedVehicleMenu && (!formData.wantedVehicle || !formData.wantedVehicle.make)) {
      setShowWantedVehicleMenu(true);
      return;
    }

    let finalFormData = { ...formData };
    if (!hasBuscaAutoTag) {
      finalFormData.wantedVehicle = null as any;
    }

    if (showFullAddress) {
      const parts = [finalFormData.street, finalFormData.exteriorNumber, finalFormData.neighborhood, finalFormData.city, finalFormData.zipCode].filter(Boolean);
      if (parts.length > 0) {
         finalFormData.address = parts.join(", ");
      }
    } else {
      // If using single field, we don't clear the parts, just in case they have them, but the main `address` is what matters.
    }

    try {
      if (isNew) {
        const newRef = doc(collection(db, "clients"));
        const dataToSave = {
          ...finalFormData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        Object.keys(dataToSave).forEach(
          (k) =>
            dataToSave[k as keyof typeof dataToSave] === undefined &&
            delete dataToSave[k as keyof typeof dataToSave],
        );
        await setDoc(newRef, dataToSave);
      } else {
        const dataToUpdate = {
          ...finalFormData,
          updatedAt: new Date().toISOString(),
        };
        Object.keys(dataToUpdate).forEach(
          (k) =>
            dataToUpdate[k as keyof typeof dataToUpdate] === undefined &&
            delete dataToUpdate[k as keyof typeof dataToUpdate],
        );
        await updateDoc(doc(db, "clients", client.id as string), dataToUpdate);
      }
      onClose();
    } catch (err) {
      console.error(err);
      alert("Error guardando cliente");
    }
  };

  const handleAddTask = async () => {
    if (isNew) return;
    if (!newTaskTitle) {
      alert("El título de la tarea es requerido.");
      return;
    }
    if (!newTaskDate) {
      alert("La fecha de la tarea es requerida.");
      return;
    }
    
    // Use the raw HH:mm time
    let formattedTime = newTaskTime || "";

    if (editingTaskId) {
      const taskRef = doc(db, "tasks", editingTaskId);
      const updates: Partial<Task> = {
        title: newTaskTitle,
        dueDate: newTaskDate,
        updatedAt: new Date().toISOString(),
      };
      
      if (formattedTime) {
        updates.startTime = formattedTime;
      } else {
        updates.startTime = ""; // clear if empty
      }
      
      await updateDoc(taskRef, updates as any);
      setTasks(prev => prev.map(t => t.id === editingTaskId ? { ...t, ...updates } : t));
      setEditingTaskId(null);
    } else {
      const newRef = doc(collection(db, "tasks"));
      const t: Partial<Task> = {
        agencyId: userData?.agencyId,
        sellerId: userData?.id,
        clientId: client.id,
        title: newTaskTitle,
        dueDate: newTaskDate,
        completed: false,
        createdAt: new Date().toISOString(),
      };
      if (formattedTime) {
        t.startTime = formattedTime;
      }
      await setDoc(newRef, t);
      setTasks((prev) => [{ id: newRef.id, ...t } as Task, ...prev]);
    }

    setNewTaskTitle("");
    setNewTaskDate("");
    setNewTaskTime(getDefaultTime());
  };

  const handleEditTaskClick = (task: Task) => {
    setActiveTab("activity");
    setEditingTaskId(task.id);
    setNewTaskTitle(task.title);
    setNewTaskDate(task.dueDate);
    
    // Convert h:mm a.m. back to HH:mm for the input
    if (task.startTime) {
      try {
        const timeRegex = /(\d+):(\d+)\s*(a\.m\.|p\.m\.|am|pm)/i;
        const match = task.startTime.match(timeRegex);
        if (match) {
          let [ , hStr, m, p] = match;
          let h = parseInt(hStr, 10);
          if (p.toLowerCase().includes("p") && h < 12) h += 12;
          if (p.toLowerCase().includes("a") && h === 12) h = 0;
          setNewTaskTime(`${h.toString().padStart(2, "0")}:${m}`);
        } else {
          setNewTaskTime(task.startTime);
        }
      } catch (e) {
        setNewTaskTime(task.startTime);
      }
    } else {
      setNewTaskTime(getDefaultTime());
    }
  };

  const cancelEditTask = () => {
    setEditingTaskId(null);
    setNewTaskTitle("");
    setNewTaskDate("");
    setNewTaskTime(getDefaultTime());
  };

  const handleAddNote = async () => {
    if (!newNoteContent || isNew) return;
    const newRef = doc(collection(db, "notes"));
    const n = {
      agencyId: userData?.agencyId,
      sellerId: userData?.id,
      clientId: client.id,
      content: newNoteContent,
      createdAt: new Date().toISOString(),
    };
    await setDoc(newRef, n);
    setNotes((prev) => [{ id: newRef.id, ...n }, ...prev]);
    setNewNoteContent("");
  };

  const toggleTaskCompletion = async (task: Task) => {
    try {
      await updateDoc(doc(db, "tasks", task.id as string), {
        completed: !task.completed,
      });
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id ? { ...t, completed: !task.completed } : t,
        ),
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || isNew) return;
    if (!userData?.agencyId || userData.agencyId === "unassigned") {
      alert("Debes pertenecer a una agencia para subir archivos.");
      return;
    }
    const file = e.target.files[0];
    let fileToUpload = file;

    if (file.type.startsWith("image/")) {
      const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
      };
      fileToUpload = await imageCompression(file, options);
    }

    const newRef = doc(collection(db, "files"));
    const storageRef = ref(
      storage,
      `users/${userData?.id}/clients/${client.id}/${fileToUpload.name}`,
    );
    await uploadBytes(storageRef, fileToUpload);
    const url = await getDownloadURL(storageRef);
    const f: Partial<ClientFile> = {
      agencyId: userData?.agencyId,
      clientId: client.id,
      userId: userData?.id,
      filename: fileToUpload.name,
      url,
      uploadedAt: new Date().toISOString(),
    };
    await setDoc(newRef, f);
    setFiles((prev) => [{ id: newRef.id, ...f } as ClientFile, ...prev]);
  };

  const pendingTasks = tasks.filter((t) => !t.completed);
  const completedTasks = tasks.filter((t) => t.completed);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-2 sm:p-4">
      <div className="bg-white dark:bg-slate-800 w-full max-w-6xl h-[95vh] rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* TOP HEADER */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 bg-white dark:bg-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flexitems-center justify-center text-blue-700 font-bold text-lg flex items-center">
              {String(formData.name || "U")
                .charAt(0)
                .toUpperCase()}
            </div>
            <div className="flex-1 min-w-[200px]">
              <input
                name={formData.dealTitle || isNew ? "dealTitle" : "name"}
                value={formData.dealTitle || formData.name || ""}
                onChange={(e) => {
                  if (formData.dealTitle || isNew) {
                    handleChange(e); // Updates dealTitle
                  } else {
                    handleChange({ target: { name: 'name', value: e.target.value } } as any); // Updates name if no deal
                  }
                }}
                placeholder={isNew ? "Nuevo Trato" : "Nombre"}
                className="text-xl font-bold text-gray-900 dark:text-slate-100 leading-tight w-full bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-600 focus:outline-none"
              />
              
              {(formData.dealTitle || isNew) && (
                <div className="flex items-center mt-1">
                  <span className="text-gray-500 font-medium mr-1">$</span>
                  <input
                    type="number"
                    name="dealValue"
                    value={formData.dealValue !== undefined ? formData.dealValue : ""}
                    onChange={handleChange}
                    placeholder="Monto"
                    className="w-24 text-sm bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-600 focus:outline-none text-gray-700 dark:text-slate-300"
                  />
                </div>
              )}
              
              {formData.status === "won" ? (
                <p
                  className="text-sm border inline-block px-2 py-0.5 rounded mt-0.5 font-medium border-green-200 bg-green-50 text-green-700"
                >
                  Ganado
                </p>
              ) : (
                <select
                  name="status"
                  value={formData.status || ""}
                  onChange={(e) => {
                    const newStatus = e.target.value;
                    setFormData((prev) => {
                      const updates: any = {
                        status: newStatus,
                        dealTitle: prev.dealTitle || (prev.name ? `${prev.name} deal` : "Nuevo Trato"),
                      };
                      if (newStatus === "won" && !prev.soldAt) {
                        updates.soldAt = new Date().toISOString().split('T')[0];
                      }
                      return { ...prev, ...updates };
                    });
                  }}
                  className="mt-1 block text-sm border-gray-300 dark:border-slate-600 dark:bg-slate-700 bg-white rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  {!formData.dealTitle && !isNew && (
                    <option value="" disabled>Contacto sin trato activo</option>
                  )}
                  {pipelineStages.map((stage) => (
                    <option key={stage.id} value={stage.id}>
                      {stage.id === "lost" ? "Contacto" : stage.title}
                    </option>
                  ))}
                </select>
              )}
              {formData.status === 'won' && (
                <div className="mt-2 flex items-center gap-2">
                  <label className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase whitespace-nowrap">
                    Fecha Venta
                  </label>
                  <input
                    type="date"
                    value={formData.soldAt || ''}
                    onChange={(e) => setFormData(p => ({ ...p, soldAt: e.target.value }))}
                    className="block text-sm border-gray-300 dark:border-slate-600 dark:bg-slate-700 bg-white rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>
          </div>
          
          
              {formData.saleDetails && (
                <div className="mt-6 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/50">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="text-sm font-bold text-emerald-800 dark:text-emerald-400 flex items-center gap-2">
                      <Calculator className="w-4 h-4" />
                      Detalles de Venta
                    </h4>
                    {formData.saleDetails.method === 'contado' && (
                      <button
                        type="button"
                        onClick={() => setShowPaymentModal(true)}
                        className="text-xs px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded shadow-sm"
                      >
                        + Registrar Pago
                      </button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Método</p>
                      <p className="font-semibold text-slate-800 dark:text-slate-200 capitalize">
                        {formData.saleDetails.method.replace('_', ' ')}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Precio de Venta</p>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">
                        {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(formData.saleDetails.price)}
                      </p>
                    </div>
                    {formData.saleDetails.method === 'credito' && (
                      <>
                        <div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Enganche</p>
                          <p className="font-semibold text-slate-800 dark:text-slate-200">
                            {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(formData.saleDetails.downPayment || 0)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Plazo / Tasa</p>
                          <p className="font-semibold text-slate-800 dark:text-slate-200">
                            {formData.saleDetails.termMonths} meses @ {formData.saleDetails.interestRate}% ({formData.saleDetails.interestType})
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Total a Pagar</p>
                          <p className="font-semibold text-emerald-700 dark:text-emerald-400">
                            {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(formData.saleDetails.calculatedTotalAmount || 0)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Mensualidad</p>
                          <p className="font-semibold text-emerald-700 dark:text-emerald-400">
                            {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(formData.saleDetails.calculatedMonthlyPayment || 0)}
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                  
                  {formData.saleDetails.method === 'contado' && (
                    <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-emerald-100 dark:border-emerald-800/50">
                      <h5 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 border-b border-slate-100 dark:border-slate-700 pb-1">
                        Historial de Pagos
                      </h5>
                      {formData.saleDetails.payments && formData.saleDetails.payments.length > 0 ? (
                        <div className="space-y-2">
                          {formData.saleDetails.payments.map(payment => (
                            <div key={payment.id} className="flex justify-between items-center text-xs">
                              <div>
                                <span className="font-semibold text-slate-800 dark:text-slate-200">
                                  {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(payment.amount)}
                                </span>
                                <span className="text-slate-500 dark:text-slate-400 ml-2">
                                  • {new Date(payment.date + "T00:00:00").toLocaleDateString('es-MX', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </span>
                                <span className="text-slate-400 ml-2 capitalize">
                                  ({payment.method})
                                </span>
                              </div>
                            </div>
                          ))}
                          <div className="flex justify-between items-center text-xs font-bold pt-2 border-t border-slate-100 dark:border-slate-700">
                            <span className="text-slate-600 dark:text-slate-400">Restante</span>
                            <span className={formData.saleDetails.price - formData.saleDetails.payments.reduce((a, p) => a + p.amount, 0) > 0 ? "text-rose-500" : "text-emerald-600"}>
                              {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(
                                Math.max(0, formData.saleDetails.price - formData.saleDetails.payments.reduce((a, p) => a + p.amount, 0))
                              )}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500 dark:text-slate-400 text-center py-2">
                          No hay pagos registrados
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

          <div className="flex items-center gap-3">
            {!isNew &&
              formData.dealTitle &&
              formData.status !== "won" &&
              formData.status !== "lost" && (
                <>
                  <button
                    type="button"
                    onClick={() => handleStatusChange("won")}
                    className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white text-sm font-semibold px-4 py-1.5 rounded shadow-sm transition-colors"
                  >
                    Ganado
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStatusChange("lost")}
                    className="bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white text-sm font-semibold px-4 py-1.5 rounded shadow-sm transition-colors"
                  >
                    Solo contacto
                  </button>
                </>
              )}
            {!isNew &&
              (formData.status === "won") && (
                <button
                  type="button"
                  onClick={() => handleStatusChange("new")}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200 text-sm font-semibold px-4 py-1.5 rounded shadow-sm transition-colors"
                >
                  Reabrir trato
                </button>
              )}
            <div className="w-px h-6 bg-gray-300 mx-1"></div>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-700 dark:text-slate-300 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {showWantedVehicleMenu ? (
          <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-900 flex flex-col items-center">
            <div className="max-w-2xl w-full bg-white dark:bg-slate-800 p-8 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Características del Vehículo Buscado</h2>
                <p className="text-slate-500 dark:text-slate-400 mt-2">
                  El cliente tiene la etiqueta de "Busca de auto". Por favor, detalla qué es lo que está buscando para poder recomendarle vehículos del inventario.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Marca</label>
                  <input
                    type="text"
                    placeholder="Ej. Toyota, Honda..."
                    value={formData.wantedVehicle?.make || ""}
                    onChange={(e) => setFormData(p => ({ ...p, wantedVehicle: { ...p.wantedVehicle, make: e.target.value } }))}
                    className="w-full text-sm border-gray-300 dark:border-slate-600 dark:bg-slate-700 bg-white rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Modelo / Versión</label>
                  <input
                    type="text"
                    placeholder="Ej. Civic, CR-V EX..."
                    value={formData.wantedVehicle?.model || ""}
                    onChange={(e) => setFormData(p => ({ ...p, wantedVehicle: { ...p.wantedVehicle, model: e.target.value } }))}
                    className="w-full text-sm border-gray-300 dark:border-slate-600 dark:bg-slate-700 bg-white rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Año Mínimo</label>
                  <input
                    type="number"
                    placeholder="2015"
                    value={formData.wantedVehicle?.yearMin || ""}
                    onChange={(e) => setFormData(p => ({ ...p, wantedVehicle: { ...p.wantedVehicle, yearMin: e.target.value ? parseInt(e.target.value) : undefined } }))}
                    className="w-full text-sm border-gray-300 dark:border-slate-600 dark:bg-slate-700 bg-white rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Año Máximo</label>
                  <input
                    type="number"
                    placeholder="2024"
                    value={formData.wantedVehicle?.yearMax || ""}
                    onChange={(e) => setFormData(p => ({ ...p, wantedVehicle: { ...p.wantedVehicle, yearMax: e.target.value ? parseInt(e.target.value) : undefined } }))}
                    className="w-full text-sm border-gray-300 dark:border-slate-600 dark:bg-slate-700 bg-white rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Presupuesto Máximo</label>
                  <input
                    type="number"
                    placeholder="$300,000"
                    value={formData.wantedVehicle?.priceMax || ""}
                    onChange={(e) => setFormData(p => ({ ...p, wantedVehicle: { ...p.wantedVehicle, priceMax: e.target.value ? parseInt(e.target.value) : undefined } }))}
                    className="w-full text-sm border-gray-300 dark:border-slate-600 dark:bg-slate-700 bg-white rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Pasajeros</label>
                  <input
                    type="number"
                    placeholder="5"
                    value={formData.wantedVehicle?.passengers || ""}
                    onChange={(e) => setFormData(p => ({ ...p, wantedVehicle: { ...p.wantedVehicle, passengers: e.target.value ? parseInt(e.target.value) : undefined } }))}
                    className="w-full text-sm border-gray-300 dark:border-slate-600 dark:bg-slate-700 bg-white rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tipo de Carrocería</label>
                  <select
                    value={formData.wantedVehicle?.bodyType || ""}
                    onChange={(e) => setFormData(p => ({ ...p, wantedVehicle: { ...p.wantedVehicle, bodyType: e.target.value } }))}
                    className="w-full text-sm border-gray-300 dark:border-slate-600 dark:bg-slate-700 bg-white rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="">Cualquiera</option>
                    <option value="SUV">SUV</option>
                    <option value="Sedan">Sedán</option>
                    <option value="Hatchback">Hatchback</option>
                    <option value="Pickup">Pickup</option>
                    <option value="Coupe">Coupé</option>
                    <option value="Minivan">Minivan</option>
                  </select>
                </div>
              </div>

              <div className="mt-8 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowWantedVehicleMenu(false)}
                  className="px-5 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors"
                >
                  Omitir por ahora
                </button>
                <button
                  type="button"
                  onClick={async (e) => {
                    // Save client with wanted vehicle
                    setShowWantedVehicleMenu(false);
                    // We must bypass the showWantedVehicleMenu check now
                    const mockEvent = { preventDefault: () => {} } as React.FormEvent;
                    
                    if (!userData || !formData.agencyId || formData.agencyId === "unassigned") {
                      alert("Debes pertenecer a una agencia para guardar clientes.");
                      return;
                    }
                    try {
                      if (isNew) {
                        const newRef = doc(collection(db, "clients"));
                        const dataToSave = { ...formData, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
                        Object.keys(dataToSave).forEach(k => dataToSave[k as keyof typeof dataToSave] === undefined && delete dataToSave[k as keyof typeof dataToSave]);
                        await setDoc(newRef, dataToSave);
                      } else {
                        const dataToUpdate = { ...formData, updatedAt: new Date().toISOString() };
                        Object.keys(dataToUpdate).forEach(k => dataToUpdate[k as keyof typeof dataToUpdate] === undefined && delete dataToUpdate[k as keyof typeof dataToUpdate]);
                        await updateDoc(doc(db, "clients", client.id as string), dataToUpdate);
                      }
                      onClose();
                    } catch (err) {
                      console.error(err);
                      alert("Error guardando cliente");
                    }
                  }}
                  className="px-5 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm transition-colors"
                >
                  Guardar Preferencias
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col md:flex-row flex-1 overflow-y-auto md:overflow-hidden">
          {/* LEFT SIDEBAR (DETAILS) */}
          <div className="w-full md:w-[320px] shrink-0 border-b md:border-b-0 md:border-r border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 md:overflow-y-auto">
            <div className="p-5">
              <h3 className="font-bold text-gray-900 dark:text-slate-100 mb-4 flex items-center justify-between">
                Perfil
                <MoreHorizontal className="w-4 h-4 text-gray-400" />
              </h3>

              <form
                id="client-form"
                onSubmit={handleSave}
                className="space-y-4"
              >
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    Valor / Vehículo
                  </label>
                  <select
                    name="vehicle"
                    value={formData.vehicleId || formData.vehicle || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "Otro pendiente") {
                        setFormData({
                          ...formData,
                          vehicle: val,
                          vehicleId: undefined,
                        });
                      } else {
                        const v = inventoryVehicles.find(
                          (veh) => veh.id === val,
                        );
                        if (v) {
                          setFormData({
                            ...formData,
                            vehicle: `${v.year} ${v.make} ${v.model}`,
                            vehicleId: v.id,
                            dealValue: v.price || formData.dealValue,
                          });
                        } else {
                          setFormData({
                            ...formData,
                            vehicle: val,
                            vehicleId: undefined,
                          });
                        }
                      }
                    }}
                    className="w-full text-sm py-1.5 font-medium text-blue-600 border-b border-transparent hover:border-gray-300 focus:border-blue-600 focus:outline-none bg-transparent cursor-pointer"
                  >
                    <option value="" disabled>
                      Seleccionar vehículo...
                    </option>
                    <option value="Otro pendiente">Otro pendiente</option>
                    {inventoryVehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.year} {v.make} {v.model} - {v.vin}
                      </option>
                    ))}
                    {formData.vehicle &&
                      formData.vehicle !== "Otro pendiente" &&
                      !inventoryVehicles.find(
                        (v) => v.id === formData.vehicleId,
                      ) && (
                        <option value={formData.vehicle}>
                          {formData.vehicle}
                        </option>
                      )}
                  </select>
                </div>

                <div className="pt-2 border-t border-gray-100 dark:border-slate-700 space-y-1">
                  <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    Persona
                  </label>
                  <div
                    className="flex items-center gap-2 relative"
                    ref={nameInputRef}
                  >
                    <User className="w-4 h-4 text-gray-400" />
                    <input
                      name="name"
                      autoComplete="off"
                      placeholder="Nombre"
                      value={formData.name || ""}
                      onChange={handleNameChange}
                      onFocus={() => setShowNameSuggestions(true)}
                      className="w-full text-sm py-1 font-medium border-b border-transparent hover:border-gray-300 focus:border-blue-600 focus:outline-none"
                    />
                    {showNameSuggestions && formData.name && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-lg z-50 max-h-48 overflow-y-auto">
                        {existingPersons.filter((p) =>
                          p.name
                            ?.toLowerCase()
                            .includes((formData.name || "").toLowerCase()),
                        ).length > 0 ? (
                          existingPersons
                            .filter((p) =>
                              p.name
                                ?.toLowerCase()
                                .includes((formData.name || "").toLowerCase()),
                            )
                            .map((p) => (
                              <div
                                key={p.id}
                                className="px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                                onClick={() => handleSelectPerson(p)}
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
                  <div className="flex items-center gap-2 mt-2">
                    <Building2 className="w-4 h-4 text-gray-400" />
                    <input
                      name="organization"
                      placeholder="Organización / Empresa"
                      value={formData.organization || ""}
                      onChange={handleChange}
                      className="w-full bg-transparent dark:text-slate-200 text-sm py-1 border-b border-transparent hover:border-gray-300 focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                  <div
                    className="flex items-center gap-2 mt-2 relative"
                    ref={phoneInputRef}
                  >
                    <Phone className="w-4 h-4 text-gray-400" />
                    <input
                      name="phone"
                      autoComplete="off"
                      placeholder="Teléfono"
                      value={formData.phone || ""}
                      onChange={handlePhoneChange}
                      onFocus={() => setShowPhoneSuggestions(true)}
                      className="w-full bg-transparent dark:text-slate-200 text-sm py-1 border-b border-transparent hover:border-gray-300 focus:border-blue-600 focus:outline-none"
                    />
                    {showPhoneSuggestions && formData.phone && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-lg z-50 max-h-48 overflow-y-auto">
                        {existingPersons.filter((p) =>
                          p.phone?.includes(formData.phone || ""),
                        ).length > 0 ? (
                          existingPersons
                            .filter((p) =>
                              p.phone?.includes(formData.phone || ""),
                            )
                            .map((p) => (
                              <div
                                key={p.id}
                                className="px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                                onClick={() => handleSelectPerson(p)}
                              >
                                <div className="font-medium text-slate-900 dark:text-slate-100">
                                  {p.phone}
                                </div>
                                {p.name && (
                                  <div className="text-xs text-slate-500">
                                    {p.name}
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
                  <div className="flex items-center gap-2 mt-2">
                    <Users className="w-4 h-4 text-gray-400" />
                    <select
                      name="sellerId"
                      value={formData.sellerId || ""}
                      onChange={handleChange}
                      className="w-full bg-transparent dark:text-slate-200 text-sm py-1 border-b border-transparent hover:border-gray-300 focus:border-blue-600 focus:outline-none"
                    >
                      <option value="" disabled>
                        Seleccionar Asignado...
                      </option>
                      {agencyUsers
                        .filter((u) => u.role !== "unassigned")
                        .map((u) => (
                          <option key={u.id} value={u.id}>
                            {(!u.name || u.name === 'Usuario Pendiente')
                              ? (u.role === 'admin' ? 'Administrador' : u.email?.split('@')[0] || 'Usuario')
                              : u.name}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Eye className="w-4 h-4 text-gray-400" />
                    <select
                      name="visibility"
                      value={formData.visibility || "all"}
                      onChange={handleChange}
                      className="w-full bg-transparent dark:text-slate-200 text-sm py-1 border-b border-transparent hover:border-gray-300 focus:border-blue-600 focus:outline-none"
                    >
                      <option value="all">Visible para todos</option>
                      <option value="private">
                        Privado (Solo asignado y admin)
                      </option>
                    </select>
                  </div>
                  {existingPersons.find(
                    (p) =>
                      p.phone &&
                      formData.phone &&
                      formData.phone.length > 5 &&
                      p.phone.includes(formData.phone) &&
                      p.id !== formData.id,
                  ) && (
                    <p className="text-[11px] text-orange-600 font-medium ml-6">
                      Este teléfono podría estar ligado a:{" "}
                      {
                        existingPersons.find(
                          (p) =>
                            p.phone &&
                            formData.phone &&
                            p.phone.includes(formData.phone) &&
                            p.id !== formData.id,
                        )?.name
                      }
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <MessageCircle className="w-4 h-4 text-gray-400" />
                    <input
                      type="email"
                      name="email"
                      list="existing-emails-list"
                      placeholder="Correo"
                      value={formData.email || ""}
                      onChange={handleChange}
                      className="w-full bg-transparent dark:text-slate-200 text-sm py-1 border-b border-transparent hover:border-gray-300 focus:border-blue-600 focus:outline-none"
                    />
                    <datalist id="existing-emails-list">
                      {existingPersons
                        .filter((p) => p.email)
                        .map((p) => (
                          <option key={p.id} value={p.email}>
                            {p.name}
                          </option>
                        ))}
                    </datalist>
                  </div>
                  {existingPersons.find(
                    (p) =>
                      p.email &&
                      formData.email &&
                      formData.email.length > 5 &&
                      p.email.includes(formData.email) &&
                      p.id !== formData.id,
                  ) && (
                    <p className="text-[11px] text-orange-600 font-medium ml-6">
                      Este correo podría estar ligado a:{" "}
                      {
                        existingPersons.find(
                          (p) =>
                            p.email &&
                            formData.email &&
                            p.email.includes(formData.email) &&
                            p.id !== formData.id,
                        )?.name
                      }
                    </p>
                  )}
                </div>

                <div className="pt-4 border-t border-gray-100 dark:border-slate-700 space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                      Dirección
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        if (showFullAddress) {
                          const parts = [
                            formData.street,
                            formData.exteriorNumber,
                            formData.neighborhood,
                            formData.city,
                            formData.zipCode,
                          ].filter(Boolean);
                          if (parts.length > 0) {
                            setFormData((prev) => ({
                              ...prev,
                              address: parts.join(", "),
                            }));
                          }
                        }
                        setShowFullAddress(!showFullAddress);
                      }}
                      className="text-[10px] text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-bold uppercase tracking-wider"
                    >
                      {showFullAddress
                        ? "Ocultar detalles"
                        : "Desglosar dirección"}
                    </button>
                  </div>
                  {showFullAddress ? (
                    <div className="grid grid-cols-2 gap-3 mt-2">
                      <div className="col-span-2">
                        <input
                          name="street"
                          placeholder="Calle"
                          value={formData.street || ""}
                          onChange={handleChange}
                          className="w-full bg-transparent dark:text-slate-200 text-sm py-1 border-b border-transparent hover:border-gray-300 focus:border-blue-600 focus:outline-none"
                        />
                      </div>
                      <div>
                        <input
                          name="exteriorNumber"
                          placeholder="Número Ext/Int"
                          value={formData.exteriorNumber || ""}
                          onChange={handleChange}
                          className="w-full bg-transparent dark:text-slate-200 text-sm py-1 border-b border-transparent hover:border-gray-300 focus:border-blue-600 focus:outline-none"
                        />
                      </div>
                      <div>
                        <input
                          name="neighborhood"
                          placeholder="Colonia"
                          value={formData.neighborhood || ""}
                          onChange={handleChange}
                          className="w-full bg-transparent dark:text-slate-200 text-sm py-1 border-b border-transparent hover:border-gray-300 focus:border-blue-600 focus:outline-none"
                        />
                      </div>
                      <div>
                        <input
                          name="city"
                          placeholder="Ciudad y estado"
                          value={formData.city || ""}
                          onChange={handleChange}
                          className="w-full bg-transparent dark:text-slate-200 text-sm py-1 border-b border-transparent hover:border-gray-300 focus:border-blue-600 focus:outline-none"
                        />
                      </div>
                      <div>
                        <input
                          name="zipCode"
                          placeholder="Código Postal"
                          value={formData.zipCode || ""}
                          onChange={handleChange}
                          className="w-full bg-transparent dark:text-slate-200 text-sm py-1 border-b border-transparent hover:border-gray-300 focus:border-blue-600 focus:outline-none"
                        />
                      </div>
                    </div>
                  ) : (
                    <input
                      name="address"
                      placeholder="Ej. Calle 123..."
                      value={formData.address || ""}
                      onChange={handleChange}
                      className="w-full bg-transparent dark:text-slate-200 text-sm py-1 border-b border-transparent hover:border-gray-300 focus:border-blue-600 focus:outline-none"
                    />
                  )}
                </div>

                <div className="pt-4 border-t border-gray-100 dark:border-slate-700 space-y-2">
                  <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Tag className="w-3.5 h-3.5 text-indigo-505" />
                    Etiquetas
                  </label>
                  <select
                    value=""
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val) handleTagToggle(val);
                      e.target.value = "";
                    }}
                    className="w-full text-sm border border-slate-200 dark:border-slate-700 rounded p-1.5 focus:ring-1 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none"
                  >
                    <option value="" disabled>
                      Seleccionar etiqueta...
                    </option>
                    {availableTags.map((tag, i) => (
                      <option key={`opt-${tag}-${i}`} value={tag}>
                        {tag} {(formData.tags || []).includes(tag) ? "✓" : ""}
                      </option>
                    ))}
                  </select>

                  {formData.tags && formData.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {formData.tags.map((tag, idx) => (
                        <span
                          key={`${tag}-${idx}`}
                          className="inline-flex items-center gap-1 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800/10 px-2 py-0.5 rounded-full text-[10px] font-bold"
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={() => handleTagToggle(tag)}
                            className="text-indigo-400 hover:text-red-500 font-bold ml-1 text-[11px] leading-none"
                            title="Eliminar etiqueta"
                          >
                            &times;
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] text-gray-400 dark:text-slate-500 italic mt-1">
                      Sin etiquetas personalizadas.
                    </p>
                  )}

                  {(formData.wantedVehicle?.make || formData.tags?.some(t => t.toLowerCase().includes('busca de auto') || t.toLowerCase().includes('compra'))) && (
                    <div className="mt-3 flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => setShowWantedVehicleMenu(true)}
                        className="w-full text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-800/50 py-1.5 rounded transition-colors"
                      >
                        Ver / Editar Búsqueda de Auto
                      </button>
                      
                      {(() => {
                        if (!formData.wantedVehicle) return null;
                        const matches = getClientMatches(formData as Client, inventoryVehicles);
                        if (matches.length === 0) return null;
                        
                        return (
                          <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50 rounded-lg shadow-sm">
                            <h4 className="text-xs font-bold text-green-800 dark:text-green-300 mb-2 flex items-center gap-1.5">
                              <Target className="w-3.5 h-3.5" />
                              Posibles Matches en Inventario ({matches.length})
                            </h4>
                            <div className="flex flex-col gap-1.5 max-h-[150px] overflow-y-auto pr-1">
                              {matches.map((m, idx) => (
                                <div key={m.vehicle.id || idx} className="flex flex-col p-2 bg-white dark:bg-slate-800 rounded border border-green-100 dark:border-green-800/30 text-xs">
                                  <div className="flex justify-between items-start mb-1">
                                    <span className="font-bold text-slate-800 dark:text-slate-200">
                                      {m.vehicle.year} {m.vehicle.make} {m.vehicle.model}
                                    </span>
                                    <span className="font-semibold text-green-700 dark:text-green-400">
                                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(m.vehicle.price)}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                                      m.level === 'exact' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300' :
                                      m.level === 'high' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300' :
                                      m.level === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300' :
                                      'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300'
                                    }`}>
                                      {m.level === 'exact' ? 'Exacto' : m.level === 'high' ? 'Muy Similar' : m.level === 'medium' ? 'Similar' : 'Posible'}
                                    </span>
                                    <span className="text-gray-500 dark:text-slate-400 truncate">
                                      VIN: {m.vehicle.vin}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-gray-100 dark:border-slate-700">
                  <span className="text-xs text-gray-400 font-medium">
                    Fuente: {formData.origin}
                  </span>
                </div>
              </form>
            </div>
          </div>

          {/* RIGHT SIDEBAR (INTERACTIONS & TIMELINE) */}
          <div className="flex-1 flex flex-col bg-[#F9FAFB] dark:bg-slate-900 md:overflow-hidden">
            {!isNew ? (
              <div className="flex-1 md:overflow-y-auto p-4 md:p-6 space-y-6">
                {/* INTERACTION WIDGET */}
                <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm">
                  <div className="flex border-b border-gray-200 dark:border-slate-700">
                    <button
                      onClick={() => setActiveTab("activity")}
                      className={clsx(
                        "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                        activeTab === "activity"
                          ? "border-blue-600 text-blue-700 bg-blue-50/50"
                          : "border-transparent text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:text-slate-100 hover:bg-gray-50 dark:bg-slate-900",
                      )}
                    >
                      <Calendar className="w-4 h-4" /> Actividad
                    </button>
                    <button
                      onClick={() => setActiveTab("notes")}
                      className={clsx(
                        "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                        activeTab === "notes"
                          ? "border-blue-600 text-blue-700 bg-blue-50/50"
                          : "border-transparent text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:text-slate-100 hover:bg-gray-50 dark:bg-slate-900",
                      )}
                    >
                      <FileText className="w-4 h-4" /> Notas
                    </button>
                    <button
                      onClick={() => setActiveTab("files")}
                      className={clsx(
                        "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                        activeTab === "files"
                          ? "border-blue-600 text-blue-700 bg-blue-50/50"
                          : "border-transparent text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:text-slate-100 hover:bg-gray-50 dark:bg-slate-900",
                      )}
                    >
                      <Upload className="w-4 h-4" /> Archivos
                    </button>
                  </div>

                  <div className="p-4 bg-white dark:bg-slate-800">
                    {activeTab === "activity" && (
                      <div>
                        <input
                          type="text"
                          placeholder="Tomar nota o crear tarea..."
                          value={newTaskTitle}
                          onChange={(e) => setNewTaskTitle(e.target.value)}
                          className="w-full text-sm border border-gray-300 rounded p-2 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 mb-3"
                        />
                        <div className="flex gap-2 items-center mb-3">
                          <input
                            type="date"
                            value={newTaskDate}
                            onChange={(e) => setNewTaskDate(e.target.value)}
                            className="flex-1 text-sm border border-gray-300 rounded p-1.5 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                          />
                          <TimeSelect
                            value={newTaskTime}
                            onChange={(val) => setNewTaskTime(val)}
                            placeholder="h:mm"
                          />
                        </div>
                        <div className="flex justify-end items-center gap-2">
                          {editingTaskId && (
                            <button
                              onClick={cancelEditTask}
                              className="text-gray-500 hover:text-gray-700 text-sm font-medium px-4 py-1.5 rounded transition-colors"
                            >
                              Cancelar
                            </button>
                          )}
                          <button
                            onClick={handleAddTask}
                            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium text-sm px-4 py-1.5 rounded transition-colors"
                          >
                            {editingTaskId ? "Guardar Cambios" : "Programar Tarea"}
                          </button>
                        </div>
                      </div>
                    )}
                    {activeTab === "notes" && (
                      <div className="flex flex-col gap-3">
                        <textarea
                          placeholder="Toma una nota..."
                          value={newNoteContent}
                          onChange={(e) => setNewNoteContent(e.target.value)}
                          className="w-full text-sm border border-gray-300 rounded p-2 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 min-h-[80px]"
                        />
                        <div className="flex justify-end">
                          <button
                            onClick={handleAddNote}
                            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium text-sm px-4 py-1.5 rounded transition-colors"
                          >
                            Guardar Nota
                          </button>
                        </div>
                      </div>
                    )}
                    {activeTab === "files" && (
                      <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-200 dark:border-slate-700 rounded bg-gray-50 dark:bg-slate-900 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
                        <Upload className="w-8 h-8 text-gray-400 mb-2" />
                        <label className="text-sm font-medium text-blue-600 cursor-pointer hover:underline">
                          Haz clic para subir un archivo
                          <input
                            type="file"
                            className="hidden"
                            onChange={handleFileUpload}
                          />
                        </label>
                        <p className="text-xs text-gray-400 mt-1">
                          Imágenes o documentos PDF
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* FOCUS SECTION (Pending tasks) */}
                {pendingTasks.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-gray-800 dark:text-slate-200 flex items-center gap-2">
                      {" "}
                      Enfoque{" "}
                    </h3>
                    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm">
                      {pendingTasks.map((t, idx) => (
                        <div
                          key={t.id}
                          className={clsx(
                            "flex items-center justify-between p-3",
                            idx !== pendingTasks.length - 1 &&
                              "border-b border-gray-100 dark:border-slate-700",
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => toggleTaskCompletion(t)}
                              className="w-5 h-5 rounded-full border-2 border-gray-300 flex items-center justify-center hover:border-green-500 transition-colors"
                            ></button>
                            <span 
                              onClick={() => handleEditTaskClick(t)}
                              className="text-sm font-medium text-gray-800 dark:text-slate-200 cursor-pointer hover:text-blue-600 transition-colors"
                              title="Editar tarea"
                            >
                              {t.title}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400 font-medium">
                            <Clock className="w-3.5 h-3.5" />
                            {t.dueDate}
                            <button
                              onClick={() => handleEditTaskClick(t)}
                              className="ml-2 text-gray-400 hover:text-blue-600 transition-colors"
                              title="Editar tarea"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* TIMELINE / HISTORY SECTION */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-gray-800 dark:text-slate-200 flex items-center gap-2">
                    {" "}
                    Historial{" "}
                  </h3>

                  <div className="relative pl-6 space-y-6 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-0 before:w-0.5 before:bg-gray-200">
                    {formData.soldAt && (
                      <div className="relative">
                        <div className="absolute -left-[27px] top-1 w-4 h-4 rounded-full bg-blue-600 border-2 border-white shadow-sm flex items-center justify-center">
                          <CheckSquare className="w-2.5 h-2.5 text-white" />
                        </div>
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 p-3 rounded-lg mr-2">
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                              Trato Ganado / Vehículo Vendido
                            </span>
                            <span className="text-[10px] text-blue-500 font-medium">
                              {formData.soldAt.split('T')[0]}
                            </span>
                          </div>
                          <p className="text-sm text-blue-800 dark:text-blue-300">
                            Venta realizada y registrada.
                          </p>
                        </div>
                      </div>
                    )}
                    {/* History items: Files and Completed Tasks interleaved pseudo-chronologically */}
                    {completedTasks.map((t) => (
                      <div key={`hist-t-${t.id}`} className="relative">
                        <div className="absolute -left-[27px] top-1 w-4 h-4 rounded-full bg-green-500 border-2 border-white shadow-sm flex items-center justify-center">
                          <CheckSquare className="w-2.5 h-2.5 text-white" />
                        </div>
                        <div className="bg-amber-50 border border-amber-100/60 p-3 rounded-lg mr-2">
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-xs font-semibold text-gray-600 dark:text-slate-400">
                              Tarea completada
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-gray-400">
                                {t.dueDate}
                              </span>
                              <button
                                onClick={() => handleEditTaskClick(t)}
                                className="text-gray-400 hover:text-blue-600 transition-colors"
                                title="Editar tarea"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          <p 
                            onClick={() => handleEditTaskClick(t)}
                            className="text-sm text-gray-800 dark:text-slate-200 line-through opacity-70 cursor-pointer hover:opacity-100 hover:text-blue-600 transition-colors"
                            title="Editar tarea"
                          >
                            {t.title}
                          </p>
                        </div>
                      </div>
                    ))}

                    {notes.map((n) => (
                      <div key={`hist-n-${n.id}`} className="relative">
                        <div className="absolute -left-[27px] top-1 w-4 h-4 rounded-full bg-yellow-500 border-2 border-white shadow-sm flex items-center justify-center">
                          <FileText className="w-2.5 h-2.5 text-white" />
                        </div>
                        <div className="bg-white dark:bg-slate-800 border border-yellow-200 p-3 rounded-lg mr-2 shadow-sm">
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-xs font-bold text-gray-800 dark:text-slate-200">
                              {n.sellerId === userData?.id
                                ? userData?.email
                                : "Nota"}
                            </span>
                            <span className="text-[10px] text-gray-400">
                              {typeof n.createdAt === "string"
                                ? n.createdAt.split("T")[0]
                                : ""}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 dark:text-slate-300 whitespace-pre-wrap">
                            {n.content}
                          </p>
                        </div>
                      </div>
                    ))}

                    {files.map((f) => (
                      <div key={`hist-f-${f.id}`} className="relative">
                        <div className="absolute -left-[27px] top-1 w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow-sm flex items-center justify-center">
                          <Upload className="w-2 h-2 text-white" />
                        </div>
                        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 p-3 rounded-lg mr-2 hover:border-blue-300 transition-colors">
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-xs font-semibold text-gray-600 dark:text-slate-400">
                              Archivo subido
                            </span>
                            <span className="text-[10px] text-gray-400">
                              {typeof f.uploadedAt === "string"
                                ? f.uploadedAt.split("T")[0]
                                : ""}
                            </span>
                          </div>
                          <a
                            href={f.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm font-medium text-blue-600 hover:underline flex items-center gap-1.5 mt-1"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            {f.filename}
                          </a>
                        </div>
                      </div>
                    ))}

                    <div className="relative">
                      <div className="absolute -left-[27px] top-1 w-4 h-4 rounded-full bg-gray-300 border-2 border-white shadow-sm"></div>
                      <div className="text-sm text-gray-500 dark:text-slate-400 ml-1">
                        Trato creado. Origen:{" "}
                        <span className="font-semibold">{formData.origin}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-slate-900">
                <div className="text-center max-w-sm">
                  <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <User className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-2">
                    Completa el formulario
                  </h3>
                  <p className="text-gray-500 dark:text-slate-400 text-sm">
                    Rellena los datos básicos en el panel izquierdo y guarda
                    para comenzar a registrar notas, documentos y actividades.
                  </p>
                </div>
              </div>
            )}

            {/* BOTTOM ACTIONS (mobile: form save, desktop: right aligned save) */}
            <div className="p-4 bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 flex justify-end gap-3 shrink-0">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-semibold text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded transition-colors"
              >
                Cancelar
              </button>
              <button
                form="client-form"
                type="submit"
                className="px-6 py-2 bg-[#2E353B] hover:bg-black transition-colors text-white text-sm font-bold rounded shadow-sm"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
