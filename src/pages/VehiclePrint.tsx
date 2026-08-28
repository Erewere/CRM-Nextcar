import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Vehicle } from '../types';

import { useAuth } from '../contexts/AuthContext';
export function VehiclePrint() {
  const { agencyData } = useAuth();
  const { id } = useParams();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);

  const [imgLoaded, setImgLoaded] = useState(false);
  const [printTriggered, setPrintTriggered] = useState(false);

  useEffect(() => {
    if (!id) return;
    getDoc(doc(db, 'vehicles', id)).then(snap => {
      if (snap.exists()) {
        const v = { ...snap.data(), id: snap.id } as Vehicle;
        setVehicle(v);
        if (!v.photoUrls?.[0] && !v.photoUrl) {
           setImgLoaded(true);
        }
      }
    }).catch(err => console.error("Error fetching vehicle for print:", err));
  }, [id]);

  useEffect(() => {
    if (vehicle && imgLoaded && !printTriggered) {
      setPrintTriggered(true);
      setTimeout(() => {
        window.print();
      }, 500);
    }
  }, [vehicle, imgLoaded, printTriggered]);

  if (!vehicle) return <div className="p-10 text-center font-bold text-xl">Cargando datos del vehículo...</div>;

  // Solo lo que este lleno: una ficha con seis guiones se lee como un
  // formulario a medio llenar, no como la hoja de un auto.
  const fichas = [
    ["Año", vehicle.year ? String(vehicle.year) : ""],
    ["Kilometraje", vehicle.km ? `${vehicle.km.toLocaleString("es-MX")} km` : ""],
    ["Transmisión", vehicle.transmission || ""],
    ["Carrocería", vehicle.bodyType || ""],
    ["Color", vehicle.color || ""],
    ["Motor", vehicle.liters ? `${vehicle.liters} L` : ""],
    ["Cilindros", vehicle.cylinders ? String(vehicle.cylinders) : ""],
    ["Pasajeros", vehicle.passengers ? String(vehicle.passengers) : ""],
  ].filter(([, v]) => v);

  // El equipamiento se captura separado por comas; en etiquetas sueltas se
  // recorre de un vistazo, en un parrafo hay que leerlo entero.
  const equipo = (vehicle.equipment || "")
    .split(/[,;]/)
    .map((x) => x.trim())
    .filter(Boolean);

  const foto = vehicle.photoUrls?.[0] || vehicle.photoUrl;
  const precio = vehicle.price > 0
    ? new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(vehicle.price)
    : "";

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white p-6 print:p-0 font-sans">
      <div className="mx-auto max-w-[5.5in] bg-white print:max-w-none rounded-2xl print:rounded-none shadow-xl print:shadow-none overflow-hidden flex flex-col min-h-[8.5in] print:min-h-[8.2in]">

        <button
          onClick={() => window.print()}
          className="fixed bottom-6 right-6 print:hidden bg-slate-900 text-white px-5 py-3 rounded-full font-bold shadow-2xl hover:bg-slate-800 transition-colors z-10 flex items-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
          Imprimir / PDF
        </button>

        {/* La marca de la agencia arriba, discreta: la protagonista es el auto. */}
        <div className="flex items-center justify-between gap-3 px-7 print:px-6 pt-6 print:pt-4 pb-4">
          {agencyData?.logoUrl ? (
            <img src={agencyData.logoUrl} alt={agencyData.name || ""} className="max-h-11 print:max-h-9 max-w-[45%] object-contain" />
          ) : (
            <span className="text-[13px] font-bold uppercase tracking-[0.18em] text-slate-800">
              {agencyData?.name || ""}
            </span>
          )}
          {agencyData?.phone && (
            <span className="text-[13px] font-semibold text-slate-500 whitespace-nowrap">{agencyData.phone}</span>
          )}
        </div>

        {/* El titulo: el modelo manda, la marca lo acompaña. Antes la marca iba
            enorme y el modelo pequeño, cuando lo que distingue a un auto de
            otro en el mismo lote es justamente el modelo. */}
        <div className="px-7 print:px-6 pb-5">
          <p className="text-[13px] font-bold uppercase tracking-[0.18em] text-blue-600">{vehicle.make}</p>
          <h1 className="text-[34px] print:text-[30px] leading-[1.08] font-extrabold text-slate-900 tracking-tight mt-0.5">
            {vehicle.model}
          </h1>
        </div>

        {foto && (
          <div className="px-7 print:px-6">
            <img
              src={foto}
              alt={`${vehicle.make} ${vehicle.model}`}
              className="w-full h-[240px] print:h-[200px] object-cover rounded-xl"
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgLoaded(true)}
            />
          </div>
        )}

        <div className="px-7 print:px-6 pt-6 print:pt-5">
          <div className="grid grid-cols-2 gap-x-8 gap-y-0">
            {fichas.map(([etiqueta, valor], i) => (
              <div
                key={etiqueta}
                className={`flex items-baseline justify-between gap-3 py-2.5 print:py-2 ${i < fichas.length - (fichas.length % 2 === 0 ? 2 : 1) ? "border-b border-slate-100" : ""}`}
              >
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">{etiqueta}</span>
                <span className="text-[15px] print:text-[14px] font-semibold text-slate-900 text-right">{valor}</span>
              </div>
            ))}
          </div>
        </div>

        {equipo.length > 0 && (
          <div className="px-7 print:px-6 pt-5 print:pt-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Equipamiento</p>
            <div className="flex flex-wrap gap-1.5">
              {equipo.map((x) => (
                <span key={x} className="rounded-full bg-slate-100 px-2.5 py-1 text-[12px] print:text-[11px] font-semibold text-slate-700">
                  {x}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* El precio cierra la hoja, con la direccion al lado: el cliente se la
            lleva a su casa y ahi es donde tiene que encontrar donde estas. */}
        <div className="mt-auto px-7 print:px-6 pt-6 print:pt-5 pb-6 print:pb-5">
          {precio && (
            <div className="flex items-end justify-between gap-4 border-t border-slate-200 pt-5 print:pt-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Precio</p>
                <p className="text-[38px] print:text-[32px] leading-none font-extrabold text-slate-900 tracking-tight mt-1">
                  {precio}
                </p>
              </div>
              {agencyData?.address && (
                <p className="text-[11px] print:text-[10px] leading-snug text-slate-500 text-right max-w-[48%]">
                  {agencyData.address}
                </p>
              )}
            </div>
          )}
          {!precio && agencyData?.address && (
            <p className="text-[11px] text-slate-500 border-t border-slate-200 pt-4">{agencyData.address}</p>
          )}
        </div>
      </div>

      <style>{`
        @media print {
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            background-color: white;
          }
          @page {
            margin: 0.25in;
            size: 5.5in 8.5in; /* Media carta (Statement) */
          }
        }
      `}</style>
    </div>
  );
}
