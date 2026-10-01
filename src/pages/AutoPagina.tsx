import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import clsx from 'clsx';
import { collection, doc, getDoc, getDocs, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { ArrowLeft, Copy, ExternalLink, FileText, MessageCircle, Share2, Upload } from 'lucide-react';
import { db, auth } from '../lib/firebase';
import { getApiUrl } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { useCostosVehiculos, guardarCosto } from '../hooks/useVehicleFinancials';
import { checkIsLost, checkIsWon } from '../lib/clientUtils';
import { etiquetaDeFuente, fuenteDelContacto } from '../lib/fuentes';
import { diasDesde, haceCuanto } from '../lib/interesPorAuto';
import type { PrecioMercado } from '../lib/precioMercado';
import type { Client, Vehicle } from '../types';
import { getVehicleMatches } from './Inventory';
import { CampoEditable } from '../components/auto/CampoEditable';
import { Galeria } from '../components/auto/Galeria';
import { GraficaMercado } from '../components/inventario/GraficaMercado';
import { SeccionGastos } from '../components/auto/SeccionGastos';
import { SeccionVenta } from '../components/auto/SeccionVenta';
import { DocumentosDelAuto, NotasDelAuto } from '../components/auto/DocumentosYNotas';
import { subirFotosDeAuto } from '../lib/fotosDeAuto';
import { generarFichaPdf, descargarOCompartir } from '../lib/fichaPdf';
import { ShareVehicleModal } from '../components/ShareVehicleModal';

/**
 * La página de un auto: todo lo suyo en una pantalla, y los datos se cambian
 * ahí mismo (clic sobre el dato). Aquí también se suben fotos, se capturan
 * gastos, se vende y se registran pagos: la ventana del auto ya no hace falta
 * para los autos propios (VehicleDetailModal los manda aquí).
 *
 * Solo autos de la propia agencia: los de agencias asociadas no se pueden leer
 * directo (la regla lo niega) y siguen abriéndose en la ventana del inventario.
 */

type Seccion = 'resumen' | 'fotos' | 'datos' | 'costos' | 'documentos' | 'notas' | 'pagina' | 'interesados' | 'venta';

const DOCUMENTOS = [
  { key: 'originalInvoice', label: 'Factura original' },
  { key: 'originInvoiceCopy', label: 'Copia factura de origen' },
  { key: 'rebillings', label: 'Refacturas' },
  { key: 'taxes', label: 'Tenencias' },
  { key: 'deregistration', label: 'Baja' },
  { key: 'ineOrId', label: 'INE o identificación' },
];
const ACCESORIOS = [
  { key: 'jack', label: 'Gato' },
  { key: 'securityLugNut', label: 'Birlo de seguridad' },
  { key: 'manuals', label: 'Manuales' },
  { key: 'servicePolicy', label: 'Póliza de servicio' },
  { key: 'duplicateKeys', label: 'Duplicado de llaves' },
  { key: 'smogCheck', label: 'Verificación' },
  { key: 'tools', label: 'Herramienta' },
];
const CARROCERIAS = ['Sedán', 'SUV', 'Hatchback', 'Pickup', 'Coupé', 'Van', 'Minivan', 'Convertible', 'Premium', '4X4'];

const pesos = (n: number) => `$${Math.round(Number(n) || 0).toLocaleString('es-MX')}`;
const opciones = (xs: string[]) => xs.map((x) => ({ valor: x, texto: x }));
const fechaIso = (v: any): string | null => {
  if (!v) return null;
  if (typeof v === 'string') return v;
  if (typeof v.toDate === 'function') return v.toDate().toISOString();
  const s = v.seconds ?? v._seconds;
  return typeof s === 'number' ? new Date(s * 1000).toISOString() : null;
};
const fechaLarga = (f?: string | null) => {
  if (!f) return '';
  const d = new Date(f.length <= 10 ? `${f}T12:00:00` : f);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
};

function Tarjeta({ titulo, accion, children, className }: { titulo?: React.ReactNode; accion?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={clsx('bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 flex flex-col gap-2.5 min-w-0', className)}>
      {(titulo || accion) && (
        <div className="flex items-center justify-between gap-2">
          {titulo && <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">{titulo}</h2>}
          {accion}
        </div>
      )}
      {children}
    </section>
  );
}

export function AutoPagina() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { userData } = useAuth();
  const { can } = usePermissions();
  const { conCosto, puedeVerCostos } = useCostosVehiculos();

  const [crudo, setCrudo] = useState<Vehicle | null>(null);
  const [estadoCarga, setEstadoCarga] = useState<'cargando' | 'listo' | 'no'>('cargando');
  const [tratos, setTratos] = useState<any[]>([]);
  const [contactos, setContactos] = useState<Record<string, any>>({});
  const [clientesAgencia, setClientesAgencia] = useState<Client[]>([]);
  const [gastos, setGastos] = useState<any[]>([]);
  const [etapas, setEtapas] = useState<{ id: string; title?: string }[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [mercado, setMercado] = useState<PrecioMercado | null | undefined>(undefined);
  const [seccion, setSeccion] = useState<Seccion>('resumen');
  const [params, setParams] = useSearchParams();
  const [abrirVenta, setAbrirVenta] = useState(false);
  const [subiendo, setSubiendo] = useState<string>('');
  const [agencia, setAgencia] = useState<any>(null);
  const [haciendoFicha, setHaciendoFicha] = useState(false);
  const [compartir, setCompartir] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const agencyId = userData?.agencyId;
  const esVendedor = userData?.role === 'seller';

  // --- El auto, en vivo: lo que se cambie aquí o en la ventana se ve al momento.
  useEffect(() => {
    if (!id) return;
    return onSnapshot(
      doc(db, 'vehicles', id),
      (s) => {
        if (!s.exists()) { setEstadoCarga('no'); return; }
        setCrudo({ ...(s.data() as Vehicle), id: s.id });
        setEstadoCarga('listo');
      },
      () => setEstadoCarga('no')
    );
  }, [id]);

  const auto = useMemo(() => (crudo ? conCosto([crudo])[0] : null), [crudo, conCosto]);
  const esMio = !!auto && (auto.agencyId === agencyId || userData?.role === 'master');
  const vender = () => { setSeccion('venta'); setAbrirVenta(true); };
  // ?vender=1 (desde el boton «Vender» del inventario) y ?seccion=fotos|costos…
  useEffect(() => {
    if (!auto) return;
    const s = params.get('seccion') as Seccion | null;
    if (s) setSeccion(s);
    if (params.get('vender') === '1') vender();
    if (s || params.get('vender')) setParams({}, { replace: true });
  }, [!!auto]);

  // --- Tratos y contactos de este auto (un vendedor, solo los suyos).
  useEffect(() => {
    if (!id || !agencyId || !auto || !esMio) return;
    const filtros = [where('vehicleId', '==', id), where('agencyId', '==', agencyId)];
    if (esVendedor) filtros.push(where('sellerId', '==', userData!.id));
    const quitarTratos = onSnapshot(
      query(collection(db, 'deals'), ...filtros),
      (s) => setTratos(s.docs.map((d) => ({ ...d.data(), id: d.id })).filter((t: any) => !t.isDeleted)),
      () => setTratos([])
    );
    const quitarContactos = onSnapshot(
      query(collection(db, 'clients'), ...filtros),
      (s) => setContactos((prev) => {
        const nuevo = { ...prev };
        s.docs.forEach((d) => { const c: any = { ...d.data(), id: d.id }; if (!c.isDeleted) nuevo[d.id] = c; });
        return nuevo;
      }),
      () => {}
    );
    return () => { quitarTratos(); quitarContactos(); };
  }, [id, agencyId, esMio, esVendedor]);

  // Los contactos de los tratos que no traen este auto en su ficha.
  useEffect(() => {
    const faltan = tratos.map((t) => t.clientId).filter((c) => c && !contactos[c]);
    if (!faltan.length) return;
    Promise.all(Array.from(new Set(faltan)).map((c) => getDoc(doc(db, 'clients', c)).catch(() => null))).then((docs) => {
      setContactos((prev) => {
        const nuevo = { ...prev };
        docs.forEach((d) => { if (d && d.exists()) nuevo[d.id] = { ...d.data(), id: d.id }; });
        return nuevo;
      });
    });
  }, [tratos]);

  // --- Gastos, en vivo.
  useEffect(() => {
    if (!agencyId || !id || !esMio) return;
    return onSnapshot(
      query(collection(db, 'vehicleExpenses'), where('agencyId', '==', agencyId), where('vehicleId', '==', id)),
      (s) => setGastos(s.docs.map((d) => ({ ...d.data(), id: d.id }))),
      () => setGastos([])
    );
  }, [agencyId, id, esMio]);

  // --- Lo demás, una vez: etapas, vendedores, gastos, clientes que buscan algo así, mercado.
  useEffect(() => {
    if (!agencyId || !id || !esMio) return;
    getDoc(doc(db, 'agencies', agencyId)).then((s) => {
      setAgencia(s.data() || null);
      const e = s.data()?.pipelineStages;
      setEtapas(Array.isArray(e) && e.length ? e : [
        { id: 'new', title: 'Nuevos' }, { id: 'contacted', title: 'Contactados' }, { id: 'negotiation', title: 'Negociación' }, { id: 'won', title: 'Ganados' }, { id: 'lost', title: 'Perdidos' },
      ]);
    }).catch(() => {});
    getDocs(query(collection(db, 'users'), where('agencyId', '==', agencyId))).then((s) => setUsuarios(s.docs.map((d) => ({ ...d.data(), id: d.id })))).catch(() => {});
    const qc = esVendedor
      ? query(collection(db, 'clients'), where('agencyId', '==', agencyId), where('sellerId', '==', userData!.id))
      : query(collection(db, 'clients'), where('agencyId', '==', agencyId));
    getDocs(qc).then((s) => setClientesAgencia(s.docs.map((d) => ({ ...d.data(), id: d.id }) as Client).filter((c) => !c.isDeleted))).catch(() => {});
    (async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        const r = await fetch(getApiUrl('/api/mercado/inventario'), { headers: { Authorization: `Bearer ${token}` } });
        if (!r.ok) return;
        const porAuto = (await r.json()).porAuto || {};
        setMercado(id in porAuto ? porAuto[id] : undefined);
      } catch { /* sin barra de mercado */ }
    })();
  }, [agencyId, id, esMio]);

  // --- Permisos
  const puedeEditar = esMio && can('vehiculos.editar');
  const puedeFotos = esMio && can('vehiculos.fotos');
  const vendido = auto?.status === 'sold';
  // El precio de un auto vendido se cambia desde la venta (lo copia a sus
  // tratos); a un vendedor el CRM no le deja cambiar precios.
  const puedePrecio = puedeEditar && !esVendedor && !vendido;
  const puedePublicar = esMio && !esVendedor && can('vehiculos.editar');
  // Los gastos, como en la ventana de antes: no para vendedores salvo permiso.
  const verGastos = esMio && (!esVendedor || !!(userData as any)?.canManageExpenses);
  const puedeCapturarGastos = esMio && (can('gastos.crear') || !!(userData as any)?.canManageExpenses);
  // Los archivos (facturas, INE...) solo para administradores y gerentes; el servidor lo vuelve a revisar.
  const verArchivos = esMio && ['admin', 'manager', 'master'].includes(String(userData?.role));

  const guardar = (campos: Record<string, any>) => updateDoc(doc(db, 'vehicles', id), { ...campos, updatedAt: new Date().toISOString() });
  const campo = (nombre: string) => async (valor: any) => { await guardar({ [nombre]: valor === null ? '' : valor }); };

  // --- Derivados
  const fotos = useMemo(() => {
    if (!auto) return [];
    const lista = auto.photoUrls?.length ? auto.photoUrls : auto.photoUrl ? [auto.photoUrl] : [];
    return lista.filter(Boolean);
  }, [auto]);

  const hacerPortada = async (i: number) => {
    const urls = [...fotos];
    const [elegida] = urls.splice(i, 1);
    urls.unshift(elegida);
    await guardar({ photoUrls: urls, photoUrl: elegida }).catch((e) => alert(`No se pudo cambiar la portada. ${e?.message || ''}`));
  };

  const subirFotos = async (archivos: FileList | null) => {
    if (!archivos || !archivos.length || !auto) return;
    setSubiendo(`Subiendo 0 de ${archivos.length}…`);
    try {
      const nuevas = await subirFotosDeAuto(archivos, userData?.id || 'sin-usuario', id, (h, t) => setSubiendo(`Subiendo ${h} de ${t}…`));
      const todas = [...fotos, ...nuevas];
      await guardar({ photoUrls: todas, photoUrl: todas[0] });
    } catch (e: any) {
      alert(`No se pudieron subir las fotos. ${e?.message || ''}`);
    } finally {
      setSubiendo('');
    }
  };

  const quitarFoto = async (i: number) => {
    if (!window.confirm('¿Quitar esta foto del auto?')) return;
    const resto = fotos.filter((_, j) => j !== i);
    await guardar({ photoUrls: resto, photoUrl: resto[0] || '' }).catch((e) => alert(`No se pudo quitar la foto. ${e?.message || ''}`));
  };

  const todosLosGastos = useMemo(() => {
    const m = new Map<string, any>();
    [...((auto as any)?.expenses || []), ...gastos].forEach((g: any) => { if (g) m.set(g.id || `${g.description}-${g.amount}-${g.date}`, g); });
    return Array.from(m.values()).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  }, [auto, gastos]);
  const totalGastos = todosLosGastos.reduce((s, g) => s + (Number(g.amount) || 0), 0);
  const costo = Number(auto?.purchasePrice) || 0;
  const utilidad = (Number(auto?.price) || 0) - costo - totalGastos;

  const interesados = useMemo(() => {
    const filas: any[] = [];
    const vistos = new Set<string>();
    tratos.forEach((t) => {
      const c = contactos[t.clientId] || {};
      vistos.add(t.clientId);
      filas.push({ clave: t.id, clientId: t.clientId, nombre: c.name || t.title || 'Sin nombre', telefono: c.phone, status: t.status, fecha: fechaIso(t.createdAt), sellerId: t.sellerId, fuente: fuenteDelContacto(c) });
    });
    Object.values(contactos).forEach((c: any) => {
      if (c.vehicleId !== id || vistos.has(c.id)) return;
      filas.push({ clave: c.id, clientId: c.id, nombre: c.name || 'Sin nombre', telefono: c.phone, status: c.status, fecha: fechaIso(c.createdAt), sellerId: c.sellerId, fuente: fuenteDelContacto(c) });
    });
    return filas.sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')));
  }, [tratos, contactos, id]);
  const tratosAbiertos = tratos.filter((t) => !checkIsWon(t.status, etapas) && !checkIsLost(t.status, etapas)).length;

  const coincidencias = useMemo(() => {
    if (!auto || vendido) return [];
    const ya = new Set(interesados.map((p) => p.clientId));
    return getVehicleMatches(auto, clientesAgencia).filter((m) => m.level !== 'low' && !ya.has(m.client.id)).slice(0, 6);
  }, [auto, clientesAgencia, interesados, vendido]);

  if (estadoCarga === 'cargando') {
    return <div className="p-10 text-center text-slate-500">Cargando el auto…</div>;
  }
  if (estadoCarga === 'no' || !auto || !esMio) {
    return (
      <div className="p-10 text-center flex flex-col items-center gap-3">
        <p className="text-slate-600 dark:text-slate-400">No encontramos este auto, o es de otra agencia.</p>
        <button type="button" onClick={() => navigate('/inventory')} className="px-4 py-2 rounded-lg bg-blue-700 text-white font-bold text-sm">Volver al inventario</button>
      </div>
    );
  }

  const titulo = `${auto.year || ''} ${auto.make || ''} ${auto.model || ''}`.trim();
  const dias = diasDesde(auto.receivedAt || fechaIso((auto as any).createdAt));
  const checklist: any = auto.checklist || {};
  const docsListos = DOCUMENTOS.filter((d) => checklist[d.key]).length;
  const accListos = ACCESORIOS.filter((d) => checklist[d.key]).length;
  const publicado = !!(auto as any).publicarEnWeb;
  const pendiente = (auto as any).pendingValidation;
  const nombreEtapa = (s: string) => checkIsWon(s, etapas) ? 'Ganado' : checkIsLost(s, etapas) ? 'Perdido' : (etapas.find((e) => e.id === s)?.title || 'Sin etapa');
  const vendedor = (uid?: string) => usuarios.find((u) => u.id === uid)?.name || '';
  const veredicto = mercado && mercado.n >= 5
    ? (auto.price <= mercado.p33 ? 'Excelente precio' : auto.price <= mercado.p66 ? 'Buen precio' : auto.price <= mercado.p90 ? 'Precio justo' : 'Arriba del mercado')
    : null;

  const wa = (tel?: string, nombre?: string) => {
    const n = String(tel || '').replace(/\D/g, '');
    if (!n) return null;
    const num = n.length === 10 ? `52${n}` : n;
    const texto = `Hola${nombre ? ` ${String(nombre).split(' ')[0]}` : ''}, te comparto el ${titulo} en ${pesos(auto.price)}.${auto.websiteUrl ? `\n${auto.websiteUrl}` : ''}`;
    return `https://wa.me/${num}?text=${encodeURIComponent(texto)}`;
  };

  const chip = (texto: string, clase: string) => <span className={clsx('text-xs font-extrabold px-2.5 py-1 rounded-full', clase)}>{texto}</span>;
  const colorDias = dias === null ? '' : dias <= 30 ? 'bg-emerald-700 text-white' : dias <= 90 ? 'bg-amber-400 text-amber-950' : 'bg-red-700 text-white';

  // ---------- Bloques reutilizables ----------
  const bloqueDatos = (completo: boolean) => (
    <Tarjeta titulo="Datos del auto" accion={puedeEditar && <span className="text-[11px] text-slate-500">Clic en un dato para cambiarlo</span>}>
      <div className={clsx('grid gap-x-4 gap-y-2.5', completo ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2 sm:grid-cols-4')}>
        {completo && <>
          <CampoEditable etiqueta="Marca" valor={auto.make} puedeEditar={puedeEditar} onGuardar={campo('make')} />
          <CampoEditable etiqueta="Modelo y versión" valor={auto.model} puedeEditar={puedeEditar} onGuardar={campo('model')} />
          <CampoEditable etiqueta="Año" valor={auto.year} tipo="numero" puedeEditar={puedeEditar} onGuardar={campo('year')} />
        </>}
        <CampoEditable etiqueta="Kilometraje" valor={auto.km} tipo="numero" puedeEditar={puedeEditar} marcarSiFalta mostrar={(v) => `${Number(v).toLocaleString('es-MX')} km`} onGuardar={campo('km')} />
        <CampoEditable etiqueta="Transmisión" valor={auto.transmission} tipo="opciones" opciones={opciones(['Automática', 'Manual'])} puedeEditar={puedeEditar} onGuardar={campo('transmission')} />
        <CampoEditable etiqueta="Motor (litros)" valor={auto.liters} tipo="numero" sufijo="L" puedeEditar={puedeEditar} onGuardar={campo('liters')} />
        <CampoEditable etiqueta="Cilindros" valor={auto.cylinders} tipo="numero" puedeEditar={puedeEditar} onGuardar={campo('cylinders')} />
        <CampoEditable etiqueta="Color" valor={auto.color} puedeEditar={puedeEditar} marcarSiFalta onGuardar={campo('color')} />
        <CampoEditable etiqueta="Carrocería" valor={auto.bodyType} tipo="opciones" opciones={opciones(CARROCERIAS)} puedeEditar={puedeEditar} onGuardar={campo('bodyType')} />
        <CampoEditable etiqueta="Pasajeros" valor={auto.passengers} tipo="numero" puedeEditar={puedeEditar} onGuardar={campo('passengers')} />
        <CampoEditable etiqueta="Propiedad" valor={auto.ownership || 'propio'} tipo="opciones" opciones={[{ valor: 'propio', texto: 'Propio' }, { valor: 'consignacion', texto: 'Consignación' }]} mostrar={(v) => (v === 'consignacion' ? 'Consignación' : 'Propio')} puedeEditar={puedeEditar} onGuardar={campo('ownership')} />
        <div className="flex items-end gap-1 min-w-0">
          <CampoEditable className="flex-1" etiqueta="VIN" valor={auto.vin} puedeEditar={puedeEditar} marcarSiFalta onGuardar={async (v) => { await guardar({ vin: String(v || '').toUpperCase() }); }} />
          {auto.vin && (
            <button type="button" aria-label="Copiar VIN" title={copiado ? 'Copiado' : 'Copiar VIN'} onClick={() => { navigator.clipboard?.writeText(auto.vin); setCopiado(true); setTimeout(() => setCopiado(false), 1500); }} className="p-1 mb-0.5 rounded text-slate-500 hover:text-blue-700 hover:bg-slate-100 dark:hover:bg-slate-700">
              <Copy className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {completo && <>
          <CampoEditable etiqueta="Fecha de recepción" valor={auto.receivedAt} tipo="fecha" mostrar={(v) => fechaLarga(v)} puedeEditar={puedeEditar} onGuardar={campo('receivedAt')} />
          {!vendido && !pendiente && (
            <CampoEditable
              etiqueta="Estado"
              valor={auto.status || 'available'}
              tipo="opciones"
              opciones={[{ valor: 'available', texto: 'Disponible' }, { valor: 'reserved', texto: 'Apartado' }]}
              mostrar={(v) => (v === 'reserved' ? 'Apartado' : 'Disponible')}
              // Para venderlo esta el boton «Vender» (pide trato y forma de pago).
              puedeEditar={puedeEditar && !esVendedor}
              onGuardar={async (v) => { if (v === 'available' || v === 'reserved') await guardar({ status: v }); }}
            />
          )}
          <CampoEditable className="col-span-2" etiqueta="Liga de la publicación (opcional)" valor={auto.websiteUrl} puedeEditar={puedeEditar} onGuardar={campo('websiteUrl')} mostrar={(v) => <span className="text-blue-700 break-all">{v}</span>} />
          <CampoEditable className="col-span-2 md:col-span-4" etiqueta="Equipamiento" valor={auto.equipment} tipo="largo" puedeEditar={puedeEditar} onGuardar={campo('equipment')} />
        </>}
      </div>
    </Tarjeta>
  );

  const bloqueMercado = (
    <Tarjeta titulo="Precio contra el mercado" accion={veredicto && <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300">{veredicto}</span>}>
      {mercado === undefined ? (
        <p className="text-xs text-slate-600 dark:text-slate-400">Aún no se consulta Mercado Libre para este auto; se hace solo en unas horas.</p>
      ) : (
        <GraficaMercado precio={Number(auto.price) || 0} mercado={mercado} />
      )}
    </Tarjeta>
  );

  const bloqueInteresados = (todos: boolean) => (
    <Tarjeta
      titulo={<>Interesados <span className="text-slate-500 font-semibold">{interesados.length}</span></>}
      accion={!todos && interesados.length > 5 && <button type="button" onClick={() => setSeccion('interesados')} className="text-xs font-bold text-blue-700 hover:underline">Ver todos</button>}
      className="flex-1"
    >
      {interesados.length === 0 && <p className="text-sm text-slate-600 dark:text-slate-400">Nadie ha preguntado por este auto todavía.</p>}
      <ul className="flex flex-col">
        {(todos ? interesados : interesados.slice(0, 5)).map((p) => {
          const liga = wa(p.telefono, p.nombre);
          const est = nombreEtapa(p.status);
          return (
            <li key={p.clave} className="flex items-center gap-2.5 py-1.5 border-t border-slate-100 dark:border-slate-700 first:border-t-0">
              <button type="button" onClick={() => navigate('/persons', { state: { clientId: p.clientId } })} className="flex items-center gap-2.5 flex-1 min-w-0 text-left rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/40 -mx-1 px-1 py-0.5">
                <span className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-900 dark:text-blue-200 text-xs font-extrabold flex items-center justify-center shrink-0">{String(p.nombre).charAt(0).toUpperCase()}</span>
                <span className="flex flex-col min-w-0">
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{p.nombre}</span>
                  <span className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
                    {[haceCuanto(p.fecha), etiquetaDeFuente(p.fuente), vendedor(p.sellerId)].filter((x) => x && x !== '—' && x !== 'Sin dato').join(' · ')}
                  </span>
                </span>
              </button>
              <span className={clsx('text-[11px] font-extrabold px-2 py-0.5 rounded-full whitespace-nowrap',
                est === 'Ganado' ? 'bg-emerald-100 text-emerald-900' : est === 'Perdido' ? 'bg-slate-100 text-slate-600' : 'bg-blue-100 text-blue-900')}>{est}</span>
              {liga && (
                <a href={liga} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp a ${p.nombre}`} title="Mandarle este auto por WhatsApp" className="p-1.5 rounded-lg text-green-700 hover:bg-green-50 dark:hover:bg-green-950/30">
                  <MessageCircle className="w-4 h-4" />
                </a>
              )}
            </li>
          );
        })}
      </ul>
      {todos && coincidencias.length > 0 && (
        <div className="flex flex-col gap-1 border-t border-slate-200 dark:border-slate-700 pt-2.5 mt-1">
          <h3 className="text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Clientes que buscan algo así</h3>
          {coincidencias.map((m) => {
            const liga = wa(m.client.phone, m.client.name);
            return (
              <div key={m.client.id} className="flex items-center gap-2.5 py-1">
                <button type="button" onClick={() => navigate('/persons', { state: { clientId: m.client.id } })} className="flex-1 text-left text-sm font-bold text-slate-900 dark:text-slate-100 hover:underline truncate">{m.client.name}</button>
                <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300">{m.level === 'exact' ? 'Exacto' : m.level === 'high' ? 'Muy similar' : 'Algo similar'}</span>
                {liga && <a href={liga} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp a ${m.client.name}`} className="p-1.5 rounded-lg text-green-700 hover:bg-green-50"><MessageCircle className="w-4 h-4" /></a>}
              </div>
            );
          })}
        </div>
      )}
    </Tarjeta>
  );

  const bloquePagina = (completo: boolean) => {
    const disponible = !auto.status || auto.status === 'available' || auto.status === 'reserved';
    return (
      <Tarjeta titulo="Página Nextcar">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-slate-600 dark:text-slate-400">
            {publicado ? 'Se publica en nextcar.erewere.com' : 'No se publica en nextcar.erewere.com'}
            {publicado && !fotos.length && ' · le faltan fotos para salir'}
          </span>
          {puedePublicar ? (
            <button
              type="button"
              role="switch"
              aria-checked={publicado}
              aria-label="Publicar en la página"
              disabled={!disponible && !publicado}
              onClick={() => guardar({ publicarEnWeb: !publicado }).catch((e) => alert(e?.message))}
              className={clsx('relative w-12 h-7 rounded-full transition-colors shrink-0 disabled:opacity-50', publicado ? 'bg-blue-700' : 'bg-slate-300 dark:bg-slate-600')}
            >
              <span className={clsx('absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all', publicado ? 'left-6' : 'left-1')} />
            </button>
          ) : (
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{publicado ? 'Publicado' : 'Sin publicar'}</span>
          )}
        </div>
        {auto.websiteUrl && (
          <a href={auto.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-blue-700 hover:underline flex items-center gap-1">
            Ver en la página <ExternalLink className="w-3 h-3" />
          </a>
        )}
        {completo && (
          <>
            <CampoEditable etiqueta="Descripción para la página" valor={(auto as any).descripcionWeb} tipo="largo" puedeEditar={puedePublicar} onGuardar={campo('descripcionWeb')} />
            <div className="border-t border-slate-200 dark:border-slate-700 pt-2.5 flex flex-col gap-2">
              <h3 className="text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Datos para la página</h3>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">Lo que quede vacío lo completa la página al publicar el auto.</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2.5">
                {([
                  ['combustible', 'Combustible'], ['traccion', 'Tracción'], ['motor', 'Motor'], ['potencia', 'Potencia'],
                  ['rendimiento', 'Rendimiento'], ['ciudad', 'Ciudad'],
                ] as const).map(([clave, etiqueta]) => (
                  <CampoEditable key={clave} etiqueta={etiqueta} valor={(auto as any).fichaWeb?.[clave]} puedeEditar={puedeEditar} onGuardar={async (v) => { await guardar({ [`fichaWeb.${clave}`]: v || '' }); }} />
                ))}
                <CampoEditable etiqueta="Precio anterior (tachado)" valor={(auto as any).fichaWeb?.precioAnterior} tipo="numero" mostrar={pesos} puedeEditar={puedeEditar} onGuardar={async (v) => { await guardar({ 'fichaWeb.precioAnterior': v || null }); }} />
              </div>
              <CampoEditable etiqueta="Lo que nos encanta (una idea por renglón)" valor={(auto as any).fichaWeb?.loQueNosEncanta} tipo="largo" puedeEditar={puedeEditar} onGuardar={async (v) => { await guardar({ 'fichaWeb.loQueNosEncanta': v || '' }); }} />
            </div>
          </>
        )}
      </Tarjeta>
    );
  };

  const bloqueDocumentos = (
    <Tarjeta titulo="Documentos y accesorios" accion={<span className="text-xs text-slate-600 dark:text-slate-400">Marca lo que ya tienes</span>}>
      {[['Documentos', DOCUMENTOS], ['Accesorios', ACCESORIOS]].map(([nombre, lista]: any) => (
        <div key={nombre} className="flex flex-col gap-1.5">
          <h3 className="text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wide">{nombre}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
            {lista.map((d: any) => (
              <label key={d.key} className={clsx('flex items-center gap-2 px-2.5 py-2 rounded-lg border text-sm cursor-pointer select-none',
                checklist[d.key] ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 font-semibold' : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300')}>
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-emerald-700"
                  checked={!!checklist[d.key]}
                  disabled={!puedeEditar}
                  onChange={(e) => guardar({ [`checklist.${d.key}`]: e.target.checked }).catch((err) => alert(err?.message))}
                />
                {d.label}
              </label>
            ))}
          </div>
        </div>
      ))}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-slate-200 dark:border-slate-700 pt-2.5">
        <CampoEditable etiqueta="Placas y tarjeta" valor={checklist.platesAndCard} puedeEditar={puedeEditar} onGuardar={async (v) => { await guardar({ 'checklist.platesAndCard': v || '' }); }} />
        <CampoEditable etiqueta="Estado de placas" valor={checklist.platesState} puedeEditar={puedeEditar} onGuardar={async (v) => { await guardar({ 'checklist.platesState': v || '' }); }} />
        <CampoEditable etiqueta="Número de dueños" valor={checklist.ownersCount} puedeEditar={puedeEditar} onGuardar={async (v) => { await guardar({ 'checklist.ownersCount': v || '' }); }} />
      </div>
    </Tarjeta>
  );

  const bloqueCostos = (
    <SeccionGastos
      auto={auto}
      gastos={todosLosGastos}
      costo={costo}
      puedeVerCostos={puedeVerCostos}
      puedeCapturar={puedeCapturarGastos}
      puedePrecio={puedePrecio}
      usuarioId={userData?.id}
      dias={dias}
      onPrecio={campo('price')}
      onCambioGastos={() => {}}
    />
  );

  // En el resumen, la venta en corto; la sección «Venta» trae todo (pagos incluidos).
  const bloqueVenta = (
    <Tarjeta titulo="Venta" accion={<button type="button" onClick={() => setSeccion('venta')} className="text-xs font-bold text-blue-700 hover:underline">Ver venta y pagos</button>}>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col"><span className="text-[11px] text-slate-600 dark:text-slate-400">Comprador</span><span className="text-sm font-bold">{auto.buyerName || '—'}</span></div>
        <div className="flex flex-col"><span className="text-[11px] text-slate-600 dark:text-slate-400">Fecha</span><span className="text-sm font-bold">{fechaLarga(auto.soldAt) || '—'}</span></div>
        <div className="flex flex-col"><span className="text-[11px] text-slate-600 dark:text-slate-400">Precio</span><span className="text-sm font-bold">{pesos(auto.saleDetails?.price || auto.price)}</span></div>
      </div>
    </Tarjeta>
  );

  const seccionVenta = (
    <SeccionVenta auto={auto} userData={userData} abrirVenta={abrirVenta} onAbrirVentaAtendido={() => setAbrirVenta(false)} />
  );

  const secciones: [Seccion, string, string | number | null][] = [
    ['resumen', 'Resumen', null],
    ['fotos', 'Fotos', fotos.length || null],
    ['datos', 'Datos del auto', null],
    ...(verGastos ? [['costos', 'Costos y gastos', todosLosGastos.length || null] as [Seccion, string, number | null]] : []),
    ['documentos', 'Documentos', `${docsListos + accListos}/${DOCUMENTOS.length + ACCESORIOS.length}`],
    ['notas', 'Notas internas', null],
    ['pagina', 'Página web', publicado ? 'Sí' : null],
    ['interesados', 'Interesados', interesados.length || null],
    ['venta', 'Venta', null],
  ];

  return (
    <div className="h-full overflow-y-auto bg-slate-100 dark:bg-slate-900">
      <div className="p-3 md:p-4 flex flex-col gap-3 max-w-[1600px] mx-auto">
        {/* Encabezado */}
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap min-w-0">
            <button type="button" onClick={() => navigate('/inventory')} className="flex items-center gap-1 text-sm font-bold text-blue-700 hover:underline">
              <ArrowLeft className="w-4 h-4" /> Inventario
            </button>
            <h1 className="text-xl md:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">{titulo}</h1>
            <div className="flex gap-1.5 flex-wrap">
              {pendiente ? chip(`Pendiente: ${pendiente.type === 'sold' ? 'venta' : 'apartado'}`, 'bg-amber-100 text-amber-900')
                : vendido ? chip('Vendido', 'bg-slate-800 text-white')
                : auto.status === 'reserved' ? chip('Apartado', 'bg-amber-100 text-amber-900')
                : chip('Disponible', 'bg-emerald-100 text-emerald-900')}
              {chip(auto.ownership === 'consignacion' ? 'Consignación' : 'Propio', auto.ownership === 'consignacion' ? 'bg-purple-100 text-purple-900' : 'bg-blue-100 text-blue-900')}
              {dias !== null && !vendido && chip(`${dias} ${dias === 1 ? 'día' : 'días'}`, colorDias)}
              {chip(publicado ? 'En la página' : 'No está en la página', publicado ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200')}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button type="button" onClick={() => setCompartir(true)} className="min-h-[38px] px-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-bold flex items-center gap-1.5 hover:bg-slate-50"><Share2 className="w-4 h-4" /> Compartir</button>
            <button
              type="button"
              disabled={haciendoFicha}
              onClick={async () => {
                setHaciendoFicha(true);
                try {
                  const blob = await generarFichaPdf({ auto, agencia, asesor: { name: userData?.name, phone: (userData as any)?.phone, email: userData?.email } });
                  await descargarOCompartir(blob, `${[auto.year, auto.make, auto.model].filter(Boolean).join(' ').replace(/[^\w áéíóúñÁÉÍÓÚÑ.-]+/g, '')}.pdf`, titulo);
                } catch (e: any) {
                  alert(`No se pudo hacer la ficha. ${e?.message || ''}`);
                } finally {
                  setHaciendoFicha(false);
                }
              }}
              className="min-h-[38px] px-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-bold flex items-center gap-1.5 hover:bg-slate-50 disabled:opacity-60"
            >
              <FileText className="w-4 h-4" /> {haciendoFicha ? 'Preparando…' : 'Ficha PDF'}
            </button>
            {puedeFotos && (
              <label className="min-h-[38px] px-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-bold flex items-center gap-1.5 hover:bg-slate-50 cursor-pointer">
                <Upload className="w-4 h-4" /> {subiendo || 'Subir fotos'}
                <input type="file" accept="image/*" multiple className="hidden" disabled={!!subiendo} onChange={(e) => { subirFotos(e.target.files); e.target.value = ''; }} />
              </label>
            )}
            {!vendido && !pendiente && can('ventas.cerrar') && <button type="button" onClick={vender} className="min-h-[38px] px-4 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold">Vender</button>}
          </div>
        </header>

        {/* Recuadros */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5">
          <div className="bg-slate-900 dark:bg-slate-950 text-white rounded-xl px-3.5 py-2.5 flex flex-col">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-300">Precio</span>
            {puedePrecio ? (
              <CampoEditable etiqueta="" valor={auto.price} tipo="numero" mostrar={pesos} puedeEditar onGuardar={campo('price')}
                claseValor="!text-white !text-2xl font-extrabold tracking-tight hover:!bg-white/10" />
            ) : <span className="text-2xl font-extrabold tracking-tight">{pesos(auto.price)}</span>}
            <span className="text-xs text-slate-300">{veredicto ? `${veredicto} · mercado ${pesos(mercado!.promedio)}` : 'Sin dato de mercado aún'}</span>
          </div>
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 flex flex-col">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">En inventario</span>
            <span className="text-2xl font-extrabold">{dias === null ? '—' : `${dias} días`}</span>
            <span className="text-xs text-slate-600 dark:text-slate-400">{auto.receivedAt ? `Recibido el ${fechaLarga(auto.receivedAt)}` : 'Sin fecha de recepción'}</span>
          </div>
          <button type="button" onClick={() => setSeccion('interesados')} className="text-left bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 flex flex-col hover:border-blue-400">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">Interesados</span>
            <span className="text-2xl font-extrabold">{interesados.length}</span>
            <span className="text-xs text-slate-600 dark:text-slate-400">{tratosAbiertos} tratos abiertos{interesados[0]?.fecha ? ` · último ${haceCuanto(interesados[0].fecha)}` : ''}</span>
          </button>
          {verGastos ? (
          <button type="button" onClick={() => setSeccion('costos')} className="text-left bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 flex flex-col hover:border-blue-400">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">{puedeVerCostos ? 'Utilidad' : 'Gastos'}</span>
            <span className={clsx('text-2xl font-extrabold', puedeVerCostos && costo && utilidad < 0 && 'text-red-700')}>{puedeVerCostos ? (costo ? pesos(utilidad) : '—') : pesos(totalGastos)}</span>
            <span className="text-xs text-slate-600 dark:text-slate-400">{puedeVerCostos && !costo ? 'Falta el costo de compra' : `${todosLosGastos.length} gastos · ${pesos(totalGastos)}`}</span>
          </button>
          ) : (
          <button type="button" onClick={() => setSeccion('fotos')} className="text-left bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 flex flex-col hover:border-blue-400">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">Fotos</span>
            <span className="text-2xl font-extrabold">{fotos.length}</span>
            <span className="text-xs text-slate-600 dark:text-slate-400">{fotos.length ? 'Ver todas' : 'Sin fotos todavía'}</span>
          </button>
          )}
          <button type="button" onClick={() => setSeccion('documentos')} className="text-left bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 flex flex-col gap-1 hover:border-blue-400 col-span-2 lg:col-span-1">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">Documentos</span>
            <span className={clsx('text-2xl font-extrabold', docsListos < DOCUMENTOS.length ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700')}>{docsListos} de {DOCUMENTOS.length}</span>
            <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden"><div className="h-full bg-emerald-600" style={{ width: `${(docsListos / DOCUMENTOS.length) * 100}%` }} /></div>
          </button>
        </div>

        {/* Menú y contenido */}
        <div className="grid grid-cols-1 md:grid-cols-[190px_minmax(0,1fr)] gap-3">
          <nav aria-label="Secciones del auto" className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-1.5 flex md:flex-col gap-0.5 overflow-x-auto md:self-start md:sticky md:top-3">
            {secciones.map(([sid, texto, cuenta]) => (
              <button
                key={sid}
                type="button"
                onClick={() => setSeccion(sid)}
                aria-current={seccion === sid ? 'page' : undefined}
                className={clsx('flex items-center justify-between gap-2 shrink-0 md:w-full min-h-[38px] px-3 rounded-lg text-sm whitespace-nowrap',
                  seccion === sid ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 font-extrabold' : 'text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-50 dark:hover:bg-slate-700/50')}
              >
                <span>{texto}</span>
                {cuenta !== null && cuenta !== 0 && <span className="text-xs font-bold text-slate-500">{cuenta}</span>}
              </button>
            ))}
          </nav>

          <div className="min-w-0">
            {seccion === 'resumen' && (
              <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] gap-3">
                <div className="flex flex-col gap-3 min-w-0">
                  <Tarjeta><Galeria fotos={fotos} titulo={titulo} puedeOrdenar={puedeFotos} onHacerPortada={hacerPortada} /></Tarjeta>
                  {bloqueDatos(false)}
                </div>
                <div className="flex flex-col gap-3 min-w-0">
                  {!vendido && bloqueMercado}
                  {vendido && bloqueVenta}
                  {bloqueInteresados(false)}
                  {bloquePagina(false)}
                  <NotasDelAuto vehicleId={id} compacto onVerTodas={() => setSeccion('notas')} />
                </div>
              </div>
            )}
            {seccion === 'fotos' && (
              <Tarjeta titulo={`Fotos (${fotos.length})`} accion={puedeFotos && <span className="text-[11px] text-slate-500">La primera es la portada · pasa el mouse sobre una foto para cambiarla o quitarla</span>}>
                {puedeFotos && (
                  <label
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); subirFotos(e.dataTransfer.files); }}
                    className="flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 py-5 cursor-pointer hover:border-blue-500 hover:bg-blue-50/40 dark:hover:bg-blue-950/20 text-center"
                  >
                    <Upload className="w-6 h-6 text-slate-500" />
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{subiendo || 'Arrastra fotos aquí o haz clic para elegirlas'}</span>
                    <span className="text-xs text-slate-500">Se comprimen solas, igual que en la página Nextcar</span>
                    <input type="file" accept="image/*" multiple className="hidden" disabled={!!subiendo} onChange={(e) => { subirFotos(e.target.files); e.target.value = ''; }} />
                  </label>
                )}
                <Galeria fotos={fotos} titulo={titulo} puedeOrdenar={puedeFotos} onHacerPortada={hacerPortada} cuadricula onQuitar={puedeFotos ? quitarFoto : undefined} />
              </Tarjeta>
            )}
            {seccion === 'datos' && bloqueDatos(true)}
            {seccion === 'costos' && verGastos && bloqueCostos}
            {seccion === 'documentos' && (
              <div className="flex flex-col gap-3">
                {verArchivos && <DocumentosDelAuto vehicleId={id} />}
                {bloqueDocumentos}
              </div>
            )}
            {seccion === 'notas' && <NotasDelAuto vehicleId={id} />}
            {seccion === 'pagina' && bloquePagina(true)}
            {seccion === 'interesados' && bloqueInteresados(true)}
            {seccion === 'venta' && seccionVenta}
          </div>
        </div>
      </div>

      {compartir && <ShareVehicleModal vehicle={auto} onClose={() => setCompartir(false)} />}
    </div>
  );
}
