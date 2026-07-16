import os

path = "src/components/VehicleDetailModal.tsx"
with open(path, "r") as f:
    content = f.read()

# Import Share2
if "Printer" in content and "Share2" not in content:
    content = content.replace("Printer } from 'lucide-react'", "Printer, Share2 } from 'lucide-react'")

# Add imports for html2canvas and jspdf
imports = """import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
"""
content = content.replace("import React,", imports + "import React,")

# Add state and ref
state_insert = """  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const pdfRef = React.useRef<HTMLDivElement>(null);

  const handleSharePDF = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!pdfRef.current || isGeneratingPDF || !vehicle) return;
    setIsGeneratingPDF(true);

    try {
      const canvas = await html2canvas(pdfRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      });
      
      const imgData = canvas.toDataURL('image/jpeg', 0.9);
      
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'px',
        format: [canvas.width, canvas.height]
      });
      
      pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height);
      const pdfBlob = pdf.output('blob');
      
      const file = new File([pdfBlob], `${vehicle.make || 'Vehiculo'}_${vehicle.model || ''}.pdf`, { type: 'application/pdf' });
      
      if (navigator.share) {
        await navigator.share({
          title: `Ficha Técnica - ${vehicle.make || ''} ${vehicle.model || ''}`,
          text: `Revisa este increíble ${vehicle.make || ''} ${vehicle.model || ''} ${vehicle.year || ''}!`,
          files: [file]
        });
      } else {
        pdf.save(`${vehicle.make || 'Vehiculo'}_${vehicle.model || ''}.pdf`);
      }
    } catch (error) {
      console.error('Error sharing PDF:', error);
      alert('Hubo un error al generar el archivo PDF. Por favor intenta de nuevo.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };"""

if "const pdfRef" not in content:
    content = content.replace("  const [activeTab, setActiveTab]", state_insert + "\n  const [activeTab, setActiveTab]")

# Replace Print button
old_print_btn = """            {!isNew && (
              <a 
                href={`/print/vehicle/${vehicle.id}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-slate-600 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 rounded-lg transition-colors mr-2"
                title="Imprimir Ficha Técnica"
              >
                <Printer className="w-4 h-4" />
                <span className="hidden sm:inline">Imprimir Ficha</span>
              </a>
            )}"""

new_print_btn = """            {!isNew && (
              <button 
                onClick={handleSharePDF}
                disabled={isGeneratingPDF}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors mr-2"
                title="Compartir Ficha en PDF"
              >
                <Share2 className="w-4 h-4" />
                <span className="hidden sm:inline">{isGeneratingPDF ? 'Generando...' : 'Compartir PDF'}</span>
                <span className="sm:hidden">{isGeneratingPDF ? '...' : 'PDF'}</span>
              </button>
            )}"""

content = content.replace(old_print_btn, new_print_btn)

# Add hidden pdf view at the end of the modal, but before the final closing div.
# It should be absolutely positioned and off-screen so html2canvas can still capture it.
hidden_pdf_view = """
        {/* Hidden PDF View */}
        <div className="overflow-hidden h-0 w-0 absolute opacity-0 pointer-events-none">
          <div ref={pdfRef} className="w-[1080px] h-[1920px] bg-gradient-to-br from-slate-900 to-slate-800 flex flex-col items-center justify-between p-12 text-white font-sans relative">
            
            {/* Header section with brand/agency name if available */}
            <div className="w-full flex justify-between items-center mb-8">
               <div className="text-3xl font-black tracking-widest text-white/50">FICHA TÉCNICA</div>
               <div className="text-3xl font-bold bg-white/10 px-6 py-2 rounded-full text-blue-400">
                 {userData?.role === 'master' ? 'AUTO DEALER' : 'NUESTRO INVENTARIO'}
               </div>
            </div>

            {/* Vehicle Title & Info */}
            <div className="w-full text-center mt-4 mb-10">
              <h1 className="text-[100px] font-black uppercase leading-none tracking-tight text-white mb-2" style={{ textShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
                {vehicle.make}
              </h1>
              <h2 className="text-[60px] font-bold text-blue-400 tracking-wide">
                {vehicle.model} <span className="text-white/30">|</span> <span className="text-white">{vehicle.year}</span>
              </h2>
            </div>

            {/* Large Vehicle Image */}
            <div className="w-[900px] h-[700px] rounded-[40px] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] border-[8px] border-white/10 relative bg-slate-800 flex items-center justify-center mb-10">
              {(formData.photoUrls?.[0] || formData.photoUrl) ? (
                <img 
                  src={formData.photoUrls?.[0] || formData.photoUrl} 
                  alt={`${vehicle.make} ${vehicle.model}`}
                  className="w-full h-full object-cover"
                  crossOrigin="anonymous"
                />
              ) : (
                <div className="text-slate-500 text-4xl font-medium flex flex-col items-center">
                  <span>Sin Imagen</span>
                </div>
              )}
              {vehicle.status === 'sold' && (
                <div className="absolute inset-0 bg-red-600/80 flex items-center justify-center backdrop-blur-sm">
                  <span className="text-white font-black text-8xl rotate-[-15deg] uppercase tracking-widest border-8 border-white p-6 rounded-3xl">VENDIDO</span>
                </div>
              )}
            </div>

            {/* Vehicle Specifications Grid */}
            <div className="w-[900px] bg-white/5 backdrop-blur-md rounded-[40px] p-10 border border-white/10 grid grid-cols-2 gap-x-12 gap-y-8 mb-10">
              <div className="flex flex-col border-b-2 border-white/10 pb-4">
                <span className="text-2xl font-semibold text-blue-300 uppercase tracking-wider mb-1">Kilometraje</span>
                <span className="text-4xl font-black text-white">{Number(vehicle.km || 0).toLocaleString()} km</span>
              </div>
              <div className="flex flex-col border-b-2 border-white/10 pb-4">
                <span className="text-2xl font-semibold text-blue-300 uppercase tracking-wider mb-1">Transmisión</span>
                <span className="text-4xl font-black text-white">{vehicle.transmission}</span>
              </div>
              <div className="flex flex-col border-b-2 border-white/10 pb-4">
                <span className="text-2xl font-semibold text-blue-300 uppercase tracking-wider mb-1">Color</span>
                <span className="text-4xl font-black text-white">{vehicle.color}</span>
              </div>
              <div className="flex flex-col border-b-2 border-white/10 pb-4">
                <span className="text-2xl font-semibold text-blue-300 uppercase tracking-wider mb-1">Carrocería</span>
                <span className="text-4xl font-black text-white">{vehicle.bodyType}</span>
              </div>
              <div className="flex flex-col border-b-2 border-white/10 pb-4">
                <span className="text-2xl font-semibold text-blue-300 uppercase tracking-wider mb-1">Motor</span>
                <span className="text-4xl font-black text-white">{vehicle.cylinders ? `${vehicle.cylinders} Cil` : '-'} {vehicle.liters ? `/ ${vehicle.liters} L` : ''}</span>
              </div>
              <div className="flex flex-col border-b-2 border-white/10 pb-4">
                <span className="text-2xl font-semibold text-blue-300 uppercase tracking-wider mb-1">Pasajeros</span>
                <span className="text-4xl font-black text-white">{vehicle.passengers || '-'}</span>
              </div>
            </div>

            {/* Price Tag */}
            {vehicle.price > 0 && (
              <div className="w-[900px] bg-gradient-to-r from-blue-600 to-blue-500 rounded-full py-8 px-12 flex items-center justify-between shadow-2xl mb-8">
                <span className="text-4xl font-bold text-white/90 uppercase tracking-widest">Precio de Venta</span>
                <span className="text-[80px] font-black text-white leading-none">${Number(vehicle.price).toLocaleString()}</span>
              </div>
            )}
            
            {/* Footer / Contact info */}
            <div className="w-full text-center mt-auto pb-4">
               <p className="text-2xl text-white/50 font-medium">Contáctanos para más información o agenda tu prueba de manejo hoy mismo.</p>
            </div>
            
            {/* Decorative elements */}
            <div className="absolute top-[-200px] right-[-200px] w-[600px] h-[600px] bg-blue-500/20 rounded-full blur-[100px] pointer-events-none"></div>
            <div className="absolute bottom-[-200px] left-[-200px] w-[800px] h-[800px] bg-purple-500/20 rounded-full blur-[120px] pointer-events-none"></div>
          </div>
        </div>
      </motion.div>
"""

content = content.replace("      </motion.div>", hidden_pdf_view)

with open(path, "w") as f:
    f.write(content)

