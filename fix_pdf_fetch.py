import os

path = "src/components/VehicleDetailModal.tsx"
with open(path, "r") as f:
    content = f.read()

import re

old_block = """      if (imageSrc && originalImgNode) {
        try {
          originalSrc = originalImgNode.src;
          const res = await fetch(imageSrc);
          const blob = await res.blob();
          const dataUrl = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
          });
          originalImgNode.src = dataUrl as string;
        } catch (err) {
          console.warn("Failed to fetch image as blob for PDF", err);
        }
      }"""

new_block = """      if (imageSrc && originalImgNode) {
        try {
          originalSrc = originalImgNode.src;
          // Bypass cache to prevent CORS issues if the image was cached without CORS headers
          const res = await fetch(imageSrc, { cache: 'no-cache' });
          if (!res.ok) throw new Error("Fetch failed with status: " + res.status);
          const blob = await res.blob();
          const dataUrl = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
          });
          originalImgNode.src = dataUrl as string;
        } catch (err) {
          console.warn("Failed to fetch image as blob for PDF", err);
          // Fallback to a transparent pixel so html-to-image doesn't crash trying to load the original URL
          originalImgNode.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
        }
      }"""

if old_block in content:
    content = content.replace(old_block, new_block)
    with open(path, "w") as f:
        f.write(content)
    print("Replaced fetch block successfully")
else:
    print("Could not find fetch block")
