import os

path = "src/components/VehicleDetailModal.tsx"
with open(path, "r") as f:
    content = f.read()

old_block = """      const imgData = await toJpeg(pdfRef.current, { 
        quality: 0.9,
        backgroundColor: '#ffffff',
        pixelRatio: 2
      });"""

new_block = """      const imgData = await toJpeg(pdfRef.current, { 
        quality: 0.9,
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        cacheBust: true
      });"""

if old_block in content:
    content = content.replace(old_block, new_block)
    with open(path, "w") as f:
        f.write(content)
    print("Replaced toJpeg with cacheBust successfully")
else:
    print("Could not find toJpeg block")

