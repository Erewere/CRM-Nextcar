import os

path = "src/components/VehicleDetailModal.tsx"
with open(path, "r") as f:
    content = f.read()

# Replace html2canvas import
content = content.replace("import html2canvas from 'html2canvas';", "import { toJpeg } from 'html-to-image';")

# Find the handleSharePDF function
import re

old_func = """  const handleSharePDF = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!pdfRef.current || isGeneratingPDF || !vehicle) return;
    setIsGeneratingPDF(true);

    try {
      const canvas = await html2canvas(pdfRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      });
      
      const imgData = canvas.toDataURL('image/jpeg', 0.9);
      
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'px',
        format: [1080, 1920]
      });
      
      pdf.addImage(imgData, 'JPEG', 0, 0, 1080, 1920);
      
      const pdfBlob = pdf.output('blob');"""

new_func = """  const handleSharePDF = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!pdfRef.current || isGeneratingPDF || !vehicle) return;
    setIsGeneratingPDF(true);

    try {
      // Fix for Firebase Storage images CORS in html-to-image
      // If there's an image, fetch it to a data URL first
      let imageSrc = formData.photoUrls?.[0] || formData.photoUrl;
      let originalImgNode = pdfRef.current.querySelector('img');
      let originalSrc = '';
      
      if (imageSrc && originalImgNode) {
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
      }

      const imgData = await toJpeg(pdfRef.current, { 
        quality: 0.9,
        backgroundColor: '#ffffff',
        pixelRatio: 2
      });
      
      if (originalImgNode && originalSrc) {
        // Restore original src
        originalImgNode.src = originalSrc;
      }
      
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'px',
        format: [1080, 1920]
      });
      
      pdf.addImage(imgData, 'JPEG', 0, 0, 1080, 1920);
      
      const pdfBlob = pdf.output('blob');"""

if old_func in content:
    content = content.replace(old_func, new_func)
    print("Replaced func")
else:
    print("Did not find old func")

with open(path, "w") as f:
    f.write(content)
