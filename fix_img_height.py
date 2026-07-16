import os

path = "src/components/VehicleDetailModal.tsx"
with open(path, "r") as f:
    content = f.read()

content = content.replace(
    'className="w-[900px] h-[700px] rounded-[40px]',
    'className="w-[900px] h-[600px] rounded-[40px]'
)

with open(path, "w") as f:
    f.write(content)
