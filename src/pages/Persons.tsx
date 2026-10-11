import { useIsMobile } from '../hooks/useIsMobile';
import { MobilePersons } from './mobile/MobilePersons';
import React, { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useLocation, useNavigate } from "react-router";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteField,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { Client, Deal, Task, Vehicle } from "../types";
import { getVehicleOfInterestText, checkIsWon, checkIsLost } from "../lib/clientUtils";
import { aplicarEtapaAlTrato } from "../lib/etapaDelContacto";
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
  User as UserIcon,
  FileSpreadsheet,
  Contact,
  Car,
} from "lucide-react";
import { ClientDetailModal } from "../components/ClientDetailModal";
import { alClicWhatsApp, numeroParaWhatsApp } from "../lib/whatsappApp";
import { MessageCircle } from "lucide-react";
import clsx from "clsx";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import * as XLSX from "xlsx";
import { useReadOnly } from "../hooks/useReadOnly";
import { FUENTES } from "../lib/fuentes";
import { getClientMatches, ClientMatch } from "../services/matchingEngine";






export function Persons() {
  const isMobile = useIsMobile();
  const { userData, googleToken, connectGoogleServices, refrescarTokenGoogle } = useAuth();
  const isReadOnly = useReadOnly();
  const location = useLocation();
  const navigate = useNavigate();
  const [persons, setPersons] = useState<Client[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [ultimoBorrado, setUltimoBorrado] = useState<{
    sello: string;
    contactos: Client[];
    tratosQuitados: number;
    tratosRespetados: string[];
  } | null>(null);
  const [deshaciendo, setDeshaciendo] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<Client | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "grid">("grid");
  const [showImportExcel, setShowImportExcel] = useState(false);
  const [excelData, setExcelData] = useState<any[]>([]);
  const [excelColumns, setExcelColumns] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({
    name: "",
    email: "",
    phone: "",
    organization: "",
    notes: "",
    vehicle: "",
    tags: "",
  });

  // Check navigation state for selected person
  useEffect(() => {
    if (location.state?.clientId && persons.length > 0) {
      const client = persons.find((p) => p.id === location.state.clientId);
      if (client) {
        setSelectedPerson(client);
        setSearchTerm(client.name);
        // Clear state so it doesn't reopen if they navigate away and back without the intent
        navigate(location.pathname, { replace: true, state: {} });
      }
    }
  }, [location.state, persons, navigate, location.pathname]);

  const [pipelineStages, setPipelineStages] = useState<
    { id: string; title: string }[]
  >([]);
  const [importingContacts, setImportingContacts] = useState(false);
  const [importandoDeGoogle, setImportandoDeGoogle] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
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
    { id: "organization", label: "Organización", visible: false, width: 150 },
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
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(() => {
    const saved = localStorage.getItem('personsSortConfig');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  useEffect(() => {
    if (sortConfig) {
      localStorage.setItem('personsSortConfig', JSON.stringify(sortConfig));
    } else {
      localStorage.removeItem('personsSortConfig');
    }
  }, [sortConfig]);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

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
  // Etapa, propietario y visibilidad del alta. Los tres menus existian en
  // pantalla sin estar conectados a nada: el contacto se guardaba siempre a
  // nombre de quien lo daba de alta y sin campo de visibilidad.
  const [nuevaEtapa, setNuevaEtapa] = useState("");
  const [nuevoPropietario, setNuevoPropietario] = useState("");
  // Por omisión el contacto es de quien lo crea; compartirlo con el equipo es una decisión.
  const [nuevaVisibilidad, setNuevaVisibilidad] = useState<"all" | "private">("private");
  // ¿Como llego? Obligatorio al dar de alta a mano (decision de Luis, sep 2026).
  const [nuevaFuente, setNuevaFuente] = useState("");

  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const handleDeleteSelected = () => {
    setShowDeleteConfirm(true);
  };

  // Los tratos de un contacto borrado. Mismo criterio que /api/chats/accion
  // con quitarContacto: se marcan, no se destruyen, y solo salen los abiertos
  // y sin pagos. Una venta ganada o un pago registrado no desaparece por
  // borrar a la persona. El sello deja deshacer justo lo que se quito.
  const tratosDelContacto = (clientId: string) =>
    getDocs(
      query(
        collection(db, "deals"),
        where("agencyId", "==", userData?.agencyId || ""),
        where("clientId", "==", clientId),
      ),
    );

  const confirmDelete = async () => {
    if (!userData?.agencyId) return;
    const sello = new Date().toISOString();
    const borrados: Client[] = [];
    const tocados: Client[] = [];
    const tratosQuitados: string[] = [];
    const tratosRespetados: string[] = [];
    try {
      const agencia = await getDoc(doc(db, "agencies", userData.agencyId));
      const etapas = Array.isArray(agencia.data()?.pipelineStages) ? agencia.data()!.pipelineStages : [];
      for (const id of selectedClients) {
        const p = persons.find((x) => x.id === id);
        // Entra a la lista de deshacer antes de tocar nada: si algo falla a
        // medias, deshacer igual recupera los tratos que ya se quitaron.
        if (p) tocados.push(p);
        for (const t of (await tratosDelContacto(id)).docs) {
          const d: any = t.data();
          if (d.isDeleted) continue;
          const conPagos = (d.saleDetails?.payments?.length || 0) > 0;
          if (conPagos || checkIsWon(d.status, etapas)) {
            tratosRespetados.push(d.title || "Trato sin nombre");
            continue;
          }
          await updateDoc(t.ref, { isDeleted: true, borradoConContactoAt: sello, updatedAt: sello });
          tratosQuitados.push(t.id);
        }
        await updateDoc(doc(db, "clients", id), { isDeleted: true, borradoConContactoAt: sello, updatedAt: sello });
        if (p) borrados.push(p);
      }
    } catch (err) {
      console.error("Error deleting clients:", err);
      alert("No se pudieron borrar todos los contactos. Revisa la lista y vuelve a intentarlo.");
    }
    const idsBorrados = new Set(borrados.map((p) => p.id));
    setPersons((prev) => prev.filter((p) => !idsBorrados.has(p.id)));
    setDeals((prev) => prev.filter((d) => !tratosQuitados.includes(d.id)));
    setSelectedClients([]);
    setShowDeleteConfirm(false);
    if (tocados.length > 0) {
      setUltimoBorrado({ sello, contactos: tocados, tratosQuitados: tratosQuitados.length, tratosRespetados });
    }
  };

  // Deshacer el ultimo borrado: vuelven los contactos y solo los tratos que
  // se quitaron con ellos (los que llevan el mismo sello).
  const deshacerBorrado = async () => {
    if (!ultimoBorrado) return;
    setDeshaciendo(true);
    const { sello, contactos } = ultimoBorrado;
    const ahora = new Date().toISOString();
    const vuelven: Client[] = [];
    const tratosQueVuelven: Deal[] = [];
    try {
      for (const p of contactos) {
        for (const t of (await tratosDelContacto(p.id)).docs) {
          if (t.data()?.borradoConContactoAt !== sello) continue;
          await updateDoc(t.ref, { isDeleted: false, borradoConContactoAt: deleteField(), updatedAt: ahora });
          tratosQueVuelven.push({ ...t.data(), id: t.id, isDeleted: false } as Deal);
        }
        await updateDoc(doc(db, "clients", p.id), { isDeleted: false, borradoConContactoAt: deleteField(), updatedAt: ahora });
        vuelven.push({ ...p, isDeleted: false });
      }
      setUltimoBorrado(null);
    } catch (err) {
      console.error("Error restoring clients:", err);
      alert("No se pudo deshacer todo. Recarga la página para ver cómo quedó.");
    } finally {
      setPersons((prev) => [...vuelven, ...prev.filter((p) => !vuelven.some((v) => v.id === p.id))]);
      setDeals((prev) => [...tratosQueVuelven, ...prev.filter((d) => !tratosQueVuelven.some((v) => v.id === d.id))]);
      setDeshaciendo(false);
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
  }, [userData, refreshKey]);

  useEffect(() => {
    if (!userData || userData.role === "master") return;

    const fetchData = async () => {
      let clientsDocs: any[] = [];
      let dealsDocs: any[] = [];
      let tasksDocs: any[] = [];
      let vehiclesDocs: any[] = [];

      const uq = query(
        collection(db, "users"),
        where("agencyId", "==", userData.agencyId),
      );
      const vq = query(
        collection(db, "vehicles"),
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

          const [csnap1, csnap2, dsnap, tsnap, vsnap] = await Promise.all([
            getDocs(cq1),
            getDocs(cq2),
            getDocs(dq1).catch(() => ({ docs: [] }) as any),
            getDocs(tq1).catch(() => ({ docs: [] }) as any),
            getDocs(vq).catch(() => ({ docs: [] }) as any),
          ]);
          vehiclesDocs = vsnap.docs;

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
          const vq = query(
            collection(db, "vehicles"),
            where("agencyId", "==", userData.agencyId),
          );

          const [snap, dSnap, tSnap, vSnap] = await Promise.all([
            getDocs(q),
            getDocs(dq).catch(() => ({ docs: [] }) as any),
            getDocs(tq).catch(() => ({ docs: [] }) as any),
            getDocs(vq).catch(() => ({ docs: [] }) as any),
          ]);

          clientsDocs = snap.docs;
          dealsDocs = dSnap.docs;
          tasksDocs = tSnap.docs;
          vehiclesDocs = vSnap.docs;
        }

        const usersMap: Record<string, string> = {};
        if (uSnap && uSnap.docs) {
          uSnap.docs.forEach((d: any) => {
            usersMap[d.id] = d.data().name;
          });
        }
        setAgencyUsers(usersMap);

        const allClients = clientsDocs.map(
          (d) => ({ ...d.data(), id: d.id }) as Client,
        ).filter((c) => !c.isDeleted);
        setPersons(allClients);

        setDeals(
          dealsDocs
            ? dealsDocs.map((d: any) => ({ ...d.data(), id: d.id }) as Deal).filter((d) => !d.isDeleted)
            : [],
        );
        setVehicles(
          vehiclesDocs.map((d: any) => ({ ...d.data(), id: d.id }) as Vehicle)
        );
        setTasks(
          tasksDocs
            ? tasksDocs.map((d: any) => ({ ...d.data(), id: d.id }) as Task)
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
    if (!nuevaFuente) {
      alert("Elige cómo llegó este contacto.");
      return;
    }

    try {
      const primaryPhone = phones
        .map((p) => p.value)
        .filter(Boolean)
        .join(", ");
      const primaryEmail = emails
        .map((e) => e.value)
        .filter(Boolean)
        .join(", ");

      // Solo un administrador reparte contactos; un vendedor da de alta a su
      // propio nombre y el menu ni siquiera le aparece.
      const propietario =
        userData.role === "admin" && nuevoPropietario
          ? nuevoPropietario
          : userData.id || "";

      const newRef = doc(collection(db, "clients"));
      const newPerson: Client = {
        id: newRef.id,
        agencyId: userData.agencyId || "",
        sellerId: propietario,
        name,
        email: primaryEmail,
        phone: primaryPhone,
        organization,
        address: "",
        vehicle: "",
        status: nuevaEtapa,
        visibility: nuevaVisibilidad,
        origin: "manual",
        fuente: nuevaFuente,
        tags: selectedTags,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await setDoc(newRef, newPerson);

      // Si se eligio una etapa de negociacion, la persona entra al embudo con
      // su trato. Las etapas finales no crean nada: ver etapaDelContacto.ts.
      let avisoDeTrato = "";
      if (nuevaEtapa) {
        try {
          const r = await aplicarEtapaAlTrato({
            clientId: newRef.id,
            agencyId: userData.agencyId || "",
            sellerId: propietario,
            etapa: nuevaEtapa,
            pipelineStages,
            nombre: name,
            esMaster: userData.role === "master",
          });
          if (r.accion === "creado") avisoDeTrato = "Se creó su trato en el embudo.";
          if (r.accion === "ninguna" && r.motivo === "etapa-final") {
            avisoDeTrato =
              "Esa etapa no abre un trato. El contacto quedó guardado; " +
              "para negociar, elige una etapa en curso.";
          }
        } catch (err) {
          // El contacto ya quedo guardado y no se puede deshacer: un error
          // rojo aqui haria creer que no se creo. Se avisa sin tumbar el alta.
          console.error("No se pudo crear el trato de la etapa:", err);
          avisoDeTrato = "El contacto se guardó, pero no se pudo crear su trato.";
        }
      }

      setPersons((prev) => [newPerson, ...prev]);
      setShowAddPerson(false);
      setName("");
      setPhones([{ value: "", type: "Trabajo" }]);
      setEmails([{ value: "", type: "Trabajo" }]);
      setOrganization("");
      setLabels("");
      setSelectedTags([]);
      setNuevaEtapa("");
      setNuevoPropietario("");
      setNuevaVisibilidad("private");
      setNuevaFuente("");
      if (avisoDeTrato) alert(avisoDeTrato);
    } catch (e) {
      console.error(e);
      alert("No se pudo guardar el contacto. Vuelve a intentarlo.");
    }
  };

  // Importar la libreta de Google como contactos del CRM. Se quito por error
  // el 7 de septiembre junto con tres menus que si estaban muertos; esta
  // funcionaba. Vuelve con un solo boton, en Personas, al lado del de Excel:
  // antes habia dos, y uno de ellos dentro del alta de una persona, que es
  // donde nadie lo buscaba.
  const handleImportGoogleContacts = async () => {
    try {
      setImportandoDeGoogle(true);
      // El servidor guarda el pase de renovacion, asi que primero se pide un
      // permiso fresco. Solo se abre la ventana de Google si esta persona no
      // ha conectado nunca su cuenta.
      let token = (await refrescarTokenGoogle()) ?? googleToken;
      if (!token) {
        token = await connectGoogleServices();
      }
      if (!token) {
        setImportandoDeGoogle(false);
        return;
      }

      const fetchContacts = async (accessToken: string) => {
        return await fetch(
          "https://people.googleapis.com/v1/people/me/connections?personFields=names,emailAddresses,phoneNumbers,organizations&pageSize=1000",
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );
      };

      let res = await fetchContacts(token);

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          // Renovar no molesta al usuario; solo si eso falla se le pide que
          // vuelva a conectar.
          const renovado = (await refrescarTokenGoogle()) ?? (await connectGoogleServices());
          if (renovado) {
            token = renovado;
            res = await fetchContacts(token);
          }
        }
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error("People API Error:", res.status, errorData);
        alert(
          `Error de Google (${res.status}): ${
            errorData.error?.message || "No se pudo acceder a Google Contacts. Verifica la conexión."
          }`
        );
        return;
      }

      const data = await res.json();

      if (data.connections && data.connections.length > 0) {
        let importedCount = 0;
        let newPersons: Client[] = [];
        
        for (const person of data.connections) {
          const nameObj = person.names?.[0];
          const personName =
            nameObj?.displayName ||
            [nameObj?.givenName, nameObj?.familyName].filter(Boolean).join(" ") ||
            person.emailAddresses?.[0]?.value ||
            person.organizations?.[0]?.name ||
            "";
          const personEmail = person.emailAddresses?.[0]?.value || "";
          const personPhone = person.phoneNumbers?.[0]?.value || "";
          const personOrganization = person.organizations?.[0]?.name || "";

          if (personName || personEmail || personPhone) {
            const cleanPhone = (p: string) => p.replace(/\D/g, "");
            const exists = [...persons, ...newPersons].find((p) => {
              const sameEmail =
                Boolean(personEmail) && Boolean(p.email) && p.email.toLowerCase().trim() === personEmail.toLowerCase().trim();
              const samePhone =
                Boolean(personPhone) && Boolean(p.phone) && cleanPhone(p.phone) === cleanPhone(personPhone);
              const sameName =
                Boolean(personName) && Boolean(p.name) && String(p.name).toLowerCase().trim() === String(personName).toLowerCase().trim();
              return sameEmail || samePhone || sameName;
            });

            if (!exists) {
              const newRef = doc(collection(db, "clients"));
              const newPerson: Client = {
                id: newRef.id,
                agencyId: userData?.agencyId || "",
                sellerId: userData?.id || "",
                name: personName || "Contacto Google",
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
        alert(
          importedCount > 0
            ? `Se importaron ${importedCount} contactos nuevos desde tu cuenta de Google.`
            : "Todos los contactos de tu cuenta de Google ya existen en el CRM."
        );
      } else {
        alert("No se encontraron contactos en tu cuenta de Google.");
      }
    } catch (e: any) {
      console.error("Error al importar contactos:", e);
      alert("Hubo un error al importar los contactos: " + (e.message || e));
    } finally {
      setImportandoDeGoogle(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      if (typeof bstr !== "string" && !(bstr instanceof ArrayBuffer)) return;
      const wb = XLSX.read(bstr, { type: "binary" });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);
      if (data.length > 0) {
        const columns = Object.keys(data[0] as object);
        setExcelColumns(columns);
        setExcelData(data);
        setShowImportExcel(true);
        // Autoselect if column names match somewhat
        const newMapping = { name: "", email: "", phone: "", organization: "", notes: "", vehicle: "", tags: "" };
        columns.forEach((col) => {
          const lcol = col.toLowerCase();
          if (lcol.includes("nombre") || lcol.includes("name")) newMapping.name = col;
          if (lcol.includes("correo") || lcol.includes("email")) newMapping.email = col;
          if (lcol.includes("telefono") || lcol.includes("teléfono") || lcol.includes("phone")) newMapping.phone = col;
          if (lcol.includes("organizacion") || lcol.includes("empresa") || lcol.includes("company") || lcol.includes("organization")) newMapping.organization = col;
          if (lcol.includes("nota") || lcol.includes("comentario") || lcol.includes("notes") || lcol.includes("comment")) newMapping.notes = col;
          if (lcol.includes("vehiculo") || lcol.includes("vehículo") || lcol.includes("auto") || lcol.includes("car") || lcol.includes("vehicle")) newMapping.vehicle = col;
          if (lcol.includes("etiqueta") || lcol.includes("tag") || lcol.includes("label")) newMapping.tags = col;
        });
        setColumnMapping(newMapping);
      } else {
        alert("El archivo parece estar vacío.");
      }
    };
    reader.readAsBinaryString(file);
    // Reset file input
    e.target.value = "";
  };

  const handleImportExcelData = async () => {
    if (!columnMapping.name) {
      alert("Debes seleccionar al menos la columna para el Nombre.");
      return;
    }
    
    setImportingContacts(true);
    let importedCount = 0;
    let newPersons: Client[] = [];
    
    try {
      for (const row of excelData) {
        const personName = row[columnMapping.name] ? String(row[columnMapping.name]) : "";
        const personEmail = columnMapping.email && row[columnMapping.email] ? String(row[columnMapping.email]) : "";
        const personPhone = columnMapping.phone && row[columnMapping.phone] ? String(row[columnMapping.phone]) : "";
        const personOrganization = columnMapping.organization && row[columnMapping.organization] ? String(row[columnMapping.organization]) : "";
        const personNotes = columnMapping.notes && row[columnMapping.notes] ? String(row[columnMapping.notes]) : "";
        const personVehicle = columnMapping.vehicle && row[columnMapping.vehicle] ? String(row[columnMapping.vehicle]) : "";
        const personTagsStr = columnMapping.tags && row[columnMapping.tags] ? String(row[columnMapping.tags]) : "";
        const personTags = personTagsStr.split(',').map(t => t.trim()).filter(Boolean);

        if (personName && (personEmail || personPhone || personName.length > 1)) {
          const exists = [...persons, ...newPersons].find(
            (p) =>
              (personEmail && p.email?.includes(personEmail)) ||
              (personPhone && p.phone?.includes(personPhone)) ||
              (p.name && String(p.name).toLowerCase() === String(personName).toLowerCase()),
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
              vehicle: personVehicle,
              tags: personTags,
              status: "",
              origin: "excel_import",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            await setDoc(newRef, newPerson);
            newPersons.push(newPerson);
            importedCount++;

            if (personNotes) {
              const newNoteRef = doc(collection(db, "notes"));
              await setDoc(newNoteRef, {
                id: newNoteRef.id,
                clientId: newPerson.id,
                agencyId: userData?.agencyId || "",
                sellerId: userData?.id || "",
                content: personNotes,
                createdAt: new Date().toISOString()
              });
            }
          } else {
            // Update existing person if they lack a vehicle and we have one, or missing tags
            let needsUpdate = false;
            let updates: any = {};
            if (personVehicle && !exists.vehicle) {
              updates.vehicle = personVehicle;
              needsUpdate = true;
            }
            if (personTags.length > 0) {
              const currentTags = exists.tags || [];
              const newTags = personTags.filter(t => !currentTags.includes(t));
              if (newTags.length > 0) {
                updates.tags = [...currentTags, ...newTags];
                needsUpdate = true;
              }
            }
            if (needsUpdate && exists.id) {
              await updateDoc(doc(db, "clients", exists.id), updates);
              const idx = persons.findIndex((p) => p.id === exists.id);
              if (idx >= 0) {
                persons[idx] = { ...persons[idx], ...updates };
              }
            }

            // Always add the note to the existing person if provided
            if (personNotes && exists.id) {
              const newNoteRef = doc(collection(db, "notes"));
              await setDoc(newNoteRef, {
                id: newNoteRef.id,
                clientId: exists.id,
                agencyId: userData?.agencyId || "",
                sellerId: userData?.id || "",
                content: personNotes,
                createdAt: new Date().toISOString()
              });
            }
          }
        }
      }

      if (newPersons.length > 0) {
        setPersons((prev) => [...newPersons, ...prev]);
      }
      alert(`Se importaron ${importedCount} contactos nuevos desde Excel.`);
      setShowImportExcel(false);
      setExcelData([]);
    } catch (e) {
      console.error(e);
      alert("Hubo un error al importar.");
    } finally {
      setImportingContacts(false);
    }
  };

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

    const personDealIds = new Set(deals.filter((d) => d.clientId === personId).map((d) => d.id));
    const personTasks = tasks.filter(
      (t) => (t.clientId === personId || (t.dealId && personDealIds.has(t.dealId))) && !t.completed,
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
  // ---- Búsqueda, filtros, orden y abecedario de la vista de tarjetas ----
  const hoyISO = format(new Date(), "yyyy-MM-dd");
  const [filtroRapido, setFiltroRapido] = useState<"todos" | "abierto" | "tarea" | "busca">("todos");
  const [filtroAsesor, setFiltroAsesor] = useState("todos");
  const [orden, setOrden] = useState<"az" | "recientes" | "actividad">(() => {
    try { const v = localStorage.getItem("personas_orden"); return v === "recientes" || v === "actividad" ? v : "az"; } catch { return "az"; }
  });
  useEffect(() => { try { localStorage.setItem("personas_orden", orden); } catch { /* sin almacenamiento */ } }, [orden]);
  const contenedorTarjetas = React.useRef<HTMLDivElement>(null);

  const sinAcentos = (s: any) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const esBuscando = (p: Client) => {
    const w: any = p.wantedVehicle;
    const conDatos = !!w && Object.values(w).some((x) => x !== undefined && x !== null && String(x).trim() !== "" && x !== "Cualquiera");
    return conDatos || (p.tags || []).some((t) => sinAcentos(t).includes("busca"));
  };

  // Tratos abiertos y la próxima tarea de cada persona, en un solo recorrido.
  const indice = React.useMemo(() => {
    const abiertos = new Map<string, number>();
    deals.forEach((d: any) => {
      if (d.isDeleted || !d.clientId) return;
      if (!checkIsWon(d.status, pipelineStages) && !checkIsLost(d.status, pipelineStages)) abiertos.set(d.clientId, (abiertos.get(d.clientId) || 0) + 1);
    });
    const dealCliente = new Map<string, string>(deals.map((d: any) => [d.id, d.clientId]));
    const prox = new Map<string, string>();
    tasks.forEach((t: any) => {
      if (t.completed || !t.dueDate) return;
      const c = t.clientId || (t.dealId ? dealCliente.get(t.dealId) : undefined);
      if (!c) return;
      const previa = prox.get(c);
      if (!previa || t.dueDate < previa) prox.set(c, t.dueDate);
    });
    return { abiertos, prox };
  }, [deals, tasks, pipelineStages]);

  const conteos = React.useMemo(() => ({
    abierto: persons.filter((p) => indice.abiertos.has(p.id)).length,
    tarea: persons.filter((p) => indice.prox.has(p.id)).length,
    busca: persons.filter(esBuscando).length,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [persons, indice]);

  // Cuántos autos del inventario le sirven a cada persona (mismo motor de siempre).
  const coincidencias = React.useMemo(() => {
    const m = new Map<string, number>();
    const autos = userData?.role === "seller" ? vehicles.filter((v) => v.agencyId === userData?.agencyId) : vehicles;
    persons.forEach((p) => { const n = getClientMatches(p, autos).length; if (n) m.set(p.id, n); });
    return m;
  }, [persons, vehicles, userData?.role, userData?.agencyId]);

  const filteredPersons = React.useMemo(() => {
    const q = sinAcentos(searchTerm).trim();
    const digitos = searchTerm.replace(/\D/g, "");
    let result = persons.filter((p) => {
      if (filtroRapido === "abierto" && !indice.abiertos.has(p.id)) return false;
      if (filtroRapido === "tarea" && !indice.prox.has(p.id)) return false;
      if (filtroRapido === "busca" && !esBuscando(p)) return false;
      if (filtroAsesor !== "todos" && p.sellerId !== filtroAsesor) return false;
      if (!q) return true;
      return (
        sinAcentos(p.name).includes(q) ||
        sinAcentos(p.email).includes(q) ||
        sinAcentos(p.organization).includes(q) ||
        sinAcentos(p.vehicle).includes(q) ||
        (p.tags || []).some((t) => sinAcentos(t).includes(q)) ||
        (digitos.length >= 3 && String(p.phone || "").replace(/\D/g, "").includes(digitos))
      );
    });

    if (sortConfig) {
      result.sort((a, b) => {
        let aVal: any = a[sortConfig.key as keyof Client] || '';
        let bVal: any = b[sortConfig.key as keyof Client] || '';

        if (sortConfig.key === 'owner') {
           aVal = agencyUsers[a.sellerId] || '';
           bVal = agencyUsers[b.sellerId] || '';
        } else if (sortConfig.key === 'closedDeals') {
           aVal = getPersonStats(a.id).closedDeals;
           bVal = getPersonStats(b.id).closedDeals;
        } else if (sortConfig.key === 'openDeals') {
           aVal = getPersonStats(a.id).openDeals;
           bVal = getPersonStats(b.id).openDeals;
        } else if (sortConfig.key === 'nextTaskDate') {
           aVal = getPersonStats(a.id).nextTaskDate || '';
           bVal = getPersonStats(b.id).nextTaskDate || '';
        } else if (typeof aVal === 'string' && typeof bVal === 'string') {
          aVal = aVal.toLowerCase();
          bVal = bVal.toLowerCase();
        }

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persons, searchTerm, sortConfig, agencyUsers, deals, tasks, filtroRapido, filtroAsesor, indice]);

  // Vista de tarjetas: su propio orden y, en A–Z, secciones por letra.
  const LETRAS = React.useMemo(() => "ABCDEFGHIJKLMNÑOPQRSTUVWXYZ#".split(""), []);
  const letraDe = (p: Client) => {
    const c = sinAcentos(p.name).trim().charAt(0).toUpperCase();
    if (c === "N" && String(p.name || "").trim().toUpperCase().startsWith("Ñ")) return "Ñ";
    return /[A-Z]/.test(c) ? c : "#";
  };
  const tarjetas = React.useMemo(() => {
    const lista = [...filteredPersons];
    const f = (v: any) => { const x = v?.toDate ? v.toDate().toISOString() : v?.seconds ? new Date(v.seconds * 1000).toISOString() : String(v || ""); return x; };
    if (orden === "recientes") lista.sort((a, b) => f(b.createdAt).localeCompare(f(a.createdAt)));
    else if (orden === "actividad") lista.sort((a, b) => f(b.updatedAt).localeCompare(f(a.updatedAt)));
    else lista.sort((a, b) => sinAcentos(a.name).localeCompare(sinAcentos(b.name), "es"));
    return lista;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredPersons, orden]);
  const secciones = React.useMemo(() => {
    if (orden !== "az") return [{ letra: "", items: tarjetas }];
    const porLetra = new Map<string, Client[]>();
    tarjetas.forEach((p) => { const l = letraDe(p); porLetra.set(l, [...(porLetra.get(l) || []), p]); });
    return LETRAS.filter((l) => porLetra.has(l)).map((l) => ({ letra: l, items: porLetra.get(l)! }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tarjetas, orden]);
  const letrasConContactos = React.useMemo(() => new Set(secciones.map((s) => s.letra)), [secciones]);
  const irALetra = (l: string) => {
    const el = contenedorTarjetas.current?.querySelector(`#letra-${CSS.escape(l)}`) as HTMLElement | null;
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };



  if (isMobile) return <MobilePersons />;

  if (loading)
    return (
      <div className="flex justify-center items-center h-full">Cargando...</div>
    );

  return (
    <div className="flex flex-col h-full bg-[#f4f5f5]">
      {/* Encabezado: buscar, filtrar, ordenar y las acciones */}
      <div className="px-4 py-3 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex flex-col gap-2.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className="flex gap-0.5 bg-slate-100 dark:bg-slate-900 p-0.5 rounded-lg shrink-0" role="tablist">
              {([["grid", "Tarjetas", Grid], ["list", "Tabla", List]] as const).map(([id, t, Icono]) => (
                <button key={id} role="tab" aria-selected={viewMode === id} onClick={() => setViewMode(id)} title={t}
                  className={clsx("h-8 px-2.5 rounded-md text-xs font-bold flex items-center gap-1.5", viewMode === id ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-800")}>
                  <Icono className="w-3.5 h-3.5" /> <span className="hidden xl:inline">{t}</span>
                </button>
              ))}
            </div>
            <div className="relative flex-1 min-w-0 md:max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar por nombre, teléfono, correo o auto…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-10 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 pl-9 pr-8 text-sm focus:ring-2 focus:ring-blue-500/40 outline-none"
              />
              {searchTerm && <button type="button" onClick={() => setSearchTerm("")} aria-label="Limpiar búsqueda" className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"><X className="w-4 h-4" /></button>}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {selectedClients.length > 0 && (
              <button onClick={handleDeleteSelected} className="h-10 px-4 flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-sm">
                <Trash2 className="w-4 h-4 shrink-0" /> Eliminar ({selectedClients.length})
              </button>
            )}
            <label className="hidden md:flex h-10 px-3 items-center gap-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg font-bold hover:bg-slate-50 dark:hover:bg-slate-700 text-sm cursor-pointer">
              <FileSpreadsheet className="w-4 h-4 shrink-0" /> Importar Excel
              <input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleFileUpload} />
            </label>
            <button type="button" onClick={handleImportGoogleContacts} disabled={importandoDeGoogle}
              className="hidden md:flex h-10 px-3 items-center gap-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg font-bold hover:bg-slate-50 dark:hover:bg-slate-700 text-sm disabled:opacity-50">
              <Contact className="w-4 h-4 shrink-0" /> {importandoDeGoogle ? "Importando…" : "Importar de Google"}
            </button>
            {!isReadOnly && (
              <button onClick={() => setShowAddPerson(true)} className="h-10 px-4 flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-sm">
                <Plus className="w-4 h-4 shrink-0" /> Nuevo contacto
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {([
            ["todos", "Todos", persons.length],
            ["abierto", "Con trato abierto", conteos.abierto],
            ["tarea", "Con tarea pendiente", conteos.tarea],
            ["busca", "Buscan auto", conteos.busca],
          ] as const).map(([id, t, n]) => (
            <button key={id} type="button" onClick={() => setFiltroRapido(id)} aria-pressed={filtroRapido === id}
              className={clsx("h-8 px-3 rounded-full border text-xs font-bold transition-colors", filtroRapido === id ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white" : "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700")}>
              {t} <span className="opacity-60 font-semibold">{n}</span>
            </button>
          ))}
          {userData?.role !== "seller" && Object.keys(agencyUsers).length > 1 && (
            <select value={filtroAsesor} onChange={(e) => setFiltroAsesor(e.target.value)} className="h-8 px-2 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200">
              <option value="todos">Todos los asesores</option>
              {Object.entries(agencyUsers).map(([id, n]) => <option key={id} value={id}>{n}</option>)}
            </select>
          )}
          {viewMode === "grid" && (
            <select value={orden} onChange={(e) => setOrden(e.target.value as any)} className="h-8 px-2 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200">
              <option value="az">Orden: A–Z</option>
              <option value="recientes">Orden: más recientes</option>
              <option value="actividad">Orden: última actividad</option>
            </select>
          )}
          <span className="ml-auto text-xs font-semibold text-slate-500">{filteredPersons.length === persons.length ? `${persons.length} contactos` : `${filteredPersons.length} de ${persons.length}`}</span>
        </div>
      </div>

      {viewMode === "grid" ? (
        <div className="relative flex-1 min-h-0">
          <div ref={contenedorTarjetas} className="absolute inset-0 overflow-auto p-4 md:p-6 pr-9">
            {tarjetas.length === 0 && <p className="text-center text-slate-500 py-16">Ningún contacto coincide con lo que buscas.</p>}
            {secciones.map(({ letra, items }) => (
              <section key={letra || "todos"} id={letra ? `letra-${letra}` : undefined} className="mb-5 scroll-mt-2">
                {letra && (
                  <div className="flex items-center gap-3 mb-2.5">
                    <span className="h-8 w-8 rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900 flex items-center justify-center text-sm font-extrabold">{letra}</span>
                    <span className="text-xs font-semibold text-slate-500">{items.length} {items.length === 1 ? "contacto" : "contactos"}</span>
                    <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {items.map((person) => {
                    const nAbiertos = indice.abiertos.get(person.id) || 0;
                    const prox = indice.prox.get(person.id);
                    const vencida = prox && prox < hoyISO;
                    const nCoincide = coincidencias.get(person.id) || 0;
                    const tel = person.phone ? String(person.phone).split(",")[0].trim() : "";
                    const etiquetas = person.tags || [];
                    return (
                      <div key={person.id} className="group bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-3.5 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer flex flex-col gap-2" onClick={() => setSelectedPerson(person)}>
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-950/50 flex items-center justify-center text-blue-700 dark:text-blue-300 font-extrabold text-base shrink-0">
                            {String(person.name || "?").trim().charAt(0).toUpperCase() || "?"}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="font-extrabold text-slate-900 dark:text-slate-100 truncate leading-tight" title={person.name}>{person.name || "Sin nombre"}</h3>
                            {tel && <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 truncate">{tel}</p>}
                            {person.email && <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{String(person.email).split(",")[0]}</p>}
                          </div>
                          {tel && (
                            <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                              <a href={`https://wa.me/${numeroParaWhatsApp(tel)}`} onClick={alClicWhatsApp} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp a ${person.name}`} title="WhatsApp"
                                className="h-8 w-8 rounded-lg flex items-center justify-center text-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300"><MessageCircle className="w-4 h-4" /></a>
                              <a href={`tel:${tel.replace(/[^\d+]/g, "")}`} aria-label={`Llamar a ${person.name}`} title="Llamar"
                                className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-600 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200"><Phone className="w-4 h-4" /></a>
                            </div>
                          )}
                        </div>
                        {etiquetas.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {etiquetas.slice(0, 3).map((t, i) => <span key={`${t}-${i}`} className="px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-[9px] font-bold border border-indigo-100 dark:border-indigo-800/20 uppercase tracking-wider">{t}</span>)}
                            {etiquetas.length > 3 && <span className="px-1.5 py-0.5 text-[9px] font-bold text-slate-500">+{etiquetas.length - 3}</span>}
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 text-blue-700 dark:text-blue-400 min-w-0">
                          <Car className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate font-bold text-[11px] uppercase tracking-wider">{getVehicleOfInterestText(person)}</span>
                        </div>
                        {(nAbiertos > 0 || prox || nCoincide > 0) && (
                          <div className="flex flex-wrap gap-1.5 pt-0.5">
                            {nAbiertos > 0 && <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 text-[10px] font-bold">{nAbiertos} {nAbiertos === 1 ? "trato abierto" : "tratos abiertos"}</span>}
                            {prox && <span className={clsx("px-2 py-0.5 rounded-full text-[10px] font-bold", vencida ? "bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300" : "bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-300")}>{vencida ? "Tarea atrasada" : prox === hoyISO ? "Tarea hoy" : `Tarea ${prox.slice(8, 10)}/${prox.slice(5, 7)}`}</span>}
                            {nCoincide > 0 && <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 text-[10px] font-bold">{nCoincide} {nCoincide === 1 ? "auto le sirve" : "autos le sirven"}</span>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>

          {/* Abecedario: un toque lleva a esa letra */}
          {orden === "az" && tarjetas.length > 0 && (
            <nav aria-label="Ir a la letra" className="absolute right-1.5 top-1/2 -translate-y-1/2 flex flex-col items-center py-1 rounded-full bg-white/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 shadow-sm backdrop-blur z-10 max-h-[96%]">
              {LETRAS.map((l) => {
                const hay = letrasConContactos.has(l);
                return (
                  <button key={l} type="button" disabled={!hay} onClick={() => irALetra(l)} aria-label={`Ir a la ${l}`}
                    className={clsx("w-6 flex-1 min-h-[14px] max-h-[22px] text-[10px] font-extrabold leading-none rounded", hay ? "text-slate-700 dark:text-slate-200 hover:bg-blue-600 hover:text-white" : "text-slate-300 dark:text-slate-600 cursor-default")}>
                    {l}
                  </button>
                );
              })}
            </nav>
          )}
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
                      key={`col-${col.id}`}
                      className="relative border-r border-gray-200 dark:border-slate-700 truncate group cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50"
                      style={{ width: col.width }}
                      onClick={() => handleSort(col.id)}
                    >
                      <div className="px-4 py-3 truncate flex items-center">
                        {col.label}
                        {sortConfig?.key === col.id && (
                          <span className="ml-1 inline-block">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                      <div
                        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-400 z-20 transition-colors opacity-0 group-hover:opacity-100"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          handleMouseDown(e, col.id, col.width);
                        }}
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
                    <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowColSettings(false)} />
                    <div className="absolute right-0 top-full mt-1 w-64 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded shadow-sm p-2 z-50">
                      <div className="text-xs font-bold text-gray-500 dark:text-slate-400 mb-2 uppercase px-2">
                        Columnas visibles
                      </div>
                      {columns.map((col) => (
                        <label
                          key={`col-${col.id}`}
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
                    </>
                  )}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800">
              {filteredPersons.map((person, idx) => {
                const stats = getPersonStats(person.id);
                return (
                  <tr
                    key={`${person.id}-${idx}`}
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
                        if (col.id === "vehicle") {
                          const candidateVehicles = userData?.role === "seller" ? vehicles.filter(v => v.agencyId === userData?.agencyId) : vehicles;
                          const matches = getClientMatches(person, candidateVehicles);
                          val = (
                            <div className="flex flex-col gap-1 items-start justify-center min-h-[32px]">
                              <span className="truncate">{getVehicleOfInterestText(person)}</span>
                              {matches.length > 0 && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-[10px] font-bold border border-green-200 dark:border-green-800/50 uppercase tracking-wider">
                                  {matches.length} {matches.length === 1 ? 'Match' : 'Matches'}
                                </span>
                              )}
                            </div>
                          );
                        }
                        if (col.id === "status") {
                          const stage = pipelineStages.find(
                            (s) => s.id === person.status,
                          );
                          let statusText = stage ? stage.title : person.status || "Nuevo";
                          if (person.status === "open") statusText = "Abierto";
                          if (person.status === "won") statusText = "Ganado";
                          if (person.status === "lost") statusText = "Contacto"; // Previously Perdido
                          if (stage && stage.id === "lost") statusText = "Contacto";
                          
                          val = (
                            <span className="capitalize">
                              {statusText}
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
                            key={`col-${col.id}`}
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

      {/* Import Excel Modal */}
      {showImportExcel && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 flex justify-between items-center border-b border-gray-200 dark:border-slate-700">
              <h2 className="text-xl font-bold text-gray-800 dark:text-slate-200">
                Importar Contactos de Excel
              </h2>
              <button
                type="button"
                onClick={() => {
                  setShowImportExcel(false);
                  setExcelData([]);
                }}
                className="text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:text-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4 text-sm">
              <p className="text-slate-600 dark:text-slate-400">
                Mapea las columnas de tu archivo Excel con los campos del CRM. 
                Se importarán <strong>{excelData.length}</strong> filas.
              </p>

              {['name', 'email', 'phone', 'organization', 'notes', 'vehicle', 'tags'].map((field) => (
                <div key={field} className="flex flex-col gap-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300 capitalize">
                    {field === 'name' ? 'Nombre (Requerido)' : field === 'email' ? 'Correo' : field === 'phone' ? 'Teléfono' : field === 'organization' ? 'Organización' : field === 'notes' ? 'Notas / Comentarios' : field === 'vehicle' ? 'Vehículo (Interés / Inventario)' : 'Etiquetas (separadas por coma)'}
                  </label>
                  <select
                    value={columnMapping[field] || ''}
                    onChange={(e) => setColumnMapping({ ...columnMapping, [field]: e.target.value })}
                    className="border border-slate-300 dark:border-slate-600 rounded p-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                  >
                    <option value="">-- Ignorar este campo --</option>
                    {excelColumns.map((col) => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div className="px-6 py-4 bg-gray-50 dark:bg-slate-900 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowImportExcel(false);
                  setExcelData([]);
                }}
                className="px-4 py-2 text-gray-700 dark:text-slate-300 font-medium hover:bg-gray-200 dark:hover:bg-slate-700 rounded"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={importingContacts || !columnMapping.name}
                onClick={handleImportExcelData}
                className="px-4 py-2 bg-blue-600 text-white font-medium hover:bg-blue-700 rounded disabled:opacity-50"
              >
                {importingContacts ? "Importando..." : "Comenzar Importación"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deshacer el ultimo borrado */}
      {ultimoBorrado && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-md z-[90] bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded shadow-xl p-4">
          <div className="flex items-start gap-3">
            <div className="flex-1 text-sm text-slate-700 dark:text-slate-300">
              <p className="font-semibold text-slate-900 dark:text-white">
                {ultimoBorrado.contactos.length === 1
                  ? "Se borró 1 contacto"
                  : `Se borraron ${ultimoBorrado.contactos.length} contactos`}
                {ultimoBorrado.tratosQuitados > 0 &&
                  (ultimoBorrado.tratosQuitados === 1
                    ? " y 1 trato abierto del embudo"
                    : ` y ${ultimoBorrado.tratosQuitados} tratos abiertos del embudo`)}
                .
              </p>
              {ultimoBorrado.tratosRespetados.length > 0 && (
                <p className="mt-1">
                  Se quedaron en el embudo porque están ganados o tienen pagos:{" "}
                  <strong>{ultimoBorrado.tratosRespetados.join(", ")}</strong>.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setUltimoBorrado(null)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 shrink-0"
              aria-label="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={deshacerBorrado}
              disabled={deshaciendo}
              className="px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-700 dark:bg-slate-600 dark:hover:bg-slate-500 rounded disabled:opacity-50"
            >
              {deshaciendo ? "Deshaciendo..." : "Deshacer"}
            </button>
          </div>
        </div>
      )}

      {/* Añadir persona */}
      {showAddPerson && (() => {
        const campo = "w-full h-10 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-3 text-sm focus:ring-2 focus:ring-blue-500/40 outline-none";
        const etiqueta = "block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5";
        const etapasAbiertas = pipelineStages.filter((s) => !checkIsWon(s.id, pipelineStages) && !checkIsLost(s.id, pipelineStages));
        return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
          <form onSubmit={handleAddPerson} className="bg-white dark:bg-slate-800 md:rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col h-[100dvh] md:h-auto md:max-h-[92vh]">
            <div className="px-5 md:px-6 py-3.5 flex justify-between items-center border-b border-slate-200 dark:border-slate-700">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Personas</p>
                <h2 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">Nuevo contacto</h2>
              </div>
              <button type="button" onClick={() => setShowAddPerson(false)} aria-label="Cerrar" className="h-9 w-9 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 md:px-6 py-5 flex flex-col gap-5">
              {/* Quién es */}
              <div>
                <label className={etiqueta}>Nombre <span className="text-red-500">*</span></label>
                <input type="text" required autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre y apellido" className={campo} />
              </div>

              <div>
                <label className={etiqueta}>Teléfono</label>
                {phones.map((p, idx) => {
                  const matches = p.value.length >= 3
                    ? persons.filter((cl) => cl.phone && cl.phone.toLowerCase().includes(p.value.toLowerCase()) && cl.phone !== p.value).slice(0, 5)
                    : [];
                  const existingMatch = persons.find((client) => client.phone && p.value.length >= 3 && client.phone === p.value);
                  return (
                    <div key={`phone-${idx}`} className="mb-2 relative">
                      <div className="flex items-center gap-2">
                        <input
                          type="tel"
                          inputMode="tel"
                          value={p.value}
                          placeholder="10 dígitos"
                          onChange={(e) => { const nuevo = [...phones]; nuevo[idx].value = e.target.value; setPhones(nuevo); }}
                          className={clsx(campo, existingMatch && "border-amber-400")}
                        />
                        {phones.length > 1 && (
                          <button type="button" aria-label="Quitar teléfono" onClick={() => setPhones(phones.filter((_, i) => i !== idx))} className="h-10 w-10 shrink-0 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-700"><Trash2 className="w-4 h-4" /></button>
                        )}
                      </div>
                      {matches.length > 0 && !existingMatch && (
                        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-48 overflow-y-auto left-0">
                          {matches.map((match) => (
                            <div key={`match-${match.id}`} className="px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer text-sm flex justify-between items-center gap-2"
                              onClick={() => { const nuevo = [...phones]; nuevo[idx].value = match.phone || ""; setPhones(nuevo); }}>
                              <span className="font-semibold text-slate-800 dark:text-slate-200">{match.phone}</span>
                              <span className="text-slate-500 dark:text-slate-400 text-xs truncate max-w-[160px]">{match.name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {existingMatch && (
                        <p className="mt-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg px-3 py-2">
                          Ojo: este teléfono ya es de <b>{existingMatch.name}</b>. Busca ese contacto antes de crear otro igual.
                        </p>
                      )}
                    </div>
                  );
                })}
                <button type="button" onClick={() => setPhones([...phones, { value: "", type: "Móvil" }])} className="text-xs font-bold text-blue-700 dark:text-blue-300 hover:underline">+ Otro teléfono</button>
              </div>

              <div>
                <label className={etiqueta}>Correo electrónico</label>
                {emails.map((m, idx) => {
                  const matches = m.value.length >= 3
                    ? persons.filter((cl) => cl.email && cl.email.toLowerCase().includes(m.value.toLowerCase()) && cl.email !== m.value).slice(0, 5)
                    : [];
                  const existingMatch = persons.find((client) => client.email && m.value.length >= 3 && client.email === m.value);
                  return (
                    <div key={`email-${idx}`} className="mb-2 relative">
                      <div className="flex items-center gap-2">
                        <input
                          type="email"
                          value={m.value}
                          placeholder="correo@ejemplo.com"
                          onChange={(e) => { const nuevo = [...emails]; nuevo[idx].value = e.target.value; setEmails(nuevo); }}
                          className={clsx(campo, existingMatch && "border-amber-400")}
                        />
                        {emails.length > 1 && (
                          <button type="button" aria-label="Quitar correo" onClick={() => setEmails(emails.filter((_, i) => i !== idx))} className="h-10 w-10 shrink-0 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-700"><Trash2 className="w-4 h-4" /></button>
                        )}
                      </div>
                      {matches.length > 0 && !existingMatch && (
                        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-48 overflow-y-auto left-0">
                          {matches.map((match) => (
                            <div key={`match-${match.id}`} className="px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer text-sm flex justify-between items-center gap-2"
                              onClick={() => { const nuevo = [...emails]; nuevo[idx].value = match.email || ""; setEmails(nuevo); }}>
                              <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{match.email}</span>
                              <span className="text-slate-500 dark:text-slate-400 text-xs truncate max-w-[140px]">{match.name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {existingMatch && (
                        <p className="mt-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg px-3 py-2">
                          Ojo: este correo ya es de <b>{existingMatch.name}</b>.
                        </p>
                      )}
                    </div>
                  );
                })}
                <button type="button" onClick={() => setEmails([...emails, { value: "", type: "Trabajo" }])} className="text-xs font-bold text-blue-700 dark:text-blue-300 hover:underline">+ Otro correo</button>
              </div>

              {/* Cómo llegó: obligatorio, a un toque */}
              <div>
                <label className={etiqueta}>¿Cómo llegó? <span className="text-red-500">*</span></label>
                <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="¿Cómo llegó?">
                  {FUENTES.map((f) => (
                    <button type="button" key={f.id} role="radio" aria-checked={nuevaFuente === f.id} onClick={() => setNuevaFuente(f.id)}
                      className={clsx("h-9 px-3 rounded-full border text-xs font-bold transition-colors", nuevaFuente === f.id ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white" : "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700")}>
                      {f.etiqueta}
                    </button>
                  ))}
                </div>
              </div>

              {/* Embudo */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-3.5">
                <label className={etiqueta}>¿Meterlo al embudo?</label>
                <select value={nuevaEtapa} onChange={(e) => setNuevaEtapa(e.target.value)} className={campo}>
                  <option value="">No, solo guardar el contacto</option>
                  {etapasAbiertas.map((s) => <option key={s.id} value={s.id}>Sí, en «{s.title}»</option>)}
                </select>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
                  {nuevaEtapa ? "Se creará su trato y aparecerá en el embudo en esa etapa." : "Quedará en Personas, sin trato. Después puedes crearle uno."}
                </p>
              </div>

              {/* Etiquetas */}
              <div>
                <label className={etiqueta}>Etiquetas <span className="normal-case font-medium text-slate-400">(opcional)</span></label>
                <select
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val && val !== "add" && !selectedTags.includes(val)) setSelectedTags((prev) => [...prev, val]);
                    e.target.value = "add";
                  }}
                  className={clsx(campo, "text-slate-500")}
                >
                  <option value="add">Añadir etiqueta…</option>
                  {availableTags.map((tag, i) => <option key={`opt-${tag}-${i}`} value={tag}>{tag} {selectedTags.includes(tag) ? "✓" : ""}</option>)}
                </select>
                {selectedTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {selectedTags.map((st, idx) => (
                      <span key={`${st}-${idx}`} className="inline-flex items-center gap-1 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800/30 pl-2.5 pr-1.5 py-0.5 rounded-full text-[11px] font-bold">
                        {st}
                        <button type="button" aria-label={`Quitar ${st}`} onClick={() => setSelectedTags((prev) => prev.filter((t) => t !== st))} className="text-indigo-400 hover:text-red-500 text-sm leading-none">&times;</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* De quién y quién lo ve */}
              <div className={clsx("grid gap-3", userData?.role === "admin" ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1")}>
                {userData?.role === "admin" && (
                  <div>
                    <label className={etiqueta}>Asesor a cargo</label>
                    <select value={nuevoPropietario || userData?.id || ""} onChange={(e) => setNuevoPropietario(e.target.value)} className={campo}>
                      {Object.entries(agencyUsers).map(([id, nombre]) => <option key={id} value={id}>{nombre}{id === userData?.id ? " (Tú)" : ""}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className={etiqueta}>Quién lo puede ver</label>
                  <select value={nuevaVisibilidad} onChange={(e) => setNuevaVisibilidad(e.target.value as "all" | "private")} className={campo}>
                    <option value="private">Solo su asesor</option>
                    <option value="all">Todo el equipo</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="px-5 md:px-6 py-3.5 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2 bg-slate-50 dark:bg-slate-900">
              <button type="button" onClick={() => setShowAddPerson(false)} className="h-10 px-4 font-bold text-sm text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">Cancelar</button>
              <button type="submit" className="h-10 px-5 font-bold text-sm text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg">Guardar contacto</button>
            </div>
          </form>
        </div>
        );
      })()}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded shadow-xl w-full max-w-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
            <div className="p-5">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                Confirmar eliminación
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                ¿Eliminar {selectedClients.length === 1 ? "1 contacto" : `${selectedClients.length} contactos`}? Sus tratos abiertos y sin pagos también salen del embudo. Los tratos ganados o con pagos se quedan. Podrás deshacerlo justo después.
              </p>
            </div>
            <div className="p-4 bg-[#f4f5f5] dark:bg-slate-800/50 border-t border-gray-200 dark:border-slate-700 flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded transition-colors"
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
          onUpdated={() => setRefreshKey(prev => prev + 1)}
        />
      )}
    </div>
  );
}
