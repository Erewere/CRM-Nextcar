import os
import re

path = "src/components/VehicleDetailModal.tsx"
with open(path, "r") as f:
    content = f.read()

# Replace the first object-contain with object-cover
content = content.replace('className="w-full h-full object-contain"', 'className="w-full h-full object-cover"', 1)

with open(path, "w") as f:
    f.write(content)
