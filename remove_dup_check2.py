import os
path = "server.ts"
with open(path, "r") as f:
    content = f.read()

start_str = '      // Validar duplicados por teléfono'
end_str = 'const docRef = await addDoc(clientsRef, newClient);'

if start_str in content and end_str in content:
    start_idx = content.find(start_str)
    end_idx = content.find(end_str)
    content = content[:start_idx] + content[end_idx:]
    with open(path, "w") as f:
        f.write(content)
    print("Fixed public leads")
else:
    print("Not found public leads")

start_str2 = '    // Evitar duplicados por teléfono en Meta Lead (WA)'
end_str2 = 'const newClient = {'
if start_str2 in content and end_str2 in content:
    start_idx2 = content.find(start_str2)
    end_idx2 = content.find(end_str2)
    content = content[:start_idx2] + content[end_idx2:]
    with open(path, "w") as f:
        f.write(content)
    print("Fixed meta leads")
else:
    print("Not found meta leads")
