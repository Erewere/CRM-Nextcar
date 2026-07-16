import os

path = "src/components/VehicleDetailModal.tsx"
with open(path, "r") as f:
    content = f.read()

import_mobile = "import { useIsMobile } from '../hooks/useIsMobile';\n"
if "useIsMobile" not in content:
    content = content.replace("import { deduplicateClients }", import_mobile + "import { deduplicateClients }")

if "const isMobile = useIsMobile();" not in content:
    content = content.replace("  const isNew = !vehicle.id;", "  const isNew = !vehicle.id;\n  const isMobile = useIsMobile();")

old_btns = """            {!isNew && (
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

new_btns = """            {!isNew && isMobile && (
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
            )}
            {!isNew && !isMobile && (
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

content = content.replace(old_btns, new_btns)

with open(path, "w") as f:
    f.write(content)
