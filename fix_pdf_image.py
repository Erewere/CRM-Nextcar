import os

path = "src/components/VehicleDetailModal.tsx"
with open(path, "r") as f:
    content = f.read()

old_logic = """      if (imageSrc && originalImgNode) {
        try {
          originalSrc = originalImgNode.src;
          // Use our local proxy to avoid CORS issues
          const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(imageSrc)}`;
          originalImgNode.src = proxyUrl;
          // Wait for the image to load from the proxy
          await new Promise((resolve, reject) => {
             const img = new Image();
             img.onload = resolve;
             img.onerror = reject;
             img.src = proxyUrl;
          });
        } catch (err) {
          console.warn("Failed to load proxied image for PDF", err);
          originalImgNode.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
        }
      }

      const imgData = await toJpeg(pdfRef.current, { 
        quality: 0.9,
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        cacheBust: true
      });

      if (originalImgNode && originalSrc) {
        // Restore original src
        originalImgNode.src = originalSrc;
      }"""

new_logic = """      if (imageSrc && originalImgNode) {
        try {
          originalSrc = originalImgNode.src;
          // Fetch through proxy as a blob, then convert to base64
          // to completely avoid canvas CORS tainting inside html-to-image
          const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(imageSrc)}`;
          const res = await fetch(proxyUrl);
          const blob = await res.blob();
          
          const base64Data = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          
          originalImgNode.removeAttribute('crossOrigin');
          originalImgNode.src = base64Data;
          
          // Wait briefly for DOM to update
          await new Promise(r => setTimeout(r, 100));
        } catch (err) {
          console.warn("Failed to load proxied image for PDF", err);
          originalImgNode.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
        }
      }

      const imgData = await toJpeg(pdfRef.current, { 
        quality: 0.9,
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        cacheBust: true,
        useCORS: true,
      });

      if (originalImgNode && originalSrc) {
        // Restore original src
        originalImgNode.setAttribute('crossOrigin', 'anonymous');
        originalImgNode.src = originalSrc;
      }"""

if old_logic in content:
    content = content.replace(old_logic, new_logic)
    print("Successfully replaced logic in VehicleDetailModal.tsx")
else:
    print("Could not find old logic in VehicleDetailModal.tsx")

with open(path, "w") as f:
    f.write(content)
