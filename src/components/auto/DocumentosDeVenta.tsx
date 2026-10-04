import React, { useMemo, useState } from 'react';
import clsx from 'clsx';
import { FileSignature, Info, X } from 'lucide-react';
import type { Client, Vehicle } from '../../types';
import { generarDocumentosVenta, type DatosDocumentos, type Parte } from '../../lib/contratosPdf';
import { descargarOCompartir } from '../../lib/fichaPdf';
import { pesosALetras } from '../../lib/numeroALetras';

/**
 * Contrato de compraventa y carta responsiva, prellenados con el auto, la
 * agencia y el cliente. Lo que se escribe aquí (identificaciones,
 * domicilios) solo va al PDF: no se guarda en el CRM.
 */

const hoy = () => new Date().toLocaleDateString('en-CA');
const ahora = () => new Date().toTimeString().slice(0, 5);

function domicilioDe(c?: Client | null) {
  if (!c) return '';
  const partes = [[c.street, c.exteriorNumber].filter(Boolean).join(' '), c.neighborhood, c.city, c.zipCode ? `C.P. ${c.zipCode}` : ''].filter(Boolean);
  return partes.length ? partes.join(', ') : (c.address || '');
}

function formaDePagoDe(auto: Vehicle) {
  const sd: any = auto.saleDetails;
  if (!sd) return 'De contado, en una sola exhibición';
  if (sd.method === 'contado') return 'De contado, en una sola exhibición';
  const enganche = sd.downPayment ? `enganche de $${Number(sd.downPayment).toLocaleString('es-MX')}` : 'enganche';
  const plazo = sd.termMonths ? ` y ${sd.termMonths} pagos mensuales${sd.calculatedMonthlyPayment ? ` de $${Math.round(sd.calculatedMonthlyPayment).toLocaleString('es-MX')}` : ''}` : '';
  return sd.method === 'credito_bancario' ? `${enganche} y el resto mediante crédito bancario` : `${enganche}${plazo}, conforme al plan de pagos acordado`;
}

const campo = 'w-full px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100';
const etiqueta = 'flex flex-col gap-1 text-xs font-bold text-slate-700 dark:text-slate-300';

export function DocumentosDeVenta({ auto, agencia, clientes, compradorId, usuario, entregables, onCerrar }: {
  auto: Vehicle;
  agencia: any;
  clientes: Client[];
  compradorId?: string;
  usuario: { name?: string };
  entregables: string[];
  onCerrar: () => void;
}) {
  const [operacion, setOperacion] = useState<'venta' | 'compra'>('venta');
  const [incluir, setIncluir] = useState({ contrato: true, responsiva: true });
  const [agenciaParte, setAgenciaParte] = useState<Parte>({
    nombre: agencia?.name || '', representante: usuario.name || '', domicilio: agencia?.address || '', identificacion: '', telefono: agencia?.phone || '',
  });
  const clienteInicial = clientes.find((c) => c.id === compradorId) || null;
  const [clienteId, setClienteId] = useState(clienteInicial?.id || '');
  const [busqueda, setBusqueda] = useState('');
  const [otraParte, setOtraParte] = useState<Parte>({
    nombre: clienteInicial?.name || '', domicilio: domicilioDe(clienteInicial), identificacion: '', telefono: clienteInicial?.phone || '',
  });
  const [vehiculo, setVehiculo] = useState({
    marca: auto.make || '', modelo: auto.model || '', anio: String(auto.year || ''), color: auto.color || '', carroceria: auto.bodyType || '',
    niv: auto.vin || '', motor: auto.engineNumber || '', placas: (auto as any).licensePlate || '', estadoPlacas: (auto as any).checklist?.platesState || '',
    km: auto.km ? Number(auto.km).toLocaleString('es-MX') : '', factura: '',
  });
  const [precio, setPrecio] = useState(String((auto.saleDetails as any)?.price || auto.price || ''));
  const [formaDePago, setFormaDePago] = useState(formaDePagoDe(auto));
  const [fecha, setFecha] = useState(hoy());
  const [hora, setHora] = useState(ahora());
  const [ciudad, setCiudad] = useState(clienteInicial?.city || '');
  const [documentos, setDocumentos] = useState(entregables.join(', '));
  const [garantia, setGarantia] = useState('');
  const [dias, setDias] = useState('30');
  const [testigos, setTestigos] = useState(['', '']);
  const [haciendo, setHaciendo] = useState(false);

  const opcionesClientes = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return clientes.filter((c) => !c.isDeleted && (!q || `${c.name} ${c.phone}`.toLowerCase().includes(q))).slice(0, 30);
  }, [clientes, busqueda]);

  const elegirCliente = (id: string) => {
    setClienteId(id);
    const c = clientes.find((x) => x.id === id);
    if (c) {
      setOtraParte((p) => ({ ...p, nombre: c.name || '', domicilio: domicilioDe(c), telefono: c.phone || '' }));
      if (!ciudad && c.city) setCiudad(c.city);
    }
  };

  const vendedor = operacion === 'venta' ? agenciaParte : otraParte;
  const comprador = operacion === 'venta' ? otraParte : agenciaParte;

  const generar = async () => {
    setHaciendo(true);
    try {
      const datos: DatosDocumentos = {
        operacion, vendedor, comprador, vehiculo,
        precio: Number(String(precio).replace(/[^\d.]/g, '')) || 0,
        formaDePago, fecha, hora, ciudad,
        documentosEntregados: documentos.split(',').map((s) => s.trim()).filter(Boolean),
        garantia: operacion === 'venta' ? garantia : '',
        diasCambioPropietario: Number(dias) || 30,
        testigos, incluir, agencia,
      };
      const blob = await generarDocumentosVenta(datos);
      const que = incluir.contrato && incluir.responsiva ? 'Contrato y responsiva' : incluir.contrato ? 'Contrato de compraventa' : 'Carta responsiva';
      await descargarOCompartir(blob, `${que} ${vehiculo.marca} ${vehiculo.modelo} ${vehiculo.anio}.pdf`.replace(/[^\w áéíóúñÁÉÍÓÚÑ.-]+/g, ''), que);
    } catch (e: any) {
      alert(`No se pudo hacer el documento. ${e?.message || ''}`);
    } finally {
      setHaciendo(false);
    }
  };

  const parteForm = (titulo: string, p: Parte, set: (p: Parte) => void, esAgencia: boolean) => (
    <fieldset className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 flex flex-col gap-2.5">
      <legend className="px-1 text-sm font-extrabold text-slate-900 dark:text-white">{titulo}</legend>
      {!esAgencia && (
        <div className="flex flex-col gap-1.5">
          <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar cliente del CRM…" className={campo} />
          <select value={clienteId} onChange={(e) => elegirCliente(e.target.value)} className={campo} aria-label="Elegir cliente">
            <option value="">— Elegir de mis clientes, o escribir abajo —</option>
            {opcionesClientes.map((c) => <option key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ''}</option>)}
          </select>
        </div>
      )}
      <label className={etiqueta}>{esAgencia ? 'Agencia (nombre o razón social)' : 'Nombre completo'}
        <input value={p.nombre} onChange={(e) => set({ ...p, nombre: e.target.value })} className={campo} />
      </label>
      {esAgencia && (
        <label className={etiqueta}>Representante que firma
          <input value={p.representante || ''} onChange={(e) => set({ ...p, representante: e.target.value })} className={campo} />
        </label>
      )}
      <label className={etiqueta}>Domicilio
        <input value={p.domicilio} onChange={(e) => set({ ...p, domicilio: e.target.value })} className={campo} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className={etiqueta}>Identificación
          <input value={p.identificacion} onChange={(e) => set({ ...p, identificacion: e.target.value })} placeholder={esAgencia ? 'RFC o INE del representante' : 'INE 0000000000000'} className={campo} />
        </label>
        <label className={etiqueta}>Teléfono
          <input value={p.telefono || ''} onChange={(e) => set({ ...p, telefono: e.target.value })} className={campo} />
        </label>
      </div>
    </fieldset>
  );

  const v = (k: keyof typeof vehiculo, texto: string, ph = '') => (
    <label className={etiqueta}>{texto}
      <input value={vehiculo[k]} onChange={(e) => setVehiculo({ ...vehiculo, [k]: e.target.value })} placeholder={ph} className={campo} />
    </label>
  );

  return (
    <div className="fixed inset-0 z-[110] flex items-stretch md:items-center justify-center md:p-4" role="dialog" aria-modal="true" aria-labelledby="titulo-contrato">
      <div className="absolute inset-0 bg-slate-900/60" onClick={haciendo ? undefined : onCerrar} />
      <div className="relative bg-white dark:bg-slate-800 md:rounded-2xl shadow-2xl w-full max-w-5xl md:max-h-[94vh] flex flex-col">
        <div className="flex items-start justify-between gap-3 p-4 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 id="titulo-contrato" className="text-lg font-extrabold text-slate-900 dark:text-white">Contrato y carta responsiva</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">Revisa y completa los datos. Lo que escribas aquí solo va al PDF; no se guarda.</p>
          </div>
          <button type="button" onClick={onCerrar} disabled={haciendo} aria-label="Cerrar" className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-900" role="group" aria-label="Tipo de operación">
              {([['venta', 'La agencia vende'], ['compra', 'La agencia compra']] as const).map(([k, t]) => (
                <button key={k} type="button" onClick={() => setOperacion(k)} aria-pressed={operacion === k}
                  className={clsx('px-3 py-1.5 rounded-lg text-sm font-bold', operacion === k ? 'bg-white dark:bg-slate-700 shadow text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400')}>{t}</button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200 cursor-pointer">
              <input type="checkbox" checked={incluir.contrato} onChange={(e) => setIncluir({ ...incluir, contrato: e.target.checked })} className="w-4 h-4 accent-blue-700" /> Contrato de compraventa
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200 cursor-pointer">
              <input type="checkbox" checked={incluir.responsiva} onChange={(e) => setIncluir({ ...incluir, responsiva: e.target.checked })} className="w-4 h-4 accent-blue-700" /> Carta responsiva
            </label>
          </div>

          {operacion === 'venta' && incluir.contrato && (
            <p className="text-xs rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 px-3 py-2 flex gap-2">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              Para vender a un consumidor, la NOM-122-SCFI pide usar el contrato de adhesión registrado ante Profeco. Este contrato es un modelo: revísalo con tu abogado, o usa tu contrato registrado y solo la carta responsiva.
            </p>
          )}

          <div className="grid md:grid-cols-2 gap-3">
            {operacion === 'venta' ? <>
              {parteForm('Vendedor (la agencia)', agenciaParte, setAgenciaParte, true)}
              {parteForm('Comprador (el cliente)', otraParte, setOtraParte, false)}
            </> : <>
              {parteForm('Vendedor (el particular)', otraParte, setOtraParte, false)}
              {parteForm('Comprador (la agencia)', agenciaParte, setAgenciaParte, true)}
            </>}
          </div>

          <fieldset className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
            <legend className="px-1 text-sm font-extrabold text-slate-900 dark:text-white">Vehículo</legend>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              {v('marca', 'Marca')}{v('modelo', 'Modelo / versión')}{v('anio', 'Año')}{v('color', 'Color')}
              {v('niv', 'NIV (número de serie)')}{v('motor', 'Número de motor', 'Captúralo en «Datos del auto»')}{v('placas', 'Placas')}{v('estadoPlacas', 'Estado de las placas', 'Ej. Jalisco')}
              {v('km', 'Kilometraje')}{v('carroceria', 'Tipo')}
              <div className="col-span-2">{v('factura', 'Factura (número, quién la expide y fecha)', 'Ej. A-1234 de Autos del Centro, 12/03/2021')}</div>
            </div>
          </fieldset>

          <fieldset className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
            <legend className="px-1 text-sm font-extrabold text-slate-900 dark:text-white">Operación</legend>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              <label className={etiqueta}>Precio
                <input value={precio} onChange={(e) => setPrecio(e.target.value)} inputMode="decimal" className={campo} />
              </label>
              <label className={etiqueta}>Fecha de entrega
                <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={campo} />
              </label>
              <label className={etiqueta}>Hora
                <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className={campo} />
              </label>
              <label className={etiqueta}>Ciudad
                <input value={ciudad} onChange={(e) => setCiudad(e.target.value)} placeholder="Ej. Zapopan, Jalisco" className={campo} />
              </label>
              <p className="col-span-2 md:col-span-4 text-[11px] text-slate-500 -mt-1">{Number(String(precio).replace(/[^\d.]/g, '')) > 0 ? pesosALetras(Number(String(precio).replace(/[^\d.]/g, ''))) : ''}</p>
              <label className={clsx(etiqueta, 'col-span-2 md:col-span-4')}>Forma de pago
                <input value={formaDePago} onChange={(e) => setFormaDePago(e.target.value)} className={campo} />
              </label>
              <label className={clsx(etiqueta, 'col-span-2 md:col-span-4')}>Documentos y accesorios que se entregan (separados por coma)
                <input value={documentos} onChange={(e) => setDocumentos(e.target.value)} placeholder="Factura original, tarjeta de circulación, duplicado de llaves…" className={campo} />
              </label>
              {operacion === 'venta' && (
                <label className={clsx(etiqueta, 'col-span-2 md:col-span-3')}>Garantía (opcional)
                  <input value={garantia} onChange={(e) => setGarantia(e.target.value)} placeholder="Ej. 3 meses o 5,000 km en motor y transmisión. Vacío = sin garantía adicional" className={campo} />
                </label>
              )}
              <label className={etiqueta}>Días para el cambio de propietario
                <input value={dias} onChange={(e) => setDias(e.target.value)} inputMode="numeric" className={campo} />
              </label>
              <label className={clsx(etiqueta, 'col-span-1 md:col-span-2')}>Testigo 1 (opcional)
                <input value={testigos[0]} onChange={(e) => setTestigos([e.target.value, testigos[1]])} className={campo} />
              </label>
              <label className={clsx(etiqueta, 'col-span-1 md:col-span-2')}>Testigo 2 (opcional)
                <input value={testigos[1]} onChange={(e) => setTestigos([testigos[0], e.target.value])} className={campo} />
              </label>
            </div>
          </fieldset>
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-end gap-2">
          <p className="mr-auto text-xs text-slate-600 dark:text-slate-400">Lo que quede vacío sale con una línea para llenarlo a mano.</p>
          <button type="button" onClick={onCerrar} disabled={haciendo} className="min-h-[40px] px-4 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700">Cancelar</button>
          <button type="button" onClick={generar} disabled={haciendo || (!incluir.contrato && !incluir.responsiva)}
            className="min-h-[40px] px-4 rounded-lg bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-sm font-bold flex items-center gap-1.5">
            <FileSignature className="w-4 h-4" /> {haciendo ? 'Preparando…' : 'Hacer PDF'}
          </button>
        </div>
      </div>
    </div>
  );
}
