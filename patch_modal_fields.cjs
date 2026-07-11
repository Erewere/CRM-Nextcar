const fs = require('fs');

let code = fs.readFileSync('src/components/ClientDetailModal.tsx', 'utf8');

const target = `<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Marca</label>
                  <input
                    type="text"
                    placeholder="Ej. Toyota, Honda..."
                    value={formData.wantedVehicle?.make || ""}
                    onChange={(e) => setFormData(p => ({ ...p, wantedVehicle: { ...p.wantedVehicle, make: e.target.value } }))}
                    className="w-full text-sm border-gray-300 dark:border-slate-600 dark:bg-slate-700 bg-white rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Modelo / Versión</label>
                  <input
                    type="text"
                    placeholder="Ej. Civic, CR-V EX..."
                    value={formData.wantedVehicle?.model || ""}
                    onChange={(e) => setFormData(p => ({ ...p, wantedVehicle: { ...p.wantedVehicle, model: e.target.value } }))}
                    className="w-full text-sm border-gray-300 dark:border-slate-600 dark:bg-slate-700 bg-white rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Año Mínimo</label>
                  <input
                    type="number"
                    placeholder="2015"
                    value={formData.wantedVehicle?.yearMin || ""}
                    onChange={(e) => setFormData(p => ({ ...p, wantedVehicle: { ...p.wantedVehicle, yearMin: e.target.value ? parseInt(e.target.value) : undefined } }))}
                    className="w-full text-sm border-gray-300 dark:border-slate-600 dark:bg-slate-700 bg-white rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Año Máximo</label>
                  <input
                    type="number"
                    placeholder="2024"
                    value={formData.wantedVehicle?.yearMax || ""}
                    onChange={(e) => setFormData(p => ({ ...p, wantedVehicle: { ...p.wantedVehicle, yearMax: e.target.value ? parseInt(e.target.value) : undefined } }))}
                    className="w-full text-sm border-gray-300 dark:border-slate-600 dark:bg-slate-700 bg-white rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Presupuesto Máximo</label>
                  <input
                    type="number"
                    placeholder="$300,000"
                    value={formData.wantedVehicle?.priceMax || ""}
                    onChange={(e) => setFormData(p => ({ ...p, wantedVehicle: { ...p.wantedVehicle, priceMax: e.target.value ? parseInt(e.target.value) : undefined } }))}
                    className="w-full text-sm border-gray-300 dark:border-slate-600 dark:bg-slate-700 bg-white rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Pasajeros</label>
                  <input
                    type="number"
                    placeholder="5"
                    value={formData.wantedVehicle?.passengers || ""}
                    onChange={(e) => setFormData(p => ({ ...p, wantedVehicle: { ...p.wantedVehicle, passengers: e.target.value ? parseInt(e.target.value) : undefined } }))}
                    className="w-full text-sm border-gray-300 dark:border-slate-600 dark:bg-slate-700 bg-white rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tipo de Carrocería</label>
                  <select
                    value={formData.wantedVehicle?.bodyType || ""}
                    onChange={(e) => setFormData(p => ({ ...p, wantedVehicle: { ...p.wantedVehicle, bodyType: e.target.value } }))}
                    className="w-full text-sm border-gray-300 dark:border-slate-600 dark:bg-slate-700 bg-white rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="">Cualquiera</option>
                    <option value="SUV">SUV</option>
                    <option value="Sedan">Sedán</option>
                    <option value="Hatchback">Hatchback</option>
                    <option value="Pickup">Pickup</option>
                    <option value="Coupe">Coupé</option>
                    <option value="Minivan">Minivan</option>
                  </select>
                </div>
              </div>`;

const replacement = `<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tipo de Carrocería</label>
                  <select
                    value={formData.wantedVehicle?.bodyType || ""}
                    onChange={(e) => setFormData(p => ({ ...p, wantedVehicle: { ...p.wantedVehicle, bodyType: e.target.value } }))}
                    className="w-full text-sm border-gray-300 dark:border-slate-600 dark:bg-slate-700 bg-white rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="">Cualquiera</option>
                    <option value="SUV">SUV</option>
                    <option value="Sedan">Sedán</option>
                    <option value="Hatchback">Hatchback</option>
                    <option value="Pickup">Pickup</option>
                    <option value="Coupe">Coupé</option>
                    <option value="Minivan">Minivan</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Pasajeros</label>
                  <input
                    type="number"
                    placeholder="5"
                    value={formData.wantedVehicle?.passengers || ""}
                    onChange={(e) => setFormData(p => ({ ...p, wantedVehicle: { ...p.wantedVehicle, passengers: e.target.value ? parseInt(e.target.value) : undefined } }))}
                    className="w-full text-sm border-gray-300 dark:border-slate-600 dark:bg-slate-700 bg-white rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Presupuesto Máximo</label>
                  <input
                    type="number"
                    placeholder="$300,000"
                    value={formData.wantedVehicle?.priceMax || ""}
                    onChange={(e) => setFormData(p => ({ ...p, wantedVehicle: { ...p.wantedVehicle, priceMax: e.target.value ? parseInt(e.target.value) : undefined } }))}
                    className="w-full text-sm border-gray-300 dark:border-slate-600 dark:bg-slate-700 bg-white rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Marca</label>
                  <input
                    type="text"
                    placeholder="Ej. Toyota, Honda..."
                    value={formData.wantedVehicle?.make || ""}
                    onChange={(e) => setFormData(p => ({ ...p, wantedVehicle: { ...p.wantedVehicle, make: e.target.value } }))}
                    className="w-full text-sm border-gray-300 dark:border-slate-600 dark:bg-slate-700 bg-white rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Modelo / Versión</label>
                  <input
                    type="text"
                    placeholder="Ej. Civic, CR-V EX..."
                    value={formData.wantedVehicle?.model || ""}
                    onChange={(e) => setFormData(p => ({ ...p, wantedVehicle: { ...p.wantedVehicle, model: e.target.value } }))}
                    className="w-full text-sm border-gray-300 dark:border-slate-600 dark:bg-slate-700 bg-white rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Año Mínimo</label>
                  <input
                    type="number"
                    placeholder="2015"
                    value={formData.wantedVehicle?.yearMin || ""}
                    onChange={(e) => setFormData(p => ({ ...p, wantedVehicle: { ...p.wantedVehicle, yearMin: e.target.value ? parseInt(e.target.value) : undefined } }))}
                    className="w-full text-sm border-gray-300 dark:border-slate-600 dark:bg-slate-700 bg-white rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Año Máximo</label>
                  <input
                    type="number"
                    placeholder="2024"
                    value={formData.wantedVehicle?.yearMax || ""}
                    onChange={(e) => setFormData(p => ({ ...p, wantedVehicle: { ...p.wantedVehicle, yearMax: e.target.value ? parseInt(e.target.value) : undefined } }))}
                    className="w-full text-sm border-gray-300 dark:border-slate-600 dark:bg-slate-700 bg-white rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>`;

if (code.includes(target)) {
    code = code.replace(target, replacement);
    fs.writeFileSync('src/components/ClientDetailModal.tsx', code);
    console.log("Patched successfully");
} else {
    console.error("Target string not found in ClientDetailModal.tsx");
}
