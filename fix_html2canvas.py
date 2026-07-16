import os

path = "src/components/VehicleDetailModal.tsx"
with open(path, "r") as f:
    content = f.read()

content = content.replace("import { toJpeg } from 'html-to-image';", "import html2canvas from 'html2canvas';")

old_jpeg = """      const imgData = await toJpeg(pdfRef.current, { 
        quality: 0.9,
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        cacheBust: true,
      });"""

new_jpeg = """      const canvas = await html2canvas(pdfRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      });
      const imgData = canvas.toDataURL('image/jpeg', 0.9);"""

if old_jpeg in content:
    content = content.replace(old_jpeg, new_jpeg)
    print("Replaced toJpeg with html2canvas in VehicleDetailModal")
else:
    print("Failed to replace toJpeg")

with open(path, "w") as f:
    f.write(content)
