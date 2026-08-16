import { useEffect, useMemo, useState } from "react";
import { collection, doc, getDocs, query, setDoc, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { checkIsWon } from "../lib/clientUtils";
import { Search, X, Plus, Target, User } from "lucide-react";

/**
 * A que trato pertenece la venta de un auto.
 *
 * Marcar un vehiculo como vendido sin decir a que trato dejaba la venta sin
 * dueño: aparecia en el inventario de pagos como "Cliente (Venta de
 * Vehiculo)", sin nombre y sin forma de darle seguimiento. Y como la venta
 * tiene que vivir en un trato, aqui se elige cual, o se crea.
 *
 * Los tratos que ya traen este auto asignado salen primero, porque son los
 * candidatos naturales: varios clientes pueden andar viendo la misma unidad.
 * Los que ya estan vendidos no aparecen -- un auto se vende una vez.
 */

interface TratoOpcion {
  id: string;
  titulo: string;
  cliente: string;
  esDeEsteAuto: boolean;
}

interface Props {
  vehicleId: string;
  vehiculoNombre: string;
  agencyId: string;
  sellerId?: string;
  onElegido: (dealId: string, etiqueta: string) => void;
  onCerrar: () => void;
}

export function SeleccionarTratoVenta({
  vehicleId,
  vehiculoNombre,
  agencyId,
  sellerId,
  onElegido,
  onCerrar,
}: Props) {
  const [cargando, setCargando] = useState(true);
  const [tratos, setTratos] = useState<TratoOpcion[]>([]);
  const [contactos, setContactos] = useState<{ id: string; nombre: string; telefono?: string }[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [modoCrear, setModoCrear] = useState(false);
  const [busquedaContacto, setBusquedaContacto] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [dSnap, cSnap] = await Promise.all([
          getDocs(query(collection(db, "deals"), where("agencyId", "==", agencyId))),
          getDocs(query(collection(db, "clients"), where("agencyId", "==", agencyId))),
        ]);

        const porId = new Map<string, string>();
        cSnap.docs.forEach((c) => porId.set(c.id, (c.data() as any).name || "Sin nombre"));

        const lista: TratoOpcion[] = [];
        dSnap.docs.forEach((d) => {
          const x: any = d.data() || {};
          if (x.isDeleted) return;
          // Un trato ya vendido no puede recibir otra venta.
          if (checkIsWon(x.status) || x.saleDetails?.price) return;
          lista.push({
            id: d.id,
            titulo: x.title || "Trato sin nombre",
            cliente: porId.get(x.clientId) || "Sin contacto",
            esDeEsteAuto: x.vehicleId === vehicleId,
          });
        });
        lista.sort((a, b) => Number(b.esDeEsteAuto) - Number(a.esDeEsteAuto));
        setTratos(lista);

        setContactos(
          cSnap.docs
            .map((c) => ({ id: c.id, nombre: (c.data() as any).name || "Sin nombre", telefono: (c.data() as any).phone }))
            .filter((c) => !!c.nombre)
            .sort((a, b) => a.nombre.localeCompare(b.nombre))
        );
      } finally {
        setCargando(false);
      }
    })();
  }, [agencyId, vehicleId]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return tratos;
    return tratos.filter(
      (t) => t.titulo.toLowerCase().includes(q) || t.cliente.toLowerCase().includes(q)
    );
  }, [tratos, busqueda]);

  const contactosFiltrados = useMemo(() => {
    const q = busquedaContacto.trim().toLowerCase();
    if (!q) return contactos.slice(0, 8);
    return contactos
      .filter((c) => c.nombre.toLowerCase().includes(q) || (c.telefono || "").includes(q))
      .slice(0, 8);
  }, [contactos, busquedaContacto]);

  const crearTrato = async (clientId: string, nombreCliente: string) => {
    setGuardando(true);
    try {
      const ref = doc(collection(db, "deals"));
      const titulo = `Trato con ${nombreCliente}`;
      await setDoc(ref, {
        id: ref.id,
        clientId,
        agencyId,
        sellerId: sellerId || null,
        title: titulo,
        status: "new",
        vehicleId,
        vehicle: vehiculoNombre,
        value: 0,
        createdAt: new Date().toISOString(),
      });
      onElegido(ref.id, `${titulo} · ${nombreCliente}`);
    } catch (e: any) {
      alert("No se pudo crear el trato: " + (e?.message || e));
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="flex items-start justify-between p-5 border-b border-gray-200 dark:border-slate-700">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              ¿A qué trato corresponde esta venta?
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{vehiculoNombre}</p>
          </div>
          <button onClick={onCerrar} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        {!modoCrear ? (
          <>
            <div className="p-5 pb-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  autoFocus
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Escribe el nombre del cliente o del trato..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-slate-700 rounded bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5">
              {cargando && <p className="text-sm text-slate-500 py-4">Buscando tratos…</p>}

              {!cargando && filtrados.length === 0 && (
                <div className="py-8 text-center">
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                    {tratos.length === 0
                      ? "Este cliente no tiene ningún trato abierto."
                      : "Ningún trato coincide con lo que escribiste."}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-500">
                    Crea uno para registrar la venta.
                  </p>
                </div>
              )}

              {!cargando &&
                filtrados.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => onElegido(t.id, `${t.titulo} · ${t.cliente}`)}
                    className="w-full text-left px-3 py-2.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 border-b border-gray-100 dark:border-slate-700/50 last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      <Target className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="font-medium text-slate-800 dark:text-slate-200 text-sm">{t.titulo}</span>
                      {t.esDeEsteAuto && (
                        <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                          este auto
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 ml-6">{t.cliente}</p>
                  </button>
                ))}
            </div>

            <div className="p-5 border-t border-gray-200 dark:border-slate-700">
              <button
                onClick={() => setModoCrear(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-800 text-white rounded text-sm font-medium"
              >
                <Plus className="w-4 h-4" /> Crear un trato nuevo
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="p-5 pb-3">
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                Elige de quién es el trato. El auto queda asignado solo.
              </p>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  autoFocus
                  value={busquedaContacto}
                  onChange={(e) => setBusquedaContacto(e.target.value)}
                  placeholder="Busca por nombre o teléfono..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-slate-700 rounded bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5">
              {contactosFiltrados.map((c) => (
                <button
                  key={c.id}
                  disabled={guardando}
                  onClick={() => crearTrato(c.id, c.nombre)}
                  className="w-full text-left px-3 py-2.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 border-b border-gray-100 dark:border-slate-700/50 last:border-0 disabled:opacity-50"
                >
                  <span className="font-medium text-slate-800 dark:text-slate-200 text-sm">{c.nombre}</span>
                  {c.telefono && (
                    <span className="text-xs text-slate-500 dark:text-slate-400 ml-2">{c.telefono}</span>
                  )}
                </button>
              ))}
              {contactosFiltrados.length === 0 && (
                <p className="py-6 text-sm text-slate-500 text-center">
                  Ningún contacto coincide. Créalo primero en Personas.
                </p>
              )}
            </div>

            <div className="p-5 border-t border-gray-200 dark:border-slate-700">
              <button
                onClick={() => setModoCrear(false)}
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-slate-600 rounded text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                Volver a los tratos
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
