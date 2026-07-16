import os

path = "src/components/DealWonModal.tsx"
with open(path, "r") as f:
    content = f.read()

old_wrapper = """  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="absolute inset-0" onClick={onCancel} />
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800 relative z-10">"""

new_wrapper = """  return (
    <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 md:p-4">
      <motion.div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} />
      <motion.div 
        className="bg-white dark:bg-slate-900 md:rounded-xl rounded-t-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800 relative z-10"
        initial={{ y: "60vh", scaleX: 0.3, scaleY: 0.05, opacity: 0, borderRadius: "10rem" }}
        animate={{ y: 0, scaleX: 1, scaleY: 1, opacity: 1, borderRadius: "1.5rem" }}
        exit={{ y: "60vh", scaleX: 0.3, scaleY: 0.05, opacity: 0, borderRadius: "10rem", transition: { duration: 0.25, ease: "easeInOut" } }}
        transition={{ type: "spring", damping: 22, stiffness: 280, mass: 0.8 }}
        style={{ transformOrigin: "bottom center" }}
      >"""

content = content.replace(old_wrapper, new_wrapper)
with open(path, "w") as f:
    f.write(content)

