import os
import re

path = "server.ts"
with open(path, "r") as f:
    content = f.read()

# Fix getClientDb
old_client = """export function getClientDb() {
  const dbId = process.env.VITE_FIREBASE_DATABASE_ID;
  if (dbId && dbId !== "(default)") {
    return getFirestore(clientApp, dbId);
  }
  return getFirestore(clientApp);
}"""

new_client = """export function getClientDb() {
  return getFirestore(clientApp, "ai-studio-e65d5185-219a-4e1d-a330-044b1109696a");
}"""

content = content.replace(old_client, new_client)

# Fix getAdminDb
old_admin = """export function getAdminDb() {
  const adminApp = getAdminApp();
  if (!adminApp) return null;
  const dbId = process.env.VITE_FIREBASE_DATABASE_ID;
  if (dbId && dbId !== "(default)") {
    return getAdminFirestore(adminApp, dbId);
  }
  return getAdminFirestore(adminApp);
}"""

new_admin = """export function getAdminDb() {
  const adminApp = getAdminApp();
  if (!adminApp) return null;
  return getAdminFirestore(adminApp, "ai-studio-e65d5185-219a-4e1d-a330-044b1109696a");
}"""

content = content.replace(old_admin, new_admin)

with open(path, "w") as f:
    f.write(content)
print("Fixed db ID")
