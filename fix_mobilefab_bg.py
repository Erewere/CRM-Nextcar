import os

path = "src/components/MobileFab.tsx"
with open(path, "r") as f:
    content = f.read()

old_bg = """      {/* Dimmed Background Overlay */}
      {isOpen && (
         <div 
           className="fixed inset-0 bg-slate-900/20 backdrop-blur-[2px] z-40 md:hidden transition-all"
           onClick={() => setIsOpen(false)}
         />
      )}"""

new_bg = """      {/* Dimmed Background Overlay */}
      <AnimatePresence>
        {isOpen && (
           <motion.div 
             className="fixed inset-0 bg-slate-900/20 backdrop-blur-[2px] z-40 md:hidden"
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             exit={{ opacity: 0 }}
             onClick={() => setIsOpen(false)}
           />
        )}
      </AnimatePresence>"""

content = content.replace(old_bg, new_bg)

with open(path, "w") as f:
    f.write(content)

