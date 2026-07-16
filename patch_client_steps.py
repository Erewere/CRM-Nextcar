import re

path = "src/components/ClientDetailModal.tsx"
with open(path, "r") as f:
    content = f.read()

# 1. Add step state
if "const [currentStep, setCurrentStep] = useState(1);" not in content:
    content = content.replace("const [existingPersons, setExistingPersons]", "const [currentStep, setCurrentStep] = useState(1);\n  const [existingPersons, setExistingPersons]")

# Wrapper for Vehículo section
content = content.replace(
    '<div className="space-y-1">\n                  <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">\n                    Valor / Vehículo',
    '<div className={`space-y-1 ${isNew && currentStep !== 2 ? "hidden md:block" : ""}`}>\n                  <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">\n                    Valor / Vehículo'
)

# Wrapper for Persona section
content = content.replace(
    '<div className="pt-2 border-t border-gray-100 dark:border-slate-700 space-y-1">\n                  <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">\n                    Persona',
    '<div className={`pt-2 border-t border-gray-100 dark:border-slate-700 space-y-1 ${isNew && currentStep !== 1 ? "hidden md:block" : ""}`}>\n                  <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">\n                    Persona'
)

# Wrapper for Origen section
content = content.replace(
    '<div className="pt-2 border-t border-gray-100 dark:border-slate-700 space-y-1">\n                  <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">\n                    Origen',
    '<div className={`pt-2 border-t border-gray-100 dark:border-slate-700 space-y-1 ${isNew && currentStep !== 2 ? "hidden md:block" : ""}`}>\n                  <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">\n                    Origen'
)

# For Etiqueta & Status - we can keep them in step 2 or 1, let's put them in step 2.
content = content.replace(
    '<div className="pt-2 border-t border-gray-100 dark:border-slate-700">\n                  <div className="flex gap-2 mb-2">\n                    <div className="flex-1">',
    '<div className={`pt-2 border-t border-gray-100 dark:border-slate-700 ${isNew && currentStep !== 2 ? "hidden md:block" : ""}`}>\n                  <div className="flex gap-2 mb-2">\n                    <div className="flex-1">'
)

# Add Step Navigation for Mobile
step_nav = """
                {isNew && (
                  <div className="md:hidden flex flex-col gap-2 pt-4">
                    {currentStep === 1 ? (
                      <button
                        type="button"
                        onClick={() => setCurrentStep(2)}
                        className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg shadow-md active:scale-95 transition-all text-center"
                      >
                        Continuar
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setCurrentStep(1)}
                          className="w-1/3 bg-gray-200 text-gray-800 font-bold py-3 rounded-lg active:scale-95 transition-all text-center"
                        >
                          Atrás
                        </button>
                        <button
                          type="submit"
                          className="flex-1 bg-emerald-600 text-white font-bold py-3 rounded-lg shadow-md active:scale-95 transition-all text-center"
                        >
                          Guardar Prospecto
                        </button>
                      </div>
                    )}
                  </div>
                )}
"""

content = content.replace('</form>\n            </div>\n          </div>', step_nav + '\n              </form>\n            </div>\n          </div>')

# Hide right sidebar on mobile if isNew
content = content.replace(
    '<div className="flex-1 md:overflow-y-auto p-4 md:p-6 space-y-6">',
    '<div className={`flex-1 md:overflow-y-auto p-4 md:p-6 space-y-6 ${isNew ? "hidden md:block" : ""}`}>'
)

# If it's desktop and isNew, the original save button should still work.
# Wait, the original Save button is at the bottom of the right panel, or is it in the header?
# There is a save button somewhere in ClientDetailModal. Let's check where it is.

with open(path, "w") as f:
    f.write(content)

print("Applied ClientDetailModal steps!")
