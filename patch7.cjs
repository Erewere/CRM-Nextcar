const fs = require('fs');
let content = fs.readFileSync('src/components/NewActivityModal.tsx', 'utf8');

if (!content.includes('import { motion }')) {
  content = content.replace(
    `import React, { useState, useRef, useEffect } from "react";`,
    `import React, { useState, useRef, useEffect } from "react";\nimport { motion } from "motion/react";`
  );
}

content = content.replace(
  `  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex justify-center items-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden">`,
  `  return (
    <div className="fixed inset-0 z-50 flex justify-center items-end md:items-center p-0 md:p-4">
      {/* Backdrop */}
      <motion.div 
        className="absolute inset-0 bg-black/50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      {/* Modal Content */}
      <motion.div 
        className="bg-white dark:bg-slate-800 md:rounded-lg rounded-t-3xl shadow-2xl w-full max-w-5xl h-[90vh] md:h-[85vh] flex flex-col overflow-hidden relative z-10"
        initial={{ y: "100%", scale: 0.95, opacity: 0, borderRadius: "2rem" }}
        animate={{ y: 0, scale: 1, opacity: 1, borderRadius: "1.5rem" }}
        exit={{ y: "100%", scale: 0.95, opacity: 0, transition: { duration: 0.3 } }}
        transition={{ type: "spring", damping: 25, stiffness: 200, duration: 0.4 }}
      >`
);

fs.writeFileSync('src/components/NewActivityModal.tsx', content);
console.log('Patched NewActivityModal.tsx with framer-motion');
