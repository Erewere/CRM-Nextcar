import os

path = "src/pages/mobile/MobileInventory.tsx"
with open(path, "r") as f:
    content = f.read()

content = content.replace("vehicle.photos && vehicle.photos.length > 0", "vehicle.photoUrls?.[0] || vehicle.photoUrl")
content = content.replace("src={vehicle.photos[0]}", "src={vehicle.photoUrls?.[0] || vehicle.photoUrl || ''}")

with open(path, "w") as f:
    f.write(content)
print("Fixed MobileInventory.tsx")
