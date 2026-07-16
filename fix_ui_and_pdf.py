import os

path = "src/components/VehicleDetailModal.tsx"
with open(path, "r") as f:
    content = f.read()

# Fix the UI layout
old_ui_layout = """                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Fotos del Vehículo</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-2">
                    {/* Render existing photos */}
                    {(formData.photoUrls || (formData.photoUrl ? [formData.photoUrl] : [])).map((url, idx) => (
                      <div key={idx} className="aspect-square relative rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 group">
                        <img src={url} alt={`Vehicle ${idx + 1}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removePhoto(idx)}
                          className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    
                    {/* Add new photo button */}
                    <label className="aspect-square flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                      {uploading ? (
                        <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-600 mb-1"></div>
                      ) : (
                        <Plus className="w-6 h-6 text-slate-400 mb-1" />
                      )}
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        {uploading ? '...' : 'Añadir'}
                      </span>
                      <input type="file" accept="image/*" multiple className="hidden" onChange={handleFileUpload} disabled={uploading} />
                    </label>
                  </div>
                </div>"""

new_ui_layout = """                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Fotos del Vehículo</label>
                  
                  {/* Primary Photo */}
                  {(() => {
                    const allPhotos = formData.photoUrls || (formData.photoUrl ? [formData.photoUrl] : []);
                    if (allPhotos.length > 0) {
                      return (
                        <div className="relative w-full h-56 md:h-64 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 mb-3 group">
                          <img src={allPhotos[0]} alt="Principal" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removePhoto(0)}
                            className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white p-1.5 rounded-full opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-4 h-4" />
                          </button>
                          <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm text-white text-xs font-bold px-2 py-1 rounded-md">
                            FOTO PRINCIPAL
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-2">
                    {/* Render additional photos */}
                    {(formData.photoUrls || (formData.photoUrl ? [formData.photoUrl] : [])).slice(1).map((url, idx) => (
                      <div key={idx + 1} className="aspect-square relative rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 group">
                        <img src={url} alt={`Vehicle ${idx + 2}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removePhoto(idx + 1)}
                          className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white p-1 rounded-full opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    
                    {/* Add new photo button */}
                    <label className="aspect-square flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                      {uploading ? (
                        <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-600 mb-1"></div>
                      ) : (
                        <Plus className="w-6 h-6 text-slate-400 mb-1" />
                      )}
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        {uploading ? '...' : 'Añadir'}
                      </span>
                      <input type="file" accept="image/*" multiple className="hidden" onChange={handleFileUpload} disabled={uploading} />
                    </label>
                  </div>
                </div>"""

# Replace the UI layout
if old_ui_layout in content:
    content = content.replace(old_ui_layout, new_ui_layout)
    print("UI Layout replaced!")
else:
    print("Could not find old_ui_layout")

# Fix the PDF layout w-[800px] mobile issue
old_pdf_container = '<div className="fixed top-[-9999px] left-[-9999px] pointer-events-none">'
new_pdf_container = '<div className="fixed top-[-9999px] left-[-9999px] pointer-events-none w-[800px] max-w-none">'

if old_pdf_container in content:
    content = content.replace(old_pdf_container, new_pdf_container)
    print("PDF Container fixed!")
else:
    print("Could not find old_pdf_container")


with open(path, "w") as f:
    f.write(content)
