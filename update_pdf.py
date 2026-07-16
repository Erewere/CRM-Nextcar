import os

path = "src/components/VehicleDetailModal.tsx"
with open(path, "r") as f:
    content = f.read()

old_price_tag = """            {/* Price Tag */}
            {vehicle.price > 0 && (
              <div className="w-[900px] rounded-full py-8 px-12 flex items-center justify-between shadow-2xl mb-8 z-10" style={{ background: 'linear-gradient(to right, #2563eb, #3b82f6)' }}>
                <span className="text-4xl font-bold uppercase tracking-widest" style={{ color: 'rgba(255, 255, 255, 0.9)' }}>Precio de Venta</span>
                <span className="text-[80px] font-black leading-none" style={{ color: '#ffffff' }}>${Number(vehicle.price).toLocaleString()}</span>
              </div>
            )}"""

new_price_tag = """            {/* Price Tag & Financing */}
            {vehicle.price > 0 && (
              <div className="w-[900px] flex flex-col gap-6 z-10 mb-8">
                <div className="w-full rounded-full py-8 px-12 flex items-center justify-between shadow-2xl" style={{ background: 'linear-gradient(to right, #2563eb, #3b82f6)' }}>
                  <span className="text-4xl font-bold uppercase tracking-widest" style={{ color: 'rgba(255, 255, 255, 0.9)' }}>Precio de Venta</span>
                  <span className="text-[80px] font-black leading-none" style={{ color: '#ffffff' }}>${Number(vehicle.price).toLocaleString()}</span>
                </div>
                
                {getFinancingInfo(vehicle.year || new Date().getFullYear(), vehicle.price) && (
                  <div className="w-full rounded-[40px] p-8 border grid grid-cols-2 gap-8 shadow-2xl" style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', borderColor: 'rgba(255, 255, 255, 0.1)' }}>
                    <div className="flex flex-col border-r-2" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
                      <span className="text-2xl font-semibold uppercase tracking-wider mb-2" style={{ color: '#a78bfa' }}>Enganche ({getFinancingInfo(vehicle.year || 2020, vehicle.price)?.downPaymentPct}%)</span>
                      <span className="text-5xl font-black" style={{ color: '#ffffff' }}>${Number(getFinancingInfo(vehicle.year || 2020, vehicle.price)?.downPaymentAmount).toLocaleString()}</span>
                    </div>
                    <div className="flex flex-col pl-4">
                      <span className="text-2xl font-semibold uppercase tracking-wider mb-2" style={{ color: '#a78bfa' }}>Plazo Máximo</span>
                      <span className="text-5xl font-black" style={{ color: '#ffffff' }}>{getFinancingInfo(vehicle.year || 2020, vehicle.price)?.maxTerm} Meses</span>
                    </div>
                  </div>
                )}
              </div>
            )}"""

if old_price_tag in content:
    content = content.replace(old_price_tag, new_price_tag)
    with open(path, "w") as f:
        f.write(content)
    print("Replaced price tag block successfully")
else:
    print("Could not find price tag block")

