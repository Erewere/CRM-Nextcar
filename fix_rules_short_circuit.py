import os
import re

path = "firestore.rules"
with open(path, "r") as f:
    content = f.read()

old = r"allow create: if \(isSameAgency\(request\.resource\.data\.agencyId\) && \s*\n\s*\(isMaster\(\) \|\| isAdmin\(\) \|\| \(isAuthenticated\(\) && request\.resource\.data\.sellerId == request\.auth\.uid\)\)\) \|\|\s*\n\s*\(request\.resource\.data\.get\('origin', ''\) in \['whatsapp', 'messenger', 'virtual_assistant', 'api'\]\);"

new = r"""allow create: if (request.resource.data.get('origin', '') in ['whatsapp', 'messenger', 'virtual_assistant', 'api']) ||
                     (isSameAgency(request.resource.data.agencyId) && 
                     (isMaster() || isAdmin() || (isAuthenticated() && request.resource.data.sellerId == request.auth.uid)));"""

content = re.sub(old, new, content)

with open(path, "w") as f:
    f.write(content)
print("Short circuit applied")
