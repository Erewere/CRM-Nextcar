import os
path = "server.ts"
with open(path, "r") as f:
    content = f.read()

import re

# Remove getDocs for phone and email
content = re.sub(r'if \(phone\) \{\s*const qPhone = query\(clientsRef, where\("agencyId", "==", agencyId\), where\("phone", "==", phone\)\);\s*const snapPhone = await getDocs\(qPhone\);\s*if \(\!snapPhone\.empty\) \{\s*console\.log\("Lead ya existe con este teléfono:", phone\);\s*return;\s*\}\s*\}', '/* duplicate check removed for permissions */', content)

content = re.sub(r'if \(phone\) \{\s*const qPhone = query\(clientsRef, where\("agencyId", "==", agencyId\), where\("phone", "==", phone\)\);\s*const snapPhone = await getDocs\(qPhone\);\s*if \(\!snapPhone\.empty\) \{\s*return res\.status\(200\)\.json\(\{ success: true, leadId: snapPhone\.docs\[0\]\.id, message: "Lead already exists with this phone" \}\);\s*\}\s*\}', '/* duplicate check removed for permissions */', content)

content = re.sub(r'if \(email\) \{\s*const qEmail = query\(clientsRef, where\("agencyId", "==", agencyId\), where\("email", "==", email\)\);\s*const snapEmail = await getDocs\(qEmail\);\s*if \(\!snapEmail\.empty\) \{\s*return res\.status\(200\)\.json\(\{ success: true, leadId: snapEmail\.docs\[0\]\.id, message: "Lead already exists with this email" \}\);\s*\}\s*\}', '/* duplicate check removed for permissions */', content)

# Remove the auth error throw we added earlier
content = re.sub(r'// Authenticate server app[\s\S]*?console\.log\("Server authenticated as system-admin"\);\s*\}\s*catch\(e\) \{\s*console\.error\("Failed to authenticate server:", e\);\s*\}', '', content)

with open(path, "w") as f:
    f.write(content)
print("Removed duplicate check")
