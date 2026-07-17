import os
import re

path = "server.ts"
with open(path, "r") as f:
    content = f.read()

auth_logic = r"  // Authenticate server app with email/password[\s\S]*?console\.error\(\"Failed to authenticate server:\", e\);\n  }"

content = re.sub(auth_logic, "", content)

with open(path, "w") as f:
    f.write(content)
print("Reverted auth")
