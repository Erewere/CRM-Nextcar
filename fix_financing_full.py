import os
import re

path = "src/components/VehicleDetailModal.tsx"
with open(path, "r") as f:
    content = f.read()

# 1. Update the function
old_func = """  const getFinancingInfo = (year: number, price: number) => {
    const plans: Record<number, { maxTerm: number, minDownPayment: number }> = {
      2014: { maxTerm: 12, minDownPayment: 0.5 },
      2015: { maxTerm: 18, minDownPayment: 0.5 },
      2016: { maxTerm: 60, minDownPayment: 0.2 },
      2017: { maxTerm: 60, minDownPayment: 0.2 },
      2018: { maxTerm: 60, minDownPayment: 0.2 },
      2019: { maxTerm: 60, minDownPayment: 0.2 },
      2020: { maxTerm: 60, minDownPayment: 0.2 },
      2021: { maxTerm: 60, minDownPayment: 0.2 },
      2022: { maxTerm: 72, minDownPayment: 0.2 },
      2023: { maxTerm: 84, minDownPayment: 0.2 },
      2024: { maxTerm: 96, minDownPayment: 0.2 },
      2025: { maxTerm: 120, minDownPayment: 0.2 },
      2026: { maxTerm: 120, minDownPayment: 0.2 },
    };
    
    // Find closest year if not exact match (or return null if too old)
    if (year < 2014) return null;
    let planYear = year;
    if (year > 2026) planYear = 2026;
    
    const plan = plans[planYear];
    if (!plan) return null;
    
    return {
      downPaymentPct: plan.minDownPayment * 100,
      downPaymentAmount: price * plan.minDownPayment,
      maxTerm: plan.maxTerm
    };
  };"""

new_func = """  const getFinancingInfo = (year: number, price: number) => {
    const plans: Record<number, { maxTerm: number, minDownPayment: number, minRate: string, maxRate: string }> = {
      2014: { maxTerm: 12, minDownPayment: 0.5, minRate: "30.00%", maxRate: "30.00%" },
      2015: { maxTerm: 18, minDownPayment: 0.5, minRate: "30.00%", maxRate: "30.00%" },
      2016: { maxTerm: 60, minDownPayment: 0.2, minRate: "30.00%", maxRate: "30.00%" },
      2017: { maxTerm: 60, minDownPayment: 0.2, minRate: "14.99%", maxRate: "15.99%" },
      2018: { maxTerm: 60, minDownPayment: 0.2, minRate: "14.99%", maxRate: "15.99%" },
      2019: { maxTerm: 60, minDownPayment: 0.2, minRate: "13.99%", maxRate: "14.99%" },
      2020: { maxTerm: 60, minDownPayment: 0.2, minRate: "13.99%", maxRate: "15.99%" },
      2021: { maxTerm: 60, minDownPayment: 0.2, minRate: "13.99%", maxRate: "14.99%" },
      2022: { maxTerm: 72, minDownPayment: 0.2, minRate: "13.99%", maxRate: "15.24%" },
      2023: { maxTerm: 84, minDownPayment: 0.2, minRate: "13.99%", maxRate: "15.24%" },
      2024: { maxTerm: 96, minDownPayment: 0.2, minRate: "13.99%", maxRate: "15.74%" },
      2025: { maxTerm: 120, minDownPayment: 0.2, minRate: "13.99%", maxRate: "15.99%" },
      2026: { maxTerm: 120, minDownPayment: 0.2, minRate: "13.99%", maxRate: "16.24%" },
    };
    
    if (year < 2014) return null;
    let planYear = year;
    if (year > 2026) planYear = 2026;
    
    const plan = plans[planYear];
    if (!plan) return null;
    
    return {
      downPaymentPct: plan.minDownPayment * 100,
      downPaymentAmount: price * plan.minDownPayment,
      maxTerm: plan.maxTerm,
      minRate: plan.minRate,
      maxRate: plan.maxRate
    };
  };"""

content = content.replace(old_func, new_func)

old_ui = """                {getFinancingInfo(vehicle.year || new Date().getFullYear(), vehicle.price) && (
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
                )}"""

new_ui = """                {(() => {
                  const financing = getFinancingInfo(vehicle.year || new Date().getFullYear(), vehicle.price);
                  if (!financing) return null;
                  return (
                    <div className="w-full rounded-[40px] p-8 border grid grid-cols-2 gap-8 shadow-2xl" style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', borderColor: 'rgba(255, 255, 255, 0.1)' }}>
                      <div className="flex flex-col border-r-2" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
                        <span className="text-2xl font-semibold uppercase tracking-wider mb-2" style={{ color: '#a78bfa' }}>Enganche Min ({financing.downPaymentPct}%)</span>
                        <span className="text-5xl font-black" style={{ color: '#ffffff' }}>${Number(financing.downPaymentAmount).toLocaleString()}</span>
                      </div>
                      <div className="flex flex-col pl-4">
                        <span className="text-2xl font-semibold uppercase tracking-wider mb-2" style={{ color: '#a78bfa' }}>Plazo Máximo</span>
                        <span className="text-5xl font-black" style={{ color: '#ffffff' }}>{financing.maxTerm} Meses</span>
                        <span className="text-lg font-medium mt-2" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                          Tasa: {financing.minRate} - {financing.maxRate}
                        </span>
                      </div>
                    </div>
                  );
                })()}"""

content = content.replace(old_ui, new_ui)

with open(path, "w") as f:
    f.write(content)

