import os
path = "firestore.rules"
with open(path, "r") as f:
    content = f.read()

bad_str = "allow create: if isSameAgency(request.resource.data.agencyId) && \\n                     (isMaster() || isAdmin() || request.resource.data.sellerId == request.auth.uid);"
good_str = "allow create: if (isSameAgency(request.resource.data.agencyId) && \\n                     (isMaster() || isAdmin() || request.resource.data.sellerId == request.auth.uid)) ||\\n                     (request.resource.data.origin in ['whatsapp', 'messenger', 'virtual_assistant', 'api']);"

content = content.replace(bad_str, good_str)
with open(path, "w") as f:
    f.write(content)
print("Fixed rules")
