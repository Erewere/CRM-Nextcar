import os
import re

path = "server.ts"
with open(path, "r") as f:
    content = f.read()

bad_str = 'const clientsRef = collection(db, "clients");\n      const docRef = await addDoc(clientsRef, newClient);'
good_str = """const clientsRef = collection(db, "clients");
      const newClient = {
        agencyId,
        name,
        phone: phone || "",
        email: email || "",
        vehicle: vehicle || "",
        origin: origin || "website",
        status: "new",
        sellerId: sellerId || "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      const docRef = await addDoc(clientsRef, newClient);"""

if bad_str in content:
    content = content.replace(bad_str, good_str)
    with open(path, "w") as f:
        f.write(content)
    print("Fixed newClient")
else:
    print("Not found")

