import os

path = "src/components/VehicleDetailModal.tsx"
with open(path, "r") as f:
    content = f.read()

target_block = """                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Kilometraje (Km)</label>
                    <input type="number" inputMode="numeric" pattern="[0-9]*" required value={formData.km} onChange={e=>setFormData({...formData, km: Number(e.target.value)})} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200" />
                  </div>
                </div>"""

new_block = """                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Kilometraje (Km)</label>
                    <input type="number" inputMode="numeric" pattern="[0-9]*" required value={formData.km} onChange={e=>setFormData({...formData, km: Number(e.target.value)})} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200" />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Link de Página Web (Opcional)</label>
                  <input type="url" placeholder="https://..." value={formData.websiteUrl || ''} onChange={e=>setFormData({...formData, websiteUrl: e.target.value})} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200" />
                </div>"""

if target_block in content:
    content = content.replace(target_block, new_block)
    with open(path, "w") as f:
        f.write(content)
    print("Added Link de Página Web")
else:
    print("Could not find block to insert website link")
