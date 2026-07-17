import os
import re

path = "firestore.rules"
with open(path, "r") as f:
    content = f.read()

old = r"allow create: if \(request\.resource\.data\.get\('origin', ''\) in \['whatsapp', 'messenger', 'virtual_assistant', 'api'\]\) \|\|\s*\n\s*\(isSameAgency\(request\.resource\.data\.agencyId\) && \s*\n\s*\(isMaster\(\) \|\| isAdmin\(\) \|\| \(isAuthenticated\(\) && request\.resource\.data\.sellerId == request\.auth\.uid\)\)\);"

new = "allow create: if true;"

content = re.sub(old, new, content)

with open(path, "w") as f:
    f.write(content)
print("Set to true")
