import os
import re

path = "src/components/VehicleDetailModal.tsx"
with open(path, "r") as f:
    content = f.read()

# Fix make
content = content.replace('value={formData.make}', "value={formData.make || ''}")
# Fix model
content = content.replace('value={formData.model}', "value={formData.model || ''}")
# Fix year
content = content.replace('value={formData.year}', "value={formData.year || ''}")
# Fix color
content = content.replace('value={formData.color}', "value={formData.color || ''}")
# Fix vin
content = content.replace('value={formData.vin}', "value={formData.vin || ''}")
# Fix km
content = content.replace('value={formData.km}', "value={formData.km || ''}")
# Fix cylinders
content = content.replace('value={formData.cylinders}', "value={formData.cylinders || ''}")
# Fix liters
content = content.replace('value={formData.liters}', "value={formData.liters || ''}")


with open(path, "w") as f:
    f.write(content)
print("Fixed inputs")
