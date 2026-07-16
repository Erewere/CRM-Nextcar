import os

path = "src/components/NewActivityModal.tsx"
with open(path, "r") as f:
    content = f.read()

# 1. Insert handleSaveClick function
save_logic = """
  const handleSaveClick = () => {
    const existingDeal = deals.find(
      (d) => String(d.title || "").toLowerCase() === dealTitle.toLowerCase()
    );
    onSave({
      title,
      type,
      dueDate: date,
      startTime,
      endTime,
      clientId,
      clientName,
      clientStatus,
      dealId: existingDeal?.id || "",
      dealTitle,
      organization,
      notes,
      completed,
      syncToCalendar,
    });
  };
"""

target_hook = "  useEffect(() => {"
content = content.replace(target_hook, save_logic + "\n" + target_hook, 1)


# 2. Fix Header
old_header = """        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 dark:border-slate-700">
          <h2 className="text-xl font-bold text-gray-800 dark:text-slate-200">
            {initialData?.id ? "Editar actividad" : "Programar actividad"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:text-slate-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>"""

new_header = """        {/* Header */}
        <div className="flex justify-between items-center px-4 md:px-6 py-4 border-b border-gray-200 dark:border-slate-700">
          <button
            onClick={onClose}
            className="text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:text-slate-300 md:hidden"
          >
            Cancelar
          </button>
          
          <h2 className="text-lg md:text-xl font-bold text-gray-800 dark:text-slate-200 text-center flex-1">
            {initialData?.id ? "Editar" : "Programar"}
          </h2>
          
          <button
            onClick={handleSaveClick}
            className="text-blue-600 dark:text-blue-400 font-semibold md:hidden"
          >
            Guardar
          </button>

          <button
            onClick={onClose}
            className="text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:text-slate-300 hidden md:block"
          >
            <X className="w-5 h-5" />
          </button>
        </div>"""

content = content.replace(old_header, new_header)

# 3. Update Footer Save button to use handleSaveClick and hide it on mobile
old_save = """            <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
              <button
                onClick={onClose}
                className="flex-1 sm:flex-none px-4 py-2.5 sm:py-2 border border-gray-300 rounded font-bold text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 text-sm text-center"
              >
                Cancelar
              </button>
              <button
              onClick={() => {
                const existingDeal = deals.find(
                  (d) =>
                    String(d.title || "").toLowerCase() ===
                    dealTitle.toLowerCase(),
                );
                onSave({
                  title,
                  type,
                  dueDate: date,
                  startTime,
                  endTime,
                  clientId,
                  clientName,
                  clientStatus,
                  dealId: existingDeal?.id || "",
                  dealTitle,
                  organization,
                  notes,
                  completed,
                  syncToCalendar,
                });
              }}
              className="flex-1 sm:flex-none px-4 py-2.5 sm:py-2 bg-[#2E914F] hover:bg-[#257A41] text-white rounded font-bold text-sm text-center"
            >
              Guardar
            </button>
            </div>"""

new_save = """            <div className="hidden md:flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
              <button
                onClick={onClose}
                className="flex-1 sm:flex-none px-4 py-2.5 sm:py-2 border border-gray-300 rounded font-bold text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 text-sm text-center"
              >
                Cancelar
              </button>
              <button
              onClick={handleSaveClick}
              className="flex-1 sm:flex-none px-4 py-2.5 sm:py-2 bg-[#2E914F] hover:bg-[#257A41] text-white rounded font-bold text-sm text-center"
            >
              Guardar
            </button>
            </div>"""

content = content.replace(old_save, new_save)

with open(path, "w") as f:
    f.write(content)

