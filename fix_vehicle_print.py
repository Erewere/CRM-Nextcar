import os

path = "src/pages/VehiclePrint.tsx"
with open(path, "r") as f:
    content = f.read()

content = content.replace("vehicle.photoUrls?.[0] || vehicle.photoUrl ? (", "(vehicle.photoUrls?.[0] || vehicle.photoUrl) && (")

with open(path, "w") as f:
    f.write(content)
