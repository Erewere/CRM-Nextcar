import os

path = "src/components/VehicleDetailModal.tsx"
with open(path, "r") as f:
    content = f.read()

bad = """<div className="overflow-hidden h-0 w-0 absolute opacity-0 pointer-events-none">"""
good = """<div className="fixed top-[-9999px] left-[-9999px] pointer-events-none">"""
content = content.replace(bad, good)

with open(path, "w") as f:
    f.write(content)
