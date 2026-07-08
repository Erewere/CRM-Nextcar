const fs = require('fs');
const content = fs.readFileSync('src/pages/Inventory.tsx', 'utf8');

const modal = `
      {showImportExcel && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 flex justify-between items-center border-b border-gray-200 dark:border-slate-700">
              <h2 className="text-xl font-bold text-gray-800 dark:text-slate-200">
                Importar Inventario de Excel
              </h2>
              <button
                type="button"
                onClick={() => {
                  setShowImportExcel(false);
                  setExcelData([]);
                }}
                className="text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:text-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4 text-sm">
              <p className="text-slate-600 dark:text-slate-400">
                Mapea las columnas de tu archivo Excel con los campos del vehículo. 
                Se importarán <strong>{excelData.length}</strong> filas.
              </p>

              {['make', 'model', 'year', 'price', 'purchasePrice', 'vin', 'color', 'transmission', 'bodyType', 'km'].map((field) => (
                <div key={field} className="flex flex-col gap-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300 capitalize">
                    {field === 'make' ? 'Marca (Requerido)' : field === 'model' ? 'Modelo (Requerido)' : field === 'year' ? 'Año' : field === 'price' ? 'Precio de Venta' : field === 'purchasePrice' ? 'Costo / Precio de Compra' : field === 'vin' ? 'VIN / Serie' : field === 'color' ? 'Color' : field === 'transmission' ? 'Transmisión' : field === 'bodyType' ? 'Carrocería' : 'Kilometraje'}
                  </label>
                  <select
                    value={columnMapping[field] || ''}
                    onChange={(e) => setColumnMapping({ ...columnMapping, [field]: e.target.value })}
                    className="border border-slate-300 dark:border-slate-600 rounded p-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                  >
                    <option value="">-- Ignorar este campo --</option>
                    {excelColumns.map((col) => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div className="px-6 py-4 bg-gray-50 dark:bg-slate-900 flex justify-end gap-3 border-t border-gray-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => {
                  setShowImportExcel(false);
                  setExcelData([]);
                }}
                className="px-4 py-2 text-gray-700 dark:text-slate-300 font-medium hover:bg-gray-200 dark:hover:bg-slate-700 rounded"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={importingVehicles}
                onClick={handleImportExcelData}
                className="px-4 py-2 bg-blue-600 text-white font-medium rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {importingVehicles ? "Importando..." : "Importar Datos"}
              </button>
            </div>
          </div>
        </div>
      )}
`;

const lines = content.split('\\n');
const insertIndex = lines.findIndex(l => l.includes('</form>')) + 2; // Assuming end of component
const realInsertIndex = lines.lastIndexOf('    </div>');

lines.splice(realInsertIndex, 0, modal);

fs.writeFileSync('src/pages/Inventory.tsx', lines.join('\\n'));
