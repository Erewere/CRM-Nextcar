import os
import re

files_to_patch = [
    "src/components/UserSettingsModal.tsx",
    "src/components/PipelineSettingsModal.tsx",
    "src/components/PaymentModal.tsx",
    "src/components/ChangePasswordModal.tsx",
    "src/components/ShareVehicleModal.tsx"
]

for path in files_to_patch:
    with open(path, "r") as f:
        content = f.read()

    if 'import { motion }' not in content:
        content = content.replace('import React, ', 'import { motion } from "motion/react";\nimport React, ')

    # Find the outermost <div className="fixed inset-0...
    # It might be followed by a backdrop or directly containing the modal box.
    # Usually it looks like:
    # <div className="fixed inset-0 ...">
    #   <div className="absolute inset-0 ... onClick=..." />
    #   <div className="bg-white ...">
    
    # We will use regex to find the modal box and replace it with <motion.div>
    # The modal box typically has `bg-white dark:bg-slate-800` or similar
    
    # Let's just do a simpler string replacement for each known file, it's safer.
    
    if "UserSettingsModal" in path:
        old_wrapper = """  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div 
        className="absolute inset-0"
        onClick={onClose}
      />
      <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden relative z-10 animate-in zoom-in-95 duration-200">"""
        
        new_wrapper = """  return (
    <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 md:p-4">
      <motion.div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div 
        className="bg-white dark:bg-slate-800 w-full max-w-md md:rounded-2xl rounded-t-3xl shadow-2xl overflow-hidden relative z-10"
        initial={{ y: "60vh", scaleX: 0.3, scaleY: 0.05, opacity: 0, borderRadius: "10rem" }}
        animate={{ y: 0, scaleX: 1, scaleY: 1, opacity: 1, borderRadius: "1.5rem" }}
        exit={{ y: "60vh", scaleX: 0.3, scaleY: 0.05, opacity: 0, borderRadius: "10rem", transition: { duration: 0.25, ease: "easeInOut" } }}
        transition={{ type: "spring", damping: 22, stiffness: 280, mass: 0.8 }}
        style={{ transformOrigin: "bottom center" }}
      >"""
        
        content = content.replace(old_wrapper, new_wrapper)
        content = content.replace('        </div>\n      </div>\n    </div>', '        </div>\n      </motion.div>\n    </div>')
        
    elif "PipelineSettingsModal" in path:
        old_wrapper = """  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] relative z-10">"""
      
        new_wrapper = """  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4 z-50">
      <motion.div className="absolute inset-0" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
      <motion.div 
        className="bg-white dark:bg-slate-800 md:rounded-xl rounded-t-3xl shadow-xl w-full max-w-md overflow-hidden flex flex-col h-[90dvh] md:max-h-[90vh] relative z-10"
        initial={{ y: "60vh", scaleX: 0.3, scaleY: 0.05, opacity: 0, borderRadius: "10rem" }}
        animate={{ y: 0, scaleX: 1, scaleY: 1, opacity: 1, borderRadius: "1.5rem" }}
        exit={{ y: "60vh", scaleX: 0.3, scaleY: 0.05, opacity: 0, borderRadius: "10rem", transition: { duration: 0.25, ease: "easeInOut" } }}
        transition={{ type: "spring", damping: 22, stiffness: 280, mass: 0.8 }}
        style={{ transformOrigin: "bottom center" }}
      >"""
        content = content.replace(old_wrapper, new_wrapper)
        content = content.replace('        </div>\n      </div>\n    </div>', '        </div>\n      </motion.div>\n    </div>')

    elif "PaymentModal" in path:
        old_wrapper = """  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div 
        className="absolute inset-0"
        onClick={onClose}
      />
      <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden relative z-10 animate-in zoom-in-95 duration-200">"""
        
        new_wrapper = """  return (
    <div className="fixed inset-0 z-[110] flex items-end md:items-center justify-center p-0 md:p-4">
      <motion.div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div 
        className="bg-white dark:bg-slate-800 w-full max-w-md md:rounded-2xl rounded-t-3xl shadow-2xl overflow-hidden relative z-10"
        initial={{ y: "60vh", scaleX: 0.3, scaleY: 0.05, opacity: 0, borderRadius: "10rem" }}
        animate={{ y: 0, scaleX: 1, scaleY: 1, opacity: 1, borderRadius: "1.5rem" }}
        exit={{ y: "60vh", scaleX: 0.3, scaleY: 0.05, opacity: 0, borderRadius: "10rem", transition: { duration: 0.25, ease: "easeInOut" } }}
        transition={{ type: "spring", damping: 22, stiffness: 280, mass: 0.8 }}
        style={{ transformOrigin: "bottom center" }}
      >"""
        content = content.replace(old_wrapper, new_wrapper)
        content = content.replace('        </div>\n      </div>\n    </div>', '        </div>\n      </motion.div>\n    </div>')

    elif "ChangePasswordModal" in path:
        old_wrapper = """  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md overflow-hidden relative animate-in fade-in zoom-in-95 duration-200">"""
        new_wrapper = """  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-0 md:p-4">
      <motion.div className="absolute inset-0" onClick={onClose} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} />
      <motion.div 
        className="bg-white dark:bg-slate-800 md:rounded-xl rounded-t-3xl shadow-xl w-full max-w-md overflow-hidden relative z-10"
        initial={{ y: "60vh", scaleX: 0.3, scaleY: 0.05, opacity: 0, borderRadius: "10rem" }}
        animate={{ y: 0, scaleX: 1, scaleY: 1, opacity: 1, borderRadius: "1.5rem" }}
        exit={{ y: "60vh", scaleX: 0.3, scaleY: 0.05, opacity: 0, borderRadius: "10rem", transition: { duration: 0.25, ease: "easeInOut" } }}
        transition={{ type: "spring", damping: 22, stiffness: 280, mass: 0.8 }}
        style={{ transformOrigin: "bottom center" }}
      >"""
        content = content.replace(old_wrapper, new_wrapper)
        content = content.replace('        </div>\n      </div>\n    </div>', '        </div>\n      </motion.div>\n    </div>')

    elif "ShareVehicleModal" in path:
        old_wrapper = """  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex flex-col md:items-center md:justify-center p-0 md:p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full h-full md:h-auto md:max-h-[85vh] md:max-w-md md:rounded-2xl flex flex-col shadow-2xl relative animate-in slide-in-from-bottom-4 duration-300">"""
        new_wrapper = """  return (
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
        content = content.replace(old_wrapper, new_wrapper)
        content = content.replace('        </div>\n      </div>\n    </div>', '        </div>\n      </motion.div>\n    </div>')

    with open(path, "w") as f:
        f.write(content)

print("Patched more modals!")
