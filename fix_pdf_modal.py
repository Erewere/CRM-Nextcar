import os

path = "src/components/VehicleDetailModal.tsx"
with open(path, "r") as f:
    content = f.read()

old_logic = """          originalImgNode.removeAttribute('crossOrigin');
          originalImgNode.src = base64Data;
          
          // Wait briefly for DOM to update
          await new Promise(r => setTimeout(r, 100));"""

new_logic = """          originalImgNode.removeAttribute('crossOrigin');
          
          await new Promise((resolve) => {
             originalImgNode.onload = resolve;
             originalImgNode.onerror = resolve;
             originalImgNode.src = base64Data;
          });
          
          // Wait briefly for DOM to update
          await new Promise(r => setTimeout(r, 100));"""

if old_logic in content:
    content = content.replace(old_logic, new_logic)
    print("Replaced logic in Modal")
else:
    print("Logic not found in Modal")

content = content.replace('crossOrigin="anonymous"', '')
content = content.replace("originalImgNode.setAttribute('crossOrigin', 'anonymous');", "")

with open(path, "w") as f:
    f.write(content)
