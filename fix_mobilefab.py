import os

path = "src/components/MobileFab.tsx"
with open(path, "r") as f:
    content = f.read()

# Add imports
if "import { motion" not in content:
    content = content.replace("import React,", 'import { motion, AnimatePresence } from "motion/react";\nimport React,')

# Replace the isOpen && div with AnimatePresence
old_menu = """      <div className="fixed bottom-[85px] right-4 z-50 md:hidden flex flex-col items-center gap-3">
        {isOpen && (
           <div className="flex flex-col items-center gap-3 mb-2 animate-in slide-in-from-bottom-5 fade-in duration-200">"""

new_menu = """      <div className="fixed bottom-[85px] right-4 z-50 md:hidden flex flex-col items-center gap-3">
        <AnimatePresence>
          {isOpen && (
             <motion.div 
               className="flex flex-col items-center gap-3 mb-2"
               initial={{ y: 60, scale: 0.1, opacity: 0 }}
               animate={{ y: 0, scale: 1, opacity: 1 }}
               exit={{ y: 60, scale: 0.1, opacity: 0, transition: { duration: 0.2 } }}
               transition={{ type: "spring", damping: 18, stiffness: 300, mass: 0.8 }}
               style={{ transformOrigin: "bottom center" }}
             >"""

content = content.replace(old_menu, new_menu)

# Replace the end of the menu div
old_menu_end = """              </button>
           </div>
        )}
        <button"""

new_menu_end = """              </button>
             </motion.div>
          )}
        </AnimatePresence>
        <button"""

content = content.replace(old_menu_end, new_menu_end)

with open(path, "w") as f:
    f.write(content)

