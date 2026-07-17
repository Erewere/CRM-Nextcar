import os
import re

path = "firestore.rules"
with open(path, "r") as f:
    content = f.read()

# Replace clients create rule
old = r"allow create: if isSameAgency\(request\.resource\.data\.agencyId\) && \s*\n\s*\(isMaster\(\) \|\| isAdmin\(\) \|\| request\.resource\.data\.sellerId == request\.auth\.uid\);"
new = r"""allow create: if (isSameAgency(request.resource.data.agencyId) && 
                     (isMaster() || isAdmin() || (isAuthenticated() && request.resource.data.sellerId == request.auth.uid))) ||
                     (request.resource.data.origin in ['whatsapp', 'messenger', 'virtual_assistant', 'api']);"""

content = re.sub(old, new, content)

with open(path, "w") as f:
    f.write(content)
print("Regex replace done")
