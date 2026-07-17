import os

path = "src/pages/Integrations.tsx"
with open(path, "r") as f:
    content = f.read()

# I want to add a section for Virtual Assistants after the WhatsApp Cloud API section.
# The card ends with `        </div>\n      </div>\n    </div>`

new_section = """
        {/* Virtual Assistants API */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden mt-8">
          <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-600 dark:text-purple-500"><path d="M12 2v20"></path><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">API para Asistentes Virtuales</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Endpoints públicos para consultar inventario y capturar leads desde tu bot de IA.</p>
              </div>
            </div>
          </div>
          <div className="p-6">
             <div className="mb-4">
               <span className="font-semibold text-sm text-slate-800 dark:text-slate-200">ID de Agencia: </span>
               <code className="bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded text-sm text-purple-600">{userData?.agencyId || '...'}</code>
             </div>
             
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
               <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 bg-slate-50 dark:bg-slate-900/50">
                 <div className="flex items-center gap-2 mb-3">
                   <span className="bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded text-xs uppercase">GET</span>
                   <span className="font-mono text-sm font-semibold">/api/public/v1/inventory</span>
                 </div>
                 <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">Obtiene la lista de vehículos disponibles.</p>
                 <div className="bg-slate-800 text-slate-300 p-3 rounded-lg text-xs font-mono overflow-x-auto">
                   curl {window.location.origin}/api/public/v1/inventory?agencyId={userData?.agencyId}
                 </div>
               </div>

               <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 bg-slate-50 dark:bg-slate-900/50">
                 <div className="flex items-center gap-2 mb-3">
                   <span className="bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded text-xs uppercase">POST</span>
                   <span className="font-mono text-sm font-semibold">/api/public/v1/leads</span>
                 </div>
                 <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">Crea un nuevo prospecto (Lead) en el CRM.</p>
                 <div className="bg-slate-800 text-slate-300 p-3 rounded-lg text-xs font-mono overflow-x-auto">
                   {`curl -X POST ${window.location.origin}/api/public/v1/leads \\
  -H "Content-Type: application/json" \\
  -d '{"agencyId": "${userData?.agencyId}", "name": "Juan Perez", "phone": "5551234567"}'`}
                 </div>
               </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}"""

content = content.replace("      </div>\n    </div>\n  );\n}", new_section)
with open(path, "w") as f:
    f.write(content)

print("Updated Integrations.tsx")
