import re
import os

files = [
    "src/components/ClientDetailModal.tsx",
    "src/components/PaymentModal.tsx",
    "src/components/ShareVehicleModal.tsx"
]

for p in files:
    with open(p, "r") as f:
        content = f.read()

    if p == "src/components/PaymentModal.tsx":
        old_wrap = """  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="absolute inset-0" onClick={onCancel} />
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800 relative z-10">"""
        
        new_wrap = """  return (
    <div className="fixed inset-0 z-[110] flex items-end md:items-center justify-center p-0 md:p-4">
      <motion.div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} />
      <motion.div 
        className="bg-white dark:bg-slate-900 md:rounded-xl rounded-t-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800 relative z-10"
        initial={{ y: "60vh", scaleX: 0.3, scaleY: 0.05, opacity: 0, borderRadius: "10rem" }}
        animate={{ y: 0, scaleX: 1, scaleY: 1, opacity: 1, borderRadius: "1.5rem" }}
        exit={{ y: "60vh", scaleX: 0.3, scaleY: 0.05, opacity: 0, borderRadius: "10rem", transition: { duration: 0.25, ease: "easeInOut" } }}
        transition={{ type: "spring", damping: 22, stiffness: 280, mass: 0.8 }}
        style={{ transformOrigin: "bottom center" }}
      >"""
        content = content.replace(old_wrap, new_wrap)

    if p == "src/components/ShareVehicleModal.tsx":
        old_wrap = """  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex flex-col md:items-center md:justify-center p-0 md:p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full h-full md:h-auto md:max-h-[85vh] md:max-w-md md:rounded-2xl flex flex-col shadow-2xl relative animate-in slide-in-from-bottom-4 duration-300">"""
        new_wrap = """  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex flex-col justify-end md:items-center md:justify-center p-0 md:p-4">
      <motion.div className="absolute inset-0" onClick={onClose} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} />
      <motion.div 
        className="bg-white dark:bg-slate-900 w-full h-[90dvh] md:h-auto md:max-h-[85vh] md:max-w-md md:rounded-2xl rounded-t-3xl flex flex-col shadow-2xl relative z-10"
        initial={{ y: "60vh", scaleX: 0.3, scaleY: 0.05, opacity: 0, borderRadius: "10rem" }}
        animate={{ y: 0, scaleX: 1, scaleY: 1, opacity: 1, borderRadius: "1.5rem" }}
        exit={{ y: "60vh", scaleX: 0.3, scaleY: 0.05, opacity: 0, borderRadius: "10rem", transition: { duration: 0.25, ease: "easeInOut" } }}
        transition={{ type: "spring", damping: 22, stiffness: 280, mass: 0.8 }}
        style={{ transformOrigin: "bottom center" }}
      >"""
        content = content.replace(old_wrap, new_wrap)
        content = content.replace("        </div>\n      </div>\n    </div>", "        </div>\n      </motion.div>\n    </div>")
        
        # fix line 224 inside ShareVehicleModal if we messed it up
        if "      )}\n    </div>\n  );\n}" in content:
            content = content.replace("      )}\n    </div>\n  );\n}", "      )}\n      </motion.div>\n    </div>\n  );\n}")

    with open(p, "w") as f:
        f.write(content)

