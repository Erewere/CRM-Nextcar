import os
import re

path = "src/components/VehicleDetailModal.tsx"
with open(path, "r") as f:
    content = f.read()

# Fix transmission
content = content.replace('value={formData.transmission}', "value={formData.transmission || ''}")
# Fix bodyType
content = content.replace('value={formData.bodyType}', "value={formData.bodyType || ''}")

with open(path, "w") as f:
    f.write(content)
print("Fixed selects")
