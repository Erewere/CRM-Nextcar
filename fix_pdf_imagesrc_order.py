import os
import re

path = "src/components/VehicleDetailModal.tsx"
with open(path, "r") as f:
    content = f.read()

old_image_src = "const imageSrc = vehicle?.photoUrls?.[0] || vehicle?.photoUrl || formData.photoUrls?.[0] || formData.photoUrl;"
new_image_src = "const imageSrc = formData.photoUrls?.[0] || formData.photoUrl || vehicle?.photoUrls?.[0] || vehicle?.photoUrl;"

content = content.replace(old_image_src, new_image_src)

old_pdf_img_cond = "{(vehicle?.photoUrls?.[0] || vehicle?.photoUrl || formData.photoUrls?.[0] || formData.photoUrl) ? ("
new_pdf_img_cond = "{(formData.photoUrls?.[0] || formData.photoUrl || vehicle?.photoUrls?.[0] || vehicle?.photoUrl) ? ("

content = content.replace(old_pdf_img_cond, new_pdf_img_cond)

old_pdf_img_src = "src={vehicle?.photoUrls?.[0] || vehicle?.photoUrl || formData.photoUrls?.[0] || formData.photoUrl}"
new_pdf_img_src = "src={formData.photoUrls?.[0] || formData.photoUrl || vehicle?.photoUrls?.[0] || vehicle?.photoUrl}"

content = content.replace(old_pdf_img_src, new_pdf_img_src)

with open(path, "w") as f:
    f.write(content)
