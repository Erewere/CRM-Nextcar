import os

path = "src/components/VehicleDetailModal.tsx"
with open(path, "r") as f:
    content = f.read()

import re

# Add getFinancingInfo function inside VehicleDetailModal
insert_before = "  const handleSharePDF = async (e: React.MouseEvent) => {"

financing_func = """  const getFinancingInfo = (year: number, price: number) => {
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
  };

"""

if "const getFinancingInfo =" not in content:
    content = content.replace(insert_before, financing_func + insert_before)
    with open(path, "w") as f:
        f.write(content)
    print("Added getFinancingInfo")
else:
    print("getFinancingInfo already exists")

