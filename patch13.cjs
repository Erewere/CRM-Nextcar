const fs = require('fs');
let content = fs.readFileSync('src/components/NewActivityModal.tsx', 'utf8');

content = content.replace(
  `      <motion.div 
        className="bg-white dark:bg-slate-800 md:rounded-lg rounded-t-3xl shadow-2xl w-full max-w-5xl h-[90vh] md:h-[85vh] flex flex-col overflow-hidden relative z-10"
        initial={{ y: "100%", scale: 0.95, opacity: 0, borderRadius: "2rem" }}
        animate={{ y: 0, scale: 1, opacity: 1, borderRadius: "1.5rem" }}
        exit={{ y: "100%", scale: 0.95, opacity: 0, transition: { duration: 0.3 } }}
        transition={{ type: "spring", damping: 25, stiffness: 200, duration: 0.4 }}
      >`,
  `      <motion.div 
        className="bg-white dark:bg-slate-800 md:rounded-lg rounded-t-3xl shadow-2xl w-full max-w-5xl h-[90vh] md:h-[85vh] flex flex-col overflow-hidden relative z-10"
        initial={{ y: "60vh", scaleX: 0.3, scaleY: 0.05, opacity: 0, borderRadius: "10rem" }}
        animate={{ y: 0, scaleX: 1, scaleY: 1, opacity: 1, borderRadius: "1.5rem" }}
        exit={{ y: "60vh", scaleX: 0.3, scaleY: 0.05, opacity: 0, borderRadius: "10rem", transition: { duration: 0.25, ease: "easeInOut" } }}
        transition={{ type: "spring", damping: 22, stiffness: 280, mass: 0.8 }}
        style={{ transformOrigin: "bottom center" }}
      >`
);

fs.writeFileSync('src/components/NewActivityModal.tsx', content);
console.log('Fixed NewActivityModal animation');
