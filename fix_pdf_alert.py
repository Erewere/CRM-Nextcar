import os

path = "src/components/VehicleDetailModal.tsx"
with open(path, "r") as f:
    content = f.read()

content = content.replace(
    "console.error('Error sharing PDF:', error);\n      alert('Hubo un error al generar el archivo PDF. Por favor intenta de nuevo.');",
    "console.error('Error sharing PDF:', error);\n      alert('Error PDF: ' + (error.message || error));"
)

with open(path, "w") as f:
    f.write(content)
