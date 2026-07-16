import os
import re

path = "src/components/VehicleDetailModal.tsx"
with open(path, "r") as f:
    content = f.read()

# Change image size and fit
old_img_container = 'className="w-[700px] h-[450px] rounded-[30px] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] border-[8px] relative flex items-center justify-center mb-4 z-10"'
new_img_container = 'className="w-[700px] h-[380px] rounded-[30px] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] border-[8px] relative flex items-center justify-center mb-4 z-10"'

old_img_tag = 'className="w-full h-full object-cover"'
new_img_tag = 'className="w-full h-full object-contain"'

content = content.replace(old_img_container, new_img_container)
content = content.replace(old_img_tag, new_img_tag)

with open(path, "w") as f:
    f.write(content)
print("Fixed PDF image")
