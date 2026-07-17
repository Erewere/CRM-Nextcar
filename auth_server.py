import os
import re

path = "server.ts"
with open(path, "r") as f:
    content = f.read()

# 1. Add imports
content = content.replace(
    'import { initializeApp as initClientApp } from "firebase/app";',
    'import { initializeApp as initClientApp } from "firebase/app";\nimport { getAuth as getClientAuth, signInWithCustomToken } from "firebase/auth";'
)

# 2. Add auth logic inside startServer
auth_logic = """  // Authenticate server app
  try {
    const cDb = getClientDb();
    const adminAuth = getAuth(getAdminApp()!);
    const token = await adminAuth.createCustomToken("system-admin");
    await signInWithCustomToken(getClientAuth(clientApp), token);
    
    // Ensure system-admin user doc exists
    await setDoc(doc(cDb, "users", "system-admin"), { role: "master", email: "system@localhost" }, { merge: true });
    console.log("Server authenticated as system-admin");
  } catch(e) {
    console.error("Failed to authenticate server:", e);
  }
"""

content = content.replace(
    '  const app = express();',
    '  const app = express();\n' + auth_logic
)

with open(path, "w") as f:
    f.write(content)
print("Added server auth")
