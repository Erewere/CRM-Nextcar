import os

path = "src/components/VehicleDetailModal.tsx"
with open(path, "r") as f:
    content = f.read()

# find handleSharePDF definition to its end
import re
match = re.search(r'(  const handleSharePDF = async \(e: React\.MouseEvent\) => \{.*?\n  \};\n)', content, re.DOTALL)
if match:
    func_text = match.group(1)
    # remove it from current position
    content = content.replace(func_text, '')
    
    # insert it after formData definition
    insert_after = """  const getLocalDateString = () => {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };"""
    content = content.replace(insert_after, insert_after + "\n\n" + func_text)
    
    with open(path, "w") as f:
        f.write(content)
    print("Moved handleSharePDF")
else:
    print("Could not find handleSharePDF")
