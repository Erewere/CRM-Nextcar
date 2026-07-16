import os

path = "src/components/VehicleDetailModal.tsx"
with open(path, "r") as f:
    lines = f.readlines()

start_idx = -1
end_idx = -1

for i, line in enumerate(lines):
    if "{/* Hidden PDF View */}" in line:
        start_idx = i
    if "{/* Decorative elements */}" in line:
        end_idx = i + 4 # skip the elements and closing divs

if start_idx != -1 and end_idx != -1:
    new_pdf_layout = """        {/* Hidden PDF View */}
        <div className="fixed top-[-9999px] left-[-9999px] pointer-events-none">
          <div ref={pdfRef} className="w-[800px] h-[1131px] flex flex-col p-8 font-sans relative overflow-hidden" style={{ background: 'linear-gradient(to bottom right, #0f172a, #1e293b)', color: '#ffffff' }}>
            
            {/* Header section with brand/agency name if available */}
            <div className="w-full flex justify-between items-center mb-6 z-10">
               <div className="text-3xl font-black tracking-widest" style={{ color: 'rgba(255, 255, 255, 0.5)' }}>FICHA TÉCNICA</div>
               <div className="text-3xl font-bold px-6 py-2 rounded-full" style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', color: '#60a5fa' }}>
                 {userData?.role === 'master' ? 'AUTO DEALER' : 'NUESTRO INVENTARIO'}
               </div>
            </div>

            {/* Top row: Image on left, Title & Price on right */}
            <div className="flex w-full gap-6 mb-8 z-10">
               {/* Left: Image */}
               <div className="w-[420px] h-[320px] rounded-[30px] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] border-[6px] relative flex items-center justify-center shrink-0" style={{ borderColor: 'rgba(255,255,255,0.1)', backgroundColor: '#1e293b' }}>
                  {(formData.photoUrls?.[0] || formData.photoUrl || vehicle?.photoUrls?.[0] || vehicle?.photoUrl) ? (
                    <img 
                      src={formData.photoUrls?.[0] || formData.photoUrl || vehicle?.photoUrls?.[0] || vehicle?.photoUrl} 
                      alt={`${vehicle.make} ${vehicle.model}`}
                      className="w-full h-full object-cover"
                      crossOrigin="anonymous"
                    />
                  ) : (
                    <div className="text-3xl font-medium flex flex-col items-center" style={{ color: '#64748b' }}>
                      <span>Sin Imagen</span>
                    </div>
                  )}
                  {vehicle.status === 'sold' && (
                    <div className="absolute inset-0 flex items-center justify-center backdrop-blur-sm" style={{ backgroundColor: 'rgba(220, 38, 38, 0.8)' }}>
                      <span className="font-black text-5xl rotate-[-15deg] uppercase tracking-widest border-4 p-4 rounded-3xl" style={{ color: '#ffffff', borderColor: '#ffffff' }}>VENDIDO</span>
                    </div>
                  )}
               </div>

               {/* Right: Title & Price */}
               <div className="flex-1 flex flex-col justify-center">
                  <h1 className="text-[50px] font-black uppercase leading-none tracking-tight mb-2" style={{ color: '#ffffff', textShadow: '0 5px 15px rgba(0,0,0,0.5)' }}>
                    {vehicle.make}
                  </h1>
                  <h2 className="text-[35px] font-bold tracking-wide mb-6" style={{ color: '#60a5fa' }}>
                    {vehicle.model} <span style={{ color: 'rgba(255, 255, 255, 0.3)' }}>|</span> <span style={{ color: '#ffffff' }}>{vehicle.year}</span>
                  </h2>
                  
                  {vehicle.price > 0 && (
                    <div className="w-full rounded-[24px] py-4 px-6 flex flex-col justify-center shadow-2xl" style={{ background: 'linear-gradient(to right, #2563eb, #3b82f6)' }}>
                      <span className="text-lg font-bold uppercase tracking-widest mb-1" style={{ color: 'rgba(255, 255, 255, 0.9)' }}>Precio de Venta</span>
                      <span className="text-[40px] font-black leading-none" style={{ color: '#ffffff' }}>${Number(vehicle.price).toLocaleString()}</span>
                    </div>
                  )}
               </div>
            </div>

            {/* Vehicle Specifications Grid */}
            <div className="w-full backdrop-blur-md rounded-[30px] p-6 border grid grid-cols-3 gap-x-8 gap-y-6 mb-8 z-10" style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', borderColor: 'rgba(255, 255, 255, 0.1)' }}>
              <div className="flex flex-col border-b-2 pb-4" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
                <span className="text-base font-semibold uppercase tracking-wider mb-1" style={{ color: '#93c5fd' }}>Kilometraje</span>
                <span className="text-2xl font-black" style={{ color: '#ffffff' }}>{Number(vehicle.km || 0).toLocaleString()} km</span>
              </div>
              <div className="flex flex-col border-b-2 pb-4" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
                <span className="text-base font-semibold uppercase tracking-wider mb-1" style={{ color: '#93c5fd' }}>Transmisión</span>
                <span className="text-2xl font-black" style={{ color: '#ffffff' }}>{vehicle.transmission}</span>
              </div>
              <div className="flex flex-col border-b-2 pb-4" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
                <span className="text-base font-semibold uppercase tracking-wider mb-1" style={{ color: '#93c5fd' }}>Color</span>
                <span className="text-2xl font-black" style={{ color: '#ffffff' }}>{vehicle.color}</span>
              </div>
              <div className="flex flex-col border-b-2 pb-4" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
                <span className="text-base font-semibold uppercase tracking-wider mb-1" style={{ color: '#93c5fd' }}>Carrocería</span>
                <span className="text-2xl font-black" style={{ color: '#ffffff' }}>{vehicle.bodyType}</span>
              </div>
              <div className="flex flex-col border-b-2 pb-4" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
                <span className="text-base font-semibold uppercase tracking-wider mb-1" style={{ color: '#93c5fd' }}>Motor</span>
                <span className="text-2xl font-black" style={{ color: '#ffffff' }}>{vehicle.cylinders ? `${vehicle.cylinders} Cil` : '-'} {vehicle.liters ? `/ ${vehicle.liters} L` : ''}</span>
              </div>
              <div className="flex flex-col border-b-2 pb-4" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
                <span className="text-base font-semibold uppercase tracking-wider mb-1" style={{ color: '#93c5fd' }}>Pasajeros</span>
                <span className="text-2xl font-black" style={{ color: '#ffffff' }}>{vehicle.passengers || '-'}</span>
              </div>
            </div>

            {/* Financing Info (If applicable) */}
            {vehicle.price > 0 && (
              <div className="w-full z-10 mb-8">
                {(() => {
                  const financing = getFinancingInfo(vehicle.year || new Date().getFullYear(), vehicle.price);
                  if (!financing) return null;
                  return (
                    <div className="w-full rounded-[30px] p-6 border grid grid-cols-2 gap-6 shadow-2xl" style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', borderColor: 'rgba(255, 255, 255, 0.1)' }}>
                      <div className="flex flex-col border-r-2" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
                        <span className="text-base font-semibold uppercase tracking-wider mb-2" style={{ color: '#a78bfa' }}>Enganche Min ({financing.downPaymentPct}%)</span>
                        <span className="text-3xl font-black" style={{ color: '#ffffff' }}>${Number(financing.downPaymentAmount).toLocaleString()}</span>
                      </div>
                      <div className="flex flex-col pl-4">
                        <span className="text-base font-semibold uppercase tracking-wider mb-2" style={{ color: '#a78bfa' }}>Plazo Máximo</span>
                        <span className="text-3xl font-black" style={{ color: '#ffffff' }}>{financing.maxTerm} Meses</span>
                        <span className="text-lg font-medium mt-2" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                          Tasa: {financing.minRate} - {financing.maxRate}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Footer / Contact info & QR */}
            <div className="w-full mt-auto flex items-end justify-between z-10">
               <div className="flex-1 pr-6 pb-2">
                 <p className="text-xl font-medium leading-relaxed" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>Contáctanos para más información o agenda tu prueba de manejo hoy mismo.</p>
               </div>
               {((formData.websiteUrl || vehicle.websiteUrl)) && (
                 <div className="flex flex-col items-center bg-white p-3 rounded-2xl shrink-0">
                   <QRCodeSVG value={formData.websiteUrl || vehicle.websiteUrl || ""} size={120} level="M" />
                   <span className="text-sm font-bold text-slate-800 mt-2 tracking-wider">VER ONLINE</span>
                 </div>
               )}
            </div>
            
            {/* Decorative elements */}
            <div className="absolute top-[-200px] right-[-200px] w-[600px] h-[600px] rounded-full blur-[100px] pointer-events-none" style={{ backgroundColor: 'rgba(59, 130, 246, 0.2)' }}></div>
            <div className="absolute bottom-[-200px] left-[-200px] w-[800px] h-[800px] rounded-full blur-[120px] pointer-events-none" style={{ backgroundColor: 'rgba(168, 85, 247, 0.2)' }}></div>
          </div>
        </div>
"""
    lines[start_idx:end_idx+1] = [new_pdf_layout]
    with open(path, "w") as f:
        f.writelines(lines)
    print("Replaced PDF layout!")
else:
    print(f"Could not find start/end lines. start={start_idx}, end={end_idx}")
