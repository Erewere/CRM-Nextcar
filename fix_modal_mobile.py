import os

path = "src/components/NewActivityModal.tsx"
with open(path, "r") as f:
    content = f.read()

# Fix modal container
old_container = 'className="bg-white dark:bg-slate-800 md:rounded-lg rounded-t-3xl shadow-2xl w-full max-w-5xl h-[90dvh] md:h-[85vh] flex flex-col overflow-hidden relative z-10"'
new_container = 'className="bg-white dark:bg-slate-800 md:rounded-lg shadow-2xl w-full max-w-5xl h-[100dvh] md:h-[85vh] flex flex-col overflow-hidden relative z-10"'
content = content.replace(old_container, new_container)

# Fix backdrop
old_backdrop = 'className="fixed inset-0 z-50 flex justify-center items-end md:items-center p-0 md:p-4"'
new_backdrop = 'className="fixed inset-0 z-50 flex justify-center items-end md:items-center p-0 md:p-4 bg-white md:bg-transparent"'
# Wait, if we use bg-white on backdrop on mobile, it covers everything. But the backdrop is actually the next div.
# Let's just fix the footer pb-safe

old_footer = 'className="px-4 md:px-6 py-4 border-t border-gray-200 dark:border-slate-700 flex flex-col md:flex-row justify-between items-stretch md:items-center bg-gray-50 dark:bg-slate-900 gap-4 mt-auto shrink-0"'
new_footer = 'className="px-4 md:px-6 py-4 pb-safe md:pb-4 border-t border-gray-200 dark:border-slate-700 flex flex-col md:flex-row justify-between items-stretch md:items-center bg-gray-50 dark:bg-slate-900 gap-4 mt-auto shrink-0"'
content = content.replace(old_footer, new_footer)

with open(path, "w") as f:
    f.write(content)
