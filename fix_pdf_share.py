import os
import re

path = "src/components/VehicleDetailModal.tsx"
with open(path, "r") as f:
    content = f.read()

# Update handleSharePDF to open in new tab instead of save, if not using navigator.share
old_share = """      if (navigator.share) {
        await navigator.share({
          title: `Ficha Técnica - ${vehicle.make || ''} ${vehicle.model || ''}`,
          text: `Revisa este increíble ${vehicle.make || ''} ${vehicle.model || ''} ${vehicle.year || ''}!`,
          files: [file]
        });
      } else {
        pdf.save(`${vehicle.make || 'Vehiculo'}_${vehicle.model || ''}.pdf`);
      }"""

new_share = """      // Check if navigator.share is available and supports files
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            title: `Ficha Técnica - ${vehicle.make || ''} ${vehicle.model || ''}`,
            text: `Revisa este increíble ${vehicle.make || ''} ${vehicle.model || ''} ${vehicle.year || ''}!`,
            files: [file]
          });
        } catch (shareErr) {
          // If share fails (e.g. user canceled), just fallback to open/save
          const pdfUrl = URL.createObjectURL(pdfBlob);
          window.open(pdfUrl, '_blank');
        }
      } else {
        const pdfUrl = URL.createObjectURL(pdfBlob);
        window.open(pdfUrl, '_blank');
      }"""

content = content.replace(old_share, new_share)

# Remove the old "Imprimir Ficha" button and replace with PDF button for all devices
old_print_btn = """            {!isNew && !isMobile && (
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

# Replace isMobile condition for share button
old_share_btn = """            {!isNew && isMobile && (
              <button 
                onClick={handleSharePDF}
                disabled={isGeneratingPDF}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors mr-2 shadow-sm"
                title="Compartir Ficha en PDF"
              >
                <Share2 className="w-4 h-4" />
                <span className="hidden sm:inline">{isGeneratingPDF ? 'Generando...' : 'Compartir PDF'}</span>
                <span className="sm:hidden">{isGeneratingPDF ? '...' : 'PDF'}</span>
              </button>
            )}"""

new_share_btn = """            {!isNew && (
              <button 
                onClick={handleSharePDF}
                disabled={isGeneratingPDF}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors mr-2 shadow-sm"
                title="Generar Ficha en PDF"
              >
                <Share2 className="w-4 h-4" />
                <span className="hidden sm:inline">{isGeneratingPDF ? 'Generando...' : 'Ficha PDF'}</span>
                <span className="sm:hidden">{isGeneratingPDF ? '...' : 'PDF'}</span>
              </button>
            )}"""

content = content.replace(old_print_btn, "")
content = content.replace(old_share_btn, new_share_btn)

with open(path, "w") as f:
    f.write(content)
