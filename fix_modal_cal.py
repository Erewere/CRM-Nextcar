import os

path = "src/components/NewActivityModal.tsx"
with open(path, "r") as f:
    content = f.read()

old_cal = '<div className="w-full md:w-1/3 bg-white dark:bg-slate-800 border-t md:border-t-0 md:border-l border-gray-200 dark:border-slate-700 flex flex-col min-h-[400px]">'
new_cal = '<div className="hidden md:flex w-full md:w-1/3 bg-white dark:bg-slate-800 border-t md:border-t-0 md:border-l border-gray-200 dark:border-slate-700 flex-col min-h-[400px]">'

content = content.replace(old_cal, new_cal)

with open(path, "w") as f:
    f.write(content)
