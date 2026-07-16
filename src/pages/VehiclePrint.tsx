import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Vehicle } from '../types';

export function VehiclePrint() {
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
    });
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

  return (
    <div className="p-4 sm:p-8 max-w-2xl mx-auto bg-white min-h-screen text-slate-900 font-sans print:p-0 print:w-full print:max-w-none">
      <div className="border-[8px] print:border-[6px] border-slate-900 p-6 print:p-5 rounded-3xl flex flex-col min-h-[90vh] print:min-h-[100%] print:h-[8.2in] relative bg-white">
        
        {/* Floating Print Button (Hidden when printing) */}
        <button 
          onClick={() => window.print()} 
          className="absolute top-6 right-6 print:hidden bg-slate-900 text-white px-6 py-3 rounded-full font-bold shadow-xl hover:bg-slate-800 transition-colors z-10 flex items-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
          Imprimir / PDF
        </button>

        {/* Header */}
        <div className="text-center mb-4 print:mb-3 border-b-[6px] print:border-b-[4px] border-slate-900 pb-4 print:pb-2">
          <h1 className="text-5xl print:text-4xl font-black uppercase tracking-tighter mb-1">
            {vehicle.make}
          </h1>
          <h2 className="text-3xl print:text-2xl font-bold text-slate-700">
            {vehicle.model} <span className="text-slate-400">|</span> {vehicle.year}
          </h2>
        </div>

        {/* Photo */}
        {(vehicle.photoUrls?.[0] || vehicle.photoUrl) && (
          <div className="mb-6 print:mb-4 w-full flex justify-center">
            <img 
              src={vehicle.photoUrls?.[0] || vehicle.photoUrl} 
              alt={`${vehicle.make} ${vehicle.model}`} 
              className="max-h-[300px] print:max-h-[220px] w-auto object-cover rounded-2xl shadow-xl border-4 border-slate-200"
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgLoaded(true)}
              
            />
          </div>
        )}

        {/* Details Grid */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-3 mb-6 print:mb-4 text-lg print:text-base">
          <div className="flex justify-between border-b-2 border-slate-100 pb-1.5">
            <span className="font-bold text-slate-500 uppercase">Transmisión:</span>
            <span className="font-black text-right">{vehicle.transmission}</span>
          </div>
          <div className="flex justify-between border-b-2 border-slate-100 pb-1.5">
            <span className="font-bold text-slate-500 uppercase">Kilometraje:</span>
            <span className="font-black text-right">{vehicle.km.toLocaleString()} km</span>
          </div>
          <div className="flex justify-between border-b-2 border-slate-100 pb-1.5">
            <span className="font-bold text-slate-500 uppercase">Color:</span>
            <span className="font-black text-right">{vehicle.color}</span>
          </div>
          <div className="flex justify-between border-b-2 border-slate-100 pb-1.5">
            <span className="font-bold text-slate-500 uppercase">Carrocería:</span>
            <span className="font-black text-right">{vehicle.bodyType}</span>
          </div>
          <div className="flex justify-between border-b-2 border-slate-100 pb-1.5">
            <span className="font-bold text-slate-500 uppercase">Cilindros:</span>
            <span className="font-black text-right">{vehicle.cylinders || '-'}</span>
          </div>
          <div className="flex justify-between border-b-2 border-slate-100 pb-1.5">
            <span className="font-bold text-slate-500 uppercase">Motor:</span>
            <span className="font-black text-right">{vehicle.liters ? `${vehicle.liters} L` : '-'}</span>
          </div>
          <div className="flex justify-between border-b-2 border-slate-100 pb-1.5 col-span-2">
            <span className="font-bold text-slate-500 uppercase">Pasajeros:</span>
            <span className="font-black text-right">{vehicle.passengers || '-'}</span>
          </div>
        </div>

        {/* Equipment / Extra Info */}
        {vehicle.equipment && (
          <div className="mb-6 print:mb-4 bg-slate-100 p-4 rounded-xl">
            <h3 className="text-lg print:text-sm font-black uppercase tracking-widest mb-1 text-slate-800">
              Equipamiento Destacado
            </h3>
            <p className="text-base print:text-xs leading-snug font-medium text-slate-700">{vehicle.equipment}</p>
          </div>
        )}

        {/* Price */}
        {vehicle.price > 0 && (
          <div className="mt-auto text-center border-t-[6px] print:border-t-[4px] border-slate-900 pt-6 print:pt-4 bg-slate-50 rounded-b-xl -mx-6 -mb-6 print:-mx-5 print:-mb-5 pb-6 print:pb-4">
            <div className="text-xl print:text-lg font-bold text-slate-500 uppercase mb-2 tracking-widest">Precio de Venta</div>
            <div className="text-6xl print:text-5xl font-black text-slate-900">${vehicle.price.toLocaleString()}</div>
          </div>
        )}
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
