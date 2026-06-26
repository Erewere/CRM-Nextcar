import React, { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  writeBatch,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { Client, Deal, Task } from "../types";
import {
  Users,
  Search,
  Plus,
  MapPin,
  Mail,
  Phone,
  Building2,
  X,
  List,
  Grid,
  Settings,
  Trash2,
  Download,
  User as UserIcon,
} from "lucide-react";
import { ClientDetailModal } from "../components/ClientDetailModal";
import clsx from "clsx";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export function Persons() {
  const { userData, googleToken, connectGoogleServices } = useAuth();
  const [persons, setPersons] = useState<Client[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<Client | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [pipelineStages, setPipelineStages] = useState<
    { id: string; title: string }[]
  >([]);
  const [importingContacts, setImportingContacts] = useState(false);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);

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
              }
            }
          })
          .catch(console.error);
      });
    }
  }, [userData?.agencyId]);

  const [columns, setColumns] = useState([
    { id: "name", label: "Nombre", visible: true, width: 200 },
    { id: "organization", label: "Organización", visible: true, width: 150 },
    { id: "email", label: "Correo electrónico", visible: true, width: 200 },
    { id: "phone", label: "Teléfono", visible: true, width: 150 },
    { id: "vehicle", label: "Vehículo", visible: true, width: 150 },
    { id: "status", label: "Etapa", visible: true, width: 150 },
    { id: "closedDeals", label: "Tratos cerrados", visible: true, width: 120 },
    { id: "openDeals", label: "Tratos abiertos", visible: true, width: 120 },
    {
      id: "nextTaskDate",
      label: "Fecha de la próxima actividad",
      visible: true,
      width: 220,
    },
    { id: "owner", label: "Propietario", visible: true, width: 150 },
  ]);
  const [showColSettings, setShowColSettings] = useState(false);
  const [resizingCol, setResizingCol] = useState<string | null>(null);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartWidth, setDragStartWidth] = useState(0);

  useEffect(() => {
    if (!resizingCol) return;
    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - dragStartX;
      setColumns((cols) =>
        cols.map((c) =>
          c.id === resizingCol
            ? { ...c, width: Math.max(50, dragStartWidth + delta) }
            : c,
        ),
      );
    };
    const handleMouseUp = () => setResizingCol(null);

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [resizingCol, dragStartX, dragStartWidth]);

  const handleMouseDown = (
    e: React.MouseEvent,
    colId: string,
    currentWidth: number,
  ) => {
    setResizingCol(colId);
    setDragStartX(e.clientX);
    setDragStartWidth(currentWidth);
    e.preventDefault();
    e.stopPropagation();
  };

  const toggleColumn = (id: string) => {
    setColumns((cols) =>
      cols.map((c) => (c.id === id ? { ...c, visible: !c.visible } : c)),
    );
  };

  // New person form state
  const [name, setName] = useState("");
  const [organization, setOrganization] = useState("");
  const [phones, setPhones] = useState([{ value: "", type: "Trabajo" }]);
  const [emails, setEmails] = useState([{ value: "", type: "Trabajo" }]);
  const [labels, setLabels] = useState("");
  const [agencyUsers, setAgencyUsers] = useState<Record<string, string>>({});

  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const handleDeleteSelected = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    try {
      await Promise.all(
        selectedClients.map((id) => deleteDoc(doc(db, "clients", id)))
      );
      setPersons((prev) =>
        prev.filter((p) => !selectedClients.includes(p.id)),
      );
      setSelectedClients([]);
      setShowDeleteConfirm(false);
    } catch (err) {
      console.error("Error deleting clients:", err);
      alert("Error al eliminar contactos");
    }
  };

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

  useEffect(() => {
    if (!userData || userData.role === "master") return;

    const fetchData = async () => {
      let clientsDocs: any[] = [];
      let dealsDocs: any[] = [];
      let tasksDocs: any[] = [];
      const uq = query(
        collection(db, "users"),
        where("agencyId", "==", userData.agencyId),
      );

      try {
        let uSnap = await getDocs(uq).catch(() => ({ docs: [] }) as any);

        if (userData.role === "seller") {
          const cq1 = query(
            collection(db, "clients"),
            where("agencyId", "==", userData.agencyId),
            where("sellerId", "==", userData.id),
          );
          const cq2 = query(
            collection(db, "clients"),
            where("agencyId", "==", userData.agencyId),
            where("visibility", "==", "all"),
          );
          const dq1 = query(
            collection(db, "deals"),
            where("agencyId", "==", userData.agencyId),
            where("sellerId", "==", userData.id),
          );
          const tq1 = query(
            collection(db, "tasks"),
            where("agencyId", "==", userData.agencyId),
            where("sellerId", "==", userData.id),
          );

          const [csnap1, csnap2, dsnap, tsnap] = await Promise.all([
            getDocs(cq1),
            getDocs(cq2),
            getDocs(dq1).catch(() => ({ docs: [] }) as any),
            getDocs(tq1).catch(() => ({ docs: [] }) as any),
          ]);

          const cMap = new Map();
          csnap1.docs.forEach((d) => cMap.set(d.id, d));
          csnap2.docs.forEach((d) => cMap.set(d.id, d));
          clientsDocs = Array.from(cMap.values());
          dealsDocs = dsnap.docs;
          tasksDocs = tsnap.docs;
        } else {
          const q = query(
            collection(db, "clients"),
            where("agencyId", "==", userData.agencyId),
          );
          const dq = query(
            collection(db, "deals"),
            where("agencyId", "==", userData.agencyId),
          );
          const tq = query(
            collection(db, "tasks"),
            where("agencyId", "==", userData.agencyId),
          );

          const [snap, dSnap, tSnap] = await Promise.all([
            getDocs(q),
            getDocs(dq).catch(() => ({ docs: [] }) as any),
            getDocs(tq).catch(() => ({ docs: [] }) as any),
          ]);

          clientsDocs = snap.docs;
          dealsDocs = dSnap.docs;
          tasksDocs = tSnap.docs;
        }

        const usersMap: Record<string, string> = {};
        if (uSnap && uSnap.docs) {
          uSnap.docs.forEach((d: any) => {
            usersMap[d.id] = d.data().name;
          });
        }
        setAgencyUsers(usersMap);

        const allClients = clientsDocs.map(
          (d) => ({ id: d.id, ...d.data() }) as Client,
        );
        const uniqueClients: Client[] = [];
        const seenNames = new Set<string>();
        for (const c of allClients) {
          const nm = String(c.name || "")
            .trim()
            .toLowerCase();
          if (nm && !seenNames.has(nm)) {
            seenNames.add(nm);
            uniqueClients.push(c);
          } else if (!nm) {
            uniqueClients.push(c);
          }
        }
        setPersons(uniqueClients);

        setDeals(
          dealsDocs
            ? dealsDocs.map((d: any) => ({ id: d.id, ...d.data() }) as Deal)
            : [],
        );
        setTasks(
          tasksDocs
            ? tasksDocs.map((d: any) => ({ id: d.id, ...d.data() }) as Task)
            : [],
        );
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [userData]);

  const handleAddPerson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData) return;

    try {
      const primaryPhone = phones
        .map((p) => p.value)
        .filter(Boolean)
        .join(", ");
      const primaryEmail = emails
        .map((e) => e.value)
        .filter(Boolean)
        .join(", ");

      const newRef = doc(collection(db, "clients"));
      const newPerson: Client = {
        id: newRef.id,
        agencyId: userData.agencyId || "",
        sellerId: userData.id || "",
        name,
        email: primaryEmail,
        phone: primaryPhone,
        organization,
        address: "",
        vehicle: "",
        status: "",
        origin: "manual",
        tags: selectedTags,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await setDoc(newRef, newPerson);
      setPersons((prev) => [newPerson, ...prev]);
      setShowAddPerson(false);
      setName("");
      setPhones([{ value: "", type: "Trabajo" }]);
      setEmails([{ value: "", type: "Trabajo" }]);
      setOrganization("");
      setLabels("");
      setSelectedTags([]);
    } catch (e) {
      console.error(e);
    }
  };

  const handleImportGoogleContacts = async () => {
    try {
      let token = googleToken;
      if (!token) {
        token = await connectGoogleServices();
      }
      if (!token) return;

      setImportingContacts(true);
      const res = await fetch(
        "https://people.googleapis.com/v1/people/me/connections?personFields=names,emailAddresses,phoneNumbers,organizations&pageSize=1000",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      const data = await res.json();

      if (data.connections) {
        let importedCount = 0;
        let newPersons: Client[] = [];
        for (const person of data.connections) {
          const personName = person.names?.[0]?.displayName || "";
          const personEmail = person.emailAddresses?.[0]?.value || "";
          const personPhone = person.phoneNumbers?.[0]?.value || "";
          const personOrganization = person.organizations?.[0]?.name || "";

          if (personName && (personEmail || personPhone)) {
            // Check if already exists in persons list
            const exists = [...persons, ...newPersons].find(
              (p) =>
                (personEmail && p.email?.includes(personEmail)) ||
                (personPhone && p.phone?.includes(personPhone)) ||
                (p.name &&
                  String(p.name).toLowerCase() ===
                    String(personName).toLowerCase()),
            );

            if (!exists) {
              const newRef = doc(collection(db, "clients"));
              const newPerson: Client = {
                id: newRef.id,
                agencyId: userData?.agencyId || "",
                sellerId: userData?.id || "",
                name: personName,
                email: personEmail,
                phone: personPhone,
                organization: personOrganization,
                address: "",
                vehicle: "",
                status: "",
                origin: "google_contacts",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
              await setDoc(newRef, newPerson);
              newPersons.push(newPerson);
              importedCount++;
            }
          }
        }

        if (newPersons.length > 0) {
          setPersons((prev) => [...newPersons, ...prev]);
        }
        alert(`Se importaron ${importedCount} contactos nuevos desde Google.`);
      } else {
        alert("No se encontraron contactos para importar.");
      }
    } catch (e) {
      console.error("Error al importar contactos:", e);
      alert("Hubo un error al importar los contactos. Verifica los permisos.");
    } finally {
      setImportingContacts(false);
      setShowAddPerson(false);
    }
  };

  const filteredPersons = persons.filter(
    (p) =>
      String(p.name || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      (p.organization &&
        String(p.organization)
          .toLowerCase()
          .includes(searchTerm.toLowerCase())),
  );

  const getPersonStats = (personId: string) => {
    const personDeals = deals.filter((d) => d.clientId === personId);
    let openDeals = personDeals.filter(
      (d) => d.status === "open" || !["won", "lost"].includes(d.status),
    ).length;
    let closedDeals = personDeals.filter((d) =>
      ["won", "lost"].includes(d.status),
    ).length;

    if (personDeals.length === 0) {
      const person = persons.find((p) => p.id === personId);
      if (person && person.status) {
        const pStatus = String(person.status || "").toLowerCase();
        const isClosed =
          pStatus === "won" ||
          pStatus.includes("ganado") ||
          pStatus === "lost" ||
          pStatus.includes("perdido");
        if (isClosed) closedDeals = 1;
        else openDeals = 1;
      }
    }

    const personTasks = tasks.filter(
      (t) => t.clientId === personId && !t.completed,
    );
    personTasks.sort((a, b) => {
      const da = new Date(
        a.dueDate ? a.dueDate + "T00:00:00" : "9999-12-31T00:00:00",
      );
      const db = new Date(
        b.dueDate ? b.dueDate + "T00:00:00" : "9999-12-31T00:00:00",
      );
      return da.getTime() - db.getTime();
    });
    const nextTaskDate =
      personTasks.length > 0 && personTasks[0].dueDate
        ? personTasks[0].dueDate
        : null;

    let formattedNextTaskDate = "";
    if (nextTaskDate) {
      const d = new Date(nextTaskDate + "T00:00:00");
      if (!isNaN(d.getTime())) {
        formattedNextTaskDate = format(d, "d 'de' MMMM 'de' yyyy", {
          locale: es,
        });
      }
    }

    return {
      openDeals,
      closedDeals,
      nextTaskDate: formattedNextTaskDate,
    };
  };

  if (loading)
    return (
      <div className="flex justify-center items-center h-full">Cargando...</div>
    );

  return (
    <div className="flex flex-col h-full bg-[#f4f5f5]">
      {/* Header */}
      <div className="px-4 md:px-6 py-4 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-4">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-gray-800 dark:text-slate-200">
              Personas
            </h1>
            <div className="flex bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => setViewMode("list")}
                className={clsx(
                  "p-1.5 rounded transition-colors",
                  viewMode === "list"
                    ? "bg-white dark:bg-slate-800 shadow-sm text-blue-600"
                    : "text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:text-slate-300",
                )}
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={clsx(
                  "p-1.5 rounded transition-colors",
                  viewMode === "grid"
                    ? "bg-white dark:bg-slate-800 shadow-sm text-blue-600"
                    : "text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:text-slate-300",
                )}
              >
                <Grid className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {selectedClients.length > 0 && (
              <button
                onClick={handleDeleteSelected}
                className="flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-gradient-to-r from-rose-500 to-red-600 text-white rounded font-semibold hover:bg-red-700 shadow-sm text-xs md:text-sm"
              >
                <Trash2 className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">
                  Eliminar seleccionados ({selectedClients.length})
                </span>
                <span className="sm:hidden">
                  Eliminar ({selectedClients.length})
                </span>
              </button>
            )}
            <button
              onClick={handleImportGoogleContacts}
              disabled={importingContacts}
              className="flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-white dark:bg-slate-800 border border-gray-300 text-gray-700 dark:text-slate-300 rounded font-semibold hover:bg-gray-50 dark:bg-slate-900 shadow-sm text-xs md:text-sm"
            >
              <Download className="w-4 h-4 shrink-0" />{" "}
              <span className="hidden sm:inline">
                {importingContacts ? "Importando..." : "Importar de Google"}
              </span>
              <span className="sm:hidden">Importar</span>
            </button>
            <button
              onClick={() => setShowAddPerson(true)}
              className="flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded font-semibold hover:bg-green-700 shadow-sm text-xs md:text-sm"
            >
              <Plus className="w-4 h-4 shrink-0" /> Nuevo Contacto
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 relative max-w-md">
          <Search className="w-5 h-5 text-gray-400 absolute left-3" />
          <input
            type="text"
            placeholder="Buscar en Pipedrive..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200-full py-1.5 pl-10 pr-3 focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-gray-50 dark:bg-slate-900 hover:bg-gray-100 dark:hover:bg-slate-700"
          />
        </div>
      </div>

      {viewMode === "grid" ? (
        <div className="p-6 flex-1 overflow-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredPersons.map((person) => (
              <div
                key={person.id}
                className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 shadow-sm p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setSelectedPerson(person)}
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xl flex-shrink-0">
                    {String(person.name || "?")
                      .charAt(0)
                      .toUpperCase()}
                  </div>
                  <div className="overflow-hidden">
                    <h3
                      className="font-bold text-gray-900 dark:text-slate-100 truncate"
                      title={person.name}
                    >
                      {person.name || "Sin Nombre"}
                    </h3>
                    {person.tags && person.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1 mb-1.5">
                        {person.tags.map((t, idx) => (
                          <span
                            key={`${t}-${idx}`}
                            className="px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-[9px] font-bold border border-indigo-100 dark:border-indigo-800/10 uppercase tracking-wider"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                    {person.organization && (
                      <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-slate-400 mt-1">
                        <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">{person.organization}</span>
                      </div>
                    )}
                    {person.email && (
                      <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-slate-400 mt-1">
                        <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">{person.email}</span>
                      </div>
                    )}
                    {person.phone && (
                      <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-slate-400 mt-1">
                        <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">{person.phone}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700">
          <table className="w-full min-w-[800px] text-left text-sm border-collapse table-fixed select-none">
            <thead className="bg-[#fcfdfd] dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 font-medium sticky top-0 z-10 shadow-sm">
              <tr>
                <th
                  className="w-10 border-r border-gray-200 dark:border-slate-700"
                  style={{ width: 40 }}
                >
                  <div className="flex items-center justify-center py-3">
                    <input
                      type="checkbox"
                      checked={
                        selectedClients.length > 0 &&
                        selectedClients.length === filteredPersons.length
                      }
                      ref={(input) => {
                        if (input) {
                          input.indeterminate =
                            selectedClients.length > 0 &&
                            selectedClients.length < filteredPersons.length;
                        }
                      }}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedClients(filteredPersons.map((p) => p.id));
                        } else {
                          setSelectedClients([]);
                        }
                      }}
                      className="rounded border-gray-300 dark:border-slate-600 dark:bg-slate-700 bg-white dark:checked:bg-blue-500 cursor-pointer"
                    />
                  </div>
                </th>
                {columns
                  .filter((c) => c.visible)
                  .map((col) => (
                    <th
                      key={col.id}
                      className="relative border-r border-gray-200 dark:border-slate-700 truncate group"
                      style={{ width: col.width }}
                    >
                      <div className="px-4 py-3 truncate">{col.label}</div>
                      <div
                        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-400 z-20 transition-colors opacity-0 group-hover:opacity-100"
                        onMouseDown={(e) =>
                          handleMouseDown(e, col.id, col.width)
                        }
                      />
                    </th>
                  ))}
                <th className="w-10 relative" style={{ width: 40 }}>
                  <button
                    type="button"
                    onClick={() => setShowColSettings(!showColSettings)}
                    className="w-full h-full flex items-center justify-center p-3 hover:bg-gray-100 dark:hover:bg-slate-700 outline-none"
                  >
                    <Settings className="w-4 h-4 text-gray-400 hover:text-gray-600 dark:text-slate-400 transition-colors" />
                  </button>
                  {showColSettings && (
                    <div className="absolute right-0 top-full mt-1 w-64 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded shadow-lg p-2 z-50">
                      <div className="text-xs font-bold text-gray-500 dark:text-slate-400 mb-2 uppercase px-2">
                        Columnas visibles
                      </div>
                      {columns.map((col) => (
                        <label
                          key={col.id}
                          className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 dark:bg-slate-900 rounded cursor-pointer text-gray-700 dark:text-slate-300"
                        >
                          <input
                            type="checkbox"
                            checked={col.visible}
                            onChange={() => toggleColumn(col.id)}
                            className="rounded border-gray-300 dark:border-slate-600 dark:bg-slate-700 bg-white dark:checked:bg-blue-500"
                          />
                          <span className="truncate">{col.label}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800">
              {filteredPersons.map((person) => {
                const stats = getPersonStats(person.id);
                return (
                  <tr
                    key={person.id}
                    className="border-b border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:bg-slate-900 group/row cursor-pointer"
                    onClick={() => setSelectedPerson(person)}
                  >
                    <td
                      className="border-r border-gray-100 dark:border-slate-700"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-center py-2">
                        <input
                          type="checkbox"
                          checked={selectedClients.includes(person.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedClients([...selectedClients, person.id]);
                            } else {
                              setSelectedClients(
                                selectedClients.filter((id) => id !== person.id),
                              );
                            }
                          }}
                          className="rounded border-gray-300 dark:border-slate-600 dark:bg-slate-700 bg-white dark:checked:bg-blue-500 cursor-pointer"
                        />
                      </div>
                    </td>
                    {columns
                      .filter((c) => c.visible)
                      .map((col) => {
                        let val: React.ReactNode = "";
                        if (col.id === "name") {
                          val = (
                            <div className="flex flex-col gap-0.5 min-w-0">
                              <span className="text-blue-600 font-medium truncate w-full block">
                                {person.name || "Sin Nombre"}
                              </span>
                              {person.tags && person.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-0.5">
                                  {person.tags.map((t, idx) => (
                                    <span
                                      key={`${t}-${idx}`}
                                      className="px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-[9px] font-bold border border-indigo-100 dark:border-indigo-800/10 uppercase"
                                    >
                                      {t}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        }
                        if (col.id === "organization")
                          val = person.organization;
                        if (col.id === "email") val = person.email;
                        if (col.id === "phone") val = person.phone;
                        if (col.id === "vehicle")
                          val = person.vehicle || person.dealTitle || "";
                        if (col.id === "status") {
                          const stage = pipelineStages.find(
                            (s) => s.id === person.status,
                          );
                          val = (
                            <span className="capitalize">
                              {stage
                                ? stage.title
                                : person.status === "open"
                                  ? "Abierto"
                                  : person.status === "won"
                                    ? "Ganado"
                                    : person.status === "lost"
                                      ? "Perdido"
                                      : person.status || "Nuevo"}
                            </span>
                          );
                        }
                        if (col.id === "closedDeals")
                          val = (
                            <div className="text-right">
                              {stats.closedDeals}
                            </div>
                          );
                        if (col.id === "openDeals")
                          val = (
                            <div className="text-right">{stats.openDeals}</div>
                          );
                        if (col.id === "nextTaskDate") val = stats.nextTaskDate;
                        if (col.id === "owner")
                          val =
                            agencyUsers[person.sellerId] ||
                            agencyUsers[person.agencyId] ||
                            "Sin asignar";
                        return (
                          <td
                            key={col.id}
                            className="px-4 py-2 border-r border-gray-100 dark:border-slate-700 text-gray-600 dark:text-slate-400 truncate"
                            style={{ width: col.width, maxWidth: col.width }}
                          >
                            {val}
                          </td>
                        );
                      })}
                    <td className="px-4 py-2 text-center text-gray-400 group-hover/row:text-gray-600 dark:text-slate-400">
                      ...
                    </td>
                  </tr>
                );
              })}
              {filteredPersons.length === 0 && (
                <tr>
                  <td
                    colSpan={columns.filter((c) => c.visible).length + 2}
                    className="px-4 py-8 text-center text-gray-500 dark:text-slate-400 font-medium border-b border-gray-100 dark:border-slate-700"
                  >
                    No se encontraron personas
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Modal */}
      {showAddPerson && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleAddPerson}
            className="bg-white dark:bg-slate-800 rounded shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800 dark:text-slate-200">
                Añadir persona
              </h2>
              <button
                type="button"
                onClick={() => setShowAddPerson(false)}
                className="text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:text-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-2 flex flex-col gap-4 text-sm">
              <div>
                <label className="block text-gray-700 dark:text-slate-300 mb-1">
                  Nombre
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-gray-700 dark:text-slate-300 mb-1">
                  Organización
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-gray-500 dark:text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                    className="w-full border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 p-2 pl-9 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-700 dark:text-slate-300 mb-1">
                  Teléfono
                </label>
                {phones.map((p, idx) => {
                  const matches = p.value.length >= 3 
                    ? persons.filter(cl => cl.phone && cl.phone.toLowerCase().includes(p.value.toLowerCase()) && cl.phone !== p.value)
                    : [];
                  const existingMatch = persons.find(
                    (client) =>
                      client.phone &&
                      p.value.length >= 3 &&
                      client.phone === p.value,
                  );
                  
                  return (
                    <div key={`phone-${idx}`} className="mb-2 relative">
                      <div className="flex items-center gap-2">
                        <input
                          type="tel"
                          value={p.value}
                          onChange={(e) => {
                            const newP = [...phones];
                            newP[idx].value = e.target.value;
                            setPhones(newP);
                          }}
                          className="flex-1 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded p-2 focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                        <select
                          value={p.type}
                          onChange={(e) => {
                            const newP = [...phones];
                            newP[idx].type = e.target.value;
                            setPhones(newP);
                          }}
                          className="w-28 border border-gray-300 rounded p-2 focus:ring-1 focus:ring-blue-500 outline-none bg-white dark:bg-slate-800"
                        >
                          <option>Trabajo</option>
                          <option>Móvil</option>
                          <option>Casa</option>
                          <option>Otro</option>
                        </select>
                        <button
                          type="button"
                          onClick={() =>
                            setPhones(phones.filter((_, i) => i !== idx))
                          }
                          className="text-gray-400 hover:text-red-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      
                      {matches.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-md shadow-lg max-h-48 overflow-y-auto left-0">
                          {matches.map(match => (
                            <div 
                              key={match.id}
                              className="px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer text-sm flex justify-between items-center"
                              onClick={() => {
                                const newP = [...phones];
                                newP[idx].value = match.phone || '';
                                setPhones(newP);
                              }}
                            >
                              <span className="font-medium text-slate-800 dark:text-slate-200">{match.phone}</span>
                              <span className="text-slate-500 dark:text-slate-400 text-xs truncate max-w-[150px]">{match.name}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {existingMatch && matches.length === 0 && (
                        <p className="text-[11px] text-orange-600 font-medium mt-1">
                          Este teléfono ya está ligado a:{" "}
                          {existingMatch.name}
                        </p>
                      )}
                    </div>
                  );
                })}
                <button
                  type="button"
                  onClick={() =>
                    setPhones([...phones, { value: "", type: "Móvil" }])
                  }
                  className="text-blue-600 font-bold hover:underline"
                >
                  + Añade un número de teléfono
                </button>
              </div>

              <div>
                <label className="block text-gray-700 dark:text-slate-300 mb-1">
                  Correo electrónico
                </label>
                {emails.map((m, idx) => {
                  const matches = m.value.length >= 3 
                    ? persons.filter(cl => cl.email && cl.email.toLowerCase().includes(m.value.toLowerCase()) && cl.email !== m.value)
                    : [];
                  const existingMatch = persons.find(
                    (client) =>
                      client.email &&
                      m.value.length >= 3 &&
                      client.email === m.value,
                  );
                  
                  return (
                    <div key={`email-${idx}`} className="mb-2 relative">
                      <div className="flex items-center gap-2">
                        <input
                          type="email"
                          value={m.value}
                          onChange={(e) => {
                            const newE = [...emails];
                            newE[idx].value = e.target.value;
                            setEmails(newE);
                          }}
                          className="flex-1 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded p-2 focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                        <select
                          value={m.type}
                          onChange={(e) => {
                            const newE = [...emails];
                            newE[idx].type = e.target.value;
                            setEmails(newE);
                          }}
                          className="w-28 border border-gray-300 rounded p-2 focus:ring-1 focus:ring-blue-500 outline-none bg-white dark:bg-slate-800"
                        >
                          <option>Trabajo</option>
                          <option>Personal</option>
                          <option>Otro</option>
                        </select>
                        <button
                          type="button"
                          onClick={() =>
                            setEmails(emails.filter((_, i) => i !== idx))
                          }
                          className="text-gray-400 hover:text-red-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {matches.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-md shadow-lg max-h-48 overflow-y-auto left-0">
                          {matches.map(match => (
                            <div 
                              key={match.id}
                              className="px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer text-sm flex justify-between items-center"
                              onClick={() => {
                                const newE = [...emails];
                                newE[idx].value = match.email || '';
                                setEmails(newE);
                              }}
                            >
                              <span className="font-medium text-slate-800 dark:text-slate-200">{match.email}</span>
                              <span className="text-slate-500 dark:text-slate-400 text-xs truncate max-w-[150px]">{match.name}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {existingMatch && matches.length === 0 && (
                        <p className="text-[11px] text-orange-600 font-medium mt-1">
                          Este correo ya está ligado a:{" "}
                          {existingMatch.name}
                        </p>
                      )}
                    </div>
                  );
                })}
                <button
                  type="button"
                  onClick={() =>
                    setEmails([...emails, { value: "", type: "Trabajo" }])
                  }
                  className="text-blue-600 font-bold hover:underline"
                >
                  + Añade un correo electrónico
                </button>
              </div>

              <div>
                <label className="block text-gray-700 dark:text-slate-300 mb-1">
                  Etiquetas
                </label>
                <select
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val && val !== "add" && !selectedTags.includes(val)) {
                      setSelectedTags((prev) => [...prev, val]);
                    }
                    e.target.value = "add";
                  }}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 p-2 focus:ring-1 focus:ring-blue-500 outline-none bg-white dark:bg-slate-800 text-gray-500 dark:text-slate-400 font-medium"
                >
                  <option value="add">Añadir etiquetas</option>
                  {availableTags.map((tag, i) => (
                    <option key={`opt-${tag}-${i}`} value={tag}>
                      {tag} {selectedTags.includes(tag) ? "✓" : ""}
                    </option>
                  ))}
                </select>
                {selectedTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {selectedTags.map((st, idx) => (
                      <span
                        key={`${st}-${idx}`}
                        className="inline-flex items-center gap-1 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800/10 px-2 py-0.5 rounded-full text-[10px] font-bold"
                      >
                        {st}
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedTags((prev) =>
                              prev.filter((t) => t !== st),
                            )
                          }
                          className="text-indigo-400 hover:text-red-500 font-bold ml-1 text-[11px]"
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-gray-700 dark:text-slate-300 mb-1">
                  Propietario
                </label>
                <select className="w-full border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 p-2 focus:ring-1 focus:ring-blue-500 outline-none bg-white dark:bg-slate-800">
                  <option>{userData?.name || "Luis"} (Tú)</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-700 dark:text-slate-300 mb-1">
                  Visible para
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-2.5 flex flex-wrap w-4 h-4 gap-[2px] items-center justify-center p-[2px]">
                    <div className="w-[5px] h-[5px] bg-gray-50 dark:bg-slate-9000 rounded-sm"></div>
                    <div className="w-[5px] h-[5px] bg-gray-50 dark:bg-slate-9000 rounded-sm"></div>
                    <div className="w-[5px] h-[5px] bg-gray-50 dark:bg-slate-9000 rounded-sm"></div>
                    <div className="w-[5px] h-[5px] bg-gray-50 dark:bg-slate-9000 rounded-sm"></div>
                  </div>
                  <select className="w-full border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 p-2 pl-9 focus:ring-1 focus:ring-blue-500 outline-none bg-white dark:bg-slate-800">
                    <option>Grupo de visibilidad del propiet...</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 dark:border-slate-700 flex justify-between items-center bg-gray-50 dark:bg-slate-900 mt-2">
              <button
                type="button"
                className="flex items-center gap-2 font-bold text-gray-600 dark:text-slate-400 hover:text-gray-800 dark:text-slate-200"
              >
                <Download className="w-4 h-4" /> Importar
              </button>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddPerson(false)}
                  className="px-5 py-1.5 font-bold text-gray-700 dark:text-slate-300 border border-gray-300 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:bg-slate-900 rounded"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-1.5 font-bold text-white bg-[#2E914F] hover:bg-[#257A41] rounded shadow-sm"
                >
                  Guardar
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-5">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                Confirmar eliminación
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                ¿Estás seguro que deseas eliminar {selectedClients.length} contactos? Esta acción no se puede deshacer.
              </p>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedPerson && (
        <ClientDetailModal
          client={selectedPerson}
          onClose={() => setSelectedPerson(null)}
        />
      )}
    </div>
  );
}
