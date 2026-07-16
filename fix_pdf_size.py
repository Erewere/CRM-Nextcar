import os
import re

path = "src/components/VehicleDetailModal.tsx"
with open(path, "r") as f:
    content = f.read()

# Update jsPDF initialization
old_pdf_init = """      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'px',
        format: [1080, 1920]
      });
      
      pdf.addImage(imgData, 'JPEG', 0, 0, 1080, 1920);"""

new_pdf_init = """      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'px',
        format: [800, 1131]
      });
      
      pdf.addImage(imgData, 'JPEG', 0, 0, 800, 1131);"""

content = content.replace(old_pdf_init, new_pdf_init)

# Update hidden div dimensions and styling to fit 800x1131
# Old layout container:
old_container = """<div ref={pdfRef} className="w-[1080px] h-[1920px] flex flex-col items-center justify-between p-12 font-sans relative" style={{ background: 'linear-gradient(to bottom right, #0f172a, #1e293b)', color: '#ffffff' }}>"""
new_container = """<div ref={pdfRef} className="w-[800px] h-[1131px] flex flex-col items-center justify-between p-8 font-sans relative" style={{ background: 'linear-gradient(to bottom right, #0f172a, #1e293b)', color: '#ffffff' }}>"""
content = content.replace(old_container, new_container)

# We will need to scale down some font sizes and margins to fit the smaller container.
content = content.replace('className="w-[900px] h-[600px] rounded-[40px]', 'className="w-[700px] h-[450px] rounded-[30px]')
content = content.replace('className="w-[900px] flex flex-col gap-6 z-10 mb-8"', 'className="w-[700px] flex flex-col gap-4 z-10 mb-4"')
content = content.replace('className="w-full rounded-full py-8 px-12', 'className="w-full rounded-full py-4 px-8')
content = content.replace('className="w-full rounded-[40px] p-8 border grid grid-cols-2 gap-8 shadow-2xl"', 'className="w-full rounded-[30px] p-6 border grid grid-cols-2 gap-6 shadow-2xl"')
content = content.replace('className="w-[900px] backdrop-blur-md rounded-[40px] p-10 border grid grid-cols-2 gap-x-12 gap-y-8 mb-10 z-10"', 'className="w-[700px] backdrop-blur-md rounded-[30px] p-6 border grid grid-cols-2 gap-x-8 gap-y-4 mb-4 z-10"')

# Replace title sizing
content = content.replace('text-[100px] font-black', 'text-[70px] font-black')
content = content.replace('text-[60px] font-bold', 'text-[45px] font-bold')
content = content.replace('text-8xl', 'text-6xl')
content = content.replace('text-[80px]', 'text-[50px]')
content = content.replace('text-5xl', 'text-4xl')
content = content.replace('text-4xl font-bold uppercase', 'text-2xl font-bold uppercase')
content = content.replace('text-4xl font-black', 'text-3xl font-black')
content = content.replace('text-2xl font-semibold uppercase', 'text-lg font-semibold uppercase')
content = content.replace('text-2xl font-medium', 'text-xl font-medium')
content = content.replace('mb-10 z-10', 'mb-4 z-10')
content = content.replace('mb-8 z-10', 'mb-4 z-10')

with open(path, "w") as f:
    f.write(content)
