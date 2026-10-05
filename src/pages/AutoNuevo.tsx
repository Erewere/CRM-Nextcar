import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import clsx from 'clsx';
import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { ArrowLeft, Star, Trash2, Upload } from 'lucide-react';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { useCostosVehiculos, guardarCosto } from '../hooks/useVehicleFinancials';
import { hoyLocal } from '../lib/fechas';
import { sanitizeFirestoreData } from '../lib/clientUtils';
import { subirFotosDeAuto, avisoFallidas } from '../lib/fotosDeAuto';
import { configLogoDe, prepararLogo } from '../lib/logoEnFoto';
import { auth } from '../lib/firebase';
import { getApiUrl } from '../lib/api';
import { LlenarDesdeVin } from '../components/auto/LlenarDesdeVin';

/**
 * Alta de un auto en pantalla completa. Pide lo indispensable para publicarlo
 * y, al guardar, lleva a la página del auto, donde se completa lo demás
 * (documentos, gastos, datos para la página) con un clic sobre cada dato.
 */

const CARROCERIAS = ['Sedán', 'SUV', 'Hatchback', 'Pickup', 'Coupé', 'Van', 'Minivan', 'Convertible', 'Premium', '4X4'];
const campoClase = 'w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500';

function Campo({ etiqueta, obligatorio, children, className }: { etiqueta: string; obligatorio?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <label className={clsx('flex flex-col gap-1 text-xs font-bold text-slate-700 dark:text-slate-300', className)}>
      <span>{etiqueta}{obligatorio && <span className="text-red-600"> *</span>}</span>
      {children}
    </label>
  );
}

export function AutoNuevo() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { userData, agencyData } = useAuth();
  const { can } = usePermissions();
  const { puedeVerCostos } = useCostosVehiculos();
  const esMaster = userData?.role === 'master';

  // El id se aparta desde el inicio: las fotos se suben a la carpeta de este auto.
  const nuevoId = useMemo(() => doc(collection(db, 'vehicles')).id, []);
  const [agencias, setAgencias] = useState<{ id: string; name: string }[]>([]);
  const [f, setF] = useState<any>({
    agencyId: userData?.agencyId && userData.agencyId !== 'unassigned' ? userData.agencyId : '',
    make: '', model: '', year: String(new Date().getFullYear()), price: '', costo: '',
    km: '', color: '', transmission: 'Automática', bodyType: 'Sedán', ownership: 'propio',
    receivedAt: hoyLocal(), vin: '', engineNumber: '', licensePlate: '', platesState: '', passengers: '5', liters: '', cylinders: '4', equipment: '',
    publicarEnWeb: params.get('web') === '1',
  });
  const [fotos, setFotos] = useState<string[]>([]);
  const [subiendo, setSubiendo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  // Lo que la persona ya escribió no lo pisa la consulta del VIN.
  const tocados = useRef(new Set<string>());
  const [consultaVin, setConsultaVin] = useState('');

  useEffect(() => {
    if (!esMaster) return;
    getDocs(collection(db, 'agencies')).then((s) => setAgencias(s.docs.map((d) => ({ id: d.id, name: d.data().name || d.id })))).catch(() => {});
  }, [esMaster]);

  if (!can('vehiculos.crear')) {
    return (
      <div className="p-10 text-center flex flex-col items-center gap-3">
        <p className="text-slate-600 dark:text-slate-400">Tu usuario no puede dar de alta autos.</p>
        <button type="button" onClick={() => navigate('/inventory')} className="px-4 py-2 rounded-lg bg-blue-700 text-white font-bold text-sm">Volver al inventario</button>
      </div>
    );
  }

  const poner = (campo: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    tocados.current.add(campo);
    setF((prev: any) => ({ ...prev, [campo]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }));
  };
  const llenarDesdeVin = (datos: Record<string, string>) => {
    const llenados = Object.keys(datos).filter((k) => !tocados.current.has(k) && datos[k]);
    if (llenados.length) setF((prev: any) => ({ ...prev, ...Object.fromEntries(llenados.map((k) => [k, datos[k]])) }));
    return llenados;
  };
  const numero = (v: string) => (v === '' ? 0 : Number(String(v).replace(/[^\d.]/g, '')) || 0);

  const subir = async (archivos: FileList | null) => {
    if (!archivos?.length) return;
    setSubiendo(`Subiendo 0 de ${archivos.length}…`);
    try {
      // Logo de la agencia en las fotos, si la agencia lo tiene activado
      // (el master que da de alta para otra agencia las sube sin logo).
      const cfg = configLogoDe(agencyData);
      const conLogo = cfg.activo && !!agencyData?.logoUrl && !esMaster;
      const logo = conLogo ? await prepararLogo(agencyData!.logoUrl, cfg.sinFondo) : null;
      const { urls: nuevas, fallidas } = await subirFotosDeAuto(archivos, userData?.id || 'sin-usuario', nuevoId, (h, t) => setSubiendo(`Subiendo ${h} de ${t}…`), logo ? { logo, config: cfg } : null);
      setFotos((prev) => [...prev, ...nuevas]);
      if (fallidas.length) setError(avisoFallidas(fallidas));
    } catch (e: any) {
      setError(`No se pudieron subir las fotos. ${e?.message || ''}`);
    } finally {
      setSubiendo('');
    }
  };

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!f.agencyId) return setError('Elige la agencia del auto.');
    if (!f.make.trim() || !f.model.trim() || !f.year) return setError('Marca, modelo y año son obligatorios.');
    if (!numero(f.price)) return setError('Pon el precio de venta.');
    if (subiendo) return setError('Espera a que terminen de subir las fotos.');
    setGuardando(true);
    try {
      const ahora = new Date().toISOString();
      await setDoc(doc(db, 'vehicles', nuevoId), sanitizeFirestoreData({
        id: nuevoId,
        agencyId: f.agencyId,
        status: 'available',
        make: f.make.trim(),
        model: f.model.trim(),
        year: numero(f.year),
        price: numero(f.price),
        km: numero(f.km),
        color: f.color.trim(),
        transmission: f.transmission,
        bodyType: f.bodyType,
        ownership: f.ownership,
        receivedAt: f.receivedAt,
        vin: f.vin.trim().toUpperCase(),
        engineNumber: f.engineNumber.trim().toUpperCase(),
        licensePlate: f.licensePlate.trim().toUpperCase(),
        ...(f.platesState.trim() ? { checklist: { platesState: f.platesState.trim() } } : {}),
        passengers: numero(f.passengers),
        liters: numero(f.liters),
        cylinders: numero(f.cylinders),
        equipment: f.equipment.trim(),
        websiteUrl: '',
        photoUrl: fotos[0] || '',
        photoUrls: fotos,
        expenses: [],
        ...(f.publicarEnWeb && userData?.role !== 'seller' ? { publicarEnWeb: true } : {}),
        createdAt: ahora,
        updatedAt: ahora,
      }));
      if (puedeVerCostos && f.costo !== '') await guardarCosto(nuevoId, f.agencyId, numero(f.costo));
      // La consulta del VIN queda en la ficha del auto (y su aviso de robo, si lo hay).
      if (consultaVin) {
        const token = await auth.currentUser?.getIdToken();
        await fetch(getApiUrl(`/api/placasinfo/consulta/${consultaVin}/ligar`), {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ vehicleId: nuevoId }),
        }).catch(() => {});
      }
      navigate(`/inventory/${nuevoId}`, { replace: true });
    } catch (e: any) {
      setError(`No se pudo guardar el auto. ${e?.message || ''}`);
      setGuardando(false);
    }
  };

  const portada = (i: number) => setFotos((prev) => { const l = [...prev]; const [x] = l.splice(i, 1); return [x, ...l]; });

  return (
    <div className="h-full overflow-y-auto bg-slate-100 dark:bg-slate-900">
      <form onSubmit={guardar} className="p-3 md:p-4 flex flex-col gap-3 max-w-[1400px] mx-auto">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => navigate('/inventory')} className="flex items-center gap-1 text-sm font-bold text-blue-700 hover:underline"><ArrowLeft className="w-4 h-4" /> Inventario</button>
            <h1 className="text-xl md:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">Nuevo auto</h1>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => navigate('/inventory')} className="min-h-[40px] px-4 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-bold">Cancelar</button>
            <button type="submit" disabled={guardando || !!subiendo} className="min-h-[40px] px-5 rounded-lg bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-sm font-bold">{guardando ? 'Guardando…' : 'Guardar auto'}</button>
          </div>
        </header>

        {error && <div role="alert" className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300 text-sm font-semibold px-3 py-2 whitespace-pre-line">{error}</div>}

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-3">
          {/* Fotos */}
          <section className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex flex-col gap-3">
            <h2 className="text-sm font-extrabold">Fotos <span className="text-slate-500 font-semibold">{fotos.length}</span></h2>
            <label
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); subir(e.dataTransfer.files); }}
              className="flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 py-8 cursor-pointer hover:border-blue-500 hover:bg-blue-50/40 dark:hover:bg-blue-950/20 text-center"
            >
              <Upload className="w-7 h-7 text-slate-500" />
              <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{subiendo || 'Arrastra las fotos aquí o haz clic para elegirlas'}</span>
              <span className="text-xs text-slate-500">La primera será la portada. Se comprimen solas.{!esMaster && configLogoDe(agencyData).activo && agencyData?.logoUrl ? ' Llevarán el logo de la agencia.' : ''}</span>
              <input type="file" accept="image/*" multiple className="hidden" disabled={!!subiendo} onChange={(e) => { subir(e.target.files); e.target.value = ''; }} />
            </label>
            {fotos.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {fotos.map((u, i) => (
                  <div key={u} className="relative group aspect-[4/3] rounded-md overflow-hidden bg-slate-100">
                    <img src={u} alt="" className="w-full h-full object-cover" />
                    {i === 0 ? (
                      <span className="absolute top-1 left-1 bg-black/70 text-white text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5"><Star className="w-2.5 h-2.5" /> Portada</span>
                    ) : (
                      <button type="button" onClick={() => portada(i)} className="absolute bottom-1 left-1 bg-black/70 text-white text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 md:opacity-0 md:group-hover:opacity-100"><Star className="w-2.5 h-2.5" /> Portada</button>
                    )}
                    <button type="button" aria-label="Quitar foto" onClick={() => setFotos((prev) => prev.filter((_, j) => j !== i))} className="absolute top-1 right-1 w-7 h-7 rounded-full bg-red-600 text-white flex items-center justify-center md:opacity-0 md:group-hover:opacity-100"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Datos */}
          <section className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex flex-col gap-3">
            <h2 className="text-sm font-extrabold">Datos del auto</h2>
            {esMaster && (
              <Campo etiqueta="Agencia" obligatorio>
                <select value={f.agencyId} onChange={poner('agencyId')} className={campoClase}>
                  <option value="">Elige una agencia…</option>
                  {agencias.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </Campo>
            )}
            <LlenarDesdeVin
              vin={f.vin}
              onVin={(v) => { tocados.current.add('vin'); setF((prev: any) => ({ ...prev, vin: v.toUpperCase() })); }}
              anio={tocados.current.has('year') || consultaVin ? Number(f.year) || undefined : undefined}
              onDatos={llenarDesdeVin}
              onConsulta={setConsultaVin}
              campoClase={campoClase}
            />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Campo etiqueta="Marca" obligatorio><input value={f.make} onChange={poner('make')} placeholder="Nissan" className={campoClase} /></Campo>
              <Campo etiqueta="Modelo y versión" obligatorio className="md:col-span-2"><input value={f.model} onChange={poner('model')} placeholder="Pathfinder Advance" className={campoClase} /></Campo>
              <Campo etiqueta="Año" obligatorio><input value={f.year} onChange={poner('year')} inputMode="numeric" className={campoClase} /></Campo>
              <Campo etiqueta="Precio de venta" obligatorio><input value={f.price} onChange={poner('price')} inputMode="decimal" placeholder="$0" className={campoClase} /></Campo>
              {puedeVerCostos && (
                <Campo etiqueta={f.ownership === 'consignacion' ? 'Se le paga al dueño' : 'Costo de compra'}><input value={f.costo} onChange={poner('costo')} inputMode="decimal" placeholder="$0" className={campoClase} /></Campo>
              )}
              <Campo etiqueta="Kilometraje"><input value={f.km} onChange={poner('km')} inputMode="numeric" placeholder="0" className={campoClase} /></Campo>
              <Campo etiqueta="Color"><input value={f.color} onChange={poner('color')} className={campoClase} /></Campo>
              <Campo etiqueta="Transmisión">
                <select value={f.transmission} onChange={poner('transmission')} className={campoClase}><option>Automática</option><option>Manual</option></select>
              </Campo>
              <Campo etiqueta="Carrocería">
                <select value={f.bodyType} onChange={poner('bodyType')} className={campoClase}>{CARROCERIAS.map((c) => <option key={c}>{c}</option>)}</select>
              </Campo>
              <Campo etiqueta="Propiedad">
                <select value={f.ownership} onChange={poner('ownership')} className={campoClase}><option value="propio">Propio</option><option value="consignacion">Consignación</option></select>
              </Campo>
              <Campo etiqueta="Fecha de recepción"><input type="date" value={f.receivedAt} onChange={poner('receivedAt')} className={campoClase} /></Campo>
              <Campo etiqueta="Motor (litros)"><input value={f.liters} onChange={poner('liters')} inputMode="decimal" className={campoClase} /></Campo>
              <Campo etiqueta="Cilindros"><input value={f.cylinders} onChange={poner('cylinders')} inputMode="numeric" className={campoClase} /></Campo>
              <Campo etiqueta="Pasajeros"><input value={f.passengers} onChange={poner('passengers')} inputMode="numeric" className={campoClase} /></Campo>
              <Campo etiqueta="Número de motor"><input value={f.engineNumber} onChange={poner('engineNumber')} className={clsx(campoClase, 'uppercase')} /></Campo>
              <Campo etiqueta="Placas"><input value={f.licensePlate} onChange={poner('licensePlate')} className={clsx(campoClase, 'uppercase')} /></Campo>
              <Campo etiqueta="Estado de placas" className="md:col-span-2"><input value={f.platesState} onChange={poner('platesState')} placeholder="Guanajuato" className={campoClase} /></Campo>
              <Campo etiqueta="Equipamiento" className="col-span-2 md:col-span-4"><textarea value={f.equipment} onChange={poner('equipment')} rows={2} className={campoClase} /></Campo>
            </div>
            {userData?.role !== 'seller' && (
              <label className="flex items-start gap-2.5 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 cursor-pointer">
                <input type="checkbox" checked={f.publicarEnWeb} onChange={poner('publicarEnWeb')} className="mt-0.5 w-4 h-4 accent-blue-700" />
                <span className="flex flex-col">
                  <span className="text-sm font-bold">Publicar en nextcar.erewere.com</span>
                  <span className="text-xs text-slate-600 dark:text-slate-400">Aparece en la página en unos minutos, si tiene fotos. Si se vende o se aparta, se quita solo.</span>
                </span>
              </label>
            )}
            <p className="text-xs text-slate-600 dark:text-slate-400">Documentos, gastos y datos para la página los completas después en la página del auto, con un clic sobre cada dato.</p>
          </section>
        </div>
      </form>
    </div>
  );
}
