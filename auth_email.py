import os
import re

path = "server.ts"
with open(path, "r") as f:
    content = f.read()

# Add signInWithEmailAndPassword to imports
content = content.replace(
    'import { getAuth as getClientAuth, signInWithCustomToken } from "firebase/auth";',
    'import { getAuth as getClientAuth, signInWithEmailAndPassword } from "firebase/auth";\nimport { getAuth as getAdminAuth } from "firebase-admin/auth";'
)

auth_logic = """  // Authenticate server app with email/password
  try {
    const cDb = getClientDb();
    const adminAuth = getAdminAuth(getAdminApp()!);
    const email = "system@localhost";
    const password = "SuperSecretPassword123!";
    let systemUser;
    try {
      systemUser = await adminAuth.getUserByEmail(email);
    } catch(e) {
      if (e.code === 'auth/user-not-found') {
        systemUser = await adminAuth.createUser({ email, password });
      } else throw e;
    }
    
    const clientAuth = getClientAuth(clientApp);
    await signInWithEmailAndPassword(clientAuth, email, password);
    
    // Ensure system-admin user doc exists
    await setDoc(doc(cDb, "users", systemUser.uid), { role: "master", email, agencyId: "k77PpUc4SKDVCps2qSDw" }, { merge: true });
    console.log("Server authenticated as system admin:", systemUser.uid);
  } catch(e) {
    console.error("Failed to authenticate server:", e);
  }
"""

content = re.sub(
    r'  // Authenticate server app\n.*console\.error\("Failed to authenticate server:", e\);\n  }',
    auth_logic,
    content,
    flags=re.DOTALL
)

with open(path, "w") as f:
    f.write(content)
print("Added email auth")
