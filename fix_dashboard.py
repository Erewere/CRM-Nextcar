import os

path = "src/pages/Dashboard.tsx"
with open(path, "r") as f:
    content = f.read()

q_old = """        if (userData.role === "seller") {"""
q_new = """        if (userData.role === "seller" || (isMobile && userData.role === "admin" && userData.adminMobileViewAllContacts === false)) {"""

if q_old in content:
    content = content.replace(q_old, q_new)
else:
    print("Not found")

with open(path, "w") as f:
    f.write(content)
