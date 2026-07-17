import os

path = "server.ts"
with open(path, "r") as f:
    content = f.read()

auth_logic = """  // Authenticate server app with email/password
  try {
    const cDb = getClientDb();
    const adminAuth = getAuth(getAdminApp()!);
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

content = content.replace('const app = express();', 'const app = express();\n' + auth_logic)
content = content.replace('import { getAuth as getClientAuth, signInWithCustomToken } from "firebase/auth";', 'import { getAuth as getClientAuth, signInWithEmailAndPassword } from "firebase/auth";')

with open(path, "w") as f:
    f.write(content)
print("Inserted")
