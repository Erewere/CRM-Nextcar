import os
import re

path = "src/components/VehicleDetailModal.tsx"
with open(path, "r") as f:
    content = f.read()

# Add import
if "QRCodeSVG" not in content:
    content = content.replace("import { jsPDF } from 'jspdf';", "import { jsPDF } from 'jspdf';\nimport { QRCodeSVG } from 'qrcode.react';")

# Add websiteUrl to form data initialization
if "websiteUrl: ''," not in content:
    content = content.replace("price: 0, purchasePrice: 0, vin: '',", "price: 0, purchasePrice: 0, vin: '', websiteUrl: '',")

# Add input for websiteUrl in the form
# We will insert it after the VIN input
vin_input_block = """                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">VIN / Serie</label>
                    <input 
                      type="text" required
                      value={formData.vin || ''}
                      onChange={e => setFormData({...formData, vin: e.target.value.toUpperCase()})}
                      readOnly={userData?.role === 'seller' && !isNew}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-700 dark:text-slate-300 uppercase ${userData?.role === 'seller' && !isNew ? 'bg-slate-100 dark:bg-slate-700 cursor-not-allowed' : 'bg-white dark:bg-slate-800'}`}
                    />
                  </div>"""

website_input_block = """                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Link de Página Web (Opcional)</label>
                    <input 
                      type="url"
                      placeholder="https://..."
                      value={formData.websiteUrl || ''}
                      onChange={e => setFormData({...formData, websiteUrl: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>"""

if "Link de Página Web" not in content:
    content = content.replace(vin_input_block, vin_input_block + "\n" + website_input_block)


# Add QR Code rendering in the PDF footer
old_pdf_footer = """            {/* Footer / Contact info */}
            <div className="w-full text-center mt-auto pb-4 z-10">
               <p className="text-xl font-medium" style={{ color: 'rgba(255, 255, 255, 0.5)' }}>Contáctanos para más información o agenda tu prueba de manejo hoy mismo.</p>
            </div>"""

new_pdf_footer = """            {/* Footer / Contact info & QR */}
            <div className="w-full mt-auto flex items-end justify-between z-10">
               <div className="flex-1 pr-6 pb-2">
                 <p className="text-xl font-medium" style={{ color: 'rgba(255, 255, 255, 0.5)' }}>Contáctanos para más información o agenda tu prueba de manejo hoy mismo.</p>
               </div>
               {vehicle.websiteUrl && (
                 <div className="flex flex-col items-center bg-white p-3 rounded-2xl shrink-0">
                   <QRCodeSVG value={vehicle.websiteUrl} size={100} level="M" />
                   <span className="text-xs font-bold text-slate-800 mt-2 tracking-wider">VER ONLINE</span>
                 </div>
               )}
            </div>"""

if "QRCodeSVG value" not in content:
    content = content.replace(old_pdf_footer, new_pdf_footer)

with open(path, "w") as f:
    f.write(content)
