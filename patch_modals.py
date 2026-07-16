import os
import re

def patch_client_detail_modal():
    path = "src/components/ClientDetailModal.tsx"
    with open(path, "r") as f:
        content = f.read()

    # Apply motion.div to wrapper
    old_wrapper = """  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-2 sm:p-4">
      <div className="bg-white dark:bg-slate-800 w-full max-w-6xl h-[95vh] rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* TOP HEADER */}"""
    
    new_wrapper = """  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="bg-white dark:bg-slate-800 w-full max-w-6xl md:rounded-xl rounded-t-3xl shadow-2xl flex flex-col overflow-hidden h-[95dvh] relative z-10"
        initial={{ y: "60vh", scaleX: 0.3, scaleY: 0.05, opacity: 0, borderRadius: "10rem" }}
        animate={{ y: 0, scaleX: 1, scaleY: 1, opacity: 1, borderRadius: "1.5rem" }}
        exit={{ y: "60vh", scaleX: 0.3, scaleY: 0.05, opacity: 0, borderRadius: "10rem", transition: { duration: 0.25, ease: "easeInOut" } }}
        transition={{ type: "spring", damping: 22, stiffness: 280, mass: 0.8 }}
        style={{ transformOrigin: "bottom center" }}
      >
        {/* TOP HEADER */}"""
    
    content = content.replace(old_wrapper, new_wrapper)
    
    # Close motion.div
    old_end = """              </div>
            </div>
          </div>
        </div>
      </div>
      {showDealWonModal"""
    
    new_end = """              </div>
            </div>
          </div>
        </div>
      </motion.div>
      {showDealWonModal"""
      
    content = content.replace(old_end, new_end)

    # Change type of phone to tel
    content = content.replace('name="phone"\n                      autoComplete="off"\n                      placeholder="Teléfono"', 'name="phone"\n                      type="tel"\n                      inputMode="tel"\n                      autoComplete="off"\n                      placeholder="Teléfono"')
    
    # Change email input type (if exists)
    content = content.replace('name="email"\n                      placeholder="Correo Electrónico"', 'name="email"\n                      type="email"\n                      inputMode="email"\n                      placeholder="Correo Electrónico"')
    
    # For Passengers
    content = content.replace('type="number"\n                    placeholder="5"', 'type="number"\n                    inputMode="numeric"\n                    pattern="[0-9]*"\n                    placeholder="5"')

    # For Budget
    content = content.replace('type="number"\n                    placeholder="$300,000"', 'type="number"\n                    inputMode="numeric"\n                    pattern="[0-9]*"\n                    placeholder="$300,000"')

    # For Year
    content = content.replace('type="number"\n                    placeholder="2015"', 'type="number"\n                    inputMode="numeric"\n                    pattern="[0-9]*"\n                    placeholder="2015"')
    
    content = content.replace('type="number"\n                    placeholder="2024"', 'type="number"\n                    inputMode="numeric"\n                    pattern="[0-9]*"\n                    placeholder="2024"')

    with open(path, "w") as f:
        f.write(content)


def patch_vehicle_detail_modal():
    path = "src/components/VehicleDetailModal.tsx"
    with open(path, "r") as f:
        content = f.read()

    if 'import { motion } from "motion/react";' not in content:
        content = content.replace('import React, { useState, useEffect } from "react";', 'import { motion } from "motion/react";\nimport React, { useState, useEffect } from "react";')

    old_wrapper = """  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex justify-center items-center p-2 sm:p-4">
      <div className="bg-white dark:bg-slate-800 w-full max-w-5xl h-[95vh] rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">"""

    new_wrapper = """  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
      <motion.div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="bg-white dark:bg-slate-800 w-full max-w-5xl md:rounded-xl rounded-t-3xl shadow-2xl flex flex-col overflow-hidden h-[95dvh] relative z-10"
        initial={{ y: "60vh", scaleX: 0.3, scaleY: 0.05, opacity: 0, borderRadius: "10rem" }}
        animate={{ y: 0, scaleX: 1, scaleY: 1, opacity: 1, borderRadius: "1.5rem" }}
        exit={{ y: "60vh", scaleX: 0.3, scaleY: 0.05, opacity: 0, borderRadius: "10rem", transition: { duration: 0.25, ease: "easeInOut" } }}
        transition={{ type: "spring", damping: 22, stiffness: 280, mass: 0.8 }}
        style={{ transformOrigin: "bottom center" }}
      >"""

    content = content.replace(old_wrapper, new_wrapper)
    
    old_end = """              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}"""

    new_end = """              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}"""
    content = content.replace(old_end, new_end)

    # Convert type="number" to also have inputMode="numeric"
    content = content.replace('type="number"', 'type="number" inputMode="numeric" pattern="[0-9]*"')

    with open(path, "w") as f:
        f.write(content)

def patch_deal_won_modal():
    path = "src/components/DealWonModal.tsx"
    with open(path, "r") as f:
        content = f.read()

    if 'import { motion } from "motion/react";' not in content:
        content = content.replace('import React, { useState } from "react";', 'import { motion } from "motion/react";\nimport React, { useState } from "react";')

    old_wrapper = """  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={onCancel}
      />
      
      {/* Modal Content */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden relative z-10 animate-in fade-in zoom-in-95 duration-200">"""
      
    new_wrapper = """  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center p-0 md:p-4">
      {/* Backdrop */}
      <motion.div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onCancel}
      />
      
      {/* Modal Content */}
      <motion.div 
        className="bg-white dark:bg-slate-800 w-full max-w-md md:rounded-xl rounded-t-3xl shadow-2xl overflow-hidden relative z-10"
        initial={{ y: "60vh", scaleX: 0.3, scaleY: 0.05, opacity: 0, borderRadius: "10rem" }}
        animate={{ y: 0, scaleX: 1, scaleY: 1, opacity: 1, borderRadius: "1.5rem" }}
        exit={{ y: "60vh", scaleX: 0.3, scaleY: 0.05, opacity: 0, borderRadius: "10rem", transition: { duration: 0.25, ease: "easeInOut" } }}
        transition={{ type: "spring", damping: 22, stiffness: 280, mass: 0.8 }}
        style={{ transformOrigin: "bottom center" }}
      >"""

    content = content.replace(old_wrapper, new_wrapper)
    content = content.replace('        </div>\n      </div>\n    </div>', '        </div>\n      </motion.div>\n    </div>')

    content = content.replace('type="number"', 'type="number" inputMode="numeric" pattern="[0-9]*"')

    with open(path, "w") as f:
        f.write(content)

patch_client_detail_modal()
patch_vehicle_detail_modal()
patch_deal_won_modal()

print("Patched Modals!")
